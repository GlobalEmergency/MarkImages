/**
 * ScoringExplanation — Immutable Value Object
 *
 * Detailed scoring breakdown for debugging and analysis.
 * Includes individual rule results + interaction adjustments.
 */

import type { RuleExplanation } from "../rules/ScoringRule";
import type { InteractionExplanation } from "../rules/RuleInteraction";

export interface ScoringExplanationProps {
  totalScore: number;
  maxPossibleScore: number;
  ruleResults: readonly RuleExplanation[];
  interactionResults: readonly InteractionExplanation[];
  matchedAedId: string | undefined;
  matchedAedName: string | undefined;
  searchStrategy: "coordinates" | "postal_code" | "none";
  distanceMeters: number | undefined;
}

export class ScoringExplanation {
  public readonly totalScore: number;
  public readonly maxPossibleScore: number;
  public readonly ruleResults: readonly RuleExplanation[];
  public readonly interactionResults: readonly InteractionExplanation[];
  public readonly matchedAedId: string | undefined;
  public readonly matchedAedName: string | undefined;
  public readonly searchStrategy: "coordinates" | "postal_code" | "none";
  public readonly distanceMeters: number | undefined;

  private constructor(props: ScoringExplanationProps) {
    this.totalScore = props.totalScore;
    this.maxPossibleScore = props.maxPossibleScore;
    this.ruleResults = props.ruleResults;
    this.interactionResults = props.interactionResults;
    this.matchedAedId = props.matchedAedId;
    this.matchedAedName = props.matchedAedName;
    this.searchStrategy = props.searchStrategy;
    this.distanceMeters = props.distanceMeters;
    Object.freeze(this);
  }

  static create(props: ScoringExplanationProps): ScoringExplanation {
    return new ScoringExplanation(props);
  }

  /** Score from individual rules (before interactions) */
  get rulesScore(): number {
    return this.ruleResults.reduce((sum, r) => sum + r.points, 0);
  }

  /** Total adjustment from interactions */
  get interactionsAdjustment(): number {
    return this.interactionResults.reduce((sum, i) => sum + i.adjustment, 0);
  }

  /** Rules that contributed to the score (matched=true) */
  get contributingRules(): readonly RuleExplanation[] {
    return this.ruleResults.filter((r) => r.matched);
  }

  /** Rules that did NOT contribute */
  get nonContributingRules(): readonly RuleExplanation[] {
    return this.ruleResults.filter((r) => !r.matched);
  }

  /** Penalties that were applied (points < 0) */
  get appliedPenalties(): readonly RuleExplanation[] {
    return this.ruleResults.filter((r) => r.points < 0);
  }

  /** Interactions that were applied */
  get appliedInteractions(): readonly InteractionExplanation[] {
    return this.interactionResults.filter((i) => i.applied);
  }

  /** Human-readable summary for logs/UI */
  toSummary(): string {
    const parts: string[] = [`Score: ${this.totalScore}/${this.maxPossibleScore}`];

    if (this.matchedAedName) {
      parts.push(`Matched: "${this.matchedAedName}" (${this.matchedAedId})`);
    }
    if (this.distanceMeters !== undefined) {
      parts.push(`Distance: ${this.distanceMeters.toFixed(1)}m`);
    }

    parts.push(`--- Rules (${this.rulesScore}pts) ---`);
    for (const r of this.ruleResults) {
      if (r.matched) {
        const sign = r.points >= 0 ? "+" : "";
        parts.push(`  ${sign}${r.points} ${r.ruleName}: ${r.reason}`);
      }
    }

    if (this.appliedInteractions.length > 0) {
      parts.push(`--- Interactions (${this.interactionsAdjustment}pts) ---`);
      for (const i of this.appliedInteractions) {
        const sign = i.adjustment >= 0 ? "+" : "";
        parts.push(`  ${sign}${i.adjustment} ${i.interactionName}: ${i.reason}`);
      }
    }

    return parts.join("\n");
  }

  /** Serializable for internal_notes and API responses */
  toJSON(): Record<string, unknown> {
    return {
      totalScore: this.totalScore,
      maxPossibleScore: this.maxPossibleScore,
      searchStrategy: this.searchStrategy,
      distanceMeters: this.distanceMeters,
      matchedAedId: this.matchedAedId,
      matchedAedName: this.matchedAedName,
      rules: this.ruleResults.map((r) => ({
        ruleId: r.ruleId,
        ruleName: r.ruleName,
        points: r.points,
        maxPoints: r.maxPoints,
        matched: r.matched,
        reason: r.reason,
      })),
      interactions: this.interactionResults
        .filter((i) => i.applied)
        .map((i) => ({
          id: i.interactionId,
          name: i.interactionName,
          adjustment: i.adjustment,
          reason: i.reason,
          triggeringRules: i.triggeringRules,
        })),
    };
  }
}
