/**
 * FloorPenaltyRule — Penalty when both records have floor info but they differ
 *
 * Critical discriminant: same address + different floor = different unit.
 */

import type {
  ScoringRule,
  SqlFragment,
  NormalizedInput,
  CandidateRecord,
  RuleExplanation,
} from "../ScoringRule";

export class FloorPenaltyRule implements ScoringRule {
  readonly id = "floor_penalty";
  readonly name = "Floor Mismatch Penalty";
  readonly description = "Penalizes when both records have floor info but they differ";
  readonly maxPoints = -20;
  readonly category = "penalty" as const;

  toSqlCase(input: NormalizedInput, paramIndex: number): SqlFragment {
    return {
      sql: `(CASE WHEN l.normalized_floor != ''
                   AND $${paramIndex}::text != ''
                   AND l.normalized_floor != $${paramIndex}::text
               THEN ${this.maxPoints} ELSE 0 END)`,
      params: [input.normalizedFloor],
      nextParamIndex: paramIndex + 1,
    };
  }

  evaluate(input: NormalizedInput, candidate: CandidateRecord): number {
    if (!input.normalizedFloor || !candidate.normalized_floor) return 0;
    return input.normalizedFloor !== candidate.normalized_floor ? this.maxPoints : 0;
  }

  explain(input: NormalizedInput, candidate: CandidateRecord): RuleExplanation {
    const bothPresent = !!input.normalizedFloor && !!candidate.normalized_floor;
    const different = bothPresent && input.normalizedFloor !== candidate.normalized_floor;
    return {
      ruleId: this.id,
      ruleName: this.name,
      points: different ? this.maxPoints : 0,
      maxPoints: this.maxPoints,
      matched: different,
      reason: !bothPresent
        ? "One or both floors empty → no penalty"
        : different
          ? `Floor "${input.normalizedFloor}" != "${candidate.normalized_floor}" → ${this.maxPoints}pts`
          : `Floor "${input.normalizedFloor}" matches → no penalty`,
      inputValue: input.normalizedFloor || "(empty)",
      candidateValue: candidate.normalized_floor || "(empty)",
    };
  }
}
