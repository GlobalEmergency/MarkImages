import { describe, it, expect } from "vitest";
import { SpanishScheduleParser } from "@/import/domain/services/SpanishScheduleParser";

describe("SpanishScheduleParser", () => {
  const parser = new SpanishScheduleParser();

  describe("24h patterns", () => {
    it("parses '24 HORAS'", async () => {
      const result = await parser.transform("24 HORAS");
      expect(result.confidence).toBe(1);
      expect(result.fields.has24hSurveillance).toBe("true");
      expect(result.fields.weekdayOpening).toBe("00:00");
      expect(result.fields.weekdayClosing).toBe("23:59");
      expect(result.fields.saturdayOpening).toBe("00:00");
      expect(result.fields.sundayOpening).toBe("00:00");
    });

    it("parses '24 HORAS, 365 DIAS'", async () => {
      const result = await parser.transform("24 HORAS, 365 DIAS");
      expect(result.confidence).toBe(1);
      expect(result.fields.has24hSurveillance).toBe("true");
    });

    it("parses 'PERMANENTE'", async () => {
      const result = await parser.transform("PERMANENTE");
      expect(result.confidence).toBe(1);
      expect(result.fields.has24hSurveillance).toBe("true");
    });

    it("parses 'HORARIO CONTINUO'", async () => {
      const result = await parser.transform("HORARIO CONTINUO");
      expect(result.confidence).toBe(1);
      expect(result.fields.has24hSurveillance).toBe("true");
    });

    it("parses '24 horas / 7 dias a la semana'", async () => {
      const result = await parser.transform("24 horas / 7 dias a la semana");
      expect(result.confidence).toBe(1);
      expect(result.fields.has24hSurveillance).toBe("true");
      expect(result.fields.weekdayOpening).toBe("00:00");
      expect(result.fields.sundayOpening).toBe("00:00");
    });
  });

  describe("24h with exceptions", () => {
    it("parses '24 HORAS EXCEPTO FESTIVOS'", async () => {
      const result = await parser.transform("24 HORAS EXCEPTO FESTIVOS");
      expect(result.confidence).toBe(0.9);
      expect(result.fields.has24hSurveillance).toBe("true");
      expect(result.fields.weekdayOpening).toBe("00:00");
      expect(result.fields.saturdayOpening).toBe("00:00");
      // Sunday/holidays excluded
      expect(result.fields.sundayOpening).toBeUndefined();
    });

    it("parses '24 HORAS EXCEPTO SABADOS, DOMINGOS Y FESTIVOS'", async () => {
      const result = await parser.transform("24 HORAS EXCEPTO SABADOS, DOMINGOS Y FESTIVOS");
      expect(result.confidence).toBe(0.9);
      expect(result.fields.weekdayOpening).toBe("00:00");
      expect(result.fields.saturdayOpening).toBeUndefined();
      expect(result.fields.sundayOpening).toBeUndefined();
    });
  });

  describe("simple time ranges (no day → weekday)", () => {
    it("parses 'DE 07:30 A 15:00'", async () => {
      const result = await parser.transform("DE 07:30 A 15:00");
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.fields.weekdayOpening).toBe("07:30");
      expect(result.fields.weekdayClosing).toBe("15:00");
    });

    it("parses '06:30 - 22:00'", async () => {
      const result = await parser.transform("06:30 - 22:00");
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.fields.weekdayOpening).toBe("06:30");
      expect(result.fields.weekdayClosing).toBe("22:00");
    });

    it("parses '10-21 h'", async () => {
      const result = await parser.transform("10-21 h");
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.fields.weekdayOpening).toBe("10:00");
      expect(result.fields.weekdayClosing).toBe("21:00");
    });
  });

  describe("weekday patterns", () => {
    it("parses 'LUNES A VIERNES (07:30-16:30)'", async () => {
      const result = await parser.transform("LUNES A VIERNES (07:30-16:30)");
      expect(result.fields.weekdayOpening).toBe("07:30");
      expect(result.fields.weekdayClosing).toBe("16:30");
    });

    it("parses 'DE LUNES A VIERNES DE 09:00 A 18:00'", async () => {
      const result = await parser.transform("DE LUNES A VIERNES DE 09:00 A 18:00");
      expect(result.fields.weekdayOpening).toBe("09:00");
      expect(result.fields.weekdayClosing).toBe("18:00");
    });

    it("parses 'L-V 09:00-18:00'", async () => {
      const result = await parser.transform("L-V 09:00-18:00");
      expect(result.fields.weekdayOpening).toBe("09:00");
      expect(result.fields.weekdayClosing).toBe("18:00");
    });
  });

  describe("all-week patterns", () => {
    it("parses 'L-D 08:00-22:00'", async () => {
      const result = await parser.transform("L-D 08:00-22:00");
      expect(result.fields.weekdayOpening).toBe("08:00");
      expect(result.fields.weekdayClosing).toBe("22:00");
      expect(result.fields.saturdayOpening).toBe("08:00");
      expect(result.fields.saturdayClosing).toBe("22:00");
      expect(result.fields.sundayOpening).toBe("08:00");
      expect(result.fields.sundayClosing).toBe("22:00");
    });

    it("parses 'LUNES A DOMINGO DE 10:00 A 21:00'", async () => {
      const result = await parser.transform("LUNES A DOMINGO DE 10:00 A 21:00");
      expect(result.fields.weekdayOpening).toBe("10:00");
      expect(result.fields.saturdayOpening).toBe("10:00");
      expect(result.fields.sundayOpening).toBe("10:00");
    });

    it("parses 'DE LUNES A SABADOS DE 09:15 A 21:15'", async () => {
      const result = await parser.transform("DE LUNES A SABADOS DE 09:15 A 21:15");
      expect(result.fields.weekdayOpening).toBe("09:15");
      expect(result.fields.saturdayOpening).toBe("09:15");
    });
  });

  describe("multi-block compound schedules", () => {
    it("parses weekday + saturday blocks", async () => {
      const result = await parser.transform(
        "DE LUNES A VIERNES DE 16:30 A 20:00. SABADOS DE 10:00 A 14:00"
      );
      expect(result.fields.weekdayOpening).toBe("16:30");
      expect(result.fields.weekdayClosing).toBe("20:00");
      expect(result.fields.saturdayOpening).toBe("10:00");
      expect(result.fields.saturdayClosing).toBe("14:00");
    });

    it("parses complex weekday + weekend", async () => {
      const result = await parser.transform(
        "DE 16:00 A 21:00. SABADOS, DOMINGOS Y FESTIVOS DE 08:15 A 13:30"
      );
      expect(result.fields.weekdayOpening).toBe("16:00");
      expect(result.fields.weekdayClosing).toBe("21:00");
      expect(result.fields.saturdayOpening).toBe("08:15");
      expect(result.fields.saturdayClosing).toBe("13:30");
    });
  });

  describe("split shifts", () => {
    it("parses 'DE 08:30 A 13:30 Y DE 16:30 A 19:30'", async () => {
      const result = await parser.transform("LUNES A VIERNES DE 08:30 A 13:30 Y DE 16:30 A 19:30");
      expect(result.fields.weekdayOpening).toBe("08:30");
      // Should use the closing of the last shift
      expect(result.fields.weekdayClosing).toBe("19:30");
    });
  });

  describe("always preserves raw description", () => {
    it("stores original text in scheduleDescription", async () => {
      const original = "DE 07:30 A 15:00 ";
      const result = await parser.transform(original);
      expect(result.fields.scheduleDescription).toBe("DE 07:30 A 15:00");
    });
  });

  describe("non-parseable / edge cases", () => {
    it("returns confidence 0 for empty string", async () => {
      const result = await parser.transform("");
      expect(result.confidence).toBe(0);
    });

    it("returns confidence 0 for unparseable text", async () => {
      const result = await parser.transform("DEPENDE DE SI ABRE ALGUN VECINO");
      expect(result.confidence).toBe(0);
      expect(result.fields.scheduleDescription).toBe("DEPENDE DE SI ABRE ALGUN VECINO");
    });

    it("handles blocks with CERRADO gracefully", async () => {
      const result = await parser.transform(
        "DE MARTES A DOMINGO DE 10:00 A 22:00. LUNES CERRADO EN INVIERNO"
      );
      // Should parse the first block
      expect(result.fields.weekdayOpening).toBe("10:00");
      expect(result.fields.weekdayClosing).toBe("22:00");
    });
  });
});
