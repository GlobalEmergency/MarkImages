import { describe, it, expect } from "vitest";
import { createDefaultRegistry } from "@/duplicate-detection/domain/rules";
import { makeInput, makeCandidate } from "./_helpers";
import type {
  ScoringRule,
  NormalizedInput,
  CandidateRecord,
  SqlFragment,
  RuleExplanation,
} from "@/duplicate-detection/domain/rules/ScoringRule";

/** Fake rule for testing registry operations */
class FakeRule implements ScoringRule {
  readonly category = "attribute" as const;

  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly maxPoints: number,
    public readonly description: string = "Fake rule for testing"
  ) {}

  toSqlCase(_input: NormalizedInput, paramIndex: number): SqlFragment {
    return { sql: `${this.maxPoints}`, params: [], nextParamIndex: paramIndex };
  }

  evaluate(_input: NormalizedInput, _candidate: CandidateRecord): number {
    return this.maxPoints;
  }

  explain(_input: NormalizedInput, _candidate: CandidateRecord): RuleExplanation {
    return {
      ruleId: this.id,
      ruleName: this.name,
      points: this.maxPoints,
      maxPoints: this.maxPoints,
      matched: true,
      reason: `Fake rule always matches → +${this.maxPoints}pts`,
    };
  }
}

describe("Rules Engine — extensibilidad", () => {
  // ============================================================
  // Registry default
  // ============================================================

  describe("Registry default", () => {
    it("createDefaultRegistry() contiene 9 reglas y 2 interacciones", () => {
      const registry = createDefaultRegistry();

      expect(registry.getAll()).toHaveLength(9);
      expect(registry.getAllInteractions()).toHaveLength(2);
    });

    it("maxPossibleScore es 115 (30+25+30+15+10+5)", () => {
      const registry = createDefaultRegistry();
      expect(registry.getMaxPossibleScore()).toBe(115);
    });

    it("las 9 reglas tienen ids únicos", () => {
      const registry = createDefaultRegistry();
      const ids = registry.getAll().map((r) => r.id);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(9);
    });

    it("debe incluir reglas de las 4 categorías", () => {
      const registry = createDefaultRegistry();

      expect(registry.getByCategory("attribute").length).toBeGreaterThan(0);
      expect(registry.getByCategory("spatial").length).toBeGreaterThan(0);
      expect(registry.getByCategory("penalty").length).toBeGreaterThan(0);
    });
  });

  // ============================================================
  // Añadir regla custom
  // ============================================================

  describe("Añadir regla custom", () => {
    it("registrar nueva regla incrementa el scoring máximo", () => {
      const registry = createDefaultRegistry();
      const before = registry.getMaxPossibleScore();

      registry.register(new FakeRule("phone_match", "Phone Match", 20));

      expect(registry.getMaxPossibleScore()).toBe(before + 20);
      expect(registry.getAll()).toHaveLength(10);
    });

    it("la nueva regla se evalúa junto con las built-in", () => {
      const registry = createDefaultRegistry();
      const customRule = new FakeRule("custom_bonus", "Custom Bonus", 10);
      registry.register(customRule);

      const allRules = registry.getAll();
      const customFound = allRules.find((r) => r.id === "custom_bonus");

      expect(customFound).toBeDefined();

      // Evaluate with the custom rule included
      const input = makeInput();
      const candidate = makeCandidate();
      const result = customFound!.evaluate(input, candidate);
      expect(result).toBe(10);
    });

    it("lanzar error si se registra regla con id duplicado", () => {
      const registry = createDefaultRegistry();

      expect(() => {
        registry.register(new FakeRule("name_similarity", "Duplicate!", 50));
      }).toThrow(/already registered/);
    });
  });

  // ============================================================
  // Reemplazar regla existente
  // ============================================================

  describe("Reemplazar regla existente", () => {
    it("replace() cambia la regla manteniendo el mismo id", () => {
      const registry = createDefaultRegistry();

      // Replace name_similarity with a more aggressive version
      const aggressive = new FakeRule("name_similarity", "Name Similarity (Aggressive)", 50);
      registry.replace(aggressive);

      const nameRule = registry.getAll().find((r) => r.id === "name_similarity")!;
      expect(nameRule.maxPoints).toBe(50);
      expect(nameRule.name).toBe("Name Similarity (Aggressive)");
    });

    it("scoring con regla reemplazada usa los nuevos puntos", () => {
      const registry = createDefaultRegistry();
      const before = registry.getMaxPossibleScore();

      // Replace 30pt rule with 50pt version → delta of +20
      registry.replace(new FakeRule("name_similarity", "Name Aggressive", 50));

      expect(registry.getMaxPossibleScore()).toBe(before + 20);
    });

    it("replace() lanza error para regla inexistente", () => {
      const registry = createDefaultRegistry();

      expect(() => {
        registry.replace(new FakeRule("nonexistent", "Ghost", 10));
      }).toThrow(/not found/);
    });
  });

  // ============================================================
  // Eliminar regla
  // ============================================================

  describe("Eliminar regla", () => {
    it("unregister() reduce el scoring máximo", () => {
      const registry = createDefaultRegistry();
      const before = registry.getMaxPossibleScore();

      registry.unregister("postal_code"); // removes +5

      expect(registry.getMaxPossibleScore()).toBe(before - 5);
      expect(registry.getAll()).toHaveLength(8);
    });

    it("scoring sin la regla eliminada no la incluye en evaluación", () => {
      const registry = createDefaultRegistry();
      registry.unregister("name_similarity");

      const remaining = registry.getAll();
      expect(remaining.find((r) => r.id === "name_similarity")).toBeUndefined();
    });
  });

  // ============================================================
  // Clone para variantes por flujo
  // ============================================================

  describe("Clone para variantes por flujo", () => {
    it("clone() produce registry independiente", () => {
      const original = createDefaultRegistry();
      const clone = original.clone();

      expect(clone.getAll()).toHaveLength(original.getAll().length);
      expect(clone.getAllInteractions()).toHaveLength(original.getAllInteractions().length);
    });

    it("modificar el clon no afecta al original", () => {
      const original = createDefaultRegistry();
      const clone = original.clone();

      clone.unregister("postal_code");

      expect(original.getAll()).toHaveLength(9);
      expect(clone.getAll()).toHaveLength(8);
    });

    it("cada flujo puede tener reglas diferentes (API vs import vs sync)", () => {
      const original = createDefaultRegistry();

      // API flow: stricter (higher similarity threshold)
      const apiRegistry = original.clone();
      apiRegistry.replace(new FakeRule("name_similarity", "Strict Name", 40));

      // Import flow: relaxed (keep defaults)
      const importRegistry = original.clone();

      // Sync flow: no postal code bonus (external data unreliable)
      const syncRegistry = original.clone();
      syncRegistry.unregister("postal_code");

      expect(apiRegistry.getMaxPossibleScore()).not.toBe(importRegistry.getMaxPossibleScore());
      expect(importRegistry.getMaxPossibleScore()).not.toBe(syncRegistry.getMaxPossibleScore());
    });
  });
});
