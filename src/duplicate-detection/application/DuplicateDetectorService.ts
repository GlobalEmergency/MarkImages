/**
 * DuplicateDetectorService — Application service (orchestrator)
 *
 * Orchestrates the two-phase duplicate detection:
 *   Phase 1: Identity cascade (ID → Code → ExternalRef)
 *   Phase 2: Fuzzy/spatial scoring via rules engine
 *
 * Each phase is delegated to an infrastructure port, keeping
 * this service free of DB or framework dependencies.
 */

import type { IDuplicateDetector } from "../domain/ports/IDuplicateDetector";
import type { IIdentityMatcher } from "../domain/ports/IIdentityMatcher";
import type { IScoringEngine, ScoringInput } from "../domain/ports/IScoringEngine";
import type { ITextNormalizationService } from "../domain/ports/ITextNormalizationService";
import type { RuleRegistry } from "../domain/rules/RuleRegistry";
import type { NormalizedInput } from "../domain/rules/ScoringRule";
import type { DuplicateEventBus } from "../domain/events/DuplicateEvents";
import { DuplicateCriteria } from "../domain/value-objects/DuplicateCriteria";
import { DetectionResult } from "../domain/value-objects/DetectionResult";
import { DetectionConfig } from "../domain/value-objects/DetectionConfig";

export class DuplicateDetectorService implements IDuplicateDetector {
  constructor(
    private readonly identityMatcher: IIdentityMatcher,
    private readonly scoringEngine: IScoringEngine,
    private readonly textNormalizer: ITextNormalizationService,
    private readonly ruleRegistry: RuleRegistry,
    private readonly eventBus: DuplicateEventBus
  ) {}

  /** Single-record convenience method */
  async check(criteria: DuplicateCriteria): Promise<DetectionResult> {
    const results = await this.checkBatch([criteria]);
    // Defensive: checkBatch always returns one result per input,
    // but guard against undefined to avoid runtime surprises.
    return results[0] ?? DetectionResult.none();
  }

  /**
   * Batch-optimized duplicate detection for N records.
   *
   * Phase 1: Identity cascade (3 batch queries max)
   *   → matches by ID, code, or externalReference win immediately (score=100)
   *
   * Phase 2: Scoring engine (only records without identity match + spatial data)
   *   → dynamic SQL from rules engine → ScoringExplanation with per-rule breakdown
   *
   * Merge: identity wins → then scoring → then none
   */
  async checkBatch(
    criteriaList: readonly DuplicateCriteria[]
  ): Promise<readonly DetectionResult[]> {
    if (criteriaList.length === 0) return [];

    // Phase 1: Identity cascade (batch, 3 queries max)
    const identityMatches = await this.identityMatcher.matchBatch(criteriaList);

    // Phase 2: Scoring engine — only for records without identity match
    // AND that have spatial or postal code data for searching
    const scoringInputs: ScoringInput[] = [];
    for (let i = 0; i < criteriaList.length; i++) {
      if (identityMatches.has(i)) continue;

      const criteria = criteriaList[i];
      if (!criteria.hasSpatialFields && !criteria.hasPostalCode) continue;

      scoringInputs.push({
        index: i,
        normalized: this.normalize(criteria),
      });
    }

    const scoringResults =
      scoringInputs.length > 0
        ? await this.scoringEngine.scoreBatch(scoringInputs, this.ruleRegistry)
        : new Map<number, never>();

    // Merge results: identity → scoring → none
    const results = criteriaList.map((criteria, i) => {
      // Identity match wins
      const identity = identityMatches.get(i);
      if (identity) {
        return DetectionResult.confirmedByIdentity(identity.matchedAedId, identity.matchedBy);
      }

      // Scoring result
      const explanation = scoringResults.get(i);
      if (explanation) {
        if (explanation.totalScore >= DetectionConfig.thresholds.confirmed) {
          return DetectionResult.confirmedByScoring(explanation.matchedAedId!, explanation);
        }
        if (explanation.totalScore >= DetectionConfig.thresholds.possible) {
          return DetectionResult.possible(explanation.matchedAedId!, explanation);
        }
      }

      // No duplicate
      return DetectionResult.none();
    });

    // Emit domain events for detected duplicates (fire-and-forget)
    this.emitEvents(criteriaList, results);

    return results;
  }

  /**
   * Normalize a DuplicateCriteria into NormalizedInput for rule evaluation.
   * Uses the injected ITextNormalizationService to match PostgreSQL normalization.
   */
  private normalize(criteria: DuplicateCriteria): NormalizedInput {
    return {
      name: criteria.name,
      normalizedName: this.textNormalizer.normalize(criteria.name),
      normalizedAddress: this.textNormalizer.normalizeAddress(
        criteria.streetType,
        criteria.streetName,
        criteria.streetNumber
      ),
      normalizedFloor: this.textNormalizer.normalize(criteria.floor),
      normalizedLocationDetails: this.textNormalizer.normalize(criteria.locationDetails),
      normalizedAccessInstructions: this.textNormalizer.normalize(criteria.accessInstructions),
      latitude: criteria.latitude,
      longitude: criteria.longitude,
      postalCode: criteria.postalCode,
      provisionalNumber: criteria.provisionalNumber,
      establishmentType: criteria.establishmentType,
    };
  }

  /**
   * Emit domain events for all detected duplicates.
   * Non-blocking: errors in handlers don't propagate to callers.
   */
  private emitEvents(
    criteriaList: readonly DuplicateCriteria[],
    results: readonly DetectionResult[]
  ): void {
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (!result.isDuplicate) continue;

      // Fire and forget — don't await, don't block the caller
      void this.eventBus.emit({
        type: result.isConfirmed ? "duplicate.confirmed" : "duplicate.possible",
        timestamp: new Date(),
        criteria: criteriaList[i],
        result,
      });
    }
  }
}
