/**
 * Servicio de Dominio: Sistema de Scoring para Detección de Duplicados
 *
 * Calcula un score de 0-100 puntos para determinar si dos DEAs son duplicados.
 *
 * Sistema de Puntuación:
 * - Suma puntos por similitudes (nombre, dirección, coordenadas, etc.)
 * - Resta puntos por diferencias en ubicación específica (planta, descripción acceso, etc.)
 * - Threshold por defecto: >= 70 puntos = duplicado
 */

import { TextNormalizer } from "./TextNormalizer";

export interface ScoringWeights {
  // Pesos para campos que suman puntos
  nameSimilarity: number; // +30 puntos (similar >0.9)
  addressMatch: number; // +25 puntos (exacto)
  coordinatesProximity: number; // +20 puntos (<5 metros)
  provisionalNumberMatch: number; // +15 puntos (igual)
  establishmentTypeMatch: number; // +10 puntos (igual)
  postalCodeMatch: number; // +5 puntos (igual)

  // Pesos para campos que restan puntos (diferencias)
  accessDescriptionDiff: number; // -15 puntos (diferente)
  specificLocationDiff: number; // -20 puntos (diferente)
  floorDiff: number; // -20 puntos (diferente) - AUMENTADO de -15 para edge cases
  visibleReferencesDiff: number; // -10 puntos (diferente)
}

export interface AedComparisonData {
  name: string;
  streetType?: string | null;
  streetName?: string | null;
  streetNumber?: string | null;
  postalCode?: string | null;
  provisionalNumber?: number | null;
  establishmentType?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  accessDescription?: string | null;
  specificLocation?: string | null;
  floor?: string | null;
  visibleReferences?: string | null;
}

export class DuplicateScoringService {
  private static readonly DEFAULT_WEIGHTS: ScoringWeights = {
    nameSimilarity: 30,
    addressMatch: 25,
    coordinatesProximity: 20,
    provisionalNumberMatch: 15,
    establishmentTypeMatch: 10,
    postalCodeMatch: 5,
    accessDescriptionDiff: -15,
    specificLocationDiff: -20,
    floorDiff: -20,
    visibleReferencesDiff: -10,
  };

  private static readonly COORDINATE_THRESHOLD_METERS = 5;
  private static readonly NAME_SIMILARITY_THRESHOLD = 0.9;

  /**
   * Calcula el score de duplicado entre dos DEAs
   * @param aed1 Primer DEA a comparar
   * @param aed2 Segundo DEA a comparar
   * @param weights Pesos personalizados (opcional)
   * @returns Score de 0-100 puntos (mayor = más probable que sea duplicado)
   */
  static calculateScore(
    aed1: AedComparisonData,
    aed2: AedComparisonData,
    weights: ScoringWeights = this.DEFAULT_WEIGHTS
  ): number {
    let score = 0;

    // ========== CAMPOS QUE SUMAN PUNTOS (+) ==========

    // 1. Nombre similar (>0.9) → +30 puntos
    const nameSimilarity = TextNormalizer.calculateSimilarity(aed1.name, aed2.name);
    if (nameSimilarity >= this.NAME_SIMILARITY_THRESHOLD) {
      score += weights.nameSimilarity;
    }

    // 2. Dirección exacta → +25 puntos
    const address1 = TextNormalizer.normalizeAddress(
      aed1.streetType,
      aed1.streetName,
      aed1.streetNumber
    );
    const address2 = TextNormalizer.normalizeAddress(
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
    if (
      aed1.establishmentType &&
      aed2.establishmentType &&
      TextNormalizer.areExactMatch(aed1.establishmentType, aed2.establishmentType)
    ) {
      score += weights.establishmentTypeMatch;
    }

    // 6. Código postal igual → +5 puntos
    if (
      aed1.postalCode &&
      aed2.postalCode &&
      TextNormalizer.areExactMatch(aed1.postalCode, aed2.postalCode)
    ) {
      score += weights.postalCodeMatch;
    }

    // ========== CAMPOS QUE RESTAN PUNTOS (-) ==========
    // Indican que son DEAs diferentes (ej: diferentes plantas, ubicaciones específicas)

    // 6. Descripción de acceso diferente → -15 puntos
    if (this.areDifferent(aed1.accessDescription, aed2.accessDescription)) {
      score += weights.accessDescriptionDiff; // Nota: weight es negativo
    }

    // 7. Ubicación específica diferente → -20 puntos
    if (this.areDifferent(aed1.specificLocation, aed2.specificLocation)) {
      score += weights.specificLocationDiff; // Nota: weight es negativo
    }

    // 8. Piso/planta diferente → -15 puntos
    if (this.areDifferent(aed1.floor, aed2.floor)) {
      score += weights.floorDiff; // Nota: weight es negativo
    }

    // 9. Referencias visibles diferentes → -10 puntos
    if (this.areDifferent(aed1.visibleReferences, aed2.visibleReferences)) {
      score += weights.visibleReferencesDiff; // Nota: weight es negativo
    }

    // Asegurar que el score esté entre 0 y 100
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Determina si dos valores de campo son diferentes (y no vacíos)
   * @returns true si ambos tienen valor y son diferentes
   */
  private static areDifferent(
    value1: string | null | undefined,
    value2: string | null | undefined
  ): boolean {
    // Si alguno está vacío, no restamos puntos (no hay información suficiente)
    if (!value1 || !value2) return false;

    // Normalizar y comparar
    const norm1 = TextNormalizer.normalize(value1);
    const norm2 = TextNormalizer.normalize(value2);

    // Si alguno normalizó a string vacío, no comparar
    if (!norm1 || !norm2) return false;

    // Son diferentes si no coinciden después de normalización
    return norm1 !== norm2;
  }

  /**
   * Calcula la distancia en metros entre dos coordenadas usando la fórmula de Haversine
   */
  private static calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Radio de la Tierra en metros
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distancia en metros
  }

  /**
   * Determina si un score indica que dos DEAs son duplicados
   * @param score Score calculado (0-100)
   * @param threshold Umbral personalizado (opcional, default: 70)
   * @returns true si el score indica duplicado
   */
  static isDuplicate(score: number, threshold: number = 70): boolean {
    return score >= threshold;
  }

  /**
   * Genera un mensaje explicativo del score calculado
   * Útil para debugging y logs
   */
  static explainScore(aed1: AedComparisonData, aed2: AedComparisonData, score: number): string {
    const details: string[] = [];

    const nameSim = TextNormalizer.calculateSimilarity(aed1.name, aed2.name);
    if (nameSim >= this.NAME_SIMILARITY_THRESHOLD) {
      details.push(`✅ Nombre similar (${nameSim.toFixed(2)}): +30`);
    }

    const addr1 = TextNormalizer.normalizeAddress(
      aed1.streetType,
      aed1.streetName,
      aed1.streetNumber
    );
    const addr2 = TextNormalizer.normalizeAddress(
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
      if (TextNormalizer.areExactMatch(aed1.establishmentType, aed2.establishmentType)) {
        details.push(`✅ Tipo establecimiento igual: +10`);
      }
    }

    if (aed1.postalCode && aed2.postalCode) {
      if (TextNormalizer.areExactMatch(aed1.postalCode, aed2.postalCode)) {
        details.push(`✅ Código postal igual (${aed1.postalCode}): +5`);
      }
    }

    if (this.areDifferent(aed1.accessDescription, aed2.accessDescription)) {
      details.push(`❌ Descripción acceso diferente: -15`);
    }

    if (this.areDifferent(aed1.specificLocation, aed2.specificLocation)) {
      details.push(`❌ Ubicación específica diferente: -20`);
    }

    if (this.areDifferent(aed1.floor, aed2.floor)) {
      details.push(`❌ Piso diferente: -20`);
    }

    if (this.areDifferent(aed1.visibleReferences, aed2.visibleReferences)) {
      details.push(`❌ Referencias visibles diferentes: -10`);
    }

    return `Score: ${score}/100\n${details.join("\n")}`;
  }
}
