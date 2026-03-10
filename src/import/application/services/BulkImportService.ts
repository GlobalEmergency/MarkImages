/**
 * BulkImport Service â€” Application Service
 *
 * Orquesta la integraciÃ³n de @batchactions/import con los adaptadores del sistema.
 * Punto de entrada principal para las API routes de importaciÃ³n.
 *
 * Responsabilidades:
 * - Configurar BulkImport con schema, hooks, duplicate checker, state store
 * - Ejecutar preview (validaciÃ³n sin procesamiento)
 * - Ejecutar processChunk (procesamiento serverless)
 * - Restaurar jobs para resume/CRON
 * - Combinar validaciÃ³n de @batchactions/import con auto-mapeo inteligente
 */

import {
  BulkImport,
  CsvParser,
  JsonParser,
  XmlParser,
  BufferSource,
  getErrors,
  getWarnings,
} from "@batchactions/import";
import type { ChunkResult, JobProgress, ProcessedRecord, SourceParser } from "@batchactions/import";
import { PrismaStateStore } from "@batchactions/state-prisma";
import type { PrismaBatchactionsClient } from "@batchactions/state-prisma";
import type { PrismaClient } from "@/generated/client/client";
import type { SharePointAuthConfig } from "@/storage/domain/ports/IImageDownloader";
import type { DownloadAndUploadImageUseCase } from "@/storage/application/use-cases/DownloadAndUploadImageUseCase";
import type { IAedRepository } from "../../domain/ports/IAedRepository";

import { aedImportSchema } from "../../domain/schemas/aedImportSchema";
import { S3DataSource } from "../../infrastructure/sources/S3DataSource";
import { BulkImportDuplicateAdapter } from "@/duplicate-detection/infrastructure/adapters/BulkImportDuplicateAdapter";
import { getDuplicateDetector } from "@/duplicate-detection/infrastructure/factory";
import { createAedImportHooks } from "../../infrastructure/hooks/aedImportHooks";
import { createAedRecordProcessor } from "../../infrastructure/processors/aedRecordProcessor";
import {
  DEFAULT_CSV_DELIMITER,
  DEFAULT_BATCH_SIZE,
  DEFAULT_CHUNK_MAX_RECORDS,
  VERCEL_API_MAX_DURATION_MS,
} from "../../constants";

/** Import context persisted in batch_jobs metadata for resume/CRON */
export interface ImportContext {
  s3Url: string;
  fileName: string;
  delimiter?: string;
  sharePointAuth?: { rtFa?: string; fedAuth?: string };
  skipDuplicates?: boolean;
  mappings?: Array<{ csvColumn: string; systemField: string }>;
  /** Tipo de asignación org (OWNERSHIP, MAINTENANCE, etc.) */
  assignmentType?: string;
}

// ============================================================
// Tipos
// ============================================================

export interface ImportPreviewOptions {
  /** Contenido del archivo (string o Buffer) */
  csvContent: string | Buffer;
  /** Nombre del archivo original (para detectar formato: csv, json, xml) */
  fileName?: string;
  /** Delimitador CSV (default: ";") â€" ignorado para JSON/XML */
  delimiter?: string;
  /** NÃºmero mÃ¡ximo de registros para preview */
  maxRecords?: number;
}

export interface ImportPreviewResult {
  /** Headers detectados en el CSV */
  headers: string[];
  /** Registros de muestra parseados */
  sampleRecords: Array<Record<string, unknown>>;
  /** Total de registros en el CSV */
  totalRecords: number;
  /** Registros vÃ¡lidos en el preview */
  validRecords: number;
  /** Registros invÃ¡lidos con errores */
  invalidRecords: number;
  /** Errores de validaciÃ³n detallados */
  errors: Array<{
    recordIndex: number;
    field: string;
    message: string;
    code: string;
    severity: "error" | "warning";
    suggestion?: string;
  }>;
  /** Warnings (no bloquean) */
  warnings: Array<{
    recordIndex: number;
    field: string;
    message: string;
    suggestion?: string;
  }>;
}

/** Column mapping from UI wizard: CSV column → schema field */
export interface ColumnMapping {
  csvColumn: string;
  systemField: string;
}

export interface StartImportOptions {
  /** URL del CSV en S3 */
  s3Url: string;
  /** Nombre del archivo original */
  fileName: string;
  /** ID del usuario que inicia la importaciÃ³n */
  userId: string;
  /** Column mappings confirmed by the user in the UI wizard */
  mappings?: ColumnMapping[];
  /** Delimitador CSV (default: ";") */
  delimiter?: string;
  /** TamaÃ±o del batch (default: 50) */
  batchSize?: number;
  /** Si true, continÃºa aunque fallen registros (default: true) */
  continueOnError?: boolean;
  /** Si true, los duplicados se reportan como warning (default: true) */
  skipDuplicates?: boolean;
  /** AutenticaciÃ³n SharePoint (cookies) */
  sharePointAuth?: SharePointAuthConfig;
  /** Tiempo mÃ¡ximo por chunk en ms (default: 80000 para Vercel) */
  maxDurationMs?: number;
  /** MÃ¡ximo de registros por chunk (safety cap, default: 500) */
  maxRecordsPerChunk?: number;
  /** Nombre del job para la UI */
  jobName?: string;
  /** ID de la organización que importa (para asignación automática de DEAs) */
  organizationId?: string;
  /** Tipo de asignación organizacional (OWNERSHIP, MAINTENANCE, etc.) */
  assignmentType?: string;
}

export interface StartImportResult {
  /** ID del job creado */
  jobId: string;
  /** Resultado del primer chunk */
  chunk: ChunkResult;
  /** Progreso actual */
  progress: JobProgress;
}

export interface ResumeImportOptions {
  /** ID del job a continuar */
  jobId: string;
  /** URL del CSV en S3 (necesaria para re-parsear) */
  s3Url: string;
  /** ID del usuario */
  userId: string;
  /** Nombre del archivo */
  fileName?: string;
  /** Delimitador CSV */
  delimiter?: string;
  /** Column mappings from UI wizard (persisted in ImportContext) */
  mappings?: ColumnMapping[];
  /** Autenticación SharePoint */
  sharePointAuth?: SharePointAuthConfig;
  /** Tiempo máximo por chunk en ms */
  maxDurationMs?: number;
  /** Máximo de registros por chunk (safety cap) */
  maxRecordsPerChunk?: number;
  /** Si true, los duplicados se reportan como warning */
  skipDuplicates?: boolean;
  /** Organization ID (from ImportContext, for org-scoped imports) */
  organizationId?: string;
  /** Assignment type: OWNERSHIP, MAINTENANCE, etc. (from ImportContext) */
  assignmentType?: string;
}

export interface ResumeImportResult {
  /** ID del job */
  jobId: string;
  /** Resultado del chunk procesado */
  chunk: ChunkResult;
  /** Progreso actual */
  progress: JobProgress;
}

// ============================================================
// Service
// ============================================================

export class BulkImportService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly aedRepository: IAedRepository,
    private readonly downloadAndUploadImageUseCase?: DownloadAndUploadImageUseCase
  ) {}

  /**
   * Prisma v7 $transaction has extra overloads that make it structurally
   * incompatible with PrismaBatchactionsClient's narrower signature.
   * The runtime API is identical so a cast is safe.
   */
  private get stateStorePrisma(): PrismaBatchactionsClient {
    return this.prisma as unknown as PrismaBatchactionsClient;
  }

  /**
   * Preview: parsea y valida un CSV sin procesarlo.
   * Útil para mostrar preview de datos y errores antes de importar.
   */
  async preview(options: ImportPreviewOptions): Promise<ImportPreviewResult> {
    const { csvContent, fileName, delimiter = DEFAULT_CSV_DELIMITER, maxRecords = 100 } = options;

    const content = typeof csvContent === "string" ? csvContent : csvContent.toString("utf-8");

    const importer = new BulkImport({
      schema: aedImportSchema,
      continueOnError: true,
    });

    importer.from(new BufferSource(content), this.createParserForFile(fileName, delimiter));

    const preview = await importer.preview(maxRecords);

    // Extraer headers de las columnas detectadas
    const headers = [...preview.columns];

    // Combinar valid + invalid records para análisis
    const allRecords = [...preview.validRecords, ...preview.invalidRecords];

    // Separar errores y warnings usando utilidades de la librería
    const errors: ImportPreviewResult["errors"] = [];
    const warnings: ImportPreviewResult["warnings"] = [];

    for (const record of allRecords) {
      for (const err of getErrors(record.errors)) {
        errors.push({
          recordIndex: record.index,
          field: err.field,
          message: err.message,
          code: err.code,
          severity: "error",
          suggestion: err.suggestion,
        });
      }
      for (const warn of getWarnings(record.errors)) {
        warnings.push({
          recordIndex: record.index,
          field: warn.field,
          message: warn.message,
          suggestion: warn.suggestion,
        });
      }
    }

    return {
      headers,
      sampleRecords: preview.validRecords.map((r: ProcessedRecord) => r.parsed),
      totalRecords: preview.totalSampled,
      validRecords: preview.validRecords.length,
      invalidRecords: preview.invalidRecords.length,
      errors,
      warnings,
    };
  }

  /**
   * Inicia una importación: crea el job y procesa el primer chunk.
   * Para Vercel: respeta maxDurationMs para no exceder el timeout.
   */
  async startImport(options: StartImportOptions): Promise<StartImportResult> {
    const {
      s3Url,
      fileName,
      userId,
      mappings,
      delimiter = DEFAULT_CSV_DELIMITER,
      batchSize = DEFAULT_BATCH_SIZE,
      continueOnError = true,
      skipDuplicates = true,
      sharePointAuth,
      maxDurationMs = VERCEL_API_MAX_DURATION_MS,
      maxRecordsPerChunk = DEFAULT_CHUNK_MAX_RECORDS,
      jobName,
      organizationId,
      assignmentType,
    } = options;

    const { stateStore, source, processor, duplicateChecker, hooks } =
      this.buildImportInfrastructure({
        s3Url,
        fileName,
        userId,
        delimiter,
        skipDuplicates,
        sharePointAuth,
        mappings,
        jobName: jobName || `Import ${fileName}`,
        organizationId,
        assignmentType,
      });

    // Crear instancia de BulkImport
    const importer = new BulkImport({
      schema: aedImportSchema,
      batchSize,
      continueOnError,
      stateStore,
      duplicateChecker,
      hooks,
      maxRetries: 2,
      retryDelayMs: 500,
    });

    importer.from(source, this.createParserForFile(fileName, delimiter));

    // Suscribir eventos para logging estructurado
    this.subscribeImportEvents(importer, fileName);

    // Pre-create batch_jobs registry BEFORE processing.
    // The AED processor sets batch_job_id = context.jobId which has a FK to batch_jobs.
    // Without this, the FK constraint fails because batch_jobs row doesn't exist yet.
    const jobId = importer.getJobId();
    await this.upsertJobRegistry({
      jobId,
      jobName: jobName || `Import ${fileName}`,
      userId,
      progress: {
        totalRecords: 0,
        processedRecords: 0,
        failedRecords: 0,
        pendingRecords: 0,
        currentBatch: 0,
        totalBatches: 0,
        percentage: 0,
        elapsedMs: 0,
      },
      done: false,
      organizationId,
      importContext: {
        s3Url,
        fileName,
        delimiter,
        sharePointAuth,
        skipDuplicates,
        mappings,
        assignmentType,
      },
    });

    try {
      // Procesar primer chunk (limitar por tiempo Y por registros)
      const chunk = await importer.processChunk(processor, {
        maxDurationMs,
        maxRecords: maxRecordsPerChunk,
      });

      // Update registry with real progress
      const progress = await stateStore.getProgress(jobId);
      await this.upsertJobRegistry({
        jobId,
        jobName: jobName || `Import ${fileName}`,
        userId,
        progress,
        done: chunk.done,
        organizationId,
        importContext: {
          s3Url,
          fileName,
          delimiter,
          sharePointAuth,
          skipDuplicates,
          mappings,
          assignmentType,
        },
      });

      return { jobId, chunk, progress };
    } finally {
      // Liberar memoria del CSV descargado (~100MB max)
      source.clearCache();
    }
  }

  /**
   * Restaura y continúa un job existente.
   * Usado por resume endpoint y CRON.
   */
  async resumeImport(options: ResumeImportOptions): Promise<ResumeImportResult> {
    const {
      jobId,
      s3Url,
      userId,
      fileName,
      delimiter = DEFAULT_CSV_DELIMITER,
      mappings,
      sharePointAuth,
      maxDurationMs = VERCEL_API_MAX_DURATION_MS,
      maxRecordsPerChunk = DEFAULT_CHUNK_MAX_RECORDS,
      skipDuplicates = true,
      organizationId,
      assignmentType,
    } = options;

    const { stateStore, source, processor, duplicateChecker, hooks } =
      this.buildImportInfrastructure({
        s3Url,
        fileName: fileName || "",
        userId,
        delimiter,
        skipDuplicates,
        sharePointAuth,
        mappings,
        organizationId,
        assignmentType,
      });

    // Restaurar instancia desde el state store
    const importer = await BulkImport.restore(jobId, {
      schema: aedImportSchema,
      stateStore,
      duplicateChecker,
      hooks,
      maxRetries: 2,
      retryDelayMs: 500,
    });

    if (!importer) {
      throw new Error(`Job ${jobId} not found or cannot be restored`);
    }

    // Configurar source y parser (necesarios para re-parsear)
    importer.from(source, this.createParserForFile(fileName, delimiter));

    // Suscribir eventos para logging estructurado
    this.subscribeImportEvents(importer, fileName || jobId);

    try {
      // Procesar siguiente chunk (limitar por tiempo Y por registros)
      const chunk = await importer.processChunk(processor, {
        maxDurationMs,
        maxRecords: maxRecordsPerChunk,
      });

      // Obtener progreso
      const progress = await stateStore.getProgress(jobId);

      // Update batch_jobs registry for UI/CRON compatibility
      await this.upsertJobRegistry({
        jobId,
        userId,
        progress,
        done: chunk.done,
        organizationId,
        importContext: {
          s3Url,
          fileName: fileName || "",
          delimiter,
          sharePointAuth,
          skipDuplicates,
          mappings,
          assignmentType,
        },
      });

      return { jobId, chunk, progress };
    } finally {
      // Liberar memoria del CSV descargado (~100MB max)
      source.clearCache();
    }
  }

  /**
   * Obtiene el progreso de un job existente.
   */
  async getProgress(jobId: string, _userId?: string): Promise<JobProgress> {
    const stateStore = new PrismaStateStore(this.stateStorePrisma);
    return stateStore.getProgress(jobId);
  }

  /**
   * Cuenta el total de registros en un CSV sin procesarlos.
   * Útil para el preview: el preview sample analiza N registros pero
   * count() devuelve el total real del archivo.
   */
  async countRecords(options: {
    csvContent: string | Buffer;
    fileName?: string;
    delimiter?: string;
  }): Promise<number> {
    const { csvContent, fileName, delimiter = DEFAULT_CSV_DELIMITER } = options;

    const content = typeof csvContent === "string" ? csvContent : csvContent.toString("utf-8");

    const importer = new BulkImport({
      schema: aedImportSchema,
    });

    importer.from(new BufferSource(content), this.createParserForFile(fileName, delimiter));

    return importer.count();
  }

  /**
   * Genera un CSV template con las columnas del schema.
   * Incluye opcionalmente filas de ejemplo con datos sintéticos.
   */
  generateTemplate(options?: { exampleRows?: number }): string {
    return BulkImport.generateTemplate(aedImportSchema, {
      exampleRows: options?.exampleRows ?? 0,
    });
  }

  /**
   * Obtiene los registros fallidos de un job.
   */
  async getFailedRecords(jobId: string, _userId?: string) {
    const stateStore = new PrismaStateStore(this.stateStorePrisma);
    return stateStore.getFailedRecords(jobId);
  }

  // ============================================================
  // Private helpers
  // ============================================================

  /**
   * Suscribe eventos del BulkImport para logging estructurado.
   * Reemplaza console.logs dispersos con un sistema unificado basado en eventos.
   */
  private subscribeImportEvents(importer: BulkImport, label: string): void {
    importer
      .on("job:started", (e) => {
        console.log(
          `[Import:${label}] Job ${e.jobId} started — ${e.totalRecords} records in ${e.totalBatches} batches`
        );
      })
      .on("job:progress", (e) => {
        const p = e.progress;
        console.log(
          `[Import:${label}] Progress — ${p.processedRecords}/${p.totalRecords} (${p.percentage}%) ` +
            `batch ${p.currentBatch}/${p.totalBatches}` +
            (p.estimatedRemainingMs ? ` ~${Math.round(p.estimatedRemainingMs / 1000)}s left` : "")
        );
      })
      .on("batch:completed", (e) => {
        console.log(
          `[Import:${label}] Batch ${e.batchIndex + 1} done — ${e.processedCount}/${e.totalCount} processed, ${e.failedCount} failed`
        );
      })
      .on("record:retried", (e) => {
        console.warn(
          `[Import:${label}] Record ${e.recordIndex} retried (attempt ${e.attempt}/${e.maxRetries})`
        );
      })
      .on("record:failed", (e) => {
        console.warn(`[Import:${label}] Record ${e.recordIndex} failed: ${e.error}`);
      })
      .on("chunk:completed", (e) => {
        console.log(
          `[Import:${label}] Chunk done — ${e.processedRecords} processed, ${e.failedRecords} failed, done=${e.done}`
        );
      })
      .on("job:completed", (e) => {
        const s = e.summary;
        console.log(
          `[Import:${label}] Job ${e.jobId} COMPLETED — ` +
            `${s.processed}/${s.total} records, ${s.failed} failed ` +
            `(${s.elapsedMs}ms)`
        );
      })
      .on("job:failed", (e) => {
        console.error(`[Import:${label}] Job ${e.jobId} FAILED: ${e.error}`);
      });
  }

  /**
   * Construye la infraestructura compartida por startImport y resumeImport.
   * Centraliza la creación de stateStore, source, processor, duplicateChecker y hooks.
   */
  private buildImportInfrastructure(params: {
    s3Url: string;
    fileName: string;
    userId: string;
    delimiter: string;
    skipDuplicates: boolean;
    sharePointAuth?: SharePointAuthConfig;
    mappings?: ColumnMapping[];
    jobName?: string;
    organizationId?: string;
    assignmentType?: string;
  }) {
    const {
      s3Url,
      fileName,
      skipDuplicates,
      sharePointAuth,
      mappings,
      organizationId,
      assignmentType,
    } = params;

    // Official @batchactions/state-prisma — persists state in batchactions_* tables
    const stateStore = new PrismaStateStore(this.stateStorePrisma);

    const detector = getDuplicateDetector();
    const duplicateChecker = new BulkImportDuplicateAdapter(detector, {
      skipDuplicates,
    });

    const hooks = createAedImportHooks({
      prisma: this.prisma,
      downloadAndUploadImageUseCase: this.downloadAndUploadImageUseCase,
      sharePointAuth,
      skipDuplicates,
      mappings,
    });

    const source = new S3DataSource(s3Url, fileName);

    const processor = createAedRecordProcessor({
      prisma: this.prisma,
      fileName,
      organizationId,
      assignmentType,
      userId: params.userId,
    });

    return { stateStore, source, processor, duplicateChecker, hooks };
  }

  /**
   * Creates/updates a batch_jobs record as a lightweight registry entry.
   * This keeps the admin UI and CRON compatible while @batchactions manages state
   * in its own batchactions_* tables.
   */
  private async upsertJobRegistry(params: {
    jobId: string;
    jobName?: string;
    userId: string;
    progress: JobProgress;
    done: boolean;
    organizationId?: string;
    importContext: ImportContext;
  }): Promise<void> {
    const { jobId, jobName, userId, progress, done, organizationId, importContext } = params;

    const status = done ? "COMPLETED" : "WAITING";
    const failedRecords = progress.failedRecords ?? 0;

    try {
      await this.prisma.batchJob.upsert({
        where: { id: jobId },
        create: {
          id: jobId,
          type: "AED_CSV_IMPORT",
          name: jobName || `Import ${importContext.fileName}`,
          status,
          config: {} as object,
          total_records: progress.totalRecords,
          processed_records: progress.processedRecords,
          successful_records: Math.max(0, progress.processedRecords - failedRecords),
          failed_records: failedRecords,
          current_chunk: progress.currentBatch,
          total_chunks: progress.totalBatches,
          started_at: progress.elapsedMs > 0 ? new Date(Date.now() - progress.elapsedMs) : null,
          completed_at: done ? new Date() : null,
          last_heartbeat: new Date(),
          created_by: userId,
          organization_id: organizationId || null,
          metadata: {
            engine: "bulkimport",
            import_context: importContext,
          } as object,
        },
        update: {
          status,
          total_records: progress.totalRecords,
          processed_records: progress.processedRecords,
          successful_records: Math.max(0, progress.processedRecords - failedRecords),
          failed_records: failedRecords,
          current_chunk: progress.currentBatch,
          total_chunks: progress.totalBatches,
          completed_at: done ? new Date() : null,
          last_heartbeat: new Date(),
          metadata: {
            engine: "bulkimport",
            import_context: importContext,
          } as object,
        },
      });
    } catch (error) {
      // Non-critical: log but don't fail the import
      console.error(`[Import] Failed to update job registry for ${jobId}:`, error);
    }
  }

  /**
   * Crea el parser adecuado según la extensión del archivo.
   * Soporta CSV (default), JSON/NDJSON y XML.
   */
  private createParserForFile(fileName: string | undefined, delimiter: string): SourceParser {
    const ext = (fileName ?? "").split(".").pop()?.toLowerCase();

    switch (ext) {
      case "json":
      case "ndjson":
      case "jsonl":
        return new JsonParser({ format: ext === "json" ? "array" : "ndjson" });
      case "xml":
        return new XmlParser();
      default:
        return new CsvParser({ delimiter });
    }
  }
}
