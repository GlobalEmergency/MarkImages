/**
 * AddressVariantSamePlace — Interaction: different address + close coords + same type
 *
 * Real case: "Calle Mayor 3" vs "Calle Mayor 5" with coords 2m apart
 * and same establishment type → likely the same AED with a slightly
 * different address in different data sources.
 *
 * Applies when: AddressMatchRule NOT matched AND ProximityRule matched AND EstablishmentTypeRule matched
 * Effect: +15 points bonus
 */

import type { RuleInteraction, InteractionExplanation } from "../RuleInteraction";
import { ruleMatched } from "../RuleInteraction";
import type { RuleExplanation, NormalizedInput, CandidateRecord } from "../ScoringRule";

export class AddressVariantSamePlace implements RuleInteraction {
  readonly id = "address_variant_same_place";
  readonly name = "Address Variant, Same Place";
  readonly description =
    "Different address but close proximity + same type → likely same place with address variant";
  readonly adjustment = 15;

  applies(
    ruleResults: readonly RuleExplanation[],
    _input: NormalizedInput,
    _candidate: CandidateRecord
  ): boolean {
    const addressNotMatched = !ruleMatched(ruleResults, "address_match");
    const proximityClose = ruleMatched(ruleResults, "proximity");
    const sameType = ruleMatched(ruleResults, "establishment_type");
    return addressNotMatched && proximityClose && sameType;
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
        ? `Address differs but coords are close (${candidate.distance_meters?.toFixed(1)}m) ` +
          `and same establishment type → likely same place with address variant → +${this.adjustment}pts`
        : "Conditions for address variant not met",
      triggeringRules: applied ? ["proximity", "establishment_type"] : [],
    };
  }
}
