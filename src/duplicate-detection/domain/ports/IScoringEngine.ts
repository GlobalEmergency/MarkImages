/**
 * IScoringEngine — Port for the rules-based scoring engine
 *
 * Compiles rules from the RuleRegistry into SQL and executes against the DB.
 * Returns ScoringExplanation with full per-rule breakdown.
 */

import type { NormalizedInput } from "../rules/ScoringRule";
import type { RuleRegistry } from "../rules/RuleRegistry";
import type { ScoringExplanation } from "../value-objects/ScoringExplanation";

export interface ScoringInput {
  /** Index in the original criteriaList */
  index: number;
  /** Normalized input data for rule evaluation */
  normalized: NormalizedInput;
}

export interface IScoringEngine {
  /**
   * Execute the rules engine against the DB for N records.
   * Returns Map from input index → best ScoringExplanation.
   */
  scoreBatch(
    inputs: readonly ScoringInput[],
    registry: RuleRegistry
  ): Promise<ReadonlyMap<number, ScoringExplanation>>;
}
