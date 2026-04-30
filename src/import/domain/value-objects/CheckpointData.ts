/**
 * Value Object: Datos de checkpoint para importaciones resumibles
 * Capa de Dominio - Representa un punto de recuperación
 */

/**
 * Estado de procesamiento de un registro
 */
export type CheckpointStatus = "SUCCESS" | "FAILED" | "SKIPPED";

/**
 * Datos de un checkpoint individual
 */
export interface CheckpointData {
  /**
   * ID del batch de importación
   */
  batchId: string;

  /**
   * Ãndice del registro en la fuente (0-based)
   */
  recordIndex: number;

  /**
   * Referencia legible del registro (ej: external_id, row number)
   */
  recordReference?: string;

  /**
   * Hash del contenido para detectar duplicados
   */
  contentHash?: string;

  /**
   * Estado del procesamiento
   */
  status: CheckpointStatus;

  /**
   * Mensaje de error si falló
   */
  errorMessage?: string;

  /**
   * Tiempo de procesamiento en millisegundos
   */
  processingTimeMs?: number;

  /**
   * Datos originales del registro (para reintento)
   */
  recordData?: Record<string, unknown>;

  /**
   * Timestamp del checkpoint
   */
  createdAt?: Date;
}

/**
 * Estadísticas agregadas de checkpoints
 */
export interface CheckpointStats {
  /**
   * Total de checkpoints
   */
  total: number;

  /**
   * Registros procesados exitosamente
   */
  success: number;

  /**
   * Registros que fallaron
   */
  failed: number;

  /**
   * Registros saltados (duplicados, etc)
   */
  skipped: number;

  /**
   * Ãšltimo índice procesado
   */
  lastIndex: number;

  /**
   * Tiempo total de procesamiento
   */
  totalProcessingTimeMs?: number;

  /**
   * Tiempo promedio por registro
   */
  avgProcessingTimeMs?: number;
}

/**
 * Value Object: Builder para crear CheckpointData
 */
export class CheckpointDataBuilder {
  private data: Partial<CheckpointData> = {};

  constructor(batchId: string, recordIndex: number) {
    this.data.batchId = batchId;
    this.data.recordIndex = recordIndex;
  }

  withReference(reference: string): this {
    this.data.recordReference = reference;
    return this;
  }

  withHash(hash: string): this {
    this.data.contentHash = hash;
    return this;
  }

  withStatus(status: CheckpointStatus): this {
    this.data.status = status;
    return this;
  }

  withError(message: string): this {
    this.data.status = "FAILED";
    this.data.errorMessage = message;
    return this;
  }

  withProcessingTime(ms: number): this {
    this.data.processingTimeMs = ms;
    return this;
  }

  withRecordData(data: Record<string, unknown>): this {
    this.data.recordData = data;
    return this;
  }

  success(): this {
    this.data.status = "SUCCESS";
    return this;
  }

  failed(message: string): this {
    this.data.status = "FAILED";
    this.data.errorMessage = message;
    return this;
  }

  skipped(): this {
    this.data.status = "SKIPPED";
    return this;
  }

  build(): CheckpointData {
    if (!this.data.batchId || this.data.recordIndex === undefined || !this.data.status) {
      throw new Error("CheckpointData requires batchId, recordIndex, and status");
    }

    return {
      batchId: this.data.batchId,
      recordIndex: this.data.recordIndex,
      recordReference: this.data.recordReference,
      contentHash: this.data.contentHash,
      status: this.data.status,
      errorMessage: this.data.errorMessage,
      processingTimeMs: this.data.processingTimeMs,
      recordData: this.data.recordData,
      createdAt: new Date(),
    };
  }
}

/**
 * Helper para crear checkpoints rápidamente
 */
export const Checkpoint = {
  success(batchId: string, recordIndex: number, reference?: string): CheckpointData {
    return new CheckpointDataBuilder(batchId, recordIndex)
      .success()
      .withReference(reference || `record-${recordIndex}`)
      .build();
  },

  failed(batchId: string, recordIndex: number, error: string, reference?: string): CheckpointData {
    return new CheckpointDataBuilder(batchId, recordIndex)
      .failed(error)
      .withReference(reference || `record-${recordIndex}`)
      .build();
  },

  skipped(batchId: string, recordIndex: number, reference?: string): CheckpointData {
    return new CheckpointDataBuilder(batchId, recordIndex)
      .skipped()
      .withReference(reference || `record-${recordIndex}`)
      .build();
  },
};
