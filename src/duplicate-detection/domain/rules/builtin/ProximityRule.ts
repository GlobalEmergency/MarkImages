/**
 * ProximityRule — Spatial proximity via PostGIS ST_Distance
 *
 * Awards points when the candidate is within a configurable
 * distance threshold (default: 5 meters).
 */

import type {
  ScoringRule,
  SqlFragment,
  NormalizedInput,
  CandidateRecord,
  RuleExplanation,
} from "../ScoringRule";

export class ProximityRule implements ScoringRule {
  readonly id = "proximity";
  readonly name = "Proximity";
  readonly description = "Spatial proximity — awards points when within distance threshold";
  readonly maxPoints = 20;
  readonly category = "spatial" as const;

  constructor(private readonly thresholdMeters: number = 5) {}

  toSqlCase(input: NormalizedInput, paramIndex: number): SqlFragment {
    // Use explicit null/undefined checks — coordinate 0 is valid (equator/prime meridian)
    if (
      input.longitude === undefined ||
      input.longitude === null ||
      input.latitude === undefined ||
      input.latitude === null
    ) {
      return { sql: "0", params: [], nextParamIndex: paramIndex };
    }
    return {
      sql: `(CASE WHEN ST_Distance(
                    a.geom::geography,
                    ST_MakePoint($${paramIndex}::float8, $${paramIndex + 1}::float8)::geography
                  ) < ${this.thresholdMeters}
               THEN ${this.maxPoints} ELSE 0 END)`,
      params: [input.longitude, input.latitude],
      nextParamIndex: paramIndex + 2,
    };
  }

  evaluate(input: NormalizedInput, candidate: CandidateRecord): number {
    const distance = candidate.distance_meters;
    if (distance === undefined || distance === null) return 0;
    return distance < this.thresholdMeters ? this.maxPoints : 0;
  }

  explain(input: NormalizedInput, candidate: CandidateRecord): RuleExplanation {
    const distance = candidate.distance_meters;
    const hasDistance = distance !== undefined && distance !== null;
    const matched = hasDistance && distance < this.thresholdMeters;
    const hasCoords =
      input.latitude !== undefined &&
      input.latitude !== null &&
      input.longitude !== undefined &&
      input.longitude !== null;
    return {
      ruleId: this.id,
      ruleName: this.name,
      points: matched ? this.maxPoints : 0,
      maxPoints: this.maxPoints,
      matched,
      reason: !hasDistance
        ? "No distance data available → 0pts"
        : matched
          ? `Distance ${distance.toFixed(1)}m < ${this.thresholdMeters}m threshold → +${this.maxPoints}pts`
          : `Distance ${distance.toFixed(1)}m >= ${this.thresholdMeters}m threshold → 0pts`,
      inputValue: hasCoords ? `(${input.latitude}, ${input.longitude})` : "(no coords)",
      candidateValue: hasDistance ? `${distance.toFixed(1)}m away` : "(no distance)",
    };
  }
}
