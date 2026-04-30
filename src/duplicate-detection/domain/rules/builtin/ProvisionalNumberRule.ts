/**
 * ProvisionalNumberRule — Exact provisional number match
 */

import type {
  ScoringRule,
  SqlFragment,
  NormalizedInput,
  CandidateRecord,
  RuleExplanation,
} from "../ScoringRule";

export class ProvisionalNumberRule implements ScoringRule {
  readonly id = "provisional_number";
  readonly name = "Provisional Number";
  readonly description = "Exact match of provisional number (when both present and > 0)";
  readonly maxPoints = 15;
  readonly category = "attribute" as const;

  toSqlCase(input: NormalizedInput, paramIndex: number): SqlFragment {
    // Short-circuit when no input — avoid sending null param to SQL
    if (!input.provisionalNumber || input.provisionalNumber <= 0) {
      return { sql: "0", params: [], nextParamIndex: paramIndex };
    }
    return {
      sql: `(CASE WHEN a.provisional_number = $${paramIndex}::int
                   AND a.provisional_number IS NOT NULL
                   AND a.provisional_number > 0
               THEN ${this.maxPoints} ELSE 0 END)`,
      params: [input.provisionalNumber],
      nextParamIndex: paramIndex + 1,
    };
  }

  evaluate(input: NormalizedInput, candidate: CandidateRecord): number {
    if (!input.provisionalNumber || input.provisionalNumber <= 0) return 0;
    if (!candidate.provisional_number || candidate.provisional_number <= 0) return 0;
    return input.provisionalNumber === candidate.provisional_number ? this.maxPoints : 0;
  }

  explain(input: NormalizedInput, candidate: CandidateRecord): RuleExplanation {
    const inputVal = input.provisionalNumber;
    const candidateVal = candidate.provisional_number;
    const inputPresent = !!inputVal && inputVal > 0;
    const candidatePresent = !!candidateVal && candidateVal > 0;
    const matched = inputPresent && candidatePresent && inputVal === candidateVal;
    return {
      ruleId: this.id,
      ruleName: this.name,
      points: matched ? this.maxPoints : 0,
      maxPoints: this.maxPoints,
      matched,
      reason: !inputPresent
        ? "Input has no provisional number → 0pts"
        : !candidatePresent
          ? "Candidate has no provisional number → 0pts"
          : matched
            ? `Provisional number ${inputVal} matches → +${this.maxPoints}pts`
            : `Provisional number ${inputVal} != ${candidateVal} → 0pts`,
      inputValue: inputPresent ? String(inputVal) : "(none)",
      candidateValue: candidatePresent ? String(candidateVal) : "(none)",
    };
  }
}
