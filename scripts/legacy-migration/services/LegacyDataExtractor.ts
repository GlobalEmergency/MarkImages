/**
 * Legacy Data Extractor Service
 * Extracts data from legacy PostgreSQL database
 * Infrastructure Layer - Repository
 */

import { PrismaClient } from "../../../src/generated/client";
import type { LegacyDeaRecord, LegacyVerificationSession } from "../types";

export interface LegacyRecordWithSession {
  record: LegacyDeaRecord;
  verificationSession: LegacyVerificationSession | null;
}

export class LegacyDataExtractor {
  private legacyDb: PrismaClient;

  constructor(legacyDb: PrismaClient) {
    // Receive already instantiated PrismaClient for legacy database
    this.legacyDb = legacyDb;
  }

  /**
   * Get all DEA records that haven't been migrated yet
   * Uses external_reference in current DB to track migrated records
   */
  async getRecordsToMigrate(alreadyMigratedIds: number[]): Promise<LegacyRecordWithSession[]> {
    const query = `
      SELECT 
        dr.*,
        vs.id as vs_id,
        vs.status as vs_status,
        vs.original_image_url,
        vs.cropped_image_url,
        vs.processed_image_url,
        vs.second_image_url,
        vs.second_cropped_image_url,
        vs.second_processed_image_url,
        vs.created_at as vs_created_at,
        vs.updated_at as vs_updated_at,
        vs.completed_at as vs_completed_at,
        vs.image1_valid,
        vs.image2_valid,
        vs.images_swapped,
        vs.marked_as_invalid
      FROM dea_records dr
      LEFT JOIN LATERAL (
        SELECT *
        FROM verification_sessions vs
        WHERE vs.dea_record_id = dr.id
        ORDER BY 
          CASE 
            WHEN vs.status = 'verified' THEN 1
            WHEN vs.status = 'pending' THEN 2
            WHEN vs.status = 'in_progress' THEN 3
            ELSE 4
          END,
          vs.created_at DESC
        LIMIT 1
      ) vs ON true
      WHERE dr.id NOT IN (${alreadyMigratedIds.length > 0 ? alreadyMigratedIds.join(",") : "0"})
      ORDER BY dr.id ASC
    `;

    const results = (await this.legacyDb.$queryRawUnsafe(query)) as any[];

    return results.map((row: any) => ({
      record: this.mapRowToLegacyDeaRecord(row),
      verificationSession: row.vs_id ? this.mapRowToVerificationSession(row) : null,
    }));
  }

  /**
   * Get total count of records in legacy database
   */
  async getTotalRecordsCount(): Promise<number> {
    const result = (await this.legacyDb.$queryRawUnsafe(
      "SELECT COUNT(*) as count FROM dea_records"
    )) as Array<{ count: bigint }>;
    return Number(result[0].count);
  }

  /**
   * Get count of already migrated records
   */
  async getMigratedRecordsCount(alreadyMigratedIds: number[]): Promise<number> {
    return alreadyMigratedIds.length;
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    await this.legacyDb.$disconnect();
  }

  // ============================================
  // PRIVATE MAPPING METHODS
  // ============================================

  private mapRowToLegacyDeaRecord(row: any): LegacyDeaRecord {
    return {
      id: row.id,
      horaInicio: row.horaInicio,
      horaFinalizacion: row.horaFinalizacion,
      correoElectronico: row.correoElectronico,
      nombre: row.nombre,
      numeroProvisionalDea: row.numeroProvisionalDea,
      tipoEstablecimiento: row.tipoEstablecimiento,
      titularidadLocal: row.titularidadLocal,
      usoLocal: row.usoLocal,
      titularidad: row.titularidad,
      propuestaDenominacion: row.propuestaDenominacion,

      // Campos originales
      tipoVia: row.tipoVia,
      nombreVia: row.nombreVia,
      numeroVia: row.numeroVia,
      complementoDireccion: row.complementoDireccion,
      codigoPostal: row.codigoPostal,
      distrito: row.distrito,
      latitud: row.latitud,
      longitud: row.longitud,

      // Campos definitivos (los que usaremos)
      defTipoVia: row.defTipoVia,
      defNombreVia: row.defNombreVia,
      defNumero: row.defNumero,
      defCp: row.defCp,
      defDistrito: row.defDistrito,
      defLat: row.defLat,
      defLon: row.defLon,
      defCodDea: row.defCodDea,
      defBarrio: row.defBarrio,

      // Campos GM
      gmTipoVia: row.gmTipoVia,
      gmNombreVia: row.gmNombreVia,
      gmNumero: row.gmNumero,
      gmCp: row.gmCp,
      gmDistrito: row.gmDistrito,
      gmLat: row.gmLat,
      gmLon: row.gmLon,
      gmBarrio: row.gmBarrio,

      // Horarios
      horarioApertura: row.horarioApertura,
      aperturaLunesViernes: row.aperturaLunesViernes,
      cierreLunesViernes: row.cierreLunesViernes,
      aperturaSabados: row.aperturaSabados,
      cierreSabados: row.cierreSabados,
      aperturaDomingos: row.aperturaDomingos,
      cierreDomingos: row.cierreDomingos,
      vigilante24h: row.vigilante24h,

      // Imágenes
      foto1: row.foto1,
      foto2: row.foto2,

      // Observaciones
      descripcionAcceso: row.descripcionAcceso,
      comentarioLibre: row.comentarioLibre,

      // Estados
      image_verification_status: row.image_verification_status,
      address_validation_status: row.address_validation_status,

      // Timestamps
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private mapRowToVerificationSession(row: any): LegacyVerificationSession {
    return {
      id: row.vs_id,
      dea_record_id: row.id,
      status: row.vs_status,
      original_image_url: row.original_image_url,
      cropped_image_url: row.cropped_image_url,
      processed_image_url: row.processed_image_url,
      second_image_url: row.second_image_url,
      second_cropped_image_url: row.second_cropped_image_url,
      second_processed_image_url: row.second_processed_image_url,
      created_at: row.vs_created_at,
      updated_at: row.vs_updated_at,
      completed_at: row.vs_completed_at,
      image1_valid: row.image1_valid,
      image2_valid: row.image2_valid,
      images_swapped: row.images_swapped,
      marked_as_invalid: row.marked_as_invalid,
    };
  }
}
