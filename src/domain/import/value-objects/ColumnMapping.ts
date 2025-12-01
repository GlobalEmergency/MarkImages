/**
 * Value Object: Mapeo de una columna CSV a un campo del sistema
 * Capa de Dominio
 */

import { FieldDefinition } from './FieldDefinition';

export class ColumnMapping {
  private constructor(
    private readonly csvColumn: string,
    private readonly systemField: string,
    private readonly confidence: number
  ) {
    if (confidence < 0 || confidence > 1) {
      throw new Error('Confidence must be between 0 and 1');
    }
  }

  get csvColumnName(): string {
    return this.csvColumn;
  }

  get systemFieldKey(): string {
    return this.systemField;
  }

  get confidenceScore(): number {
    return this.confidence;
  }

  /**
   * Determina si el mapeo es suficientemente confiable
   * para sugerirlo automáticamente
   */
  isConfident(): boolean {
    return this.confidence >= 0.7;
  }

  /**
   * Crea un mapeo manual (100% confianza)
   */
  static create(csvColumn: string, systemField: string): ColumnMapping {
    return new ColumnMapping(csvColumn, systemField, 1.0);
  }

  /**
   * Crea un mapeo sugerido con nivel de confianza calculado
   */
  static suggest(
    csvColumn: string,
    systemField: string,
    confidence: number
  ): ColumnMapping {
    return new ColumnMapping(csvColumn, systemField, confidence);
  }

  /**
   * Intenta sugerir un mapeo automático basado en similitud de nombres
   */
  static autoSuggest(
    csvColumn: string,
    fieldDefinitions: FieldDefinition[]
  ): ColumnMapping | null {
    const normalizedCsvColumn = this.normalizeColumnName(csvColumn);
    let bestMatch: { field: FieldDefinition; score: number } | null = null;

    for (const field of fieldDefinitions) {
      const normalizedFieldLabel = this.normalizeColumnName(field.label);
      const normalizedFieldKey = this.normalizeColumnName(field.key);

      // Calcular similitud con label
      const labelScore = this.calculateSimilarity(normalizedCsvColumn, normalizedFieldLabel);

      // Calcular similitud con key
      const keyScore = this.calculateSimilarity(normalizedCsvColumn, normalizedFieldKey);

      // Tomar la mejor puntuación
      const score = Math.max(labelScore, keyScore);

      // Bonus si contiene palabras clave del field
      const bonusScore = this.calculateKeywordBonus(normalizedCsvColumn, field);

      const finalScore = Math.min(score + bonusScore, 1.0);

      if (!bestMatch || finalScore > bestMatch.score) {
        bestMatch = { field, score: finalScore };
      }
    }

    // Solo sugerir si hay un match razonable
    if (bestMatch && bestMatch.score > 0.5) {
      return new ColumnMapping(csvColumn, bestMatch.field.key, bestMatch.score);
    }

    return null;
  }

  /**
   * Normaliza un nombre de columna para comparación
   */
  private static normalizeColumnName(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Eliminar acentos
      .replace(/[^a-z0-9]/g, '') // Solo letras y números
      .trim();
  }

  /**
   * Calcula similitud entre dos strings normalizados (0-1)
   * Usa Levenshtein distance normalizado
   */
  private static calculateSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 1.0;
    if (str1.length === 0 || str2.length === 0) return 0.0;

    // Coincidencia exacta de substring
    if (str1.includes(str2) || str2.includes(str1)) {
      const minLen = Math.min(str1.length, str2.length);
      const maxLen = Math.max(str1.length, str2.length);
      return minLen / maxLen;
    }

    // Levenshtein distance
    const distance = this.levenshteinDistance(str1, str2);
    const maxLength = Math.max(str1.length, str2.length);
    return 1 - distance / maxLength;
  }

  /**
   * Calcula Levenshtein distance entre dos strings
   */
  private static levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0]![j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2[i - 1] === str1[j - 1]) {
          matrix[i]![j] = matrix[i - 1]![j - 1]!;
        } else {
          matrix[i]![j] = Math.min(
            matrix[i - 1]![j - 1]! + 1, // substitution
            matrix[i]![j - 1]! + 1, // insertion
            matrix[i - 1]![j]! + 1 // deletion
          );
        }
      }
    }

    return matrix[str2.length]![str1.length]!;
  }

  /**
   * Calcula bonus por palabras clave en el nombre del campo
   */
  private static calculateKeywordBonus(
    normalizedCsvColumn: string,
    field: FieldDefinition
  ): number {
    const keywords: Record<string, string[]> = {
      email: ['correo', 'email', 'mail'],
      district: ['distrito'],
      street: ['calle', 'via', 'street'],
      number: ['numero', 'num'],
      postal: ['postal', 'cp'],
      latitude: ['latitud', 'lat', 'coordenada'],
      longitude: ['longitud', 'lon', 'lng', 'coordenada'],
      phone: ['telefono', 'tel', 'phone'],
      photo: ['foto', 'photo', 'imagen', 'image'],
      schedule: ['horario', 'schedule', 'hora'],
      name: ['nombre', 'name', 'denominacion'],
      ownership: ['titularidad', 'ownership'],
      surveillance: ['vigilancia', 'vigilante'],
    };

    let bonus = 0.0;

    for (const [category, words] of Object.entries(keywords)) {
      if (field.key.toLowerCase().includes(category)) {
        for (const word of words) {
          if (normalizedCsvColumn.includes(word)) {
            bonus += 0.2;
            break;
          }
        }
      }
    }

    return Math.min(bonus, 0.3); // Max bonus de 0.3
  }

  /**
   * Convierte a objeto plano para serialización
   */
  toJSON(): {
    csvColumn: string;
    systemField: string;
    confidence: number;
  } {
    return {
      csvColumn: this.csvColumn,
      systemField: this.systemField,
      confidence: this.confidence,
    };
  }

  /**
   * Crea desde objeto plano
   */
  static fromJSON(data: {
    csvColumn: string;
    systemField: string;
    confidence: number;
  }): ColumnMapping {
    return new ColumnMapping(data.csvColumn, data.systemField, data.confidence);
  }
}
