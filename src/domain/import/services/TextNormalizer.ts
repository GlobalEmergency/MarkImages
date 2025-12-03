/**
 * Servicio de Dominio: Normalización de textos para comparación
 * Usado para detectar duplicados eliminando variaciones irrelevantes
 */

export class TextNormalizer {
  /**
   * Normaliza un texto para comparación:
   * - Minúsculas
   * - Sin acentos
   * - Sin espacios extra
   * - Sin puntuación
   */
  static normalize(text: string | null | undefined): string {
    if (!text) return "";

    return text
      .toLowerCase()
      .normalize("NFD") // Descomponer caracteres acentuados
      .replace(/[\u0300-\u036f]/g, "") // Eliminar diacríticos
      .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "") // Eliminar puntuación
      .replace(/\s+/g, " ") // Normalizar espacios
      .trim();
  }

  /**
   * Normaliza una dirección completa
   * Combina tipo de vía, nombre y número en un formato estándar
   */
  static normalizeAddress(
    streetType: string | null | undefined,
    streetName: string | null | undefined,
    streetNumber: string | null | undefined
  ): string {
    const parts: string[] = [];

    // Normalizar tipo de vía
    if (streetType) {
      const normalized = this.normalizeStreetType(streetType);
      if (normalized) parts.push(normalized);
    }

    // Normalizar nombre de vía
    if (streetName) {
      parts.push(this.normalize(streetName));
    }

    // Normalizar número
    if (streetNumber) {
      parts.push(this.normalize(streetNumber));
    }

    return parts.join(" ");
  }

  /**
   * Normaliza tipos de vía comunes (Calle -> c, Avenida -> av, etc.)
   */
  private static normalizeStreetType(type: string): string {
    const normalized = this.normalize(type);

    const streetTypeMap: Record<string, string> = {
      calle: "c",
      c: "c",
      cl: "c",
      avenida: "av",
      avda: "av",
      av: "av",
      paseo: "ps",
      ps: "ps",
      plaza: "pl",
      pl: "pl",
      plz: "pl",
      ronda: "rd",
      rd: "rd",
      camino: "cm",
      cm: "cm",
      travesia: "tr",
      tr: "tr",
      carretera: "cr",
      cr: "cr",
      glorieta: "gl",
      gl: "gl",
    };

    return streetTypeMap[normalized] || normalized;
  }

  /**
   * Calcula similitud entre dos textos normalizados (0-1)
   * Usa la distancia de Levenshtein normalizada
   */
  static calculateSimilarity(text1: string, text2: string): number {
    const norm1 = this.normalize(text1);
    const norm2 = this.normalize(text2);

    if (norm1 === norm2) return 1.0;
    if (!norm1 || !norm2) return 0.0;

    const distance = this.levenshteinDistance(norm1, norm2);
    const maxLength = Math.max(norm1.length, norm2.length);

    return 1 - distance / maxLength;
  }

  /**
   * Calcula la distancia de Levenshtein entre dos strings
   * (número de ediciones necesarias para convertir uno en otro)
   */
  private static levenshteinDistance(str1: string, str2: string): number {
    const len1 = str1.length;
    const len2 = str2.length;

    // Crear matriz de distancias
    const matrix: number[][] = [];

    // Inicializar primera fila y columna
    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }

    // Calcular distancias
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;

        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1, // Eliminación
          matrix[i][j - 1] + 1, // Inserción
          matrix[i - 1][j - 1] + cost // Sustitución
        );
      }
    }

    return matrix[len1][len2];
  }

  /**
   * Verifica si dos textos son similares según un umbral
   */
  static areSimilar(text1: string, text2: string, threshold: number = 0.9): boolean {
    return this.calculateSimilarity(text1, text2) >= threshold;
  }

  /**
   * Verifica coincidencia exacta después de normalización
   */
  static areExactMatch(text1: string, text2: string): boolean {
    return this.normalize(text1) === this.normalize(text2);
  }
}
