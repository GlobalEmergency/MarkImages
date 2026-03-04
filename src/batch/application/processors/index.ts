/**
 * Batch Job Processors
 *
 * Export all processors and provide initialization function.
 */

export * from "./ExternalSyncProcessor";
export * from "./AedCsvImportProcessor";
export * from "./AedExportProcessor";

import { PrismaClient } from "@/generated/client/client";
import { getProcessorRegistry, JobType } from "@/batch/domain";
import { IDataSourceRepository } from "@/import/domain/ports/IDataSourceRepository";
import { ExternalSyncProcessor } from "./ExternalSyncProcessor";
import { AedCsvImportProcessor } from "./AedCsvImportProcessor";
import { AedExportProcessor } from "./AedExportProcessor";
import { HttpImageDownloader } from "@/storage/infrastructure/adapters/HttpImageDownloader";
import { S3ImageStorageAdapter } from "@/storage/infrastructure/adapters/S3ImageStorageAdapter";
import { DownloadAndUploadImageUseCase } from "@/storage/application/use-cases/DownloadAndUploadImageUseCase";
import { PrismaDuplicateDetectionAdapter } from "@/import/infrastructure/adapters/PrismaDuplicateDetectionAdapter";
import { PostgreSqlTextNormalizer } from "@/import/infrastructure/services/PostgreSqlTextNormalizer";
import { EnrichLocationWithGeocodingUseCase } from "@/location/application/use-cases/EnrichLocationWithGeocodingUseCase";
import { GoogleGeocodingService } from "@/location/infrastructure/services/GoogleGeocodingService";

/**
 * Initialize and register all processors
 */
export function initializeProcessors(
  prisma: PrismaClient,
  dataSourceRepository: IDataSourceRepository
): void {
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
  // Initialize duplicate detection service
  // ========================================
  const textNormalizationService = new PostgreSqlTextNormalizer();
  const duplicateDetectionService = new PrismaDuplicateDetectionAdapter(
    prisma,
    textNormalizationService
  );

  // ========================================
  // Initialize geocoding enrichment service
  // Uses Google Maps Geocoding API directly for batch processing
  // ========================================
  const geocodingService = new GoogleGeocodingService();
  const enrichLocationUseCase = new EnrichLocationWithGeocodingUseCase(prisma, geocodingService);

  // ========================================
  // Register processors
  // ========================================
  registry.register(
    JobType.AED_EXTERNAL_SYNC,
    new ExternalSyncProcessor(
      prisma,
      dataSourceRepository,
      duplicateDetectionService,
      enrichLocationUseCase
    )
  );

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
