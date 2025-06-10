import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface StreetSuggestion {
  tipoVia: string;
  nombreVia: string;
  codVia: number;
  distrito: number;
  confidence: number;
  reason: string;
  isExactMatch: boolean;
}

export interface StreetValidationResult {
  isValid: boolean;
  exactMatch: boolean;
  confidence: number;
  officialName: {
    tipoVia: string;
    nombreVia: string;
    codVia: number;
  } | null;
  suggestions: StreetSuggestion[];
  errors: string[];
  needsReview: boolean;
}

export interface OfficialStreetTypes {
  [key: string]: string[];
}

export class StreetValidationService {
  
  /**
   * Valida un nombre de vía contra el callejero oficial
   */
  async validateStreetName(
    tipoVia: string,
    nombreVia: string,
    distrito?: number,
    codigoPostal?: string
  ): Promise<StreetValidationResult> {
    const result: StreetValidationResult = {
      isValid: false,
      exactMatch: false,
      confidence: 0,
      officialName: null,
      suggestions: [],
      errors: [],
      needsReview: false
    };

    try {
      // 1. Búsqueda exacta
      const exactMatch = await this.findExactMatch(tipoVia, nombreVia, distrito);
      
      if (exactMatch) {
        result.isValid = true;
        result.exactMatch = true;
        result.confidence = 1.0;
        result.officialName = {
          tipoVia: exactMatch.viaClase || tipoVia,
          nombreVia: exactMatch.viaNombreAcentos || nombreVia,
          codVia: exactMatch.codVia
        };
        return result;
      }

      // 2. Búsqueda con tolerancia
      const similarStreets = await this.findSimilarStreets(
        tipoVia,
        nombreVia,
        distrito,
        codigoPostal
      );

      if (similarStreets.length > 0) {
        result.suggestions = similarStreets;
        
        // Si hay una sugerencia con alta confianza, considerarla válida
        const bestMatch = similarStreets[0];
        if (bestMatch.confidence >= 0.8) {
          result.isValid = true;
          result.confidence = bestMatch.confidence;
          result.officialName = {
            tipoVia: bestMatch.tipoVia,
            nombreVia: bestMatch.nombreVia,
            codVia: bestMatch.codVia
          };
          result.needsReview = true;
        } else {
          result.errors.push('No se encontró coincidencia exacta en el callejero oficial');
          result.needsReview = true;
        }
      } else {
        result.errors.push('Vía no encontrada en el callejero oficial de Madrid');
        result.needsReview = true;
      }

    } catch (error) {
      result.errors.push(`Error validando vía: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }

    return result;
  }

  /**
   * Busca coincidencia exacta en el callejero
   */
  private async findExactMatch(
    tipoVia: string,
    nombreVia: string,
    distrito?: number
  ): Promise<{
    codVia: number;
    viaClase: string | null;
    viaNombreAcentos: string | null;
  } | null> {
    const whereConditions = {
      AND: [
        {
          OR: [
            { viaClase: { equals: tipoVia, mode: 'insensitive' as const } },
            { viaPar: { equals: tipoVia, mode: 'insensitive' as const } }
          ]
        },
        {
          OR: [
            { viaNombreAcentos: { equals: nombreVia, mode: 'insensitive' as const } },
            { viaNombre: { equals: nombreVia.toUpperCase(), mode: 'insensitive' as const } }
          ]
        }
      ]
    };

    // Si se especifica distrito, filtrar por él
    if (distrito) {
      // Buscar en madrid_street_districts para verificar que la vía existe en ese distrito
      const streetInDistrict = await prisma.madridStreetDistrict.findFirst({
        where: {
          distrito: distrito,
          AND: [
            {
              OR: [
                { viaClase: { equals: tipoVia, mode: 'insensitive' as const } },
                { viaPar: { equals: tipoVia, mode: 'insensitive' as const } }
              ]
            },
            {
              OR: [
                { viaNombreAcentos: { equals: nombreVia, mode: 'insensitive' as const } },
                { viaNombre: { equals: nombreVia.toUpperCase(), mode: 'insensitive' as const } }
              ]
            }
          ]
        }
      });

      if (streetInDistrict) {
        return streetInDistrict;
      }
    }

    // Buscar en la tabla principal de calles
    const street = await prisma.madridStreet.findFirst({
      where: whereConditions
    });

    return street;
  }

  /**
   * Busca vías similares con tolerancia
   */
  private async findSimilarStreets(
    tipoVia: string,
    nombreVia: string,
    distrito?: number,
    codigoPostal?: string,
    maxResults: number = 5
  ): Promise<StreetSuggestion[]> {
    const suggestions: StreetSuggestion[] = [];

    try {
      // Normalizar entrada para búsqueda
      const normalizedName = this.normalizeStreetName(nombreVia);
      const normalizedType = this.normalizeStreetType(tipoVia);

      // Buscar en madrid_street_districts si hay distrito
      if (distrito) {
        const streetsInDistrict = await prisma.madridStreetDistrict.findMany({
          where: {
            distrito: distrito,
            viaNombreAcentos: { not: null }
          },
          take: 50 // Limitar para performance
        });

        for (const street of streetsInDistrict) {
          if (!street.viaNombreAcentos || !street.viaClase) continue;

          const nameDistance = this.calculateLevenshteinDistance(
            normalizedName,
            this.normalizeStreetName(street.viaNombreAcentos)
          );

          const typeDistance = this.calculateLevenshteinDistance(
            normalizedType,
            this.normalizeStreetType(street.viaClase)
          );

          // Calcular confianza basada en similitud
          const nameConfidence = Math.max(0, 1 - (nameDistance / Math.max(normalizedName.length, street.viaNombreAcentos.length)));
          const typeConfidence = Math.max(0, 1 - (typeDistance / Math.max(normalizedType.length, street.viaClase.length)));
          
          const overallConfidence = (nameConfidence * 0.7) + (typeConfidence * 0.3);

          if (overallConfidence >= 0.6) { // Umbral mínimo de similitud
            suggestions.push({
              tipoVia: street.viaClase,
              nombreVia: street.viaNombreAcentos,
              codVia: street.codVia,
              distrito: street.distrito || distrito,
              confidence: overallConfidence,
              reason: this.getReasonForSuggestion(nameDistance, typeDistance),
              isExactMatch: nameDistance === 0 && typeDistance === 0
            });
          }
        }
      }

      // Si no hay distrito o no se encontraron suficientes resultados, buscar en tabla general
      if (suggestions.length < 3) {
        const generalStreets = await prisma.madridStreet.findMany({
          where: {
            viaNombreAcentos: { not: null },
            viaClase: { not: null }
          },
          take: 100
        });

        for (const street of generalStreets) {
          if (!street.viaNombreAcentos || !street.viaClase) continue;

          const nameDistance = this.calculateLevenshteinDistance(
            normalizedName,
            this.normalizeStreetName(street.viaNombreAcentos)
          );

          const typeDistance = this.calculateLevenshteinDistance(
            normalizedType,
            this.normalizeStreetType(street.viaClase)
          );

          const nameConfidence = Math.max(0, 1 - (nameDistance / Math.max(normalizedName.length, street.viaNombreAcentos.length)));
          const typeConfidence = Math.max(0, 1 - (typeDistance / Math.max(normalizedType.length, street.viaClase.length)));
          
          let overallConfidence = (nameConfidence * 0.7) + (typeConfidence * 0.3);

          // Penalizar si no es del distrito correcto
          if (distrito) {
            overallConfidence *= 0.8;
          }

          if (overallConfidence >= 0.6) {
            suggestions.push({
              tipoVia: street.viaClase,
              nombreVia: street.viaNombreAcentos,
              codVia: street.codVia,
              distrito: distrito || 0,
              confidence: overallConfidence,
              reason: this.getReasonForSuggestion(nameDistance, typeDistance),
              isExactMatch: nameDistance === 0 && typeDistance === 0
            });
          }
        }
      }

      // Ordenar por confianza y eliminar duplicados
      const uniqueSuggestions = this.removeDuplicateSuggestions(suggestions);
      return uniqueSuggestions
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, maxResults);

    } catch (error) {
      console.error('Error buscando vías similares:', error);
      return [];
    }
  }

  /**
   * Obtiene todos los tipos de vía oficiales
   */
  async getOfficialStreetTypes(): Promise<string[]> {
    try {
      const types = await prisma.madridStreet.findMany({
        select: {
          viaClase: true
        },
        distinct: ['viaClase'],
        where: {
          viaClase: { not: null }
        }
      });

      return types
        .map((t: { viaClase: string | null }) => t.viaClase)
        .filter((type): type is string => type !== null)
        .sort();
    } catch (error) {
      console.error('Error obteniendo tipos de vía:', error);
      return ['Calle', 'Avenida', 'Plaza', 'Paseo', 'Glorieta', 'Ronda']; // Fallback
    }
  }

  /**
   * Obtiene vías de un distrito específico
   */
  async getStreetsByDistrict(distrito: number): Promise<Array<{
    codVia: number;
    tipoVia: string;
    nombreVia: string;
  }>> {
    try {
      const streets = await prisma.madridStreetDistrict.findMany({
        where: {
          distrito: distrito,
          viaNombreAcentos: { not: null },
          viaClase: { not: null }
        },
        select: {
          codVia: true,
          viaClase: true,
          viaNombreAcentos: true
        },
        distinct: ['codVia'],
        orderBy: {
          viaNombreAcentos: 'asc'
        }
      });

      return streets.map((street: { codVia: number; viaClase: string | null; viaNombreAcentos: string | null }) => ({
        codVia: street.codVia,
        tipoVia: street.viaClase || '',
        nombreVia: street.viaNombreAcentos || ''
      }));
    } catch (error) {
      console.error('Error obteniendo vías del distrito:', error);
      return [];
    }
  }

  /**
   * Busca vías por nombre parcial (para autocompletado)
   */
  async searchStreetsByName(
    partialName: string,
    distrito?: number,
    limit: number = 10
  ): Promise<Array<{
    codVia: number;
    tipoVia: string;
    nombreVia: string;
    distrito?: number;
  }>> {
    try {
      const whereCondition = {
        viaNombreAcentos: {
          contains: partialName,
          mode: 'insensitive' as const
        },
        ...(distrito && { distrito })
      };

      const streets = await prisma.madridStreetDistrict.findMany({
        where: whereCondition,
        select: {
          codVia: true,
          viaClase: true,
          viaNombreAcentos: true,
          distrito: true
        },
        take: limit,
        orderBy: {
          viaNombreAcentos: 'asc'
        }
      });

      return streets
        .filter((street: { viaClase: string | null; viaNombreAcentos: string | null }) => street.viaClase && street.viaNombreAcentos)
        .map((street: { codVia: number; viaClase: string | null; viaNombreAcentos: string | null; distrito: number | null }) => ({
          codVia: street.codVia,
          tipoVia: street.viaClase!,
          nombreVia: street.viaNombreAcentos!,
          distrito: street.distrito || undefined
        }));
    } catch (error) {
      console.error('Error buscando vías por nombre:', error);
      return [];
    }
  }

  /**
   * Normaliza nombre de vía para comparación
   */
  private normalizeStreetName(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Quitar acentos
      .replace(/[^\w\s]/g, '') // Quitar puntuación
      .replace(/\s+/g, ' ') // Normalizar espacios
      .trim();
  }

  /**
   * Normaliza tipo de vía para comparación
   */
  private normalizeStreetType(type: string): string {
    return type
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  /**
   * Calcula distancia de Levenshtein entre dos strings
   */
  private calculateLevenshteinDistance(str1: string, str2: string): number {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  /**
   * Genera razón para una sugerencia
   */
  private getReasonForSuggestion(nameDistance: number, typeDistance: number): string {
    if (nameDistance === 0 && typeDistance === 0) {
      return 'Coincidencia exacta';
    } else if (nameDistance === 0) {
      return 'Nombre exacto, tipo similar';
    } else if (typeDistance === 0) {
      return 'Tipo exacto, nombre similar';
    } else if (nameDistance <= 2 && typeDistance <= 1) {
      return 'Muy similar';
    } else {
      return 'Similar';
    }
  }

  /**
   * Elimina sugerencias duplicadas
   */
  private removeDuplicateSuggestions(suggestions: StreetSuggestion[]): StreetSuggestion[] {
    const seen = new Set<string>();
    return suggestions.filter(suggestion => {
      const key = `${suggestion.tipoVia}-${suggestion.nombreVia}-${suggestion.distrito}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }
}

export const streetValidationService = new StreetValidationService();
