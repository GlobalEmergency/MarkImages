/**
 * Sync Hooks — @batchactions/core JobHooks
 *
 * Lifecycle hooks for external sync processing.
 * The key optimization is the beforeProcess hook that pre-loads
 * existing AEDs for the data source, eliminating N+1 queries.
 *
 * Pipeline:
 * 1. beforeProcess: Look up existing AED by external_reference or coordinates
 *    and attach as _existingAed on the record
 * 2. processor: createAed() or updateAed() based on _existingAed
 * 3. afterProcess: (future) geocoding enrichment, metrics
 *
 * Loading strategy:
 * - On first record, load ALL AEDs for the data source (external_reference index)
 * - Store in a Map for O(1) lookup per record
 * - Coordinate proximity fallback uses linear scan on cached AEDs
 */

import type { ParsedRecord, ProcessedRecord, JobHooks, HookContext } from "@batchactions/core";
import type { PrismaClient } from "@/generated/client/client";
import { getDuplicateDetector } from "@/duplicate-detection/infrastructure/factory";
import { DuplicateCriteria } from "@/duplicate-detection/domain/value-objects/DuplicateCriteria";
import { createHash } from "crypto";

// ============================================================
// Synthetic external ID
// ============================================================

/**
 * Generate a deterministic synthetic externalId for records that don't have one.
 * Uses sha256(normalized_name + ":" + lat_6dp + ":" + lng_6dp) truncated to 16 chars.
 * Prefixed with "syn:" to distinguish from real external IDs.
 *
 * This ensures:
 * - Same record in subsequent syncs → same synthetic ID → matches existing AED
 * - Reviewer decisions (duplicate/not duplicate) are preserved across re-imports
 * - Two DEAs at the same location with different names get different IDs
 */
function generateSyntheticExternalId(
  name: string | null | undefined,
  lat: number,
  lng: number
): string {
  const normalizedName = (name || "").toLowerCase().trim().replace(/\s+/g, " ");
  const latRounded = lat.toFixed(6);
  const lngRounded = lng.toFixed(6);
  const hash = createHash("sha256")
    .update(`${normalizedName}:${latRounded}:${lngRounded}`)
    .digest("hex")
    .substring(0, 16);
  return `syn:${hash}`;
}

// ============================================================
// Types
// ============================================================

export interface SyncHooksOptions {
  prisma: PrismaClient;
  /** Data source ID — used to pre-load all existing AEDs for this source */
  dataSourceId: string;
}

// ============================================================
// Pre-loaded AED cache
// ============================================================

const AED_SELECT = {
  id: true,
  location_id: true,
  schedule_id: true,
  responsible_id: true,
  last_verified_at: true,
  name: true,
  code: true,
  establishment_type: true,
  external_reference: true,
  data_source_id: true,
  source_origin: true,
  internal_notes: true,
  latitude: true,
  longitude: true,
} as const;

/**
 * Cache of existing AEDs for a data source, loaded once per job.
 *
 * Eliminates N+1 queries: instead of 1 query per record, we load
 * all AEDs for the data source in a single query on first access.
 */
class AedLookupCache {
  private byExternalRef = new Map<string, ExistingAedRow>();
  private byIdentifier = new Map<string, ExistingAedRow>();
  private allAeds: ExistingAedRow[] = [];
  private loaded = false;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly dataSourceId: string
  ) {}

  async ensureLoaded(): Promise<void> {
    if (this.loaded) return;

    // Load all AEDs owned by this data source (by external_reference index).
    // Exclude REJECTED/INACTIVE — these should not block new entries.
    const owned = await this.prisma.aed.findMany({
      where: {
        data_source_id: this.dataSourceId,
        status: { notIn: ["REJECTED", "INACTIVE"] },
      },
      select: AED_SELECT,
    });

    for (const aed of owned) {
      if (aed.external_reference) {
        this.byExternalRef.set(aed.external_reference, aed);
      }
    }
    this.allAeds = owned;

    // Also load external identifiers registered for this data source.
    // This catches identifiers where the AED's primary data_source_id may differ
    // (cross-source matches that were previously linked via aed_external_identifiers).
    try {
      const identifiers = await this.prisma.$queryRaw<
        Array<{ external_identifier: string; aed_id: string }>
      >`
        SELECT ei.external_identifier, ei.aed_id
        FROM aed_external_identifiers ei
        WHERE ei.data_source_id = ${this.dataSourceId}::uuid
          AND ei.is_current_in_source = true
      `;

      // Load AEDs not already in cache
      const cachedIds = new Set(this.allAeds.map((a) => a.id));
      const missingAedIds = [
        ...new Set(identifiers.filter((ei) => !cachedIds.has(ei.aed_id)).map((ei) => ei.aed_id)),
      ];

      if (missingAedIds.length > 0) {
        const additionalAeds = await this.prisma.aed.findMany({
          where: {
            id: { in: missingAedIds },
            status: { notIn: ["REJECTED", "INACTIVE"] },
          },
          select: AED_SELECT,
        });
        for (const aed of additionalAeds) {
          this.allAeds.push(aed);
          cachedIds.add(aed.id);
        }
      }

      // Build identifier lookup map
      for (const ei of identifiers) {
        const aed = this.allAeds.find((a) => a.id === ei.aed_id);
        if (aed) {
          this.byIdentifier.set(ei.external_identifier, aed);
        }
      }
    } catch (error) {
      console.warn(
        `[SyncHooks] Failed to load external identifiers (non-critical):`,
        error instanceof Error ? error.message : error
      );
    }

    this.loaded = true;

    console.log(
      `[SyncHooks] Pre-loaded ${owned.length} existing AEDs for data source ${this.dataSourceId} ` +
        `(${this.byExternalRef.size} with external_reference, ${this.byIdentifier.size} from identifiers table)`
    );
  }

  findByExternalRef(ref: string): ExistingAedRow | undefined {
    // Check primary external_reference on AEDs owned by this source
    const primary = this.byExternalRef.get(ref);
    if (primary) return primary;
    // Fall back to aed_external_identifiers for this data source
    return this.byIdentifier.get(ref);
  }

  findByCoordinates(lat: number, lng: number): ExistingAedRow | undefined {
    const TOLERANCE = 0.0001;
    return this.allAeds.find((aed) => {
      if (aed.latitude == null || aed.longitude == null) return false;
      const latNum =
        typeof aed.latitude === "number" ? aed.latitude : parseFloat(String(aed.latitude));
      const lngNum =
        typeof aed.longitude === "number" ? aed.longitude : parseFloat(String(aed.longitude));
      return Math.abs(latNum - lat) <= TOLERANCE && Math.abs(lngNum - lng) <= TOLERANCE;
    });
  }

  /**
   * Cross-source duplicate detection via the full scoring engine.
   * Only called when cache (same data source) finds no match.
   * Uses the rules engine (PostGIS + pg_trgm + scoring) for accurate dedup.
   */
  async findByGlobalDuplicateDetector(
    record: ParsedRecord,
    lat: number,
    lng: number
  ): Promise<ExistingAedRow | undefined> {
    try {
      const detector = getDuplicateDetector();
      // Cross-source detection: do NOT pass externalReference because
      // external IDs are scoped to each data source and collide across
      // registries (e.g. codigo_dea "1000" in Euskadi vs external_reference
      // "1000" in Madrid). Only spatial + name + address matching is reliable.
      const criteria = DuplicateCriteria.create({
        name: record.name as string | undefined,
        latitude: lat,
        longitude: lng,
        postalCode: record.postalCode as string | undefined,
        establishmentType: record.establishmentType as string | undefined,
        streetType: record.streetType as string | undefined,
        streetName: record.streetName as string | undefined,
        streetNumber: record.streetNumber as string | undefined,
        floor: record.floor as string | undefined,
        locationDetails: record.specificLocation as string | undefined,
      });
      const result = await detector.check(criteria);

      if (!result.isDuplicate || !result.matchedAedId) return undefined;

      // Fetch the matched AED to return as ExistingAedRow
      const match = await this.prisma.aed.findUnique({
        where: { id: result.matchedAedId },
        select: AED_SELECT,
      });
      return match ?? undefined;
    } catch (error) {
      console.error(
        `[SyncHooks] Cross-source duplicate detection failed for "${record.name}":`,
        error instanceof Error ? error.message : error
      );
      return undefined;
    }
  }

  /**
   * Register a newly created AED in the cache so subsequent records
   * in the same chunk won't create duplicates.
   */
  registerCreated(aed: ExistingAedRow): void {
    if (aed.external_reference) {
      this.byExternalRef.set(aed.external_reference, aed);
      this.byIdentifier.set(aed.external_reference, aed);
    }
    this.allAeds.push(aed);
  }

  /** Release cached data to free memory after job completes */
  clear(): void {
    this.byExternalRef.clear();
    this.byIdentifier.clear();
    this.allAeds = [];
    this.loaded = false;
  }
}

export interface ExistingAedRow {
  id: string;
  location_id: string;
  schedule_id: string | null;
  responsible_id: string | null;
  last_verified_at: Date | null;
  name: string;
  code: string | null;
  establishment_type: string | null;
  external_reference: string | null;
  data_source_id: string | null;
  source_origin: string;
  internal_notes: unknown;
  latitude: unknown;
  longitude: unknown;
}

// ============================================================
// Factory
// ============================================================

export interface SyncHooksResult {
  hooks: JobHooks;
  /** Release cached AED data to free memory after job completes */
  clearCache: () => void;
}

/**
 * Creates lifecycle hooks for external sync processing.
 *
 * The critical hook is beforeProcess which attaches _existingAed
 * to each record, enabling the processor to determine create vs update
 * without additional queries.
 *
 * All AEDs for the data source are loaded once on first record,
 * then looked up via O(1) Map access per record.
 *
 * Call `clearCache()` after job completes to release memory.
 */
export function createSyncHooks(options: SyncHooksOptions): SyncHooksResult {
  const { prisma, dataSourceId } = options;
  const cache = new AedLookupCache(prisma, dataSourceId);

  const hooks: JobHooks = {
    beforeProcess: async (record: ParsedRecord, _context: HookContext): Promise<ParsedRecord> => {
      // Load cache on first call (idempotent)
      await cache.ensureLoaded();

      // Look up existing AED
      let externalId = record.externalId as string | null;
      let existingAed: ExistingAedRow | undefined;

      // Parse coordinates early — needed for synthetic ID and spatial matching
      const latStr = record.latitude as string | null;
      const lngStr = record.longitude as string | null;
      const lat = latStr ? parseFloat(String(latStr).replace(",", ".")) : NaN;
      const lng = lngStr ? parseFloat(String(lngStr).replace(",", ".")) : NaN;
      const hasCoords = !isNaN(lat) && !isNaN(lng);

      // Generate synthetic externalId when source doesn't provide one.
      // This makes records without externalId trackable across re-imports
      // and preserves reviewer decisions (duplicate/not duplicate).
      if (!externalId && hasCoords) {
        const syntheticId = generateSyntheticExternalId(record.name as string | null, lat, lng);
        externalId = syntheticId;
        record = { ...record, externalId: syntheticId };
        console.log(
          `[SyncHooks] Generated synthetic ID: ${syntheticId} for "${record.name || "?"}"`
        );
      }

      // Strategy 1: by external reference (includes synthetic IDs)
      if (externalId) {
        existingAed = cache.findByExternalRef(externalId);
        if (existingAed)
          (existingAed as ExistingAedRow & { _matchReason?: string })._matchReason =
            "external_reference";
      }

      // Strategy 2 & 3: coordinate / duplicate-detector matching
      // Only runs if Strategy 1 didn't find a match.
      // With synthetic IDs, same-source records always match by Strategy 1 on re-imports.
      // These strategies catch cross-source duplicates for manual review.
      if (!existingAed && hasCoords) {
        // Strategy 2: coordinate match within same data source cache
        const coordMatch = cache.findByCoordinates(lat, lng);

        if (coordMatch) {
          // Same coords but different externalIds (real or synthetic) → distinct devices
          if (
            externalId &&
            coordMatch.external_reference &&
            coordMatch.external_reference !== externalId &&
            coordMatch.data_source_id === dataSourceId
          ) {
            console.log(
              `[SyncHooks] Same-source, same coords, different IDs — distinct devices: ` +
                `"${record.name}" (${externalId}) vs "${coordMatch.name}" (${coordMatch.external_reference})`
            );
          } else if (!externalId) {
            // No coords + no externalId → flag as suspected duplicate
            console.log(
              `[SyncHooks] Suspected duplicate (coords, no ID): ` +
                `"${record.name || "?"}" near "${coordMatch.name}" (${coordMatch.id})`
            );
            return {
              ...record,
              _suspectedDuplicate: {
                matchedAedId: coordMatch.id,
                matchedAedName: coordMatch.name,
                matchReason: "coordinates",
              },
            };
          }
        }

        // Strategy 3: cross-source dedup via scoring engine (PostGIS + pg_trgm)
        if (!existingAed) {
          const globalMatch = await cache.findByGlobalDuplicateDetector(record, lat, lng);
          if (globalMatch) {
            // Cross-source match → always flag for manual review, never auto-merge
            const isCrossSource = !!(
              globalMatch.data_source_id && globalMatch.data_source_id !== dataSourceId
            );
            if (isCrossSource) {
              existingAed = globalMatch;
              (existingAed as ExistingAedRow & { _matchReason?: string })._matchReason =
                "duplicate_detector";
            } else {
              console.log(
                `[SyncHooks] Suspected duplicate (detector): ` +
                  `"${record.name || "?"}" near "${globalMatch.name}" (${globalMatch.id})`
              );
              return {
                ...record,
                _suspectedDuplicate: {
                  matchedAedId: globalMatch.id,
                  matchedAedName: globalMatch.name,
                  matchReason: "duplicate_detector",
                },
              };
            }
          }
        }
      }

      // Attach to record for processor
      if (existingAed) {
        // Log the match reason for debugging
        const matchReason =
          (existingAed as ExistingAedRow & { _matchReason?: string })._matchReason || "unknown";
        const isCrossSource = !!(
          existingAed.data_source_id && existingAed.data_source_id !== dataSourceId
        );
        console.log(
          `[SyncHooks] Match: "${record.name || record.externalId}" → AED ${existingAed.id} ` +
            `(${existingAed.name}) via ${matchReason}${isCrossSource ? " [CROSS-SOURCE]" : ""}`
        );
        return { ...record, _existingAed: existingAed };
      }

      return record;
    },

    afterProcess: async (record: ProcessedRecord, _context: HookContext): Promise<void> => {
      // Register newly created AEDs in the cache to prevent intra-chunk duplicates.
      // If the record didn't have _existingAed, it was a create — register it.
      const data = record as unknown as Record<string, unknown>;
      if (!data._existingAed && data.externalId) {
        const externalId = String(data.externalId);
        const createdId = data._createdAedId ? String(data._createdAedId) : "";
        const lat = data.latitude ? parseFloat(String(data.latitude).replace(",", ".")) : null;
        const lng = data.longitude ? parseFloat(String(data.longitude).replace(",", ".")) : null;
        // Register with actual created ID (stashed by processor) for cache integrity
        cache.registerCreated({
          id: createdId,
          location_id: "",
          schedule_id: null,
          responsible_id: null,
          last_verified_at: null,
          name: String(data.name || ""),
          code: null,
          establishment_type: null,
          external_reference: externalId,
          data_source_id: dataSourceId,
          source_origin: "",
          internal_notes: null,
          latitude: lat,
          longitude: lng,
        });
      }
    },
  };

  return { hooks, clearCache: () => cache.clear() };
}
