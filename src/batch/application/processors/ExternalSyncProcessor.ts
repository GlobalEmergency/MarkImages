/**
 * External Sync Processor
 *
 * Processor for synchronizing AEDs from external data sources.
 * Implements the IBatchJobProcessor interface for the batch job system.
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
  ExternalSyncConfig,
} from "@/batch/domain";
import { BatchJob } from "@/batch/domain/entities";
import { IDataSourceAdapter, DataSourceConfig } from "@/import/domain/ports/IDataSourceAdapter";
import { IDataSourceRepository } from "@/import/domain/ports/IDataSourceRepository";
import { ImportRecord } from "@/import/domain/value-objects/ImportRecord";
import { DataSourceAdapterFactory } from "@/import/infrastructure/adapters/DataSourceAdapterFactory";
import { PrismaClient, SourceOrigin } from "@/generated/client/client";
import { S3DataCacheService } from "@/batch/infrastructure/services/S3DataCacheService";
import { IDuplicateDetectionService } from "@/import/domain/ports/IDuplicateDetectionService";
import { DuplicateDetectionCriteria } from "@/import/domain/ports/IDuplicateDetectionService";
import { SYSTEM_USER_UUID } from "@/constants/system";
import { EnrichLocationWithGeocodingUseCase } from "@/location/application/use-cases/EnrichLocationWithGeocodingUseCase";

interface ExternalDataSourceLocalConfig {
  type: string;
  config: DataSourceConfig;
  matchingStrategy: string;
  matchingThreshold: number;
  autoDeactivateMissing: boolean;
  autoUpdateFields: string[];
  sourceOrigin: string;
  regionCode: string;
  syncFrequency: string; // MANUAL | DAILY | WEEKLY | MONTHLY
}

/**
 * Type for AED update data during sync operations
 * Uses Record<string, unknown> for Prisma compatibility with dynamic inputs
 */
type AedUpdateData = Record<string, unknown>;

/**
 * Type for verified AED update (metadata only)
 * Uses Record<string, unknown> for Prisma compatibility
 */
type VerifiedAedUpdateData = Record<string, unknown>;

/**
 * Type for AED data retrieved during update check
 */
interface AedUpdateCheckData {
  location_id: string;
  schedule_id: string | null;
  responsible_id: string | null;
  last_verified_at: Date | null;
  name: string;
  code: string | null;
  establishment_type: string | null;
  external_reference: string | null;
  data_source_id: string | null;
  source_origin: string;
  internal_notes: unknown;
}

export class ExternalSyncProcessor extends BaseBatchJobProcessor<ExternalSyncConfig> {
  readonly jobType = JobType.AED_EXTERNAL_SYNC;

  private adapter: IDataSourceAdapter | null = null;
  private dataSource: ExternalDataSourceLocalConfig | null = null;
  private s3Cache: S3DataCacheService;
  private externalIdFieldCache: string | null = null; // Cache the detected external ID field

  constructor(
    private readonly prisma: PrismaClient,
    private readonly dataSourceRepository: IDataSourceRepository,
    private readonly duplicateDetectionService?: IDuplicateDetectionService,
    private readonly enrichLocationUseCase?: EnrichLocationWithGeocodingUseCase
  ) {
    super();
    this.s3Cache = new S3DataCacheService();
  }

  validateConfig(config: ExternalSyncConfig): ProcessorValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!config.dataSourceId) {
      errors.push("dataSourceId is required");
    }

    if (config.chunkSize && (config.chunkSize < 1 || config.chunkSize > 500)) {
      errors.push("chunkSize must be between 1 and 500");
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  async initialize(config: ExternalSyncConfig): Promise<ProcessorInitResult> {
    try {
      // Load data source configuration
      const dataSource = await this.dataSourceRepository.findById(config.dataSourceId);

      if (!dataSource) {
        return {
          success: false,
          totalRecords: 0,
          error: `Data source not found: ${config.dataSourceId}`,
        };
      }

      if (!dataSource.isActive) {
        return {
          success: false,
          totalRecords: 0,
          error: "Data source is not active",
        };
      }

      // Validate fieldMappings - required for proper data transformation
      const fieldMappings = dataSource.config.fieldMappings;
      if (!fieldMappings || Object.keys(fieldMappings).length === 0) {
        return {
          success: false,
          totalRecords: 0,
          error:
            `La fuente de datos "${dataSource.name}" no tiene configurado el mapeo de campos (fieldMappings). ` +
            `Por favor, configure el mapeo de campos en la página de edición de la fuente de datos ` +
            `antes de ejecutar la sincronización. Use el botón "Cargar Preview" para verificar que el mapeo es correcto.`,
        };
      }

      // Log the field mappings being used
      console.log(
        `📋 [ExternalSync] Using field mappings for "${dataSource.name}":`,
        Object.keys(fieldMappings).join(", ")
      );

      this.dataSource = {
        type: dataSource.type,
        config: dataSource.config,
        matchingStrategy: dataSource.matchingStrategy,
        matchingThreshold: dataSource.matchingThreshold,
        autoDeactivateMissing: dataSource.autoDeactivateMissing,
        autoUpdateFields: dataSource.autoUpdateFields,
        sourceOrigin: dataSource.sourceOrigin,
        regionCode: dataSource.regionCode,
        syncFrequency: dataSource.syncFrequency,
      };

      // Create adapter
      this.adapter = DataSourceAdapterFactory.getApiAdapter(
        dataSource.type as "CKAN_API" | "JSON_FILE" | "REST_API" | "CSV_FILE"
      );

      // Use estimated count instead of actual count to avoid timeout
      // The count will be updated as we process records
      let totalRecords = 99999; // High estimate for large datasets

      try {
        // Try to get actual count with a short timeout
        const countPromise = this.adapter.getRecordCount(this.dataSource.config);
        const timeoutPromise = new Promise<number>((_, reject) =>
          setTimeout(() => reject(new Error("Count timeout")), 5000)
        );

        totalRecords = await Promise.race([countPromise, timeoutPromise]);
      } catch (error) {
        // If count fails or times out, use the estimate
        console.warn("Could not get exact record count, using estimate:", error);
      }

      return {
        success: true,
        totalRecords,
        metadata: {
          dataSourceType: this.dataSource.type,
          matchingStrategy: this.dataSource.matchingStrategy,
          regionCode: this.dataSource.regionCode,
          estimatedCount: totalRecords === 99999,
        },
      };
    } catch (error) {
      return {
        success: false,
        totalRecords: 0,
        error: error instanceof Error ? error.message : "Unknown initialization error",
      };
    }
  }

  async processChunk(context: ProcessorContext): Promise<ProcessChunkResult> {
    const {
      job,
      startIndex,
      chunkSize,
      timeoutAt: _timeoutAt,
      onCheckpoint,
      onHeartbeat,
    } = context;
    const config = job.config as ExternalSyncConfig;
    const results: ProcessRecordResult[] = [];

    let processedCount = 0;
    let successCount = 0;
    let failedCount = 0;
    let skippedCount = 0;
    let currentIndex = startIndex;

    try {
      let rawRecords: Record<string, unknown>[];
      let totalRecords: number;

      // CHUNK 1: Initialize and cache data in S3
      if (startIndex === 0) {
        console.log(`🚀 [ExternalSync] Initializing first chunk - downloading and caching data`);

        if (!this.adapter || !this.dataSource) {
          throw new Error("Adapter or data source not initialized");
        }

        // Download complete JSON data
        console.log(`📥 [ExternalSync] Downloading complete dataset...`);
        console.log(`📋 [ExternalSync] Applying field mappings during download...`);

        // Get all records - fetch the complete dataset
        // The adapter already applies fieldMappings and returns ImportRecord objects
        const recordsArray: Record<string, unknown>[] = [];
        const recordsGenerator = this.adapter.fetchRecords(this.dataSource.config);

        for await (const importRecord of recordsGenerator) {
          // Store normalized data WITH rawData for full traceability
          // This ensures fieldMappings are applied ONCE at download time
          recordsArray.push({
            // Normalized fields (already mapped by the adapter)
            externalId: importRecord.externalId,
            name: importRecord.name,
            establishmentType: importRecord.establishmentType,
            streetType: importRecord.streetType,
            streetName: importRecord.streetName,
            streetNumber: importRecord.streetNumber,
            floor: importRecord.floor,
            additionalInfo: importRecord.additionalInfo,
            specificLocation: importRecord.specificLocation,
            postalCode: importRecord.postalCode,
            city: importRecord.city,
            cityCode: importRecord.cityCode,
            district: importRecord.district,
            // Store coordinates as strings to maintain consistency with NormalizedRecordData
            latitude: importRecord.latitude?.toString() ?? null,
            longitude: importRecord.longitude?.toString() ?? null,
            accessSchedule: importRecord.accessSchedule,
            accessDescription: importRecord.accessDescription,
            ownershipType: importRecord.ownershipType,
            scheduleDescription: importRecord.scheduleDescription,
            submitterName: importRecord.submitterName,
            submitterEmail: importRecord.submitterEmail,
            submitterPhone: importRecord.submitterPhone,
            ownership: importRecord.ownership,
            // Original raw data for source_details and debugging
            _rawData: importRecord.rawData,
            _contentHash: importRecord.contentHash,
            _rowIndex: importRecord.rowIndex,
          });

          if (recordsArray.length % 1000 === 0) {
            console.log(
              `📦 [ExternalSync] Downloaded and normalized ${recordsArray.length} records...`
            );
          }
        }

        totalRecords = recordsArray.length;
        console.log(`✅ [ExternalSync] Downloaded and normalized ${totalRecords} total records`);

        // Detect external ID field from raw data for logging purposes
        if (recordsArray.length > 0) {
          const firstRawData = recordsArray[0]._rawData as Record<string, unknown>;
          this.externalIdFieldCache = this.detectExternalIdField(firstRawData);
          console.log(
            `🔑 [ExternalSync] Detected external ID field: "${this.externalIdFieldCache}"`
          );
        }

        // Upload to S3 - now contains normalized data
        await this.s3Cache.uploadJsonData(job.id, recordsArray, {
          totalRecords,
          dataSourceId: config.dataSourceId,
          jsonPath: this.dataSource.config.jsonPath,
        });

        // Update job with actual total records
        job.setTotalRecords(totalRecords);

        // Get first chunk
        rawRecords = recordsArray.slice(0, chunkSize);
      } else {
        // CHUNK 2+: Read chunk from S3 cache
        console.log(
          `📥 [ExternalSync] Reading chunk from S3 cache (${startIndex}-${startIndex + chunkSize - 1})`
        );

        rawRecords = await this.s3Cache.getJsonChunk(job.id, startIndex, chunkSize);

        // Get total from cache metadata
        const cacheMetadata = await this.s3Cache.getCacheMetadata(job.id);
        totalRecords = cacheMetadata?.totalRecords || job.progress.totalRecords;
      }

      console.log(`🔄 [ExternalSync] Processing ${rawRecords.length} records from chunk`);

      // CRITICAL: Reload dataSource if not present (happens when job resumes from checkpoint)
      if (!this.dataSource) {
        console.log(`🔄 [ExternalSync] Reloading data source for resumed job...`);
        const dataSource = await this.dataSourceRepository.findById(config.dataSourceId);
        if (!dataSource || !dataSource.isActive) {
          throw new Error("Data source not found or inactive");
        }

        this.dataSource = {
          type: dataSource.type,
          config: dataSource.config,
          matchingStrategy: dataSource.matchingStrategy,
          matchingThreshold: dataSource.matchingThreshold,
          autoDeactivateMissing: dataSource.autoDeactivateMissing,
          autoUpdateFields: dataSource.autoUpdateFields,
          sourceOrigin: dataSource.sourceOrigin,
          regionCode: dataSource.regionCode,
          syncFrequency: dataSource.syncFrequency,
        };
      }

      // Ensure we have an external ID field cached (fallback for resumed jobs)
      if (!this.externalIdFieldCache && rawRecords.length > 0) {
        // Try to get from _rawData if available (normalized format)
        const firstRawData = (rawRecords[0]._rawData as Record<string, unknown>) || rawRecords[0];
        this.externalIdFieldCache = this.detectExternalIdField(firstRawData);
        console.log(
          `🔑 [ExternalSync] Detected external ID field (resumed job): "${this.externalIdFieldCache}"`
        );
      }

      // Process records in the chunk
      for (const cachedRecord of rawRecords) {
        // Check timeout before processing each record
        if (this.isApproachingTimeout(context)) {
          console.warn(`⏰ [ExternalSync] Approaching timeout, stopping chunk processing`);
          break;
        }

        // Create ImportRecord from cached data (already normalized at download time)
        // No need to re-apply fieldMappings - data was normalized during first chunk
        const importRecord = ImportRecord.fromCachedRecord(
          cachedRecord,
          (this.dataSource?.type || "CKAN_API") as
            | "CKAN_API"
            | "JSON_FILE"
            | "REST_API"
            | "CSV_FILE"
        );

        // Process the record
        const result = await this.processRecord(importRecord, config, currentIndex);
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
        currentIndex++;

        // Save checkpoint more frequently (every 5 records)
        if (processedCount % 5 === 0) {
          if (onCheckpoint) {
            const recordHash = this.generateImportRecordHash(importRecord);
            await onCheckpoint(currentIndex - 1, recordHash);
          }
        }

        // Send heartbeat
        if (onHeartbeat && processedCount % 5 === 0) {
          await onHeartbeat();
        }
      }

      // Determine if there are more records
      const hasMore = currentIndex < totalRecords;

      console.log(
        `✅ [ExternalSync] Chunk complete: ${processedCount} processed, hasMore: ${hasMore}, next: ${currentIndex}`
      );

      // Final checkpoint
      if (onCheckpoint && processedCount > 0) {
        await onCheckpoint(currentIndex - 1);
      }

      return {
        processedCount,
        successCount,
        failedCount,
        skippedCount,
        results,
        hasMore,
        nextIndex: currentIndex,
        // shouldContinue: true if we processed nothing due to timeout (so job can resume later)
        // shouldContinue: false if >50% of processed records failed
        shouldContinue: processedCount === 0 ? true : failedCount < processedCount * 0.5,
      };
    } catch (error) {
      console.error(`❌ [ExternalSync] Error processing chunk:`, error);
      return {
        processedCount,
        successCount,
        failedCount,
        skippedCount,
        results,
        hasMore: false,
        nextIndex: currentIndex,
        shouldContinue: false,
        error: error instanceof Error ? error.message : "Unknown error during chunk processing",
      };
    }
  }

  private async processRecord(
    record: ImportRecord,
    config: ExternalSyncConfig,
    index: number
  ): Promise<ProcessRecordResult> {
    try {
      const externalId = record.externalId;
      const recordRef = externalId || `record-${index}`;

      // Check if AED already exists
      const existingAed = await this.findExistingAed(record);

      if (existingAed) {
        // Update existing AED
        if (config.dryRun) {
          return this.createSuccessResult("skipped", existingAed.id, recordRef, {
            action: "would_update",
          });
        }

        await this.updateAed(existingAed.id, record, config);
        return this.createSuccessResult("updated", existingAed.id, recordRef);
      } else {
        // Create new AED
        if (config.dryRun) {
          return this.createSuccessResult("skipped", undefined, recordRef, {
            action: "would_create",
          });
        }

        const newAed = await this.createAed(record, config);
        return this.createSuccessResult("created", newAed.id, recordRef);
      }
    } catch (error) {
      return this.createFailedResult(
        `record-${index}`,
        "PROCESSING_ERROR",
        error instanceof Error ? error.message : "Unknown error",
        "error"
      );
    }
  }

  private async findExistingAed(record: ImportRecord): Promise<{ id: string } | null> {
    // STRATEGY 1: Try to find by external reference first (fastest, most reliable)
    if (record.externalId) {
      const byExternal = await this.prisma.aed.findFirst({
        where: { external_reference: record.externalId },
        select: { id: true },
      });
      if (byExternal) return byExternal;
    }

    // STRATEGY 2: Use advanced duplicate detection if service is available
    if (this.duplicateDetectionService && this.dataSource) {
      const matchingStrategy = this.dataSource.matchingStrategy;
      const matchingThreshold = this.dataSource.matchingThreshold;

      // Skip advanced detection if strategy is BY_EXTERNAL_CODE only
      if (matchingStrategy !== "BY_EXTERNAL_CODE") {
        try {
          const criteria: DuplicateDetectionCriteria = {
            name: record.name || "",
            streetType: record.streetType,
            streetName: record.streetName,
            streetNumber: record.streetNumber,
            postalCode: record.postalCode,
            latitude: record.latitude,
            longitude: record.longitude,
            establishmentType: record.establishmentType,
            floor: record.floor,
            locationDetails: record.locationDetails,
            accessInstructions: record.accessInstructions,
          };

          const duplicateCheck = await this.duplicateDetectionService.checkDuplicate(criteria);

          // Use matching threshold from data source configuration
          if (duplicateCheck.hasConfirmedDuplicate) {
            const bestMatch = duplicateCheck.matches[0];
            const matchScore = bestMatch?.score ?? 0;
            if (bestMatch && matchScore >= matchingThreshold) {
              return { id: bestMatch.aedId };
            }
          }
        } catch (error) {
          // Log error but continue with fallback strategies
          console.error("Error in advanced duplicate detection:", error);
        }
      }
    }

    // STRATEGY 3: Fallback to simple coordinate-based matching
    // Only if no duplicate detection service or if advanced detection failed
    if (record.latitude && record.longitude) {
      const byCoords = await this.prisma.aed.findFirst({
        where: {
          latitude: {
            gte: record.latitude - 0.0001,
            lte: record.latitude + 0.0001,
          },
          longitude: {
            gte: record.longitude - 0.0001,
            lte: record.longitude + 0.0001,
          },
        },
        select: { id: true },
      });
      if (byCoords) return byCoords;
    }

    return null;
  }

  private async createAed(
    record: ImportRecord,
    config: ExternalSyncConfig
  ): Promise<{ id: string }> {
    // Get data source configuration for default values
    const dataSource = await this.prisma.externalDataSource.findUnique({
      where: { id: config.dataSourceId },
      select: {
        default_status: true,
        default_requires_attention: true,
        default_publication_mode: true,
      },
    });

    // Combine location details from multiple fields
    const locationDetailsParts: string[] = [];
    if (record.additionalInfo) locationDetailsParts.push(record.additionalInfo);
    if (record.specificLocation) locationDetailsParts.push(record.specificLocation);
    const locationDetails = locationDetailsParts.join(". ").trim() || null;

    // Create location first (coordinates are now only in Aed table)
    const location = await this.prisma.aedLocation.create({
      data: {
        street_type: record.streetType,
        street_name: record.streetName,
        street_number: record.streetNumber,
        postal_code: record.postalCode,
        floor: record.floor,
        location_details: locationDetails,
        access_instructions: record.accessDescription,
        city_name: record.city,
        city_code: record.cityCode,
        district_name: record.district,
      },
    });

    // 🌍 Enrich location with geocoding if service is available and data is incomplete
    if (this.enrichLocationUseCase) {
      try {
        const needsEnrichment =
          !location.postal_code || !location.city_name || !location.district_name;

        if (needsEnrichment) {
          console.log(`🌍 [ExternalSync] Enriching location ${location.id} with geocoding...`);

          // Construir dirección completa para mejor precisión en geocoding
          // Combinar streetType + streetName para formar la dirección completa
          // Ej: "CALLE" + "de Cibeles" = "Calle de Cibeles"
          let streetPart = "";
          if (record.streetType && record.streetName) {
            // Capitalizar el tipo de vía (CALLE -> Calle, PLAZA -> Plaza)
            const capitalizedType =
              record.streetType.charAt(0).toUpperCase() + record.streetType.slice(1).toLowerCase();
            streetPart = `${capitalizedType} ${record.streetName}`;
          } else if (record.streetName) {
            streetPart = record.streetName;
          }

          const addressParts = [
            streetPart,
            record.streetNumber,
            record.postalCode,
            record.city,
            "España",
          ].filter(Boolean);
          const fullAddress = addressParts.join(", ");

          const enrichResult = await this.enrichLocationUseCase.execute({
            locationId: location.id,
            rawAddress: fullAddress,
            originalCoords:
              record.latitude && record.longitude
                ? { latitude: record.latitude, longitude: record.longitude }
                : undefined,
          });

          if (enrichResult.enriched) {
            console.log(
              `✅ [ExternalSync] Location enriched. Fields updated: ${enrichResult.fieldsUpdated.join(", ")}`
            );
            console.log(`   Coordinate validation: ${enrichResult.coordinateValidation.status}`);
          }
        }
      } catch (error) {
        console.error(`❌ [ExternalSync] Error enriching location ${location.id}:`, error);
        // Continue execution - enrichment failure should not block sync
      }
    }

    // Create schedule if accessSchedule or scheduleDescription exists
    let scheduleId: string | null = null;
    if (record.accessSchedule || record.scheduleDescription) {
      const schedule = await this.prisma.aedSchedule.create({
        data: {
          description: record.accessSchedule || record.scheduleDescription,
        },
      });
      scheduleId = schedule.id;
      console.log(
        `📝 [ExternalSync] Created schedule: ${record.accessSchedule || record.scheduleDescription}`
      );
    }

    // Create responsible if we have ownership or submitter information
    let responsibleId: string | null = null;
    if (
      record.ownershipType ||
      record.ownership ||
      record.submitterName ||
      record.submitterEmail ||
      record.submitterPhone
    ) {
      const responsible = await this.prisma.aedResponsible.create({
        data: {
          name: record.submitterName || record.ownershipType || "Sin nombre",
          email: record.submitterEmail,
          phone: record.submitterPhone,
          ownership: record.ownershipType || record.ownership,
        },
      });
      responsibleId = responsible.id;
      console.log(
        `📝 [ExternalSync] Created responsible with ownership: ${record.ownershipType || record.ownership}`
      );
    }

    // Prepare code field
    // Use externalId as code if available and valid (not auto-generated)
    let code: string | null = null;
    if (record.hasExternalReference()) {
      code = record.externalId;
      console.log(`📝 [ExternalSync] Assigning code from externalId: ${code}`);
    }

    // Create AED with configured default values
    const aed = await this.prisma.aed.create({
      data: {
        name: record.name || "Sin nombre",
        code: code,
        establishment_type: record.establishmentType,
        latitude: record.latitude,
        longitude: record.longitude,
        location_id: location.id,
        schedule_id: scheduleId,
        responsible_id: responsibleId,
        external_reference: record.externalId,
        source_origin: "EXTERNAL_API",
        source_details: JSON.stringify(record.rawData), // 💾 Save ALL original data
        data_source_id: config.dataSourceId,

        // 🆕 Use configured defaults from data source
        status: dataSource?.default_status || "PUBLISHED",
        requires_attention: dataSource?.default_requires_attention ?? true,
        publication_mode: dataSource?.default_publication_mode || "LOCATION_ONLY",

        last_synced_at: new Date(),
        created_by: SYSTEM_USER_UUID, // Automated creation by sync
      },
      select: { id: true },
    });

    console.log(
      `📝 [ExternalSync] Created AED ${aed.id} with code="${code || "null"}", ` +
        `status="${dataSource?.default_status || "PUBLISHED"}", ` +
        `requires_attention=${dataSource?.default_requires_attention ?? true}, ` +
        `publication_mode="${dataSource?.default_publication_mode || "LOCATION_ONLY"}"`
    );

    return aed;
  }

  private async updateAed(
    aedId: string,
    record: ImportRecord,
    config: ExternalSyncConfig
  ): Promise<void> {
    // Get full AED info to check verification status and existing code
    const aed = (await this.prisma.aed.findUnique({
      where: { id: aedId },
      select: {
        location_id: true,
        schedule_id: true,
        responsible_id: true,
        last_verified_at: true,
        name: true,
        code: true,
        establishment_type: true,
        external_reference: true,
        data_source_id: true,
        source_origin: true,
        internal_notes: true,
      },
    })) as AedUpdateCheckData | null;

    if (!aed) {
      throw new Error(`AED ${aedId} not found`);
    }

    // 🔀 MERGE LOGIC: Determine if this is a merge (different external_reference)
    const isMerging =
      aed.external_reference && record.externalId && aed.external_reference !== record.externalId;

    // 📊 SYNC TYPE: Determine if this is an automatic/periodic sync or manual/one-time import
    const isAutomaticSync =
      this.dataSource &&
      this.dataSource.syncFrequency &&
      this.dataSource.syncFrequency !== "MANUAL";

    if (isMerging) {
      const existingNotes = Array.isArray(aed.internal_notes) ? aed.internal_notes : [];

      if (isAutomaticSync) {
        // ==========================================
        // CASO 1: Sincronización Automática Periódica
        // ==========================================
        // El DEA pasa a ser "propiedad" de la fuente automática
        // Se actualiza source_origin, pero se guarda el anterior en historial
        // Note: isAutomaticSync check above guarantees this.dataSource is not null
        const dataSource = this.dataSource!;

        console.log(
          `🔄 [ExternalSync] AUTOMATIC SYNC - DEA ${aedId} transitions to automatic source: ` +
            `Previous: external_ref="${aed.external_reference}", source="${aed.source_origin}". ` +
            `New: external_ref="${record.externalId}", source="${dataSource.sourceOrigin}". ` +
            `Previous data saved in history.`
        );

        const mergeNote = {
          text:
            `DEA asumido por sincronización automática. ` +
            `Datos previos: external_reference="${aed.external_reference}", source_origin="${aed.source_origin}". ` +
            `Nuevos datos: external_reference="${record.externalId}", source_origin="${dataSource.sourceOrigin}".`,
          date: new Date().toISOString(),
          type: "automatic_sync_takeover",
          source: "ExternalSyncProcessor",
          metadata: {
            previous_external_ref: aed.external_reference,
            previous_source_origin: aed.source_origin,
            previous_data_source_id: aed.data_source_id,
            new_external_ref: record.externalId,
            new_source_origin: dataSource.sourceOrigin,
            new_data_source_id: config.dataSourceId,
            sync_frequency: dataSource.syncFrequency,
            raw_data: record.rawData,
          },
        };

        // Create audit trail in AedFieldChange
        // Using system UUID (all zeros) for automated operations
        try {
          await this.prisma.aedFieldChange.create({
            data: {
              aed_id: aedId,
              field_name: "source_origin_automatic_transition",
              old_value: `${aed.source_origin}:${aed.external_reference}`,
              new_value: `${dataSource.sourceOrigin}:${record.externalId}`,
              changed_by: SYSTEM_USER_UUID,
              change_source: "IMPORT",
            },
          });
        } catch (error) {
          console.warn(`⚠️ [ExternalSync] Could not create field change record:`, error);
        }

        // Update with new origin (takeover by automatic sync)
        await this.prisma.aed.update({
          where: { id: aedId },
          data: {
            internal_notes: [...existingNotes, mergeNote],
            external_reference: record.externalId, // ✅ Actualiza al nuevo
            source_origin: dataSource.sourceOrigin as SourceOrigin, // ✅ Cambia el origen
            data_source_id: config.dataSourceId,
            last_synced_at: new Date(),
          },
        });
      } else {
        // ==========================================
        // CASO 2: Importación Puntual/Manual
        // ==========================================
        // El DEA mantiene su source_origin original
        // Solo se registran los campos que se actualizaron
        console.log(
          `📝 [ExternalSync] MANUAL IMPORT - DEA ${aedId} updated but keeps original source: ` +
            `Keeping: external_ref="${aed.external_reference}", source="${aed.source_origin}". ` +
            `Updating fields from: external_ref="${record.externalId}", import_source="${config.dataSourceId}".`
        );

        const mergeNote = {
          text:
            `Actualizado por importación puntual. ` +
            `Se mantiene: external_reference="${aed.external_reference}", source_origin="${aed.source_origin}". ` +
            `Datos de importación: external_reference="${record.externalId}", fuente="${config.dataSourceId}".`,
          date: new Date().toISOString(),
          type: "manual_import_update",
          source: "ExternalSyncProcessor",
          metadata: {
            original_external_ref: aed.external_reference,
            original_source_origin: aed.source_origin,
            import_external_ref: record.externalId,
            import_data_source_id: config.dataSourceId,
            fields_to_update: [], // Se llenará más adelante con los campos realmente modificados
            raw_data: record.rawData,
          },
        };

        // Create audit trail in AedFieldChange
        // Using system UUID (all zeros) for automated operations
        try {
          await this.prisma.aedFieldChange.create({
            data: {
              aed_id: aedId,
              field_name: "manual_import_merge",
              old_value: aed.external_reference || "",
              new_value: record.externalId || "",
              changed_by: SYSTEM_USER_UUID,
              change_source: "IMPORT",
            },
          });
        } catch (error) {
          console.warn(`⚠️ [ExternalSync] Could not create field change record:`, error);
        }

        // Update with merge tracking pero SIN cambiar source_origin
        await this.prisma.aed.update({
          where: { id: aedId },
          data: {
            internal_notes: [...existingNotes, mergeNote],
            last_synced_at: new Date(),
            data_source_id: config.dataSourceId,
            // ❌ NO actualiza external_reference (mantiene el original)
            // ❌ NO actualiza source_origin (mantiene el original)
          },
        });
      }
    }

    // 🔒 PROTECTION: If AED is manually verified, ONLY update technical metadata
    if (aed.last_verified_at) {
      console.log(
        `🔒 [ExternalSync] AED ${aedId} ("${aed.name}") is manually verified. ` +
          `Updating ONLY technical metadata. Business data is PROTECTED.`
      );

      // Only update technical metadata for verified AEDs
      const verifiedUpdateData: VerifiedAedUpdateData = {
        data_source_id: config.dataSourceId,
        last_synced_at: new Date(),
      };

      // Only update external_reference if NOT merging (keep original for merges)
      if (!isMerging) {
        verifiedUpdateData.external_reference = record.externalId;
      }

      await this.prisma.aed.update({
        where: { id: aedId },
        data: verifiedUpdateData,
      });

      return; // Exit early - business data is protected
    }

    // ✅ NOT VERIFIED: Update all business data (normal sync behavior)
    console.log(`✅ [ExternalSync] AED ${aedId} is NOT verified. Updating all business data.`);

    // Combine location details from multiple fields
    const locationDetailsParts: string[] = [];
    if (record.additionalInfo) locationDetailsParts.push(record.additionalInfo);
    if (record.specificLocation) locationDetailsParts.push(record.specificLocation);
    const locationDetails = locationDetailsParts.join(". ").trim() || null;

    // Update location
    if (aed.location_id) {
      await this.prisma.aedLocation.update({
        where: { id: aed.location_id },
        data: {
          street_type: record.streetType,
          street_name: record.streetName,
          street_number: record.streetNumber,
          postal_code: record.postalCode,
          floor: record.floor,
          location_details: locationDetails,
          access_instructions: record.accessDescription,
          city_name: record.city,
          city_code: record.cityCode,
          district_name: record.district,
        },
      });
    }

    // Update or create schedule
    let scheduleIdUpdate: string | null | undefined = undefined;
    if (record.accessSchedule || record.scheduleDescription) {
      const scheduleDescription = record.accessSchedule || record.scheduleDescription;

      if (aed.schedule_id) {
        // Update existing schedule
        await this.prisma.aedSchedule.update({
          where: { id: aed.schedule_id },
          data: {
            description: scheduleDescription,
          },
        });
        console.log(`📝 [ExternalSync] Updated existing schedule`);
      } else {
        // Create new schedule
        const schedule = await this.prisma.aedSchedule.create({
          data: {
            description: scheduleDescription,
          },
        });
        scheduleIdUpdate = schedule.id;
        console.log(`📝 [ExternalSync] Created new schedule: ${scheduleDescription}`);
      }
    }

    // Update or create responsible
    let responsibleIdUpdate: string | null | undefined = undefined;
    if (
      record.ownershipType ||
      record.ownership ||
      record.submitterName ||
      record.submitterEmail ||
      record.submitterPhone
    ) {
      if (aed.responsible_id) {
        // Update existing responsible
        await this.prisma.aedResponsible.update({
          where: { id: aed.responsible_id },
          data: {
            name: record.submitterName || record.ownershipType || "Sin nombre",
            email: record.submitterEmail,
            phone: record.submitterPhone,
            ownership: record.ownershipType || record.ownership,
          },
        });
        console.log(`📝 [ExternalSync] Updated existing responsible`);
      } else {
        // Create new responsible
        const responsible = await this.prisma.aedResponsible.create({
          data: {
            name: record.submitterName || record.ownershipType || "Sin nombre",
            email: record.submitterEmail,
            phone: record.submitterPhone,
            ownership: record.ownershipType || record.ownership,
          },
        });
        responsibleIdUpdate = responsible.id;
        console.log(
          `📝 [ExternalSync] Created new responsible with ownership: ${record.ownershipType || record.ownership}`
        );
      }
    }

    // Prepare code field for update
    // 🔒 PROTECTION: Only assign code if AED doesn't have one already
    // Validated/manual codes always take precedence over automatic sync
    let codeUpdate: string | null | undefined = undefined;

    if (!aed.code && record.hasExternalReference()) {
      // AED has no code yet, assign from external source
      codeUpdate = record.externalId;
      console.log(
        `📝 [ExternalSync] Assigning code from externalId: ${codeUpdate} (AED had no code)`
      );
    } else if (aed.code) {
      console.log(
        `🔒 [ExternalSync] AED already has code: "${aed.code}". Protecting existing code from automatic update.`
      );
      // Don't update codeUpdate - keep it undefined to preserve existing code
    }

    // Prepare update data based on merge status and sync type
    const updateData: AedUpdateData = {
      schedule_id: scheduleIdUpdate,
      responsible_id: responsibleIdUpdate,
      last_synced_at: new Date(),
      data_source_id: config.dataSourceId,
    };

    // Determine update strategy based on merge and sync type
    if (isMerging && isAutomaticSync) {
      // ==========================================
      // CASO 1: Merge + Sincronización Automática
      // ==========================================
      // El DEA ahora "pertenece" a la fuente automática
      // Actualizar TODOS los campos (fuente autoritativa)
      console.log(`🔄 [ExternalSync] Automatic sync takeover: Updating ALL fields`);

      updateData.name = record.name || undefined;
      updateData.code = codeUpdate;
      updateData.establishment_type = record.establishmentType;
      updateData.latitude = record.latitude;
      updateData.longitude = record.longitude;
      updateData.external_reference = record.externalId;
      updateData.source_origin = this.dataSource!.sourceOrigin;
      updateData.source_details = JSON.stringify({
        current_source: this.dataSource!.sourceOrigin,
        previous_source: {
          origin: aed.source_origin,
          external_reference: aed.external_reference,
          data_source_id: aed.data_source_id,
        },
        raw_data: record.rawData,
      });
    } else if (isMerging && !isAutomaticSync) {
      // ==========================================
      // CASO 2: Merge + Importación Manual/Puntual
      // ==========================================
      // El DEA mantiene su origen, solo actualizar campos complementarios
      console.log(`📝 [ExternalSync] Manual import merge: Updating only complementary fields`);

      // Solo actualizar campos vacíos
      if (!aed.code && codeUpdate) {
        updateData.code = codeUpdate;
      }

      // Coordenadas solo si son más precisas
      if (record.latitude && record.longitude) {
        updateData.latitude = record.latitude;
        updateData.longitude = record.longitude;
      }

      // Tipo de establecimiento solo si está vacío
      if (record.establishmentType && !aed.establishment_type) {
        updateData.establishment_type = record.establishmentType;
      }

      // Guardar datos de importación en source_details sin sobrescribir
      updateData.source_details = JSON.stringify({
        original_source: aed.source_origin,
        original_external_ref: aed.external_reference,
        last_import: {
          external_reference: record.externalId,
          data_source_id: config.dataSourceId,
          imported_at: new Date().toISOString(),
          raw_data: record.rawData,
        },
      });

      // ❌ NO actualizar: source_origin, external_reference, name
    } else {
      // ==========================================
      // CASO 3: NO es merge (actualización normal)
      // ==========================================
      // Mismo external_reference o primera vez
      console.log(`✅ [ExternalSync] Normal update: Updating all business data`);

      updateData.name = record.name || undefined;
      updateData.code = codeUpdate;
      updateData.establishment_type = record.establishmentType;
      updateData.latitude = record.latitude;
      updateData.longitude = record.longitude;
      updateData.external_reference = record.externalId;
      updateData.source_details = JSON.stringify(record.rawData);

      // Solo actualizar source_origin si es automático Y no había uno previo
      if (isAutomaticSync && this.dataSource) {
        updateData.source_origin = this.dataSource.sourceOrigin;
      }
    }

    // Update AED
    await this.prisma.aed.update({
      where: { id: aedId },
      data: updateData,
    });
  }

  /**
   * Generate hash from ImportRecord for checkpoint
   */
  private generateImportRecordHash(record: ImportRecord): string {
    const data = JSON.stringify({
      name: record.name,
      lat: record.latitude,
      lng: record.longitude,
      externalId: record.externalId,
    });
    // Simple hash
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  /**
   * Detect the external ID field from a raw record
   */
  private detectExternalIdField(record: Record<string, unknown>): string {
    const keys = Object.keys(record);

    // Common ID field names
    const idCandidates = [
      "id",
      "codigo_dea",
      "id_dea",
      "external_id",
      "dea_id",
      "_id",
      "identificador",
    ];

    for (const candidate of idCandidates) {
      if (keys.includes(candidate)) {
        return candidate;
      }
    }

    // Fallback to first key or 'id'
    return keys[0] || "id";
  }

  async finalize(job: BatchJob): Promise<JobResult> {
    // Clean up S3 cache
    console.log(`🧹 [ExternalSync] Cleaning up S3 cache for job ${job.id}`);
    await this.s3Cache.deleteCache(job.id);

    // Update data source last sync time
    const config = job.config as ExternalSyncConfig;

    await this.prisma.externalDataSource.update({
      where: { id: config.dataSourceId },
      data: {
        last_sync_at: new Date(),
      },
    });

    return JobResult.fromProgress(job.progress)
      .withMetadata("dataSourceId", config.dataSourceId)
      .complete();
  }

  async cleanup(job: BatchJob): Promise<void> {
    // Clean up S3 cache on error/cancellation
    console.log(`🧹 [ExternalSync] Cleanup - removing S3 cache for job ${job.id}`);
    await this.s3Cache.deleteCache(job.id);

    // Clear adapter, data source, and cached field
    this.adapter = null;
    this.dataSource = null;
    this.externalIdFieldCache = null;
  }

  async preview(
    config: ExternalSyncConfig,
    limit: number = 5
  ): Promise<{
    sampleRecords: Record<string, unknown>[];
    totalCount: number;
  }> {
    const dataSource = await this.dataSourceRepository.findById(config.dataSourceId);

    if (!dataSource) {
      return { sampleRecords: [], totalCount: 0 };
    }

    const adapter = DataSourceAdapterFactory.getApiAdapter(
      dataSource.type as "CKAN_API" | "JSON_FILE" | "REST_API" | "CSV_FILE"
    );

    const records = await adapter.getPreview(dataSource.config, limit);

    const totalCount = await adapter.getRecordCount(dataSource.config);

    return {
      sampleRecords: records.map((r) => r.toJSON()),
      totalCount,
    };
  }
}
