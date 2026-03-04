/**
 * Prisma State Store â€” @batchactions/import StateStore adapter
 *
 * Implementa la interface StateStore de @batchactions/import para persistir
 * el estado de los imports en PostgreSQL usando las tablas existentes:
 * - batch_jobs â†’ ImportJobState
 * - batch_job_checkpoints â†’ ProcessedRecord (individual records)
 * - batch_job_errors â†’ Failed records con detalle de errores
 *
 * Mapea entre el modelo de estado de @batchactions/import y el modelo de datos
 * existente del sistema BatchJob.
 */

import type { StateStore, JobState, ProcessedRecord, JobProgress } from "@batchactions/import";
import type { BatchState } from "@batchactions/core";
import { PrismaClient, BatchJobStatus, BatchCheckpointStatus } from "@/generated/client/client";

// ============================================================
// Status mapping entre @batchactions/import y Prisma
// ============================================================

type BulkImportStatus = JobState["status"];

const STATUS_TO_PRISMA: Record<BulkImportStatus, BatchJobStatus> = {
  CREATED: BatchJobStatus.PENDING,
  PREVIEWING: BatchJobStatus.PENDING,
  PREVIEWED: BatchJobStatus.PENDING,
  PROCESSING: BatchJobStatus.IN_PROGRESS,
  PAUSED: BatchJobStatus.WAITING, // WAITING = listo para continuar en CRON
  COMPLETED: BatchJobStatus.COMPLETED,
  ABORTED: BatchJobStatus.CANCELLED,
  FAILED: BatchJobStatus.FAILED,
};

const PRISMA_TO_STATUS: Partial<Record<BatchJobStatus, BulkImportStatus>> = {
  [BatchJobStatus.PENDING]: "CREATED",
  [BatchJobStatus.QUEUED]: "CREATED",
  [BatchJobStatus.IN_PROGRESS]: "PROCESSING",
  [BatchJobStatus.PAUSED]: "PAUSED",
  [BatchJobStatus.WAITING]: "PAUSED",
  [BatchJobStatus.COMPLETED]: "COMPLETED",
  [BatchJobStatus.COMPLETED_WITH_WARNINGS]: "COMPLETED",
  [BatchJobStatus.FAILED]: "FAILED",
  [BatchJobStatus.CANCELLED]: "ABORTED",
  [BatchJobStatus.INTERRUPTED]: "PAUSED",
  [BatchJobStatus.RESUMING]: "PROCESSING",
};

const RECORD_STATUS_TO_CHECKPOINT: Record<string, BatchCheckpointStatus> = {
  processed: BatchCheckpointStatus.SUCCESS,
  failed: BatchCheckpointStatus.FAILED,
  invalid: BatchCheckpointStatus.FAILED,
  valid: BatchCheckpointStatus.SUCCESS,
  pending: BatchCheckpointStatus.SKIPPED,
};

/** Contexto de importaciÃ³n persistido en metadata para resume/CRON */
export interface ImportContext {
  s3Url: string;
  fileName: string;
  delimiter?: string;
  sharePointAuth?: { rtFa?: string; fedAuth?: string };
  skipDuplicates?: boolean;
}

export interface PrismaStateStoreOptions {
  /** ID del usuario que creÃ³ el job */
  createdBy: string;
  /** Nombre del batch job */
  jobName?: string;
  /**
   * Contexto de importaciÃ³n que se persiste en metadata.import_context.
   * Necesario para que el CRON pueda reconstruir ResumeImportOptions.
   */
  importContext?: ImportContext;
}

/**
 * StateStore que persiste el estado de @batchactions/import en PostgreSQL
 * a travÃ©s de Prisma, usando las tablas batch_jobs, batch_job_checkpoints
 * y batch_job_errors existentes.
 *
 * @example
 * ```typescript
 * const stateStore = new PrismaStateStore(prisma, { createdBy: userId });
 * const importer = new BulkImport({
 *   schema: aedImportSchema,
 *   stateStore,
 * });
 * ```
 */
export class PrismaStateStore implements StateStore {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly options: PrismaStateStoreOptions
  ) {}

  /**
   * Persiste el estado completo del job.
   * Crea o actualiza el registro en batch_jobs.
   */
  async saveJobState(job: JobState): Promise<void> {
    const prismaStatus = STATUS_TO_PRISMA[job.status] || BatchJobStatus.PENDING;

    // Calcular contadores desde los batches
    let processedRecords = 0;
    let failedRecords = 0;
    for (const batch of job.batches) {
      processedRecords += batch.processedCount;
      failedRecords += batch.failedCount;
    }

    const metadata = {
      engine: "bulkimport" as const,
      bulkimport_status: job.status,
      bulkimport_batches: job.batches.map((b) => ({
        id: b.id,
        index: b.index,
        status: b.status,
        processedCount: b.processedCount,
        failedCount: b.failedCount,
      })),
      ...(this.options.importContext && {
        import_context: this.options.importContext,
      }),
    };

    const data = {
      type: "AED_CSV_IMPORT" as const,
      name: this.options.jobName || `Import ${new Date().toISOString()}`,
      status: prismaStatus,
      config: this.serializeConfig(job.config) as object,
      total_records: job.totalRecords,
      processed_records: processedRecords,
      successful_records: Math.max(0, processedRecords - failedRecords),
      failed_records: failedRecords,
      skipped_records: 0,
      warning_records: 0,
      current_chunk: job.batches.length,
      total_chunks: job.batches.length,
      started_at: job.startedAt ? new Date(job.startedAt) : null,
      completed_at: job.completedAt ? new Date(job.completedAt) : null,
      last_heartbeat: new Date(),
      last_checkpoint_index: processedRecords > 0 ? processedRecords - 1 : -1,
      created_by: this.options.createdBy,
      metadata: metadata as object,
    };

    await this.prisma.batchJob.upsert({
      where: { id: job.id },
      create: { id: job.id, ...data },
      update: data,
    });
  }

  /**
   * Recupera el estado de un job persistido.
   */
  async getJobState(jobId: string): Promise<JobState | null> {
    const job = await this.prisma.batchJob.findUnique({
      where: { id: jobId },
    });

    if (!job) return null;

    const metadata = (job.metadata || {}) as Record<string, unknown>;
    const bulkimportBatches = (metadata.bulkimport_batches || []) as Array<{
      id: string;
      index: number;
      status: string;
      processedCount: number;
      failedCount: number;
    }>;

    const status: BulkImportStatus =
      (metadata.bulkimport_status as BulkImportStatus) || PRISMA_TO_STATUS[job.status] || "CREATED";

    return {
      id: job.id,
      status,
      totalRecords: job.total_records,
      startedAt: job.started_at?.getTime(),
      completedAt: job.completed_at?.getTime(),
      config: this.deserializeConfig(job.config),
      batches: bulkimportBatches.map((b) => ({
        id: b.id,
        index: b.index,
        status: b.status as "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "PAUSED",
        records: [] as readonly ProcessedRecord[], // No cargamos records en memoria
        processedCount: b.processedCount,
        failedCount: b.failedCount,
      })),
    };
  }

  /**
   * Actualiza el estado de un batch especÃ­fico.
   */
  async updateBatchState(jobId: string, batchId: string, state: BatchState): Promise<void> {
    const job = await this.prisma.batchJob.findUnique({
      where: { id: jobId },
      select: { metadata: true },
    });

    if (!job) return;

    const metadata = (job.metadata || {}) as Record<string, unknown>;
    const batches = (metadata.bulkimport_batches || []) as Array<Record<string, unknown>>;

    const batchIndex = batches.findIndex((b) => b.id === batchId);
    if (batchIndex >= 0) {
      batches[batchIndex] = {
        ...batches[batchIndex],
        status: state.status,
        processedCount: state.processedCount,
        failedCount: state.failedCount,
      };
    }

    await this.prisma.batchJob.update({
      where: { id: jobId },
      data: {
        metadata: { ...metadata, bulkimport_batches: batches } as object,
        last_heartbeat: new Date(),
      },
    });
  }

  /**
   * Persiste un record procesado como checkpoint + error (si fallÃ³).
   */
  async saveProcessedRecord(
    jobId: string,
    _batchId: string,
    record: ProcessedRecord
  ): Promise<void> {
    const checkpointStatus =
      RECORD_STATUS_TO_CHECKPOINT[record.status] || BatchCheckpointStatus.SKIPPED;

    // Guardar checkpoint
    await this.prisma.batchJobCheckpoint.upsert({
      where: {
        job_id_record_index: {
          job_id: jobId,
          record_index: record.index,
        },
      },
      create: {
        job_id: jobId,
        record_index: record.index,
        record_reference: this.extractRecordReference(record),
        status: checkpointStatus,
        error_message: record.processingError || record.errors?.[0]?.message,
        record_data: (record.raw || {}) as object,
      },
      update: {
        status: checkpointStatus,
        error_message: record.processingError || record.errors?.[0]?.message,
        record_data: (record.raw || {}) as object,
      },
    });

    // Si tiene errores, guardarlos en batch_job_errors
    if (record.errors && record.errors.length > 0) {
      for (const error of record.errors) {
        await this.prisma.batchJobError.create({
          data: {
            job_id: jobId,
            record_index: record.index,
            record_reference: this.extractRecordReference(record),
            error_type: error.category || error.code || "VALIDATION",
            error_message: error.message,
            severity: this.mapSeverity(error.severity),
            row_data: (record.raw || {}) as object,
            correction_suggestion: error.suggestion,
          },
        });
      }
    }

    // Si fallÃ³ por processingError
    if (record.processingError) {
      await this.prisma.batchJobError.create({
        data: {
          job_id: jobId,
          record_index: record.index,
          record_reference: this.extractRecordReference(record),
          error_type: "PROCESSING",
          error_message: record.processingError,
          severity: "ERROR",
          row_data: (record.raw || {}) as object,
        },
      });
    }
  }

  /**
   * Obtiene records que fallaron (validaciÃ³n o procesamiento).
   */
  async getFailedRecords(jobId: string): Promise<readonly ProcessedRecord[]> {
    const checkpoints = await this.prisma.batchJobCheckpoint.findMany({
      where: {
        job_id: jobId,
        status: BatchCheckpointStatus.FAILED,
      },
      orderBy: { record_index: "asc" },
    });

    const errors = await this.prisma.batchJobError.findMany({
      where: { job_id: jobId },
      orderBy: { record_index: "asc" },
    });

    // Agrupar errores por record_index
    const errorsByIndex = new Map<number, typeof errors>();
    for (const error of errors) {
      if (error.record_index !== null) {
        const existing = errorsByIndex.get(error.record_index) || [];
        existing.push(error);
        errorsByIndex.set(error.record_index, existing);
      }
    }

    return checkpoints.map((cp) => {
      const recordErrors = errorsByIndex.get(cp.record_index) || [];
      return {
        index: cp.record_index,
        raw: (cp.record_data as Record<string, unknown>) || {},
        parsed: (cp.record_data as Record<string, unknown>) || {},
        status: "failed" as const,
        errors: recordErrors.map((e) => ({
          field: "",
          message: e.error_message,
          code: e.error_type as "CUSTOM_VALIDATION",
          severity: e.severity === "WARNING" ? ("warning" as const) : ("error" as const),
          category: e.error_type as "VALIDATION",
          suggestion: e.correction_suggestion || undefined,
        })),
        processingError: cp.error_message || undefined,
      };
    });
  }

  /**
   * Obtiene records pendientes (no procesados todavÃ­a).
   */
  async getPendingRecords(jobId: string): Promise<readonly ProcessedRecord[]> {
    // En nuestro modelo, los pending records no se persisten como checkpoints
    // Solo podemos inferirlos contando procesados vs total
    const job = await this.prisma.batchJob.findUnique({
      where: { id: jobId },
      select: { total_records: true, processed_records: true },
    });

    if (!job) return [];

    // No podemos reconstruir los pending records sin re-parsear el CSV
    // Devolvemos array vacÃ­o - @batchactions/import los obtendrÃ¡ del source al hacer restore
    return [];
  }

  /**
   * Obtiene records procesados exitosamente.
   */
  async getProcessedRecords(jobId: string): Promise<readonly ProcessedRecord[]> {
    const checkpoints = await this.prisma.batchJobCheckpoint.findMany({
      where: {
        job_id: jobId,
        status: BatchCheckpointStatus.SUCCESS,
      },
      orderBy: { record_index: "asc" },
    });

    return checkpoints.map((cp) => ({
      index: cp.record_index,
      raw: (cp.record_data as Record<string, unknown>) || {},
      parsed: (cp.record_data as Record<string, unknown>) || {},
      status: "processed" as const,
      errors: [] as const,
    }));
  }

  /**
   * Calcula el progreso desde el estado persistido.
   */
  async getProgress(jobId: string): Promise<JobProgress> {
    const job = await this.prisma.batchJob.findUnique({
      where: { id: jobId },
      select: {
        total_records: true,
        processed_records: true,
        successful_records: true,
        failed_records: true,
        started_at: true,
        current_chunk: true,
        total_chunks: true,
      },
    });

    if (!job) {
      return {
        totalRecords: 0,
        processedRecords: 0,
        failedRecords: 0,
        pendingRecords: 0,
        percentage: 0,
        currentBatch: 0,
        totalBatches: 0,
        elapsedMs: 0,
      };
    }

    // processed_records ya incluye los failed (ver saveJobState:
    // processedRecords = sum(batch.processedCount) que incluye éxitos + fallos)
    const totalProcessed = job.processed_records;
    const elapsedMs = job.started_at ? Date.now() - job.started_at.getTime() : 0;
    const percentage =
      job.total_records > 0 ? Math.round((totalProcessed / job.total_records) * 100) : 0;

    const recordsPerSecond = elapsedMs > 0 ? (totalProcessed / elapsedMs) * 1000 : 0;
    const remaining = job.total_records - totalProcessed;
    const estimatedRemainingMs =
      recordsPerSecond > 0 ? Math.round((remaining / recordsPerSecond) * 1000) : undefined;

    return {
      totalRecords: job.total_records,
      processedRecords: job.processed_records,
      failedRecords: job.failed_records,
      pendingRecords: Math.max(0, job.total_records - totalProcessed),
      percentage,
      currentBatch: job.current_chunk,
      totalBatches: job.total_chunks,
      elapsedMs,
      estimatedRemainingMs,
    };
  }

  // ============================================================
  // Helpers privados
  // ============================================================

  /**
   * Serializa la config del job para almacenar en JSON.
   * Excluye funciones (customValidator, transform) que no son serializables.
   */
  private serializeConfig(config: JobState["config"]): Record<string, unknown> {
    return {
      batchSize: config.batchSize,
      maxConcurrentBatches: config.maxConcurrentBatches,
      continueOnError: config.continueOnError,
      // Schema se almacena sin funciones
      schema: this.serializeSchema(config.schema),
    };
  }

  /**
   * Deserializa la config del job desde JSON.
   * Nota: los custom validators y transforms se pierden en serializaciÃ³n.
   * Al hacer restore(), el caller debe proporcionar el schema completo.
   */
  private deserializeConfig(config: unknown): JobState["config"] {
    const c = config as Record<string, unknown>;
    return {
      batchSize: (c.batchSize as number) || 100,
      maxConcurrentBatches: c.maxConcurrentBatches as number | undefined,
      continueOnError: (c.continueOnError as boolean) || false,
      schema: (c.schema as JobState["config"]["schema"]) || { fields: [] },
    };
  }

  /**
   * Serializa un schema potencialmente no tipado fuerte (Record<string, unknown>)
   * conservando solo propiedades relevantes para persistencia.
   */
  private serializeSchema(schema: unknown): Record<string, unknown> {
    if (!schema || typeof schema !== "object") {
      return { fields: [] };
    }

    const source = schema as Record<string, unknown>;
    const fields = Array.isArray(source.fields)
      ? source.fields
          .filter((field): field is Record<string, unknown> =>
            Boolean(field && typeof field === "object")
          )
          .map((field) => ({
            name: field.name,
            type: field.type,
            required: field.required,
            aliases: field.aliases,
          }))
      : [];

    return {
      fields,
      ...(typeof source.strict === "boolean" ? { strict: source.strict } : {}),
      ...(typeof source.skipEmptyRows === "boolean" ? { skipEmptyRows: source.skipEmptyRows } : {}),
      ...(Array.isArray(source.uniqueFields) ? { uniqueFields: source.uniqueFields } : {}),
    };
  }

  /**
   * Extrae una referencia legible de un record (cÃ³digo, nombre, etc.)
   */
  private extractRecordReference(record: ProcessedRecord): string | undefined {
    const raw = record.raw || {};
    return (
      (raw.code as string) ||
      (raw.proposedName as string) ||
      (raw.externalReference as string) ||
      undefined
    );
  }

  /**
   * Mapea severity de @batchactions/import a Prisma BatchErrorSeverity
   */
  private mapSeverity(severity?: "error" | "warning"): "INFO" | "WARNING" | "ERROR" | "CRITICAL" {
    switch (severity) {
      case "warning":
        return "WARNING";
      case "error":
      default:
        return "ERROR";
    }
  }
}
