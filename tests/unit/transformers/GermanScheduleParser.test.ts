import { describe, it, expect } from "vitest";
import { GermanScheduleParser } from "@/import/domain/services/GermanScheduleParser";

describe("GermanScheduleParser", () => {
  const parser = new GermanScheduleParser();

  describe("24h patterns", () => {
    it("parses '24-365'", async () => {
      const result = await parser.transform("24-365");
      expect(result.confidence).toBe(1);
      expect(result.fields.has24hSurveillance).toBe("true");
      expect(result.fields.weekdayOpening).toBe("00:00");
      expect(result.fields.weekdayClosing).toBe("23:59");
      expect(result.fields.saturdayOpening).toBe("00:00");
      expect(result.fields.sundayOpening).toBe("00:00");
    });

    it("parses 'rund um die Uhr'", async () => {
      const result = await parser.transform("rund um die Uhr");
      expect(result.confidence).toBe(1);
      expect(result.fields.has24hSurveillance).toBe("true");
    });

    it("parses 'durchgehend'", async () => {
      const result = await parser.transform("durchgehend");
      expect(result.confidence).toBe(1);
      expect(result.fields.has24hSurveillance).toBe("true");
    });
  });

  describe("Wien format (HHMM without colon)", () => {
    it("parses 'Mo-Fr 0630-1900'", async () => {
      const result = await parser.transform("Mo-Fr 0630-1900");
      expect(result.confidence).toBe(0.8);
      expect(result.fields.weekdayOpening).toBe("06:30");
      expect(result.fields.weekdayClosing).toBe("19:00");
      expect(result.fields.saturdayOpening).toBeUndefined();
    });

    it("parses multi-block with <br> separator", async () => {
      const result = await parser.transform("Mo-Fr 0630-1900<br>Sa-So nicht erreichbar");
      expect(result.confidence).toBe(0.8);
      expect(result.fields.weekdayOpening).toBe("06:30");
      expect(result.fields.weekdayClosing).toBe("19:00");
      // Saturday/Sunday explicitly unavailable → no opening/closing set
      expect(result.fields.saturdayOpening).toBeUndefined();
      expect(result.fields.sundayOpening).toBeUndefined();
    });

    it("parses split shifts with #", async () => {
      const result = await parser.transform("Mo-Do 0800-1200#1300-1700<br>Fr 0800-1200");
      expect(result.confidence).toBe(0.8);
      // Mo-Do covers weekdays (Mo, Di, Mi, Do) — opening from first shift, closing from last
      expect(result.fields.weekdayOpening).toBe("08:00");
      expect(result.fields.weekdayClosing).toBe("12:00"); // Fr block overwrites weekday
    });
  });

  describe("Basel format (HH:MM with colon)", () => {
    it("parses '08:00-17:00 (Mo-Fr)'", async () => {
      const result = await parser.transform("08:00-17:00 (Mo-Fr)");
      expect(result.confidence).toBe(0.8);
      expect(result.fields.weekdayOpening).toBe("08:00");
      expect(result.fields.weekdayClosing).toBe("17:00");
    });
  });

  describe("HTML cleanup", () => {
    it("strips <br> tags and converts to readable description", async () => {
      const result = await parser.transform("Mo-Fr 0800-1800<br>Sa 0900-1200");
      expect(result.fields.scheduleDescription).toContain("|");
      expect(result.fields.scheduleDescription).not.toContain("<br>");
    });
  });

  describe("conditional/unavailable", () => {
    it("handles 'nicht erreichbar' as unavailable", async () => {
      const result = await parser.transform("Sa-So nicht erreichbar");
      expect(result.confidence).toBe(0.4);
      // No opening/closing for unavailable blocks
      expect(result.fields.saturdayOpening).toBeUndefined();
      expect(result.fields.sundayOpening).toBeUndefined();
    });

    it("handles non-parseable conditional text", async () => {
      const result = await parser.transform("Wenn Besatzung vor Ort");
      expect(result.fields.scheduleDescription).toBe("Wenn Besatzung vor Ort");
      expect(result.confidence).toBe(0);
    });
  });

  describe("day ranges", () => {
    it("handles Mo-So as all days", async () => {
      const result = await parser.transform("Mo-So 0700-2200");
      expect(result.confidence).toBe(0.8);
      expect(result.fields.weekdayOpening).toBe("07:00");
      expect(result.fields.saturdayOpening).toBe("07:00");
      expect(result.fields.sundayOpening).toBe("07:00");
    });

    it("handles Sa-So range", async () => {
      const result = await parser.transform("Sa-So 1000-1600");
      expect(result.confidence).toBe(0.8);
      expect(result.fields.saturdayOpening).toBe("10:00");
      expect(result.fields.sundayOpening).toBe("10:00");
      expect(result.fields.weekdayOpening).toBeUndefined();
    });
  });
});
