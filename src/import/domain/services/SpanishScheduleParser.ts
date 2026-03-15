/**
 * Domain Service: Parser de horarios en texto libre español
 * Implementa IFieldTransformer
 *
 * Patrones soportados (datos reales de CCAA):
 * - "24 HORAS", "PERMANENTE", "HORARIO CONTINUO"
 * - "24 HORAS EXCEPTO FESTIVOS"
 * - "DE 07:30 A 15:00" (sin día → asume weekday)
 * - "LUNES A VIERNES (07:30-16:30)"
 * - "DE LUNES A VIERNES DE 09:00 A 18:00"
 * - "L-V 09:00-18:00", "L-D 08:00-22:00"
 * - "SABADOS DE 10:00 A 14:00"
 * - Bloques separados por "." o ","
 * - Split shifts: "DE 08:30 A 13:30 Y DE 16:30 A 19:30"
 */

import type { IFieldTransformer, TransformerResult } from "../ports/IFieldTransformer";

/** Tiempo en formato HH:MM */
interface TimeRange {
  opening: string;
  closing: string;
}

/** Resultado intermedio del parseo de un bloque */
interface ParsedBlock {
  dayType: "weekday" | "saturday" | "sunday" | "all" | "unknown";
  times: TimeRange[];
  /** True when "saturday" dayType also covers Sunday (e.g. "SABADOS Y DOMINGOS") */
  includesSunday?: boolean;
}

// Regex para extraer tiempos HH:MM
const TIME_PATTERN = /(\d{1,2})[.:h]?(\d{2})?\s*(?:[-aA]\s*|\s+[aA]\s+)(\d{1,2})[.:h]?(\d{2})?/g;

// Patrones 24h
const PATTERN_24H =
  /^(?:24\s*(?:HORAS?|H)|PERMANENTE|SIEMPRE|HORARIO\s+CONTINUO)(?:\s*[,/]\s*(?:365\s*DIAS?|7\s*DIAS?\s*(?:A\s+LA\s+SEMANA)?))?$/i;
// Excepciones 24h
const PATTERN_24H_EXCEPT = /24\s*(?:HORAS?|H)\s*(?:,?\s*)?EXCEPTO\s+(.*)/i;

// Mapeo de rangos de días a tipo
// IMPORTANTE: compound patterns (rangos) van ANTES de single-day patterns
// para que "MARTES A DOMINGO" no matchee como "DOMINGO" suelto
const DAY_RANGES: Array<{ pattern: RegExp; dayType: ParsedBlock["dayType"] }> = [
  // L-D, LUNES A DOMINGO
  { pattern: /(?:^|\b)(?:L\s*-\s*D|LUNES\s+A\s+DOMINGO)(?:\b|$)/i, dayType: "all" },
  // L-S, LUNES A SABADO
  { pattern: /(?:^|\b)(?:L\s*-\s*S|LUNES\s+A\s+SABADOS?)(?:\b|$)/i, dayType: "all" },
  // DE MARTES/MIERCOLES/JUEVES A DOMINGO (misc compound ranges → "all")
  {
    pattern: /(?:^|\b)(?:DE\s+)?(?:MARTES|MIERCOLES|MIÉRCOLES|JUEVES)\s+A\s+DOMINGO(?:\b|$)/i,
    dayType: "all",
  },
  // L-V, LUNES A VIERNES
  {
    pattern: /(?:^|\b)(?:L\s*-\s*V|LUNES\s+A\s+VIERNES)(?:\b|$)/i,
    dayType: "weekday",
  },
  // SABADOS Y DOMINGOS, FINES DE SEMANA
  {
    pattern: /(?:^|\b)(?:SABADOS?\s+Y\s+DOMINGOS?|FINES?\s+DE\s+SEMANA)(?:\b|$)/i,
    dayType: "saturday", // will set both saturday and sunday
  },
  // SABADO(S)
  { pattern: /(?:^|\b)SABADOS?(?:\b|$)/i, dayType: "saturday" },
  // DOMINGO(S)
  { pattern: /(?:^|\b)DOMINGOS?(?:\b|$)/i, dayType: "sunday" },
];

export class SpanishScheduleParser implements IFieldTransformer {
  readonly name = "spanish-schedule";

  async transform(
    value: string,
    _context?: Record<string, string | null>
  ): Promise<TransformerResult> {
    const input = value.trim().toUpperCase();

    if (!input) {
      return { fields: {}, confidence: 0, rawValue: value };
    }

    // Siempre guardar el texto original en scheduleDescription
    const fields: Record<string, string | null> = {
      scheduleDescription: value.trim(),
    };

    // 1. Check 24h puro
    if (PATTERN_24H.test(input)) {
      fields.has24hSurveillance = "true";
      fields.weekdayOpening = "00:00";
      fields.weekdayClosing = "23:59";
      fields.saturdayOpening = "00:00";
      fields.saturdayClosing = "23:59";
      fields.sundayOpening = "00:00";
      fields.sundayClosing = "23:59";
      return { fields, confidence: 1, rawValue: value };
    }

    // 2. Check 24h con excepciones
    const exceptMatch = PATTERN_24H_EXCEPT.exec(input);
    if (exceptMatch) {
      fields.has24hSurveillance = "true";
      fields.weekdayOpening = "00:00";
      fields.weekdayClosing = "23:59";

      const exceptions = exceptMatch[1].toUpperCase();
      const hasSaturdayException =
        /SABADO/i.test(exceptions) || /FINES?\s+DE\s+SEMANA/i.test(exceptions);
      const hasSundayException =
        /DOMINGO/i.test(exceptions) ||
        /FESTIVO/i.test(exceptions) ||
        /FINES?\s+DE\s+SEMANA/i.test(exceptions);

      if (!hasSaturdayException) {
        fields.saturdayOpening = "00:00";
        fields.saturdayClosing = "23:59";
      }
      if (!hasSundayException) {
        fields.sundayOpening = "00:00";
        fields.sundayClosing = "23:59";
      }

      return { fields, confidence: 0.9, rawValue: value };
    }

    // 3. Separar en bloques por "." o "," (pero no dentro de horarios como "16:30")
    const blocks = this.splitIntoBlocks(input);
    const parsedBlocks: ParsedBlock[] = [];

    for (const block of blocks) {
      const parsed = this.parseBlock(block);
      if (parsed) {
        parsedBlocks.push(parsed);
      }
    }

    if (parsedBlocks.length === 0) {
      // No pudimos parsear nada → confidence 0, solo guardar description
      return { fields, confidence: 0, rawValue: value };
    }

    // 4. Mapear bloques parseados a campos
    let confidence = 0.8;
    for (const block of parsedBlocks) {
      if (block.times.length === 0) continue;

      // Para split shifts, concatenar con " y "
      const firstTime = block.times[0];

      switch (block.dayType) {
        case "all":
          fields.weekdayOpening = firstTime.opening;
          fields.weekdayClosing =
            block.times.length > 1
              ? block.times[block.times.length - 1].closing
              : firstTime.closing;
          fields.saturdayOpening = firstTime.opening;
          fields.saturdayClosing = fields.weekdayClosing;
          fields.sundayOpening = firstTime.opening;
          fields.sundayClosing = fields.weekdayClosing;
          break;

        case "weekday":
          fields.weekdayOpening = firstTime.opening;
          fields.weekdayClosing =
            block.times.length > 1
              ? block.times[block.times.length - 1].closing
              : firstTime.closing;
          break;

        case "saturday":
          fields.saturdayOpening = firstTime.opening;
          fields.saturdayClosing =
            block.times.length > 1
              ? block.times[block.times.length - 1].closing
              : firstTime.closing;
          // Only propagate to Sunday when block explicitly covers both days
          if (block.includesSunday) {
            fields.sundayOpening = firstTime.opening;
            fields.sundayClosing = fields.saturdayClosing;
          }
          break;

        case "sunday":
          fields.sundayOpening = firstTime.opening;
          fields.sundayClosing =
            block.times.length > 1
              ? block.times[block.times.length - 1].closing
              : firstTime.closing;
          break;

        case "unknown":
          // No day indicator → assume weekday if weekday not yet set
          if (!fields.weekdayOpening) {
            fields.weekdayOpening = firstTime.opening;
            fields.weekdayClosing =
              block.times.length > 1
                ? block.times[block.times.length - 1].closing
                : firstTime.closing;
          }
          confidence = Math.min(confidence, 0.6);
          break;
      }
    }

    return { fields, confidence, rawValue: value };
  }

  /**
   * Separa el texto en bloques lógicos.
   * Usa "." y "," como separadores, pero ignora "." dentro de horarios como "01.00"
   */
  private splitIntoBlocks(text: string): string[] {
    // Split only by ". " (period + space). Do NOT split on commas because
    // commas appear between day names: "SABADOS, DOMINGOS Y FESTIVOS"
    const blocks = text
      .split(/\.\s+/)
      .map((b) => b.replace(/\.$/, "").trim())
      .filter((b) => b.length > 0);

    return blocks;
  }

  /**
   * Parsea un bloque individual de texto horario
   */
  private parseBlock(block: string): ParsedBlock | null {
    // Skip blocks that are clearly non-parseable
    if (/SEGUN|SEGÚN|DEPENDE|NECESIDAD|PARTIDO|CERRADO(?:\s+EN)/i.test(block)) {
      return null;
    }

    // Detect day type
    let dayType: ParsedBlock["dayType"] = "unknown";
    for (const range of DAY_RANGES) {
      if (range.pattern.test(block)) {
        dayType = range.dayType;
        break;
      }
    }

    // Detect if "saturday" dayType also covers Sunday
    const includesSunday =
      dayType === "saturday" &&
      (/SABADOS?\s+Y\s+DOMINGOS?/i.test(block) || /FINES?\s+DE\s+SEMANA/i.test(block));

    // Extract time ranges
    const times = this.extractTimes(block);

    if (times.length === 0) {
      return null;
    }

    return { dayType, times, includesSunday };
  }

  /**
   * Extrae rangos horarios de un bloque de texto
   */
  private extractTimes(text: string): TimeRange[] {
    const times: TimeRange[] = [];
    // Reset lastIndex
    TIME_PATTERN.lastIndex = 0;

    let match;
    while ((match = TIME_PATTERN.exec(text)) !== null) {
      const openH = match[1].padStart(2, "0");
      const openM = match[2] || "00";
      const closeH = match[3].padStart(2, "0");
      const closeM = match[4] || "00";

      const opening = `${openH}:${openM}`;
      const closing = `${closeH}:${closeM}`;

      // Validate reasonable times
      if (this.isValidTime(opening) && this.isValidTime(closing)) {
        times.push({ opening, closing });
      }
    }

    return times;
  }

  /**
   * Valida que un string HH:MM sea un horario válido
   */
  private isValidTime(time: string): boolean {
    const [h, m] = time.split(":").map(Number);
    return h >= 0 && h <= 23 && m >= 0 && m <= 59;
  }
}
