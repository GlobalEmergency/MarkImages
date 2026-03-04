/**
 * Batch Job Repository Port
 *
 * Defines the contract for batch job persistence operations.
 * Following the repository pattern from DDD.
 */

import { BatchJob } from "../entities/BatchJob";
import { JobStatus, JobType } from "../value-objects";

export interface BatchJobFilter {
  types?: JobType[];
  statuses?: JobStatus[];
  createdBy?: string;
  organizationId?: string;
  parentJobId?: string;
  dataSourceId?: string;
  tags?: string[];
  createdAfter?: Date;
  createdBefore?: Date;
}

export interface BatchJobPagination {
  page: number;
  pageSize: number;
}

export interface BatchJobSort {
  field: "createdAt" | "updatedAt" | "name" | "status";
  direction: "asc" | "desc";
}

export interface PaginatedBatchJobs {
  jobs: BatchJob[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface JobCheckpoint {
  id: string;
  jobId: string;
  recordIndex: number;
  recordReference?: string;
  recordHash?: string;
  status: "SUCCESS" | "FAILED" | "SKIPPED";
  errorMessage?: string;
  processingTimeMs?: number;
  recordData?: Record<string, unknown>;
  createdAt: Date;
}

export interface IBatchJobRepository {
  /**
   * Save a new batch job
   */
  create(job: BatchJob): Promise<BatchJob>;

  /**
   * Update an existing batch job
   */
  update(job: BatchJob): Promise<BatchJob>;

  /**
   * Find job by ID
   */
  findById(id: string): Promise<BatchJob | null>;

  /**
   * Find jobs with filtering, pagination, and sorting
   */
  findMany(
    filter?: BatchJobFilter,
    pagination?: BatchJobPagination,
    sort?: BatchJobSort
  ): Promise<PaginatedBatchJobs>;

  /**
   * Find active jobs (running or waiting)
   */
  findActiveJobs(options?: {
    types?: JobType[];
    organizationId?: string;
    createdBy?: string;
  }): Promise<BatchJob[]>;

  /**
   * Find jobs that have timed out (no heartbeat for X time)
   */
  findTimedOutJobs(heartbeatThresholdMs: number): Promise<BatchJob[]>;

  /**
   * Find jobs that can be resumed
   */
  findResumableJobs(options?: { types?: JobType[]; organizationId?: string }): Promise<BatchJob[]>;

  /**
   * Find jobs in WAITING status that need to be continued
   */
  findWaitingJobs(limit?: number): Promise<BatchJob[]>;

  /**
   * Atomically acquire a lock on a job by transitioning it from WAITING to IN_PROGRESS
   * Returns true if lock was acquired, false if job is not in WAITING state
   *
   * This prevents race conditions when multiple processes try to process the same job
   */
  tryAcquireJobLock(jobId: string): Promise<boolean>;

  /**
   * Release a job lock and return it to WAITING state
   * Used when a process needs to yield processing (e.g., timeout approaching)
   */
  releaseJobLock(jobId: string): Promise<void>;

  /**
   * Delete a job and all its checkpoints
   */
  delete(id: string): Promise<void>;

  /**
   * Delete old completed jobs
   */
  deleteOldJobs(olderThan: Date): Promise<number>;

  // Checkpoint operations

  /**
   * Save a checkpoint
   */
  saveCheckpoint(checkpoint: Omit<JobCheckpoint, "id" | "createdAt">): Promise<JobCheckpoint>;

  /**
   * Save multiple checkpoints at once (for batch operations)
   */
  saveCheckpoints(checkpoints: Omit<JobCheckpoint, "id" | "createdAt">[]): Promise<void>;

  /**
   * Get checkpoints for a job
   */
  getCheckpoints(
    jobId: string,
    options?: {
      status?: JobCheckpoint["status"];
      fromIndex?: number;
      limit?: number;
    }
  ): Promise<JobCheckpoint[]>;

  /**
   * Get the last checkpoint for a job
   */
  getLastCheckpoint(jobId: string): Promise<JobCheckpoint | null>;

  /**
   * Delete checkpoints for a job
   */
  deleteCheckpoints(jobId: string): Promise<void>;

  /**
   * Check if a record was already processed (by hash)
   */
  isRecordProcessed(jobId: string, recordHash: string): Promise<boolean>;

  // Heartbeat operations

  /**
   * Update heartbeat for a job
   */
  updateHeartbeat(jobId: string): Promise<void>;

  /**
   * Get last heartbeat time
   */
  getLastHeartbeat(jobId: string): Promise<Date | null>;

  /**
   * Count records created by this job in the database
   * Used to recover progress after interruption
   */
  countCreatedRecords(jobId: string): Promise<number>;

  // Statistics

  /**
   * Get job statistics
   */
  getStats(options?: { organizationId?: string; dateRange?: { from: Date; to: Date } }): Promise<{
    total: number;
    byStatus: Record<JobStatus, number>;
    byType: Record<JobType, number>;
    averageDurationMs: number;
    successRate: number;
  }>;
}
