/**
 * Use Case: Get Batch Job Details
 *
 * Obtiene los detalles completos de un batch job específico,
 * incluyendo estadísticas de progreso y duración.
 */

import type { PrismaClient } from "@/generated/client/client";

interface GetBatchJobDetailsRequest {
  batchId: string;
}

interface BatchDetails {
  batch: {
    id: string;
    name: string;
    status: string;
    createdAt: string;
    startedAt: string | null;
    completedAt: string | null;
  };
  progress: {
    total: number;
    successful: number;
    failed: number;
    percentage: number;
  };
  stats: {
    durationSeconds: number | null;
  };
}

export class GetBatchJobDetailsUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(request: GetBatchJobDetailsRequest): Promise<BatchDetails | null> {
    const { batchId } = request;

    // Buscar el batch job
    const job = await this.prisma.batchJob.findUnique({
      where: { id: batchId },
      select: {
        id: true,
        name: true,
        status: true,
        total_records: true,
        successful_records: true,
        failed_records: true,
        skipped_records: true,
        started_at: true,
        completed_at: true,
        duration_seconds: true,
        created_at: true,
      },
    });

    if (!job) {
      return null;
    }

    // Calcular porcentaje de progreso
    const total = job.total_records;
    const processed = job.successful_records + job.failed_records + job.skipped_records;
    const percentage = total > 0 ? Math.round((processed / total) * 100) : 0;

    return {
      batch: {
        id: job.id,
        name: job.name,
        status: job.status,
        createdAt: job.created_at.toISOString(),
        startedAt: job.started_at?.toISOString() ?? null,
        completedAt: job.completed_at?.toISOString() ?? null,
      },
      progress: {
        total: job.total_records,
        successful: job.successful_records,
        failed: job.failed_records,
        percentage,
      },
      stats: {
        durationSeconds: job.duration_seconds,
      },
    };
  }
}
