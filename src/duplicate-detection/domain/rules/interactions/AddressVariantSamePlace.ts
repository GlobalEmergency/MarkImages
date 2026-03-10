/**
 * AddressVariantSamePlace — Interaction: different address + close coords + compatible type
 *
 * Real case: "Calle Mayor 3" vs "Calle Mayor 5" with coords 2m apart
 * and same establishment type → likely the same AED with a slightly
 * different address in different data sources.
 *
 * Applies when:
 *   - AddressMatchRule NOT matched (neither exact nor fuzzy)
 *   - ProximityRule matched (any tier)
 *   - EstablishmentType is compatible: same type OR one/both sides missing type data
 *     (missing type ≠ different type — absence of data shouldn't block detection)
 *
 * Effect: +15 points bonus
 */

import type { RuleInteraction, InteractionExplanation } from "../RuleInteraction";
import { ruleMatched } from "../RuleInteraction";
import type { RuleExplanation, NormalizedInput, CandidateRecord } from "../ScoringRule";

export class AddressVariantSamePlace implements RuleInteraction {
  readonly id = "address_variant_same_place";
  readonly name = "Address Variant, Same Place";
  readonly description =
    "Different address but close proximity + compatible type → likely same place with address variant";
  readonly adjustment = 15;

  applies(
    ruleResults: readonly RuleExplanation[],
    input: NormalizedInput,
    candidate: CandidateRecord
  ): boolean {
    const addressNotMatched = !ruleMatched(ruleResults, "address_match");
    const proximityClose = ruleMatched(ruleResults, "proximity");
    const sameType = ruleMatched(ruleResults, "establishment_type");

    // Missing type on either side means "unknown" — not evidence of difference.
    // Only block the interaction when BOTH sides have type data and they differ.
    const typeUnknown = !input.establishmentType || !candidate.establishment_type;
    const typeCompatible = sameType || typeUnknown;

    return addressNotMatched && proximityClose && typeCompatible;
  }

  explain(
    ruleResults: readonly RuleExplanation[],
    input: NormalizedInput,
    candidate: CandidateRecord
  ): InteractionExplanation {
    const applied = this.applies(ruleResults, input, candidate);
    const typeUnknown = !input.establishmentType || !candidate.establishment_type;

    return {
      interactionId: this.id,
      interactionName: this.name,
      applied,
      adjustment: applied ? this.adjustment : 0,
      reason: applied
        ? `Address differs but coords are close (${candidate.distance_meters?.toFixed(1)}m) ` +
          `${typeUnknown ? "and type data missing on one/both sides" : "and same establishment type"} ` +
          `→ likely same place with address variant → +${this.adjustment}pts`
        : "Conditions for address variant not met",
      triggeringRules: applied ? ["proximity", "establishment_type"] : [],
    };
  }
}
