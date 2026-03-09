/**
 * Single Batch Job API
 *
 * GET /api/batch/[jobId] - Get job status
 * DELETE /api/batch/[jobId] - Delete job
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { PrismaBatchJobRepository } from "@/batch/infrastructure";
import { BatchJobOrchestrator } from "@/batch/application";
import { GetBatchJobStatusUseCase } from "@/batch/application/use-cases";
import { initializeProcessors } from "@/batch/application/processors";

const repository = new PrismaBatchJobRepository(prisma);

// Initialize processors
initializeProcessors(prisma);

const orchestrator = new BatchJobOrchestrator(repository);

interface RouteParams {
  params: Promise<{ jobId: string }>;
}

/**
 * GET /api/batch/[jobId]
 * Get the status and progress of a batch job
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { jobId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const includeResult = searchParams.get("includeResult") === "true";

    const useCase = new GetBatchJobStatusUseCase(orchestrator);
    const result = await useCase.execute({
      jobId,
      includeResult,
    });

    if (!result.success) {
      if (result.error?.includes("not found")) {
        return NextResponse.json({ success: false, error: result.error }, { status: 404 });
      }
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      job: result.job,
      progress: result.progress,
      result: result.result,
      canContinue: result.canContinue,
      canCancel: result.canCancel,
      isComplete: result.isComplete,
    });
  } catch (error) {
    console.error("Error getting batch job status:", error);
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
 * DELETE /api/batch/[jobId]
 * Delete a batch job (only if terminal)
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { jobId } = await params;

    // Check if job exists and is terminal
    const status = await orchestrator.getStatus(jobId);

    if (!status.isComplete) {
      return NextResponse.json(
        { success: false, error: "Can only delete completed jobs" },
        { status: 400 }
      );
    }

    await repository.delete(jobId);

    return NextResponse.json({
      success: true,
      message: "Job deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting batch job:", error);

    if (error instanceof Error && error.message.includes("not found")) {
      return NextResponse.json({ success: false, error: error.message }, { status: 404 });
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
