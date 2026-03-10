/**
 * RuleRegistry — Configurable registry for rules and interactions
 *
 * Rules evaluate individual criteria; interactions evaluate combinations.
 * The registry allows adding/removing/replacing rules and interactions
 * without modifying infrastructure code (OCP).
 */

import type { ScoringRule, ScoringRuleCategory } from "./ScoringRule";
import type { RuleInteraction } from "./RuleInteraction";

export class RuleRegistry {
  private rules: ScoringRule[];
  private interactions: RuleInteraction[];

  constructor(rules?: ScoringRule[], interactions?: RuleInteraction[]) {
    this.rules = rules ? [...rules] : [];
    this.interactions = interactions ? [...interactions] : [];
  }

  // =============================================
  // Rules
  // =============================================

  /** Register a new rule */
  register(rule: ScoringRule): this {
    if (this.rules.some((r) => r.id === rule.id)) {
      throw new Error(`Rule "${rule.id}" is already registered. Use replace() to update.`);
    }
    this.rules.push(rule);
    return this;
  }

  /** Remove a rule by ID */
  unregister(ruleId: string): this {
    this.rules = this.rules.filter((r) => r.id !== ruleId);
    return this;
  }

  /** Replace an existing rule (same ID) with a new version */
  replace(rule: ScoringRule): this {
    const idx = this.rules.findIndex((r) => r.id === rule.id);
    if (idx === -1) {
      throw new Error(`Rule "${rule.id}" not found. Use register() to add new rules.`);
    }
    this.rules[idx] = rule;
    return this;
  }

  /** Get all active rules (immutable copy) */
  getAll(): readonly ScoringRule[] {
    return [...this.rules];
  }

  /** Filter rules by category */
  getByCategory(category: ScoringRuleCategory): readonly ScoringRule[] {
    return this.rules.filter((r) => r.category === category);
  }

  /** Maximum theoretical positive score (sum of positive maxPoints) */
  getMaxPossibleScore(): number {
    return this.rules.reduce((sum, r) => sum + Math.max(0, r.maxPoints), 0);
  }

  // =============================================
  // Interactions
  // =============================================

  /** Register a new interaction */
  registerInteraction(interaction: RuleInteraction): this {
    if (this.interactions.some((i) => i.id === interaction.id)) {
      throw new Error(
        `Interaction "${interaction.id}" is already registered. Use replaceInteraction() to update.`
      );
    }
    this.interactions.push(interaction);
    return this;
  }

  /** Remove an interaction by ID */
  unregisterInteraction(id: string): this {
    this.interactions = this.interactions.filter((i) => i.id !== id);
    return this;
  }

  /** Replace an existing interaction */
  replaceInteraction(interaction: RuleInteraction): this {
    const idx = this.interactions.findIndex((i) => i.id === interaction.id);
    if (idx === -1) {
      throw new Error(
        `Interaction "${interaction.id}" not found. Use registerInteraction() to add.`
      );
    }
    this.interactions[idx] = interaction;
    return this;
  }

  /** Get all active interactions */
  getAllInteractions(): readonly RuleInteraction[] {
    return [...this.interactions];
  }

  /** Create a copy of this registry (for per-flow variants) */
  clone(): RuleRegistry {
    return new RuleRegistry([...this.rules], [...this.interactions]);
  }
}
