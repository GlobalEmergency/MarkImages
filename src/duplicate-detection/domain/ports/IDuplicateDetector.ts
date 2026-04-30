/**
 * IDuplicateDetector — Main port for duplicate detection
 *
 * Orchestrates identity matching + scoring engine.
 * Consumed by: API routes, CSV imports, external sync.
 */

import type { DuplicateCriteria } from "../value-objects/DuplicateCriteria";
import type { DetectionResult } from "../value-objects/DetectionResult";

export interface IDuplicateDetector {
  /** Check a single record (API routes, forms) */
  check(criteria: DuplicateCriteria): Promise<DetectionResult>;

  /** Batch-optimized: N records with minimal DB queries (imports, sync) */
  checkBatch(criteriaList: readonly DuplicateCriteria[]): Promise<readonly DetectionResult[]>;
}
