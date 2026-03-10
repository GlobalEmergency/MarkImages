/**
 * EstablishmentTypeRule — Normalized establishment type match
 */

import type {
  ScoringRule,
  SqlFragment,
  NormalizedInput,
  CandidateRecord,
  RuleExplanation,
} from "../ScoringRule";

export class EstablishmentTypeRule implements ScoringRule {
  readonly id = "establishment_type";
  readonly name = "Establishment Type";
  readonly description = "Normalized establishment type match (both must be present)";
  readonly maxPoints = 10;
  readonly category = "attribute" as const;

  toSqlCase(input: NormalizedInput, paramIndex: number): SqlFragment {
    return {
      sql: `(CASE WHEN normalize_text(a.establishment_type) = normalize_text($${paramIndex}::text)
                   AND a.establishment_type IS NOT NULL
                   AND $${paramIndex}::text != ''
               THEN ${this.maxPoints} ELSE 0 END)`,
      params: [input.establishmentType || ""],
      nextParamIndex: paramIndex + 1,
    };
  }

  evaluate(input: NormalizedInput, candidate: CandidateRecord): number {
    if (!input.establishmentType || !candidate.establishment_type) return 0;
    const inputNorm = normalizeSimple(input.establishmentType);
    const candidateNorm = normalizeSimple(candidate.establishment_type);
    return inputNorm === candidateNorm ? this.maxPoints : 0;
  }

  explain(input: NormalizedInput, candidate: CandidateRecord): RuleExplanation {
    const bothPresent = !!input.establishmentType && !!candidate.establishment_type;
    const matched =
      bothPresent &&
      normalizeSimple(input.establishmentType!) === normalizeSimple(candidate.establishment_type!);
    return {
      ruleId: this.id,
      ruleName: this.name,
      points: matched ? this.maxPoints : 0,
      maxPoints: this.maxPoints,
      matched,
      reason: !bothPresent
        ? "One or both establishment types empty → 0pts"
        : matched
          ? `Establishment type "${input.establishmentType}" matches → +${this.maxPoints}pts`
          : `Establishment type "${input.establishmentType}" != "${candidate.establishment_type}" → 0pts`,
      inputValue: input.establishmentType || "(empty)",
      candidateValue: candidate.establishment_type || "(empty)",
    };
  }
}

/** Mirror PostgreSQL normalize_text(): unaccent → trim → lower */
function normalizeSimple(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}
