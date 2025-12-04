/**
 * CheckpointManager
 * Gestiona checkpoints granulares para importaciones resumibles
 */

import type { PrismaClient } from "@/generated/client";
import { createHash } from "crypto";

export interface CheckpointData {
  importBatchId: string;
  recordIndex: number;
  recordReference?: string;
  recordData?: any;
  status: "SUCCESS" | "FAILED" | "SKIPPED";
  errorMessage?: string;
  processingTimeMs?: number;
}

export interface CheckpointStats {
  total: number;
  success: number;
  failed: number;
  skipped: number;
  lastIndex: number;
}

/**
 * Gestor de checkpoints para importaciones
 * Permite guardar progreso granular y reanudar desde el último punto
 */
export class CheckpointManager {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Guarda un checkpoint de un registro procesado
   * Usa upsert para evitar errores de duplicados en caso de reintentos
   */
  async saveCheckpoint(data: CheckpointData): Promise<void> {
    const recordHash = data.recordData ? this.generateHash(data.recordData) : undefined;

    await this.prisma.importCheckpoint.upsert({
      where: {
        import_batch_id_record_index: {
          import_batch_id: data.importBatchId,
          record_index: data.recordIndex,
        },
      },
      create: {
        import_batch_id: data.importBatchId,
        record_index: data.recordIndex,
        record_reference: data.recordReference,
        record_hash: recordHash,
        status: data.status,
        error_message: data.errorMessage,
        processing_time_ms: data.processingTimeMs,
        record_data: data.recordData,
      },
      update: {
        record_reference: data.recordReference,
        record_hash: recordHash,
        status: data.status,
        error_message: data.errorMessage,
        processing_time_ms: data.processingTimeMs,
        record_data: data.recordData,
      },
    });

    // Actualizar el last_checkpoint_index del batch
    await this.prisma.importBatch.update({
      where: { id: data.importBatchId },
      data: { last_checkpoint_index: data.recordIndex },
    });
  }

  /**
   * Guarda múltiples checkpoints en una transacción
   */
  async saveCheckpoints(checkpoints: CheckpointData[]): Promise<void> {
    if (checkpoints.length === 0) return;

    await this.prisma.$transaction(async (tx) => {
      // Crear todos los checkpoints
      await tx.importCheckpoint.createMany({
        data: checkpoints.map((cp) => ({
          import_batch_id: cp.importBatchId,
          record_index: cp.recordIndex,
          record_reference: cp.recordReference,
          record_hash: cp.recordData ? this.generateHash(cp.recordData) : undefined,
          status: cp.status,
          error_message: cp.errorMessage,
          processing_time_ms: cp.processingTimeMs,
          record_data: cp.recordData,
        })),
      });

      // Actualizar el último índice procesado
      const lastIndex = Math.max(...checkpoints.map((cp) => cp.recordIndex));
      await tx.importBatch.update({
        where: { id: checkpoints[0].importBatchId },
        data: { last_checkpoint_index: lastIndex },
      });
    });
  }

  /**
   * Obtiene el último índice procesado para un batch
   */
  async getLastCheckpointIndex(batchId: string): Promise<number> {
    const batch = await this.prisma.importBatch.findUnique({
      where: { id: batchId },
      select: { last_checkpoint_index: true },
    });

    return batch?.last_checkpoint_index ?? -1;
  }

  /**
   * Obtiene estadísticas de checkpoints para un batch
   */
  async getCheckpointStats(batchId: string): Promise<CheckpointStats> {
    const [total, success, failed, skipped, lastCheckpoint] = await Promise.all([
      this.prisma.importCheckpoint.count({
        where: { import_batch_id: batchId },
      }),
      this.prisma.importCheckpoint.count({
        where: { import_batch_id: batchId, status: "SUCCESS" },
      }),
      this.prisma.importCheckpoint.count({
        where: { import_batch_id: batchId, status: "FAILED" },
      }),
      this.prisma.importCheckpoint.count({
        where: { import_batch_id: batchId, status: "SKIPPED" },
      }),
      this.prisma.importCheckpoint.findFirst({
        where: { import_batch_id: batchId },
        orderBy: { record_index: "desc" },
        select: { record_index: true },
      }),
    ]);

    return {
      total,
      success,
      failed,
      skipped,
      lastIndex: lastCheckpoint?.record_index ?? -1,
    };
  }

  /**
   * Verifica si un registro ya fue procesado
   */
  async isRecordProcessed(batchId: string, recordIndex: number): Promise<boolean> {
    const checkpoint = await this.prisma.importCheckpoint.findUnique({
      where: {
        import_batch_id_record_index: {
          import_batch_id: batchId,
          record_index: recordIndex,
        },
      },
    });

    return checkpoint !== null;
  }

  /**
   * Verifica si un registro con el mismo hash ya existe
   */
  async findDuplicateByHash(batchId: string, recordData: any): Promise<boolean> {
    const hash = this.generateHash(recordData);
    const checkpoint = await this.prisma.importCheckpoint.findFirst({
      where: {
        import_batch_id: batchId,
        record_hash: hash,
        status: "SUCCESS",
      },
    });

    return checkpoint !== null;
  }

  /**
   * Obtiene índices de registros que fallaron para reintento
   */
  async getFailedRecordIndices(batchId: string): Promise<number[]> {
    const failedCheckpoints = await this.prisma.importCheckpoint.findMany({
      where: {
        import_batch_id: batchId,
        status: "FAILED",
      },
      select: { record_index: true },
      orderBy: { record_index: "asc" },
    });

    return failedCheckpoints.map((cp) => cp.record_index);
  }

  /**
   * Limpia checkpoints antiguos (opcional, para no llenar la BD)
   */
  async cleanOldCheckpoints(batchId: string): Promise<number> {
    const result = await this.prisma.importCheckpoint.deleteMany({
      where: { import_batch_id: batchId },
    });

    return result.count;
  }

  /**
   * Genera un hash único para un registro
   */
  private generateHash(data: any): string {
    const normalized = JSON.stringify(data, Object.keys(data).sort());
    return createHash("sha256").update(normalized).digest("hex").substring(0, 16);
  }
}
