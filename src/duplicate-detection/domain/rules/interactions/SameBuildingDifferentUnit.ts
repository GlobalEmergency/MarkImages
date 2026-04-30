/**
 * SameBuildingDifferentUnit — Interaction: address matches + floor differs
 *
 * Real case: Calle Mayor 5, Planta Baja vs Calle Mayor 5, Primera Planta
 * These are different units within the same building — NOT duplicates.
 *
 * Applies when: AddressMatchRule matched AND FloorPenaltyRule matched
 * Effect: Additional -30 points (on top of FloorPenalty's -20)
 */

import type { RuleInteraction, InteractionExplanation } from "../RuleInteraction";
import { ruleMatched } from "../RuleInteraction";
import type { RuleExplanation, NormalizedInput, CandidateRecord } from "../ScoringRule";

export class SameBuildingDifferentUnit implements RuleInteraction {
  readonly id = "same_building_different_unit";
  readonly name = "Same Building, Different Unit";
  readonly description = "Address matches but floor differs → different unit, not duplicate";
  readonly adjustment = -30;

  applies(
    ruleResults: readonly RuleExplanation[],
    _input: NormalizedInput,
    _candidate: CandidateRecord
  ): boolean {
    return ruleMatched(ruleResults, "address_match") && ruleMatched(ruleResults, "floor_penalty");
  }

  explain(
    ruleResults: readonly RuleExplanation[],
    input: NormalizedInput,
    candidate: CandidateRecord
  ): InteractionExplanation {
    const applied = this.applies(ruleResults, input, candidate);
    return {
      interactionId: this.id,
      interactionName: this.name,
      applied,
      adjustment: applied ? this.adjustment : 0,
      reason: applied
        ? `Same address "${input.normalizedAddress}" but different floor ` +
          `("${input.normalizedFloor}" vs "${candidate.normalized_floor}") → ` +
          `likely different unit in same building → ${this.adjustment}pts`
        : "Address and floor combination does not indicate same-building split",
      triggeringRules: applied ? ["address_match", "floor_penalty"] : [],
    };
  }
}
