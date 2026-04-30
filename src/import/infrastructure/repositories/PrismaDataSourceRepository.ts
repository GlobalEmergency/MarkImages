/**
 * Implementación del repositorio de fuentes de datos con Prisma
 * Capa de Infraestructura - Implementa IDataSourceRepository
 */

import type { PrismaClient } from "@/generated/client/client";
import type {
  IDataSourceRepository,
  CreateDataSourceData,
  UpdateDataSourceData,
  DataSourceFilters,
  PaginationOptions,
  PaginatedResult,
  DataSourceStats,
} from "@/import/domain/ports/IDataSourceRepository";
import type {
  ExternalDataSourceConfig,
  DataSourceConfig,
  DataSourceType,
  MatchingStrategy,
  SyncFrequency,
} from "@/import/domain/ports/IDataSourceAdapter";
import type { ColumnMapping } from "@/import/domain/value-objects/ColumnMapping";
import type {
  DataSourceType as PrismaDataSourceType,
  SourceOrigin as PrismaSourceOrigin,
  MatchingStrategy as PrismaMatchingStrategy,
  SyncFrequency as PrismaSyncFrequency,
} from "@/generated/client/enums";
import type { ExternalDataSourceModel } from "@/generated/client/models/ExternalDataSource";
import type { InputJsonValue } from "@/generated/client/internal/prismaNamespace";

export class PrismaDataSourceRepository implements IDataSourceRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: CreateDataSourceData): Promise<string> {
    const dataSource = await this.prisma.externalDataSource.create({
      data: {
        name: data.name,
        description: data.description,
        type: data.type as PrismaDataSourceType,
        config: data.config as unknown as InputJsonValue,
        source_origin: data.sourceOrigin as PrismaSourceOrigin,
        region_code: data.regionCode,
        matching_strategy: (data.matchingStrategy as PrismaMatchingStrategy) || "HYBRID",
        matching_threshold: data.matchingThreshold || 75,
        sync_frequency: (data.syncFrequency as PrismaSyncFrequency) || "MANUAL",
        auto_deactivate_missing: data.autoDeactivateMissing || false,
        auto_update_fields: data.autoUpdateFields || [],
        created_by: data.createdBy,
      },
    });

    return dataSource.id;
  }

  async findById(id: string): Promise<ExternalDataSourceConfig | null> {
    const dataSource = await this.prisma.externalDataSource.findUnique({
      where: { id },
    });

    if (!dataSource) return null;

    return this.mapToConfig(dataSource);
  }

  async findByName(name: string): Promise<ExternalDataSourceConfig | null> {
    const dataSource = await this.prisma.externalDataSource.findUnique({
      where: { name },
    });

    if (!dataSource) return null;

    return this.mapToConfig(dataSource);
  }

  async findAll(
    filters?: DataSourceFilters,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<ExternalDataSourceConfig>> {
    const page = pagination?.page || 1;
    const limit = pagination?.limit || 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (filters?.type) where.type = filters.type;
    if (filters?.isActive !== undefined) where.is_active = filters.isActive;
    if (filters?.regionCode) where.region_code = filters.regionCode;
    if (filters?.sourceOrigin) where.source_origin = filters.sourceOrigin;
    if (filters?.syncFrequency) where.sync_frequency = filters.syncFrequency;

    const orderBy: Record<string, unknown> = {};
    const orderField = pagination?.orderBy || "createdAt";
    const orderDir = pagination?.orderDirection || "desc";

    switch (orderField) {
      case "name":
        orderBy.name = orderDir;
        break;
      case "lastSyncAt":
        orderBy.last_sync_at = orderDir;
        break;
      case "nextScheduledSyncAt":
        orderBy.next_scheduled_sync_at = orderDir;
        break;
      default:
        orderBy.created_at = orderDir;
    }

    const [dataSources, total] = await Promise.all([
      this.prisma.externalDataSource.findMany({
        where,
        orderBy,
        skip,
        take: limit,
      }),
      this.prisma.externalDataSource.count({ where }),
    ]);

    return {
      data: dataSources.map((ds) => this.mapToConfig(ds)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async update(id: string, data: UpdateDataSourceData): Promise<void> {
    const updateData: Record<string, unknown> = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.config !== undefined) updateData.config = data.config;
    if (data.matchingStrategy !== undefined) updateData.matching_strategy = data.matchingStrategy;
    if (data.matchingThreshold !== undefined)
      updateData.matching_threshold = data.matchingThreshold;
    if (data.isActive !== undefined) updateData.is_active = data.isActive;
    if (data.syncFrequency !== undefined) updateData.sync_frequency = data.syncFrequency;
    if (data.autoDeactivateMissing !== undefined)
      updateData.auto_deactivate_missing = data.autoDeactivateMissing;
    if (data.autoUpdateFields !== undefined) updateData.auto_update_fields = data.autoUpdateFields;

    await this.prisma.externalDataSource.update({
      where: { id },
      data: updateData,
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.externalDataSource.delete({
      where: { id },
    });
  }

  async updateLastSync(id: string, syncedAt: Date): Promise<void> {
    await this.prisma.externalDataSource.update({
      where: { id },
      data: {
        last_sync_at: syncedAt,
      },
    });
  }

  async updateNextScheduledSync(id: string, nextSyncAt: Date | null): Promise<void> {
    await this.prisma.externalDataSource.update({
      where: { id },
      data: {
        next_scheduled_sync_at: nextSyncAt,
      },
    });
  }

  async findDueForSync(): Promise<ExternalDataSourceConfig[]> {
    const now = new Date();

    const dataSources = await this.prisma.externalDataSource.findMany({
      where: {
        is_active: true,
        sync_frequency: { not: "MANUAL" },
        next_scheduled_sync_at: { lte: now },
      },
    });

    return dataSources.map((ds) => this.mapToConfig(ds));
  }

  async getStats(id: string): Promise<DataSourceStats> {
    const [batches, lastBatch] = await Promise.all([
      this.prisma.batchJob.groupBy({
        by: ["status"],
        where: { data_source_id: id },
        _count: { id: true },
        _sum: { successful_records: true, duration_seconds: true },
      }),
      this.prisma.batchJob.findFirst({
        where: { data_source_id: id },
        orderBy: { created_at: "desc" },
        select: {
          successful_records: true,
          failed_records: true,
          duration_seconds: true,
        },
      }),
    ]);

    let totalSyncs = 0;
    let successfulSyncs = 0;
    let failedSyncs = 0;
    let totalRecordsImported = 0;
    let totalDuration = 0;

    for (const batch of batches) {
      totalSyncs += batch._count.id;
      totalRecordsImported += batch._sum.successful_records || 0;
      totalDuration += batch._sum.duration_seconds || 0;

      if (batch.status === "COMPLETED") {
        successfulSyncs += batch._count.id;
      } else if (batch.status === "FAILED") {
        failedSyncs += batch._count.id;
      }
    }

    return {
      totalSyncs,
      successfulSyncs,
      failedSyncs,
      totalRecordsImported,
      lastSyncRecords: lastBatch?.successful_records || 0,
      averageSyncDuration: totalSyncs > 0 ? (totalDuration / totalSyncs) * 1000 : 0,
    };
  }

  async existsByName(name: string, excludeId?: string): Promise<boolean> {
    const where: Record<string, unknown> = { name };
    if (excludeId) {
      where.id = { not: excludeId };
    }

    const count = await this.prisma.externalDataSource.count({ where });
    return count > 0;
  }

  /**
   * Mapea el modelo de Prisma a la configuración de dominio
   * Construye un DataSourceConfig completo incluyendo el type
   */
  private mapToConfig(ds: ExternalDataSourceModel): ExternalDataSourceConfig {
    // Construir DataSourceConfig completo con type y campos normalizados
    const rawConfig = (ds.config ?? {}) as Record<string, unknown>;
    const config = {
      type: ds.type as DataSourceType,
      // Para CKAN_API / REST_API
      apiEndpoint: rawConfig.apiEndpoint as string | undefined,
      baseUrl: rawConfig.baseUrl as string | undefined,
      resourceId: rawConfig.resourceId as string | undefined,
      pageSize: rawConfig.pageSize as number | undefined,
      // Normalizar fieldMapping -> fieldMappings
      fieldMappings: (rawConfig.fieldMappings || rawConfig.fieldMapping) as
        | Record<string, string>
        | undefined,
      fieldTransformers: rawConfig.fieldTransformers as
        | Record<string, string | string[]>
        | undefined,
      // Para JSON_FILE - fileUrl puede ser usado como alternativa a apiEndpoint
      fileUrl: (rawConfig.fileUrl || rawConfig.apiEndpoint) as string | undefined,
      jsonPath: rawConfig.jsonPath as string | undefined,
      csvDelimiter: rawConfig.csvDelimiter as string | undefined,
      encoding: rawConfig.encoding as string | undefined,
      externalIdField: rawConfig.externalIdField as string | undefined,
      // Para REST_API
      authToken: rawConfig.authToken as string | undefined,
      headers: rawConfig.headers as Record<string, string> | undefined,
      method: rawConfig.method as "GET" | "POST" | undefined,
      requestBody: rawConfig.requestBody,
      pagination: rawConfig.pagination as DataSourceConfig["pagination"] | undefined,
      responseDataPath: rawConfig.responseDataPath as string | undefined,
      // Para CSV_FILE
      filePath: rawConfig.filePath as string | undefined,
      columnMappings: rawConfig.columnMappings as ColumnMapping[] | undefined,
    };

    return {
      id: ds.id,
      name: ds.name,
      description: ds.description ?? undefined,
      type: ds.type as DataSourceType,
      config,
      sourceOrigin: ds.source_origin as string,
      countryCode: ((ds as Record<string, unknown>).country_code as string) || "ES",
      regionCode: ds.region_code ?? "",
      matchingStrategy: ds.matching_strategy as MatchingStrategy,
      matchingThreshold: ds.matching_threshold,
      isActive: ds.is_active,
      syncFrequency: ds.sync_frequency as SyncFrequency,
      lastSyncAt: ds.last_sync_at ?? undefined,
      nextScheduledSyncAt: ds.next_scheduled_sync_at ?? undefined,
      autoDeactivateMissing: ds.auto_deactivate_missing,
      autoUpdateFields: (ds.auto_update_fields as string[]) || [],
      createdAt: ds.created_at,
      updatedAt: ds.updated_at,
      createdBy: ds.created_by ?? undefined,
    };
  }
}
