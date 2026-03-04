/**
 * Factory — BulkImportService singleton
 *
 * Crea y cachea una instancia de BulkImportService con todas sus dependencias.
 * Evita duplicar la inicialización en cada API route.
 *
 * Usa el mismo patrón de inyección manual de dependencias que el resto del
 * sistema (ver batch/application/processors/index.ts).
 */

import { prisma } from "@/lib/db";
import { BulkImportService } from "../../application/services/BulkImportService";
import { PrismaAedRepository } from "../repositories/PrismaAedRepository";
import { HttpImageDownloader } from "@/storage/infrastructure/adapters/HttpImageDownloader";
import { S3ImageStorageAdapter } from "@/storage/infrastructure/adapters/S3ImageStorageAdapter";
import { DownloadAndUploadImageUseCase } from "@/storage/application/use-cases/DownloadAndUploadImageUseCase";

let _instance: BulkImportService | null = null;

/**
 * Obtiene la instancia singleton de BulkImportService.
 *
 * @example
 * ```typescript
 * import { getBulkImportService } from "@/import/infrastructure/factories/createBulkImportService";
 *
 * const service = getBulkImportService();
 * const result = await service.startImport({ ... });
 * ```
 */
export function getBulkImportService(): BulkImportService {
  if (!_instance) {
    // Repositorio AED para DuplicateChecker
    const aedRepository = new PrismaAedRepository(prisma);

    // Infraestructura de imágenes
    const imageDownloader = new HttpImageDownloader();
    const imageStorage = new S3ImageStorageAdapter();
    const downloadAndUploadImageUseCase = new DownloadAndUploadImageUseCase(
      imageDownloader,
      imageStorage
    );

    _instance = new BulkImportService(prisma, aedRepository, downloadAndUploadImageUseCase);
  }

  return _instance;
}
