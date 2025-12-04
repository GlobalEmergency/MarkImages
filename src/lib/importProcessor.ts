/**
 * Background Import Processor
 * Ejecuta importaciones de manera asíncrona y actualiza el progreso
 * Con soporte para checkpoints y recuperación automática
 */

import { prisma } from "@/lib/db";

import { ImportDeaBatchUseCase } from "@/application/import/use-cases/ImportDeaBatchUseCase";
import { CsvParserAdapter } from "@/infrastructure/import/parsers/CsvParserAdapter";
import { PrismaImportRepository } from "@/infrastructure/import/repositories/PrismaImportRepository";
import { PrismaDuplicateDetectionAdapter } from "@/infrastructure/import/adapters/PrismaDuplicateDetectionAdapter";
import { S3ImageStorageAdapter } from "@/infrastructure/storage/adapters/S3ImageStorageAdapter";
import { SharePointImageDownloader } from "@/infrastructure/storage/adapters/SharePointImageDownloader";
import { HeartbeatManager } from "@/lib/recovery/HeartbeatManager";
import { CheckpointManager } from "@/lib/recovery/CheckpointManager";

/**
 * Procesa una importación de manera asíncrona
 * Actualiza el estado del batch durante el proceso
 * Con soporte para checkpoints, heartbeat y recuperación
 */
export async function processImportAsync(
  batchId: string,
  filePath: string,
  userId: string,
  mappings?: Array<{ csvColumn: string; systemField: string }>,
  sharePointAuth?: any,
  isResume: boolean = false
): Promise<void> {
  // Inicializar managers
  const heartbeatInterval = parseInt(process.env.IMPORT_HEARTBEAT_INTERVAL_MS || "30000");
  const heartbeatManager = new HeartbeatManager(prisma, batchId, heartbeatInterval);
  const checkpointManager = new CheckpointManager(prisma);

  try {
    console.log(`🚀 ${isResume ? "Resuming" : "Starting"} async import for batch ${batchId}`);

    // Obtener información del batch y extraer cookies de SharePoint si existen
    const batch = await prisma.importBatch.findUnique({
      where: { id: batchId },
      select: { import_parameters: true },
    });

    let sharePointCookies: Record<string, string> | undefined;
    if (batch?.import_parameters && typeof batch.import_parameters === "object") {
      const params = batch.import_parameters as any;
      if (params.sharepointAuth?.cookies) {
        sharePointCookies = params.sharepointAuth.cookies;
        console.log(`🔐 SharePoint cookies found in batch parameters`);
      }
    }

    // Obtener información del batch para saber si es reanudación
    let lastCheckpointIndex = -1;
    if (isResume) {
      lastCheckpointIndex = await checkpointManager.getLastCheckpointIndex(batchId);
      console.log(`📍 Resuming from checkpoint index: ${lastCheckpointIndex}`);
    }

    // Actualizar estado a IN_PROGRESS e iniciar heartbeat
    await prisma.importBatch.update({
      where: { id: batchId },
      data: {
        status: "IN_PROGRESS",
        started_at: isResume ? undefined : new Date(),
        last_heartbeat: new Date(),
      },
    });

    // Iniciar heartbeat
    heartbeatManager.start();

    // Inyección de dependencias
    const repository = new PrismaImportRepository(prisma);
    const csvParser = new CsvParserAdapter();
    const imageDownloader = new SharePointImageDownloader();
    const imageStorage = new S3ImageStorageAdapter();
    const duplicateDetector = new PrismaDuplicateDetectionAdapter(prisma);

    const useCase = new ImportDeaBatchUseCase(
      repository,
      csvParser,
      imageDownloader,
      imageStorage,
      duplicateDetector
    );

    // Ejecutar importación con soporte de checkpoints
    const startTime = Date.now();
    const checkpointFrequency = parseInt(process.env.IMPORT_CHECKPOINT_EVERY || "10");

    // Construir configuración de autenticación de SharePoint si tenemos cookies
    const authConfig = sharePointCookies
      ? {
          type: "cookies" as const,
          cookies: sharePointCookies,
        }
      : sharePointAuth;

    const result = await useCase.execute({
      batchId, // Usar el batch ya creado (evitar duplicación)
      filePath,
      batchName: "", // El batch ya existe
      importedBy: userId,
      mappings, // Pasar mappings del usuario
      sharePointAuth: authConfig,
      chunkSize: 50,
      dryRun: false, // Siempre importación real en este flujo

      // Recovery & Checkpoints
      checkpointManager,
      startFromIndex: lastCheckpointIndex + 1,
      checkpointFrequency,
    });

    const durationSeconds = Math.floor((Date.now() - startTime) / 1000);

    // Type guard: verificar que es RealImportResponse
    if (result.dryRun) {
      throw new Error("Unexpected dry run result in real import process");
    }

    // Determinar estado final
    const finalStatus =
      result.failedRecords > 0 && result.successfulRecords > 0
        ? "COMPLETED_WITH_ERRORS"
        : result.failedRecords === result.totalRecords
          ? "FAILED"
          : "COMPLETED";

    // Limpiar cookies de SharePoint del batch (seguridad)
    let cleanedParameters: any = batch?.import_parameters || {};
    if (typeof cleanedParameters === "object" && cleanedParameters.sharepointAuth) {
      cleanedParameters = { ...cleanedParameters };
      delete cleanedParameters.sharepointAuth;
      console.log(`🧹 Cleaned SharePoint cookies from batch parameters`);
    }

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
        import_parameters: Object.keys(cleanedParameters).length > 0 ? cleanedParameters : null,
      },
    });

    console.log(
      `✅ Import completed: ${result.successfulRecords}/${result.totalRecords} successful`
    );
  } catch (error) {
    console.error("❌ Import failed:", error);

    // Obtener batch para limpiar cookies incluso en caso de error
    const batch = await prisma.importBatch.findUnique({
      where: { id: batchId },
      select: { import_parameters: true },
    });

    let cleanedParameters: any = batch?.import_parameters || {};
    if (typeof cleanedParameters === "object" && cleanedParameters.sharepointAuth) {
      cleanedParameters = { ...cleanedParameters };
      delete cleanedParameters.sharepointAuth;
      console.log(`🧹 Cleaned SharePoint cookies from failed batch`);
    }

    // Actualizar batch como FAILED
    await prisma.importBatch.update({
      where: { id: batchId },
      data: {
        status: "FAILED",
        completed_at: new Date(),
        import_parameters: Object.keys(cleanedParameters).length > 0 ? cleanedParameters : null,
        error_summary: {
          message: error instanceof Error ? error.message : "Unknown error",
          stack: error instanceof Error ? error.stack : undefined,
        },
      },
    });
  } finally {
    // Detener heartbeat
    heartbeatManager.stop();

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
