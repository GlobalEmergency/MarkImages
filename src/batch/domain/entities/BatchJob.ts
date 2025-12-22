/**
 * BatchJob Entity
 *
 * Aggregate root for batch processing operations.
 * Represents a single batch job that can be executed across multiple
 * serverless invocations (designed for Vercel's execution model).
 */

import { v4 as uuidv4 } from "uuid";
import {
  JobType,
  JobStatus,
  JobProgress,
  JobResult,
  JobConfig,
  BaseJobConfig,
  isValidTransition,
  isTerminalStatus,
  canResumeStatus,
  canCancelStatus,
} from "../value-objects";

export interface BatchJobData {
  id: string;
  type: JobType;
  name: string;
  description?: string;
  status: JobStatus;
  config: JobConfig;
  progress: JobProgress;
  result: JobResult;

  // Ownership and context
  createdBy: string;
  organizationId?: string;
  parentJobId?: string; // For sub-jobs
  dataSourceId?: string; // For external sync jobs

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;

  // Recovery
  lastHeartbeat: Date | null;
  lastCheckpointIndex: number;
  resumeCount: number;

  // Metadata
  metadata: Record<string, unknown>;
  tags: string[];
}

export interface CreateBatchJobParams {
  type: JobType;
  name: string;
  description?: string;
  config: JobConfig;
  createdBy: string;
  organizationId?: string;
  parentJobId?: string;
  dataSourceId?: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
}

export class BatchJob {
  private data: BatchJobData;

  private constructor(data: BatchJobData) {
    this.data = data;
  }

  /**
   * Create a new batch job
   */
  static create(params: CreateBatchJobParams): BatchJob {
    const now = new Date();
    return new BatchJob({
      id: uuidv4(),
      type: params.type,
      name: params.name,
      description: params.description,
      status: JobStatus.PENDING,
      config: params.config,
      progress: JobProgress.empty(),
      result: JobResult.empty(),
      createdBy: params.createdBy,
      organizationId: params.organizationId,
      parentJobId: params.parentJobId,
      dataSourceId: params.dataSourceId,
      createdAt: now,
      updatedAt: now,
      startedAt: null,
      completedAt: null,
      lastHeartbeat: null,
      lastCheckpointIndex: -1,
      resumeCount: 0,
      metadata: params.metadata ?? {},
      tags: params.tags ?? [],
    });
  }

  /**
   * Reconstitute from persistence
   */
  static reconstitute(data: BatchJobData): BatchJob {
    return new BatchJob({
      ...data,
      progress:
        data.progress instanceof JobProgress
          ? data.progress
          : JobProgress.fromJSON(data.progress as unknown as ReturnType<JobProgress["toJSON"]>),
      result:
        data.result instanceof JobResult
          ? data.result
          : JobResult.fromJSON(data.result as unknown as ReturnType<JobResult["toJSON"]>),
    });
  }

  // Getters
  get id(): string {
    return this.data.id;
  }
  get type(): JobType {
    return this.data.type;
  }
  get name(): string {
    return this.data.name;
  }
  get description(): string | undefined {
    return this.data.description;
  }
  get status(): JobStatus {
    return this.data.status;
  }
  get config(): JobConfig {
    return this.data.config;
  }
  get progress(): JobProgress {
    return this.data.progress;
  }
  get result(): JobResult {
    return this.data.result;
  }
  get createdBy(): string {
    return this.data.createdBy;
  }
  get organizationId(): string | undefined {
    return this.data.organizationId;
  }
  get parentJobId(): string | undefined {
    return this.data.parentJobId;
  }
  get createdAt(): Date {
    return this.data.createdAt;
  }
  get updatedAt(): Date {
    return this.data.updatedAt;
  }
  get startedAt(): Date | null {
    return this.data.startedAt;
  }
  get completedAt(): Date | null {
    return this.data.completedAt;
  }
  get lastHeartbeat(): Date | null {
    return this.data.lastHeartbeat;
  }
  get lastCheckpointIndex(): number {
    return this.data.lastCheckpointIndex;
  }
  get resumeCount(): number {
    return this.data.resumeCount;
  }
  get metadata(): Record<string, unknown> {
    return { ...this.data.metadata };
  }
  get tags(): string[] {
    return [...this.data.tags];
  }

  // Computed properties
  get isTerminal(): boolean {
    return isTerminalStatus(this.data.status);
  }

  get canResume(): boolean {
    return canResumeStatus(this.data.status);
  }

  get canCancel(): boolean {
    return canCancelStatus(this.data.status);
  }

  get isRunning(): boolean {
    return this.data.status === JobStatus.IN_PROGRESS || this.data.status === JobStatus.RESUMING;
  }

  get hasTimedOut(): boolean {
    if (!this.data.lastHeartbeat) return false;
    const timeoutMs = (this.data.config as BaseJobConfig).heartbeatIntervalMs * 3;
    return Date.now() - this.data.lastHeartbeat.getTime() > timeoutMs;
  }

  /**
   * Check if job is stuck (no heartbeat for extended period and in active state)
   */
  get isStuck(): boolean {
    if (!this.isRunning) return false;
    if (!this.data.lastHeartbeat) {
      // If running but no heartbeat, check if started recently
      if (this.data.startedAt) {
        const timeSinceStart = Date.now() - this.data.startedAt.getTime();
        return timeSinceStart > 180000; // 3 minutes
      }
      return true;
    }
    const timeoutMs = (this.data.config as BaseJobConfig).heartbeatIntervalMs * 5; // More aggressive
    return Date.now() - this.data.lastHeartbeat.getTime() > timeoutMs;
  }

  /**
   * Get time since last heartbeat in ms
   */
  get timeSinceLastHeartbeat(): number | null {
    if (!this.data.lastHeartbeat) return null;
    return Date.now() - this.data.lastHeartbeat.getTime();
  }

  get durationMs(): number {
    if (!this.data.startedAt) return 0;
    const endTime = this.data.completedAt || new Date();
    return endTime.getTime() - this.data.startedAt.getTime();
  }

  /**
   * Transition to a new status
   */
  private transitionTo(newStatus: JobStatus): void {
    if (!isValidTransition(this.data.status, newStatus)) {
      throw new Error(`Invalid status transition from ${this.data.status} to ${newStatus}`);
    }
    this.data.status = newStatus;
    this.data.updatedAt = new Date();
  }

  /**
   * Start the job
   */
  start(): void {
    this.transitionTo(JobStatus.IN_PROGRESS);
    this.data.startedAt = new Date();
    this.data.lastHeartbeat = new Date();
    this.data.progress = this.data.progress.start();
  }

  /**
   * Mark job as waiting for next chunk (idempotent)
   */
  markWaiting(): void {
    // Idempotent - if already waiting, do nothing
    if (this.data.status === JobStatus.WAITING) {
      return;
    }
    this.transitionTo(JobStatus.WAITING);
  }

  /**
   * Pause the job
   */
  pause(): void {
    this.transitionTo(JobStatus.PAUSED);
  }

  /**
   * Resume from paused or interrupted state
   */
  resume(): void {
    this.transitionTo(JobStatus.RESUMING);
    this.data.resumeCount += 1;
    this.data.lastHeartbeat = new Date();
  }

  /**
   * Continue processing (from waiting/resuming to in_progress)
   */
  continueProcessing(): void {
    this.transitionTo(JobStatus.IN_PROGRESS);
    this.data.lastHeartbeat = new Date();
  }

  /**
   * Complete the job successfully
   */
  complete(): void {
    const finalStatus =
      this.data.progress.failedRecords > 0
        ? JobStatus.COMPLETED_WITH_WARNINGS
        : JobStatus.COMPLETED;
    this.transitionTo(finalStatus);
    this.data.completedAt = new Date();
    this.data.result = JobResult.fromProgress(this.data.progress).complete();
  }

  /**
   * Fail the job
   */
  fail(error?: string): void {
    this.transitionTo(JobStatus.FAILED);
    this.data.completedAt = new Date();
    if (error) {
      this.data.result = this.data.result.addError({
        index: -1,
        errorType: "SYSTEM_ERROR",
        errorMessage: error,
        severity: "critical",
      });
    }
  }

  /**
   * Cancel the job
   */
  cancel(reason?: string): void {
    this.transitionTo(JobStatus.CANCELLED);
    this.data.completedAt = new Date();
    if (reason) {
      this.data.metadata = { ...this.data.metadata, cancelReason: reason };
    }
  }

  /**
   * Mark as interrupted (for timeout recovery)
   */
  markInterrupted(): void {
    this.transitionTo(JobStatus.INTERRUPTED);
  }

  /**
   * Force reset to INTERRUPTED state (admin/recovery action)
   * This bypasses normal transition rules for stuck jobs
   */
  forceReset(reason: string): void {
    if (this.isTerminal) {
      throw new Error("Cannot reset terminal job");
    }

    // Force the status change without validation
    this.data.status = JobStatus.INTERRUPTED;
    this.data.updatedAt = new Date();
    this.data.metadata = {
      ...this.data.metadata,
      forceResetReason: reason,
      forceResetAt: new Date().toISOString(),
      previousStatus: this.data.status,
    };

    // Add tag for tracking
    this.addTag("force-reset");
  }

  /**
   * Recover from stuck state
   * Attempts to transition stuck job to recoverable state
   */
  recoverFromStuck(): void {
    if (!this.isStuck && !this.isRunning) {
      throw new Error("Job is not stuck or running");
    }

    // Mark as interrupted so it can be resumed
    this.data.status = JobStatus.INTERRUPTED;
    this.data.updatedAt = new Date();
    this.data.metadata = {
      ...this.data.metadata,
      recoveredFromStuck: true,
      recoveredAt: new Date().toISOString(),
      timeSinceLastHeartbeat: this.timeSinceLastHeartbeat,
    };

    this.addTag("auto-recovered");
  }

  /**
   * Update heartbeat
   */
  heartbeat(): void {
    this.data.lastHeartbeat = new Date();
    this.data.updatedAt = new Date();
  }

  /**
   * Update progress
   */
  updateProgress(progress: JobProgress): void {
    this.data.progress = progress;
    this.data.updatedAt = new Date();
  }

  /**
   * Save checkpoint
   */
  checkpoint(index: number): void {
    this.data.lastCheckpointIndex = index;
    this.data.updatedAt = new Date();
  }

  /**
   * Update result
   */
  updateResult(result: JobResult): void {
    this.data.result = result;
    this.data.updatedAt = new Date();
  }

  /**
   * Add metadata
   */
  setMetadata(key: string, value: unknown): void {
    this.data.metadata = { ...this.data.metadata, [key]: value };
    this.data.updatedAt = new Date();
  }

  /**
   * Add tag
   */
  addTag(tag: string): void {
    if (!this.data.tags.includes(tag)) {
      this.data.tags = [...this.data.tags, tag];
      this.data.updatedAt = new Date();
    }
  }

  /**
   * Remove tag
   */
  removeTag(tag: string): void {
    this.data.tags = this.data.tags.filter((t) => t !== tag);
    this.data.updatedAt = new Date();
  }

  /**
   * Set total records (usually after initial count)
   */
  setTotalRecords(total: number): void {
    const chunkSize = (this.data.config as BaseJobConfig).chunkSize;
    this.data.progress = this.data.progress.withTotal(total, Math.ceil(total / chunkSize));
    this.data.updatedAt = new Date();
  }

  /**
   * Get the index from where to resume
   */
  getResumeIndex(): number {
    return this.data.lastCheckpointIndex + 1;
  }

  /**
   * Serialize for persistence
   */
  toData(): BatchJobData {
    return {
      ...this.data,
      progress: this.data.progress,
      result: this.data.result,
    };
  }

  /**
   * Serialize for API response
   */
  toJSON(): Record<string, unknown> {
    return {
      id: this.data.id,
      type: this.data.type,
      name: this.data.name,
      description: this.data.description,
      status: this.data.status,
      progress: this.data.progress.toJSON(),
      createdBy: this.data.createdBy,
      organizationId: this.data.organizationId,
      createdAt: this.data.createdAt.toISOString(),
      updatedAt: this.data.updatedAt.toISOString(),
      startedAt: this.data.startedAt?.toISOString() ?? null,
      completedAt: this.data.completedAt?.toISOString() ?? null,
      durationMs: this.durationMs,
      resumeCount: this.data.resumeCount,
      tags: this.data.tags,
    };
  }

  /**
   * Detailed JSON including result
   */
  toDetailedJSON(): Record<string, unknown> {
    return {
      ...this.toJSON(),
      config: this.data.config,
      result: this.data.result.toJSON(),
      metadata: this.data.metadata,
      lastHeartbeat: this.data.lastHeartbeat?.toISOString() ?? null,
      lastCheckpointIndex: this.data.lastCheckpointIndex,
    };
  }
}
