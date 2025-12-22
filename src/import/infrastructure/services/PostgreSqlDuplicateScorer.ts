/**
 * Implementación: Scoring de duplicados compatible con PostgreSQL
 * Capa de Infraestructura
 *
 * Implementa la lógica de scoring que se ejecuta en PostgreSQL.
 * Mantiene la misma lógica para consistencia y testabilidad.
 */

import {
  IDuplicateScoringService,
  AedComparisonData,
  ScoringWeights,
} from "@/import/domain/ports/IDuplicateScoringService";
import { ITextNormalizationService } from "@/import/domain/ports/ITextNormalizationService";

export class PostgreSqlDuplicateScorer implements IDuplicateScoringService {
  private readonly DEFAULT_WEIGHTS: ScoringWeights = {
    nameSimilarity: 30,
    addressMatch: 25,
    coordinatesProximity: 20,
    provisionalNumberMatch: 15,
    establishmentTypeMatch: 10,
    postalCodeMatch: 5,
    accessInstructionsDiff: -15,
    locationDetailsDiff: -20,
    floorDiff: -20,
  };

  private readonly COORDINATE_THRESHOLD_METERS = 5;
  private readonly NAME_SIMILARITY_THRESHOLD = 0.9;

  constructor(private readonly textNormalizer: ITextNormalizationService) {}

  /**
   * Calcula el score de duplicado entre dos DEAs
   * Replica la lógica que se ejecuta en PostgreSQL
   */
  async calculateScore(
    aed1: AedComparisonData,
    aed2: AedComparisonData,
    customWeights?: Partial<ScoringWeights>
  ): Promise<number> {
    const weights = { ...this.DEFAULT_WEIGHTS, ...customWeights };
    let score = 0;

    // ========== CAMPOS QUE SUMAN PUNTOS (+) ==========

    // 1. Nombre similar (>0.9) → +30 puntos
    const nameSimilarity = this.calculateSimilarity(aed1.name, aed2.name);
    if (nameSimilarity >= this.NAME_SIMILARITY_THRESHOLD) {
      score += weights.nameSimilarity;
    }

    // 2. Dirección exacta → +25 puntos
    const address1 = this.textNormalizer.normalizeAddress(
      aed1.streetType,
      aed1.streetName,
      aed1.streetNumber
    );
    const address2 = this.textNormalizer.normalizeAddress(
      aed2.streetType,
      aed2.streetName,
      aed2.streetNumber
    );
    if (address1 && address2 && address1 === address2) {
      score += weights.addressMatch;
    }

    // 3. Coordenadas cercanas (<5 metros) → +20 puntos
    if (aed1.latitude && aed1.longitude && aed2.latitude && aed2.longitude) {
      const distance = this.calculateDistance(
        aed1.latitude,
        aed1.longitude,
        aed2.latitude,
        aed2.longitude
      );
      if (distance <= this.COORDINATE_THRESHOLD_METERS) {
        score += weights.coordinatesProximity;
      }
    }

    // 4. Provisional_number igual (si existe y >0) → +15 puntos
    if (
      aed1.provisionalNumber &&
      aed2.provisionalNumber &&
      aed1.provisionalNumber > 0 &&
      aed2.provisionalNumber > 0 &&
      aed1.provisionalNumber === aed2.provisionalNumber
    ) {
      score += weights.provisionalNumberMatch;
    }

    // 5. Tipo de establecimiento igual → +10 puntos
    if (aed1.establishmentType && aed2.establishmentType) {
      const norm1 = this.textNormalizer.normalize(aed1.establishmentType);
      const norm2 = this.textNormalizer.normalize(aed2.establishmentType);
      if (norm1 === norm2) {
        score += weights.establishmentTypeMatch;
      }
    }

    // 6. Código postal igual → +5 puntos
    if (aed1.postalCode && aed2.postalCode) {
      const norm1 = this.textNormalizer.normalize(aed1.postalCode);
      const norm2 = this.textNormalizer.normalize(aed2.postalCode);
      if (norm1 === norm2) {
        score += weights.postalCodeMatch;
      }
    }

    // ========== CAMPOS QUE RESTAN PUNTOS (-) ==========

    // 7. Piso/planta diferente → -20 puntos
    if (this.areDifferent(aed1.floor, aed2.floor)) {
      score += weights.floorDiff; // Nota: weight es negativo
    }

    // 8. Ubicación específica diferente → -20 puntos
    if (this.areDifferent(aed1.locationDetails, aed2.locationDetails)) {
      score += weights.locationDetailsDiff; // Nota: weight es negativo
    }

    // 9. Instrucciones de acceso diferentes → -15 puntos
    if (this.areDifferent(aed1.accessInstructions, aed2.accessInstructions)) {
      score += weights.accessInstructionsDiff; // Nota: weight es negativo
    }

    // Asegurar que el score esté entre 0 y 100
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Determina si un score indica duplicado
   */
  isDuplicate(score: number, threshold: number = 70): boolean {
    return score >= threshold;
  }

  /**
   * Genera explicación detallada del score
   */
  async explainScore(
    aed1: AedComparisonData,
    aed2: AedComparisonData,
    score: number
  ): Promise<string> {
    const details: string[] = [];

    const nameSim = this.calculateSimilarity(aed1.name, aed2.name);
    if (nameSim >= this.NAME_SIMILARITY_THRESHOLD) {
      details.push(`✅ Nombre similar (${nameSim.toFixed(2)}): +30`);
    }

    const addr1 = this.textNormalizer.normalizeAddress(
      aed1.streetType,
      aed1.streetName,
      aed1.streetNumber
    );
    const addr2 = this.textNormalizer.normalizeAddress(
      aed2.streetType,
      aed2.streetName,
      aed2.streetNumber
    );
    if (addr1 === addr2) {
      details.push(`✅ Dirección exacta: +25`);
    }

    if (aed1.latitude && aed1.longitude && aed2.latitude && aed2.longitude) {
      const dist = this.calculateDistance(
        aed1.latitude,
        aed1.longitude,
        aed2.latitude,
        aed2.longitude
      );
      if (dist <= this.COORDINATE_THRESHOLD_METERS) {
        details.push(`✅ Coordenadas cercanas (${dist.toFixed(1)}m): +20`);
      }
    }

    if (
      aed1.provisionalNumber === aed2.provisionalNumber &&
      aed1.provisionalNumber &&
      aed1.provisionalNumber > 0
    ) {
      details.push(`✅ Provisional_number igual (${aed1.provisionalNumber}): +15`);
    }

    if (aed1.establishmentType && aed2.establishmentType) {
      const norm1 = this.textNormalizer.normalize(aed1.establishmentType);
      const norm2 = this.textNormalizer.normalize(aed2.establishmentType);
      if (norm1 === norm2) {
        details.push(`✅ Tipo establecimiento igual: +10`);
      }
    }

    if (aed1.postalCode && aed2.postalCode) {
      const norm1 = this.textNormalizer.normalize(aed1.postalCode);
      const norm2 = this.textNormalizer.normalize(aed2.postalCode);
      if (norm1 === norm2) {
        details.push(`✅ Código postal igual (${aed1.postalCode}): +5`);
      }
    }

    if (this.areDifferent(aed1.floor, aed2.floor)) {
      details.push(`❌ Piso diferente: -20`);
    }

    if (this.areDifferent(aed1.locationDetails, aed2.locationDetails)) {
      details.push(`❌ Ubicación específica diferente: -20`);
    }

    if (this.areDifferent(aed1.accessInstructions, aed2.accessInstructions)) {
      details.push(`❌ Instrucciones acceso diferentes: -15`);
    }

    return `Score: ${score}/100\n${details.join("\n")}`;
  }

  /**
   * Calcula similitud simple entre dos textos (0-1)
   * Versión simplificada para mantener consistencia con PostgreSQL similarity()
   */
  private calculateSimilarity(text1: string, text2: string): number {
    const norm1 = this.textNormalizer.normalize(text1);
    const norm2 = this.textNormalizer.normalize(text2);

    if (norm1 === norm2) return 1.0;
    if (!norm1 || !norm2) return 0.0;

    // Similitud basada en palabras comunes
    const words1 = new Set(norm1.split(/\s+/));
    const words2 = new Set(norm2.split(/\s+/));

    const intersection = new Set([...words1].filter((x) => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }

  /**
   * Determina si dos valores son diferentes (y no vacíos)
   */
  private areDifferent(
    value1: string | null | undefined,
    value2: string | null | undefined
  ): boolean {
    if (!value1 || !value2) return false;

    const norm1 = this.textNormalizer.normalize(value1);
    const norm2 = this.textNormalizer.normalize(value2);

    if (!norm1 || !norm2) return false;

    return norm1 !== norm2;
  }

  /**
   * Calcula distancia en metros entre dos coordenadas (Haversine)
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Radio de la Tierra en metros
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }
}
