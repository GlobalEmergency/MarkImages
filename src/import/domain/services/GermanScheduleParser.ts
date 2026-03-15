/**
 * Domain Service: Parser de horarios en formato alemán
 * Implementa IFieldTransformer
 *
 * Soporta formatos de:
 * - Wien (Austria): "Mo-Fr 0630-1900<br>Sa-So nicht erreichbar"
 *                    "Mo-Do 0800-1200#1300-1700<br>Fr 0800-1200"
 * - Basel (Suiza):  "08:00-17:00 (Mo-Fr)"
 *                    "24-365" (24h, 365 días)
 *                    "Wenn Besatzung vor Ort" (condicional)
 *
 * Patrones:
 * - Días: Mo, Di, Mi, Do, Fr, Sa, So (abreviaciones alemanas)
 * - Rangos: Mo-Fr, Mo-So, Sa-So
 * - Tiempos sin separador: 0630-1900 (HHMM-HHMM)
 * - Tiempos con separador: 06:30-19:00 (HH:MM-HH:MM)
 * - Split shifts con #: 0800-1200#1300-1700
 * - HTML <br> como separador de bloques
 * - "nicht erreichbar" = no disponible
 * - "24-365" o "rund um die Uhr" = 24h
 */

import type { IFieldTransformer, TransformerResult } from "../ports/IFieldTransformer";

type DayType = "weekday" | "saturday" | "sunday" | "all";

interface ParsedBlock {
  dayTypes: DayType[];
  opening: string | null;
  closing: string | null;
  unavailable: boolean;
}

/** German day abbreviations → ordered index (0=Mo, 6=So) */
const DAY_INDEX: Record<string, number> = {
  mo: 0,
  di: 1,
  mi: 2,
  do: 3,
  fr: 4,
  sa: 5,
  so: 6,
};

/** Index → day type category */
const INDEX_TO_TYPE: DayType[] = [
  "weekday",
  "weekday",
  "weekday",
  "weekday",
  "weekday",
  "saturday",
  "sunday",
];

/** Full time range: HHMM-HHMM or HH:MM-HH:MM, optionally with # for split shifts */
const TIME_RANGE_RE = /(\d{2}):?(\d{2})\s*-\s*(\d{2}):?(\d{2})/g;

/** Day range pattern: Mo-Fr, Mo-So, Sa-So, etc. */
const DAY_RANGE_RE = /\b(Mo|Di|Mi|Do|Fr|Sa|So)\s*-\s*(Mo|Di|Mi|Do|Fr|Sa|So)\b/gi;

/** Single day pattern: Mo, Di, etc. (when not part of a range) */
const SINGLE_DAY_RE = /\b(Mo|Di|Mi|Do|Fr|Sa|So)\b/gi;

/** 24h patterns */
const PATTERN_24H = /(?:24\s*[-/]\s*365|rund\s+um\s+die\s+uhr|24\s*h|24\s*stunden|durchgehend)/i;

/** Unavailable patterns */
const PATTERN_UNAVAILABLE = /nicht\s+erreichbar|geschlossen|kein\s+zugang|nicht\s+zug[äa]nglich/i;

export class GermanScheduleParser implements IFieldTransformer {
  readonly name = "german-schedule";

  async transform(
    value: string,
    _context?: Record<string, string | null>
  ): Promise<TransformerResult> {
    // Strip HTML tags, replace <br> with newlines for block splitting
    let cleaned = value.replace(/<br\s*\/?>/gi, "\n");
    // Loop to handle nested tags like <scr<script>ipt>
    while (/<[^>]+>/.test(cleaned)) {
      cleaned = cleaned.replace(/<[^>]+>/g, "");
    }
    cleaned = cleaned.trim();

    if (!cleaned) {
      return { fields: {}, confidence: 0, rawValue: value };
    }

    const fields: Record<string, string | null> = {
      scheduleDescription: cleaned.replace(/\n+/g, " | "),
    };

    // Check 24h
    if (PATTERN_24H.test(cleaned)) {
      fields.has24hSurveillance = "true";
      fields.weekdayOpening = "00:00";
      fields.weekdayClosing = "23:59";
      fields.saturdayOpening = "00:00";
      fields.saturdayClosing = "23:59";
      fields.sundayOpening = "00:00";
      fields.sundayClosing = "23:59";
      return { fields, confidence: 1, rawValue: value };
    }

    // Split into blocks by newline, semicolon, or <br> (already converted)
    const blocks = cleaned
      .split(/[\n;]+/)
      .map((b) => b.trim())
      .filter(Boolean);
    const parsedBlocks: ParsedBlock[] = [];

    for (const block of blocks) {
      const parsed = this.parseBlock(block);
      if (parsed) {
        parsedBlocks.push(parsed);
      }
    }

    if (parsedBlocks.length === 0) {
      // Try parsing as time-first format: "08:00-17:00 (Mo-Fr)"
      const timeFirst = this.parseTimeFirstFormat(cleaned);
      if (timeFirst) {
        parsedBlocks.push(timeFirst);
      }
    }

    if (parsedBlocks.length === 0) {
      return { fields, confidence: 0, rawValue: value };
    }

    // Apply parsed blocks to schedule fields
    for (const block of parsedBlocks) {
      if (block.unavailable || !block.opening || !block.closing) continue;

      for (const dayType of block.dayTypes) {
        switch (dayType) {
          case "all":
            fields.weekdayOpening = block.opening;
            fields.weekdayClosing = block.closing;
            fields.saturdayOpening = block.opening;
            fields.saturdayClosing = block.closing;
            fields.sundayOpening = block.opening;
            fields.sundayClosing = block.closing;
            break;
          case "weekday":
            fields.weekdayOpening = block.opening;
            fields.weekdayClosing = block.closing;
            break;
          case "saturday":
            fields.saturdayOpening = block.opening;
            fields.saturdayClosing = block.closing;
            break;
          case "sunday":
            fields.sundayOpening = block.opening;
            fields.sundayClosing = block.closing;
            break;
        }
      }
    }

    const hasTime = parsedBlocks.some((b) => b.opening && !b.unavailable);
    return { fields, confidence: hasTime ? 0.8 : 0.4, rawValue: value };
  }

  /**
   * Parse a single schedule block like "Mo-Fr 0630-1900" or "Sa-So nicht erreichbar"
   */
  private parseBlock(block: string): ParsedBlock | null {
    const unavailable = PATTERN_UNAVAILABLE.test(block);
    const dayTypes = this.extractDayTypes(block);

    if (dayTypes.length === 0) return null;

    if (unavailable) {
      return { dayTypes, opening: null, closing: null, unavailable: true };
    }

    // Extract time ranges (may have split shifts with #)
    const timeRanges = this.extractTimeRanges(block);
    if (timeRanges.length === 0) {
      return null;
    }

    // For split shifts, use first opening and last closing
    const opening = timeRanges[0].opening;
    const closing = timeRanges[timeRanges.length - 1].closing;

    return { dayTypes, opening, closing, unavailable: false };
  }

  /**
   * Parse "08:00-17:00 (Mo-Fr)" format (time first, then days in parens)
   */
  private parseTimeFirstFormat(text: string): ParsedBlock | null {
    const match = text.match(/(\d{2}):?(\d{2})\s*-\s*(\d{2}):?(\d{2})\s*\(([^)]+)\)/);
    if (!match) return null;

    const opening = `${match[1]}:${match[2]}`;
    const closing = `${match[3]}:${match[4]}`;
    const dayPart = match[5];

    const dayTypes = this.extractDayTypes(dayPart);
    if (dayTypes.length === 0) return null;

    return { dayTypes, opening, closing, unavailable: false };
  }

  /**
   * Extract day type categories from text containing German day abbreviations
   */
  private extractDayTypes(text: string): DayType[] {
    const dayTypes = new Set<DayType>();

    // First try day ranges (Mo-Fr, Mo-So, etc.)
    DAY_RANGE_RE.lastIndex = 0;
    let match;
    let foundRange = false;

    while ((match = DAY_RANGE_RE.exec(text)) !== null) {
      foundRange = true;
      const startIdx = DAY_INDEX[match[1].toLowerCase()];
      const endIdx = DAY_INDEX[match[2].toLowerCase()];

      if (startIdx !== undefined && endIdx !== undefined) {
        for (let i = startIdx; i <= endIdx; i++) {
          dayTypes.add(INDEX_TO_TYPE[i]);
        }
      }
    }

    if (foundRange) {
      // Check if "all" applies (has weekday + saturday + sunday)
      if (dayTypes.has("weekday") && dayTypes.has("saturday") && dayTypes.has("sunday")) {
        return ["all"];
      }
      return Array.from(dayTypes);
    }

    // Try single day mentions
    SINGLE_DAY_RE.lastIndex = 0;
    while ((match = SINGLE_DAY_RE.exec(text)) !== null) {
      const idx = DAY_INDEX[match[1].toLowerCase()];
      if (idx !== undefined) {
        dayTypes.add(INDEX_TO_TYPE[idx]);
      }
    }

    if (dayTypes.size > 0) {
      if (dayTypes.has("weekday") && dayTypes.has("saturday") && dayTypes.has("sunday")) {
        return ["all"];
      }
      return Array.from(dayTypes);
    }

    // No day info found — if there's time info, assume weekday
    return [];
  }

  /**
   * Extract time ranges from text, supporting:
   * - "0630-1900" (no colon)
   * - "06:30-19:00" (with colon)
   * - "0800-1200#1300-1700" (split shifts)
   */
  private extractTimeRanges(text: string): Array<{ opening: string; closing: string }> {
    const ranges: Array<{ opening: string; closing: string }> = [];

    TIME_RANGE_RE.lastIndex = 0;
    let match;
    while ((match = TIME_RANGE_RE.exec(text)) !== null) {
      const opening = `${match[1]}:${match[2]}`;
      const closing = `${match[3]}:${match[4]}`;

      if (this.isValidTime(opening) && this.isValidTime(closing)) {
        ranges.push({ opening, closing });
      }
    }

    return ranges;
  }

  private isValidTime(time: string): boolean {
    const [h, m] = time.split(":").map(Number);
    return h >= 0 && h <= 23 && m >= 0 && m <= 59;
  }
}
