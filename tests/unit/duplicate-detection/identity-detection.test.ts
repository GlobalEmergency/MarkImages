import { describe, it, expect, beforeEach } from "vitest";
import { DuplicateDetectorService } from "@/duplicate-detection/application/DuplicateDetectorService";
import { DuplicateCriteria } from "@/duplicate-detection/domain/value-objects/DuplicateCriteria";
import { ScoringExplanation } from "@/duplicate-detection/domain/value-objects/ScoringExplanation";
import { DuplicateEventBus } from "@/duplicate-detection/domain/events/DuplicateEvents";
import { TextNormalizer } from "@/duplicate-detection/infrastructure/TextNormalizer";
import { createDefaultRegistry } from "@/duplicate-detection/domain/rules";
import type {
  IIdentityMatcher,
  IdentityMatch,
} from "@/duplicate-detection/domain/ports/IIdentityMatcher";
import type {
  IScoringEngine,
  ScoringInput,
} from "@/duplicate-detection/domain/ports/IScoringEngine";
import type { RuleRegistry } from "@/duplicate-detection/domain/rules/RuleRegistry";

// ─── Mock implementations ─────────────────────────────────────

class MockIdentityMatcher implements IIdentityMatcher {
  private matches = new Map<number, IdentityMatch>();

  /** Configure which indices will have identity matches */
  setMatches(matches: Map<number, IdentityMatch>) {
    this.matches = matches;
  }

  async matchBatch(
    _criteriaList: readonly DuplicateCriteria[]
  ): Promise<ReadonlyMap<number, IdentityMatch>> {
    return this.matches;
  }
}

class MockScoringEngine implements IScoringEngine {
  calls: ScoringInput[] = [];

  private results = new Map<number, ScoringExplanation>();

  setResults(results: Map<number, ScoringExplanation>) {
    this.results = results;
  }

  async scoreBatch(
    inputs: readonly ScoringInput[],
    _registry: RuleRegistry
  ): Promise<ReadonlyMap<number, ScoringExplanation>> {
    this.calls = [...inputs];
    return this.results;
  }
}

// ─── Tests ────────────────────────────────────────────────────

describe("Detección por identidad — identity cascade", () => {
  let identityMatcher: MockIdentityMatcher;
  let scoringEngine: MockScoringEngine;
  let service: DuplicateDetectorService;

  beforeEach(() => {
    identityMatcher = new MockIdentityMatcher();
    scoringEngine = new MockScoringEngine();
    service = new DuplicateDetectorService(
      identityMatcher,
      scoringEngine,
      new TextNormalizer(),
      createDefaultRegistry(),
      new DuplicateEventBus()
    );
  });

  describe("Match por ID de AED", () => {
    it("debe detectar duplicado confirmado cuando el ID ya existe", async () => {
      identityMatcher.setMatches(
        new Map([[0, { matchedAedId: "aed-123", matchedBy: "id" as const }]])
      );

      const result = await service.check(DuplicateCriteria.create({ id: "aed-123", name: "Test" }));

      expect(result.isConfirmed).toBe(true);
      expect(result.matchedAedId).toBe("aed-123");
      expect(result.matchedBy).toBe("id");
      expect(result.score).toBe(100);
    });
  });

  describe("Match por código", () => {
    it("debe detectar duplicado confirmado cuando el código coincide", async () => {
      identityMatcher.setMatches(
        new Map([
          [0, { matchedAedId: "aed-456", matchedBy: "code" as const, matchedCode: "DEA-001" }],
        ])
      );

      const result = await service.check(
        DuplicateCriteria.create({ code: "DEA-001", name: "Farmacia" })
      );

      expect(result.isConfirmed).toBe(true);
      expect(result.matchedBy).toBe("code");
    });
  });

  describe("Match por referencia externa", () => {
    it("debe detectar duplicado cuando externalReference coincide", async () => {
      identityMatcher.setMatches(
        new Map([
          [
            0,
            {
              matchedAedId: "aed-789",
              matchedBy: "externalReference" as const,
              matchedExternalReference: "EXT-001",
            },
          ],
        ])
      );

      const result = await service.check(
        DuplicateCriteria.create({ externalReference: "EXT-001", name: "Test" })
      );

      expect(result.isConfirmed).toBe(true);
      expect(result.matchedBy).toBe("externalReference");
    });
  });

  describe("Prioridad de cascade", () => {
    it("identity match tiene prioridad sobre scoring (no ejecuta scoring)", async () => {
      identityMatcher.setMatches(
        new Map([[0, { matchedAedId: "aed-100", matchedBy: "code" as const }]])
      );

      const result = await service.check(
        DuplicateCriteria.create({
          code: "DEA-001",
          name: "Farmacia Central",
          latitude: 40.4168,
          longitude: -3.7038,
        })
      );

      expect(result.isConfirmed).toBe(true);
      expect(result.matchedBy).toBe("code");
      // Scoring engine should NOT have been called for this record
      expect(scoringEngine.calls).toHaveLength(0);
    });
  });

  describe("Sin match de identidad", () => {
    it("debe pasar al scoring engine cuando no hay match de identidad", async () => {
      identityMatcher.setMatches(new Map()); // no matches

      // Set up scoring to return a match
      const explanation = ScoringExplanation.create({
        totalScore: 80,
        maxPossibleScore: 115,
        ruleResults: [],
        interactionResults: [],
        matchedAedId: "aed-scored",
        matchedAedName: "Scored AED",
        searchStrategy: "coordinates",
        distanceMeters: 2.0,
      });
      scoringEngine.setResults(new Map([[0, explanation]]));

      const result = await service.check(
        DuplicateCriteria.create({
          name: "Farmacia Central",
          latitude: 40.4168,
          longitude: -3.7038,
        })
      );

      // Should have been scored (no identity match, has spatial data)
      expect(scoringEngine.calls).toHaveLength(1);
      expect(result.isConfirmed).toBe(true);
      expect(result.matchedBy).toBe("scoring");
    });

    it("no debe ejecutar scoring si el record no tiene datos espaciales ni CP", async () => {
      identityMatcher.setMatches(new Map());

      const result = await service.check(
        DuplicateCriteria.create({
          name: "Farmacia Central",
          // No latitude, longitude, or postalCode
        })
      );

      // No scoring should happen — no spatial data
      expect(scoringEngine.calls).toHaveLength(0);
      expect(result.isDuplicate).toBe(false);
    });

    it("debe ejecutar scoring con postalCode cuando no hay coords", async () => {
      identityMatcher.setMatches(new Map());

      const explanation = ScoringExplanation.create({
        totalScore: 65,
        maxPossibleScore: 115,
        ruleResults: [],
        interactionResults: [],
        matchedAedId: "aed-postal",
        matchedAedName: "Postal Match",
        searchStrategy: "postal_code",
        distanceMeters: undefined,
      });
      scoringEngine.setResults(new Map([[0, explanation]]));

      const result = await service.check(
        DuplicateCriteria.create({
          name: "Farmacia Central",
          postalCode: "28001",
          // No coordinates
        })
      );

      // Should score because has postalCode
      expect(scoringEngine.calls).toHaveLength(1);
      expect(result.isPossible).toBe(true);
    });
  });
});
