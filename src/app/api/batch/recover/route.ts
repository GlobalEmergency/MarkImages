/**
 * Batch Job Recovery API
 *
 * POST /api/batch/recover - Recover timed-out jobs
 * GET /api/batch/recover - List resumable jobs
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { PrismaBatchJobRepository } from "@/batch/infrastructure";
import { BatchJobOrchestrator } from "@/batch/application";
import { initializeProcessors } from "@/batch/application/processors";
import { JobType, isValidJobType } from "@/batch/domain";

const repository = new PrismaBatchJobRepository(prisma);

// Initialize processors
initializeProcessors(prisma);

const orchestrator = new BatchJobOrchestrator(repository);

/**
 * GET /api/batch/recover
 * List jobs that can be resumed
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const types = searchParams.get("types")?.split(",").filter(isValidJobType) as
      | JobType[]
      | undefined;
    const organizationId = searchParams.get("organizationId") ?? undefined;

    const jobs = await repository.findResumableJobs({
      types,
      organizationId,
    });

    return NextResponse.json({
      success: true,
      jobs: jobs.map((job) => job.toJSON()),
      count: jobs.length,
    });
  } catch (error) {
    console.error("Error listing resumable jobs:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/batch/recover
 * Recover timed-out jobs (mark as interrupted)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const heartbeatThresholdMs = body.heartbeatThresholdMs ?? 180000; // Default 3 minutes

    const recoveredJobs = await orchestrator.recoverTimedOutJobs(heartbeatThresholdMs);

    return NextResponse.json({
      success: true,
      recoveredJobs: recoveredJobs.map((job) => ({
        id: job.id,
        name: job.name,
        type: job.type,
        status: job.status,
        lastCheckpointIndex: job.lastCheckpointIndex,
      })),
      count: recoveredJobs.length,
      message:
        recoveredJobs.length > 0
          ? `Recovered ${recoveredJobs.length} timed-out jobs`
          : "No timed-out jobs found",
    });
  } catch (error) {
    console.error("Error recovering timed-out jobs:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
