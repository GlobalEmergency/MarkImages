/**
 * RuleInteraction — Conditional interactions between rules
 *
 * Individual rules evaluate each criterion independently (SRP).
 * But combinations matter: same address + different floor = different unit (NOT duplicate).
 *
 * RuleInteractions resolve this by applying conditional adjustments
 * AFTER individual rules have been evaluated.
 *
 * Evaluation process:
 * 1. Phase 1: Each ScoringRule evaluates independently → RuleExplanation[]
 * 2. Phase 2: Each RuleInteraction examines Phase 1 results → InteractionExplanation[]
 * 3. Final score = sum(rules) + sum(interactions)
 */

import type { RuleExplanation, NormalizedInput, CandidateRecord } from "./ScoringRule";

/** Per-interaction explanation for debugging */
export interface InteractionExplanation {
  interactionId: string;
  interactionName: string;
  /** Whether this interaction applied */
  applied: boolean;
  /** Score adjustment (0 if not applied) */
  adjustment: number;
  /** Human-readable reason */
  reason: string;
  /** IDs of the rules that triggered this interaction */
  triggeringRules: string[];
}

/**
 * Conditional interaction between rules.
 *
 * Evaluated AFTER all individual rules have executed.
 * Expresses logic like: "IF rule X matched AND rule Z didn't → adjust score".
 */
export interface RuleInteraction {
  /** Unique identifier (e.g., "same_building_different_unit") */
  readonly id: string;
  /** Human-readable name */
  readonly name: string;
  /** Description of the reasoning */
  readonly description: string;
  /** Score adjustment (positive or negative) */
  readonly adjustment: number;

  /**
   * Evaluate whether this interaction applies given individual rule results.
   */
  applies(
    ruleResults: readonly RuleExplanation[],
    input: NormalizedInput,
    candidate: CandidateRecord
  ): boolean;

  /**
   * Generate human-readable explanation of why the interaction applied or not.
   */
  explain(
    ruleResults: readonly RuleExplanation[],
    input: NormalizedInput,
    candidate: CandidateRecord
  ): InteractionExplanation;
}

/**
 * Helper: check if a specific rule matched in the results.
 * Shared by all interaction implementations.
 */
export function ruleMatched(results: readonly RuleExplanation[], ruleId: string): boolean {
  return results.some((r) => r.ruleId === ruleId && r.matched);
}
