/**
 * Force Reset Job Use Case
 *
 * Domain: Batch Job Recovery
 * Responsibility: Force reset a specific stuck job (admin action)
 *
 * SOLID Principles:
 * - SRP: Single responsibility - force reset a specific job
 * - DIP: Depends on IBatchJobRepository abstraction
 * - ISP: Simple interface with single method
 */

import { IBatchJobRepository, BatchJob } from "@/batch/domain";

export interface ForceResetJobInput {
  jobId: string;
  reason: string;
  /**
   * User performing the reset (for audit trail)
   */
  performedBy: string;
}

export interface ForceResetJobOutput {
  success: boolean;
  job?: BatchJob;
  message?: string;
  error?: string;
}

export class ForceResetJobUseCase {
  constructor(private readonly repository: IBatchJobRepository) {}

  async execute(input: ForceResetJobInput): Promise<ForceResetJobOutput> {
    const { jobId, reason, performedBy } = input;

    try {
      // Find the job
      const job = await this.repository.findById(jobId);

      if (!job) {
        return {
          success: false,
          error: `Job not found: ${jobId}`,
        };
      }

      // Check if job is terminal
      if (job.isTerminal) {
        return {
          success: false,
          error: `Cannot reset terminal job (status: ${job.status})`,
        };
      }

      const previousStatus = job.status;

      // Force reset the job (domain method)
      job.forceReset(`${reason} (by ${performedBy})`);

      // Add audit metadata
      job.setMetadata("forceResetBy", performedBy);
      job.setMetadata("forceResetPreviousStatus", previousStatus);

      // Persist the reset job
      await this.repository.update(job);

      return {
        success: true,
        job,
        message: `Job successfully reset from ${previousStatus} to ${job.status}. It can now be resumed.`,
      };
    } catch (error) {
      console.error(`[ForceResetJob] Error resetting job ${jobId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}
