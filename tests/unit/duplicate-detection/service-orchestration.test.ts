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

class StubIdentityMatcher implements IIdentityMatcher {
  matches = new Map<number, IdentityMatch>();

  async matchBatch(
    _criteriaList: readonly DuplicateCriteria[]
  ): Promise<ReadonlyMap<number, IdentityMatch>> {
    return this.matches;
  }
}

class StubScoringEngine implements IScoringEngine {
  scoredInputs: ScoringInput[] = [];
  results = new Map<number, ScoringExplanation>();

  async scoreBatch(
    inputs: readonly ScoringInput[],
    _registry: RuleRegistry
  ): Promise<ReadonlyMap<number, ScoringExplanation>> {
    this.scoredInputs = [...inputs];
    return this.results;
  }
}

function makeExplanation(totalScore: number, aedId: string): ScoringExplanation {
  return ScoringExplanation.create({
    totalScore,
    maxPossibleScore: 115,
    ruleResults: [],
    interactionResults: [],
    matchedAedId: aedId,
    matchedAedName: `AED ${aedId}`,
    searchStrategy: "coordinates",
    distanceMeters: 1.0,
  });
}

// ─── Tests ────────────────────────────────────────────────────

describe("DuplicateDetectorService — orquestación", () => {
  let identityMatcher: StubIdentityMatcher;
  let scoringEngine: StubScoringEngine;
  let eventBus: DuplicateEventBus;
  let service: DuplicateDetectorService;

  beforeEach(() => {
    identityMatcher = new StubIdentityMatcher();
    scoringEngine = new StubScoringEngine();
    eventBus = new DuplicateEventBus();
    service = new DuplicateDetectorService(
      identityMatcher,
      scoringEngine,
      new TextNormalizer(),
      createDefaultRegistry(),
      eventBus
    );
  });

  // ============================================================
  // Batch mixto — escenario realista
  // ============================================================

  describe("Batch mixto — escenario realista", () => {
    it("batch con mezcla de identity matches, scoring matches, y nuevos", async () => {
      const criteria = [
        DuplicateCriteria.create({ code: "DEA-001", name: "A", latitude: 40.0, longitude: -3.0 }),
        DuplicateCriteria.create({ code: "DEA-002", name: "B", latitude: 41.0, longitude: -2.0 }),
        DuplicateCriteria.create({ name: "C", latitude: 42.0, longitude: -1.0 }), // no identity
        DuplicateCriteria.create({ name: "D", latitude: 43.0, longitude: 0.0 }), // no identity
        DuplicateCriteria.create({ name: "E" }), // no identity, no spatial → none
      ];

      // Identity matches for indices 0 and 1
      identityMatcher.matches = new Map([
        [0, { matchedAedId: "aed-by-code-1", matchedBy: "code" as const }],
        [1, { matchedAedId: "aed-by-code-2", matchedBy: "code" as const }],
      ]);

      // Scoring results for index 2 (confirmed) and 3 (possible)
      scoringEngine.results = new Map([
        [2, makeExplanation(80, "aed-scored-1")], // >= 75 → confirmed
        [3, makeExplanation(65, "aed-scored-2")], // >= 45, < 75 → possible
      ]);

      const results = await service.checkBatch(criteria);

      expect(results).toHaveLength(5);

      // Index 0, 1: identity match
      expect(results[0].isConfirmed).toBe(true);
      expect(results[0].matchedBy).toBe("code");
      expect(results[1].isConfirmed).toBe(true);
      expect(results[1].matchedBy).toBe("code");

      // Index 2: scoring confirmed
      expect(results[2].isConfirmed).toBe(true);
      expect(results[2].matchedBy).toBe("scoring");
      expect(results[2].score).toBe(80);

      // Index 3: scoring possible
      expect(results[3].isPossible).toBe(true);
      expect(results[3].score).toBe(65);

      // Index 4: no data → none
      expect(results[4].isDuplicate).toBe(false);

      // Only indices 2 and 3 should have been sent to scoring
      // (0,1 have identity; 4 has no spatial data)
      expect(scoringEngine.scoredInputs).toHaveLength(2);
      expect(scoringEngine.scoredInputs[0].index).toBe(2);
      expect(scoringEngine.scoredInputs[1].index).toBe(3);
    });

    it("batch vacío retorna array vacío sin ejecutar queries", async () => {
      const results = await service.checkBatch([]);

      expect(results).toHaveLength(0);
      expect(scoringEngine.scoredInputs).toHaveLength(0);
    });
  });

  // ============================================================
  // Emisión de eventos
  // ============================================================

  describe("Emisión de eventos", () => {
    it("duplicado confirmed emite evento tipo 'duplicate.confirmed'", async () => {
      const events: Array<{ type: string }> = [];
      eventBus.subscribe((event) => {
        events.push({ type: event.type });
      });

      identityMatcher.matches = new Map([[0, { matchedAedId: "aed-1", matchedBy: "id" as const }]]);

      await service.check(DuplicateCriteria.create({ id: "aed-1", name: "Test" }));

      // Give event bus time to fire (fire-and-forget via void Promise)
      await new Promise((r) => setTimeout(r, 10));

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe("duplicate.confirmed");
    });

    it("duplicado possible emite evento tipo 'duplicate.possible'", async () => {
      const events: Array<{ type: string }> = [];
      eventBus.subscribe((event) => {
        events.push({ type: event.type });
      });

      identityMatcher.matches = new Map();
      scoringEngine.results = new Map([[0, makeExplanation(65, "aed-possible")]]);

      await service.check(DuplicateCriteria.create({ name: "Test", latitude: 40, longitude: -3 }));

      await new Promise((r) => setTimeout(r, 10));

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe("duplicate.possible");
    });

    it("resultado none NO emite evento", async () => {
      const events: Array<{ type: string }> = [];
      eventBus.subscribe((event) => {
        events.push({ type: event.type });
      });

      identityMatcher.matches = new Map();
      scoringEngine.results = new Map(); // no matches

      await service.check(
        DuplicateCriteria.create({ name: "Unique AED", latitude: 40, longitude: -3 })
      );

      await new Promise((r) => setTimeout(r, 10));

      expect(events).toHaveLength(0);
    });

    it("error en eventBus no afecta al resultado retornado", async () => {
      eventBus.subscribe(() => {
        throw new Error("Event handler crash!");
      });

      identityMatcher.matches = new Map([[0, { matchedAedId: "aed-1", matchedBy: "id" as const }]]);

      // Should NOT throw despite event handler error
      const result = await service.check(DuplicateCriteria.create({ id: "aed-1", name: "Test" }));

      expect(result.isConfirmed).toBe(true);
    });
  });

  // ============================================================
  // Integración con TextNormalizer real
  // ============================================================

  describe("Integración con TextNormalizer real", () => {
    it("criteria con acentos se normaliza correctamente antes del scoring", async () => {
      identityMatcher.matches = new Map();
      scoringEngine.results = new Map();

      await service.check(
        DuplicateCriteria.create({
          name: "Farmacia José María",
          streetType: "Calle",
          streetName: "de la Constitución",
          streetNumber: "23",
          latitude: 40.4,
          longitude: -3.7,
        })
      );

      // Verify scoring received normalized input
      expect(scoringEngine.scoredInputs).toHaveLength(1);
      const normalized = scoringEngine.scoredInputs[0].normalized;

      expect(normalized.normalizedName).toBe("farmacia jose maria");
      expect(normalized.normalizedAddress).toContain("constitucion");
      expect(normalized.normalizedAddress).not.toContain("ó");
    });
  });

  // ============================================================
  // Resiliencia ante errores
  // ============================================================

  describe("Resiliencia ante errores", () => {
    it("scoring engine que no tiene resultados para un record → retorna none", async () => {
      identityMatcher.matches = new Map();
      scoringEngine.results = new Map(); // empty — no scoring matches

      const result = await service.check(
        DuplicateCriteria.create({ name: "Test", latitude: 40, longitude: -3 })
      );

      expect(result.isDuplicate).toBe(false);
    });
  });

  // ============================================================
  // DuplicateEventBus unit tests
  // ============================================================

  describe("DuplicateEventBus", () => {
    it("debe emitir eventos a múltiples suscriptores", async () => {
      const bus = new DuplicateEventBus();
      const calls1: string[] = [];
      const calls2: string[] = [];

      bus.subscribe((e) => {
        calls1.push(e.type);
      });
      bus.subscribe((e) => {
        calls2.push(e.type);
      });

      await bus.emit({
        type: "duplicate.confirmed",
        timestamp: new Date(),
        criteria: DuplicateCriteria.create({ name: "Test" }),
        result: {} as never,
      });

      expect(calls1).toHaveLength(1);
      expect(calls2).toHaveLength(1);
    });

    it("subscribe debe retornar función de unsubscribe", async () => {
      const bus = new DuplicateEventBus();
      const calls: string[] = [];

      const unsubscribe = bus.subscribe((e) => {
        calls.push(e.type);
      });
      unsubscribe();

      await bus.emit({
        type: "duplicate.confirmed",
        timestamp: new Date(),
        criteria: DuplicateCriteria.create({ name: "Test" }),
        result: {} as never,
      });

      expect(calls).toHaveLength(0);
    });

    it("no debe propagar errores de handlers", async () => {
      const bus = new DuplicateEventBus();
      const calls: string[] = [];

      bus.subscribe(() => {
        throw new Error("Handler crash");
      });
      bus.subscribe((e) => {
        calls.push(e.type);
      }); // second handler should still run

      await bus.emit({
        type: "duplicate.confirmed",
        timestamp: new Date(),
        criteria: DuplicateCriteria.create({ name: "Test" }),
        result: {} as never,
      });

      // Second handler should have received the event despite first crashing
      expect(calls).toHaveLength(1);
    });

    it("debe manejar handlers asíncronos", async () => {
      const bus = new DuplicateEventBus();
      const calls: string[] = [];

      bus.subscribe(async (e) => {
        await new Promise((r) => setTimeout(r, 5));
        calls.push(e.type);
      });

      await bus.emit({
        type: "duplicate.possible",
        timestamp: new Date(),
        criteria: DuplicateCriteria.create({ name: "Test" }),
        result: {} as never,
      });

      expect(calls).toHaveLength(1);
    });
  });
});
