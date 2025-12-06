/**
 * Caso de uso: Generar exportación de AEDs a CSV
 * Application Layer
 */

import { createHash } from "crypto";

import { PrismaClient } from "@/generated/client/client";

import { IExportRepository } from "@/domain/export/ports/IExportRepository";
import { aedsToCsv, generateExportFilename } from "@/lib/csv-export";
import { uploadToS3 } from "@/lib/s3";

interface GenerateExportParams {
  batchId: string;
}

interface AedForExport {
  id?: string | null;
  status?: string | null;
  provisional_number?: number | null;
  code?: string | null;
  establishment_type?: string | null;
  name: string;
  latitude?: number | null;
  longitude?: number | null;
  internal_notes?: string | null;
  origin_observations?: string | null;
  location?: {
    street_type?: string | null;
    street_name?: string | null;
    street_number?: string | null;
    postal_code?: string | null;
    city_name?: string | null;
    district_name?: string | null;
    neighborhood_name?: string | null;
  } | null;
  schedule?: {
    has_24h_surveillance: boolean;
    weekday_opening?: string | null;
    weekday_closing?: string | null;
    saturday_opening?: string | null;
    saturday_closing?: string | null;
    sunday_opening?: string | null;
    sunday_closing?: string | null;
  } | null;
  responsible?: {
    name?: string | null;
    ownership?: string | null;
    local_ownership?: string | null;
    local_use?: string | null;
  } | null;
}

export class GenerateExportUseCase {
  constructor(
    private readonly exportRepository: IExportRepository,
    private readonly prisma: PrismaClient
  ) {}

  async execute(params: GenerateExportParams): Promise<void> {
    const { batchId } = params;

    try {
      // 1. Obtener información del batch
      const batch = await this.exportRepository.getBatchInfo(batchId);
      if (!batch) {
        throw new Error(`Export batch ${batchId} not found`);
      }

      // 2. Marcar como en progreso
      await this.exportRepository.updateBatch(batchId, {
        status: "IN_PROGRESS",
        startedAt: new Date(),
      });

      const startTime = Date.now();

      // 3. Construir query con filtros
      const filters = batch.filters || {};
      const where: any = {};

      if (filters.status && filters.status.length > 0) {
        where.status = { in: filters.status };
      }

      if (filters.sourceOrigin) {
        where.source_origin = filters.sourceOrigin;
      }

      if (filters.importBatchId) {
        where.import_batch_id = filters.importBatchId;
      }

      if (filters.cityName) {
        where.location = {
          city_name: {
            contains: filters.cityName,
            mode: "insensitive",
          },
        };
      }

      // 4. Consultar AEDs
      const aeds = await this.prisma.aed.findMany({
        where,
        include: {
          location: true,
          schedule: true,
          responsible: true,
        },
        orderBy: [{ code: "asc" }, { created_at: "desc" }],
      });

      // 5. Convertir a formato para export
      const aedsForExport: AedForExport[] = aeds.map((aed) => ({
        id: aed.id,
        status: aed.status,
        provisional_number: aed.provisional_number,
        code: aed.code,
        establishment_type: aed.establishment_type,
        name: aed.name,
        latitude: aed.latitude,
        longitude: aed.longitude,
        internal_notes: aed.internal_notes,
        origin_observations: aed.origin_observations,
        location: aed.location
          ? {
              street_type: aed.location.street_type,
              street_name: aed.location.street_name,
              street_number: aed.location.street_number,
              postal_code: aed.location.postal_code,
              city_name: aed.location.city_name,
              district_name: aed.location.district_name,
              neighborhood_name: aed.location.neighborhood_name,
            }
          : null,
        schedule: aed.schedule
          ? {
              has_24h_surveillance: aed.schedule.has_24h_surveillance,
              weekday_opening: aed.schedule.weekday_opening,
              weekday_closing: aed.schedule.weekday_closing,
              saturday_opening: aed.schedule.saturday_opening,
              saturday_closing: aed.schedule.saturday_closing,
              sunday_opening: aed.schedule.sunday_opening,
              sunday_closing: aed.schedule.sunday_closing,
            }
          : null,
        responsible: aed.responsible
          ? {
              name: aed.responsible.name,
              ownership: aed.responsible.ownership,
              local_ownership: aed.responsible.local_ownership,
              local_use: aed.responsible.local_use,
            }
          : null,
      }));

      // 6. Generar CSV
      const csvContent = aedsToCsv(aedsForExport);
      const csvBuffer = Buffer.from("\uFEFF" + csvContent, "utf-8"); // BOM + content

      // 7. Calcular hash del archivo
      const fileHash = createHash("sha256").update(csvBuffer).digest("hex");

      // 8. Generar nombre de archivo
      const fileName = generateExportFilename(filters);

      // 9. Subir a S3
      const fileUrl = await uploadToS3({
        buffer: csvBuffer,
        filename: fileName,
        contentType: "text/csv;charset=utf-8",
        prefix: "exports",
      });

      const endTime = Date.now();
      const durationSeconds = Math.floor((endTime - startTime) / 1000);

      // 10. Actualizar batch con éxito
      await this.exportRepository.updateBatch(batchId, {
        status: "COMPLETED",
        fileName,
        fileUrl,
        fileSize: csvBuffer.length,
        fileHash,
        totalRecords: aeds.length,
        successfulRecords: aeds.length,
        failedRecords: 0,
        completedAt: new Date(),
        durationSeconds,
      });
    } catch (error) {
      // Marcar como fallido
      await this.exportRepository.updateBatch(batchId, {
        status: "FAILED",
        errorMessage: error instanceof Error ? error.message : "Unknown error occurred",
        errorDetails: {
          error: error instanceof Error ? error.stack : String(error),
          timestamp: new Date().toISOString(),
        },
        completedAt: new Date(),
      });

      throw error;
    }
  }
}
