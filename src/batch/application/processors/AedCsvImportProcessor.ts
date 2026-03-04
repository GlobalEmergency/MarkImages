/**
 * AED CSV Import Processor
 *
 * Processor for importing AEDs from CSV files.
 * Replaces the legacy ImportDeaBatchUseCase with the new batch job system.
 */

import {
  BaseBatchJobProcessor,
  ProcessorContext,
  ProcessorInitResult,
  ProcessorValidationResult,
  ProcessChunkResult,
  ProcessRecordResult,
  JobType,
  JobResult,
  AedCsvImportConfig,
} from "@/batch/domain";
import { BatchJob } from "@/batch/domain/entities";
import { PrismaClient } from "@/generated/client/client";
import * as fs from "fs";
import { randomUUID } from "crypto";
import { DownloadAndUploadImageUseCase } from "@/storage/application/use-cases/DownloadAndUploadImageUseCase";
import * as os from "os";
import * as path from "path";

interface CsvRecord {
  [key: string]: string;
}

// Minimal outcome for duplicate checks
interface DuplicateCheckOutcome {
  isDuplicate: boolean;
  matchedBy?: "id" | "code" | "externalReference";
  matchedAedId?: string;
  matchedCode?: string | null;
  matchedExternalReference?: string | null;
}

export class AedCsvImportProcessor extends BaseBatchJobProcessor<AedCsvImportConfig> {
  readonly jobType = JobType.AED_CSV_IMPORT;
  private tempFilePath?: string; // Store temp file path for cleanup

  constructor(
    private readonly prisma: PrismaClient,
    private readonly downloadAndUploadImageUseCase?: DownloadAndUploadImageUseCase
  ) {
    super();
  }

  /**
   * Resolve file path - downloads from S3 if URL, returns local path
   */
  private async resolveFilePath(filePath: string): Promise<string> {
    // Check if it's an S3 URL
    if (filePath.startsWith("http://") || filePath.startsWith("https://")) {
      console.log(`📥 [AedCsvImportProcessor] Downloading CSV from S3: ${filePath}`);

      try {
        // Download file from S3 URL
        const response = await fetch(filePath);

        if (!response.ok) {
          throw new Error(`Failed to download file: ${response.statusText} (${response.status})`);
        }

        const buffer = await response.arrayBuffer();
        const content = Buffer.from(buffer);

        // Create temp file
        const tmpDir = path.join(os.tmpdir(), "dea-batch-processing");
        await fs.promises.mkdir(tmpDir, { recursive: true });

        const timestamp = Date.now();
        const randomId = randomUUID().substring(0, 8);
        const tempFileName = `batch-csv-${timestamp}-${randomId}.csv`;
        const tempPath = path.join(tmpDir, tempFileName);

        // Write to temp file
        await fs.promises.writeFile(tempPath, content);

        console.log(
          `✅ [AedCsvImportProcessor] CSV downloaded to temp file: ${tempPath} (${content.length} bytes)`
        );

        // Store for cleanup later
        this.tempFilePath = tempPath;

        return tempPath;
      } catch (error) {
        console.error(`❌ [AedCsvImportProcessor] Failed to download CSV from S3:`, error);
        throw new Error(
          `Failed to download CSV from S3: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    }

    // It's a local file path
    return filePath;
  }

  /**
   * Cleanup temporary files
   */
  private async cleanupTempFile(): Promise<void> {
    if (this.tempFilePath) {
      try {
        await fs.promises.unlink(this.tempFilePath);
        console.log(`🗑️ [AedCsvImportProcessor] Temporary file deleted: ${this.tempFilePath}`);
        this.tempFilePath = undefined;
      } catch (error) {
        console.warn(
          `⚠️ [AedCsvImportProcessor] Failed to delete temp file ${this.tempFilePath}:`,
          error
        );
      }
    }
  }

  validateConfig(config: AedCsvImportConfig): ProcessorValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!config.filePath) {
      errors.push("filePath is required");
    } else {
      // Only validate local file paths - S3 URLs will be validated during download
      const isUrl = config.filePath.startsWith("http://") || config.filePath.startsWith("https://");
      if (!isUrl && !fs.existsSync(config.filePath)) {
        errors.push(`File not found: ${config.filePath}`);
      }
    }

    if (!config.columnMappings || config.columnMappings.length === 0) {
      errors.push("columnMappings is required");
    }

    // Check required field mappings
    const mappedFields = config.columnMappings?.map((m) => m.systemField) || [];
    const requiredFields = ["proposedName"];

    for (const field of requiredFields) {
      if (!mappedFields.includes(field)) {
        warnings.push(`Required field '${field}' is not mapped`);
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  async initialize(config: AedCsvImportConfig): Promise<ProcessorInitResult> {
    try {
      // Resolve file path (download from S3 if needed)
      const resolvedPath = await this.resolveFilePath(config.filePath);
      const { totalRecords, headers } = this.readCsvFile(resolvedPath, config);

      if (totalRecords === 0) {
        await this.cleanupTempFile();
        return {
          success: false,
          totalRecords: 0,
          error: "CSV file is empty",
        };
      }

      return {
        success: true,
        totalRecords,
        metadata: {
          headers,
          fileName: config.filePath.split("/").pop(),
        },
      };
    } catch (error) {
      await this.cleanupTempFile();
      return {
        success: false,
        totalRecords: 0,
        error: error instanceof Error ? error.message : "Failed to parse CSV file",
      };
    }
  }

  /**
   * Read CSV file and return records (stateless - reads on demand)
   */
  private readCsvFile(
    filePath: string,
    config: AedCsvImportConfig
  ): {
    records: CsvRecord[];
    headers: string[];
    totalRecords: number;
  } {
    const content = fs.readFileSync(filePath, "utf-8");
    const delimiter = config.delimiter || ";";
    const lines = content.split("\n").filter((line) => line.trim());

    if (lines.length === 0) {
      return { records: [], headers: [], totalRecords: 0 };
    }

    // Parse headers
    const headers = this.parseCsvLine(lines[0], delimiter);

    // Parse records
    const records: CsvRecord[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCsvLine(lines[i], delimiter);
      const record: CsvRecord = {};

      headers.forEach((header, index) => {
        record[header] = values[index] || "";
      });

      records.push(record);
    }

    return { records, headers, totalRecords: records.length };
  }

  async processChunk(context: ProcessorContext): Promise<ProcessChunkResult> {
    const { job, startIndex, chunkSize, onCheckpoint, onHeartbeat } = context;
    const config = job.config as AedCsvImportConfig;
    const results: ProcessRecordResult[] = [];

    try {
      // Resolve file path (download from S3 if needed)
      const resolvedPath = await this.resolveFilePath(config.filePath);

      // Read CSV file on-demand (stateless)
      const { records } = this.readCsvFile(resolvedPath, config);

      let processedCount = 0;
      let successCount = 0;
      let failedCount = 0;
      let skippedCount = 0;

      const endIndex = Math.min(startIndex + chunkSize, records.length);

      console.log(
        `📋 [AedCsvImportProcessor] Processing records ${startIndex}-${endIndex - 1} of ${records.length}`
      );

      for (let i = startIndex; i < endIndex; i++) {
        // Check timeout
        if (this.isApproachingTimeout(context)) {
          console.log(`⏰ [AedCsvImportProcessor] Approaching timeout at record ${i}`);
          break;
        }

        const record = records[i];
        const result = await this.processRecord(record, config, i, job.id);
        results.push(result);

        if (result.success) {
          if (result.action === "skipped") {
            skippedCount++;
          } else {
            successCount++;
          }
        } else {
          failedCount++;
        }

        processedCount++;

        // Save checkpoint
        if (processedCount % config.checkpointFrequency === 0) {
          if (onCheckpoint) {
            await onCheckpoint(i);
          }
        }

        // Heartbeat
        if (onHeartbeat && processedCount % 10 === 0) {
          await onHeartbeat();
        }
      }

      // Final checkpoint
      if (onCheckpoint && processedCount > 0) {
        await onCheckpoint(startIndex + processedCount - 1);
      }

      const hasMore = startIndex + processedCount < records.length;

      console.log(
        `✅ [AedCsvImportProcessor] Processed ${processedCount} records (success: ${successCount}, failed: ${failedCount}, skipped: ${skippedCount}, hasMore: ${hasMore})`
      );

      return {
        processedCount,
        successCount,
        failedCount,
        skippedCount,
        results,
        hasMore,
        nextIndex: startIndex + processedCount,
        shouldContinue: failedCount < processedCount * 0.5,
      };
    } finally {
      // Clean up temporary file if downloaded from S3
      await this.cleanupTempFile();
    }
  }

  private async processRecord(
    record: CsvRecord,
    config: AedCsvImportConfig,
    index: number,
    jobId: string
  ): Promise<ProcessRecordResult> {
    try {
      // Map CSV columns to system fields
      const mappedData = this.mapRecord(record, config.columnMappings);
      const recordRef = mappedData.proposedName || `Fila ${index + 2}`;
      const rowNumber = index + 2; // +2 porque Excel empieza en 1 y tiene header

      // Validate required fields
      if (!mappedData.proposedName) {
        const nameMapping = config.columnMappings.find((m) => m.systemField === "proposedName");
        return this.createFailedResult(
          recordRef,
          "MISSING_DATA",
          "El campo 'nombre' es obligatorio y no puede estar vacío",
          "error",
          rowNumber,
          {
            field: "proposedName",
            csvColumn: nameMapping?.csvColumn || "proposedName",
            value: mappedData.proposedName || "",
            correctionSuggestion: `Completa el campo '${nameMapping?.csvColumn || "proposedName"}' en la fila ${rowNumber}`,
            rowData: record,
          }
        );
      }

      // Validate coordinates if provided
      if (mappedData.latitude) {
        const lat = mappedData.latitude.replace(",", ".");
        if (isNaN(parseFloat(lat))) {
          const latMapping = config.columnMappings.find((m) => m.systemField === "latitude");
          return this.createFailedResult(
            recordRef,
            "INVALID_COORDINATE",
            `La latitud "${mappedData.latitude}" no es un número válido`,
            "error",
            rowNumber,
            {
              field: "latitude",
              csvColumn: latMapping?.csvColumn || "latitude",
              value: mappedData.latitude,
              correctionSuggestion: `Usa formato decimal con punto (ej: 40.4165). Si usas coma, reemplázala por punto.`,
              rowData: record,
            }
          );
        }
        const latValue = parseFloat(lat);
        if (latValue < -90 || latValue > 90) {
          const latMapping = config.columnMappings.find((m) => m.systemField === "latitude");
          return this.createFailedResult(
            recordRef,
            "INVALID_COORDINATE",
            `La latitud ${latValue} está fuera del rango válido (-90 a 90)`,
            "error",
            rowNumber,
            {
              field: "latitude",
              csvColumn: latMapping?.csvColumn || "latitude",
              value: mappedData.latitude,
              correctionSuggestion: `Verifica las coordenadas. Para Madrid, la latitud debe estar cerca de 40.4`,
              rowData: record,
            }
          );
        }
      }

      if (mappedData.longitude) {
        const lon = mappedData.longitude.replace(",", ".");
        if (isNaN(parseFloat(lon))) {
          const lonMapping = config.columnMappings.find((m) => m.systemField === "longitude");
          return this.createFailedResult(
            recordRef,
            "INVALID_COORDINATE",
            `La longitud "${mappedData.longitude}" no es un número válido`,
            "error",
            rowNumber,
            {
              field: "longitude",
              csvColumn: lonMapping?.csvColumn || "longitude",
              value: mappedData.longitude,
              correctionSuggestion: `Usa formato decimal con punto (ej: -3.7038). Si usas coma, reemplázala por punto.`,
              rowData: record,
            }
          );
        }
        const lonValue = parseFloat(lon);
        if (lonValue < -180 || lonValue > 180) {
          const lonMapping = config.columnMappings.find((m) => m.systemField === "longitude");
          return this.createFailedResult(
            recordRef,
            "INVALID_COORDINATE",
            `La longitud ${lonValue} está fuera del rango válido (-180 a 180)`,
            "error",
            rowNumber,
            {
              field: "longitude",
              csvColumn: lonMapping?.csvColumn || "longitude",
              value: mappedData.longitude,
              correctionSuggestion: `Verifica las coordenadas. Para Madrid, la longitud debe estar cerca de -3.7`,
              rowData: record,
            }
          );
        }
      }

      // Validate postal code format
      if (mappedData.postalCode && mappedData.postalCode.length !== 5) {
        const pcMapping = config.columnMappings.find((m) => m.systemField === "postalCode");
        return this.createFailedResult(
          recordRef,
          "INVALID_POSTAL_CODE",
          `El código postal "${mappedData.postalCode}" debe tener exactamente 5 dígitos`,
          "error",
          rowNumber,
          {
            field: "postalCode",
            csvColumn: pcMapping?.csvColumn || "postalCode",
            value: mappedData.postalCode,
            correctionSuggestion: `Los códigos postales de Madrid tienen 5 dígitos (ej: 28001, 28042)`,
            rowData: record,
          }
        );
      }

      // Check for duplicates if enabled
      if (config.skipDuplicates) {
        const duplicate = await this.checkDuplicate(mappedData, config.duplicateThreshold);
        if (duplicate.isDuplicate) {
          return this.createSuccessResult("skipped", undefined, recordRef, {
            reason: "duplicate",
            matchedBy: duplicate.matchedBy,
            matchedAedId: duplicate.matchedAedId,
            matchedCode: duplicate.matchedCode,
            matchedExternalReference: duplicate.matchedExternalReference,
          });
        }
      }

      // Dry run - don't create
      if (config.dryRun) {
        return this.createSuccessResult("skipped", undefined, recordRef, {
          action: "would_create",
          data: mappedData,
        });
      }

      // Create AED (with transaction and batch_job_id)
      const aed = await this.createAed(mappedData, config, jobId);
      return this.createSuccessResult("created", aed.id, recordRef);
    } catch (error) {
      return this.createFailedResult(
        `Fila ${index + 2}`,
        "PROCESSING_ERROR",
        error instanceof Error ? error.message : "Error desconocido",
        "error",
        index + 2,
        {
          correctionSuggestion: "Contacta con soporte si el error persiste",
          rowData: record,
        }
      );
    }
  }

  private mapRecord(
    record: CsvRecord,
    mappings: AedCsvImportConfig["columnMappings"]
  ): Record<string, string> {
    const result: Record<string, string> = {};

    for (const mapping of mappings) {
      const value = record[mapping.csvColumn];
      if (value !== undefined && value !== "") {
        result[mapping.systemField] = value.trim();
      }
    }

    return result;
  }

  /**
   * Verifica duplicados con cascada de matching:
   * 1. Por ID (si el usuario lo proporciona)
   * 2. Por code
   * 3. Por external_reference
   *
   * Esto permite re-ejecutar importaciones de forma segura
   */
  private async checkDuplicate(
    data: Record<string, string>,
    _threshold: number
  ): Promise<DuplicateCheckOutcome> {
    const outcome: DuplicateCheckOutcome = { isDuplicate: false };

    const id = data.id?.trim();
    const code = data.code?.trim();
    const externalRef = data.externalReference?.trim();

    // Si no hay ningún identificador, no podemos verificar duplicados
    if (!id && !code && !externalRef) return outcome;

    // ========================================
    // PRIORIDAD 1: Buscar por ID
    // ========================================
    if (id) {
      try {
        const existingById = await this.prisma.aed.findUnique({
          where: { id },
          select: {
            id: true,
            code: true,
            external_reference: true,
          },
        });

        if (existingById) {
          return {
            isDuplicate: true,
            matchedBy: "id",
            matchedAedId: existingById.id,
            matchedCode: existingById.code,
            matchedExternalReference: existingById.external_reference,
          };
        }
      } catch (error) {
        // ID no válido o no es UUID, continuar con otros métodos
        console.warn(`Invalid ID format: ${id}`, error);
      }
    }

    // ========================================
    // PRIORIDAD 2: Buscar por code
    // ========================================
    if (code) {
      const existingByCode = await this.prisma.aed.findFirst({
        where: {
          code: {
            equals: code,
            mode: "insensitive",
          },
        },
        select: {
          id: true,
          code: true,
          external_reference: true,
        },
      });

      if (existingByCode) {
        return {
          isDuplicate: true,
          matchedBy: "code",
          matchedAedId: existingByCode.id,
          matchedCode: existingByCode.code,
          matchedExternalReference: existingByCode.external_reference,
        };
      }
    }

    // ========================================
    // PRIORIDAD 3: Buscar por external_reference
    // ========================================
    if (externalRef) {
      const existingByExtRef = await this.prisma.aed.findFirst({
        where: {
          external_reference: {
            equals: externalRef,
            mode: "insensitive",
          },
        },
        select: {
          id: true,
          code: true,
          external_reference: true,
        },
      });

      if (existingByExtRef) {
        return {
          isDuplicate: true,
          matchedBy: "externalReference",
          matchedAedId: existingByExtRef.id,
          matchedCode: existingByExtRef.code,
          matchedExternalReference: existingByExtRef.external_reference,
        };
      }
    }

    // No se encontró ningún duplicado
    return outcome;
  }

  private async createAed(
    data: Record<string, string>,
    config: AedCsvImportConfig,
    jobId: string
  ): Promise<{ id: string }> {
    // Parse coordinates
    const latitude = data.latitude ? parseFloat(data.latitude.replace(",", ".")) : undefined;
    const longitude = data.longitude ? parseFloat(data.longitude.replace(",", ".")) : undefined;

    // ========================================
    // 1. CREATE LOCATION
    // ========================================
    const location = await this.prisma.aedLocation.create({
      data: {
        street_type: data.streetType || null,
        street_name: data.streetName || null,
        street_number: data.streetNumber || null,
        postal_code: data.postalCode || null,
        city_name: data.city || data.cityName || null,
        city_code: data.cityCode || null,
        district_code: data.districtCode || null,
        district_name: data.district || null,
        neighborhood_code: data.neighborhoodCode || null,
        neighborhood_name: data.neighborhood || data.neighborhoodName || null,
        floor: data.floor || null,
        location_details: data.locationDetails || null,
        access_instructions: data.accessDescription || null,
      },
    });

    // ========================================
    // 2. CREATE SCHEDULE (if schedule data exists)
    // ========================================
    let scheduleId: string | undefined = undefined;

    const hasScheduleData =
      data.is24x7 ||
      data.openingMonFri ||
      data.closingMonFri ||
      data.openingSat ||
      data.closingSat ||
      data.openingSun ||
      data.closingSun ||
      data.has24hSurveillance;

    if (hasScheduleData) {
      const schedule = await this.prisma.aedSchedule.create({
        data: {
          weekday_opening: data.openingMonFri || null,
          weekday_closing: data.closingMonFri || null,
          saturday_opening: data.openingSat || null,
          saturday_closing: data.closingSat || null,
          sunday_opening: data.openingSun || null,
          sunday_closing: data.closingSun || null,
          has_24h_surveillance: this.parseBoolean(data.has24hSurveillance),
          has_restricted_access: this.parseBoolean(data.hasRestrictedAccess),
          description: data.scheduleDescription || null,
          notes: data.scheduleNotes || null,
        },
      });
      scheduleId = schedule.id;
    }

    // ========================================
    // 3. CREATE RESPONSIBLE (if responsible data exists)
    // ========================================
    let responsibleId: string | undefined = undefined;

    const hasResponsibleData =
      data.responsibleName ||
      data.responsibleEmail ||
      data.responsiblePhone ||
      data.ownership ||
      data.localOwnership;

    if (hasResponsibleData) {
      const responsible = await this.prisma.aedResponsible.create({
        data: {
          name: data.responsibleName || "Sin especificar",
          email: data.responsibleEmail || null,
          phone: data.responsiblePhone || null,
          alternative_phone: data.responsibleAlternativePhone || null,
          ownership: data.ownership || null,
          local_ownership: data.localOwnership || null,
          local_use: data.localUse || null,
          organization: data.responsibleOrganization || null,
          position: data.responsiblePosition || null,
          department: data.responsibleDepartment || null,
        },
      });
      responsibleId = responsible.id;
    }

    // ========================================
    // 0. GENERATE UUIDs BEFORE CREATING AED
    // ========================================
    const aedId = randomUUID();

    // ========================================
    // 4. CREATE AED WITH TRANSACTION (atomic operation)
    // ========================================
    const aed = await this.prisma.$transaction(async (tx) => {
      // Create AED in transaction
      const createdAed = await tx.aed.create({
        data: {
          id: aedId, // ← UUID pre-generado para que las imágenes puedan usarlo

          // Código e identificadores
          code: data.code || null,
          external_reference: data.externalReference || null,

          // Datos básicos
          name: data.proposedName,
          establishment_type: data.establishmentType || null,

          // Coordenadas
          latitude,
          longitude,
          coordinates_precision: data.coordinatesPrecision || null,

          // Relaciones
          location_id: location.id,
          schedule_id: scheduleId,
          responsible_id: responsibleId,

          // Origen y trazabilidad
          source_origin: "CSV_IMPORT",
          source_details: `Importación CSV: ${config.filePath.split("/").pop()}`,
          batch_job_id: jobId, // ✅ Asignar batch_job_id para rastreo y recuperación

          // Notas
          public_notes: data.publicNotes || data.freeComment || null,

          // Estado inicial
          status: "DRAFT",
        },
        select: { id: true },
      });

      return createdAed;
    });

    // ========================================
    // 5. DOWNLOAD AND UPLOAD IMAGES TO S3 (if image URLs exist)
    // ========================================
    // Recopilar todas las posibles URLs de imágenes (soporta múltiples nomenclaturas)
    const potentialImages = [
      // Nomenclatura específica (tiene prioridad)
      { url: data.photoFrontUrl, type: "FRONT" as const },
      { url: data.photoLocationUrl, type: "LOCATION" as const },
      { url: data.photoAccessUrl, type: "ACCESS" as const },
      // Nomenclatura genérica (fallback)
      { url: data.photo1Url, type: "FRONT" as const },
      { url: data.photo2Url, type: "LOCATION" as const },
      { url: data.photo3Url, type: "CONTEXT" as const },
    ];

    // Filtrar y eliminar duplicados (por URL)
    const seenUrls = new Set<string>();
    const imageUrls = potentialImages
      .filter((img) => {
        if (!img.url || img.url.trim() === "") return false;
        const normalizedUrl = img.url.trim();
        if (seenUrls.has(normalizedUrl)) return false;
        seenUrls.add(normalizedUrl);
        return true;
      })
      .map((img) => ({
        url: img.url!.trim(),
        type: img.type,
        imageId: randomUUID(),
      }));

    if (imageUrls.length > 0) {
      // Process images sequentially to avoid overwhelming the system
      for (const [index, img] of imageUrls.entries()) {
        try {
          // If use case is available, download and upload to S3
          if (this.downloadAndUploadImageUseCase) {
            console.log(
              `📸 [AedCsvImportProcessor] Processing image ${index + 1}/${imageUrls.length} for AED ${aedId}`
            );

            const s3Result = await this.downloadAndUploadImageUseCase.execute({
              url: img.url,
              aedId: aedId,
              imageId: img.imageId,
              sharePointAuth: config.sharePointAuth,
            });

            // Create image record with S3 URL
            // original_url = imagen sin procesar en S3
            // processed_url = NULL (se llenará durante verificación con marcadores)
            await this.prisma.aedImage.create({
              data: {
                id: img.imageId,
                aed_id: aedId,
                type: img.type,
                order: index + 1,
                original_url: s3Result.url, // ✅ URL en S3 sin procesar
                processed_url: null, // Se llenará durante verificación
                is_verified: false,
              },
            });

            console.log(
              `✅ [AedCsvImportProcessor] Image ${index + 1} uploaded to S3: ${s3Result.url}`
            );
          } else {
            // Fallback: crear registro con URL original si no hay use case
            console.warn(
              `⚠️ [AedCsvImportProcessor] Image download use case not available. Saving original URL for image ${index + 1}`
            );
            await this.prisma.aedImage.create({
              data: {
                id: img.imageId,
                aed_id: aedId,
                type: img.type,
                order: index + 1,
                original_url: img.url,
                is_verified: false,
              },
            });
          }
        } catch (error) {
          // Log error but don't fail the entire AED import
          console.error(
            `❌ [AedCsvImportProcessor] Failed to process image ${index + 1} from ${img.url}:`,
            error instanceof Error ? error.message : error
          );
          // Optionally, create a record with original URL as fallback
          try {
            await this.prisma.aedImage.create({
              data: {
                id: img.imageId,
                aed_id: aedId,
                type: img.type,
                order: index + 1,
                original_url: img.url,
                is_verified: false,
              },
            });
            console.log(
              `📝 [AedCsvImportProcessor] Created fallback image record with original URL`
            );
          } catch (fallbackError) {
            console.error(
              `❌ [AedCsvImportProcessor] Failed to create fallback image record:`,
              fallbackError
            );
          }
        }
      }
    }

    return aed;
  }

  /**
   * Helper para parsear valores booleanos desde strings
   */
  private parseBoolean(value: string | undefined): boolean {
    if (!value) return false;
    const normalized = value.toLowerCase().trim();
    return ["true", "1", "sí", "si", "yes", "y", "s"].includes(normalized);
  }

  private parseCsvLine(line: string, delimiter: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }

    result.push(current.trim());
    return result;
  }

  async finalize(job: BatchJob): Promise<JobResult> {
    return JobResult.fromProgress(job.progress).complete();
  }

  async cleanup(_job: BatchJob): Promise<void> {
    // Cleanup temporary CSV files downloaded from S3
    await this.cleanupTempFile();
  }

  async preview(
    config: AedCsvImportConfig,
    limit: number = 5
  ): Promise<{
    sampleRecords: Record<string, unknown>[];
    totalCount: number;
  }> {
    try {
      const content = fs.readFileSync(config.filePath, "utf-8");
      const delimiter = config.delimiter || ";";
      const lines = content.split("\n").filter((line) => line.trim());

      if (lines.length === 0) {
        return { sampleRecords: [], totalCount: 0 };
      }

      const headers = this.parseCsvLine(lines[0], delimiter);
      const sampleRecords: Record<string, unknown>[] = [];

      for (let i = 1; i <= Math.min(limit, lines.length - 1); i++) {
        const values = this.parseCsvLine(lines[i], delimiter);
        const record: Record<string, string> = {};

        headers.forEach((header, index) => {
          record[header] = values[index] || "";
        });

        // Apply column mappings if provided
        if (config.columnMappings) {
          sampleRecords.push(this.mapRecord(record, config.columnMappings));
        } else {
          sampleRecords.push(record);
        }
      }

      return {
        sampleRecords,
        totalCount: lines.length - 1,
      };
    } catch {
      return { sampleRecords: [], totalCount: 0 };
    }
  }
}
