/**
 * Implementación: Normalización de texto compatible con PostgreSQL
 * Capa de Infraestructura
 *
 * Replica la lógica de la función normalize_text() de PostgreSQL
 * para mantener consistencia entre JavaScript y la base de datos.
 */

import { ITextNormalizationService } from "@/import/domain/ports/ITextNormalizationService";

export class PostgreSqlTextNormalizer implements ITextNormalizationService {
  /**
   * Normaliza texto usando la misma lógica que PostgreSQL
   * Replica: LOWER(TRIM(immutable_unaccent(text)))
   */
  normalize(text: string | null | undefined): string {
    if (!text) return "";

    return text
      .toLowerCase()
      .trim()
      .normalize("NFD") // Descomponer caracteres acentuados
      .replace(/[\u0300-\u036f]/g, ""); // Eliminar diacríticos
  }

  /**
   * Normaliza una dirección completa
   * Combina tipo de vía, nombre y número en un formato estándar
   */
  normalizeAddress(
    streetType: string | null | undefined,
    streetName: string | null | undefined,
    streetNumber: string | null | undefined
  ): string {
    const parts: string[] = [];

    if (streetType) parts.push(streetType);
    if (streetName) parts.push(streetName);
    if (streetNumber) parts.push(streetNumber);

    const combined = parts.join(" ");
    return this.normalize(combined);
  }
}
