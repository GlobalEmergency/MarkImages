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
  private allAeds: ExistingAedRow[] = [];
  private loaded = false;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly dataSourceId: string
  ) {}

  async ensureLoaded(): Promise<void> {
    if (this.loaded) return;

    // Load all AEDs owned by this data source (by external_reference index)
    const owned = await this.prisma.aed.findMany({
      where: { data_source_id: this.dataSourceId },
      select: AED_SELECT,
    });

    for (const aed of owned) {
      if (aed.external_reference) {
        this.byExternalRef.set(aed.external_reference, aed);
      }
    }
    this.allAeds = owned;
    this.loaded = true;

    console.log(
      `[SyncHooks] Pre-loaded ${owned.length} existing AEDs for data source ${this.dataSourceId} ` +
        `(${this.byExternalRef.size} with external_reference)`
    );
  }

  findByExternalRef(ref: string): ExistingAedRow | undefined {
    return this.byExternalRef.get(ref);
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

  /** Release cached data to free memory after job completes */
  clear(): void {
    this.byExternalRef.clear();
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
      const externalId = record.externalId as string | null;
      let existingAed: ExistingAedRow | undefined;

      // Strategy 1: by external reference
      if (externalId) {
        existingAed = cache.findByExternalRef(externalId);
      }

      // Strategy 2: by coordinates (fallback)
      if (!existingAed) {
        const latStr = record.latitude as string | null;
        const lngStr = record.longitude as string | null;
        if (latStr && lngStr) {
          const lat = parseFloat(String(latStr).replace(",", "."));
          const lng = parseFloat(String(lngStr).replace(",", "."));
          if (!isNaN(lat) && !isNaN(lng)) {
            existingAed = cache.findByCoordinates(lat, lng);
          }
        }
      }

      // Attach to record for processor
      if (existingAed) {
        return { ...record, _existingAed: existingAed };
      }

      return record;
    },

    afterProcess: async (_record: ProcessedRecord, _context: HookContext): Promise<void> => {
      // Future: geocoding enrichment, metrics collection
    },
  };

  return { hooks, clearCache: () => cache.clear() };
}
