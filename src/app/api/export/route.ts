/**
 * Export Batches API
 *
 * GET /api/export - List export batches (filtered by AED_CSV_EXPORT/AED_JSON_EXPORT type)
 * POST /api/export - Create a new export job
 *
 * This is a convenience endpoint that wraps the generic batch job API
 * with filtering for exports and transforms the response to the
 * format expected by the frontend.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { JobType } from "@/batch/domain";
import { PrismaBatchJobRepository } from "@/batch/infrastructure";
import { BatchJobOrchestrator } from "@/batch/application";
import { CreateBatchJobUseCase } from "@/batch/application/use-cases";
import { initializeProcessors } from "@/batch/application/processors";
import { ExportFilters } from "@/export/domain/ports/IExportRepository";

const repository = new PrismaBatchJobRepository(prisma);

// Initialize processors
initializeProcessors(prisma);

const orchestrator = new BatchJobOrchestrator(repository);

/**
 * GET /api/export
 * List export batches with pagination
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    await requireAuth(request);

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") ?? "1", 10);
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10), 100);
    const skip = (page - 1) * limit;

    // Query batch jobs of export types
    const exportTypes = [JobType.AED_CSV_EXPORT, JobType.AED_JSON_EXPORT];

    const [jobs, total] = await Promise.all([
      prisma.batchJob.findMany({
        where: {
          type: { in: exportTypes },
        },
        orderBy: {
          created_at: "desc",
        },
        skip,
        take: limit,
        include: {
          artifacts: {
            where: {
              type: "FILE",
            },
            take: 1,
          },
        },
      }),
      prisma.batchJob.count({
        where: {
          type: { in: exportTypes },
        },
      }),
    ]);

    // Transform to format expected by frontend
    const data = jobs.map((job) => {
      const config = job.config as Record<string, unknown>;
      const exportFile = job.artifacts[0];

      return {
        id: job.id,
        name: job.name,
        description: job.description,
        filters: (config?.filters as ExportFilters) ?? null,
        fileName: exportFile?.name ?? null,
        fileUrl: exportFile?.file_url ?? null,
        fileSize: exportFile?.file_size ?? null,
        fileHash: exportFile?.file_hash ?? null,
        totalRecords: job.total_records,
        successfulRecords: job.successful_records,
        failedRecords: job.failed_records,
        status: job.status,
        startedAt: job.started_at,
        completedAt: job.completed_at,
        durationSeconds: job.duration_seconds,
        errorMessage: ((job.error_summary as Record<string, unknown>)?.message as string) ?? null,
        exportedBy: job.created_by,
        createdAt: job.created_at,
        updatedAt: job.updated_at,
      };
    });

    return NextResponse.json({
      success: true,
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error listing export batches:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/export
 * Create a new export job
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const user = await requireAuth(request);

    const body = await request.json();

    // Validate request
    if (!body.name) {
      return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 });
    }

    // Determine format
    const format = body.format || "csv";
    const jobType = format === "json" ? JobType.AED_JSON_EXPORT : JobType.AED_CSV_EXPORT;

    // Create the export job
    const useCase = new CreateBatchJobUseCase(orchestrator);
    const result = await useCase.execute({
      type: jobType,
      name: body.name,
      description: body.description,
      config: {
        type: jobType,
        filters: body.filters ?? {},
        fields: body.fields ?? [],
        includeImages: body.includeImages ?? false,
        format,
        // Default values
        chunkSize: 500,
        maxRetries: 3,
        retryDelayMs: 1000,
        timeoutMs: 90000,
        checkpointFrequency: 100,
        heartbeatIntervalMs: 30000,
        skipOnError: true,
        dryRun: false,
        validateOnly: false,
        notifyOnComplete: false,
        notifyOnError: false,
      },
      createdBy: user.userId,
      startImmediately: true,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(
      {
        success: true,
        job: result.job?.toJSON(),
        started: result.started,
      },
      { status: 202 }
    );
  } catch (error) {
    console.error("Error creating export job:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}
