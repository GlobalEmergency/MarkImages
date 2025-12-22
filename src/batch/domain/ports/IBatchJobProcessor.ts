/**
 * Batch Job Processor Port
 *
 * Defines the contract for job processors.
 * Each job type should have a processor that implements this interface.
 *
 * Designed for Vercel's serverless model where:
 * - Execution time is limited (max 100s)
 * - Jobs are processed in chunks across multiple invocations
 * - State must be persisted between invocations
 */

import { BatchJob } from "../entities/BatchJob";
import { JobConfig, JobProgress, JobResult, JobType } from "../value-objects";

/**
 * Result of processing a single record
 */
export interface ProcessRecordResult {
  success: boolean;
  action: "created" | "updated" | "skipped" | "deleted" | "failed";
  recordId?: string;
  recordReference?: string;
  error?: {
    index: number;
    type: string;
    message: string;
    severity: "info" | "warning" | "error" | "critical";
    correctionSuggestion?: string;
    field?: string;
    csvColumn?: string;
    value?: string;
    rowData?: Record<string, unknown>;
  };
  data?: Record<string, unknown>;
}

/**
 * Result of processing a chunk of records
 */
export interface ProcessChunkResult {
  processedCount: number;
  successCount: number;
  failedCount: number;
  skippedCount: number;
  results: ProcessRecordResult[];
  hasMore: boolean;
  nextIndex: number;
  shouldContinue: boolean;
  error?: string;
}

/**
 * Context passed to processors
 */
export interface ProcessorContext {
  job: BatchJob;
  startIndex: number;
  chunkSize: number;
  isResuming: boolean;
  timeoutAt: Date;
  onProgress?: (progress: JobProgress) => Promise<void>;
  onCheckpoint?: (index: number, recordHash?: string) => Promise<void>;
  onHeartbeat?: () => Promise<void>;
}

/**
 * Processor initialization result
 */
export interface ProcessorInitResult {
  success: boolean;
  totalRecords: number;
  error?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Processor validation result
 */
export interface ProcessorValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Interface for batch job processors
 *
 * Implementation notes:
 * - Processors should be stateless
 * - All state should be stored in the job or checkpoints
 * - Process chunks should respect timeout limits
 * - Use generators for memory-efficient processing
 */
export interface IBatchJobProcessor<TConfig extends JobConfig = JobConfig> {
  /**
   * The job type this processor handles
   */
  readonly jobType: JobType;

  /**
   * Validate the job configuration
   */
  validateConfig(config: TConfig): ProcessorValidationResult;

  /**
   * Initialize the processor and count total records
   * Called once when the job starts
   */
  initialize(config: TConfig): Promise<ProcessorInitResult>;

  /**
   * Process a chunk of records
   * Called multiple times, once per serverless invocation
   */
  processChunk(context: ProcessorContext): Promise<ProcessChunkResult>;

  /**
   * Finalize the job
   * Called once when all records are processed
   */
  finalize(job: BatchJob): Promise<JobResult>;

  /**
   * Clean up resources
   * Called when job completes, fails, or is cancelled
   */
  cleanup(job: BatchJob): Promise<void>;

  /**
   * Get preview of what would be processed
   * Optional: for dry-run functionality
   */
  preview?(
    config: TConfig,
    limit?: number
  ): Promise<{
    sampleRecords: Record<string, unknown>[];
    totalCount: number;
  }>;

  /**
   * Estimate processing time
   * Optional: for progress estimation
   */
  estimateTime?(config: TConfig, recordCount: number): number;
}

/**
 * Abstract base class for processors with common functionality
 */
export abstract class BaseBatchJobProcessor<
  TConfig extends JobConfig = JobConfig,
> implements IBatchJobProcessor<TConfig> {
  abstract readonly jobType: JobType;

  abstract validateConfig(config: TConfig): ProcessorValidationResult;
  abstract initialize(config: TConfig): Promise<ProcessorInitResult>;
  abstract processChunk(context: ProcessorContext): Promise<ProcessChunkResult>;

  /**
   * Default finalization - create result from progress
   */
  async finalize(job: BatchJob): Promise<JobResult> {
    return JobResult.fromProgress(job.progress).complete();
  }

  /**
   * Default cleanup - no-op
   */
  async cleanup(_job: BatchJob): Promise<void> {
    // Override if cleanup is needed
  }

  /**
   * Default time estimation based on average
   */
  estimateTime(config: TConfig, recordCount: number): number {
    const msPerRecord = 100; // Default estimate
    return recordCount * msPerRecord;
  }

  /**
   * Helper: Check if we're approaching timeout
   */
  protected isApproachingTimeout(context: ProcessorContext, bufferMs: number = 5000): boolean {
    return Date.now() >= context.timeoutAt.getTime() - bufferMs;
  }

  /**
   * Helper: Create a failed result
   */
  protected createFailedResult(
    recordReference: string,
    errorType: string,
    errorMessage: string,
    severity: "info" | "warning" | "error" | "critical" = "error",
    index: number = -1,
    additionalData?: {
      field?: string;
      csvColumn?: string;
      value?: string;
      correctionSuggestion?: string;
      rowData?: Record<string, unknown>;
    }
  ): ProcessRecordResult {
    return {
      success: false,
      action: "failed",
      recordReference,
      error: {
        index,
        type: errorType,
        message: errorMessage,
        severity,
        field: additionalData?.field,
        csvColumn: additionalData?.csvColumn,
        value: additionalData?.value,
        correctionSuggestion: additionalData?.correctionSuggestion,
        rowData: additionalData?.rowData,
      },
    };
  }

  /**
   * Helper: Create a success result
   */
  protected createSuccessResult(
    action: "created" | "updated" | "skipped" | "deleted",
    recordId?: string,
    recordReference?: string,
    data?: Record<string, unknown>
  ): ProcessRecordResult {
    return {
      success: true,
      action,
      recordId,
      recordReference,
      data,
    };
  }
}
