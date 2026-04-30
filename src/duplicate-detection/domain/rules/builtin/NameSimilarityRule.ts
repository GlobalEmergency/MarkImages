/**
 * NameSimilarityRule — pg_trgm trigram similarity of normalized names
 *
 * Uses PostgreSQL's similarity() function (pg_trgm extension) for
 * fuzzy name matching. Threshold is configurable (default 0.9).
 */

import type {
  ScoringRule,
  SqlFragment,
  NormalizedInput,
  CandidateRecord,
  RuleExplanation,
} from "../ScoringRule";

/**
 * Simple trigram similarity approximation for JS evaluation.
 * Matches pg_trgm behavior closely enough for scoring/explain purposes.
 */
function trigramSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;

  const trigramsA = new Set<string>();
  const trigramsB = new Set<string>();
  const paddedA = `  ${a} `;
  const paddedB = `  ${b} `;

  for (let i = 0; i <= paddedA.length - 3; i++) trigramsA.add(paddedA.slice(i, i + 3));
  for (let i = 0; i <= paddedB.length - 3; i++) trigramsB.add(paddedB.slice(i, i + 3));

  let intersection = 0;
  for (const t of trigramsA) {
    if (trigramsB.has(t)) intersection++;
  }

  const union = trigramsA.size + trigramsB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export class NameSimilarityRule implements ScoringRule {
  readonly id = "name_similarity";
  readonly name = "Name Similarity";
  readonly description = "pg_trgm trigram similarity of normalized names";
  readonly maxPoints = 30;
  readonly category = "attribute" as const;

  constructor(private readonly threshold: number = 0.9) {}

  toSqlCase(input: NormalizedInput, paramIndex: number): SqlFragment {
    return {
      sql: `(CASE WHEN similarity(a.normalized_name, $${paramIndex}::text) >= ${this.threshold}
               THEN ${this.maxPoints} ELSE 0 END)`,
      params: [input.normalizedName],
      nextParamIndex: paramIndex + 1,
    };
  }

  evaluate(input: NormalizedInput, candidate: CandidateRecord): number {
    const sim =
      candidate.name_similarity ??
      trigramSimilarity(input.normalizedName, candidate.normalized_name);
    return sim >= this.threshold ? this.maxPoints : 0;
  }

  explain(input: NormalizedInput, candidate: CandidateRecord): RuleExplanation {
    const sim =
      candidate.name_similarity ??
      trigramSimilarity(input.normalizedName, candidate.normalized_name);
    const matched = sim >= this.threshold;
    return {
      ruleId: this.id,
      ruleName: this.name,
      points: matched ? this.maxPoints : 0,
      maxPoints: this.maxPoints,
      matched,
      reason: matched
        ? `Name similarity ${sim.toFixed(2)} >= threshold ${this.threshold} → +${this.maxPoints}pts`
        : `Name similarity ${sim.toFixed(2)} < threshold ${this.threshold} → 0pts`,
      inputValue: input.normalizedName,
      candidateValue: candidate.normalized_name,
    };
  }
}
