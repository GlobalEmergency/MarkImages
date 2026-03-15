/**
 * Admin API para ejecutar sincronización de una fuente de datos
 * Solo accesible para usuarios con rol ADMIN
 *
 * Uses ExternalSyncService with @batchactions/core BatchEngine
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, AuthError } from "@/lib/auth";
import { getExternalSyncService } from "@/import/infrastructure/factories/createBulkImportService";
import type { SyncContext } from "@/import/application/services/ExternalSyncService";
import { DEFAULT_BATCH_SIZE } from "@/import/constants";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/admin/data-sources/[id]/sync
 * Ejecuta la sincronización de una fuente de datos
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAdmin(request);
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    // Verificar que la fuente existe y está activa
    const dataSource = await prisma.externalDataSource.findUnique({
      where: { id },
    });

    if (!dataSource) {
      return NextResponse.json({ error: "Fuente de datos no encontrada" }, { status: 404 });
    }

    if (!dataSource.is_active) {
      return NextResponse.json({ error: "La fuente de datos no está activa" }, { status: 400 });
    }

    const service = getExternalSyncService();
    const parsedBatchSize = body.batchSize ? parseInt(body.batchSize, 10) : DEFAULT_BATCH_SIZE;
    const batchSize =
      isNaN(parsedBatchSize) || parsedBatchSize < 1 ? DEFAULT_BATCH_SIZE : parsedBatchSize;

    // Check if we should continue an existing job
    const continueJobId = body.continueJobId as string | undefined;

    if (continueJobId) {
      const extracted = await extractSyncContextAndTotal(continueJobId, id, dataSource.name);
      if (!extracted) {
        return NextResponse.json({ error: "Job not found or not a sync job" }, { status: 400 });
      }

      const result = await service.resumeSync({
        jobId: continueJobId,
        syncContext: extracted.syncContext,
        sourceTotalRecords: extracted.totalRecords,
      });
      return await buildSyncResponse(result, id, true);
    }

    // Check for existing active job for this data source
    const existingActiveJob = await prisma.batchJob.findFirst({
      where: {
        type: "AED_EXTERNAL_SYNC",
        data_source_id: id,
        status: { in: ["PENDING", "QUEUED", "IN_PROGRESS", "WAITING", "PAUSED", "INTERRUPTED"] },
      },
      orderBy: { created_at: "desc" },
    });

    if (existingActiveJob) {
      const syncContext = extractSyncContextFromMetadata(
        existingActiveJob.metadata,
        existingActiveJob.config,
        id,
        dataSource.name
      );

      if (syncContext) {
        const result = await service.resumeSync({
          jobId: existingActiveJob.id,
          syncContext,
          sourceTotalRecords: existingActiveJob.total_records,
        });
        return await buildSyncResponse(result, id, true);
      }
    }

    // Start new sync job
    const result = await service.startSync({
      dataSourceId: id,
      userId: user.userId,
      dryRun: body.dryRun === true,
      batchSize,
    });

    const hasMore = !result.chunk.done;

    // Read actual sync_stats from job metadata if available
    const jobMeta = await prisma.batchJob.findUnique({
      where: { id: result.jobId },
      select: { metadata: true },
    });
    const syncStats = (jobMeta?.metadata as Record<string, unknown>)?.sync_stats as
      | { created?: number; updated?: number; skipped?: number }
      | undefined;

    return NextResponse.json({
      success: true,
      data: {
        jobId: result.jobId,
        dataSourceId: id,
        dryRun: body.dryRun === true,
        stats: {
          total: result.progress.totalRecords,
          processed: result.progress.processedRecords,
          created:
            syncStats?.created ??
            Math.max(0, result.progress.processedRecords - result.progress.failedRecords),
          updated: syncStats?.updated ?? 0,
          skipped: syncStats?.skipped ?? 0,
          failed: result.progress.failedRecords,
        },
        progress: {
          total: result.progress.totalRecords,
          processed: result.progress.processedRecords,
          percentage: result.progress.percentage,
          hasMore,
          status: hasMore ? "WAITING" : "COMPLETED",
        },
      },
      message: hasMore
        ? `Sincronización iniciada. Procesando en segundo plano.`
        : `Sincronización completada: ${result.progress.processedRecords} registros procesados`,
    });
  } catch (error) {
    console.error("Error during sync:", error);

    if (error instanceof Error && error.message.includes("timeout")) {
      return NextResponse.json(
        {
          error: "Timeout durante la sincronización",
          details:
            "El proceso puede continuar en segundo plano. Recarga la página para ver el estado.",
        },
        { status: 504 }
      );
    }

    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json(
      {
        error: "Error durante la sincronización",
        details: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/data-sources/[id]/sync
 * Obtiene el estado de la última sincronización
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await requireAdmin(request);
    const { id } = await params;

    // Find the last sync job for this data source
    const lastJob = await prisma.batchJob.findFirst({
      where: {
        type: "AED_EXTERNAL_SYNC",
        data_source_id: id,
      },
      orderBy: { created_at: "desc" },
    });

    if (!lastJob) {
      return NextResponse.json({
        success: true,
        data: null,
        message: "No hay sincronizaciones previas",
      });
    }

    const errors = await prisma.batchJobError.findMany({
      where: { job_id: lastJob.id },
      take: 10,
      orderBy: { created_at: "desc" },
    });

    const canContinue = ["WAITING", "PAUSED", "INTERRUPTED"].includes(lastJob.status);

    return NextResponse.json({
      success: true,
      data: {
        jobId: lastJob.id,
        name: lastJob.name,
        status: lastJob.status,
        totalRecords: lastJob.total_records,
        successfulRecords: lastJob.successful_records,
        failedRecords: lastJob.failed_records,
        createdAt: lastJob.created_at,
        completedAt: lastJob.completed_at,
        lastHeartbeat: lastJob.last_heartbeat,
        canContinue,
        recentErrors: errors.map((err) => ({
          recordIndex: err.record_index,
          errorType: err.error_type,
          message: err.error_message,
          severity: err.severity,
        })),
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("Error fetching sync status:", error);
    return NextResponse.json(
      { error: "Error al obtener el estado de sincronización" },
      { status: 500 }
    );
  }
}

// ============================================================
// Helpers
// ============================================================

async function extractSyncContextAndTotal(
  jobId: string,
  dataSourceId: string,
  dataSourceName: string
): Promise<{ syncContext: SyncContext; totalRecords: number } | null> {
  const job = await prisma.batchJob.findUnique({
    where: { id: jobId },
    select: { metadata: true, config: true, total_records: true },
  });

  if (!job) return null;
  const syncContext = extractSyncContextFromMetadata(
    job.metadata,
    job.config,
    dataSourceId,
    dataSourceName
  );
  if (!syncContext) return null;
  return { syncContext, totalRecords: job.total_records };
}

function extractSyncContextFromMetadata(
  metadata: unknown,
  config: unknown,
  dataSourceId: string,
  dataSourceName: string
): SyncContext | null {
  const meta = metadata as Record<string, unknown> | null;
  const conf = config as Record<string, unknown> | null;

  // New engine: sync_context in metadata
  const syncContext = meta?.sync_context as Record<string, unknown> | undefined;
  if (meta?.engine === "externalsync" && syncContext) {
    const scDsId = syncContext.dataSourceId as string;
    if (scDsId !== dataSourceId) return null;
    return {
      dataSourceId: scDsId,
      sourceOrigin: (syncContext.sourceOrigin as string) || "",
      syncFrequency: (syncContext.syncFrequency as string) || "MANUAL",
      regionCode: (syncContext.regionCode as string) || "",
      dataSourceName: (syncContext.dataSourceName as string) || dataSourceName,
      dryRun: (syncContext.dryRun as boolean) || false,
      syncStartTime: (syncContext.syncStartTime as string) || undefined,
    };
  }

  // Legacy engine: dataSourceId in config
  if (conf?.dataSourceId === dataSourceId) {
    return {
      dataSourceId,
      sourceOrigin: "",
      syncFrequency: "MANUAL",
      regionCode: (meta?.regionCode as string) || "",
      dataSourceName: (meta?.dataSourceName as string) || dataSourceName,
      dryRun: (conf?.dryRun as boolean) || false,
    };
  }

  return null;
}

async function buildSyncResponse(
  result: {
    jobId: string;
    chunk: { done: boolean };
    progress: {
      totalRecords: number;
      processedRecords: number;
      failedRecords: number;
      percentage: number;
    };
  },
  dataSourceId: string,
  continued: boolean
) {
  // Read actual sync_stats from job metadata if available
  const jobMeta = await prisma.batchJob.findUnique({
    where: { id: result.jobId },
    select: { metadata: true },
  });
  const syncStats = (jobMeta?.metadata as Record<string, unknown>)?.sync_stats as
    | { created?: number; updated?: number; skipped?: number }
    | undefined;

  const hasMore = !result.chunk.done;
  return NextResponse.json({
    success: true,
    data: {
      jobId: result.jobId,
      dataSourceId,
      continued,
      stats: {
        total: result.progress.totalRecords,
        processed: result.progress.processedRecords,
        created:
          syncStats?.created ??
          Math.max(0, result.progress.processedRecords - result.progress.failedRecords),
        updated: syncStats?.updated ?? 0,
        skipped: syncStats?.skipped ?? 0,
        failed: result.progress.failedRecords,
      },
      progress: {
        total: result.progress.totalRecords,
        processed: result.progress.processedRecords,
        percentage: result.progress.percentage,
        hasMore,
        status: hasMore ? "WAITING" : "COMPLETED",
      },
    },
    message: hasMore
      ? `Procesando: ${result.progress.processedRecords}/${result.progress.totalRecords} registros (${result.progress.percentage}%)`
      : `Sincronización completada: ${result.progress.processedRecords} registros procesados`,
  });
}
