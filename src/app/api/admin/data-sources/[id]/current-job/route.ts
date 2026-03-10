/**
 * Admin API - Get Data Source Current Job
 *
 * GET /api/admin/data-sources/[id]/current-job
 * Get the current active job for a specific data source.
 *
 * Queries batch_jobs table directly — works with both legacy and
 * externalsync engine jobs.
 *
 * Only accessible for users with ADMIN role
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { BatchJobStatus } from "@/generated/client/enums";

const ACTIVE_STATUSES: BatchJobStatus[] = [
  "PENDING",
  "QUEUED",
  "IN_PROGRESS",
  "RESUMING",
  "WAITING",
  "PAUSED",
  "INTERRUPTED",
];

const TERMINAL_STATUSES: BatchJobStatus[] = [
  "COMPLETED",
  "COMPLETED_WITH_WARNINGS",
  "FAILED",
  "CANCELLED",
];

/**
 * GET /api/admin/data-sources/[id]/current-job
 * Get current job for a data source
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(request);
    const { id } = await params;

    // 1. Look for an active job for this data source
    let job = await prisma.batchJob.findFirst({
      where: {
        data_source_id: id,
        status: { in: ACTIVE_STATUSES },
      },
      orderBy: { updated_at: "desc" },
    });

    // 2. If no active job, get most recent terminal job for reference
    if (!job) {
      job = await prisma.batchJob.findFirst({
        where: {
          data_source_id: id,
          status: { in: TERMINAL_STATUSES },
        },
        orderBy: { updated_at: "desc" },
      });
    }

    if (!job) {
      return NextResponse.json({
        success: true,
        data: null,
        message: "No hay jobs activos para este data source",
      });
    }

    // Format response matching frontend CurrentJob interface
    const metadata = job.metadata as Record<string, unknown> | null;
    const engine = (metadata?.engine as string) || "legacy";
    const skippedRecords = Math.max(
      0,
      job.processed_records - job.successful_records - job.failed_records
    );
    const percentage =
      job.total_records > 0 ? Math.round((job.processed_records / job.total_records) * 100) : 0;
    const durationMs = job.started_at
      ? (job.completed_at ?? new Date()).getTime() - job.started_at.getTime()
      : 0;

    return NextResponse.json({
      success: true,
      data: {
        id: job.id,
        name: job.name,
        type: job.type,
        status: job.status,
        engine,
        progress: {
          percentage,
          totalRecords: job.total_records,
          processedRecords: job.processed_records,
          successfulRecords: job.successful_records,
          failedRecords: job.failed_records,
          skippedRecords,
          currentChunk: job.current_chunk,
          totalChunks: job.total_chunks,
        },
        result: buildResultFromMetadata(
          metadata,
          job.successful_records,
          skippedRecords,
          job.failed_records
        ),
        startedAt: job.started_at,
        completedAt: job.completed_at,
        lastHeartbeat: job.last_heartbeat,
        durationMs,
        resumeCount: (metadata?.resume_count as number) ?? 0,
        metadata: metadata ?? undefined,
        createdAt: job.created_at,
        updatedAt: job.updated_at,
      },
      message: `Job encontrado: ${job.status}`,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("[API] Error getting current job:", error);
    return NextResponse.json(
      {
        error: "Error al obtener job actual",
        details: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}

// ============================================================
// Helpers
// ============================================================

/**
 * Build result breakdown from job metadata (sync_stats).
 * Falls back to legacy behavior (all successful = created) if no stats available.
 */
function buildResultFromMetadata(
  metadata: Record<string, unknown> | null,
  successfulRecords: number,
  skippedRecords: number,
  failedRecords: number
) {
  const syncStats = metadata?.sync_stats as
    | { created?: number; updated?: number; skipped?: number }
    | undefined;

  if (syncStats) {
    return {
      recordsCreated: syncStats.created ?? 0,
      recordsUpdated: syncStats.updated ?? 0,
      recordsSkipped: syncStats.skipped ?? skippedRecords,
      recordsDeactivated: 0,
      errorCount: failedRecords,
    };
  }

  // Legacy fallback: no breakdown available
  return {
    recordsCreated: successfulRecords,
    recordsUpdated: 0,
    recordsSkipped: skippedRecords,
    recordsDeactivated: 0,
    errorCount: failedRecords,
  };
}
