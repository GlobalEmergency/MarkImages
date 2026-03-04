/**
 * Prisma Batch Job Repository
 *
 * Implementation of IBatchJobRepository using Prisma ORM.
 */

import { PrismaClient, BatchJobStatus, BatchJobType } from "@/generated/client/client";
import {
  IBatchJobRepository,
  BatchJob,
  BatchJobData,
  BatchJobFilter,
  BatchJobPagination,
  BatchJobSort,
  PaginatedBatchJobs,
  JobCheckpoint,
  JobProgress,
  JobResult,
  JobStatus,
  JobType,
  JobConfig,
} from "@/batch/domain";

export class PrismaBatchJobRepository implements IBatchJobRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(job: BatchJob): Promise<BatchJob> {
    const data = job.toData();

    const created = await this.prisma.batchJob.create({
      data: {
        id: data.id,
        type: data.type as BatchJobType,
        name: data.name,
        description: data.description,
        status: this.mapStatusToPrisma(data.status),
        config: data.config as object,
        total_records: data.progress.totalRecords,
        processed_records: data.progress.processedRecords,
        successful_records: data.progress.successfulRecords,
        failed_records: data.progress.failedRecords,
        skipped_records: data.progress.skippedRecords,
        warning_records: data.progress.warningRecords,
        current_chunk: data.progress.currentChunk,
        total_chunks: data.progress.totalChunks,
        started_at: data.startedAt,
        completed_at: data.completedAt,
        last_heartbeat: data.lastHeartbeat,
        last_checkpoint_index: data.lastCheckpointIndex,
        resume_count: data.resumeCount,
        created_by: data.createdBy,
        organization_id: data.organizationId,
        parent_job_id: data.parentJobId,
        data_source_id: data.dataSourceId,
        metadata: data.metadata as object,
        tags: data.tags,
      },
    });

    return this.mapToDomain(created);
  }

  async update(job: BatchJob): Promise<BatchJob> {
    const data = job.toData();

    const updated = await this.prisma.batchJob.update({
      where: { id: data.id },
      data: {
        status: this.mapStatusToPrisma(data.status),
        total_records: data.progress.totalRecords,
        processed_records: data.progress.processedRecords,
        successful_records: data.progress.successfulRecords,
        failed_records: data.progress.failedRecords,
        skipped_records: data.progress.skippedRecords,
        warning_records: data.progress.warningRecords,
        current_chunk: data.progress.currentChunk,
        total_chunks: data.progress.totalChunks,
        result: data.result.toJSON() as object,
        started_at: data.startedAt,
        completed_at: data.completedAt,
        duration_seconds:
          data.completedAt && data.startedAt
            ? Math.round((data.completedAt.getTime() - data.startedAt.getTime()) / 1000)
            : null,
        last_heartbeat: data.lastHeartbeat,
        last_checkpoint_index: data.lastCheckpointIndex,
        resume_count: data.resumeCount,
        metadata: data.metadata as object,
        tags: data.tags,
        updated_at: new Date(),
      },
    });

    return this.mapToDomain(updated);
  }

  async findById(id: string): Promise<BatchJob | null> {
    const job = await this.prisma.batchJob.findUnique({
      where: { id },
    });

    return job ? this.mapToDomain(job) : null;
  }

  async findMany(
    filter?: BatchJobFilter,
    pagination?: BatchJobPagination,
    sort?: BatchJobSort
  ): Promise<PaginatedBatchJobs> {
    const where = this.buildWhereClause(filter);
    const page = pagination?.page ?? 1;
    const pageSize = pagination?.pageSize ?? 20;

    const [jobs, total] = await Promise.all([
      this.prisma.batchJob.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: sort
          ? { [this.mapSortField(sort.field)]: sort.direction }
          : { created_at: "desc" },
      }),
      this.prisma.batchJob.count({ where }),
    ]);

    return {
      jobs: jobs.map((j) => this.mapToDomain(j)),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async findActiveJobs(options?: {
    types?: JobType[];
    organizationId?: string;
    createdBy?: string;
  }): Promise<BatchJob[]> {
    // Include all non-terminal states to prevent duplicate jobs for same data source
    const activeStatuses: BatchJobStatus[] = [
      "PENDING",
      "QUEUED",
      "IN_PROGRESS",
      "WAITING",
      "RESUMING",
      "PAUSED",
      "INTERRUPTED",
    ];

    const jobs = await this.prisma.batchJob.findMany({
      where: {
        status: { in: activeStatuses },
        ...(options?.types && { type: { in: options.types as BatchJobType[] } }),
        ...(options?.organizationId && { organization_id: options.organizationId }),
        ...(options?.createdBy && { created_by: options.createdBy }),
      },
    });

    return jobs.map((j) => this.mapToDomain(j));
  }

  async findTimedOutJobs(heartbeatThresholdMs: number): Promise<BatchJob[]> {
    const threshold = new Date(Date.now() - heartbeatThresholdMs);

    const jobs = await this.prisma.batchJob.findMany({
      where: {
        status: { in: ["IN_PROGRESS", "RESUMING"] as BatchJobStatus[] },
        last_heartbeat: {
          lt: threshold,
        },
      },
    });

    return jobs.map((j) => this.mapToDomain(j));
  }

  async findResumableJobs(options?: {
    types?: JobType[];
    organizationId?: string;
  }): Promise<BatchJob[]> {
    const resumableStatuses: BatchJobStatus[] = [
      "PENDING",
      "QUEUED",
      "WAITING",
      "PAUSED",
      "INTERRUPTED",
    ];

    const jobs = await this.prisma.batchJob.findMany({
      where: {
        status: { in: resumableStatuses },
        ...(options?.types && { type: { in: options.types as BatchJobType[] } }),
        ...(options?.organizationId && { organization_id: options.organizationId }),
      },
    });

    return jobs.map((j) => this.mapToDomain(j));
  }

  async findWaitingJobs(limit: number = 10): Promise<BatchJob[]> {
    const jobs = await this.prisma.batchJob.findMany({
      where: {
        status: "WAITING" as BatchJobStatus,
      },
      orderBy: [
        { last_heartbeat: "asc" }, // Prioritize jobs that haven't been touched recently
        { created_at: "asc" }, // Then by creation time
      ],
      take: limit,
    });

    return jobs.map((j) => this.mapToDomain(j));
  }

  /**
   * Atomically transition a job from WAITING to IN_PROGRESS
   * Returns true if the transition was successful (lock acquired)
   * Returns false if the job is already being processed or not in WAITING state
   *
   * This prevents race conditions when multiple cron jobs run concurrently
   */
  async tryAcquireJobLock(jobId: string): Promise<boolean> {
    try {
      // Use raw SQL for atomic update with WHERE condition
      const result = await this.prisma.$executeRaw`
        UPDATE "batch_jobs"
        SET
          status = 'IN_PROGRESS',
          last_heartbeat = NOW(),
          updated_at = NOW()
        WHERE id = ${jobId}::uuid
          AND status = 'WAITING'
      `;

      // result is the number of affected rows
      // 1 = lock acquired successfully
      // 0 = job was not in WAITING state (already processing or completed)
      return result === 1;
    } catch (error) {
      console.error(`Error acquiring lock for job ${jobId}:`, error);
      return false;
    }
  }

  /**
   * Release job lock and return to WAITING state
   * Used when a cron job needs to yield processing (e.g., timeout approaching)
   */
  async releaseJobLock(jobId: string): Promise<void> {
    await this.prisma.batchJob.update({
      where: { id: jobId },
      data: {
        status: "WAITING" as BatchJobStatus,
        last_heartbeat: new Date(),
        updated_at: new Date(),
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.batchJob.delete({
      where: { id },
    });
  }

  async deleteOldJobs(olderThan: Date): Promise<number> {
    const result = await this.prisma.batchJob.deleteMany({
      where: {
        created_at: { lt: olderThan },
        status: {
          in: ["COMPLETED", "COMPLETED_WITH_WARNINGS", "FAILED", "CANCELLED"] as BatchJobStatus[],
        },
      },
    });

    return result.count;
  }

  // Checkpoint operations

  async saveCheckpoint(
    checkpoint: Omit<JobCheckpoint, "id" | "createdAt">
  ): Promise<JobCheckpoint> {
    const created = await this.prisma.batchJobCheckpoint.upsert({
      where: {
        job_id_record_index: {
          job_id: checkpoint.jobId,
          record_index: checkpoint.recordIndex,
        },
      },
      update: {
        status: checkpoint.status,
        error_message: checkpoint.errorMessage,
        processing_time_ms: checkpoint.processingTimeMs,
        record_data: checkpoint.recordData as object,
      },
      create: {
        job_id: checkpoint.jobId,
        record_index: checkpoint.recordIndex,
        record_reference: checkpoint.recordReference,
        record_hash: checkpoint.recordHash,
        status: checkpoint.status,
        error_message: checkpoint.errorMessage,
        processing_time_ms: checkpoint.processingTimeMs,
        record_data: checkpoint.recordData as object,
      },
    });

    return {
      id: created.id,
      jobId: created.job_id,
      recordIndex: created.record_index,
      recordReference: created.record_reference ?? undefined,
      recordHash: created.record_hash ?? undefined,
      status: created.status as JobCheckpoint["status"],
      errorMessage: created.error_message ?? undefined,
      processingTimeMs: created.processing_time_ms ?? undefined,
      recordData: created.record_data as Record<string, unknown> | undefined,
      createdAt: created.created_at,
    };
  }

  async saveCheckpoints(checkpoints: Omit<JobCheckpoint, "id" | "createdAt">[]): Promise<void> {
    await this.prisma.$transaction(
      checkpoints.map((cp) =>
        this.prisma.batchJobCheckpoint.upsert({
          where: {
            job_id_record_index: {
              job_id: cp.jobId,
              record_index: cp.recordIndex,
            },
          },
          update: {
            status: cp.status,
            error_message: cp.errorMessage,
            processing_time_ms: cp.processingTimeMs,
          },
          create: {
            job_id: cp.jobId,
            record_index: cp.recordIndex,
            record_reference: cp.recordReference,
            record_hash: cp.recordHash,
            status: cp.status,
            error_message: cp.errorMessage,
            processing_time_ms: cp.processingTimeMs,
            record_data: cp.recordData as object,
          },
        })
      )
    );
  }

  async getCheckpoints(
    jobId: string,
    options?: {
      status?: JobCheckpoint["status"];
      fromIndex?: number;
      limit?: number;
    }
  ): Promise<JobCheckpoint[]> {
    const checkpoints = await this.prisma.batchJobCheckpoint.findMany({
      where: {
        job_id: jobId,
        ...(options?.status && { status: options.status }),
        ...(options?.fromIndex !== undefined && {
          record_index: { gte: options.fromIndex },
        }),
      },
      orderBy: { record_index: "asc" },
      take: options?.limit,
    });

    return checkpoints.map((cp) => ({
      id: cp.id,
      jobId: cp.job_id,
      recordIndex: cp.record_index,
      recordReference: cp.record_reference ?? undefined,
      recordHash: cp.record_hash ?? undefined,
      status: cp.status as JobCheckpoint["status"],
      errorMessage: cp.error_message ?? undefined,
      processingTimeMs: cp.processing_time_ms ?? undefined,
      recordData: cp.record_data as Record<string, unknown> | undefined,
      createdAt: cp.created_at,
    }));
  }

  async getLastCheckpoint(jobId: string): Promise<JobCheckpoint | null> {
    const checkpoint = await this.prisma.batchJobCheckpoint.findFirst({
      where: { job_id: jobId },
      orderBy: { record_index: "desc" },
    });

    if (!checkpoint) return null;

    return {
      id: checkpoint.id,
      jobId: checkpoint.job_id,
      recordIndex: checkpoint.record_index,
      recordReference: checkpoint.record_reference ?? undefined,
      recordHash: checkpoint.record_hash ?? undefined,
      status: checkpoint.status as JobCheckpoint["status"],
      errorMessage: checkpoint.error_message ?? undefined,
      processingTimeMs: checkpoint.processing_time_ms ?? undefined,
      recordData: checkpoint.record_data as Record<string, unknown> | undefined,
      createdAt: checkpoint.created_at,
    };
  }

  async deleteCheckpoints(jobId: string): Promise<void> {
    await this.prisma.batchJobCheckpoint.deleteMany({
      where: { job_id: jobId },
    });
  }

  async isRecordProcessed(jobId: string, recordHash: string): Promise<boolean> {
    const count = await this.prisma.batchJobCheckpoint.count({
      where: {
        job_id: jobId,
        record_hash: recordHash,
        status: "SUCCESS",
      },
    });

    return count > 0;
  }

  // Heartbeat operations

  async updateHeartbeat(jobId: string): Promise<void> {
    await this.prisma.batchJob.update({
      where: { id: jobId },
      data: { last_heartbeat: new Date() },
    });
  }

  async getLastHeartbeat(jobId: string): Promise<Date | null> {
    const job = await this.prisma.batchJob.findUnique({
      where: { id: jobId },
      select: { last_heartbeat: true },
    });

    return job?.last_heartbeat ?? null;
  }

  /**
   * Count records created by this job
   * Used to recover progress after interruption
   */
  async countCreatedRecords(jobId: string): Promise<number> {
    return await this.prisma.aed.count({
      where: { batch_job_id: jobId },
    });
  }

  // Statistics

  async getStats(options?: {
    organizationId?: string;
    dateRange?: { from: Date; to: Date };
  }): Promise<{
    total: number;
    byStatus: Record<JobStatus, number>;
    byType: Record<JobType, number>;
    averageDurationMs: number;
    successRate: number;
  }> {
    const where = {
      ...(options?.organizationId && { organization_id: options.organizationId }),
      ...(options?.dateRange && {
        created_at: {
          gte: options.dateRange.from,
          lte: options.dateRange.to,
        },
      }),
    };

    const [total, statusCounts, typeCounts, avgDuration, successCount] = await Promise.all([
      this.prisma.batchJob.count({ where }),
      this.prisma.batchJob.groupBy({
        by: ["status"],
        where,
        _count: { status: true },
      }),
      this.prisma.batchJob.groupBy({
        by: ["type"],
        where,
        _count: { type: true },
      }),
      this.prisma.batchJob.aggregate({
        where: {
          ...where,
          duration_seconds: { not: null },
        },
        _avg: { duration_seconds: true },
      }),
      this.prisma.batchJob.count({
        where: {
          ...where,
          status: { in: ["COMPLETED", "COMPLETED_WITH_WARNINGS"] as BatchJobStatus[] },
        },
      }),
    ]);

    const byStatus = Object.values(JobStatus).reduce(
      (acc, status) => {
        const found = statusCounts.find((s) => s.status === status);
        acc[status] = found?._count.status ?? 0;
        return acc;
      },
      {} as Record<JobStatus, number>
    );

    const byType = Object.values(JobType).reduce(
      (acc, type) => {
        const found = typeCounts.find((t) => t.type === type);
        acc[type] = found?._count.type ?? 0;
        return acc;
      },
      {} as Record<JobType, number>
    );

    return {
      total,
      byStatus,
      byType,
      averageDurationMs: (avgDuration._avg.duration_seconds ?? 0) * 1000,
      successRate: total > 0 ? (successCount / total) * 100 : 0,
    };
  }

  // Private helpers

  private mapToDomain(prismaJob: {
    id: string;
    type: string;
    name: string;
    description: string | null;
    status: string;
    config: unknown;
    total_records: number;
    processed_records: number;
    successful_records: number;
    failed_records: number;
    skipped_records: number;
    warning_records: number;
    current_chunk: number;
    total_chunks: number;
    result: unknown;
    error_summary: unknown;
    started_at: Date | null;
    completed_at: Date | null;
    duration_seconds: number | null;
    last_heartbeat: Date | null;
    last_checkpoint_index: number;
    resume_count: number;
    created_by: string;
    organization_id: string | null;
    parent_job_id: string | null;
    data_source_id: string | null;
    metadata: unknown;
    tags: string[];
    created_at: Date;
    updated_at: Date;
  }): BatchJob {
    const progressData = {
      totalRecords: prismaJob.total_records,
      processedRecords: prismaJob.processed_records,
      successfulRecords: prismaJob.successful_records,
      failedRecords: prismaJob.failed_records,
      skippedRecords: prismaJob.skipped_records,
      warningRecords: prismaJob.warning_records,
      currentChunk: prismaJob.current_chunk,
      totalChunks: prismaJob.total_chunks,
      lastProcessedIndex: prismaJob.last_checkpoint_index,
      estimatedRemainingMs: null,
      startedAt: prismaJob.started_at,
      lastActivityAt: prismaJob.last_heartbeat,
    };

    const data: BatchJobData = {
      id: prismaJob.id,
      type: prismaJob.type as JobType,
      name: prismaJob.name,
      description: prismaJob.description ?? undefined,
      status: this.mapStatusToDomain(prismaJob.status),
      config: prismaJob.config as JobConfig,
      progress: JobProgress.create(progressData),
      result: prismaJob.result
        ? JobResult.fromJSON(prismaJob.result as ReturnType<JobResult["toJSON"]>)
        : JobResult.empty(),
      createdBy: prismaJob.created_by,
      organizationId: prismaJob.organization_id ?? undefined,
      parentJobId: prismaJob.parent_job_id ?? undefined,
      dataSourceId: prismaJob.data_source_id ?? undefined,
      createdAt: prismaJob.created_at,
      updatedAt: prismaJob.updated_at,
      startedAt: prismaJob.started_at,
      completedAt: prismaJob.completed_at,
      lastHeartbeat: prismaJob.last_heartbeat,
      lastCheckpointIndex: prismaJob.last_checkpoint_index,
      resumeCount: prismaJob.resume_count,
      metadata: (prismaJob.metadata as Record<string, unknown>) ?? {},
      tags: prismaJob.tags,
    };

    return BatchJob.reconstitute(data);
  }

  private mapStatusToPrisma(status: JobStatus): BatchJobStatus {
    return status as BatchJobStatus;
  }

  private mapStatusToDomain(status: string): JobStatus {
    return status as JobStatus;
  }

  private mapSortField(field: string): string {
    const mapping: Record<string, string> = {
      createdAt: "created_at",
      updatedAt: "updated_at",
      name: "name",
      status: "status",
    };
    return mapping[field] || "created_at";
  }

  private buildWhereClause(filter?: BatchJobFilter) {
    if (!filter) return {};

    return {
      ...(filter.types && { type: { in: filter.types as BatchJobType[] } }),
      ...(filter.statuses && {
        status: { in: filter.statuses.map((s) => this.mapStatusToPrisma(s)) },
      }),
      ...(filter.createdBy && { created_by: filter.createdBy }),
      ...(filter.organizationId && { organization_id: filter.organizationId }),
      ...(filter.dataSourceId && { data_source_id: filter.dataSourceId }),
      ...(filter.tags && { tags: { hasSome: filter.tags } }),
      ...(filter.createdAfter && { created_at: { gte: filter.createdAfter } }),
      ...(filter.createdBefore && { created_at: { lte: filter.createdBefore } }),
    };
  }
}
