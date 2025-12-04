/**
 * ImportRecoveryService
 * Detecta y recupera importaciones interrumpidas al reiniciar el servidor
 */

import type { PrismaClient } from "@/generated/client";
import { CheckpointManager } from "./CheckpointManager";

export interface RecoveryConfig {
  enabled: boolean;
  autoResume: boolean;
  heartbeatTimeoutMs: number;
}

export interface OrphanedBatch {
  id: string;
  name: string;
  status: string;
  lastHeartbeat: Date | null;
  lastCheckpointIndex: number;
  totalRecords: number;
  successfulRecords: number;
  failedRecords: number;
  cancelledManually: boolean;
}

/**
 * Servicio de recuperación automática de importaciones
 * Se ejecuta al iniciar el servidor para detectar procesos interrumpidos
 */
export class ImportRecoveryService {
  private checkpointManager: CheckpointManager;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly config: RecoveryConfig
  ) {
    this.checkpointManager = new CheckpointManager(prisma);
  }

  /**
   * Ejecuta el proceso de recuperación al inicio del servidor
   * Detecta batches huérfanos y los marca como INTERRUPTED
   */
  async runRecovery(): Promise<void> {
    if (!this.config.enabled) {
      console.log("🔄 Import recovery is disabled");
      return;
    }

    console.log("🔍 Checking for orphaned import batches...");

    try {
      const orphanedBatches = await this.findOrphanedBatches();

      if (orphanedBatches.length === 0) {
        console.log("✅ No orphaned batches found");
        return;
      }

      console.log(`⚠️  Found ${orphanedBatches.length} orphaned batch(es)`);

      for (const batch of orphanedBatches) {
        await this.handleOrphanedBatch(batch);
      }

      console.log("✅ Recovery process completed");
    } catch (error) {
      console.error("❌ Recovery process failed:", error);
      throw error;
    }
  }

  /**
   * Encuentra batches que quedaron huérfanos (IN_PROGRESS sin heartbeat reciente)
   */
  async findOrphanedBatches(): Promise<OrphanedBatch[]> {
    const timeoutDate = new Date(Date.now() - this.config.heartbeatTimeoutMs);

    const batches = await this.prisma.importBatch.findMany({
      where: {
        OR: [
          {
            // Batches en progreso sin heartbeat reciente
            status: "IN_PROGRESS",
            last_heartbeat: {
              lt: timeoutDate,
            },
          },
          {
            // Batches en progreso sin heartbeat (primera vez)
            status: "IN_PROGRESS",
            last_heartbeat: null,
          },
          {
            // Batches en estado RESUMING que quedaron colgados
            status: "RESUMING",
          },
        ],
      },
      select: {
        id: true,
        name: true,
        status: true,
        last_heartbeat: true,
        last_checkpoint_index: true,
        total_records: true,
        successful_records: true,
        failed_records: true,
        cancelled_manually: true,
      },
    });

    // Mapear a OrphanedBatch (convertir snake_case a camelCase)
    return batches.map((batch) => ({
      id: batch.id,
      name: batch.name,
      status: batch.status,
      lastHeartbeat: batch.last_heartbeat,
      lastCheckpointIndex: batch.last_checkpoint_index,
      totalRecords: batch.total_records,
      successfulRecords: batch.successful_records,
      failedRecords: batch.failed_records,
      cancelledManually: batch.cancelled_manually,
    }));
  }

  /**
   * Maneja un batch huérfano: lo marca como INTERRUPTED o lo reanuda
   */
  private async handleOrphanedBatch(batch: OrphanedBatch): Promise<void> {
    console.log(`\n📦 Processing orphaned batch: ${batch.name} (${batch.id})`);
    console.log(`   Status: ${batch.status}`);
    console.log(`   Last heartbeat: ${batch.lastHeartbeat || "never"}`);
    console.log(`   Progress: ${batch.successfulRecords}/${batch.totalRecords}`);
    console.log(`   Last checkpoint: ${batch.lastCheckpointIndex}`);

    // Si fue cancelado manualmente, NO reanudar
    if (batch.cancelledManually) {
      console.log(`   ⛔ Batch was cancelled manually, marking as CANCELLED`);
      await this.markAsCancelled(batch.id);
      return;
    }

    // Marcar como INTERRUPTED
    await this.markAsInterrupted(batch.id);

    // Si auto-resume está habilitado, intentar reanudar
    if (this.config.autoResume) {
      console.log(`   🔄 Auto-resume enabled, attempting to resume automatically...`);
      try {
        await this.autoResumeBatch(batch.id);
      } catch (error) {
        console.error(`   ❌ Auto-resume failed:`, error);
        // Mantener el estado INTERRUPTED para que pueda ser reanudado manualmente
      }
    } else {
      console.log(`   ⏸️  Manual resume required`);
    }
  }

  /**
   * Reanuda automáticamente un batch interrumpido
   */
  private async autoResumeBatch(batchId: string): Promise<void> {
    // Obtener información completa del batch
    const batch = await this.prisma.importBatch.findUnique({
      where: { id: batchId },
      select: {
        id: true,
        name: true,
        file_name: true,
        imported_by: true,
        import_parameters: true,
        last_checkpoint_index: true,
      },
    });

    if (!batch) {
      throw new Error(`Batch ${batchId} not found`);
    }

    // Validar que existan parámetros de importación
    const importParams = batch.import_parameters as any;
    if (!importParams) {
      console.log(`   ⚠️  Batch cannot be resumed: missing import parameters`);
      console.log(`   📌 This batch was likely created before the recovery system was implemented`);

      // Marcar el batch con un error descriptivo pero no lanzar excepción
      await this.prisma.importBatch.update({
        where: { id: batchId },
        data: {
          error_summary: {
            message:
              "Cannot resume: batch created before recovery system (missing import parameters)",
            timestamp: new Date().toISOString(),
            recoverable: false,
          },
        },
      });
      return;
    }

    const { filePath, mappings, sharePointAuth } = importParams;

    // Validar que exista el filePath
    if (!filePath) {
      console.log(`   ⚠️  Batch cannot be resumed: missing file path in parameters`);

      await this.prisma.importBatch.update({
        where: { id: batchId },
        data: {
          error_summary: {
            message: "Cannot resume: file path not found in batch parameters",
            timestamp: new Date().toISOString(),
            recoverable: false,
          },
        },
      });
      return;
    }

    // Preparar batch para reanudación
    await this.prepareBatchForResume(batchId);

    // Importar dinámicamente processImportAsync para evitar dependencias circulares
    const { processImportAsync } = await import("@/lib/importProcessor");

    // Iniciar proceso de reanudación en background
    console.log(`   ▶️  Starting automatic resumption for batch ${batchId}...`);
    processImportAsync(
      batchId,
      filePath,
      batch.imported_by,
      mappings,
      sharePointAuth,
      true // isResume = true
    ).catch((error) => {
      console.error(`   ❌ Background resumption failed for batch ${batchId}:`, error);
    });

    console.log(`   ✅ Auto-resume initiated successfully`);
  }

  /**
   * Marca un batch como INTERRUPTED
   */
  private async markAsInterrupted(batchId: string): Promise<void> {
    await this.prisma.importBatch.update({
      where: { id: batchId },
      data: {
        status: "INTERRUPTED",
        error_summary: {
          message: "Import was interrupted (server restart detected)",
          timestamp: new Date().toISOString(),
        },
      },
    });
  }

  /**
   * Marca un batch como CANCELLED (fue cancelado manualmente)
   */
  private async markAsCancelled(batchId: string): Promise<void> {
    await this.prisma.importBatch.update({
      where: { id: batchId },
      data: {
        status: "CANCELLED",
        completed_at: new Date(),
      },
    });
  }

  /**
   * Verifica si un batch puede ser reanudado
   */
  async canBatchBeResumed(batchId: string): Promise<boolean> {
    const batch = await this.prisma.importBatch.findUnique({
      where: { id: batchId },
      select: {
        status: true,
        cancelled_manually: true,
        last_checkpoint_index: true,
        import_parameters: true,
      },
    });

    if (!batch) {
      return false;
    }

    // Verificar que tenga parámetros de importación válidos
    const importParams = batch.import_parameters as any;
    if (!importParams || !importParams.filePath) {
      return false;
    }

    // Solo batches INTERRUPTED pueden ser reanudados
    // Y solo si no fueron cancelados manualmente
    return (
      batch.status === "INTERRUPTED" &&
      !batch.cancelled_manually &&
      batch.last_checkpoint_index >= 0
    );
  }

  /**
   * Obtiene información de un batch para reanudación
   */
  async getBatchResumeInfo(batchId: string): Promise<{
    lastCheckpointIndex: number;
    stats: {
      total: number;
      success: number;
      failed: number;
      skipped: number;
    };
  } | null> {
    const batch = await this.prisma.importBatch.findUnique({
      where: { id: batchId },
      select: {
        last_checkpoint_index: true,
        total_records: true,
        successful_records: true,
        failed_records: true,
      },
    });

    if (!batch) {
      return null;
    }

    const checkpointStats = await this.checkpointManager.getCheckpointStats(batchId);

    return {
      lastCheckpointIndex: batch.last_checkpoint_index,
      stats: {
        total: batch.total_records,
        success: batch.successful_records,
        failed: batch.failed_records,
        skipped: checkpointStats.skipped,
      },
    };
  }

  /**
   * Lista todos los batches que pueden ser reanudados
   */
  async listResumableBatches(): Promise<OrphanedBatch[]> {
    const batches = await this.prisma.importBatch.findMany({
      where: {
        status: "INTERRUPTED",
        cancelled_manually: false,
      },
      select: {
        id: true,
        name: true,
        status: true,
        last_heartbeat: true,
        last_checkpoint_index: true,
        total_records: true,
        successful_records: true,
        failed_records: true,
        cancelled_manually: true,
      },
      orderBy: {
        created_at: "desc",
      },
    });

    // Mapear a OrphanedBatch (convertir snake_case a camelCase)
    return batches.map((batch) => ({
      id: batch.id,
      name: batch.name,
      status: batch.status,
      lastHeartbeat: batch.last_heartbeat,
      lastCheckpointIndex: batch.last_checkpoint_index,
      totalRecords: batch.total_records,
      successfulRecords: batch.successful_records,
      failedRecords: batch.failed_records,
      cancelledManually: batch.cancelled_manually,
    }));
  }

  /**
   * Prepara un batch para reanudación
   */
  async prepareBatchForResume(batchId: string): Promise<void> {
    const canResume = await this.canBatchBeResumed(batchId);
    if (!canResume) {
      throw new Error(`Batch ${batchId} cannot be resumed`);
    }

    await this.prisma.importBatch.update({
      where: { id: batchId },
      data: {
        status: "RESUMING",
        resumed_count: { increment: 1 },
        last_heartbeat: new Date(),
      },
    });
  }
}
