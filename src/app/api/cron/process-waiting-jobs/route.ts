/**
 * Cron Job: Process Waiting Batch Jobs -- Dual-mode
 *
 * This endpoint is called by Vercel Cron (every minute) to automatically
 * continue processing batch jobs that are in WAITING status.
 *
 * Soporta tres motores:
 * - engine=bulkimport -> @batchactions/import via BulkImportService
 * - engine=externalsync -> @batchactions/core via ExternalSyncService
 * - legacy (sin engine) -> BatchJobOrchestrator (procesador existente)
 *
 * Flow:
 * 1. Find jobs in WAITING, INTERRUPTED, PENDING status
 * 2. For each job, detect engine from metadata
 * 3. Process with appropriate engine
 * 4. Job returns to WAITING if hasMore, or completes
 * 5. Cron will pick it up again in the next minute
 *
 * Security: Protected by Vercel Cron Secret
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { PrismaBatchJobRepository } from "@/batch/infrastructure";
import { BatchJobOrchestrator } from "@/batch/application";
import { initializeProcessors } from "@/batch/application/processors";
import {
  getBulkImportService,
  getExternalSyncService,
} from "@/import/infrastructure/factories/createBulkImportService";
import type { ImportContext } from "@/import/application/services/BulkImportService";
import type { SyncContext } from "@/import/application/services/ExternalSyncService";
import {
  VERCEL_CRON_MAX_DURATION_MS,
  CRON_SAFETY_TIMEOUT_MS,
  ORPHANED_JOB_TIMEOUT_MS,
  CRON_MAX_JOBS_PER_INVOCATION,
} from "@/import/constants";

// Lazy initialization para evitar side effects en cold starts de serverless.
// Se inicializa solo cuando se necesita procesar un job legacy.
let _repository: PrismaBatchJobRepository | null = null;
let _orchestrator: BatchJobOrchestrator | null = null;
let _processorsInitialized = false;

function getLegacyRepository(): PrismaBatchJobRepository {
  if (!_repository) {
    _repository = new PrismaBatchJobRepository(prisma);
  }
  return _repository;
}

function getLegacyOrchestrator(): BatchJobOrchestrator {
  if (!_orchestrator) {
    const repository = getLegacyRepository();
    if (!_processorsInitialized) {
      initializeProcessors(prisma);
      _processorsInitialized = true;
    }
    _orchestrator = new BatchJobOrchestrator(repository);
  }
  return _orchestrator;
}

// Timeouts importados desde @/import/constants

/**
 * Process waiting jobs (main logic)
 * Used by both GET (Vercel Cron) and POST (manual trigger)
 */
async function processWaitingJobs(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  try {
    // Verify Vercel Cron Secret
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      if (process.env.NODE_ENV === "production") {
        console.error("[Cron] CRON_SECRET not configured in production -- rejecting request");
        return NextResponse.json(
          { success: false, error: "Server misconfiguration: CRON_SECRET not set" },
          { status: 500 }
        );
      }
      // En desarrollo, permitir sin secret pero loguear warning
      console.warn(
        "[Cron] CRON_SECRET not configured -- allowing unauthenticated access (dev only)"
      );
    } else if (authHeader !== `Bearer ${cronSecret}`) {
      console.warn("[WARN] [Cron] Unauthorized cron request");
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    console.log("[TIME] [Cron] Starting batch job processing...");

    const repository = getLegacyRepository();

    // 1. RECOVER ORPHANED JOBS (IN_PROGRESS without heartbeat for >3 minutes)
    const orphanedJobs = await repository.findTimedOutJobs(ORPHANED_JOB_TIMEOUT_MS);

    if (orphanedJobs.length > 0) {
      console.log(
        `[WARN] [Cron] Found ${orphanedJobs.length} orphaned jobs, marking as INTERRUPTED`
      );

      for (const orphanJob of orphanedJobs) {
        try {
          orphanJob.markInterrupted();
          await repository.update(orphanJob);
          console.log(
            `[OK] [Cron] Job ${orphanJob.id} marked as INTERRUPTED and will be recovered`
          );
        } catch (error) {
          console.error(`[ERROR] [Cron] Error marking job ${orphanJob.id} as INTERRUPTED:`, error);
        }
      }
    }

    // 2. FIND RESUMABLE JOBS (PENDING, INTERRUPTED, PAUSED)
    const resumableJobs = await repository.findResumableJobs({ types: undefined });
    const pendingJobs = resumableJobs.filter(
      (j) => j.status === "PENDING" || j.status === "QUEUED"
    );
    const interruptedJobs = resumableJobs.filter(
      (j) => j.status === "INTERRUPTED" || j.status === "PAUSED"
    );

    // 3. FIND WAITING JOBS (already started but waiting for continuation)
    const waitingJobs = await repository.findWaitingJobs(CRON_MAX_JOBS_PER_INVOCATION);

    // 4. COMBINE: INTERRUPTED first (recovery priority), then PENDING (FIFO), then WAITING
    const jobsToProcess = [...interruptedJobs, ...pendingJobs, ...waitingJobs].slice(
      0,
      CRON_MAX_JOBS_PER_INVOCATION
    );

    if (jobsToProcess.length === 0) {
      console.log("[IDLE] [Cron] No jobs to process");
      return NextResponse.json({
        success: true,
        message: "No jobs to process",
        processed: 0,
        recovered: orphanedJobs.length,
        duration: Date.now() - startTime,
      });
    }

    console.log(
      `[INFO] [Cron] Found ${jobsToProcess.length} jobs to process (${interruptedJobs.length} interrupted, ${pendingJobs.length} pending, ${waitingJobs.length} waiting)`
    );

    const results: Array<{
      jobId: string;
      jobName: string;
      success: boolean;
      status: string;
      processedRecords: number;
      totalRecords: number;
      percentage: number;
      hasMore: boolean;
      lockAcquired?: boolean;
      wasPending?: boolean;
      wasInterrupted?: boolean;
      engine?: string;
      error?: string;
    }> = [];

    // Process each job
    for (const job of jobsToProcess) {
      const jobStartTime = Date.now();
      const engine = (job.metadata?.engine as string) || "legacy";
      console.log(`\n[INFO] [Cron] Processing job ${job.id} (${job.name}) [engine: ${engine}]`);

      try {
        const wasPending = job.status === "PENDING" || job.status === "QUEUED";
        const wasInterrupted = job.status === "INTERRUPTED" || job.status === "PAUSED";

        // 1. For all non-PENDING jobs, try to acquire lock atomically
        //    This prevents concurrent processing of the same job by multiple cron instances
        let lockAcquired = true;

        if (!wasPending) {
          lockAcquired = await repository.tryAcquireJobLock(job.id);

          if (!lockAcquired) {
            console.log(
              `[SKIP]  [Cron] Job ${job.id} already being processed by another instance, skipping`
            );
            results.push({
              jobId: job.id,
              jobName: job.name,
              success: true,
              status: "SKIPPED",
              processedRecords: 0,
              totalRecords: 0,
              percentage: 0,
              hasMore: true,
              lockAcquired: false,
              engine,
            });
            continue;
          }

          console.log(`[LOCK] [Cron] Lock acquired for job ${job.id}`);
        }

        // ========================================
        // 2. DISPATCH based on engine
        // ========================================
        if (engine === "bulkimport") {
          // @batchactions/import engine
          const jobResult = await processBulkImportJob(
            job.id,
            job.metadata,
            job.createdBy,
            job.organizationId,
            wasPending,
            wasInterrupted
          );
          results.push({ ...jobResult, jobName: job.name, engine });
        } else if (engine === "externalsync") {
          // @batchactions/core engine for external sync
          const jobResult = await processExternalSyncJob(
            job.id,
            job.metadata,
            job.progress.totalRecords,
            wasPending,
            wasInterrupted
          );
          results.push({ ...jobResult, jobName: job.name, engine });
        } else {
          // Legacy engine (BatchJobOrchestrator)
          const orchestrator = getLegacyOrchestrator();
          const result = wasPending
            ? await orchestrator.start(job.id)
            : await orchestrator.continue(job.id);

          results.push({
            jobId: job.id,
            jobName: job.name,
            success: result.chunkResult.success,
            status: result.job.status,
            processedRecords: result.chunkResult.progress.processedRecords,
            totalRecords: result.chunkResult.progress.totalRecords,
            percentage: result.chunkResult.progress.percentage,
            hasMore: result.chunkResult.progress.hasMore,
            lockAcquired: true,
            wasPending,
            wasInterrupted,
            engine,
          });
        }

        const lastResult = results[results.length - 1];
        const duration = Date.now() - jobStartTime;
        console.log(
          `[OK] [Cron] Job ${job.id} [${engine}] processed: ${lastResult.processedRecords}/${lastResult.totalRecords} (${lastResult.percentage}%) in ${duration}ms`
        );

        if (!lastResult.hasMore) {
          console.log(`[DONE] [Cron] Job ${job.id} completed!`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error(`[ERROR] [Cron] Error processing job ${job.id} [${engine}]:`, error);

        results.push({
          jobId: job.id,
          jobName: job.name,
          success: false,
          status: "ERROR",
          processedRecords: 0,
          totalRecords: 0,
          percentage: 0,
          hasMore: false,
          error: errorMessage,
          engine,
        });
      }

      // 3. Check if we're running out of time (Vercel cron timeout)
      const elapsed = Date.now() - startTime;
      if (elapsed > CRON_SAFETY_TIMEOUT_MS) {
        // 50 seconds - leave 10s buffer for response
        console.warn(
          `[TIME] [Cron] Approaching timeout (${elapsed}ms), stopping after processing ${results.length} jobs`
        );
        break;
      }
    }

    const totalDuration = Date.now() - startTime;
    const successCount = results.filter((r) => r.success).length;
    const skippedCount = results.filter((r) => r.lockAcquired === false).length;
    const startedCount = results.filter((r) => r.wasPending).length;
    const resumedCount = results.filter((r) => r.wasInterrupted).length;

    console.log(
      `\n[SUMMARY] [Cron] Batch processing complete: ${successCount}/${results.length} jobs successful (${startedCount} started, ${resumedCount} resumed, ${skippedCount} skipped, ${orphanedJobs.length} recovered) in ${totalDuration}ms`
    );

    return NextResponse.json(
      {
        success: true,
        message: `Processed ${results.length} jobs (${successCount} successful, ${startedCount} started, ${resumedCount} resumed, ${skippedCount} skipped, ${orphanedJobs.length} recovered)`,
        processed: results.length,
        successful: successCount,
        started: startedCount,
        resumed: resumedCount,
        skipped: skippedCount,
        recovered: orphanedJobs.length,
        failed: results.length - successCount - skippedCount,
        duration: totalDuration,
        results,
      },
      { status: 200 }
    );
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("[ERROR] [Cron] Fatal error:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        duration,
      },
      { status: 500 }
    );
  }
}

// ============================================================
// BulkImport engine handler
// ============================================================

/**
 * Procesa un job con @batchactions/import.
 * Extrae import_context del metadata y llama a resumeImport().
 *
 * Para jobs PENDING: el primer chunk se proceso en el POST /api/import,
 * pero si no fue asi (ej. el POST fallo despues de crear el job), el
 * resumeImport() tambien maneja ese caso.
 */
async function processBulkImportJob(
  jobId: string,
  metadata: Record<string, unknown>,
  createdBy: string,
  organizationId: string | undefined,
  wasPending: boolean,
  wasInterrupted: boolean
): Promise<{
  jobId: string;
  success: boolean;
  status: string;
  processedRecords: number;
  totalRecords: number;
  percentage: number;
  hasMore: boolean;
  lockAcquired: boolean;
  wasPending: boolean;
  wasInterrupted: boolean;
}> {
  const importContext = metadata.import_context as ImportContext | undefined;

  if (!importContext?.s3Url) {
    throw new Error(`BulkImport job ${jobId} missing import_context.s3Url in metadata`);
  }

  const service = getBulkImportService();
  const result = await service.resumeImport({
    jobId,
    s3Url: importContext.s3Url,
    userId: createdBy,
    fileName: importContext.fileName,
    delimiter: importContext.delimiter,
    mappings: importContext.mappings,
    sharePointAuth: importContext.sharePointAuth,
    maxDurationMs: VERCEL_CRON_MAX_DURATION_MS,
    skipDuplicates: importContext.skipDuplicates,
    assignmentType: importContext.assignmentType,
    organizationId,
  });

  const hasMore = !result.chunk.done;

  return {
    jobId,
    success: true,
    status: hasMore ? "WAITING" : "COMPLETED",
    processedRecords: result.progress.processedRecords,
    totalRecords: result.progress.totalRecords,
    percentage: result.progress.percentage,
    hasMore,
    lockAcquired: true,
    wasPending,
    wasInterrupted,
  };
}

// ============================================================
// ExternalSync engine handler
// ============================================================

/**
 * Procesa un job con @batchactions/core via ExternalSyncService.
 * Extrae sync_context del metadata y llama a resumeSync().
 */
async function processExternalSyncJob(
  jobId: string,
  metadata: Record<string, unknown>,
  sourceTotalRecords: number,
  wasPending: boolean,
  wasInterrupted: boolean
): Promise<{
  jobId: string;
  success: boolean;
  status: string;
  processedRecords: number;
  totalRecords: number;
  percentage: number;
  hasMore: boolean;
  lockAcquired: boolean;
  wasPending: boolean;
  wasInterrupted: boolean;
}> {
  const syncContext = metadata.sync_context as SyncContext | undefined;

  if (!syncContext?.dataSourceId) {
    throw new Error(`ExternalSync job ${jobId} missing sync_context.dataSourceId in metadata`);
  }

  const service = getExternalSyncService();
  const result = await service.resumeSync({
    jobId,
    syncContext,
    maxDurationMs: VERCEL_CRON_MAX_DURATION_MS,
    sourceTotalRecords,
  });

  const hasMore = !result.chunk.done;

  return {
    jobId,
    success: true,
    status: hasMore ? "WAITING" : "COMPLETED",
    processedRecords: result.progress.processedRecords,
    totalRecords: result.progress.totalRecords,
    percentage: result.progress.percentage,
    hasMore,
    lockAcquired: true,
    wasPending,
    wasInterrupted,
  };
}

/**
 * GET /api/cron/process-waiting-jobs
 * Called by Vercel Cron (every minute)
 */
export async function GET(request: NextRequest) {
  return processWaitingJobs(request);
}

/**
 * POST /api/cron/process-waiting-jobs
 * Manual trigger (for testing and development)
 */
export async function POST(request: NextRequest) {
  return processWaitingJobs(request);
}
