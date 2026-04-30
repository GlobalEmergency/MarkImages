/**
 * PrismaIdentityMatcher — Batch identity cascade matching
 *
 * 3 parallel queries max for N records:
 * 1. findMany by IDs (IN clause)
 * 2. findMany by codes (IN clause, case-insensitive)
 * 3. findMany by external references (IN clause, case-insensitive)
 *
 * Cascade priority: ID > Code > ExternalReference
 * Filters: excludes REJECTED and INACTIVE statuses
 */

import type { PrismaClient } from "@/generated/client/client";
import type { AedStatus } from "@/generated/client/client";
import type { IIdentityMatcher, IdentityMatch } from "../domain/ports/IIdentityMatcher";
import type { DuplicateCriteria } from "../domain/value-objects/DuplicateCriteria";
import { DetectionConfig } from "../domain/value-objects/DetectionConfig";

export class PrismaIdentityMatcher implements IIdentityMatcher {
  constructor(private readonly prisma: PrismaClient) {}

  async matchBatch(
    criteriaList: readonly DuplicateCriteria[]
  ): Promise<ReadonlyMap<number, IdentityMatch>> {
    const result = new Map<number, IdentityMatch>();
    const excludeStatuses = [...DetectionConfig.filters.excludeStatuses] as AedStatus[];

    // Collect all identifiers with their indices
    const idEntries: { index: number; id: string }[] = [];
    const codeEntries: { index: number; code: string }[] = [];
    const refEntries: { index: number; ref: string }[] = [];

    for (let i = 0; i < criteriaList.length; i++) {
      const c = criteriaList[i];
      if (c.id) idEntries.push({ index: i, id: c.id });
      if (c.code) codeEntries.push({ index: i, code: c.code });
      if (c.externalReference) refEntries.push({ index: i, ref: c.externalReference });
    }

    // 3 parallel queries
    const [idMatches, codeMatches, refMatches] = await Promise.all([
      this.findByIds(
        idEntries.map((e) => e.id),
        excludeStatuses
      ),
      this.findByCodes(
        codeEntries.map((e) => e.code),
        excludeStatuses
      ),
      this.findByExternalRefs(
        refEntries.map((e) => e.ref),
        excludeStatuses
      ),
    ]);

    // Map back with cascade priority: ID > Code > ExtRef
    for (let i = 0; i < criteriaList.length; i++) {
      if (result.has(i)) continue;

      // Priority 1: ID
      const c = criteriaList[i];
      if (c.id) {
        const match = idMatches.get(c.id);
        if (match) {
          result.set(i, match);
          continue;
        }
      }

      // Priority 2: Code
      if (c.code) {
        const match = codeMatches.get(c.code.toLowerCase());
        if (match) {
          result.set(i, match);
          continue;
        }
      }

      // Priority 3: External Reference
      if (c.externalReference) {
        const match = refMatches.get(c.externalReference.toLowerCase());
        if (match) {
          result.set(i, match);
        }
      }
    }

    return result;
  }

  private async findByIds(
    ids: string[],
    excludeStatuses: AedStatus[]
  ): Promise<Map<string, IdentityMatch>> {
    const map = new Map<string, IdentityMatch>();
    if (ids.length === 0) return map;

    try {
      const aeds = await this.prisma.aed.findMany({
        where: {
          id: { in: ids },
          status: { notIn: excludeStatuses },
        },
        select: { id: true, code: true, external_reference: true },
      });

      for (const aed of aeds) {
        map.set(aed.id, {
          matchedAedId: aed.id,
          matchedBy: "id",
          matchedCode: aed.code,
          matchedExternalReference: aed.external_reference,
        });
      }
    } catch {
      // Invalid UUIDs cause Prisma to fail; silent fallback
    }

    return map;
  }

  private async findByCodes(
    codes: string[],
    excludeStatuses: AedStatus[]
  ): Promise<Map<string, IdentityMatch>> {
    const map = new Map<string, IdentityMatch>();
    if (codes.length === 0) return map;

    try {
      const aeds = await this.prisma.aed.findMany({
        where: {
          code: { in: codes, mode: "insensitive" },
          status: { notIn: excludeStatuses },
        },
        select: { id: true, code: true, external_reference: true },
      });

      for (const aed of aeds) {
        if (aed.code) {
          map.set(aed.code.toLowerCase(), {
            matchedAedId: aed.id,
            matchedBy: "code",
            matchedCode: aed.code,
            matchedExternalReference: aed.external_reference,
          });
        }
      }
    } catch {
      // DB errors (invalid values, constraint issues); silent fallback like findByIds
    }

    return map;
  }

  private async findByExternalRefs(
    refs: string[],
    excludeStatuses: AedStatus[]
  ): Promise<Map<string, IdentityMatch>> {
    const map = new Map<string, IdentityMatch>();
    if (refs.length === 0) return map;

    try {
      // Query 1: Search aeds.external_reference (primary field)
      const aeds = await this.prisma.aed.findMany({
        where: {
          external_reference: { in: refs, mode: "insensitive" },
          status: { notIn: excludeStatuses },
        },
        select: { id: true, code: true, external_reference: true },
      });

      for (const aed of aeds) {
        if (aed.external_reference) {
          map.set(aed.external_reference.toLowerCase(), {
            matchedAedId: aed.id,
            matchedBy: "externalReference",
            matchedCode: aed.code,
            matchedExternalReference: aed.external_reference,
          });
        }
      }

      // Query 2: Search aed_external_identifiers for refs not found in primary field.
      // This catches AEDs known by different identifiers across multiple data sources.
      const remainingRefs = refs.filter((r) => !map.has(r.toLowerCase()));
      if (remainingRefs.length > 0) {
        const identifierRows = await this.prisma.aedExternalIdentifier.findMany({
          where: {
            external_identifier: { in: remainingRefs, mode: "insensitive" },
            is_current_in_source: true,
            aed: { status: { notIn: excludeStatuses } },
          },
          select: {
            external_identifier: true,
            aed: { select: { id: true, code: true, external_reference: true } },
          },
        });

        for (const row of identifierRows) {
          const key = row.external_identifier.toLowerCase();
          if (!map.has(key)) {
            map.set(key, {
              matchedAedId: row.aed.id,
              matchedBy: "externalReference",
              matchedCode: row.aed.code,
              matchedExternalReference: row.aed.external_reference,
            });
          }
        }
      }
    } catch {
      // DB errors; silent fallback like findByIds
    }

    return map;
  }
}
