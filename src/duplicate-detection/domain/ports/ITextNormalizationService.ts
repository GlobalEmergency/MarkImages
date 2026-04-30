/**
 * ITextNormalizationService — Port for text normalization
 *
 * Defines the contract for normalizing text independently of implementation.
 * Allows different strategies (JavaScript, PostgreSQL, etc.)
 *
 * Re-exported from the original import module for backward compatibility.
 */

export interface ITextNormalizationService {
  /**
   * Normalize text for comparison:
   * - Lowercase
   * - No accents
   * - No extra spaces
   * - No punctuation
   */
  normalize(text: string | null | undefined): string;

  /**
   * Normalize a full address
   * Combines street type, name, and number into a standard format
   */
  normalizeAddress(
    streetType: string | null | undefined,
    streetName: string | null | undefined,
    streetNumber: string | null | undefined
  ): string;
}
