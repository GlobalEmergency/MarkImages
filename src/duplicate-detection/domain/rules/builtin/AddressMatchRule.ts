/**
 * AddressMatchRule — Exact and fuzzy normalized address match
 *
 * Two tiers:
 *   - Exact match of normalized address → 25pts
 *   - Trigram similarity >= 0.7 (pg_trgm) → 15pts
 *
 * The fuzzy tier handles cross-source address format differences
 * (e.g., "calle suero de quinones 34" vs "c suero de quinones 34").
 */

import type {
  ScoringRule,
  SqlFragment,
  NormalizedInput,
  CandidateRecord,
  RuleExplanation,
} from "../ScoringRule";

/** Trigram similarity approximation (mirrors pg_trgm behavior) */
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

export class AddressMatchRule implements ScoringRule {
  readonly id = "address_match";
  readonly name = "Address Match";
  readonly description = "Exact or fuzzy match of normalized address (street type + name + number)";
  readonly maxPoints = 25;
  readonly category = "attribute" as const;

  /** Fuzzy match config */
  private readonly fuzzyThreshold = 0.7;
  private readonly fuzzyPoints = 15;

  toSqlCase(input: NormalizedInput, paramIndex: number): SqlFragment {
    return {
      sql: `(CASE WHEN l.normalized_address = $${paramIndex}::text
                   AND $${paramIndex}::text != ''
               THEN ${this.maxPoints}
               WHEN l.normalized_address IS NOT NULL
                   AND $${paramIndex}::text != ''
                   AND similarity(l.normalized_address, $${paramIndex}::text) >= ${this.fuzzyThreshold}
               THEN ${this.fuzzyPoints}
               ELSE 0 END)`,
      params: [input.normalizedAddress],
      nextParamIndex: paramIndex + 1,
    };
  }

  evaluate(input: NormalizedInput, candidate: CandidateRecord): number {
    if (!input.normalizedAddress || !candidate.normalized_address) return 0;
    if (input.normalizedAddress === candidate.normalized_address) return this.maxPoints;

    const sim = trigramSimilarity(input.normalizedAddress, candidate.normalized_address);
    return sim >= this.fuzzyThreshold ? this.fuzzyPoints : 0;
  }

  explain(input: NormalizedInput, candidate: CandidateRecord): RuleExplanation {
    const bothPresent = !!input.normalizedAddress && !!candidate.normalized_address;

    if (!bothPresent) {
      return {
        ruleId: this.id,
        ruleName: this.name,
        points: 0,
        maxPoints: this.maxPoints,
        matched: false,
        reason: "One or both addresses empty → 0pts",
        inputValue: input.normalizedAddress || "(empty)",
        candidateValue: candidate.normalized_address || "(empty)",
      };
    }

    // Check exact match first
    if (input.normalizedAddress === candidate.normalized_address) {
      return {
        ruleId: this.id,
        ruleName: this.name,
        points: this.maxPoints,
        maxPoints: this.maxPoints,
        matched: true,
        reason: `Normalized address "${input.normalizedAddress}" matches exactly → +${this.maxPoints}pts`,
        inputValue: input.normalizedAddress,
        candidateValue: candidate.normalized_address,
      };
    }

    // Check fuzzy match
    const sim = trigramSimilarity(input.normalizedAddress, candidate.normalized_address);
    const fuzzyMatch = sim >= this.fuzzyThreshold;

    return {
      ruleId: this.id,
      ruleName: this.name,
      points: fuzzyMatch ? this.fuzzyPoints : 0,
      maxPoints: this.maxPoints,
      matched: fuzzyMatch,
      reason: fuzzyMatch
        ? `Address similarity ${sim.toFixed(2)} >= ${this.fuzzyThreshold} → +${this.fuzzyPoints}pts (fuzzy)`
        : `Address "${input.normalizedAddress}" != "${candidate.normalized_address}" (sim=${sim.toFixed(2)}) → 0pts`,
      inputValue: input.normalizedAddress,
      candidateValue: candidate.normalized_address,
    };
  }
}
