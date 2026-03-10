/**
 * TextNormalizer — PostgreSQL-compatible text normalization
 *
 * Replicates the logic of PostgreSQL's normalize_text() function:
 *   LOWER(TRIM(immutable_unaccent(text)))
 *
 * Order matches PostgreSQL: unaccent → trim → lower
 *
 * Moved from: src/import/infrastructure/services/PostgreSqlTextNormalizer.ts
 */

import type { ITextNormalizationService } from "../domain/ports/ITextNormalizationService";

export class TextNormalizer implements ITextNormalizationService {
  /**
   * Normalize text using the same logic as PostgreSQL
   * Replicates: LOWER(TRIM(immutable_unaccent(text)))
   *
   * Order: unaccent first → trim → lower (matches PostgreSQL)
   */
  normalize(text: string | null | undefined): string {
    if (!text) return "";

    return text
      .normalize("NFD") // Decompose accented characters (unaccent)
      .replace(/[\u0300-\u036f]/g, "") // Remove diacritics
      .trim() // TRIM
      .toLowerCase(); // LOWER
  }

  /**
   * Normalize a full address.
   *
   * Mirrors the PostgreSQL generated column exactly:
   *   normalize_text(COALESCE(street_type, '') || ' ' || COALESCE(street_name, '') || ' ' || COALESCE(street_number, ''))
   *
   * Always concatenates all 3 parts with spaces (even if empty),
   * then normalizes — this ensures JS and SQL produce identical results.
   */
  normalizeAddress(
    streetType: string | null | undefined,
    streetName: string | null | undefined,
    streetNumber: string | null | undefined
  ): string {
    // Mirror SQL: COALESCE(field, '') || ' ' || COALESCE(field, '') || ' ' || COALESCE(field, '')
    const combined = (streetType ?? "") + " " + (streetName ?? "") + " " + (streetNumber ?? "");
    return this.normalize(combined);
  }
}
