/**
 * Adapter: Detección de duplicados con Prisma
 * Capa de Infraestructura
 *
 * Implementa búsqueda híbrida:
 * - CON coordenadas: búsqueda espacial PostGIS (radio configurable)
 * - SIN coordenadas: fallback por código postal + scoring exhaustivo
 */

import { PrismaClient } from "@/generated/client";
import {
  DuplicateDetectionCriteria,
  IDuplicateDetectionService,
} from "@/domain/import/ports/IDuplicateDetectionService";
import {
  DuplicateCheckResult,
  DuplicateMatch,
} from "@/domain/import/value-objects/DuplicateCheckResult";
import { DuplicateScoringService } from "@/domain/import/services/DuplicateScoringService";
import { DuplicateDetectionConfig } from "@/domain/import/config/DuplicateDetectionConfig";

export class PrismaDuplicateDetectionAdapter implements IDuplicateDetectionService {
  constructor(private readonly prisma: PrismaClient) {}

  async checkDuplicate(criteria: DuplicateDetectionCriteria): Promise<DuplicateCheckResult> {
    const {
      name,
      streetType,
      streetName,
      streetNumber,
      postalCode,
      provisionalNumber,
      establishmentType,
      latitude,
      longitude,
      accessDescription,
      specificLocation,
      floor,
      visibleReferences,
    } = criteria;

    const address = this.formatAddress(streetType, streetName, streetNumber);

    if (!name) {
      // Si no hay nombre, no podemos comparar
      return DuplicateCheckResult.noDuplicate(name, address);
    }

    // ========================================
    // ESTRATEGIA 1: Búsqueda espacial con PostGIS (si hay coordenadas)
    // ========================================
    let potentialDuplicates: any[] = [];

    if (latitude && longitude) {
      // Intentar búsqueda espacial primero (más eficiente si hay geom)
      potentialDuplicates = await this.findByCoordinates(latitude, longitude);

      // Si no encuentra nada con geom, buscar por código postal como fallback
      if (potentialDuplicates.length === 0 && postalCode) {
        // Log deshabilitado para producción
        // console.log(`⚠️ No se encontraron registros con geom. Fallback a búsqueda por código postal: ${postalCode}`);
        potentialDuplicates = await this.findByPostalCode(postalCode);
      }
    }
    // ========================================
    // ESTRATEGIA 2: Fallback por código postal (sin coordenadas)
    // ========================================
    else if (postalCode && DuplicateDetectionConfig.fallback.usePostalCodeFilter) {
      // Buscar por código postal
      potentialDuplicates = await this.findByPostalCode(postalCode);
    }
    // ========================================
    // ESTRATEGIA 3: Búsqueda completa (último recurso)
    // ========================================
    else if (DuplicateDetectionConfig.fallback.searchAllIfNoPostalCode) {
      // Sin coordenadas ni código postal - buscar en toda la BD
      // ADVERTENCIA: Esto puede ser muy lento (2-5 segundos)
      potentialDuplicates = await this.findAll();
    } else {
      // No se puede verificar duplicados sin coordenadas o código postal
      // Retornar como no duplicado (pero podría requerir revisión manual)
      return DuplicateCheckResult.noDuplicate(name, address);
    }

    // ========================================
    // SCORING: Calcular puntuación para cada candidato
    // ========================================
    const confirmedMatches: DuplicateMatch[] = [];
    const possibleMatches: DuplicateMatch[] = [];

    const newAedData = {
      name,
      streetType,
      streetName,
      streetNumber,
      postalCode,
      provisionalNumber,
      establishmentType,
      latitude,
      longitude,
      accessDescription,
      specificLocation,
      floor,
      visibleReferences,
    };

    for (const aed of potentialDuplicates) {
      const existingAedData = {
        name: aed.name,
        streetType: aed.street_type ?? aed.location?.street_type,
        streetName: aed.street_name ?? aed.location?.street_name,
        streetNumber: aed.street_number ?? aed.location?.street_number,
        postalCode: aed.postal_code ?? aed.location?.postal_code,
        provisionalNumber: aed.provisional_number,
        establishmentType: aed.establishment_type,
        latitude: aed.latitude,
        longitude: aed.longitude,
        accessDescription: aed.access_description ?? aed.location?.access_description,
        specificLocation: aed.specific_location ?? aed.location?.specific_location,
        floor: aed.floor ?? aed.location?.floor,
        visibleReferences: aed.visible_references ?? aed.location?.visible_references,
      };

      // Calcular score usando el servicio de scoring
      const score = DuplicateScoringService.calculateScore(newAedData, existingAedData);

      // 🔍 Log detallado del scoring para candidatos relevantes (deshabilitado para producción)
      // Descomentar solo para debugging:
      /*
      if (score >= DuplicateDetectionConfig.thresholds.possible) {
        const explanation = DuplicateScoringService.explainScore(newAedData, existingAedData, score);
        console.log(`\n🔍 Candidato duplicado encontrado:`);
        console.log(`   AED existente: ${aed.name} (ID: ${aed.id})`);
        console.log(`   Score: ${score}/100`);
        console.log(explanation);
      }
      */

      // Clasificar según umbrales configurables
      const match: DuplicateMatch = {
        aedId: aed.id,
        name: aed.name,
        address: this.formatAddress(
          existingAedData.streetType,
          existingAedData.streetName,
          existingAedData.streetNumber
        ),
        similarity: score / 100, // Compatibilidad (0-1)
        score: score, // Score real (0-100)
        createdAt: aed.created_at,
      };

      // Aplicar umbrales configurables
      if (score >= DuplicateDetectionConfig.thresholds.confirmed) {
        // Score >= 80: DUPLICADO CONFIRMADO
        confirmedMatches.push(match);
      } else if (score >= DuplicateDetectionConfig.thresholds.possible) {
        // Score 60-79: POSIBLE DUPLICADO
        possibleMatches.push(match);
      }
      // Score < 60: ignorar (no es duplicado)
    }

    // Ordenar por score descendente
    confirmedMatches.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    possibleMatches.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

    // ========================================
    // RETORNAR RESULTADO SEGÚN PRIORIDAD
    // ========================================

    // Prioridad 1: Duplicados confirmados (rechazar)
    if (confirmedMatches.length > 0) {
      return DuplicateCheckResult.foundDuplicate(name, address, confirmedMatches);
    }

    // Prioridad 2: Posibles duplicados (revisar manualmente)
    if (possibleMatches.length > 0) {
      return DuplicateCheckResult.foundPossibleDuplicate(name, address, possibleMatches);
    }

    // No hay duplicados
    return DuplicateCheckResult.noDuplicate(name, address);
  }

  async checkMultipleDuplicates(
    criteriaList: DuplicateDetectionCriteria[]
  ): Promise<Map<number, DuplicateCheckResult>> {
    const results = new Map<number, DuplicateCheckResult>();

    // Verificar cada criterio individualmente
    // TODO: Optimización futura - búsqueda batch con queries más eficientes
    for (let i = 0; i < criteriaList.length; i++) {
      const result = await this.checkDuplicate(criteriaList[i]);
      results.set(i, result);
    }

    return results;
  }

  /**
   * ESTRATEGIA 1: Búsqueda espacial con PostGIS
   * Busca DEAs dentro del radio configurado (100m)
   * Más eficiente: solo revisa ~5-15 registros cercanos
   */
  private async findByCoordinates(latitude: number, longitude: number): Promise<any[]> {
    const { radiusDegrees, srid } = DuplicateDetectionConfig.spatial;

    try {
      // Query raw con PostGIS - búsqueda por radio
      const results = await this.prisma.$queryRaw<any[]>`
        SELECT 
          a.id,
          a.name,
          a.status,
          a.latitude,
          a.longitude,
          a.provisional_number,
          a.establishment_type,
          a.created_at,
          l.id as location_id,
          l.street_type,
          l.street_name,
          l.street_number,
          l.postal_code,
          l.access_description,
          l.specific_location,
          l.floor,
          l.visible_references
        FROM aeds a
        LEFT JOIN aed_locations l ON a.location_id = l.id
        WHERE
          a.geom IS NOT NULL
          AND ST_DWithin(
            a.geom,
            ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), ${srid}),
            ${radiusDegrees}
          )
      `;

      return results;
    } catch (error) {
      console.error("Error en búsqueda espacial PostGIS:", error);
      // Fallback: buscar todos (menos eficiente pero funcional)
      return this.findAll();
    }
  }

  /**
   * ESTRATEGIA 2: Búsqueda por código postal
   * Cuando no hay coordenadas pero sí código postal
   * Moderadamente eficiente: ~100-300 registros por código postal
   */
  private async findByPostalCode(postalCode: string): Promise<any[]> {
    return this.prisma.aed.findMany({
      where: {
        location: {
          postal_code: postalCode,
        },
      },
      include: {
        location: true,
      },
    });
  }

  /**
   * ESTRATEGIA 3: Búsqueda completa
   * Último recurso cuando no hay coordenadas ni código postal
   * ADVERTENCIA: Muy lento (~2-5 segundos), revisa TODOS los registros activos
   */
  private async findAll(): Promise<any[]> {
    return this.prisma.aed.findMany({
      include: {
        location: true,
      },
    });
  }

  /**
   * Formatea una dirección para mostrar
   */
  private formatAddress(
    streetType: string | null | undefined,
    streetName: string | null | undefined,
    streetNumber: string | null | undefined
  ): string {
    const parts: string[] = [];

    if (streetType) parts.push(streetType);
    if (streetName) parts.push(streetName);
    if (streetNumber) parts.push(streetNumber);

    return parts.join(" ") || "Dirección no disponible";
  }
}
