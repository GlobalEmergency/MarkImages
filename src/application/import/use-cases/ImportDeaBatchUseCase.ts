/**
 * Use Case: Importar batch completo de DEAs desde CSV
 * Capa de Aplicación - Versión simplificada para MVP
 */

import { mapDistrictNameToId } from "@/domain/import/constants/DistrictMapping";
import { IImportRepository } from "@/domain/import/ports/IImportRepository";
import { CsvRowMapper } from "@/domain/import/services/CsvRowMapper";
import { CsvRow } from "@/domain/import/value-objects/CsvRow";
import { IImageDownloader, DownloadAuthConfig } from "@/domain/storage/ports/IImageDownloader";
import { IImageStorage } from "@/domain/storage/ports/IImageStorage";
import { CsvParserAdapter } from "@/infrastructure/import/parsers/CsvParserAdapter";

export interface ImportDeaBatchRequest {
  batchId?: string; // ID del batch ya creado (opcional, para evitar duplicación)
  filePath: string;
  batchName: string;
  importedBy: string;
  mappings?: Array<{csvColumn: string; systemField: string}>; // Mapeo de columnas del usuario
  sharePointAuth?: DownloadAuthConfig;
  chunkSize?: number;
}

export interface ImportDeaBatchResponse {
  batchId: string;
  totalRecords: number;
  successfulRecords: number;
  failedRecords: number;
  errors: Array<{ row: number; message: string }>;
}

export class ImportDeaBatchUseCase {
  constructor(
    private readonly repository: IImportRepository,
    private readonly csvParser: CsvParserAdapter,
    private readonly imageDownloader: IImageDownloader,
    private readonly imageStorage: IImageStorage
  ) {}

  async execute(request: ImportDeaBatchRequest): Promise<ImportDeaBatchResponse> {
    const { batchId: existingBatchId, filePath, batchName, importedBy, mappings, sharePointAuth, chunkSize = 50 } = request;

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

        try {
          await this.processRecord(csvRow, batchId, mappings, sharePointAuth);
          successCount++;

          if (successCount % 10 === 0) {
            console.log(`✅ Processed ${successCount} records successfully`);
          }
        } catch (error) {
          failCount++;
          const errorMessage = error instanceof Error ? error.message : String(error);
          errors.push({ row: globalRowNumber, message: errorMessage });

          await this.repository.logImportError({
            batchId,
            rowNumber: globalRowNumber,
            errorType: "SYSTEM_ERROR",
            errorMessage,
            severity: "ERROR",
            rowData: csvRow.toJSON() as any,
          });

          console.error(`❌ Row ${globalRowNumber}: ${errorMessage}`);
        }
      }

      // Actualizar progreso en BD cada chunk (cada 50 registros)
      await this.repository.updateBatchStatus(batchId, "IN_PROGRESS", {
        successfulRecords: successCount,
        failedRecords: failCount,
      });
    }

    // 5. Finalizar batch
    await this.repository.updateBatchStatus(batchId, "COMPLETED", {
      successfulRecords: successCount,
      failedRecords: failCount,
      completedAt: new Date(),
    });

    console.log(`✅ Import completed: ${successCount} successful, ${failCount} failed`);

    return {
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
    mappings?: Array<{csvColumn: string; systemField: string}>,
    sharePointAuth?: DownloadAuthConfig
  ): Promise<void> {
    // Si hay mappings, construir DynamicCsvRow mapeado usando el servicio compartido
    // Si no hay mappings, usar CsvRow legacy (hardcodeado para Madrid)
    const row = mappings 
      ? CsvRowMapper.buildDynamicRow(
          csvRow.toJSON() as unknown as Record<string, string>, 
          mappings
        )
      : csvRow;

    // 1. Validar campos mínimos
    if (!row.hasMinimumRequiredFields()) {
      throw new Error("Missing minimum required fields");
    }

    // 2. Parsear coordenadas
    const latitude = this.parseCoordinate(row.latitude);
    const longitude = this.parseCoordinate(row.longitude);

    // 3. Resolver distrito (solo si hay valor y es relevante)
    const districtId = this.resolveDistrictId(row.district);

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
      districtId,
      latitude,
      longitude,
      addressValidationFailed: false, // Por ahora, validación posterior
      imageUrls,
    });
  }

  /**
   * Resuelve el district_id solo si hay valor Y es válido
   * Universal: No asume que todos los DEAs tengan distrito
   */
  private resolveDistrictId(districtName: string | null): number | null {
    if (!districtName) {
      return null;
    }
    
    // Intentar mapear (solo funciona para Madrid)
    // Si no encuentra match, retorna null (no error)
    return mapDistrictNameToId(districtName);
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
}
