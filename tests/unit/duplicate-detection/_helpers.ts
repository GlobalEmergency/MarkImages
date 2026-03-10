/**
 * Shared test helpers for the duplicate-detection module.
 *
 * Provides factory functions for creating test data and a utility
 * to evaluate all rules in the default registry against a given
 * input/candidate pair.
 */

import type {
  NormalizedInput,
  CandidateRecord,
  RuleExplanation,
} from "@/duplicate-detection/domain/rules/ScoringRule";
import { createDefaultRegistry } from "@/duplicate-detection/domain/rules";

// ─── Factories ───────────────────────────────────────────────

/** NormalizedInput with sensible defaults — override only what the test needs */
export function makeInput(overrides?: Partial<NormalizedInput>): NormalizedInput {
  return {
    name: "Farmacia Central",
    normalizedName: "farmacia central",
    normalizedAddress: "calle mayor 5",
    normalizedFloor: "",
    normalizedLocationDetails: "",
    normalizedAccessInstructions: "",
    latitude: 40.4168,
    longitude: -3.7038,
    postalCode: "28001",
    provisionalNumber: null,
    establishmentType: "farmacia",
    ...overrides,
  };
}

/** CandidateRecord simulating an existing AED from the database */
export function makeCandidate(overrides?: Partial<CandidateRecord>): CandidateRecord {
  return {
    id: "existing-aed-001",
    name: "Farmacia Central",
    normalized_name: "farmacia central",
    normalized_address: "calle mayor 5",
    normalized_floor: "",
    normalized_location_details: "",
    normalized_access_instructions: "",
    latitude: 40.4168,
    longitude: -3.7038,
    postal_code: "28001",
    provisional_number: null,
    establishment_type: "farmacia",
    distance_meters: 0,
    name_similarity: 1.0,
    ...overrides,
  };
}

/** Minimal RuleExplanation — for building interaction test scenarios */
export function makeRuleResult(overrides?: Partial<RuleExplanation>): RuleExplanation {
  return {
    ruleId: "test_rule",
    ruleName: "Test Rule",
    points: 0,
    maxPoints: 10,
    matched: false,
    reason: "test",
    ...overrides,
  };
}

// ─── Full evaluation helper ──────────────────────────────────

/**
 * Evaluate ALL rules + interactions from the default registry
 * against an input and candidate. Returns the total score and
 * all per-rule/per-interaction explanations.
 *
 * This mirrors the logic in PostgisScoringEngine.buildExplanation()
 * but runs entirely in JS for testing purposes.
 */
export function evaluateAllRules(input: NormalizedInput, candidate: CandidateRecord) {
  const registry = createDefaultRegistry();
  const rules = registry.getAll();
  const interactions = registry.getAllInteractions();

  const ruleResults = rules.map((r) => r.explain(input, candidate));
  const interactionResults = interactions.map((i) => i.explain(ruleResults, input, candidate));

  const rulesScore = ruleResults.reduce((sum, r) => sum + r.points, 0);
  const interactionsAdj = interactionResults.reduce((sum, i) => sum + i.adjustment, 0);
  const totalScore = Math.max(0, rulesScore + interactionsAdj);

  return { totalScore, ruleResults, interactionResults, rulesScore, interactionsAdj };
}
