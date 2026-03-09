/**
 * Batch Jobs API
 *
 * POST /api/batch - Create a new batch job
 * GET /api/batch - List batch jobs
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { PrismaBatchJobRepository } from "@/batch/infrastructure";
import { BatchJobOrchestrator } from "@/batch/application";
import { CreateBatchJobUseCase, ListBatchJobsUseCase } from "@/batch/application/use-cases";
import { initializeProcessors } from "@/batch/application/processors";
import { JobType, isValidJobType, JobStatus, isValidJobStatus } from "@/batch/domain";

const repository = new PrismaBatchJobRepository(prisma);

// Initialize processors
initializeProcessors(prisma);

const orchestrator = new BatchJobOrchestrator(repository);

/**
 * POST /api/batch
 * Create and optionally start a new batch job
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.type) {
      return NextResponse.json({ success: false, error: "type is required" }, { status: 400 });
    }

    if (!isValidJobType(body.type)) {
      return NextResponse.json(
        { success: false, error: `Invalid job type: ${body.type}` },
        { status: 400 }
      );
    }

    if (!body.name) {
      return NextResponse.json({ success: false, error: "name is required" }, { status: 400 });
    }

    if (!body.config) {
      return NextResponse.json({ success: false, error: "config is required" }, { status: 400 });
    }

    if (!body.createdBy) {
      return NextResponse.json({ success: false, error: "createdBy is required" }, { status: 400 });
    }

    const useCase = new CreateBatchJobUseCase(orchestrator);
    const result = await useCase.execute({
      type: body.type as JobType,
      name: body.name,
      description: body.description,
      config: {
        type: body.type,
        ...body.config,
        // Apply defaults
        chunkSize: body.config.chunkSize ?? 100,
        maxRetries: body.config.maxRetries ?? 3,
        retryDelayMs: body.config.retryDelayMs ?? 1000,
        timeoutMs: body.config.timeoutMs ?? 90000,
        checkpointFrequency: body.config.checkpointFrequency ?? 10,
        heartbeatIntervalMs: body.config.heartbeatIntervalMs ?? 30000,
        skipOnError: body.config.skipOnError ?? true,
        dryRun: body.config.dryRun ?? false,
        validateOnly: body.config.validateOnly ?? false,
        notifyOnComplete: body.config.notifyOnComplete ?? false,
        notifyOnError: body.config.notifyOnError ?? false,
      },
      createdBy: body.createdBy,
      organizationId: body.organizationId,
      metadata: body.metadata,
      tags: body.tags,
      startImmediately: body.startImmediately ?? false,
    });

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json(
      {
        success: true,
        job: result.job?.toJSON(),
        started: result.started,
        chunkResult: result.chunkResult,
      },
      { status: result.started ? 202 : 201 }
    );
  } catch (error) {
    console.error("Error creating batch job:", error);
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
 * GET /api/batch
 * List batch jobs with filtering and pagination
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Parse filters
    const types = searchParams.get("types")?.split(",").filter(isValidJobType) as
      | JobType[]
      | undefined;
    const statuses = searchParams.get("statuses")?.split(",").filter(isValidJobStatus) as
      | JobStatus[]
      | undefined;
    const createdBy = searchParams.get("createdBy") ?? undefined;
    const organizationId = searchParams.get("organizationId") ?? undefined;
    const tags = searchParams.get("tags")?.split(",") ?? undefined;
    const createdAfter = searchParams.get("createdAfter")
      ? new Date(searchParams.get("createdAfter")!)
      : undefined;
    const createdBefore = searchParams.get("createdBefore")
      ? new Date(searchParams.get("createdBefore")!)
      : undefined;

    // Parse pagination
    const page = parseInt(searchParams.get("page") ?? "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") ?? "20", 10);

    // Parse sorting
    const sortBy = searchParams.get("sortBy") as
      | "createdAt"
      | "updatedAt"
      | "name"
      | "status"
      | undefined;
    const sortDirection = searchParams.get("sortDirection") as "asc" | "desc" | undefined;

    const useCase = new ListBatchJobsUseCase(repository);
    const result = await useCase.execute({
      types,
      statuses,
      createdBy,
      organizationId,
      tags,
      createdAfter,
      createdBefore,
      page,
      pageSize,
      sortBy: sortBy ?? "createdAt",
      sortDirection: sortDirection ?? "desc",
    });

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      jobs: result.jobs,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error("Error listing batch jobs:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
