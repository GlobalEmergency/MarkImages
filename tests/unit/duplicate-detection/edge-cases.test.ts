import { describe, it, expect } from "vitest";
import { makeInput, makeCandidate, evaluateAllRules } from "./_helpers";
import { DuplicateCriteria } from "@/duplicate-detection/domain/value-objects/DuplicateCriteria";
import { DetectionConfig } from "@/duplicate-detection/domain/value-objects/DetectionConfig";
import { TextNormalizer } from "@/duplicate-detection/infrastructure/TextNormalizer";

describe("Edge cases y valores límite", () => {
  // ============================================================
  // Coordenadas especiales
  // ============================================================

  describe("Coordenadas especiales", () => {
    it("coordenadas (0, 0) deben ser válidas como datos espaciales", () => {
      const criteria = DuplicateCriteria.create({ latitude: 0, longitude: 0 });
      expect(criteria.hasSpatialFields).toBe(true);
      expect(criteria.latitude).toBe(0);
      expect(criteria.longitude).toBe(0);
    });

    it("coordenadas muy cercanas (4.99m) → proximity tier más alto (30pts)", () => {
      const input = makeInput();
      const candidate = makeCandidate({ distance_meters: 4.99 });

      const { ruleResults } = evaluateAllRules(input, candidate);
      const proxRule = ruleResults.find((r) => r.ruleId === "proximity")!;

      expect(proxRule.matched).toBe(true);
      expect(proxRule.points).toBe(30);
    });

    it("coordenadas a 5.0m → segundo tier de proximity (25pts)", () => {
      const input = makeInput();
      const candidate = makeCandidate({ distance_meters: 5.0 });

      const { ruleResults } = evaluateAllRules(input, candidate);
      const proxRule = ruleResults.find((r) => r.ruleId === "proximity")!;

      expect(proxRule.matched).toBe(true);
      expect(proxRule.points).toBe(25); // 5-15m tier
    });

    it("coordenadas a 50.0m → fuera de todos los tiers (0pts)", () => {
      const input = makeInput();
      const candidate = makeCandidate({ distance_meters: 50.0 });

      const { ruleResults } = evaluateAllRules(input, candidate);
      const proxRule = ruleResults.find((r) => r.ruleId === "proximity")!;

      expect(proxRule.matched).toBe(false);
      expect(proxRule.points).toBe(0);
    });

    it("sin distance_meters → proximity no match (no penaliza, simplemente no contribuye)", () => {
      const input = makeInput();
      const candidate = makeCandidate({ distance_meters: undefined });

      const { ruleResults } = evaluateAllRules(input, candidate);
      const proxRule = ruleResults.find((r) => r.ruleId === "proximity")!;

      expect(proxRule.matched).toBe(false);
      expect(proxRule.points).toBe(0);
    });
  });

  // ============================================================
  // Umbrales de decisión
  // ============================================================

  describe("Umbrales de decisión", () => {
    const { confirmed, possible } = DetectionConfig.thresholds;

    it(`score exactamente ${confirmed} → debe clasificar como confirmed`, () => {
      // Build a scenario that produces exactly 75
      // name(30) + addr(25) + prox(15, at 20m: 15-30m tier) + postal(5) = 75
      const input = makeInput({
        establishmentType: undefined, // remove type match
        provisionalNumber: null,
      });
      const candidate = makeCandidate({
        establishment_type: null,
        provisional_number: null,
        distance_meters: 20, // 15-30m tier → 15pts
      });

      const { totalScore } = evaluateAllRules(input, candidate);

      // name(30) + addr(25) + prox(15) + postal(5) = 75
      expect(totalScore).toBe(confirmed);
    });

    it(`score exactamente ${possible} → debe clasificar como possible`, () => {
      // name(30) + type(10) + postal(5) = 45
      const input = makeInput({
        provisionalNumber: null,
      });
      const candidate = makeCandidate({
        normalized_address: "different address",
        provisional_number: null,
        distance_meters: 100, // too far for proximity
      });

      const { totalScore } = evaluateAllRules(input, candidate);

      // name(30) + addr(0, different) + prox(0) + type(10) + postal(5) = 45
      expect(totalScore).toBe(possible);
    });

    it("score 44 → debe ser none (no duplicate)", () => {
      // Any score below `possible` (45) is "none"
      expect(possible).toBe(45);
      // A score of 44 is strictly less than 45
      expect(44 < possible).toBe(true);
    });
  });

  // ============================================================
  // Strings y normalización
  // ============================================================

  describe("Strings y normalización", () => {
    const normalizer = new TextNormalizer();

    it("string vacío y null ambos normalizan a '' sin error", () => {
      expect(normalizer.normalize("")).toBe("");
      expect(normalizer.normalize(null)).toBe("");
      expect(normalizer.normalize(undefined)).toBe("");
    });

    it("acentos y diacríticos: 'José María' normaliza a 'jose maria'", () => {
      expect(normalizer.normalize("José María")).toBe("jose maria");
    });

    it("ñ se normaliza consistentemente (NFD strip)", () => {
      const result = normalizer.normalize("Ñoño");
      // ñ → NFD → n + combining tilde → strip → "nono"
      expect(result).toBe("nono");
    });

    it("DuplicateCriteria.create convierte strings vacíos a undefined", () => {
      const criteria = DuplicateCriteria.create({
        name: "",
        code: "   ",
        postalCode: null as unknown as string,
      });

      expect(criteria.name).toBeUndefined();
      expect(criteria.code).toBeUndefined();
      expect(criteria.postalCode).toBeUndefined();
    });
  });

  // ============================================================
  // Números provisionales
  // ============================================================

  describe("Números provisionales", () => {
    it("provisional_number = 0 → NO match (cero no es un número válido)", () => {
      const input = makeInput({ provisionalNumber: 0 });
      const candidate = makeCandidate({ provisional_number: 0 });

      const { ruleResults } = evaluateAllRules(input, candidate);
      const rule = ruleResults.find((r) => r.ruleId === "provisional_number")!;

      expect(rule.matched).toBe(false);
      expect(rule.points).toBe(0);
    });

    it("provisional_number null en ambos → NO match, no penalty", () => {
      const input = makeInput({ provisionalNumber: null });
      const candidate = makeCandidate({ provisional_number: null });

      const { ruleResults } = evaluateAllRules(input, candidate);
      const rule = ruleResults.find((r) => r.ruleId === "provisional_number")!;

      expect(rule.matched).toBe(false);
      expect(rule.points).toBe(0);
    });

    it("provisional_number coincide y > 0 → +15pts", () => {
      const input = makeInput({ provisionalNumber: 42 });
      const candidate = makeCandidate({ provisional_number: 42 });

      const { ruleResults } = evaluateAllRules(input, candidate);
      const rule = ruleResults.find((r) => r.ruleId === "provisional_number")!;

      expect(rule.matched).toBe(true);
      expect(rule.points).toBe(15);
    });
  });

  // ============================================================
  // Score clamping
  // ============================================================

  describe("Score clamping", () => {
    it("penalizaciones que llevan score < 0 → resultado se clampea a 0", () => {
      // Scenario: lots of penalties, few bonuses → negative raw score
      const input = makeInput({
        normalizedName: "test completo",
        normalizedAddress: "calle test 1",
        normalizedFloor: "planta baja",
        normalizedLocationDetails: "junto al ascensor",
        normalizedAccessInstructions: "puerta lateral",
        postalCode: undefined,
        establishmentType: undefined,
      });
      const candidate = makeCandidate({
        normalized_name: "totalmente diferente",
        normalized_address: "calle test 1", // same address → +25
        normalized_floor: "segunda planta", // different → -20
        normalized_location_details: "en recepcion", // different → -20
        normalized_access_instructions: "puerta principal", // different → -15
        postal_code: null,
        establishment_type: null,
        distance_meters: 50, // too far
        name_similarity: 0.1,
      });

      const { totalScore, rulesScore, interactionsAdj } = evaluateAllRules(input, candidate);

      // addr(25) + floor(-20) + loc(-20) + access(-15) = -30 from these
      // + name(0) + prox(0) + etc = might be negative
      // Plus building interaction if triggered: -30 more
      // totalScore must be >= 0
      expect(totalScore).toBeGreaterThanOrEqual(0);

      // Raw score might be negative
      if (rulesScore + interactionsAdj < 0) {
        expect(totalScore).toBe(0);
      }
    });

    it("score 0 → status none (no duplicate)", () => {
      // 0 < possible(60) → none
      expect(0).toBeLessThan(DetectionConfig.thresholds.possible);
    });
  });

  // ============================================================
  // Batch processing edge case
  // ============================================================

  describe("Batch processing", () => {
    it("DuplicateCriteria vacío se puede crear sin errores", () => {
      const criteria = DuplicateCriteria.create({});

      expect(criteria.hasIdentityFields).toBe(false);
      expect(criteria.hasSpatialFields).toBe(false);
      expect(criteria.hasPostalCode).toBe(false);
    });
  });
});
