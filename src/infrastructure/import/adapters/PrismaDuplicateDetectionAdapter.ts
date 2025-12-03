/**
 * Adapter: Detección de duplicados con Prisma
 * Capa de Infraestructura
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
import { TextNormalizer } from "@/domain/import/services/TextNormalizer";

export class PrismaDuplicateDetectionAdapter implements IDuplicateDetectionService {
  constructor(private readonly prisma: PrismaClient) {}

  async checkDuplicate(criteria: DuplicateDetectionCriteria): Promise<DuplicateCheckResult> {
    const {
      name,
      streetType,
      streetName,
      streetNumber,
      exactMatch = true,
      similarityThreshold = 0.9,
    } = criteria;

    // Normalizar criterios de búsqueda
    const normalizedName = TextNormalizer.normalize(name);
    const normalizedAddress = TextNormalizer.normalizeAddress(streetType, streetName, streetNumber);

    if (!normalizedName || !normalizedAddress) {
      // Si no hay datos suficientes para comparar, no es duplicado
      return DuplicateCheckResult.noDuplicate(name, normalizedAddress);
    }

    // Buscar DEAs similares en la base de datos
    // Estrategia: Buscar por nombre similar primero (más selectivo)
    const potentialDuplicates = await this.prisma.aed.findMany({
      where: {
        // Buscar solo en registros activos (no eliminados)
        status: {
          in: ["DRAFT", "PENDING_REVIEW", "PUBLISHED"],
        },
      },
      include: {
        location: true,
      },
      // Limitar resultados para performance
      take: 100,
    });

    // Filtrar y calcular similitudes
    const matches: DuplicateMatch[] = [];

    for (const aed of potentialDuplicates) {
      const aedNormalizedName = TextNormalizer.normalize(aed.name);
      const aedNormalizedAddress = TextNormalizer.normalizeAddress(
        aed.location?.street_type,
        aed.location?.street_name,
        aed.location?.street_number
      );

      // Calcular similitudes
      const nameSimilarity = TextNormalizer.calculateSimilarity(normalizedName, aedNormalizedName);
      const addressSimilarity = TextNormalizer.calculateSimilarity(
        normalizedAddress,
        aedNormalizedAddress
      );

      // Decidir si es duplicado según el modo
      let isDuplicate = false;

      if (exactMatch) {
        // Modo exacto: ambos deben coincidir exactamente después de normalización
        isDuplicate =
          TextNormalizer.areExactMatch(name, aed.name) &&
          TextNormalizer.areExactMatch(normalizedAddress, aedNormalizedAddress);
      } else {
        // Modo fuzzy: ambos deben superar el umbral de similitud
        isDuplicate =
          nameSimilarity >= similarityThreshold && addressSimilarity >= similarityThreshold;
      }

      if (isDuplicate) {
        // Calcular similitud promedio para ordenar matches
        const avgSimilarity = (nameSimilarity + addressSimilarity) / 2;

        matches.push({
          aedId: aed.id,
          name: aed.name,
          address: this.formatAddress(
            aed.location?.street_type,
            aed.location?.street_name,
            aed.location?.street_number
          ),
          similarity: avgSimilarity,
          createdAt: aed.created_at,
        });
      }
    }

    // Ordenar matches por similitud descendente
    matches.sort((a, b) => b.similarity - a.similarity);

    // Retornar resultado
    if (matches.length > 0) {
      return DuplicateCheckResult.foundDuplicate(name, normalizedAddress, matches);
    }

    return DuplicateCheckResult.noDuplicate(name, normalizedAddress);
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
