/**
 * Domain Service: Parser de horarios en formato francés (GeoDAE)
 * Implementa IFieldTransformer
 *
 * La base GeoDAE tiene dos campos complementarios:
 * - c_disp_j: días de disponibilidad como Postgres array literal
 *   Ej: "{lundi,mardi,mercredi,jeudi,vendredi,samedi}"
 * - c_disp_h: horario como Postgres array literal
 *   Ej: "{24h/24}", "{heures ouvrables}", "{08h00-18h00}"
 *
 * Este transformer recibe c_disp_j como value y lee c_disp_h
 * del context (mapeado previamente vía fieldMappings).
 *
 * Patrones soportados:
 * - Días: lundi..dimanche en array Postgres
 * - Horas: "24h/24", "heures ouvrables", "HHhMM-HHhMM", "HH:MM-HH:MM"
 * - Combinaciones parciales (solo L-V, solo weekends, etc.)
 */

import type { IFieldTransformer, TransformerResult } from "../ports/IFieldTransformer";

const WEEKDAYS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi"];
const ALL_DAYS = [...WEEKDAYS, "samedi", "dimanche"];

/** Regex para horarios tipo "08h00-18h00" o "08:00-18:00" */
const TIME_RANGE_RE = /(\d{1,2})[h:](\d{2})\s*-\s*(\d{1,2})[h:](\d{2})/;

export class FrenchScheduleParser implements IFieldTransformer {
  readonly name = "french-schedule";

  async transform(
    value: string,
    context?: Record<string, string | null>
  ): Promise<TransformerResult> {
    const fields: Record<string, string | null> = {};

    // Parse days from c_disp_j (Postgres array literal)
    const days = this.parsePostgresArray(value);
    if (days.length === 0) {
      return { fields: { scheduleDescription: value.trim() }, confidence: 0, rawValue: value };
    }

    // Classify which day types are covered
    const hasWeekdays = WEEKDAYS.every((d) => days.includes(d));
    const hasSomeWeekdays = WEEKDAYS.some((d) => days.includes(d));
    const hasSaturday = days.includes("samedi");
    const hasSunday = days.includes("dimanche");
    const hasAllDays = ALL_DAYS.every((d) => days.includes(d));

    // Get hours from context (c_disp_h mapped to accessSchedule or scheduleDescription)
    const hoursRaw = context?.accessSchedule || context?.scheduleDescription || null;
    const hours = hoursRaw ? this.parsePostgresArray(hoursRaw) : [];
    const hoursStr = hours.join(", ");

    // Build human-readable description
    const dayLabels = days.map((d) => d.charAt(0).toUpperCase() + d.slice(1));
    const descParts = [dayLabels.join(", ")];
    if (hoursStr) descParts.push(hoursStr);
    fields.scheduleDescription = descParts.join(" — ");

    // Detect 24h
    const is24h = hours.some((h) => /24\s*h?\s*\/?\s*24/i.test(h) || /24\s*heures/i.test(h));

    if (is24h && hasAllDays) {
      fields.has24hSurveillance = "true";
      fields.weekdayOpening = "00:00";
      fields.weekdayClosing = "23:59";
      fields.saturdayOpening = "00:00";
      fields.saturdayClosing = "23:59";
      fields.sundayOpening = "00:00";
      fields.sundayClosing = "23:59";
      return { fields, confidence: 1, rawValue: value };
    }

    // Parse specific time ranges
    let opening: string | null = null;
    let closing: string | null = null;

    // Check for "heures ouvrables" (business hours → default 08:00-18:00)
    const isBusinessHours = hours.some((h) => /heures?\s+ouvrables?/i.test(h));

    if (isBusinessHours) {
      opening = "08:00";
      closing = "18:00";
    } else {
      // Try to parse explicit time range
      for (const h of hours) {
        const match = h.match(TIME_RANGE_RE);
        if (match) {
          opening = `${match[1].padStart(2, "0")}:${match[2]}`;
          closing = `${match[3].padStart(2, "0")}:${match[4]}`;
          break;
        }
      }
    }

    // If 24h but not all days
    if (is24h) {
      opening = "00:00";
      closing = "23:59";
    }

    // Assign to day categories
    if (opening && closing) {
      if (hasWeekdays || (hasSomeWeekdays && !hasSaturday && !hasSunday)) {
        fields.weekdayOpening = opening;
        fields.weekdayClosing = closing;
      }
      if (hasSaturday) {
        fields.saturdayOpening = opening;
        fields.saturdayClosing = closing;
      }
      if (hasSunday) {
        fields.sundayOpening = opening;
        fields.sundayClosing = closing;
      }

      if (is24h && hasAllDays) {
        fields.has24hSurveillance = "true";
      }
    }

    const confidence = opening && closing ? 0.8 : days.length > 0 ? 0.5 : 0;
    return { fields, confidence, rawValue: value };
  }

  /**
   * Parse Postgres array literal: "{val1,val2,val3}" → ["val1", "val2", "val3"]
   * Also handles quoted values: "{\"val 1\",\"val 2\"}"
   */
  private parsePostgresArray(raw: string): string[] {
    const trimmed = raw.trim();

    // Remove outer braces
    if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) {
      // Might be a plain value (no array syntax)
      return trimmed ? [trimmed] : [];
    }

    const inner = trimmed.slice(1, -1);
    if (!inner) return [];

    // Split by comma, handling quoted values
    const values: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < inner.length; i++) {
      const ch = inner[i];
      if (ch === '"' && (i === 0 || inner[i - 1] !== "\\")) {
        inQuotes = !inQuotes;
        continue;
      }
      if (ch === "," && !inQuotes) {
        values.push(current.trim().toLowerCase());
        current = "";
        continue;
      }
      current += ch;
    }
    if (current.trim()) {
      values.push(current.trim().toLowerCase());
    }

    return values;
  }
}
