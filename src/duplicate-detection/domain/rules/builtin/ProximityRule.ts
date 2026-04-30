/**
 * ProximityRule — Graduated spatial proximity via PostGIS ST_Distance
 *
 * Awards points based on distance tiers: closer AEDs get more points.
 * This handles cross-source detection where coordinates may differ slightly
 * due to geocoding precision differences between data sources.
 *
 * Default tiers (configurable):
 *   < 5m  → 30pts (same device, coordinate rounding)
 *   < 15m → 25pts (same building, different geocoding)
 *   < 30m → 15pts (adjacent, likely same place)
 *   < 50m → 5pts  (nearby, weak signal)
 */

import type {
  ScoringRule,
  SqlFragment,
  NormalizedInput,
  CandidateRecord,
  RuleExplanation,
} from "../ScoringRule";

/** A distance tier: awards `points` when distance < `maxDistanceMeters` */
export interface ProximityTier {
  /** Upper bound in meters (exclusive) */
  readonly maxDistanceMeters: number;
  /** Points awarded within this tier */
  readonly points: number;
}

/** Default graduated tiers for AED duplicate detection */
const DEFAULT_TIERS: readonly ProximityTier[] = [
  { maxDistanceMeters: 5, points: 30 },
  { maxDistanceMeters: 15, points: 25 },
  { maxDistanceMeters: 30, points: 15 },
  { maxDistanceMeters: 50, points: 5 },
];

export class ProximityRule implements ScoringRule {
  readonly id = "proximity";
  readonly name = "Proximity";
  readonly description = "Graduated spatial proximity — more points for closer distance";
  readonly maxPoints: number;
  readonly category = "spatial" as const;

  /** Tiers sorted by ascending distance (closest first) */
  private readonly tiers: readonly ProximityTier[];

  constructor(tiers: readonly ProximityTier[] = DEFAULT_TIERS) {
    // Ensure tiers are sorted by distance ascending
    this.tiers = [...tiers].sort((a, b) => a.maxDistanceMeters - b.maxDistanceMeters);
    this.maxPoints = Math.max(0, ...tiers.map((t) => t.points));
  }

  toSqlCase(input: NormalizedInput, paramIndex: number): SqlFragment {
    if (!Number.isFinite(input.longitude) || !Number.isFinite(input.latitude)) {
      return { sql: "0", params: [], nextParamIndex: paramIndex };
    }

    const distExpr =
      `ST_Distance(a.geom::geography, ` +
      `ST_MakePoint($${paramIndex}::float8, $${paramIndex + 1}::float8)::geography)`;

    const whenClauses = this.tiers
      .map((tier) => `WHEN ${distExpr} < ${tier.maxDistanceMeters} THEN ${tier.points}`)
      .join("\n                 ");

    return {
      sql: `(CASE ${whenClauses}
                 ELSE 0 END)`,
      params: [input.longitude, input.latitude],
      nextParamIndex: paramIndex + 2,
    };
  }

  evaluate(input: NormalizedInput, candidate: CandidateRecord): number {
    const distance = candidate.distance_meters;
    if (!Number.isFinite(distance) || distance! < 0) return 0;

    for (const tier of this.tiers) {
      if (distance! < tier.maxDistanceMeters) return tier.points;
    }
    return 0;
  }

  explain(input: NormalizedInput, candidate: CandidateRecord): RuleExplanation {
    const distance = candidate.distance_meters;
    const hasDistance = Number.isFinite(distance) && distance! >= 0;
    const hasCoords = Number.isFinite(input.latitude) && Number.isFinite(input.longitude);

    let points = 0;
    let matched = false;
    let tierLabel = "";

    if (hasDistance) {
      for (const tier of this.tiers) {
        if (distance! < tier.maxDistanceMeters) {
          points = tier.points;
          matched = true;
          tierLabel = `< ${tier.maxDistanceMeters}m`;
          break;
        }
      }
    }

    const outerThreshold = this.tiers[this.tiers.length - 1]?.maxDistanceMeters ?? 0;

    return {
      ruleId: this.id,
      ruleName: this.name,
      points,
      maxPoints: this.maxPoints,
      matched,
      reason: !hasDistance
        ? "No distance data available → 0pts"
        : matched
          ? `Distance ${distance!.toFixed(1)}m (${tierLabel}) → +${points}pts`
          : `Distance ${distance!.toFixed(1)}m >= ${outerThreshold}m → 0pts`,
      inputValue: hasCoords ? `(${input.latitude}, ${input.longitude})` : "(no coords)",
      candidateValue: hasDistance ? `${distance!.toFixed(1)}m away` : "(no distance)",
    };
  }
}
