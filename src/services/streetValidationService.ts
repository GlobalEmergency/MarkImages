// TODO: Re-enable when Madrid address tables are properly configured
// import { PrismaClient } from '@prisma/client';
// const prisma = new PrismaClient();

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
    // TODO: Implement with correct Madrid street tables
    console.warn('Madrid street validation not implemented - returning null', {
      tipoVia,
      nombreVia,
      distrito
    });
    return null;
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
    // TODO: Implement with correct Madrid street tables
    console.warn('Madrid street search not implemented - returning empty results', {
      tipoVia,
      nombreVia,
      distrito,
      codigoPostal,
      maxResults
    });
    return [];
  }

  /**
   * Obtiene todos los tipos de vía oficiales
   */
  async getOfficialStreetTypes(): Promise<string[]> {
    try {
      // TODO: Implement with correct Madrid street tables
      console.warn('Street types search not implemented - returning fallback');
      return ['Calle', 'Avenida', 'Plaza', 'Paseo', 'Glorieta', 'Ronda']; // Fallback
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
      // TODO: Implement with correct Madrid street tables
      console.warn('Streets by district search not implemented - returning empty results', { distrito });
      return [];
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
      // TODO: Implement with correct Madrid street tables
      console.warn('Street name search not implemented - returning empty results', {
        partialName,
        distrito,
        limit
      });
      return [];
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
