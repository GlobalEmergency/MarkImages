/**
 * LocationDetailsPenaltyRule — Penalty when location details differ
 */

import type {
  ScoringRule,
  SqlFragment,
  NormalizedInput,
  CandidateRecord,
  RuleExplanation,
} from "../ScoringRule";

export class LocationDetailsPenaltyRule implements ScoringRule {
  readonly id = "location_details_penalty";
  readonly name = "Location Details Penalty";
  readonly description = "Penalizes when both records have location details but they differ";
  readonly maxPoints = -20;
  readonly category = "penalty" as const;

  toSqlCase(input: NormalizedInput, paramIndex: number): SqlFragment {
    return {
      sql: `(CASE WHEN l.normalized_location_details != ''
                   AND $${paramIndex}::text != ''
                   AND l.normalized_location_details != $${paramIndex}::text
               THEN ${this.maxPoints} ELSE 0 END)`,
      params: [input.normalizedLocationDetails],
      nextParamIndex: paramIndex + 1,
    };
  }

  evaluate(input: NormalizedInput, candidate: CandidateRecord): number {
    if (!input.normalizedLocationDetails || !candidate.normalized_location_details) return 0;
    return input.normalizedLocationDetails !== candidate.normalized_location_details
      ? this.maxPoints
      : 0;
  }

  explain(input: NormalizedInput, candidate: CandidateRecord): RuleExplanation {
    const bothPresent =
      !!input.normalizedLocationDetails && !!candidate.normalized_location_details;
    const different =
      bothPresent && input.normalizedLocationDetails !== candidate.normalized_location_details;
    return {
      ruleId: this.id,
      ruleName: this.name,
      points: different ? this.maxPoints : 0,
      maxPoints: this.maxPoints,
      matched: different,
      reason: !bothPresent
        ? "One or both location details empty → no penalty"
        : different
          ? `Location details "${input.normalizedLocationDetails}" != "${candidate.normalized_location_details}" → ${this.maxPoints}pts`
          : `Location details match → no penalty`,
      inputValue: input.normalizedLocationDetails || "(empty)",
      candidateValue: candidate.normalized_location_details || "(empty)",
    };
  }
}
