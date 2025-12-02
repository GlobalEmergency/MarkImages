/**
 * Background Import Processor
 * Ejecuta importaciones de manera asíncrona y actualiza el progreso
 */

import { prisma } from "@/lib/db";

import { ImportDeaBatchUseCase } from "@/application/import/use-cases/ImportDeaBatchUseCase";
import { CsvParserAdapter } from "@/infrastructure/import/parsers/CsvParserAdapter";
import { PrismaImportRepository } from "@/infrastructure/import/repositories/PrismaImportRepository";
import { S3ImageStorageAdapter } from "@/infrastructure/storage/adapters/S3ImageStorageAdapter";
import { SharePointImageDownloader } from "@/infrastructure/storage/adapters/SharePointImageDownloader";

/**
 * Procesa una importación de manera asíncrona
 * Actualiza el estado del batch durante el proceso
 */
export async function processImportAsync(
  batchId: string,
  filePath: string,
  userId: string,
  mappings?: Array<{ csvColumn: string; systemField: string }>,
  sharePointAuth?: any
): Promise<void> {
  try {
    console.log(`🚀 Starting async import for batch ${batchId}`);

    // Actualizar estado a IN_PROGRESS
    await prisma.importBatch.update({
      where: { id: batchId },
      data: {
        status: "IN_PROGRESS",
        started_at: new Date(),
      },
    });

    // Inyección de dependencias
    const repository = new PrismaImportRepository(prisma);
    const csvParser = new CsvParserAdapter();
    const imageDownloader = new SharePointImageDownloader();
    const imageStorage = new S3ImageStorageAdapter();

    const useCase = new ImportDeaBatchUseCase(repository, csvParser, imageDownloader, imageStorage);

    // Ejecutar importación
    const startTime = Date.now();
    const result = await useCase.execute({
      batchId, // Usar el batch ya creado (evitar duplicación)
      filePath,
      batchName: "", // El batch ya existe
      importedBy: userId,
      mappings, // Pasar mappings del usuario
      sharePointAuth,
      chunkSize: 50,
    });

    const durationSeconds = Math.floor((Date.now() - startTime) / 1000);

    // Determinar estado final
    const finalStatus =
      result.failedRecords > 0 && result.successfulRecords > 0
        ? "COMPLETED_WITH_ERRORS"
        : result.failedRecords === result.totalRecords
          ? "FAILED"
          : "COMPLETED";

    // Actualizar batch con resultado final
    await prisma.importBatch.update({
      where: { id: batchId },
      data: {
        status: finalStatus,
        total_records: result.totalRecords,
        successful_records: result.successfulRecords,
        failed_records: result.failedRecords,
        completed_at: new Date(),
        duration_seconds: durationSeconds,
      },
    });

    console.log(
      `✅ Import completed: ${result.successfulRecords}/${result.totalRecords} successful`
    );
  } catch (error) {
    console.error("❌ Import failed:", error);

    // Actualizar batch como FAILED
    await prisma.importBatch.update({
      where: { id: batchId },
      data: {
        status: "FAILED",
        completed_at: new Date(),
        error_summary: {
          message: error instanceof Error ? error.message : "Unknown error",
          stack: error instanceof Error ? error.stack : undefined,
        },
      },
    });
  } finally {
    // Limpiar archivo temporal
    await deleteTempFile(filePath);
    await prisma.$disconnect();
  }
}

/**
 * Guarda un archivo temporal en el servidor
 * Retorna la ruta del archivo guardado
 */
export async function saveTempFile(file: File): Promise<string> {
  const fs = await import("fs/promises");
  const path = await import("path");
  const os = await import("os");

  // Crear directorio temporal si no existe
  const tmpDir = path.join(os.tmpdir(), "dea-imports");
  await fs.mkdir(tmpDir, { recursive: true });

  // Generar nombre único para el archivo
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(7);
  const fileName = `import-${timestamp}-${randomId}.csv`;
  const filePath = path.join(tmpDir, fileName);

  // Guardar archivo
  const arrayBuffer = await file.arrayBuffer();
  const buffer = new Uint8Array(arrayBuffer);
  await fs.writeFile(filePath, buffer);

  console.log(`📁 Temporary file saved: ${filePath}`);
  return filePath;
}

/**
 * Elimina un archivo temporal del servidor
 */
export async function deleteTempFile(filePath: string): Promise<void> {
  try {
    const fs = await import("fs/promises");
    await fs.unlink(filePath);
    console.log(`🗑️ Temporary file deleted: ${filePath}`);
  } catch (error) {
    console.warn(`⚠️ Failed to delete temporary file: ${filePath}`, error);
  }
}
