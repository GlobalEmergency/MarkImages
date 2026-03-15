/**
 * Domain Service: Parser de direcciones de Wien (Viena)
 * Implementa IFieldTransformer
 *
 * El campo ADRESSE del WFS de Wien tiene un formato consistente:
 *   "BEZIRK., STRASSE NUMMER  <br>STANDORTNAME"
 *
 * Ejemplos reales:
 *   "10., Computerstraße 4  <br>e-shelter Rechenzentrum"
 *   "15., Friesgasse 4  <br>Schulzentrum Friesgasse"
 *   "1., Stephansplatz 3  <br>Domkirche St. Stephan"
 *   "22., Wagramer Straße 17-19  <br>Donau-City Türme"
 *
 * Produce:
 *   - name: parte tras <br> (nombre real de la ubicación)
 *   - streetName: nombre de la calle
 *   - streetNumber: número
 *   - district: código de distrito (ya disponible en BEZIRK, pero como fallback)
 */

import type { IFieldTransformer, TransformerResult } from "../ports/IFieldTransformer";

/**
 * Regex para parsear el formato Wien ADRESSE:
 * - Grupo 1: distrito (número con punto opcional)
 * - Grupo 2: nombre de la calle
 * - Grupo 3: número (puede incluir rangos como "17-19" o sufijos como "4a")
 * - Grupo 4: nombre del sitio (tras <br>)
 */
const WIEN_ADDRESS_RE = /^(\d{1,2})\.,\s*(.+?)\s+(\d+[\w/-]*)\s*(?:<br\s*\/?>)\s*(.+)$/i;

/**
 * Fallback: solo distrito + resto <br> nombre (sin número claro)
 */
const WIEN_SIMPLE_RE = /^(\d{1,2})\.,\s*(.+?)\s*(?:<br\s*\/?>)\s*(.+)$/i;

export class ViennaAddressParser implements IFieldTransformer {
  readonly name = "vienna-address";

  async transform(
    value: string,
    _context?: Record<string, string | null>
  ): Promise<TransformerResult> {
    const input = value.trim();
    const fields: Record<string, string | null> = {};

    if (!input) {
      return { fields, confidence: 0, rawValue: value };
    }

    // Try full pattern: "10., Computerstraße 4  <br>e-shelter Rechenzentrum"
    const fullMatch = input.match(WIEN_ADDRESS_RE);
    if (fullMatch) {
      fields.district = fullMatch[1];
      fields.streetName = fullMatch[2].trim();
      fields.streetNumber = fullMatch[3].trim();
      fields.name = this.cleanHtml(fullMatch[4]).trim();
      return { fields, confidence: 0.9, rawValue: value };
    }

    // Fallback: "10., Stephansplatz  <br>Domkirche St. Stephan" (no clear number)
    const simpleMatch = input.match(WIEN_SIMPLE_RE);
    if (simpleMatch) {
      fields.district = simpleMatch[1];
      // Try to split street + number from the address part
      const addrPart = simpleMatch[2].trim();
      const numMatch = addrPart.match(/^(.+?)\s+(\d+[\w/-]*)$/);
      if (numMatch) {
        fields.streetName = numMatch[1].trim();
        fields.streetNumber = numMatch[2].trim();
      } else {
        fields.streetName = addrPart;
      }
      fields.name = this.cleanHtml(simpleMatch[3]).trim();
      return { fields, confidence: 0.8, rawValue: value };
    }

    // No match — just clean HTML and use as name
    fields.name = this.cleanHtml(input);
    return { fields, confidence: 0.3, rawValue: value };
  }

  private cleanHtml(text: string): string {
    let cleaned = text.replace(/<br\s*\/?>/gi, " — ");
    // Loop to handle nested tags like <scr<script>ipt>
    while (/<[^>]+>/.test(cleaned)) {
      cleaned = cleaned.replace(/<[^>]+>/g, "");
    }
    return cleaned.replace(/\s+/g, " ").trim();
  }
}
