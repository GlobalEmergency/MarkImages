/**
 * Batch Job Processors
 *
 * Export all processors and provide initialization function.
 */

export * from "./AedCsvImportProcessor";
export * from "./AedExportProcessor";

import { PrismaClient } from "@/generated/client/client";
import { getProcessorRegistry, JobType } from "@/batch/domain";
import { AedCsvImportProcessor } from "./AedCsvImportProcessor";
import { AedExportProcessor } from "./AedExportProcessor";
import { HttpImageDownloader } from "@/storage/infrastructure/adapters/HttpImageDownloader";
import { S3ImageStorageAdapter } from "@/storage/infrastructure/adapters/S3ImageStorageAdapter";
import { DownloadAndUploadImageUseCase } from "@/storage/application/use-cases/DownloadAndUploadImageUseCase";

/**
 * Initialize and register all processors.
 *
 * Note: ExternalSyncProcessor has been replaced by ExternalSyncService
 * which uses @batchactions/core BatchEngine directly.
 * AED_EXTERNAL_SYNC jobs now use the "externalsync" engine in metadata
 * and are dispatched by the cron handler to ExternalSyncService.
 */
export function initializeProcessors(prisma: PrismaClient): void {
  const registry = getProcessorRegistry();

  // ========================================
  // Initialize image download/upload infrastructure
  // ========================================
  const imageDownloader = new HttpImageDownloader();
  const imageStorage = new S3ImageStorageAdapter();
  const downloadAndUploadImageUseCase = new DownloadAndUploadImageUseCase(
    imageDownloader,
    imageStorage
  );

  // ========================================
  // Register processors
  // ========================================
  registry.register(
    JobType.AED_CSV_IMPORT,
    new AedCsvImportProcessor(prisma, downloadAndUploadImageUseCase)
  );

  registry.register(JobType.AED_CSV_EXPORT, new AedExportProcessor(prisma));

  registry.register(
    JobType.AED_JSON_EXPORT,
    new AedExportProcessor(prisma) // Same processor, different config
  );

  console.log("✅ Batch processors initialized:", registry.getRegisteredTypes());
}
