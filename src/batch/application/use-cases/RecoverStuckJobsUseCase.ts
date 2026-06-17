/**
 * Recover Stuck Jobs Use Case
 *
 * Domain: Batch Job Recovery
 * Responsibility: Detect and recover stuck batch jobs automatically
 *
 * SOLID Principles:
 * - SRP: Single responsibility - recover stuck jobs
 * - DIP: Depends on IBatchJobRepository abstraction
 * - OCP: Open for extension (can add different recovery strategies)
 */

import { IBatchJobRepository, JobStatus } from "@/batch/domain";

export interface RecoverStuckJobsInput {
  /**
   * Threshold in milliseconds to consider a job stuck
   * Default: 180000 (3 minutes)
   */
  stuckThresholdMs?: number;

  /**
   * Maximum number of jobs to recover in one call
   */
  maxJobsToRecover?: number;

  /**
   * If true, only detect stuck jobs without recovering them (dry run)
   */
  dryRun?: boolean;
}

export interface RecoveredJobInfo {
  jobId: string;
  jobName: string;
  previousStatus: JobStatus;
  timeSinceLastHeartbeat: number | null;
  recoveredAt: string;
}

export interface RecoverStuckJobsOutput {
  success: boolean;
  recoveredJobs: RecoveredJobInfo[];
  totalStuckJobs: number;
  error?: string;
}

export class RecoverStuckJobsUseCase {
  constructor(private readonly repository: IBatchJobRepository) {}

  async execute(input: RecoverStuckJobsInput = {}): Promise<RecoverStuckJobsOutput> {
    const { maxJobsToRecover = 10, dryRun = false } = input;

    try {
      // Find all active jobs (IN_PROGRESS, RESUMING)
      const result = await this.repository.findMany(
        {
          statuses: [JobStatus.IN_PROGRESS, JobStatus.RESUMING],
        },
        { page: 1, pageSize: 100 }
      );
      const activeJobs = result.jobs;

      // Filter stuck jobs
      const stuckJobs = activeJobs.filter((job) => job.isStuck);

      if (stuckJobs.length === 0) {
        return {
          success: true,
          recoveredJobs: [],
          totalStuckJobs: 0,
        };
      }

      // If dry run, just return the detected stuck jobs
      if (dryRun) {
        const detectedJobs: RecoveredJobInfo[] = stuckJobs
          .slice(0, maxJobsToRecover)
          .map((job) => ({
            jobId: job.id,
            jobName: job.name,
            previousStatus: job.status,
            timeSinceLastHeartbeat: job.timeSinceLastHeartbeat,
            recoveredAt: new Date().toISOString(),
          }));

        return {
          success: true,
          recoveredJobs: detectedJobs,
          totalStuckJobs: stuckJobs.length,
        };
      }

      // Recover stuck jobs (limited by maxJobsToRecover)
      const jobsToRecover = stuckJobs.slice(0, maxJobsToRecover);
      const recoveredJobs: RecoveredJobInfo[] = [];

      for (const job of jobsToRecover) {
        try {
          const previousStatus = job.status;
          const timeSinceLastHeartbeat = job.timeSinceLastHeartbeat;

          // Domain method to recover from stuck state
          job.recoverFromStuck();

          // Persist the recovered job
          await this.repository.update(job);

          recoveredJobs.push({
            jobId: job.id,
            jobName: job.name,
            previousStatus,
            timeSinceLastHeartbeat,
            recoveredAt: new Date().toISOString(),
          });
        } catch (error) {
          console.error(`[RecoverStuckJobs] Failed to recover job ${job.id}:`, error);
          // Continue with next job
        }
      }

      return {
        success: true,
        recoveredJobs,
        totalStuckJobs: stuckJobs.length,
      };
    } catch (error) {
      console.error("[RecoverStuckJobs] Error:", error);
      return {
        success: false,
        recoveredJobs: [],
        totalStuckJobs: 0,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}
