/**
 * Batch Job Orchestrator
 *
 * Coordinates the execution of batch jobs across multiple serverless invocations.
 * Designed for Vercel's execution model where each invocation has limited time.
 *
 * Flow:
 * 1. Create job -> start() -> First chunk processes
 * 2. If hasMore, client polls and calls continue()
 * 3. Repeat until all records processed
 * 4. Job completes or fails
 */

import {
  BatchJob,
  JobConfig,
  JobProgress,
  JobStatus,
  JobType,
  IBatchJobRepository,
  IBatchJobProcessor,
  ProcessorContext,
  getProcessorRegistry,
  BaseJobConfig,
} from "@/batch/domain";

export interface CreateJobParams {
  type: JobType;
  name: string;
  description?: string;
  config: JobConfig;
  createdBy: string;
  organizationId?: string;
  dataSourceId?: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
}

export interface StartJobResult {
  job: BatchJob;
  chunkResult: ChunkExecutionResult;
}

export interface ChunkExecutionResult {
  success: boolean;
  jobId: string;
  status: JobStatus;
  progress: {
    totalRecords: number;
    processedRecords: number;
    successfulRecords: number;
    failedRecords: number;
    percentage: number;
    hasMore: boolean;
  };
  error?: string;
  shouldContinue: boolean;
}

export interface ContinueJobResult {
  job: BatchJob;
  chunkResult: ChunkExecutionResult;
}

export class BatchJobOrchestrator {
  constructor(
    private readonly repository: IBatchJobRepository,
    private readonly defaultTimeoutMs: number = 90000 // 90 seconds (Vercel limit is 100)
  ) {}

  /**
   * Create a new batch job
   */
  async create(params: CreateJobParams): Promise<BatchJob> {
    // Get processor and validate config
    const processor = this.getProcessor(params.type);
    const validation = processor.validateConfig(params.config);

    if (!validation.valid) {
      throw new Error(`Invalid job configuration: ${validation.errors.join(", ")}`);
    }

    // Create the job entity
    const job = BatchJob.create({
      type: params.type,
      name: params.name,
      description: params.description,
      config: params.config,
      createdBy: params.createdBy,
      organizationId: params.organizationId,
      dataSourceId: params.dataSourceId,
      metadata: params.metadata,
      tags: params.tags,
    });

    // Persist and return
    return this.repository.create(job);
  }

  /**
   * Start a job (first chunk)
   */
  async start(jobId: string): Promise<StartJobResult> {
    const job = await this.getJobOrThrow(jobId);

    if (job.status !== JobStatus.PENDING && job.status !== JobStatus.QUEUED) {
      throw new Error(`Cannot start job in status: ${job.status}`);
    }

    const processor = this.getProcessor(job.type);

    // Initialize processor (get total count, etc.)
    const initResult = await processor.initialize(job.config);

    if (!initResult.success) {
      job.fail(initResult.error || "Initialization failed");
      await this.repository.update(job);
      return {
        job,
        chunkResult: this.createFailedResult(job, initResult.error || "Initialization failed"),
      };
    }

    // Update job with total records
    job.setTotalRecords(initResult.totalRecords);
    job.start();

    if (initResult.metadata) {
      Object.entries(initResult.metadata).forEach(([key, value]) => {
        job.setMetadata(key, value);
      });
    }

    await this.repository.update(job);

    // Process first chunks (multi-chunk)
    const chunkResult = await this.processChunks(job, processor, 0);

    return { job, chunkResult };
  }

  /**
   * Continue a job (subsequent chunks) - Multi-chunk processing
   */
  async continue(jobId: string): Promise<ContinueJobResult> {
    const job = await this.getJobOrThrow(jobId);

    // Check if job can be continued
    if (!this.canContinue(job)) {
      throw new Error(`Cannot continue job in status: ${job.status}`);
    }

    const processor = this.getProcessor(job.type);

    // If resuming from interrupted, mark as resuming
    if (job.status === JobStatus.INTERRUPTED || job.status === JobStatus.PAUSED) {
      job.resume();
      await this.repository.update(job);
    }

    // Continue processing
    job.continueProcessing();
    await this.repository.update(job);

    const startIndex = job.getResumeIndex();
    const chunkResult = await this.processChunks(job, processor, startIndex);

    return { job, chunkResult };
  }

  /**
   * Pause a running job
   */
  async pause(jobId: string): Promise<BatchJob> {
    const job = await this.getJobOrThrow(jobId);

    if (!job.canCancel) {
      throw new Error(`Cannot pause job in status: ${job.status}`);
    }

    job.pause();
    await this.repository.update(job);
    return job;
  }

  /**
   * Cancel a job
   */
  async cancel(jobId: string, reason?: string): Promise<BatchJob> {
    const job = await this.getJobOrThrow(jobId);

    if (!job.canCancel) {
      throw new Error(`Cannot cancel job in status: ${job.status}`);
    }

    const processor = this.getProcessor(job.type);
    await processor.cleanup(job);

    job.cancel(reason);
    await this.repository.update(job);
    return job;
  }

  /**
   * Get job status
   */
  async getStatus(jobId: string): Promise<{
    job: BatchJob;
    canContinue: boolean;
    canCancel: boolean;
    isComplete: boolean;
    progress: ReturnType<JobProgress["toJSON"]>;
  }> {
    const job = await this.getJobOrThrow(jobId);

    return {
      job,
      canContinue: this.canContinue(job),
      canCancel: job.canCancel,
      isComplete: job.isTerminal,
      progress: job.progress.toJSON(),
    };
  }

  /**
   * Retry a failed job (starts from beginning)
   */
  async retry(jobId: string): Promise<StartJobResult> {
    const oldJob = await this.getJobOrThrow(jobId);

    if (oldJob.status !== JobStatus.FAILED) {
      throw new Error("Can only retry failed jobs");
    }

    // Create a new job with same config
    const newJob = await this.create({
      type: oldJob.type,
      name: `${oldJob.name} (retry)`,
      description: oldJob.description,
      config: oldJob.config,
      createdBy: oldJob.createdBy,
      organizationId: oldJob.organizationId,
      metadata: { ...oldJob.metadata, retriedFromJobId: oldJob.id },
      tags: oldJob.tags,
    });

    return this.start(newJob.id);
  }

  /**
   * Find and recover timed-out jobs
   */
  async recoverTimedOutJobs(heartbeatThresholdMs: number = 180000): Promise<BatchJob[]> {
    const timedOutJobs = await this.repository.findTimedOutJobs(heartbeatThresholdMs);

    const recovered: BatchJob[] = [];
    for (const job of timedOutJobs) {
      job.markInterrupted();
      await this.repository.update(job);
      recovered.push(job);
    }

    return recovered;
  }

  /**
   * Process multiple chunks of records until timeout or completion
   */
  private async processChunks(
    job: BatchJob,
    processor: IBatchJobProcessor,
    startIndex: number
  ): Promise<ChunkExecutionResult> {
    const timeoutAt = new Date(Date.now() + this.defaultTimeoutMs);
    const safetyBuffer = 10000; // 10 seconds safety buffer
    const effectiveTimeout = new Date(timeoutAt.getTime() - safetyBuffer);

    let currentIndex = startIndex;
    let totalProcessed = 0;
    let totalSuccess = 0;
    let totalFailed = 0;
    let hasMore = true;
    let shouldContinue = true;
    let chunkCount = 0;

    console.log(
      `🔄 [Orchestrator] Starting multi-chunk processing from index ${startIndex} (timeout: ${this.defaultTimeoutMs}ms)`
    );

    // Process multiple chunks until timeout or completion
    while (hasMore && shouldContinue && Date.now() < effectiveTimeout.getTime()) {
      chunkCount++;
      const chunkStartTime = Date.now();

      console.log(
        `📦 [Orchestrator] Processing chunk #${chunkCount} at index ${currentIndex} (${Math.round((effectiveTimeout.getTime() - Date.now()) / 1000)}s remaining)`
      );

      const chunkResult = await this.processSingleChunk(
        job,
        processor,
        currentIndex,
        effectiveTimeout
      );

      // Accumulate results
      totalProcessed += chunkResult.processedCount;
      totalSuccess += chunkResult.successCount;
      totalFailed += chunkResult.failedCount;
      hasMore = chunkResult.hasMore;
      shouldContinue = chunkResult.shouldContinue;
      currentIndex = chunkResult.nextIndex;

      const chunkDuration = Date.now() - chunkStartTime;
      console.log(
        `✅ [Orchestrator] Chunk #${chunkCount} complete: ${chunkResult.processedCount} records in ${chunkDuration}ms (hasMore: ${hasMore}, shouldContinue: ${shouldContinue})`
      );

      // Stop if chunk failed or processor says stop
      if (!shouldContinue) {
        console.warn(`⚠️ [Orchestrator] Stopping: processor requested stop`);
        break;
      }

      // Stop if no more records
      if (!hasMore) {
        console.log(`🎉 [Orchestrator] All records processed!`);
        break;
      }

      // Check if we have enough time for another chunk
      const timeRemaining = effectiveTimeout.getTime() - Date.now();
      const estimatedChunkTime = chunkDuration * 1.2; // Add 20% buffer
      if (timeRemaining < estimatedChunkTime) {
        console.log(
          `⏰ [Orchestrator] Stopping after ${chunkCount} chunks: insufficient time remaining (${Math.round(timeRemaining / 1000)}s < ${Math.round(estimatedChunkTime / 1000)}s estimated)`
        );
        break;
      }
    }

    console.log(
      `🏁 [Orchestrator] Multi-chunk session complete: ${chunkCount} chunks, ${totalProcessed} records, ${totalSuccess} successful`
    );

    // Return consolidated result
    return {
      success: totalFailed < totalProcessed * 0.5, // Success if < 50% failed
      jobId: job.id,
      status: job.status,
      progress: {
        totalRecords: job.progress.totalRecords,
        processedRecords: job.progress.processedRecords,
        successfulRecords: job.progress.successfulRecords,
        failedRecords: job.progress.failedRecords,
        percentage: job.progress.percentage,
        hasMore,
      },
      shouldContinue: hasMore && shouldContinue,
    };
  }

  /**
   * Process a single chunk of records
   */
  private async processSingleChunk(
    job: BatchJob,
    processor: IBatchJobProcessor,
    startIndex: number,
    timeoutAt: Date
  ): Promise<{
    processedCount: number;
    successCount: number;
    failedCount: number;
    skippedCount: number;
    hasMore: boolean;
    shouldContinue: boolean;
    nextIndex: number;
  }> {
    const config = job.config as BaseJobConfig;

    const context: ProcessorContext = {
      job,
      startIndex,
      chunkSize: config.chunkSize,
      isResuming: startIndex > 0,
      timeoutAt,
      onProgress: async (progress: JobProgress) => {
        job.updateProgress(progress);
        await this.repository.update(job);
      },
      onCheckpoint: async (index: number, recordHash?: string) => {
        job.checkpoint(index);
        await this.repository.saveCheckpoint({
          jobId: job.id,
          recordIndex: index,
          recordHash,
          status: "SUCCESS",
        });
        await this.repository.updateHeartbeat(job.id);
      },
      onHeartbeat: async () => {
        job.heartbeat();
        await this.repository.updateHeartbeat(job.id);
      },
    };

    try {
      const chunkResult = await processor.processChunk(context);

      // Update progress
      let progress = job.progress
        .withProcessed(job.progress.processedRecords + chunkResult.processedCount)
        .withLastProcessedIndex(chunkResult.nextIndex - 1)
        .advanceChunk()
        .calculateEstimatedRemaining();

      // Update detailed counts and collect errors
      for (const result of chunkResult.results) {
        if (result.success) {
          if (result.action === "skipped") {
            progress = progress.incrementSkipped();
          } else {
            progress = progress.incrementSuccess();
          }
        } else {
          progress = progress.incrementFailed();
          if (result.error) {
            // Add error to JobResult for user feedback
            const currentResult = job.result.addError({
              index: result.error.index,
              recordReference: result.recordReference,
              errorType: result.error.type,
              errorMessage: result.error.message,
              severity: result.error.severity,
              rowData: result.error.rowData,
              correctionSuggestion: result.error.correctionSuggestion,
            });
            job.updateResult(currentResult);

            // Log error to database checkpoint
            await this.repository.saveCheckpoint({
              jobId: job.id,
              recordIndex: result.error.index,
              recordReference: result.recordReference,
              status: "FAILED",
              errorMessage: result.error.message,
            });
          }
        }
      }

      job.updateProgress(progress);

      // Determine next status
      if (!chunkResult.hasMore) {
        // All done - finalize
        const finalResult = await processor.finalize(job);
        job.updateResult(finalResult);
        
        // If job is in WAITING state, transition to IN_PROGRESS before completing
        // to avoid invalid state transition error
        if (job.status === JobStatus.WAITING) {
          job.continueProcessing();
        }
        
        job.complete();
        await processor.cleanup(job);
      } else if (!chunkResult.shouldContinue) {
        // Processor says stop (e.g., too many errors)
        job.fail(chunkResult.error || "Processing stopped due to errors");
        await processor.cleanup(job);
      } else {
        // More to process - mark as waiting
        job.markWaiting();
      }

      await this.repository.update(job);

      return {
        processedCount: chunkResult.processedCount,
        successCount: chunkResult.successCount,
        failedCount: chunkResult.failedCount,
        skippedCount: chunkResult.skippedCount,
        hasMore: chunkResult.hasMore,
        shouldContinue: chunkResult.shouldContinue,
        nextIndex: chunkResult.nextIndex,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      // Try to save current state
      job.fail(errorMessage);
      await this.repository.update(job);
      await processor.cleanup(job);

      return {
        processedCount: 0,
        successCount: 0,
        failedCount: 0,
        skippedCount: 0,
        hasMore: false,
        shouldContinue: false,
        nextIndex: startIndex,
      };
    }
  }

  /**
   * Check if a job can be continued
   */
  private canContinue(job: BatchJob): boolean {
    return (
      job.status === JobStatus.WAITING ||
      job.status === JobStatus.PAUSED ||
      job.status === JobStatus.INTERRUPTED ||
      job.status === JobStatus.RESUMING
    );
  }

  /**
   * Get a job or throw
   */
  private async getJobOrThrow(jobId: string): Promise<BatchJob> {
    const job = await this.repository.findById(jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }
    return job;
  }

  /**
   * Get processor for job type
   */
  private getProcessor(type: JobType): IBatchJobProcessor {
    const processor = getProcessorRegistry().get(type);
    if (!processor) {
      throw new Error(`No processor registered for job type: ${type}`);
    }
    return processor;
  }

  /**
   * Create a failed result
   */
  private createFailedResult(job: BatchJob, error: string): ChunkExecutionResult {
    return {
      success: false,
      jobId: job.id,
      status: job.status,
      progress: {
        totalRecords: job.progress.totalRecords,
        processedRecords: job.progress.processedRecords,
        successfulRecords: job.progress.successfulRecords,
        failedRecords: job.progress.failedRecords,
        percentage: job.progress.percentage,
        hasMore: false,
      },
      error,
      shouldContinue: false,
    };
  }
}
