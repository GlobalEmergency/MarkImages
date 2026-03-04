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
import type { PrismaClient } from "@/generated/client/client";
import type { SharePointAuthConfig } from "@/storage/domain/ports/IImageDownloader";
import type { DownloadAndUploadImageUseCase } from "@/storage/application/use-cases/DownloadAndUploadImageUseCase";
import type { IAedRepository } from "../../domain/ports/IAedRepository";

import { aedImportSchema } from "../../domain/schemas/aedImportSchema";
import { PrismaStateStore } from "../../infrastructure/state/PrismaStateStore";
import { S3DataSource } from "../../infrastructure/sources/S3DataSource";
import { AedDuplicateChecker } from "../../infrastructure/checkers/AedDuplicateChecker";
import { createAedImportHooks } from "../../infrastructure/hooks/aedImportHooks";
import { createAedRecordProcessor } from "../../infrastructure/processors/aedRecordProcessor";
import {
  DEFAULT_CSV_DELIMITER,
  DEFAULT_BATCH_SIZE,
  DEFAULT_CHUNK_MAX_RECORDS,
  VERCEL_API_MAX_DURATION_MS,
} from "../../constants";

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

export interface StartImportOptions {
  /** URL del CSV en S3 */
  s3Url: string;
  /** Nombre del archivo original */
  fileName: string;
  /** ID del usuario que inicia la importaciÃ³n */
  userId: string;
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
  /** AutenticaciÃ³n SharePoint */
  sharePointAuth?: SharePointAuthConfig;
  /** Tiempo mÃ¡ximo por chunk en ms */
  maxDurationMs?: number;
  /** MÃ¡ximo de registros por chunk (safety cap) */
  maxRecordsPerChunk?: number;
  /** Si true, los duplicados se reportan como warning */
  skipDuplicates?: boolean;
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
      delimiter = DEFAULT_CSV_DELIMITER,
      batchSize = DEFAULT_BATCH_SIZE,
      continueOnError = true,
      skipDuplicates = true,
      sharePointAuth,
      maxDurationMs = VERCEL_API_MAX_DURATION_MS,
      maxRecordsPerChunk = DEFAULT_CHUNK_MAX_RECORDS,
      jobName,
    } = options;

    const { stateStore, source, processor, duplicateChecker, hooks } =
      this.buildImportInfrastructure({
        s3Url,
        fileName,
        userId,
        delimiter,
        skipDuplicates,
        sharePointAuth,
        jobName: jobName || `Import ${fileName}`,
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

    try {
      // Procesar primer chunk (limitar por tiempo Y por registros)
      const chunk = await importer.processChunk(processor, {
        maxDurationMs,
        maxRecords: maxRecordsPerChunk,
      });

      // Obtener progreso
      const jobId = importer.getJobId();
      const progress = await stateStore.getProgress(jobId);

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
      sharePointAuth,
      maxDurationMs = VERCEL_API_MAX_DURATION_MS,
      maxRecordsPerChunk = DEFAULT_CHUNK_MAX_RECORDS,
      skipDuplicates = true,
    } = options;

    const { stateStore, source, processor, duplicateChecker, hooks } =
      this.buildImportInfrastructure({
        s3Url,
        fileName: fileName || "",
        userId,
        delimiter,
        skipDuplicates,
        sharePointAuth,
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

      return { jobId, chunk, progress };
    } finally {
      // Liberar memoria del CSV descargado (~100MB max)
      source.clearCache();
    }
  }

  /**
   * Obtiene el progreso de un job existente.
   */
  async getProgress(jobId: string, userId: string): Promise<JobProgress> {
    const stateStore = new PrismaStateStore(this.prisma, {
      createdBy: userId,
    });
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
  async getFailedRecords(jobId: string, userId: string) {
    const stateStore = new PrismaStateStore(this.prisma, {
      createdBy: userId,
    });
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
    jobName?: string;
  }) {
    const { s3Url, fileName, userId, delimiter, skipDuplicates, sharePointAuth, jobName } = params;

    const stateStore = new PrismaStateStore(this.prisma, {
      createdBy: userId,
      ...(jobName && { jobName }),
      importContext: {
        s3Url,
        fileName,
        delimiter,
        sharePointAuth,
        skipDuplicates,
      },
    });

    const duplicateChecker = new AedDuplicateChecker(this.aedRepository, {
      skipDuplicates,
    });

    const hooks = createAedImportHooks({
      prisma: this.prisma,
      downloadAndUploadImageUseCase: this.downloadAndUploadImageUseCase,
      sharePointAuth,
      skipDuplicates,
    });

    const source = new S3DataSource(s3Url, fileName);

    const processor = createAedRecordProcessor({
      prisma: this.prisma,
      fileName,
    });

    return { stateStore, source, processor, duplicateChecker, hooks };
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
