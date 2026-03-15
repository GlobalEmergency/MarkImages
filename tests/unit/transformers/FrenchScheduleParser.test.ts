import { describe, it, expect } from "vitest";
import { FrenchScheduleParser } from "@/import/domain/services/FrenchScheduleParser";

describe("FrenchScheduleParser", () => {
  const parser = new FrenchScheduleParser();

  describe("24h/24 all week", () => {
    it("parses 24h/24 with all 7 days", async () => {
      const result = await parser.transform(
        "{lundi,mardi,mercredi,jeudi,vendredi,samedi,dimanche}",
        { accessSchedule: "{24h/24}" }
      );
      expect(result.confidence).toBe(1);
      expect(result.fields.has24hSurveillance).toBe("true");
      expect(result.fields.weekdayOpening).toBe("00:00");
      expect(result.fields.weekdayClosing).toBe("23:59");
      expect(result.fields.saturdayOpening).toBe("00:00");
      expect(result.fields.saturdayClosing).toBe("23:59");
      expect(result.fields.sundayOpening).toBe("00:00");
      expect(result.fields.sundayClosing).toBe("23:59");
    });
  });

  describe("heures ouvrables (business hours)", () => {
    it("parses weekdays with heures ouvrables", async () => {
      const result = await parser.transform("{lundi,mardi,mercredi,jeudi,vendredi}", {
        accessSchedule: "{heures ouvrables}",
      });
      expect(result.confidence).toBe(0.8);
      expect(result.fields.weekdayOpening).toBe("08:00");
      expect(result.fields.weekdayClosing).toBe("18:00");
      expect(result.fields.saturdayOpening).toBeUndefined();
      expect(result.fields.sundayOpening).toBeUndefined();
    });

    it("parses 6 days with heures ouvrables", async () => {
      const result = await parser.transform("{lundi,mardi,mercredi,jeudi,vendredi,samedi}", {
        accessSchedule: '{"heures ouvrables"}',
      });
      expect(result.confidence).toBe(0.8);
      expect(result.fields.weekdayOpening).toBe("08:00");
      expect(result.fields.saturdayOpening).toBe("08:00");
      expect(result.fields.sundayOpening).toBeUndefined();
    });
  });

  describe("explicit time ranges", () => {
    it("parses explicit hours like 08h00-18h00", async () => {
      const result = await parser.transform("{lundi,mardi,mercredi,jeudi,vendredi}", {
        accessSchedule: "{08h00-18h00}",
      });
      expect(result.confidence).toBe(0.8);
      expect(result.fields.weekdayOpening).toBe("08:00");
      expect(result.fields.weekdayClosing).toBe("18:00");
    });

    it("parses HH:MM-HH:MM format", async () => {
      const result = await parser.transform(
        "{lundi,mardi,mercredi,jeudi,vendredi,samedi,dimanche}",
        { accessSchedule: "{06:00-22:00}" }
      );
      expect(result.confidence).toBe(0.8);
      expect(result.fields.weekdayOpening).toBe("06:00");
      expect(result.fields.weekdayClosing).toBe("22:00");
      expect(result.fields.saturdayOpening).toBe("06:00");
      expect(result.fields.sundayOpening).toBe("06:00");
    });
  });

  describe("Postgres array parsing", () => {
    it("handles quoted values in Postgres arrays", async () => {
      const result = await parser.transform("{lundi,mardi,mercredi,jeudi,vendredi}", {
        accessSchedule: '{"heures ouvrables"}',
      });
      expect(result.confidence).toBe(0.8);
      expect(result.fields.weekdayOpening).toBe("08:00");
    });

    it("handles empty Postgres array", async () => {
      const result = await parser.transform("{}", {});
      expect(result.confidence).toBe(0);
    });

    it("handles plain text (no array syntax)", async () => {
      const result = await parser.transform("lundi", {});
      expect(result.fields.scheduleDescription).toContain("Lundi");
    });
  });

  describe("schedule description", () => {
    it("generates human-readable description with days and hours", async () => {
      const result = await parser.transform("{lundi,mardi,mercredi,jeudi,vendredi}", {
        accessSchedule: "{24h/24}",
      });
      expect(result.fields.scheduleDescription).toContain("Lundi");
      expect(result.fields.scheduleDescription).toContain("24h/24");
    });
  });

  describe("partial weeks", () => {
    it("parses weekend only (samedi, dimanche)", async () => {
      const result = await parser.transform("{samedi,dimanche}", {
        accessSchedule: "{09h00-17h00}",
      });
      expect(result.confidence).toBe(0.8);
      expect(result.fields.weekdayOpening).toBeUndefined();
      expect(result.fields.saturdayOpening).toBe("09:00");
      expect(result.fields.sundayOpening).toBe("09:00");
    });
  });
});
