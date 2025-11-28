/**
 * Implementación del repositorio de importación con Prisma
 * Capa de Infraestructura
 */

import { PrismaClient } from "@prisma/client";
import {
  IImportRepository,
  CreateImportBatchData,
  ImportBatchInfo,
  CreateAedFromCsvData,
  ImportErrorData,
} from "@/domain/import/ports/IImportRepository";

export class PrismaImportRepository implements IImportRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createBatch(data: CreateImportBatchData): Promise<string> {
    const batch = await this.prisma.importBatch.create({
      data: {
        name: data.name,
        description: data.description,
        source_origin: data.sourceOrigin as any,
        file_name: data.fileName,
        total_records: data.totalRecords,
        imported_by: data.importedBy,
        status: "PENDING",
      },
    });

    return batch.id;
  }

  async updateBatchStatus(
    batchId: string,
    status: string,
    stats?: {
      successfulRecords?: number;
      failedRecords?: number;
      startedAt?: Date;
      completedAt?: Date;
    }
  ): Promise<void> {
    await this.prisma.importBatch.update({
      where: { id: batchId },
      data: {
        status: status as any,
        successful_records: stats?.successfulRecords,
        failed_records: stats?.failedRecords,
        started_at: stats?.startedAt,
        completed_at: stats?.completedAt,
      },
    });
  }

  async getBatchInfo(batchId: string): Promise<ImportBatchInfo | null> {
    const batch = await this.prisma.importBatch.findUnique({
      where: { id: batchId },
    });

    if (!batch) {
      return null;
    }

    return {
      id: batch.id,
      name: batch.name,
      status: batch.status,
      totalRecords: batch.total_records,
      successfulRecords: batch.successful_records,
      failedRecords: batch.failed_records,
      createdAt: batch.created_at,
      startedAt: batch.started_at,
      completedAt: batch.completed_at,
    };
  }

  async createAedFromCsv(data: CreateAedFromCsvData): Promise<string> {
    const { csvRow, batchId, districtId, latitude, longitude, addressValidationFailed, imageUrls } =
      data;

    // Crear el AED con todas sus relaciones en una transacción
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Crear o buscar responsible
      let responsible = await tx.aedResponsible.findFirst({
        where: {
          email: csvRow.submitterEmail || undefined,
        },
      });

      if (!responsible) {
        responsible = await tx.aedResponsible.create({
          data: {
            name: csvRow.submitterName || "Sin nombre",
            email: csvRow.submitterEmail || null,
            ownership: csvRow.ownership || null,
            local_ownership: csvRow.localOwnership || null,
            local_use: csvRow.localUse || null,
          },
        });
      }

      // 2. Crear location
      const location = await tx.aedLocation.create({
        data: {
          street_type: csvRow.streetType || undefined,
          street_name: csvRow.streetName || undefined,
          street_number: csvRow.streetNumber || undefined,
          additional_info: csvRow.additionalInfo || undefined,
          postal_code: csvRow.postalCode || undefined,
          latitude: latitude ?? undefined,
          longitude: longitude ?? undefined,
          district_id: districtId ?? undefined,
          access_description: csvRow.accessDescription || undefined,
        },
      });

      // 3. Crear schedule
      const schedule = await tx.aedSchedule.create({
        data: {
          description: csvRow.scheduleDescription || undefined,
          has_24h_surveillance: csvRow.has24hSurveillance,
          weekday_opening: csvRow.weekdayOpening || undefined,
          weekday_closing: csvRow.weekdayClosing || undefined,
          saturday_opening: csvRow.saturdayOpening || undefined,
          saturday_closing: csvRow.saturdayClosing || undefined,
          sunday_opening: csvRow.sundayOpening || undefined,
          sunday_closing: csvRow.sundayClosing || undefined,
        },
      });

      // 4. Crear AED
      const aedData: any = {
        name: csvRow.proposedName || "Sin nombre",
        provisional_number: csvRow.provisionalNumber ? parseInt(csvRow.provisionalNumber) : undefined,
        establishment_type: csvRow.establishmentType || undefined,
        status: "DRAFT",
        source_origin: "CSV_IMPORT",
        import_batch_id: batchId,
        external_reference: csvRow.id,
        location_id: location.id,
        responsible_id: responsible.id,
        schedule_id: schedule.id,
        requires_attention: true,
        attention_reason: addressValidationFailed
          ? "Imported - Address validation failed"
          : "Imported - Pending verification",
        origin_observations: JSON.stringify(csvRow.toJSON()),
      };

      if (latitude !== null) aedData.latitude = latitude;
      if (longitude !== null) aedData.longitude = longitude;

      const aed = await tx.aed.create({ data: aedData });

      // 5. Crear imágenes si existen
      if (imageUrls.length > 0) {
        await tx.aedImage.createMany({
          data: imageUrls.map((img, index) => ({
            aed_id: aed.id,
            type: img.type as any,
            order: index + 1,
            original_url: img.url,
            is_verified: false,
          })),
        });
      }

      return aed.id;
    });

    return result;
  }

  async logImportError(error: ImportErrorData): Promise<void> {
    await this.prisma.importError.create({
      data: {
        import_batch_id: error.batchId,
        row_number: error.rowNumber,
        error_type: error.errorType as any,
        error_message: error.errorMessage,
        severity: error.severity as any,
        row_data: error.rowData ? (error.rowData as any) : undefined,
      },
    });
  }
}
