/**
 * PostgisScoringEngine — Compiles rules into dynamic SQL
 *
 * The key infrastructure piece: reads rules from the RuleRegistry,
 * generates SQL CASE fragments dynamically, and executes against PostGIS.
 *
 * After SQL execution, applies RuleInteractions in JS and builds
 * ScoringExplanation with full per-rule breakdown.
 *
 * SQL acts as a fast pre-filter; JS is the authoritative scorer.
 * The SQL threshold is set lower than the JS threshold to prevent
 * false negatives from JS/SQL scoring divergence.
 *
 * Based on scoring patterns from: PrismaDuplicateDetectionAdapter.ts
 */

import type { PrismaClient } from "@/generated/client/client";
import type { IScoringEngine, ScoringInput } from "../domain/ports/IScoringEngine";
import type { RuleRegistry } from "../domain/rules/RuleRegistry";
import type { NormalizedInput, CandidateRecord } from "../domain/rules/ScoringRule";
import { ScoringExplanation } from "../domain/value-objects/ScoringExplanation";
import { DetectionConfig } from "../domain/value-objects/DetectionConfig";

/**
 * SQL pre-filter margin: how many points below the JS threshold
 * the SQL WHERE should use, to avoid false negatives from JS/SQL divergence.
 *
 * Set to 50 because:
 * - Interactions can add up to +15 (addressVariant) that SQL doesn't compute
 * - JS trigram similarity may differ from pg_trgm by ~0.05
 * - Graduated proximity tiers assign different points than SQL might
 * - Cross-source data often has sparse fields, so SQL scoring underestimates
 *
 * With possible=45 and margin=50: sqlThreshold = max(0, 45-50) = 0
 * This means all candidates within the spatial search radius are evaluated.
 */
const SQL_THRESHOLD_MARGIN = 50;

/** Raw row from the scoring SQL query */
interface ScoredCandidate {
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
  distance_meters: number | null;
  name_similarity: number | null;
  sql_score: number;
}

export class PostgisScoringEngine implements IScoringEngine {
  constructor(private readonly prisma: PrismaClient) {}

  async scoreBatch(
    inputs: readonly ScoringInput[],
    registry: RuleRegistry
  ): Promise<ReadonlyMap<number, ScoringExplanation>> {
    if (inputs.length === 0) return new Map();

    const results = new Map<number, ScoringExplanation>();
    const { searchRadiusDegrees: radiusDegrees, srid } = DetectionConfig.spatial;
    const excludeStatuses = [...DetectionConfig.filters.excludeStatuses];

    // SQL pre-filter threshold — lower than JS to avoid false negatives
    const sqlThreshold = Math.max(0, DetectionConfig.thresholds.possible - SQL_THRESHOLD_MARGIN);

    // Process each input individually — each may use different strategy
    for (const { index, normalized } of inputs) {
      const candidates =
        normalized.latitude !== undefined && normalized.longitude !== undefined
          ? await this.queryByCoordinates(
              normalized,
              registry,
              radiusDegrees,
              srid,
              excludeStatuses,
              sqlThreshold
            )
          : normalized.postalCode
            ? await this.queryByPostalCode(normalized, registry, excludeStatuses, sqlThreshold)
            : [];

      if (candidates.length === 0) continue;

      // Take best candidate and build full explanation (rules + interactions)
      const best = candidates[0]; // already ordered by score DESC
      const candidateRecord = this.toCandidateRecord(best);
      const explanation = this.buildExplanation(normalized, candidateRecord, registry);

      // JS is the authoritative scorer — apply the real threshold here
      if (explanation.totalScore >= DetectionConfig.thresholds.possible) {
        results.set(index, explanation);
      }
    }

    return results;
  }

  /**
   * Spatial search with dynamic scoring SQL compiled from rules
   */
  private async queryByCoordinates(
    input: NormalizedInput,
    registry: RuleRegistry,
    radiusDegrees: number,
    srid: number,
    excludeStatuses: string[],
    sqlThreshold: number
  ): Promise<ScoredCandidate[]> {
    const { scoringExpression, params } = this.buildScoringSelect(registry, input);
    const baseParamIdx = params.length + 1;

    try {
      // Build raw SQL with dynamic scoring from rules
      const sql = `
        WITH scored_candidates AS (
          SELECT
            a.id,
            a.name,
            a.normalized_name,
            a.provisional_number,
            a.establishment_type,
            l.normalized_address,
            l.normalized_floor,
            l.normalized_location_details,
            l.normalized_access_instructions,
            a.latitude,
            a.longitude,
            l.postal_code,
            ST_Distance(
              a.geom::geography,
              ST_MakePoint($${baseParamIdx}::float8, $${baseParamIdx + 1}::float8)::geography
            ) AS distance_meters,
            similarity(a.normalized_name, $${baseParamIdx + 2}::text) AS name_similarity,
            (${scoringExpression}) AS sql_score
          FROM aeds a
          LEFT JOIN aed_locations l ON a.location_id = l.id
          WHERE
            a.geom IS NOT NULL
            AND a.status NOT IN (${excludeStatuses.map((_, i) => `$${baseParamIdx + 3 + i}`).join(", ")})
            AND ST_DWithin(
              a.geom,
              ST_SetSRID(ST_MakePoint($${baseParamIdx}::float8, $${baseParamIdx + 1}::float8), ${srid}),
              ${radiusDegrees}
            )
        )
        SELECT * FROM scored_candidates
        WHERE sql_score >= ${sqlThreshold}
        ORDER BY sql_score DESC
        LIMIT 5
      `;

      const allParams = [
        ...params,
        input.longitude,
        input.latitude,
        input.normalizedName,
        ...excludeStatuses,
      ];

      return await this.prisma.$queryRawUnsafe<ScoredCandidate[]>(sql, ...allParams);
    } catch (error) {
      // Log full error for debugging — surface misconfigurations
      console.error(
        "[PostgisScoringEngine] Spatial query failed. Ensure PostGIS and pg_trgm extensions are installed.",
        error
      );
      return [];
    }
  }

  /**
   * Postal code fallback search with dynamic scoring
   */
  private async queryByPostalCode(
    input: NormalizedInput,
    registry: RuleRegistry,
    excludeStatuses: string[],
    sqlThreshold: number
  ): Promise<ScoredCandidate[]> {
    if (!input.postalCode) return [];

    const { scoringExpression, params } = this.buildScoringSelect(registry, input);
    const baseParamIdx = params.length + 1;

    try {
      const sql = `
        WITH scored_candidates AS (
          SELECT
            a.id,
            a.name,
            a.normalized_name,
            a.provisional_number,
            a.establishment_type,
            l.normalized_address,
            l.normalized_floor,
            l.normalized_location_details,
            l.normalized_access_instructions,
            a.latitude,
            a.longitude,
            l.postal_code,
            NULL::float8 AS distance_meters,
            similarity(a.normalized_name, $${baseParamIdx}::text) AS name_similarity,
            (${scoringExpression}) AS sql_score
          FROM aeds a
          LEFT JOIN aed_locations l ON a.location_id = l.id
          WHERE
            l.postal_code = $${baseParamIdx + 1}
            AND a.status NOT IN (${excludeStatuses.map((_, i) => `$${baseParamIdx + 2 + i}`).join(", ")})
        )
        SELECT * FROM scored_candidates
        WHERE sql_score >= ${sqlThreshold}
        ORDER BY sql_score DESC
        LIMIT 5
      `;

      const allParams = [...params, input.normalizedName, input.postalCode, ...excludeStatuses];

      return await this.prisma.$queryRawUnsafe<ScoredCandidate[]>(sql, ...allParams);
    } catch (error) {
      console.error(
        "[PostgisScoringEngine] Postal code query failed. Ensure pg_trgm extension is installed.",
        error
      );
      return [];
    }
  }

  /**
   * Build dynamic scoring SQL expression from all rules in the registry.
   * Each rule contributes a SQL CASE fragment via toSqlCase().
   */
  private buildScoringSelect(
    registry: RuleRegistry,
    input: NormalizedInput
  ): { scoringExpression: string; params: unknown[] } {
    const rules = registry.getAll();
    const fragments: string[] = [];
    const allParams: unknown[] = [];
    let paramIdx = 1;

    for (const rule of rules) {
      const { sql, params, nextParamIndex } = rule.toSqlCase(input, paramIdx);
      fragments.push(sql);
      allParams.push(...params);
      paramIdx = nextParamIndex;
    }

    const scoringExpression = fragments.join(" +\n              ");
    return { scoringExpression, params: allParams };
  }

  /**
   * Post-query: build ScoringExplanation with JS evaluate/explain + interactions
   */
  private buildExplanation(
    input: NormalizedInput,
    candidate: CandidateRecord,
    registry: RuleRegistry
  ): ScoringExplanation {
    // Phase 1: Evaluate individual rules in JS
    const ruleResults = registry.getAll().map((rule) => rule.explain(input, candidate));
    const rulesScore = ruleResults.reduce((sum, r) => sum + r.points, 0);

    // Phase 2: Evaluate interactions based on rule results
    const interactionResults = registry
      .getAllInteractions()
      .map((interaction) => interaction.explain(ruleResults, input, candidate));
    const interactionsAdjustment = interactionResults.reduce((sum, i) => sum + i.adjustment, 0);

    // Final score = rules + interactions (clamped to 0 minimum)
    const totalScore = Math.max(0, rulesScore + interactionsAdjustment);

    return ScoringExplanation.create({
      totalScore,
      maxPossibleScore: registry.getMaxPossibleScore(),
      ruleResults,
      interactionResults,
      matchedAedId: candidate.id,
      matchedAedName: candidate.name,
      searchStrategy: input.latitude !== undefined ? "coordinates" : "postal_code",
      distanceMeters: candidate.distance_meters ?? undefined,
    });
  }

  /** Convert raw SQL row to CandidateRecord for JS evaluation */
  private toCandidateRecord(row: ScoredCandidate): CandidateRecord {
    return {
      id: row.id,
      name: row.name,
      normalized_name: row.normalized_name || "",
      normalized_address: row.normalized_address || "",
      normalized_floor: row.normalized_floor || "",
      normalized_location_details: row.normalized_location_details || "",
      normalized_access_instructions: row.normalized_access_instructions || "",
      latitude: row.latitude,
      longitude: row.longitude,
      postal_code: row.postal_code,
      provisional_number: row.provisional_number,
      establishment_type: row.establishment_type,
      distance_meters: row.distance_meters ?? undefined,
      name_similarity: row.name_similarity ?? undefined,
    };
  }
}
