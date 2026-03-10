import { describe, it, expect } from "vitest";
import { TextNormalizer } from "@/duplicate-detection/infrastructure/TextNormalizer";

const normalizer = new TextNormalizer();

describe("TextNormalizer — normalización para comparación de DEAs", () => {
  describe("normalize() — texto general", () => {
    it("'Farmacia José María' → 'farmacia jose maria'", () => {
      expect(normalizer.normalize("Farmacia José María")).toBe("farmacia jose maria");
    });

    it("'CENTRO DE SALUD' → 'centro de salud'", () => {
      expect(normalizer.normalize("CENTRO DE SALUD")).toBe("centro de salud");
    });

    it("'  espacios  extras  ' → resultado sin espacios al inicio/final", () => {
      const result = normalizer.normalize("  espacios  extras  ");
      expect(result).not.toMatch(/^\s/);
      expect(result).not.toMatch(/\s$/);
    });

    it("null → ''", () => {
      expect(normalizer.normalize(null)).toBe("");
    });

    it("undefined → ''", () => {
      expect(normalizer.normalize(undefined)).toBe("");
    });

    it("'' → ''", () => {
      expect(normalizer.normalize("")).toBe("");
    });

    it("debe eliminar diacríticos de caracteres especiales", () => {
      // ñ se descompone en n + combining tilde → se elimina la tilde
      const result = normalizer.normalize("café Ñoño über");
      expect(result).toContain("cafe");
      expect(result).toContain("uber");
      // ñ → NFD → n + combining tilde → strip diacritics → n
      expect(result).not.toContain("é");
      expect(result).not.toContain("ü");
    });
  });

  describe("normalizeAddress() — dirección combinada", () => {
    it("('Calle', 'Mayor', '5') → 'calle mayor 5'", () => {
      expect(normalizer.normalizeAddress("Calle", "Mayor", "5")).toBe("calle mayor 5");
    });

    it("(null, 'Gran Vía', '10') → resultado que contiene 'gran via 10'", () => {
      const result = normalizer.normalizeAddress(null, "Gran Vía", "10");
      expect(result).toContain("gran via");
      expect(result).toContain("10");
    });

    it("(null, null, null) → ''", () => {
      expect(normalizer.normalizeAddress(null, null, null)).toBe("");
    });

    it("('Avda', 'de la Constitución', '23') → sin acentos", () => {
      const result = normalizer.normalizeAddress("Avda", "de la Constitución", "23");
      expect(result).toContain("avda");
      expect(result).toContain("constitucion");
      expect(result).not.toContain("ó");
    });

    it("debe producir resultado consistente independiente de mayúsculas en tipo de calle", () => {
      const a = normalizer.normalizeAddress("CALLE", "Mayor", "5");
      const b = normalizer.normalizeAddress("calle", "mayor", "5");
      expect(a).toBe(b);
    });
  });
});
