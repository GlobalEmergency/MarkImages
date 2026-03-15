/**
 * Domain Service: Separa calle + número de un campo de dirección combinado
 * Implementa IFieldTransformer
 *
 * Patrones europeos comunes:
 *   "Thys-Vanhamstraat 21"         → street: Thys-Vanhamstraat, number: 21
 *   "Kerkeveldstraat 73/89"        → street: Kerkeveldstraat, number: 73/89
 *   "Rue de la Loi 155"            → street: Rue de la Loi, number: 155
 *   "Avenue Louise 235-245"        → street: Avenue Louise, number: 235-245
 *   "Pl. du Grand Sablon 5A"       → street: Pl. du Grand Sablon, number: 5A
 *   "Calle Mayor, 12"              → street: Calle Mayor, number: 12
 *
 * NO separa si no hay número claro (ej: "Place Royale" → solo streetName)
 */

import type { IFieldTransformer, TransformerResult } from "../ports/IFieldTransformer";

/**
 * Match trailing number (with optional letter suffix, range, or bis):
 *   "Straat 21"       → ["Straat", "21"]
 *   "Straat 73/89"    → ["Straat", "73/89"]
 *   "Straat 235-245"  → ["Straat", "235-245"]
 *   "Straat 5A"       → ["Straat", "5A"]
 *   "Straat 12 bis"   → ["Straat", "12 bis"]
 *   "Calle Mayor, 12" → ["Calle Mayor", "12"]
 */
const ADDRESS_NUMBER_RE = /^(.+?)[,\s]+(\d+[\w]*(?:\s*[-/]\s*\d+[\w]*)?)(?:\s+bis)?$/i;

export class AddressNumberSplitter implements IFieldTransformer {
  readonly name = "address-number-split";

  async transform(
    value: string,
    _context?: Record<string, string | null>
  ): Promise<TransformerResult> {
    const input = value.trim();
    const fields: Record<string, string | null> = {};

    if (!input) {
      return { fields, confidence: 0, rawValue: value };
    }

    const match = input.match(ADDRESS_NUMBER_RE);
    if (match) {
      fields.streetName = match[1].trim();
      fields.streetNumber = match[2].trim();
      return { fields, confidence: 0.9, rawValue: value };
    }

    // No number found — keep as streetName only
    fields.streetName = input;
    return { fields, confidence: 0.5, rawValue: value };
  }
}
