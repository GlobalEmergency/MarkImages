/**
 * Batch Creator Service
 * Creates and manages ImportBatch for migration tracking
 * Application Layer - Service
 */

import type { PrismaClient } from "../../../src/generated/client";

export class BatchCreator {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Create a new import batch for legacy migration
   */
  async createBatch(totalRecords: number, importedBy: string): Promise<string> {
    const batch = await this.prisma.importBatch.create({
      data: {
        name: "Legacy DEA Migration",
        description: `Migration from legacy dea_records and verification_sessions tables. Total records: ${totalRecords}`,
        source_origin: "LEGACY_MIGRATION",
        file_name: "legacy_database",
        total_records: totalRecords,
        successful_records: 0,
        failed_records: 0,
        status: "IN_PROGRESS",
        imported_by: importedBy,
        started_at: new Date(),
      },
    });

    return batch.id;
  }

  /**
   * Update batch progress
   */
  async updateProgress(batchId: string, successCount: number, errorCount: number): Promise<void> {
    await this.prisma.importBatch.update({
      where: { id: batchId },
      data: {
        successful_records: successCount,
        failed_records: errorCount,
      },
    });
  }

  /**
   * Complete batch
   */
  async completeBatch(
    batchId: string,
    successCount: number,
    errorCount: number,
    durationSeconds: number
  ): Promise<void> {
    const status = errorCount === 0 ? "COMPLETED" : "COMPLETED_WITH_ERRORS";

    await this.prisma.importBatch.update({
      where: { id: batchId },
      data: {
        status,
        successful_records: successCount,
        failed_records: errorCount,
        completed_at: new Date(),
        duration_seconds: durationSeconds,
      },
    });
  }

  /**
   * Mark batch as failed
   */
  async failBatch(batchId: string, error: Error): Promise<void> {
    await this.prisma.importBatch.update({
      where: { id: batchId },
      data: {
        status: "FAILED",
        completed_at: new Date(),
        error_summary: {
          message: error.message,
          stack: error.stack,
        },
      },
    });
  }
}
