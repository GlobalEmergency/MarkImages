/**
 * Use Case: Importar batch completo de DEAs desde CSV
 * Capa de Aplicación - Versión simplificada para MVP
 */

import { mapDistrictNameToId } from "@/domain/import/constants/DistrictMapping";
import { IImportRepository } from "@/domain/import/ports/IImportRepository";
import { CsvRow } from "@/domain/import/value-objects/CsvRow";
import { IImageDownloader, DownloadAuthConfig } from "@/domain/storage/ports/IImageDownloader";
import { IImageStorage } from "@/domain/storage/ports/IImageStorage";
import { CsvParserAdapter } from "@/infrastructure/import/parsers/CsvParserAdapter";

export interface ImportDeaBatchRequest {
  filePath: string;
  batchName: string;
  importedBy: string;
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
    const { filePath, batchName, importedBy, sharePointAuth, chunkSize = 50 } = request;

    // 1. Parsear CSV
    console.log(`📄 Parsing CSV file: ${filePath}`);
    const parseResult = await this.csvParser.parseFile(filePath);

    if (parseResult.errors.length > 0) {
      console.warn(`⚠️ CSV parsing warnings: ${parseResult.errors.length} errors`);
    }

    // 2. Crear batch
    console.log(`📦 Creating import batch: ${batchName}`);
    const batchId = await this.repository.createBatch({
      name: batchName,
      description: `Imported from ${filePath}`,
      sourceOrigin: "CSV_IMPORT",
      fileName: filePath,
      totalRecords: parseResult.totalRows,
      importedBy,
    });

    // 3. Actualizar estado a IN_PROGRESS
    await this.repository.updateBatchStatus(batchId, "IN_PROGRESS", {
      startedAt: new Date(),
    });

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
          await this.processRecord(csvRow, batchId, sharePointAuth);
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
    sharePointAuth?: DownloadAuthConfig
  ): Promise<void> {
    // 1. Validar campos mínimos
    if (!csvRow.hasMinimumRequiredFields()) {
      throw new Error("Missing minimum required fields");
    }

    // 2. Parsear coordenadas
    const latitude = this.parseCoordinate(csvRow.latitude);
    const longitude = this.parseCoordinate(csvRow.longitude);

    // 3. Mapear distrito
    const districtId = mapDistrictNameToId(csvRow.district);

    // 4. Procesar imágenes (SharePoint → S3)
    const imageUrls: Array<{ url: string; type: string }> = [];

    for (const [photoUrl, type] of [
      [csvRow.photo1Url, "FRONT"],
      [csvRow.photo2Url, "LOCATION"],
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
            filename: `${csvRow.id}-${type.toLowerCase()}.jpg`,
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
      csvRow,
      batchId,
      districtId,
      latitude,
      longitude,
      addressValidationFailed: false, // Por ahora, validación posterior
      imageUrls,
    });
  }

  private parseCoordinate(value: string): number | null {
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
