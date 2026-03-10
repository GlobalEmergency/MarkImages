/**
 * AddressMatchRule — Exact normalized address match
 */

import type {
  ScoringRule,
  SqlFragment,
  NormalizedInput,
  CandidateRecord,
  RuleExplanation,
} from "../ScoringRule";

export class AddressMatchRule implements ScoringRule {
  readonly id = "address_match";
  readonly name = "Address Match";
  readonly description = "Exact match of normalized address (street type + name + number)";
  readonly maxPoints = 25;
  readonly category = "attribute" as const;

  toSqlCase(input: NormalizedInput, paramIndex: number): SqlFragment {
    return {
      sql: `(CASE WHEN l.normalized_address = $${paramIndex}::text
               THEN ${this.maxPoints} ELSE 0 END)`,
      params: [input.normalizedAddress],
      nextParamIndex: paramIndex + 1,
    };
  }

  evaluate(input: NormalizedInput, candidate: CandidateRecord): number {
    if (!input.normalizedAddress || !candidate.normalized_address) return 0;
    return input.normalizedAddress === candidate.normalized_address ? this.maxPoints : 0;
  }

  explain(input: NormalizedInput, candidate: CandidateRecord): RuleExplanation {
    const bothPresent = !!input.normalizedAddress && !!candidate.normalized_address;
    const matches = bothPresent && input.normalizedAddress === candidate.normalized_address;
    return {
      ruleId: this.id,
      ruleName: this.name,
      points: matches ? this.maxPoints : 0,
      maxPoints: this.maxPoints,
      matched: matches,
      reason: !bothPresent
        ? "One or both addresses empty → 0pts"
        : matches
          ? `Normalized address "${input.normalizedAddress}" matches exactly → +${this.maxPoints}pts`
          : `Normalized address "${input.normalizedAddress}" != "${candidate.normalized_address}" → 0pts`,
      inputValue: input.normalizedAddress || "(empty)",
      candidateValue: candidate.normalized_address || "(empty)",
    };
  }
}
