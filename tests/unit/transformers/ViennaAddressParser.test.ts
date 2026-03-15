import { describe, it, expect } from "vitest";
import { ViennaAddressParser } from "@/import/domain/services/ViennaAddressParser";

describe("ViennaAddressParser", () => {
  const parser = new ViennaAddressParser();

  describe("full format with street number", () => {
    it("parses '10., Computerstraße 4  <br>e-shelter Rechenzentrum'", async () => {
      const result = await parser.transform("10., Computerstraße 4  <br>e-shelter Rechenzentrum");
      expect(result.confidence).toBe(0.9);
      expect(result.fields.district).toBe("10");
      expect(result.fields.streetName).toBe("Computerstraße");
      expect(result.fields.streetNumber).toBe("4");
      expect(result.fields.name).toBe("e-shelter Rechenzentrum");
    });

    it("parses '15., Friesgasse 4  <br>Schulzentrum Friesgasse'", async () => {
      const result = await parser.transform("15., Friesgasse 4  <br>Schulzentrum Friesgasse");
      expect(result.confidence).toBe(0.9);
      expect(result.fields.district).toBe("15");
      expect(result.fields.streetName).toBe("Friesgasse");
      expect(result.fields.streetNumber).toBe("4");
      expect(result.fields.name).toBe("Schulzentrum Friesgasse");
    });

    it("parses address with number range '22., Wagramer Straße 17-19  <br>Donau-City'", async () => {
      const result = await parser.transform("22., Wagramer Straße 17-19  <br>Donau-City");
      expect(result.confidence).toBe(0.9);
      expect(result.fields.streetName).toBe("Wagramer Straße");
      expect(result.fields.streetNumber).toBe("17-19");
      expect(result.fields.name).toBe("Donau-City");
    });

    it("parses '1., Stephansplatz 3  <br>Domkirche St. Stephan'", async () => {
      const result = await parser.transform("1., Stephansplatz 3  <br>Domkirche St. Stephan");
      expect(result.confidence).toBe(0.9);
      expect(result.fields.district).toBe("1");
      expect(result.fields.streetName).toBe("Stephansplatz");
      expect(result.fields.streetNumber).toBe("3");
      expect(result.fields.name).toBe("Domkirche St. Stephan");
    });
  });

  describe("without street number", () => {
    it("handles address without clear number", async () => {
      const result = await parser.transform("3., Am Stadtpark  <br>Kursalon Wien");
      expect(result.confidence).toBe(0.8);
      expect(result.fields.district).toBe("3");
      expect(result.fields.streetName).toBe("Am Stadtpark");
      expect(result.fields.name).toBe("Kursalon Wien");
    });
  });

  describe("edge cases", () => {
    it("returns low confidence for non-matching input", async () => {
      const result = await parser.transform("Some random address");
      expect(result.confidence).toBe(0.3);
      expect(result.fields.name).toBe("Some random address");
    });

    it("handles empty input", async () => {
      const result = await parser.transform("");
      expect(result.confidence).toBe(0);
    });

    it("cleans nested HTML tags", async () => {
      const result = await parser.transform("5., Musterstraße 10  <br>Test <b>Center</b>");
      expect(result.fields.name).toBe("Test Center");
    });
  });
});
