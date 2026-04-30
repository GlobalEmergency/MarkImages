/**
 * Domain Service: Separa nombre + descripciÃ³n de acceso por ":"
 * Implementa IFieldTransformer
 *
 * PatrÃ³n comÃºn en fuentes donde un solo campo combina el nombre del sitio
 * con la ubicaciÃ³n especÃ­fica del DEA, separados por ":"
 *
 * Ejemplos reales (Santa Cruz de Tenerife):
 *   "EL CORTE INGLÃ‰S TENERIFE: Reserva"
 *     â†’ name: EL CORTE INGLÃ‰S TENERIFE, specificLocation: Reserva
 *   "C.C. MERIDIANO: Planta galerÃ­a, junto a plaza de Cortefiel"
 *     â†’ name: C.C. MERIDIANO, specificLocation: Planta galerÃ­a, junto a plaza de Cortefiel
 *   "BANCO DE ESPAÃ‘A: Entrada instalaciones"
 *     â†’ name: BANCO DE ESPAÃ‘A, specificLocation: Entrada instalaciones
 *
 * Si no hay ":", devuelve solo name con confianza baja.
 */

import type { IFieldTransformer, TransformerResult } from "../ports/IFieldTransformer";

export class ColonNameSplitter implements IFieldTransformer {
  readonly name = "colon-name-split";

  async transform(
    value: string,
    _context?: Record<string, string | null>
  ): Promise<TransformerResult> {
    const input = value.trim();
    const fields: Record<string, string | null> = {};

    if (!input) {
      return { fields, confidence: 0, rawValue: value };
    }

    // Split on first ":"
    const colonIdx = input.indexOf(":");
    if (colonIdx > 0) {
      const namePart = input.substring(0, colonIdx).trim();
      const locationPart = input.substring(colonIdx + 1).trim();

      if (namePart && locationPart) {
        fields.name = namePart;
        fields.specificLocation = locationPart;
        return { fields, confidence: 0.9, rawValue: value };
      }
    }

    // No colon or empty parts â€” keep as name
    fields.name = input;
    return { fields, confidence: 0.5, rawValue: value };
  }
}
