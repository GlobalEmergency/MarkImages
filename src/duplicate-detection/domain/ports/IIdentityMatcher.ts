/**
 * IIdentityMatcher — Port for exact identity matching
 *
 * Batch-optimized: 3 queries max for N records (by ID, code, external reference).
 * Cascade priority: ID > Code > ExternalReference.
 */

import type { DuplicateCriteria } from "../value-objects/DuplicateCriteria";

export interface IdentityMatch {
  matchedAedId: string;
  matchedBy: "id" | "code" | "externalReference";
  matchedCode?: string | null;
  matchedExternalReference?: string | null;
}

export interface IIdentityMatcher {
  /**
   * Batch identity matching.
   * Returns a Map from criteriaList index → IdentityMatch for matches found.
   */
  matchBatch(
    criteriaList: readonly DuplicateCriteria[]
  ): Promise<ReadonlyMap<number, IdentityMatch>>;
}
