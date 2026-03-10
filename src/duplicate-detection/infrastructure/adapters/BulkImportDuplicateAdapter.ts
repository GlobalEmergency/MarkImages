/**
 * BulkImportDuplicateAdapter — Bridges IDuplicateDetector with @batchactions/import
 *
 * Thin adapter that maps:
 *   DuplicateChecker (from @batchactions/import)
 *     → IDuplicateDetector (our domain port)
 *
 * Converts raw field maps from the import pipeline into DuplicateCriteria,
 * delegates to the detector, and maps results back to DuplicateCheckResult.
 */

import type {
  DuplicateChecker,
  DuplicateCheckResult as BulkImportDuplicateResult,
} from "@batchactions/import";
import type { ProcessingContext } from "@batchactions/core";
import type { IDuplicateDetector } from "../../domain/ports/IDuplicateDetector";
import { DuplicateCriteria } from "../../domain/value-objects/DuplicateCriteria";
import type { DetectionResult } from "../../domain/value-objects/DetectionResult";

export interface BulkImportDuplicateAdapterOptions {
  /**
   * If true, duplicates are reported as warnings (don't block the record).
   * If false, duplicates are reported as errors (block the record).
   */
  skipDuplicates: boolean;
}

export class BulkImportDuplicateAdapter implements DuplicateChecker {
  constructor(
    private readonly detector: IDuplicateDetector,
    private readonly options: BulkImportDuplicateAdapterOptions
  ) {}

  /** Single-record check — delegates to detector.check() */
  async check(
    fields: Record<string, unknown>,
    _context: ProcessingContext
  ): Promise<BulkImportDuplicateResult> {
    const criteria = this.fieldsToCriteria(fields);
    const result = await this.detector.check(criteria);
    return this.mapResult(result);
  }

  /** Batch-optimized check — delegates to detector.checkBatch() */
  async checkBatch(
    records: readonly { fields: Record<string, unknown>; context: ProcessingContext }[]
  ): Promise<readonly BulkImportDuplicateResult[]> {
    const criteriaList = records.map((r) => this.fieldsToCriteria(r.fields));
    const results = await this.detector.checkBatch(criteriaList);
    return results.map((r) => this.mapResult(r));
  }

  /**
   * Convert raw import fields → DuplicateCriteria.
   * Field names follow the import schema (camelCase validated fields).
   */
  private fieldsToCriteria(fields: Record<string, unknown>): DuplicateCriteria {
    return DuplicateCriteria.create({
      id: this.str(fields, "id"),
      code: this.str(fields, "code"),
      externalReference: this.str(fields, "externalReference"),
      name: this.str(fields, "name"),
      latitude: this.num(fields, "latitude"),
      longitude: this.num(fields, "longitude"),
      streetType: this.str(fields, "streetType"),
      streetName: this.str(fields, "streetName"),
      streetNumber: this.str(fields, "streetNumber"),
      postalCode: this.str(fields, "postalCode"),
      floor: this.str(fields, "floor"),
      locationDetails: this.str(fields, "locationDetails"),
      accessInstructions: this.str(fields, "accessInstructions"),
      provisionalNumber: this.num(fields, "provisionalNumber"),
      establishmentType: this.str(fields, "establishmentType"),
    });
  }

  /** Map DetectionResult → DuplicateCheckResult (the @batchactions interface) */
  private mapResult(result: DetectionResult): BulkImportDuplicateResult {
    if (!result.isDuplicate) {
      return { isDuplicate: false };
    }

    return {
      isDuplicate: true,
      existingId: result.matchedAedId,
      metadata: {
        matchedBy: result.matchedBy,
        score: result.score,
        status: result.status,
        explanation: result.explanation?.toJSON(),
        skipDuplicates: this.options.skipDuplicates,
      },
    };
  }

  /** Extract a trimmed string from fields, or undefined */
  private str(fields: Record<string, unknown>, key: string): string | undefined {
    const value = fields[key];
    if (value === null || value === undefined) return undefined;
    const trimmed = String(value).trim();
    return trimmed || undefined;
  }

  /** Extract a finite number from fields, or undefined (rejects NaN, Infinity, -Infinity) */
  private num(fields: Record<string, unknown>, key: string): number | undefined {
    const value = fields[key];
    if (value === null || value === undefined) return undefined;
    const num = typeof value === "number" ? value : parseFloat(String(value));
    return Number.isFinite(num) ? num : undefined;
  }
}
