/**
 * ScoringRule — Base interface for all scoring rules
 *
 * Each rule is an autonomous domain object with dual evaluation:
 * - SQL (batch performance via PostGIS + pg_trgm)
 * - JS (single-record checks, testing, explainability)
 *
 * Rules are registered in the RuleRegistry and compiled into
 * dynamic SQL by the PostgisScoringEngine.
 */

/** Parametrized SQL fragment for batch queries */
export interface SqlFragment {
  /** SQL CASE expression (e.g., "(CASE WHEN similarity(...) >= 0.9 THEN 30 ELSE 0 END)") */
  sql: string;
  /** Parameters for $N placeholders */
  params: unknown[];
  /** Next available paramIndex */
  nextParamIndex: number;
}

/** Normalized input data for rule evaluation */
export interface NormalizedInput {
  name?: string;
  normalizedName: string;
  normalizedAddress: string;
  normalizedFloor: string;
  normalizedLocationDetails: string;
  normalizedAccessInstructions: string;
  latitude?: number;
  longitude?: number;
  postalCode?: string;
  provisionalNumber?: number | null;
  establishmentType?: string;
}

/** Candidate record from the database */
export interface CandidateRecord {
  id: string;
  name: string;
  normalized_name: string;
  normalized_address: string;
  normalized_floor: string;
  normalized_location_details: string;
  normalized_access_instructions: string;
  latitude: number | null;
  longitude: number | null;
  postal_code: string | null;
  provisional_number: number | null;
  establishment_type: string | null;
  distance_meters?: number;
  /** Raw similarity value from pg_trgm (populated by SQL query) */
  name_similarity?: number;
}

/** Per-rule explanation for debugging */
export interface RuleExplanation {
  ruleId: string;
  ruleName: string;
  /** Points awarded (can be 0 or negative for penalties) */
  points: number;
  /** Maximum possible points for this rule */
  maxPoints: number;
  /** Did this rule contribute to the score? */
  matched: boolean;
  /** Human-readable reason */
  reason: string;
  /** Input value used for comparison */
  inputValue?: string;
  /** Candidate value compared against */
  candidateValue?: string;
}

export type ScoringRuleCategory = "identity" | "spatial" | "attribute" | "penalty";

/**
 * Base interface for all scoring rules.
 *
 * Each rule encapsulates:
 * - What it evaluates (name, description)
 * - How much it weighs (maxPoints, positive or negative)
 * - How it evaluates in SQL (for batch performance)
 * - How it evaluates in JS (for single-record or testing)
 * - How it explains its decision (for debugging)
 */
export interface ScoringRule {
  /** Unique rule identifier (e.g., "name_similarity") */
  readonly id: string;
  /** Human-readable name */
  readonly name: string;
  /** Description of what this rule evaluates */
  readonly description: string;
  /** Max points: positive = bonus, negative = penalty */
  readonly maxPoints: number;
  /** Functional category */
  readonly category: ScoringRuleCategory;

  /**
   * Generate SQL CASE fragment for batch scoring CTE.
   * SQL has access to aliases: `a` (aeds), `l` (aed_locations).
   */
  toSqlCase(input: NormalizedInput, paramIndex: number): SqlFragment;

  /**
   * Evaluate the rule in JS against a DB candidate.
   * Used for: single-record checks, testing, post-query explanations.
   */
  evaluate(input: NormalizedInput, candidate: CandidateRecord): number;

  /**
   * Generate human-readable explanation of WHY the rule awarded (or not) points.
   */
  explain(input: NormalizedInput, candidate: CandidateRecord): RuleExplanation;
}
