/**
 * AccessInstructionsPenaltyRule — Penalty when access instructions differ
 */

import type {
  ScoringRule,
  SqlFragment,
  NormalizedInput,
  CandidateRecord,
  RuleExplanation,
} from "../ScoringRule";

export class AccessInstructionsPenaltyRule implements ScoringRule {
  readonly id = "access_instructions_penalty";
  readonly name = "Access Instructions Penalty";
  readonly description = "Penalizes when both records have access instructions but they differ";
  readonly maxPoints = -15;
  readonly category = "penalty" as const;

  toSqlCase(input: NormalizedInput, paramIndex: number): SqlFragment {
    return {
      sql: `(CASE WHEN l.normalized_access_instructions != ''
                   AND $${paramIndex}::text != ''
                   AND l.normalized_access_instructions != $${paramIndex}::text
               THEN ${this.maxPoints} ELSE 0 END)`,
      params: [input.normalizedAccessInstructions],
      nextParamIndex: paramIndex + 1,
    };
  }

  evaluate(input: NormalizedInput, candidate: CandidateRecord): number {
    if (!input.normalizedAccessInstructions || !candidate.normalized_access_instructions) return 0;
    return input.normalizedAccessInstructions !== candidate.normalized_access_instructions
      ? this.maxPoints
      : 0;
  }

  explain(input: NormalizedInput, candidate: CandidateRecord): RuleExplanation {
    const bothPresent =
      !!input.normalizedAccessInstructions && !!candidate.normalized_access_instructions;
    const different =
      bothPresent &&
      input.normalizedAccessInstructions !== candidate.normalized_access_instructions;
    return {
      ruleId: this.id,
      ruleName: this.name,
      points: different ? this.maxPoints : 0,
      maxPoints: this.maxPoints,
      matched: different,
      reason: !bothPresent
        ? "One or both access instructions empty → no penalty"
        : different
          ? `Access instructions differ → ${this.maxPoints}pts`
          : `Access instructions match → no penalty`,
      inputValue: input.normalizedAccessInstructions || "(empty)",
      candidateValue: candidate.normalized_access_instructions || "(empty)",
    };
  }
}
