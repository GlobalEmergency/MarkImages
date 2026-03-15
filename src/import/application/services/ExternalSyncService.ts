/**
 * External Sync Service — Application Service
 *
 * Orchestrates external data source synchronization using BatchEngine
 * from @batchactions/core. Replaces the legacy ExternalSyncProcessor
 * (1400 LOC) with a cleaner architecture:
 *
 * 1. Fetch records from external API/JSON via IDataSourceAdapter
 * 2. Serialize as NDJSON into a BufferSource for BatchEngine
 * 3. BatchEngine handles batching, state persistence, chunked processing
 * 4. syncRecordProcessor handles create/update logic per record
 * 5. syncHooks batch pre-load existing AEDs to eliminate N+1 queries
 *
 * Key improvements over legacy:
 * - NDJSON cache: compressed in sync_ndjson_cache table between chunks (no re-fetch)
 * - Batch duplicate detection (1 query per batch vs 1 per record)
 * - Transactional AED creation (prisma.$transaction in processor)
 * - Proper streaming (AsyncGenerator → NDJSON → BatchEngine)
 */

import { gzipSync, gunzipSync } from "node:zlib";
import { BatchEngine } from "@batchactions/core";
import type { ChunkResult, JobProgress } from "@batchactions/core";
import { BufferSource, JsonParser } from "@batchactions/import";
import { PrismaStateStore } from "@batchactions/state-prisma";
import type { PrismaBatchactionsClient } from "@batchactions/state-prisma";
import type { PrismaClient } from "@/generated/client/client";
import type {
  IDataSourceAdapter,
  DataSourceConfig,
} from "@/import/domain/ports/IDataSourceAdapter";
import type { IDataSourceRepository } from "@/import/domain/ports/IDataSourceRepository";
import { DataSourceAdapterFactory } from "@/import/infrastructure/adapters/DataSourceAdapterFactory";
import {
  createSyncRecordProcessor,
  createSyncStats,
} from "@/import/infrastructure/processors/syncRecordProcessor";
import type { SyncStats } from "@/import/infrastructure/processors/syncRecordProcessor";
import { createSyncHooks } from "@/import/infrastructure/hooks/syncHooks";
import {
  VERCEL_CRON_MAX_DURATION_MS,
  DEFAULT_BATCH_SIZE,
  DEFAULT_CHUNK_MAX_RECORDS,
} from "@/import/constants";
import { appendInternalNote, recordStatusChange } from "@/lib/audit";
import { SYSTEM_USER_UUID } from "@/constants/system";

// ============================================================
// Types
// ============================================================

/** Context persisted in batch_jobs metadata for CRON resume */
export interface SyncContext {
  dataSourceId: string;
  sourceOrigin: string;
  syncFrequency: string;
  regionCode: string;
  dataSourceName: string;
  dryRun: boolean;
  /** ISO string of when the sync job started (for disappearance detection) */
  syncStartTime?: string;
}

export interface StartSyncOptions {
  /** Data source ID to sync */
  dataSourceId: string;
  /** User ID who triggered the sync */
  userId: string;
  /** Only check, don't actually write */
  dryRun?: boolean;
  /** Batch size (default: 50) */
  batchSize?: number;
  /** Max duration for the first chunk */
  maxDurationMs?: number;
  /** Max records per chunk */
  maxRecordsPerChunk?: number;
}

export interface StartSyncResult {
  jobId: string;
  chunk: ChunkResult;
  progress: JobProgress;
  dataSourceName: string;
}

export interface ResumeSyncOptions {
  jobId: string;
  syncContext: SyncContext;
  maxDurationMs?: number;
  maxRecordsPerChunk?: number;
  /** Total records from the source (preserved from startSync for accurate progress) */
  sourceTotalRecords?: number;
}

export interface ResumeSyncResult {
  jobId: string;
  chunk: ChunkResult;
  progress: JobProgress;
}

// ============================================================
// Service
// ============================================================

export class ExternalSyncService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly dataSourceRepository: IDataSourceRepository
  ) {}

  private get stateStorePrisma(): PrismaBatchactionsClient {
    return this.prisma as unknown as PrismaBatchactionsClient;
  }

  /**
   * Start a new sync job: fetch all records from external source,
   * feed them to BatchEngine, process first chunk.
   */
  async startSync(options: StartSyncOptions): Promise<StartSyncResult> {
    const {
      dataSourceId,
      userId,
      dryRun = false,
      batchSize = DEFAULT_BATCH_SIZE,
      maxDurationMs = VERCEL_CRON_MAX_DURATION_MS,
      maxRecordsPerChunk = DEFAULT_CHUNK_MAX_RECORDS,
    } = options;

    // 1. Load data source config
    const dataSource = await this.dataSourceRepository.findById(dataSourceId);
    if (!dataSource) throw new Error(`Data source not found: ${dataSourceId}`);
    if (!dataSource.isActive) throw new Error("Data source is not active");

    const fieldMappings = dataSource.config.fieldMappings;
    if (!fieldMappings || Object.keys(fieldMappings).length === 0) {
      throw new Error(
        `La fuente de datos "${dataSource.name}" no tiene configurado el mapeo de campos. ` +
          `Configure el mapeo antes de ejecutar la sincronización.`
      );
    }

    // 2. Create adapter and fetch all records
    const adapter = DataSourceAdapterFactory.getApiAdapter(
      dataSource.type as "CKAN_API" | "JSON_FILE" | "REST_API" | "CSV_FILE"
    );

    console.log(`[Sync:${dataSource.name}] Fetching records from ${dataSource.type}...`);
    const { ndjson, totalCount: sourceTotalRecords } = await this.fetchAsNdjson(
      adapter,
      dataSource.config
    );
    console.log(
      `[Sync:${dataSource.name}] Fetched ${sourceTotalRecords} records, NDJSON size: ${(ndjson.length / 1024).toFixed(0)} KB`
    );

    // Capture sync start time for disappearance detection
    const syncStartTime = new Date();

    // 3. Build infrastructure
    const stateStore = new PrismaStateStore(this.stateStorePrisma);
    const { hooks, clearCache } = createSyncHooks({ prisma: this.prisma, dataSourceId });
    const stats = createSyncStats();
    const processor = createSyncRecordProcessor({
      prisma: this.prisma,
      dataSourceId,
      sourceOrigin: dataSource.sourceOrigin,
      syncFrequency: dataSource.syncFrequency,
      dryRun,
      stats,
    });

    // 4. Create BatchEngine
    const engine = new BatchEngine({
      batchSize,
      continueOnError: true,
      stateStore,
      hooks,
      maxRetries: 2,
      retryDelayMs: 500,
    });

    engine.from(new BufferSource(ndjson), new JsonParser({ format: "ndjson" }));

    // Subscribe events for logging
    this.subscribeEvents(engine, dataSource.name);

    // 5. Process first chunk
    const chunk = await engine.processChunk(processor, {
      maxDurationMs,
      maxRecords: maxRecordsPerChunk,
    });

    // Release cache memory if job is done
    if (chunk.done) clearCache();

    const jobId = engine.getJobId();
    const progress = await stateStore.getProgress(jobId);

    // 6b. Cache NDJSON for resume (avoid re-downloading on every chunk)
    if (!chunk.done) {
      await this.cacheNdjson(jobId, ndjson, sourceTotalRecords);
    }

    // 7. Register in batch_jobs for UI/CRON compatibility
    const syncContext: SyncContext = {
      dataSourceId,
      sourceOrigin: dataSource.sourceOrigin,
      syncFrequency: dataSource.syncFrequency,
      regionCode: dataSource.regionCode,
      dataSourceName: dataSource.name,
      dryRun,
      syncStartTime: syncStartTime.toISOString(),
    };

    await this.upsertJobRegistry({
      jobId,
      jobName: `Sync: ${dataSource.name}`,
      userId,
      progress,
      done: chunk.done,
      syncContext,
      sourceTotalRecords,
      stats,
    });

    // 8. Update data source stats + disappearance detection if completed
    if (chunk.done) {
      await this.finalizeSync(dataSourceId, stats, sourceTotalRecords, syncStartTime, dryRun);
    }

    return { jobId, chunk, progress, dataSourceName: dataSource.name };
  }

  /**
   * Resume an existing sync job from persisted state.
   * Used by CRON and manual resume endpoints.
   */
  async resumeSync(options: ResumeSyncOptions): Promise<ResumeSyncResult> {
    const {
      jobId,
      syncContext,
      maxDurationMs = VERCEL_CRON_MAX_DURATION_MS,
      maxRecordsPerChunk = DEFAULT_CHUNK_MAX_RECORDS,
      sourceTotalRecords,
    } = options;

    // 1. Try to read cached NDJSON; only re-fetch if cache miss
    const dataSource = await this.dataSourceRepository.findById(syncContext.dataSourceId);
    if (!dataSource) throw new Error(`Data source not found: ${syncContext.dataSourceId}`);

    let ndjson = await this.getCachedNdjson(jobId);
    let cacheWasMiss = false;
    if (ndjson) {
      console.log(
        `[Sync:${syncContext.dataSourceName}] Restored ${(ndjson.length / 1024).toFixed(0)} KB NDJSON from cache (skip re-fetch)`
      );
    } else {
      cacheWasMiss = true;
      console.warn(
        `[Sync:${syncContext.dataSourceName}] Cache miss — re-fetching all records from API...`
      );
      const adapter = DataSourceAdapterFactory.getApiAdapter(
        dataSource.type as "CKAN_API" | "JSON_FILE" | "REST_API" | "CSV_FILE"
      );
      const fetched = await this.fetchAsNdjson(adapter, dataSource.config);
      ndjson = fetched.ndjson;
    }

    // 2. Build infrastructure
    const stateStore = new PrismaStateStore(this.stateStorePrisma);
    const { hooks, clearCache } = createSyncHooks({
      prisma: this.prisma,
      dataSourceId: syncContext.dataSourceId,
    });
    const stats = createSyncStats();
    const processor = createSyncRecordProcessor({
      prisma: this.prisma,
      dataSourceId: syncContext.dataSourceId,
      sourceOrigin: syncContext.sourceOrigin,
      syncFrequency: syncContext.syncFrequency,
      dryRun: syncContext.dryRun,
      stats,
    });

    // 3. Restore engine from state store
    // IMPORTANT: batchSize MUST match the value used in startSync. If omitted,
    // BatchEngine defaults to 100, changing the batch index ↔ record mapping.
    // This causes records in "completed" batch indices to be silently skipped
    // even though they weren't part of the original completed batches.
    const engine = await BatchEngine.restore(jobId, {
      batchSize: DEFAULT_BATCH_SIZE,
      stateStore,
      hooks,
      continueOnError: true,
      maxRetries: 2,
      retryDelayMs: 500,
    });

    if (!engine) {
      throw new Error(`Sync job ${jobId} not found or cannot be restored`);
    }

    // BatchEngine.restore() restores state (processed records, batches) but NOT
    // the data source. We must re-configure it with a fresh fetch so the engine
    // can process remaining records. Already-processed records are skipped by
    // the engine based on persisted state.
    engine.from(new BufferSource(ndjson), new JsonParser({ format: "ndjson" }));

    // Subscribe events
    this.subscribeEvents(engine, syncContext.dataSourceName);

    // 3. Process next chunk
    const chunk = await engine.processChunk(processor, {
      maxDurationMs,
      maxRecords: maxRecordsPerChunk,
    });

    const progress = await stateStore.getProgress(jobId);

    // 4. Cache NDJSON for next resume if it was a miss (e.g. job started before cache feature)
    if (cacheWasMiss && !chunk.done) {
      await this.cacheNdjson(jobId, ndjson, sourceTotalRecords ?? 0);
    }

    // 5. Update registry
    await this.updateJobRegistry({
      jobId,
      progress,
      done: chunk.done,
      sourceTotalRecords,
      stats,
    });

    // 6. Finalize if completed
    if (chunk.done) {
      clearCache();
      await this.deleteCachedNdjson(jobId);
      // Use accumulated stats from metadata (all chunks combined), not just this chunk's stats
      const accumulatedStats = await this.getAccumulatedStats(jobId, stats);
      const syncStartTime = syncContext.syncStartTime
        ? new Date(syncContext.syncStartTime)
        : undefined;
      await this.finalizeSync(
        syncContext.dataSourceId,
        accumulatedStats,
        sourceTotalRecords,
        syncStartTime,
        syncContext.dryRun
      );
    }

    return { jobId, chunk, progress };
  }

  /**
   * Get progress for an existing sync job.
   */
  async getProgress(jobId: string): Promise<JobProgress> {
    const stateStore = new PrismaStateStore(this.stateStorePrisma);
    return stateStore.getProgress(jobId);
  }

  // ============================================================
  // Private helpers
  // ============================================================

  /**
   * Fetch all records from an external data source and serialize as NDJSON.
   * This is the bridge between IDataSourceAdapter (AsyncGenerator<ImportRecord>)
   * and BatchEngine (DataSource → string/Buffer).
   */
  /** Max NDJSON buffer size: 512 MB. Prevents OOM on unexpectedly large sources. */
  private static readonly MAX_NDJSON_BYTES = 512 * 1024 * 1024;

  private async fetchAsNdjson(
    adapter: IDataSourceAdapter,
    config: DataSourceConfig
  ): Promise<{ ndjson: string; totalCount: number }> {
    const lines: string[] = [];
    let count = 0;
    let totalBytes = 0;

    for await (const importRecord of adapter.fetchRecords(config)) {
      // Serialize each ImportRecord as a JSON line with normalized fields
      const record: Record<string, unknown> = {
        externalId: importRecord.externalId,
        name: importRecord.name,
        establishmentType: importRecord.establishmentType,
        streetType: importRecord.streetType,
        streetName: importRecord.streetName,
        streetNumber: importRecord.streetNumber,
        floor: importRecord.floor,
        additionalInfo: importRecord.additionalInfo,
        specificLocation: importRecord.specificLocation,
        postalCode: importRecord.postalCode,
        city: importRecord.city,
        cityCode: importRecord.cityCode,
        district: importRecord.district,
        latitude: importRecord.latitude?.toString() ?? null,
        longitude: importRecord.longitude?.toString() ?? null,
        accessSchedule: importRecord.accessSchedule,
        accessDescription: importRecord.accessDescription,
        ownershipType: importRecord.ownershipType,
        scheduleDescription: importRecord.scheduleDescription,
        submitterName: importRecord.submitterName,
        submitterEmail: importRecord.submitterEmail,
        submitterPhone: importRecord.submitterPhone,
        ownership: importRecord.ownership,
        // Device fields
        deviceBrand: importRecord.deviceBrand,
        deviceModel: importRecord.deviceModel,
        deviceSerialNumber: importRecord.deviceSerialNumber,
        deviceManufacturingDate: importRecord.deviceManufacturingDate,
        deviceInstallationDate: importRecord.deviceInstallationDate,
        deviceExpirationDate: importRecord.deviceExpirationDate,
        deviceLastMaintenanceDate: importRecord.deviceLastMaintenanceDate,
        isMobileUnit: importRecord.isMobileUnit ? "true" : "false",
        accessRestriction: importRecord.accessRestriction ? "true" : "false",
        isPmrAccessible:
          importRecord.isPmrAccessible === null
            ? null
            : importRecord.isPmrAccessible
              ? "true"
              : "false",
        has24hSurveillance: importRecord.has24hSurveillance ? "true" : "false",
        _rawData: importRecord.rawData,
        _contentHash: importRecord.contentHash,
        _rowIndex: importRecord.rowIndex,
      };

      const line = JSON.stringify(record);
      totalBytes += line.length;

      if (totalBytes > ExternalSyncService.MAX_NDJSON_BYTES) {
        throw new Error(
          `Sync abortado: el buffer NDJSON supera ${(ExternalSyncService.MAX_NDJSON_BYTES / 1024 / 1024).toFixed(0)} MB ` +
            `(${count} registros). La fuente de datos es demasiado grande para procesarla en memoria.`
        );
      }

      lines.push(line);
      count++;

      if (count % 1000 === 0) {
        console.log(`[Sync] Downloaded and normalized ${count} records...`);
      }
    }

    console.log(`[Sync] Total: ${count} records fetched`);
    return { ndjson: lines.join("\n"), totalCount: count };
  }

  /**
   * Setup batch record registration for the pre-loading hook.
   * Listens to batch:started events to register batch records.
   */

  /**
   * Subscribe to BatchEngine events for structured logging.
   */
  private subscribeEvents(engine: BatchEngine, label: string): void {
    engine
      .on("job:started", (e) => {
        console.log(
          `[Sync:${label}] Job ${e.jobId} started — ${e.totalRecords} records in ${e.totalBatches} batches`
        );
      })
      .on("job:progress", (e) => {
        const p = e.progress;
        console.log(
          `[Sync:${label}] Progress — ${p.processedRecords}/${p.totalRecords} (${p.percentage}%) ` +
            `batch ${p.currentBatch}/${p.totalBatches}` +
            (p.estimatedRemainingMs ? ` ~${Math.round(p.estimatedRemainingMs / 1000)}s left` : "")
        );
      })
      .on("batch:completed", (e) => {
        console.log(
          `[Sync:${label}] Batch ${e.batchIndex + 1} done — ${e.processedCount}/${e.totalCount} processed, ${e.failedCount} failed`
        );
      })
      .on("record:failed", (e) => {
        console.warn(`[Sync:${label}] Record ${e.recordIndex} failed: ${e.error}`);
      })
      .on("chunk:completed", (e) => {
        console.log(
          `[Sync:${label}] Chunk done — ${e.processedRecords} processed, ${e.failedRecords} failed, done=${e.done}`
        );
      })
      .on("job:completed", (e) => {
        const s = e.summary;
        console.log(
          `[Sync:${label}] Job ${e.jobId} COMPLETED — ` +
            `${s.processed}/${s.total} records, ${s.failed} failed (${s.elapsedMs}ms)`
        );
      })
      .on("job:failed", (e) => {
        console.error(`[Sync:${label}] Job ${e.jobId} FAILED: ${e.error}`);
      });
  }

  /**
   * Read accumulated sync_stats from job metadata (all chunks combined)
   * and merge with the current chunk's stats.
   *
   * NOTE: Stats may over-count slightly due to BatchEngine retries
   * (maxRetries > 0). If a record's processor succeeds but post-processing
   * fails, the engine retries the processor, incrementing stats again.
   * This is a cosmetic issue that doesn't affect data integrity.
   * A robust fix would require DB-side counters inside transactions.
   */
  private async getAccumulatedStats(
    jobId: string,
    currentChunkStats: SyncStats
  ): Promise<SyncStats> {
    try {
      const job = await this.prisma.batchJob.findUnique({
        where: { id: jobId },
        select: { metadata: true, successful_records: true },
      });
      const meta = (job?.metadata as Record<string, unknown>) || {};
      const stored = meta.sync_stats as SyncStats | undefined;
      if (stored) {
        // Safety: clamp stats sum to not exceed actual processed records
        const totalOps = stored.created + stored.updated + stored.skipped;
        const processed = job?.successful_records ?? totalOps;
        if (totalOps > processed && processed > 0) {
          const ratio = processed / totalOps;
          return {
            created: Math.round(stored.created * ratio),
            updated: Math.round(stored.updated * ratio),
            skipped: stored.skipped,
          };
        }
        return stored;
      }
    } catch {
      // Fall back to current chunk stats
    }
    return currentChunkStats;
  }

  /**
   * Update data source stats when sync completes.
   * Accumulates the total records synced, created, updated from all sync runs.
   * If syncStartTime is provided, runs disappearance detection.
   */
  private async finalizeSync(
    dataSourceId: string,
    stats?: SyncStats,
    sourceTotalRecords?: number,
    syncStartTime?: Date,
    dryRun?: boolean
  ): Promise<void> {
    // 1. Update data source stats
    try {
      await this.prisma.externalDataSource.update({
        where: { id: dataSourceId },
        data: {
          last_sync_at: new Date(),
          ...(sourceTotalRecords != null ? { total_records_sync: sourceTotalRecords } : {}),
          ...(stats
            ? {
                records_created: { increment: stats.created },
                records_updated: { increment: stats.updated },
                records_skipped: { increment: stats.skipped },
              }
            : {}),
        },
      });
    } catch (error) {
      console.error(`[Sync] Failed to finalize data source ${dataSourceId}:`, error);
    }

    // 2. Disappearance detection — skip for dry runs or if no syncStartTime
    if (dryRun || !syncStartTime) return;

    await this.detectDisappearedIdentifiers(dataSourceId, syncStartTime);
  }

  /**
   * Detect identifiers that were previously current but NOT seen in this sync.
   * Mark them as no longer current. If `auto_deactivate_missing` is enabled on the
   * data source, deactivate AEDs that have NO remaining current identifiers from ANY source.
   */
  private async detectDisappearedIdentifiers(
    dataSourceId: string,
    syncStartTime: Date
  ): Promise<void> {
    try {
      const dataSource = await this.prisma.externalDataSource.findUnique({
        where: { id: dataSourceId },
        select: { auto_deactivate_missing: true, name: true },
      });

      if (!dataSource) return;

      // Find identifiers that were current but NOT touched by this sync
      // (last_seen_at < syncStartTime means they were not updated during any chunk)
      const disappeared = await this.prisma.$queryRaw<
        Array<{ id: string; aed_id: string; external_identifier: string }>
      >`
        SELECT id, aed_id, external_identifier
        FROM aed_external_identifiers
        WHERE data_source_id = ${dataSourceId}::uuid
          AND is_current_in_source = true
          AND last_seen_at < ${syncStartTime}
      `;

      if (disappeared.length === 0) return;

      console.log(
        `[Sync:${dataSource.name}] Disappearance detection: ${disappeared.length} identifiers not seen in this sync`
      );

      // Mark all disappeared identifiers as no longer current
      await this.prisma.$executeRaw`
        UPDATE aed_external_identifiers
        SET is_current_in_source = false,
            removed_from_source_at = NOW(),
            updated_at = NOW()
        WHERE data_source_id = ${dataSourceId}::uuid
          AND is_current_in_source = true
          AND last_seen_at < ${syncStartTime}
      `;

      // If auto_deactivate_missing is NOT enabled, stop here (identifiers are marked but AEDs stay active)
      if (!dataSource.auto_deactivate_missing) {
        console.log(
          `[Sync:${dataSource.name}] auto_deactivate_missing=false — identifiers marked as disappeared but AEDs not deactivated`
        );
        return;
      }

      // Find AEDs from disappeared identifiers that have NO other current identifiers from ANY source
      const disappearedAedIds = [...new Set(disappeared.map((d) => d.aed_id))];

      const aedsWithOtherSources = await this.prisma.$queryRaw<Array<{ aed_id: string }>>`
        SELECT DISTINCT aed_id
        FROM aed_external_identifiers
        WHERE aed_id = ANY(${disappearedAedIds}::uuid[])
          AND is_current_in_source = true
      `;
      const aedsWithOtherSourcesSet = new Set(aedsWithOtherSources.map((a) => a.aed_id));

      // AEDs to potentially deactivate: no remaining current identifiers from any source
      const aedsToDeactivate = disappearedAedIds.filter((id) => !aedsWithOtherSourcesSet.has(id));

      if (aedsToDeactivate.length === 0) {
        console.log(
          `[Sync:${dataSource.name}] All disappeared AEDs have other active sources — no deactivations`
        );
        return;
      }

      // Only deactivate PUBLISHED AEDs (PUBLISHED → INACTIVE is a valid transition)
      const publishedAeds = await this.prisma.aed.findMany({
        where: {
          id: { in: aedsToDeactivate },
          status: "PUBLISHED",
        },
        select: { id: true, status: true, internal_notes: true },
      });

      let deactivatedCount = 0;
      for (const aed of publishedAeds) {
        try {
          const notes = appendInternalNote(
            aed.internal_notes,
            `DEA desaparecido de la fuente "${dataSource.name}". ` +
              `No se encontró en la última sincronización y no tiene identificadores activos en otras fuentes. ` +
              `Marcado como INACTIVE automáticamente.`,
            "auto_deactivation_disappeared",
            "ExternalSyncService"
          );

          await this.prisma.$transaction(async (tx) => {
            await tx.aed.update({
              where: { id: aed.id },
              data: {
                status: "INACTIVE",
                internal_notes: notes,
                updated_by: SYSTEM_USER_UUID,
              },
            });
            await recordStatusChange(tx, {
              aedId: aed.id,
              previousStatus: aed.status,
              newStatus: "INACTIVE",
              modifiedBy: SYSTEM_USER_UUID,
              reason: `Desaparecido de fuente "${dataSource.name}" — desactivación automática`,
            });
          });
          deactivatedCount++;
        } catch (error) {
          console.error(
            `[Sync] Failed to deactivate AED ${aed.id}:`,
            error instanceof Error ? error.message : error
          );
        }
      }

      // Update records_deactivated counter
      if (deactivatedCount > 0) {
        await this.prisma.externalDataSource.update({
          where: { id: dataSourceId },
          data: { records_deactivated: { increment: deactivatedCount } },
        });
      }

      console.log(
        `[Sync:${dataSource.name}] Auto-deactivated ${deactivatedCount} AEDs ` +
          `(${aedsToDeactivate.length} had no other sources, ${publishedAeds.length} were PUBLISHED)`
      );
    } catch (error) {
      // Non-critical: sync itself succeeded, don't propagate
      console.error(`[Sync] Disappearance detection failed for ${dataSourceId}:`, error);
    }
  }

  /**
   * Creates/updates a batch_jobs record for UI/CRON compatibility.
   * Same pattern as BulkImportService.upsertJobRegistry().
   */
  private async upsertJobRegistry(params: {
    jobId: string;
    jobName?: string;
    userId: string;
    progress: JobProgress;
    done: boolean;
    syncContext: SyncContext;
    /** Total records from source (known at startSync, not from state store) */
    sourceTotalRecords?: number;
    /** Operation breakdown from processor */
    stats?: SyncStats;
  }): Promise<void> {
    const { jobId, jobName, userId, progress, done, syncContext, sourceTotalRecords, stats } =
      params;
    // Dry run jobs should never be left in WAITING state (CRON would resume them)
    const status = done || syncContext.dryRun ? "COMPLETED" : "WAITING";
    const failedRecords = progress.failedRecords ?? 0;
    // Use source total when available (accurate), fall back to state store count (partial)
    const totalRecords = sourceTotalRecords ?? progress.totalRecords;
    const metadata = {
      engine: "externalsync",
      sync_context: syncContext,
      ...(stats ? { sync_stats: stats } : {}),
    } as object;

    try {
      await this.prisma.batchJob.upsert({
        where: { id: jobId },
        create: {
          id: jobId,
          type: "AED_EXTERNAL_SYNC",
          name: jobName || `Sync: ${syncContext.dataSourceName}`,
          status,
          config: {} as object,
          data_source_id: syncContext.dataSourceId,
          total_records: totalRecords,
          processed_records: progress.processedRecords,
          successful_records: Math.max(0, progress.processedRecords - failedRecords),
          failed_records: failedRecords,
          current_chunk: progress.currentBatch,
          total_chunks: progress.totalBatches,
          started_at: progress.elapsedMs > 0 ? new Date(Date.now() - progress.elapsedMs) : null,
          completed_at: done ? new Date() : null,
          last_heartbeat: new Date(),
          created_by: userId,
          metadata,
        },
        update: {
          status,
          data_source_id: syncContext.dataSourceId,
          total_records: totalRecords,
          processed_records: progress.processedRecords,
          successful_records: Math.max(0, progress.processedRecords - failedRecords),
          failed_records: failedRecords,
          current_chunk: progress.currentBatch,
          total_chunks: progress.totalBatches,
          completed_at: done ? new Date() : null,
          last_heartbeat: new Date(),
          metadata,
        },
      });
    } catch (error) {
      console.error(`[Sync] Failed to update job registry for ${jobId}:`, error);
    }
  }

  /**
   * Update an existing batch_jobs record (for resume, no userId needed).
   */
  private async updateJobRegistry(params: {
    jobId: string;
    progress: JobProgress;
    done: boolean;
    sourceTotalRecords?: number;
    /** Operation breakdown from this chunk's processor */
    stats?: SyncStats;
  }): Promise<void> {
    const { jobId, progress, done, sourceTotalRecords, stats } = params;
    const status = done ? "COMPLETED" : "WAITING";
    const failedRecords = progress.failedRecords ?? 0;
    const totalRecords = sourceTotalRecords ?? progress.totalRecords;

    try {
      // When done, all records have been handled (processed, failed, or skipped
      // in completed batches from previous chunks). The BatchEngine's
      // processedRecords only counts records that went through the processor
      // callback, missing records in already-completed batches. Use totalRecords
      // for the final count so the UI shows 100%.
      const processedRecords = done ? totalRecords - failedRecords : progress.processedRecords;

      const updateData: Record<string, unknown> = {
        status,
        total_records: totalRecords,
        processed_records: processedRecords,
        successful_records: Math.max(0, processedRecords - failedRecords),
        failed_records: failedRecords,
        current_chunk: progress.currentBatch,
        total_chunks: progress.totalBatches,
        completed_at: done ? new Date() : null,
        last_heartbeat: new Date(),
      };

      // Merge sync_stats and increment resume_count in metadata
      {
        const existing = await this.prisma.batchJob.findUnique({
          where: { id: jobId },
          select: { metadata: true },
        });
        const existingMeta = (existing?.metadata as Record<string, unknown>) || {};
        const resumeCount = ((existingMeta.resume_count as number) || 0) + 1;
        const newMeta: Record<string, unknown> = { ...existingMeta, resume_count: resumeCount };

        if (stats) {
          const prev = existingMeta.sync_stats as SyncStats | undefined;
          newMeta.sync_stats = prev
            ? {
                created: prev.created + stats.created,
                updated: prev.updated + stats.updated,
                skipped: prev.skipped + stats.skipped,
              }
            : stats;
        }

        updateData.metadata = newMeta;
      }

      await this.prisma.batchJob.update({
        where: { id: jobId },
        data: updateData,
      });
    } catch (error) {
      console.error(`[Sync] Failed to update job registry for ${jobId}:`, error);
    }
  }

  // ============================================================
  // NDJSON Cache — avoid re-downloading on every resume
  // ============================================================

  /**
   * Compress and store NDJSON data in sync_ndjson_cache table.
   * Typical compression ratio: 5-8x (85 MB NDJSON → ~12 MB gzip).
   */
  private async cacheNdjson(jobId: string, ndjson: string, recordCount: number): Promise<void> {
    try {
      const compressed = gzipSync(Buffer.from(ndjson, "utf-8"), { level: 6 });
      console.log(
        `[Sync] Caching NDJSON for job ${jobId}: ` +
          `${(ndjson.length / 1024 / 1024).toFixed(1)} MB → ${(compressed.length / 1024 / 1024).toFixed(1)} MB gzip`
      );
      await this.prisma.syncNdjsonCache.upsert({
        where: { job_id: jobId },
        create: {
          job_id: jobId,
          compressed_data: compressed,
          original_size: ndjson.length,
          record_count: recordCount,
        },
        update: {
          compressed_data: compressed,
          original_size: ndjson.length,
          record_count: recordCount,
        },
      });
    } catch (error) {
      // Non-critical: next resume will re-fetch from API (slower but correct)
      console.error(`[Sync] Failed to cache NDJSON for ${jobId}:`, error);
    }
  }

  /**
   * Read and decompress cached NDJSON for a job.
   * Returns null if cache miss (will fall back to re-fetch).
   */
  private async getCachedNdjson(jobId: string): Promise<string | null> {
    try {
      const cached = await this.prisma.syncNdjsonCache.findUnique({
        where: { job_id: jobId },
      });
      if (!cached) return null;

      const decompressed = gunzipSync(Buffer.from(cached.compressed_data));
      return decompressed.toString("utf-8");
    } catch (error) {
      console.warn(`[Sync] Failed to read NDJSON cache for ${jobId}:`, error);
      return null;
    }
  }

  /**
   * Delete cached NDJSON after job completes.
   */
  private async deleteCachedNdjson(jobId: string): Promise<void> {
    try {
      await this.prisma.syncNdjsonCache.delete({ where: { job_id: jobId } });
    } catch {
      // Ignore: record may not exist (e.g. completed in first chunk)
    }
  }
}
