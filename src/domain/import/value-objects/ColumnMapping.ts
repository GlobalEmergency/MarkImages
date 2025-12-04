/**
 * Value Object: Mapeo de una columna CSV a un campo del sistema
 * Algoritmo mejorado con keywords expandidas y pattern matching
 * Capa de Dominio
 */

import { FieldDefinition } from "./FieldDefinition";

export class ColumnMapping {
  private constructor(
    private readonly csvColumn: string,
    private readonly systemField: string,
    private readonly confidence: number
  ) {
    if (confidence < 0 || confidence > 1) {
      throw new Error("Confidence must be between 0 and 1");
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
  static suggest(csvColumn: string, systemField: string, confidence: number): ColumnMapping {
    return new ColumnMapping(csvColumn, systemField, confidence);
  }

  /**
   * Intenta sugerir un mapeo automático basado en similitud de nombres
   * ALGORITMO MEJORADO con keywords expandidas y pattern matching
   */
  static autoSuggest(
    csvColumn: string,
    fieldDefinitions: FieldDefinition[],
    sampleData?: string[]
  ): ColumnMapping | null {
    const normalizedCsvColumn = this.normalizeColumnName(csvColumn);
    let bestMatch: { field: FieldDefinition; score: number } | null = null;

    for (const field of fieldDefinitions) {
      // 1. Score por similitud de nombres (40%)
      const nameScore = this.calculateNameSimilarity(normalizedCsvColumn, field);

      // 2. Score por keywords expandidas (30%)
      const keywordScore = this.calculateKeywordScore(normalizedCsvColumn, field);

      // 3. Score por pattern matching de datos (20%)
      const dataPatternScore = sampleData ? this.calculateDataPatternScore(sampleData, field) : 0;

      // 4. Score por contexto (10%) - reservado para futuras mejoras
      const contextScore = 0;

      // Score compuesto ponderado
      const finalScore = Math.min(
        nameScore * 0.4 + keywordScore * 0.3 + dataPatternScore * 0.2 + contextScore * 0.1,
        1.0
      );

      if (!bestMatch || finalScore > bestMatch.score) {
        bestMatch = { field, score: finalScore };
      }
    }

    // Solo sugerir si hay un match razonable (threshold bajado de 0.5 a 0.4)
    if (bestMatch && bestMatch.score >= 0.4) {
      return new ColumnMapping(csvColumn, bestMatch.field.key, bestMatch.score);
    }

    return null;
  }

  /**
   * Calcula score de similitud de nombres (label + key)
   */
  private static calculateNameSimilarity(
    normalizedCsvColumn: string,
    field: FieldDefinition
  ): number {
    const normalizedFieldLabel = this.normalizeColumnName(field.label);
    const normalizedFieldKey = this.normalizeColumnName(field.key);

    // Calcular similitud con label
    const labelScore = this.calculateSimilarity(normalizedCsvColumn, normalizedFieldLabel);

    // Calcular similitud con key
    const keyScore = this.calculateSimilarity(normalizedCsvColumn, normalizedFieldKey);

    // Retornar la mejor puntuación
    return Math.max(labelScore, keyScore);
  }

  /**
   * Calcula score por keywords del campo (MEJORADO)
   * Usa las keywords definidas en FieldDefinition
   */
  private static calculateKeywordScore(
    normalizedCsvColumn: string,
    field: FieldDefinition
  ): number {
    if (!field.keywords || field.keywords.length === 0) {
      return 0;
    }

    let maxScore = 0;

    for (const keyword of field.keywords) {
      const normalizedKeyword = this.normalizeColumnName(keyword);

      // Match exacto completo
      if (normalizedCsvColumn === normalizedKeyword) {
        return 1.0;
      }

      // Contiene la keyword completa
      if (normalizedCsvColumn.includes(normalizedKeyword)) {
        const score = normalizedKeyword.length / normalizedCsvColumn.length;
        maxScore = Math.max(maxScore, score * 0.9); // 90% si contiene
        continue;
      }

      // La keyword contiene la columna
      if (normalizedKeyword.includes(normalizedCsvColumn)) {
        const score = normalizedCsvColumn.length / normalizedKeyword.length;
        maxScore = Math.max(maxScore, score * 0.85); // 85% si está contenida
        continue;
      }

      // Similitud parcial (usando Levenshtein)
      const similarity = this.calculateSimilarity(normalizedCsvColumn, normalizedKeyword);
      if (similarity > 0.7) {
        maxScore = Math.max(maxScore, similarity * 0.8); // 80% de similitud alta
      }
    }

    return maxScore;
  }

  /**
   * Calcula score basándose en patrones de datos (NUEVO)
   * Analiza una muestra de datos para inferir el tipo de campo
   */
  private static calculateDataPatternScore(sampleData: string[], field: FieldDefinition): number {
    if (!sampleData || sampleData.length === 0) {
      return 0;
    }

    // Filtrar valores vacíos
    const validSamples = sampleData.filter((val) => val && val.trim().length > 0);
    if (validSamples.length === 0) {
      return 0;
    }

    let matchCount = 0;

    for (const sample of validSamples) {
      const trimmedSample = sample.trim();

      switch (field.type) {
        case "email":
          if (this.isEmailPattern(trimmedSample)) {
            matchCount++;
          }
          break;

        case "url":
          if (this.isUrlPattern(trimmedSample)) {
            matchCount++;
          }
          break;

        case "number":
          if (this.isNumberPattern(trimmedSample)) {
            matchCount++;
          }
          break;

        case "boolean":
          if (this.isBooleanPattern(trimmedSample)) {
            matchCount++;
          }
          break;

        case "date":
          if (this.isDatePattern(trimmedSample)) {
            matchCount++;
          }
          break;

        case "string":
          // Para strings, verificar patrones específicos basados en el key
          if (this.isStringPatternMatch(trimmedSample, field.key)) {
            matchCount++;
          }
          break;
      }
    }

    // Retornar porcentaje de coincidencias
    return matchCount / validSamples.length;
  }

  /**
   * Patrones de validación por tipo
   */
  private static isEmailPattern(value: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  }

  private static isUrlPattern(value: string): boolean {
    try {
      new URL(value);
      return true;
    } catch {
      return value.startsWith("http://") || value.startsWith("https://");
    }
  }

  private static isNumberPattern(value: string): boolean {
    // Números decimales con punto o coma
    const numberRegex = /^-?\d+([.,]\d+)?$/;
    return numberRegex.test(value);
  }

  private static isBooleanPattern(value: string): boolean {
    const normalized = value.toLowerCase();
    return ["si", "sí", "no", "yes", "true", "false", "1", "0"].includes(normalized);
  }

  private static isDatePattern(value: string): boolean {
    // Patrones comunes de fecha
    const datePatterns = [
      /^\d{4}-\d{2}-\d{2}/, // ISO: 2024-12-03
      /^\d{2}\/\d{2}\/\d{4}/, // DD/MM/YYYY
      /^\d{2}-\d{2}-\d{4}/, // DD-MM-YYYY
    ];
    return datePatterns.some((pattern) => pattern.test(value));
  }

  private static isStringPatternMatch(value: string, fieldKey: string): boolean {
    // Patrones específicos por campo
    if (fieldKey === "postalCode") {
      return /^\d{5}$/.test(value); // 5 dígitos
    }

    if (fieldKey === "latitude" || fieldKey === "longitude") {
      return this.isNumberPattern(value) && Math.abs(parseFloat(value)) < 180;
    }

    if (fieldKey.includes("phone") || fieldKey.includes("Phone")) {
      return /[\d\s+\-()]{7,}/.test(value); // Teléfonos
    }

    if (
      fieldKey.includes("time") ||
      fieldKey.includes("Time") ||
      fieldKey.includes("Opening") ||
      fieldKey.includes("Closing")
    ) {
      return /^\d{1,2}:\d{2}/.test(value); // HH:MM
    }

    if (fieldKey === "district" || fieldKey === "districtName") {
      // Distritos de Madrid suelen tener formatos específicos
      return /^\d{1,2}\.?\s?[A-Za-zÁ-ú\s]+$/.test(value) || /^[A-Za-zÁ-ú\s]+$/.test(value);
    }

    // Por defecto, aceptar cualquier string no vacío
    return value.length > 0;
  }

  /**
   * Normaliza un nombre de columna para comparación
   */
  private static normalizeColumnName(name: string): string {
    return name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Eliminar acentos
      .replace(/[^a-z0-9]/g, "") // Solo letras y números
      .trim();
  }

  /**
   * Calcula similitud entre dos strings normalizados (0-1)
   * Usa Levenshtein distance normalizado
   */
  private static calculateSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 1.0;
    if (str1.length === 0 || str2.length === 0) return 0.0;

    // Coincidencia exacta de substring (prioritaria)
    if (str1.includes(str2) || str2.includes(str1)) {
      const minLen = Math.min(str1.length, str2.length);
      const maxLen = Math.max(str1.length, str2.length);
      return 0.7 + (minLen / maxLen) * 0.3; // Entre 0.7 y 1.0
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
