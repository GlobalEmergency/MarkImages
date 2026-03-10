/**
 * DetectionResult — Immutable Value Object
 *
 * Result of duplicate detection. Includes the scoring explanation
 * for full debuggability and analysis.
 */

import { ScoringExplanation } from "./ScoringExplanation";

export type MatchedBy = "id" | "code" | "externalReference" | "scoring";

export class DetectionResult {
  public readonly status: "confirmed" | "possible" | "none";
  public readonly score: number;
  public readonly matchedAedId: string | undefined;
  public readonly matchedBy: MatchedBy | undefined;
  public readonly explanation: ScoringExplanation | undefined;

  private constructor(
    status: "confirmed" | "possible" | "none",
    score: number,
    matchedAedId: string | undefined,
    matchedBy: MatchedBy | undefined,
    explanation: ScoringExplanation | undefined
  ) {
    this.status = status;
    this.score = score;
    this.matchedAedId = matchedAedId;
    this.matchedBy = matchedBy;
    this.explanation = explanation;
    Object.freeze(this);
  }

  /** Confirmed duplicate by identity match (ID, code, or external reference) */
  static confirmedByIdentity(
    aedId: string,
    matchedBy: "id" | "code" | "externalReference"
  ): DetectionResult {
    return new DetectionResult("confirmed", 100, aedId, matchedBy, undefined);
  }

  /** Confirmed duplicate by scoring engine (score >= confirmed threshold) */
  static confirmedByScoring(aedId: string, explanation: ScoringExplanation): DetectionResult {
    return new DetectionResult("confirmed", explanation.totalScore, aedId, "scoring", explanation);
  }

  /** Possible duplicate by scoring engine (score >= possible threshold) */
  static possible(aedId: string, explanation: ScoringExplanation): DetectionResult {
    return new DetectionResult("possible", explanation.totalScore, aedId, "scoring", explanation);
  }

  /** No duplicate detected */
  static none(): DetectionResult {
    return new DetectionResult("none", 0, undefined, undefined, undefined);
  }

  get isConfirmed(): boolean {
    return this.status === "confirmed";
  }

  get isPossible(): boolean {
    return this.status === "possible";
  }

  get isDuplicate(): boolean {
    return this.status !== "none";
  }

  /** Serializable for API responses and internal_notes */
  toJSON(): Record<string, unknown> {
    return {
      status: this.status,
      score: this.score,
      matchedAedId: this.matchedAedId,
      matchedBy: this.matchedBy,
      explanation: this.explanation?.toJSON(),
    };
  }

  /** Human-readable summary for logs */
  toLogString(): string {
    if (this.status === "none") return "No duplicate detected";

    const label = this.isConfirmed ? "CONFIRMED" : "POSSIBLE";
    const parts = [
      `[${label}] Score: ${this.score}, Matched: ${this.matchedAedId} by ${this.matchedBy}`,
    ];

    if (this.explanation) {
      parts.push(this.explanation.toSummary());
    }

    return parts.join("\n");
  }
}
