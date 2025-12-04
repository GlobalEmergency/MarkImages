/**
 * Use Case: Importar batch completo de DEAs desde CSV
 * Capa de Aplicación - Versión simplificada para MVP
 */

import { IImportRepository } from "@/domain/import/ports/IImportRepository";
import { IDuplicateDetectionService } from "@/domain/import/ports/IDuplicateDetectionService";
import { CsvRowMapper } from "@/domain/import/services/CsvRowMapper";
import { CsvRow } from "@/domain/import/value-objects/CsvRow";
import { IImageDownloader, DownloadAuthConfig } from "@/domain/storage/ports/IImageDownloader";
import { IImageStorage } from "@/domain/storage/ports/IImageStorage";
import { CsvParserAdapter } from "@/infrastructure/import/parsers/CsvParserAdapter";
import { DryRunReport, RealImportResponse } from "@/types/import";
import { CheckpointManager } from "@/lib/recovery/CheckpointManager";

export interface ImportDeaBatchRequest {
  batchId?: string; // ID del batch ya creado (opcional, para evitar duplicación)
  filePath: string;
  batchName: string;
  importedBy: string;
  mappings?: Array<{ csvColumn: string; systemField: string }>; // Mapeo de columnas del usuario
  sharePointAuth?: DownloadAuthConfig;
  chunkSize?: number;
  skipDuplicates?: boolean; // Activar/desactivar detección de duplicados (default: true)
  duplicateDetectionMode?: "exact" | "fuzzy"; // Modo de detección (default: 'exact')
  dryRun?: boolean; // Modo simulación - no crea registros (default: false)

  // Recovery & Checkpoints
  checkpointManager?: CheckpointManager;
  startFromIndex?: number; // Índice desde donde reanudar (para recuperación)
  checkpointFrequency?: number; // Guardar checkpoint cada N registros (default: 10)
}

export type ImportDeaBatchResponse = DryRunReport | RealImportResponse;

export class ImportDeaBatchUseCase {
  constructor(
    private readonly repository: IImportRepository,
    private readonly csvParser: CsvParserAdapter,
    private readonly imageDownloader: IImageDownloader,
    private readonly imageStorage: IImageStorage,
    private readonly duplicateDetector: IDuplicateDetectionService
  ) {}

  async execute(request: ImportDeaBatchRequest): Promise<ImportDeaBatchResponse> {
    const {
      batchId: existingBatchId,
      filePath,
      batchName,
      importedBy,
      mappings,
      sharePointAuth,
      chunkSize = 50,
      skipDuplicates = true,
      duplicateDetectionMode = "exact",
    } = request;

    // 1. Parsear CSV
    console.log(`📄 Parsing CSV file: ${filePath}`);
    const parseResult = await this.csvParser.parseFile(filePath);

    if (parseResult.errors.length > 0) {
      console.warn(`⚠️ CSV parsing warnings: ${parseResult.errors.length} errors`);
    }

    // 2. Crear batch o usar el existente
    let batchId: string;
    if (existingBatchId) {
      // Usar batch ya creado y actualizar total_records
      console.log(`📦 Using existing batch: ${existingBatchId}`);
      batchId = existingBatchId;
      await this.repository.updateBatchStatus(batchId, "IN_PROGRESS", {
        totalRecords: parseResult.totalRows,
        successfulRecords: 0,
        failedRecords: 0,
        startedAt: new Date(),
      });
    } else {
      // Crear batch nuevo (modo legacy)
      console.log(`📦 Creating import batch: ${batchName}`);
      batchId = await this.repository.createBatch({
        name: batchName,
        description: `Imported from ${filePath}`,
        sourceOrigin: "CSV_IMPORT",
        fileName: filePath,
        totalRecords: parseResult.totalRows,
        importedBy,
      });

      await this.repository.updateBatchStatus(batchId, "IN_PROGRESS", {
        startedAt: new Date(),
      });
    }

    let successCount = 0;
    let failCount = 0;
    const errors: Array<{ row: number; message: string }> = [];

    // 3. Determinar índice de inicio (para reanudación)
    const startFromIndex = request.startFromIndex ?? 0;
    const checkpointFrequency = request.checkpointFrequency ?? 10;
    const checkpointManager = request.checkpointManager;

    if (startFromIndex > 0) {
      console.log(`🔄 Resuming from index ${startFromIndex}`);

      // Si tenemos checkpoint manager, obtener estadísticas actuales
      if (checkpointManager) {
        const stats = await checkpointManager.getCheckpointStats(batchId);
        successCount = stats.success;
        failCount = stats.failed;
        console.log(`📊 Current progress: ${successCount} success, ${failCount} failed`);
      }
    }

    // 4. Procesar en chunks
    const chunks = this.chunkArray(parseResult.rows, chunkSize);

    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      const chunk = chunks[chunkIndex];
      console.log(
        `🔄 Processing chunk ${chunkIndex + 1}/${chunks.length} (${chunk.length} records)`
      );

      for (let i = 0; i < chunk.length; i++) {
        const csvRow = chunk[i];
        const globalRowNumber = chunkIndex * chunkSize + i + 2; // +2 por header y índice base 0
        const recordIndex = chunkIndex * chunkSize + i; // Índice base 0

        // Saltar registros ya procesados (si estamos reanudando)
        if (recordIndex < startFromIndex) {
          continue;
        }

        // Verificar si este registro ya fue procesado (checkpoint)
        if (checkpointManager) {
          const alreadyProcessed = await checkpointManager.isRecordProcessed(batchId, recordIndex);
          if (alreadyProcessed) {
            console.log(`⏭️  Skipping already processed record at index ${recordIndex}`);
            continue;
          }
        }

        const startTime = Date.now();
        let recordStatus: "SUCCESS" | "FAILED" | "SKIPPED" = "SUCCESS";
        let errorMessage: string | undefined;

        try {
          await this.processRecord(
            csvRow,
            batchId,
            mappings,
            sharePointAuth,
            skipDuplicates,
            duplicateDetectionMode
          );
          successCount++;

          if (successCount % 10 === 0) {
            console.log(`✅ Processed ${successCount} records successfully`);
          }
        } catch (error) {
          failCount++;
          recordStatus = "FAILED";
          errorMessage = error instanceof Error ? error.message : String(error);
          errors.push({ row: globalRowNumber, message: errorMessage });

          // Determinar el tipo de error basado en el mensaje
          const isDuplicateError = errorMessage.includes("Duplicado detectado");
          const errorType = isDuplicateError ? "DUPLICATE_DATA" : "SYSTEM_ERROR";
          const severity = isDuplicateError ? "WARNING" : "ERROR";

          await this.repository.logImportError({
            batchId,
            rowNumber: globalRowNumber,
            errorType,
            errorMessage,
            severity,
            rowData: csvRow.toJSON() as any,
          });

          const icon = isDuplicateError ? "⚠️" : "❌";
          console.error(`${icon} Row ${globalRowNumber}: ${errorMessage}`);
        }

        // Guardar checkpoint (cada N registros o si falló)
        if (
          checkpointManager &&
          ((recordIndex + 1) % checkpointFrequency === 0 || recordStatus === "FAILED")
        ) {
          const processingTime = Date.now() - startTime;
          const rowData = csvRow.toJSON();
          await checkpointManager.saveCheckpoint({
            importBatchId: batchId,
            recordIndex,
            recordReference:
              (rowData as any).name || (rowData as any).nombre || `Row ${globalRowNumber}`,
            status: recordStatus,
            errorMessage,
            processingTimeMs: processingTime,
            recordData: rowData,
          });
        }
      }

      // Actualizar progreso en BD cada chunk
      await this.repository.updateBatchStatus(batchId, "IN_PROGRESS", {
        successfulRecords: successCount,
        failedRecords: failCount,
      });

      // Guardar checkpoint del último registro del chunk
      if (checkpointManager && chunk.length > 0) {
        const lastRecordIndex = chunkIndex * chunkSize + chunk.length - 1;
        if (lastRecordIndex >= startFromIndex) {
          // Solo si procesamos al menos un registro en este chunk
          await checkpointManager.saveCheckpoint({
            importBatchId: batchId,
            recordIndex: lastRecordIndex,
            recordReference: `Chunk ${chunkIndex + 1} end`,
            status: "SUCCESS",
            processingTimeMs: 0,
          });
        }
      }
    }

    // 5. Finalizar batch
    await this.repository.updateBatchStatus(batchId, "COMPLETED", {
      successfulRecords: successCount,
      failedRecords: failCount,
      completedAt: new Date(),
    });

    console.log(`✅ Import completed: ${successCount} successful, ${failCount} failed`);

    return {
      dryRun: false,
      batchId,
      totalRecords: parseResult.totalRows,
      successfulRecords: successCount,
      failedRecords: failCount,
      errors,
    };
  }

  private async processRecord(
    csvRow: CsvRow,
    batchId: string,
    mappings?: Array<{ csvColumn: string; systemField: string }>,
    sharePointAuth?: DownloadAuthConfig,
    skipDuplicates: boolean = true,
    _duplicateDetectionMode: "exact" | "fuzzy" = "exact"
  ): Promise<void> {
    // Si hay mappings, construir DynamicCsvRow mapeado usando el servicio compartido
    // Si no hay mappings, usar CsvRow legacy (hardcodeado para Madrid)
    const row = mappings
      ? CsvRowMapper.buildDynamicRow(csvRow.toJSON() as unknown as Record<string, string>, mappings)
      : csvRow;

    // 1. Validar campos mínimos
    if (!row.hasMinimumRequiredFields()) {
      throw new Error("Missing minimum required fields");
    }

    // 2. Parsear coordenadas (necesarias para el check de duplicados)
    const latitude = this.parseCoordinate(row.latitude);
    const longitude = this.parseCoordinate(row.longitude);

    // 3. Verificar duplicados (si está activado)
    let requiresAttention = false;
    let attentionReason: string | undefined;

    if (skipDuplicates) {
      const duplicateCheck = await this.duplicateDetector.checkDuplicate({
        // Campos básicos
        name: row.name || "",
        streetType: row.streetType,
        streetName: row.streetName,
        streetNumber: row.streetNumber,
        postalCode: row.postalCode,

        // Campos para sistema de scoring
        provisionalNumber: row.provisionalNumber ? parseInt(row.provisionalNumber) : null,
        establishmentType: row.establishmentType,
        latitude: latitude,
        longitude: longitude,

        // Campos diferenciadores (ubicación específica)
        accessDescription: row.accessDescription,
        specificLocation: row.additionalInfo, // Complemento de dirección
        floor: undefined, // No disponible en CSV actual
        visibleReferences: undefined, // No disponible en CSV actual
      });

      if (duplicateCheck.isDuplicate) {
        // Score >= 75: DUPLICADO CONFIRMADO - RECHAZAR
        // Construir mensaje detallado con información de scoring
        const duplicateDetails = this.buildDuplicateDetailsMessage(duplicateCheck);
        throw new Error(duplicateDetails);
      }

      if (duplicateCheck.isPossibleDuplicate) {
        // Score 60-74: POSIBLE DUPLICADO - IMPORTAR CON MARCA
        requiresAttention = true;
        attentionReason = duplicateCheck.toWarningMessage();

        // Registrar WARNING (no rechazar)
        // Log deshabilitado - información disponible en import_errors
        // console.warn(`⚠️ ${attentionReason}`);
      }
    }

    // 4. Procesar imágenes (SharePoint → S3)
    const imageUrls: Array<{ url: string; type: string }> = [];

    for (const [photoUrl, type] of [
      [row.photo1Url, "FRONT"],
      [row.photo2Url, "LOCATION"],
    ] as const) {
      if (photoUrl && this.imageDownloader.canHandle(photoUrl)) {
        try {
          const downloaded = await this.imageDownloader.download({
            url: photoUrl,
            auth: sharePointAuth,
            timeout: 30000,
          });

          const uploaded = await this.imageStorage.upload({
            buffer: downloaded.buffer,
            filename: `${row.id || Date.now()}-${type.toLowerCase()}.jpg`,
            contentType: downloaded.contentType,
            prefix: `aeds/${batchId}`,
          });

          imageUrls.push({ url: uploaded.url, type });
        } catch (error) {
          console.warn(`⚠️ Failed to process image ${photoUrl}: ${error}`);
          // Continuar sin la imagen
        }
      }
    }

    // 5. Crear AED en DB
    await this.repository.createAedFromCsv({
      csvRow: row,
      batchId,
      latitude,
      longitude,
      addressValidationFailed: false, // Por ahora, validación posterior
      imageUrls,
      requiresAttention, // Marcar si es posible duplicado
      attentionReason, // Motivo de la atención requerida
    });
  }

  private parseCoordinate(value: string | null): number | null {
    if (!value) return null;
    const parsed = parseFloat(value.replace(",", "."));
    return isNaN(parsed) ? null : parsed;
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Construye un mensaje detallado sobre el duplicado detectado
   * Incluye información de scoring para debugging
   */
  private buildDuplicateDetailsMessage(duplicateCheck: any): string {
    const match = duplicateCheck.bestMatch || duplicateCheck.matches[0]; // Mejor match

    let message = `Duplicado detectado: Ya existe un DEA con nombre "${duplicateCheck.checkedName}" y dirección "${duplicateCheck.checkedAddress}"`;

    if (match) {
      const date = match.createdAt
        ? new Date(match.createdAt).toLocaleDateString("es-ES")
        : "desconocida";
      message += `\nDEA existente: ID ${match.aedId}, Score: ${match.score}/100, Registrado: ${date}`;

      // Agregar información de scoring si el score es muy alto
      if (match.score >= 90) {
        message += `\nCoincidencia exacta en todos los campos principales`;
      } else if (match.score >= 75) {
        message += `\nCoincidencia muy alta en campos principales`;
      }
    }

    // Si hay múltiples duplicados, mencionarlo
    if (duplicateCheck.matches.length > 1) {
      message += `\nAdvertencia: Se encontraron ${duplicateCheck.matches.length} posibles duplicados en la base de datos`;
    }

    return message;
  }
}
