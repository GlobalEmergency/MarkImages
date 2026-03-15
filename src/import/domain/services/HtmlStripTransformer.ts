/**
 * Domain Service: Limpia etiquetas HTML de un campo de texto
 * Implementa IFieldTransformer
 *
 * Convierte <br>, <br/>, <br /> en " | " y elimina el resto de tags.
 * Útil para fuentes como Wien donde campos de texto contienen HTML.
 */

import type { IFieldTransformer, TransformerResult } from "../ports/IFieldTransformer";

export class HtmlStripTransformer implements IFieldTransformer {
  readonly name = "html-strip";

  async transform(
    value: string,
    _context?: Record<string, string | null>
  ): Promise<TransformerResult> {
    const input = value.trim();
    const fields: Record<string, string | null> = {};

    if (!input) {
      return { fields, confidence: 0, rawValue: value };
    }

    // Replace <br> variants with " | "
    let cleaned = input.replace(/<br\s*\/?>/gi, " | ");
    // Strip remaining HTML tags (loop to handle nested like <scr<script>ipt>)
    while (/<[^>]+>/.test(cleaned)) {
      cleaned = cleaned.replace(/<[^>]+>/g, "");
    }
    // Normalize whitespace
    cleaned = cleaned.replace(/\s+/g, " ").trim();

    fields.accessDescription = cleaned;
    return { fields, confidence: 1.0, rawValue: value };
  }
}
