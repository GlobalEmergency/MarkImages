import { describe, it, expect } from "vitest";
import { DuplicateCriteria } from "@/duplicate-detection/domain/value-objects/DuplicateCriteria";
import { DetectionResult } from "@/duplicate-detection/domain/value-objects/DetectionResult";
import { ScoringExplanation } from "@/duplicate-detection/domain/value-objects/ScoringExplanation";
import { DetectionConfig } from "@/duplicate-detection/domain/value-objects/DetectionConfig";
import { makeRuleResult } from "./_helpers";

// ============================================================
// DuplicateCriteria
// ============================================================

describe("DuplicateCriteria", () => {
  describe("Creación con create()", () => {
    it("debe recortar espacios en blanco y convertir strings vacíos a undefined", () => {
      const criteria = DuplicateCriteria.create({
        name: "  Farmacia Central  ",
        code: "",
        postalCode: "   ",
      });

      expect(criteria.name).toBe("Farmacia Central");
      expect(criteria.code).toBeUndefined();
      expect(criteria.postalCode).toBeUndefined();
    });

    it("debe preservar valores numéricos incluyendo cero", () => {
      const criteria = DuplicateCriteria.create({
        latitude: 0,
        longitude: 0,
        provisionalNumber: 42,
      });

      expect(criteria.latitude).toBe(0);
      expect(criteria.longitude).toBe(0);
      expect(criteria.provisionalNumber).toBe(42);
    });

    it("debe ser inmutable (Object.freeze)", () => {
      const criteria = DuplicateCriteria.create({ name: "Test" });
      expect(() => {
        (criteria as unknown as Record<string, unknown>).name = "Modified";
      }).toThrow();
    });
  });

  describe("hasIdentityFields", () => {
    it("debe retornar true con id, code, o externalReference", () => {
      expect(DuplicateCriteria.create({ id: "abc" }).hasIdentityFields).toBe(true);
      expect(DuplicateCriteria.create({ code: "DEA-001" }).hasIdentityFields).toBe(true);
      expect(DuplicateCriteria.create({ externalReference: "ext-1" }).hasIdentityFields).toBe(true);
    });

    it("debe retornar false sin campos de identidad", () => {
      expect(DuplicateCriteria.create({ name: "Test" }).hasIdentityFields).toBe(false);
      expect(DuplicateCriteria.create({}).hasIdentityFields).toBe(false);
    });
  });

  describe("hasSpatialFields", () => {
    it("debe retornar true solo con lat Y lng definidos", () => {
      expect(DuplicateCriteria.create({ latitude: 40.4, longitude: -3.7 }).hasSpatialFields).toBe(
        true
      );
    });

    it("debe retornar true con coordenadas en cero (0, 0) — punto real", () => {
      expect(DuplicateCriteria.create({ latitude: 0, longitude: 0 }).hasSpatialFields).toBe(true);
    });

    it("debe retornar false con solo una coordenada", () => {
      expect(DuplicateCriteria.create({ latitude: 40.4 }).hasSpatialFields).toBe(false);
      expect(DuplicateCriteria.create({ longitude: -3.7 }).hasSpatialFields).toBe(false);
    });
  });
});

// ============================================================
// DetectionResult
// ============================================================

describe("DetectionResult", () => {
  describe("Factory methods", () => {
    it("confirmedByIdentity: status=confirmed, score=100, matchedBy=tipo de identidad", () => {
      const result = DetectionResult.confirmedByIdentity("aed-1", "code");

      expect(result.status).toBe("confirmed");
      expect(result.score).toBe(100);
      expect(result.matchedAedId).toBe("aed-1");
      expect(result.matchedBy).toBe("code");
      expect(result.explanation).toBeUndefined();
    });

    it("confirmedByScoring: status=confirmed, matchedBy=scoring, explanation adjunta", () => {
      const explanation = ScoringExplanation.create({
        totalScore: 85,
        maxPossibleScore: 115,
        ruleResults: [],
        interactionResults: [],
        matchedAedId: "aed-2",
        matchedAedName: "Test AED",
        searchStrategy: "coordinates",
        distanceMeters: 1.5,
      });
      const result = DetectionResult.confirmedByScoring("aed-2", explanation);

      expect(result.status).toBe("confirmed");
      expect(result.score).toBe(85);
      expect(result.matchedBy).toBe("scoring");
      expect(result.explanation).toBe(explanation);
    });

    it("possible: status=possible, isDuplicate=true", () => {
      const explanation = ScoringExplanation.create({
        totalScore: 65,
        maxPossibleScore: 115,
        ruleResults: [],
        interactionResults: [],
        matchedAedId: "aed-3",
        matchedAedName: undefined,
        searchStrategy: "coordinates",
        distanceMeters: 3.2,
      });
      const result = DetectionResult.possible("aed-3", explanation);

      expect(result.status).toBe("possible");
      expect(result.isDuplicate).toBe(true);
      expect(result.isPossible).toBe(true);
      expect(result.isConfirmed).toBe(false);
    });

    it("none: isDuplicate=false, matchedAedId=undefined", () => {
      const result = DetectionResult.none();

      expect(result.isDuplicate).toBe(false);
      expect(result.matchedAedId).toBeUndefined();
      expect(result.matchedBy).toBeUndefined();
      expect(result.score).toBe(0);
    });
  });

  describe("Serialización", () => {
    it("toJSON() debe incluir todos los campos necesarios para API response", () => {
      const result = DetectionResult.confirmedByIdentity("aed-1", "id");
      const json = result.toJSON();

      expect(json).toHaveProperty("status", "confirmed");
      expect(json).toHaveProperty("score", 100);
      expect(json).toHaveProperty("matchedAedId", "aed-1");
      expect(json).toHaveProperty("matchedBy", "id");
    });

    it("toLogString() debe generar un resumen legible", () => {
      const none = DetectionResult.none();
      expect(none.toLogString()).toContain("No duplicate");

      const confirmed = DetectionResult.confirmedByIdentity("aed-1", "code");
      expect(confirmed.toLogString()).toContain("CONFIRMED");
      expect(confirmed.toLogString()).toContain("aed-1");
    });
  });

  describe("Inmutabilidad", () => {
    it("debe ser inmutable (Object.freeze)", () => {
      const result = DetectionResult.none();
      expect(() => {
        (result as unknown as Record<string, unknown>).status = "confirmed";
      }).toThrow();
    });
  });
});

// ============================================================
// ScoringExplanation
// ============================================================

describe("ScoringExplanation", () => {
  const ruleA = makeRuleResult({ ruleId: "r1", points: 30, maxPoints: 30, matched: true });
  const ruleB = makeRuleResult({ ruleId: "r2", points: 0, maxPoints: 25, matched: false });
  const ruleC = makeRuleResult({ ruleId: "r3", points: -20, maxPoints: -20, matched: true });

  const interactionApplied = {
    interactionId: "i1",
    interactionName: "Test Interaction",
    applied: true,
    adjustment: -15,
    reason: "test reason",
    triggeringRules: ["r1", "r3"],
  };
  const interactionNotApplied = {
    interactionId: "i2",
    interactionName: "Other",
    applied: false,
    adjustment: 0,
    reason: "not applied",
    triggeringRules: [],
  };

  it("debe calcular rulesScore como suma de ruleResults.points", () => {
    const exp = ScoringExplanation.create({
      totalScore: 10,
      maxPossibleScore: 115,
      ruleResults: [ruleA, ruleB, ruleC],
      interactionResults: [],
      matchedAedId: "a1",
      matchedAedName: "Test",
      searchStrategy: "coordinates",
      distanceMeters: 2.0,
    });

    // 30 + 0 + (-20) = 10
    expect(exp.rulesScore).toBe(10);
  });

  it("contributingRules debe filtrar solo matched=true", () => {
    const exp = ScoringExplanation.create({
      totalScore: 10,
      maxPossibleScore: 115,
      ruleResults: [ruleA, ruleB, ruleC],
      interactionResults: [],
      matchedAedId: "a1",
      matchedAedName: undefined,
      searchStrategy: "coordinates",
      distanceMeters: undefined,
    });

    expect(exp.contributingRules).toHaveLength(2);
    expect(exp.nonContributingRules).toHaveLength(1);
  });

  it("appliedPenalties debe filtrar points < 0", () => {
    const exp = ScoringExplanation.create({
      totalScore: 10,
      maxPossibleScore: 115,
      ruleResults: [ruleA, ruleB, ruleC],
      interactionResults: [],
      matchedAedId: "a1",
      matchedAedName: undefined,
      searchStrategy: "coordinates",
      distanceMeters: undefined,
    });

    expect(exp.appliedPenalties).toHaveLength(1);
    expect(exp.appliedPenalties[0].ruleId).toBe("r3");
  });

  it("appliedInteractions debe filtrar applied=true", () => {
    const exp = ScoringExplanation.create({
      totalScore: 10,
      maxPossibleScore: 115,
      ruleResults: [],
      interactionResults: [interactionApplied, interactionNotApplied],
      matchedAedId: "a1",
      matchedAedName: undefined,
      searchStrategy: "coordinates",
      distanceMeters: undefined,
    });

    expect(exp.appliedInteractions).toHaveLength(1);
    expect(exp.appliedInteractions[0].interactionId).toBe("i1");
    expect(exp.interactionsAdjustment).toBe(-15);
  });

  it("toSummary() debe generar texto legible con breakdown de reglas", () => {
    const exp = ScoringExplanation.create({
      totalScore: 85,
      maxPossibleScore: 115,
      ruleResults: [ruleA],
      interactionResults: [interactionApplied],
      matchedAedId: "a1",
      matchedAedName: "Test AED",
      searchStrategy: "coordinates",
      distanceMeters: 1.5,
    });

    const summary = exp.toSummary();
    expect(summary).toContain("Score: 85/115");
    expect(summary).toContain("Test AED");
    expect(summary).toContain("Rules");
    expect(summary).toContain("Interactions");
  });

  it("toJSON() debe ser serializable (para internal_notes)", () => {
    const exp = ScoringExplanation.create({
      totalScore: 75,
      maxPossibleScore: 115,
      ruleResults: [ruleA],
      interactionResults: [],
      matchedAedId: "a1",
      matchedAedName: "Test",
      searchStrategy: "coordinates",
      distanceMeters: 2.0,
    });

    const json = exp.toJSON();
    const serialized = JSON.stringify(json);
    const parsed = JSON.parse(serialized);

    expect(parsed.totalScore).toBe(75);
    expect(parsed.maxPossibleScore).toBe(115);
    expect(parsed.rules).toHaveLength(1);
  });
});

// ============================================================
// DetectionConfig
// ============================================================

describe("DetectionConfig", () => {
  it("debe tener threshold confirmed > possible", () => {
    expect(DetectionConfig.thresholds.confirmed).toBeGreaterThan(
      DetectionConfig.thresholds.possible
    );
  });

  it("debe tener confirmed=75 y possible=45", () => {
    expect(DetectionConfig.thresholds.confirmed).toBe(75);
    expect(DetectionConfig.thresholds.possible).toBe(45);
  });

  it("debe excluir status REJECTED e INACTIVE de la detección", () => {
    expect(DetectionConfig.filters.excludeStatuses).toContain("REJECTED");
    expect(DetectionConfig.filters.excludeStatuses).toContain("INACTIVE");
  });
});
