/**
 * PostalCodeRule — Exact postal code match
 */

import type {
  ScoringRule,
  SqlFragment,
  NormalizedInput,
  CandidateRecord,
  RuleExplanation,
} from "../ScoringRule";

export class PostalCodeRule implements ScoringRule {
  readonly id = "postal_code";
  readonly name = "Postal Code";
  readonly description = "Exact postal code match";
  readonly maxPoints = 5;
  readonly category = "attribute" as const;

  toSqlCase(input: NormalizedInput, paramIndex: number): SqlFragment {
    return {
      sql: `(CASE WHEN l.postal_code = $${paramIndex}::text
                   AND $${paramIndex}::text != ''
               THEN ${this.maxPoints} ELSE 0 END)`,
      params: [input.postalCode || ""],
      nextParamIndex: paramIndex + 1,
    };
  }

  evaluate(input: NormalizedInput, candidate: CandidateRecord): number {
    if (!input.postalCode || !candidate.postal_code) return 0;
    return input.postalCode === candidate.postal_code ? this.maxPoints : 0;
  }

  explain(input: NormalizedInput, candidate: CandidateRecord): RuleExplanation {
    const bothPresent = !!input.postalCode && !!candidate.postal_code;
    const matched = bothPresent && input.postalCode === candidate.postal_code;
    return {
      ruleId: this.id,
      ruleName: this.name,
      points: matched ? this.maxPoints : 0,
      maxPoints: this.maxPoints,
      matched,
      reason: !bothPresent
        ? "One or both postal codes empty → 0pts"
        : matched
          ? `Postal code "${input.postalCode}" matches → +${this.maxPoints}pts`
          : `Postal code "${input.postalCode}" != "${candidate.postal_code}" → 0pts`,
      inputValue: input.postalCode || "(empty)",
      candidateValue: candidate.postal_code || "(empty)",
    };
  }
}
