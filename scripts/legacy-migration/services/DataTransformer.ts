/**
 * Data Transformer Service
 * Transforms legacy DEA records to current architecture
 * Domain Layer - Service
 */

import type {
  LegacyDeaRecord,
  LegacyVerificationSession,
  TransformedAed,
  AedData,
  LocationData,
  ScheduleData,
  ResponsibleData,
  ValidationData,
  AddressValidationData,
} from "../types";

export class DataTransformer {
  /**
   * Transform a legacy DEA record to current architecture format
   */
  transform(
    legacyRecord: LegacyDeaRecord,
    verificationSession: LegacyVerificationSession | null
  ): TransformedAed {
    return {
      aed: this.transformAed(legacyRecord, verificationSession),
      location: this.transformLocation(legacyRecord),
      schedule: this.transformSchedule(legacyRecord),
      responsible: this.transformResponsible(legacyRecord),
      images: [], // Images will be processed separately
      validations: this.transformValidations(legacyRecord, verificationSession),
      addressValidation: this.transformAddressValidation(legacyRecord),
    };
  }

  private transformAed(record: LegacyDeaRecord, vs: LegacyVerificationSession | null): AedData {
    return {
      code: this.sanitizeString(record.defCodDea),
      name: record.propuestaDenominacion || "Sin nombre",
      establishment_type: this.sanitizeString(record.tipoEstablecimiento),
      provisional_number: record.numeroProvisionalDea || null,
      status: this.mapImageVerificationStatus(record.image_verification_status),
      source_origin: "LEGACY_MIGRATION",
      external_reference: record.id.toString(),
      latitude: this.sanitizeCoordinate(record.defLat),
      longitude: this.sanitizeCoordinate(record.defLon),
      internal_notes: this.buildInternalNotes(record),
      origin_observations: this.buildOriginObservations(record, vs),
    };
  }

  private transformLocation(record: LegacyDeaRecord): LocationData {
    return {
      street_type: this.sanitizeString(record.defTipoVia) || "CALLE",
      street_name: this.sanitizeString(record.defNombreVia) || "",
      street_number: this.sanitizeString(record.defNumero),
      postal_code: this.sanitizeString(record.defCp) || "",
      latitude: this.sanitizeCoordinate(record.defLat) || 0,
      longitude: this.sanitizeCoordinate(record.defLon) || 0,
      district_name: this.sanitizeString(record.defDistrito),
      district_code: this.sanitizeString(record.defDistrito),
      neighborhood_name: this.sanitizeString(record.defBarrio),
      neighborhood_code: this.sanitizeString(record.defBarrio),
      city_name: "Madrid",
      city_code: null,
      access_description: this.sanitizeString(record.descripcionAcceso),
    };
  }

  private transformSchedule(record: LegacyDeaRecord): ScheduleData {
    return {
      description: this.sanitizeString(record.horarioApertura),
      has_24h_surveillance: record.vigilante24h === "Sí",
      weekday_opening: this.formatTime(record.aperturaLunesViernes),
      weekday_closing: this.formatTime(record.cierreLunesViernes),
      saturday_opening: this.formatTime(record.aperturaSabados),
      saturday_closing: this.formatTime(record.cierreSabados),
      sunday_opening: this.formatTime(record.aperturaDomingos),
      sunday_closing: this.formatTime(record.cierreDomingos),
    };
  }

  private transformResponsible(record: LegacyDeaRecord): ResponsibleData {
    const organizationName = this.sanitizeString(record.titularidad);

    return {
      name: organizationName || "Sin titular",
      organization: organizationName,
      ownership: this.sanitizeString(record.titularidadLocal),
      local_use: this.sanitizeString(record.usoLocal),
      observations: this.buildResponsibleObservations(record),
    };
  }

  private transformValidations(
    record: LegacyDeaRecord,
    vs: LegacyVerificationSession | null
  ): ValidationData[] {
    const validations: ValidationData[] = [];

    // Address Validation
    validations.push({
      type: "ADDRESS",
      status: this.mapAddressValidationStatus(record.address_validation_status),
      verified_by: record.correoElectronico || null,
      completed_at: vs?.completed_at ? new Date(vs.completed_at) : null,
    });

    // Images Validation
    validations.push({
      type: "IMAGES",
      status: this.mapImageValidationStatusForValidation(record.image_verification_status),
      verified_by: record.correoElectronico || null,
      completed_at: vs?.completed_at ? new Date(vs.completed_at) : null,
    });

    return validations;
  }

  private transformAddressValidation(record: LegacyDeaRecord): AddressValidationData {
    const hasValidAddress =
      record.address_validation_status === "completed" ||
      record.address_validation_status === "validated";

    return {
      address_found: hasValidAddress,
      match_level: hasValidAddress ? 1.0 : 0.0,
      match_type: hasValidAddress ? "EXACT" : "NOT_FOUND",
      suggested_latitude: this.sanitizeCoordinate(record.defLat),
      suggested_longitude: this.sanitizeCoordinate(record.defLon),
      official_district_id: this.parseDistrictId(record.defDistrito),
      official_neighborhood_id: this.parseNeighborhoodId(record.defBarrio),
    };
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  private sanitizeString(value: string | null | undefined): string | null {
    if (!value) return null;
    if (value === "\\N" || value === "." || value.trim() === "") return null;
    return value.trim();
  }

  private sanitizeCoordinate(value: number | null | undefined): number | null {
    if (!value) return null;
    // Detect invalid placeholder coordinates
    if (value === 40.3 || value === -3.9 || value === 0) return null;
    return value;
  }

  private parseDistrictId(value: string | null | undefined): number | null {
    if (!value) return null;
    const parsed = parseInt(value);
    return isNaN(parsed) ? null : parsed;
  }

  private parseNeighborhoodId(value: string | null | undefined): number | null {
    if (!value) return null;
    const parsed = parseInt(value);
    return isNaN(parsed) ? null : parsed;
  }

  private formatTime(hour: number | null | undefined): string | null {
    if (!hour || hour === 0) return null;
    // Convert hour to HH:MM format
    return `${hour.toString().padStart(2, "0")}:00`;
  }

  private mapImageVerificationStatus(
    status: string
  ): "DRAFT" | "PENDING_REVIEW" | "PUBLISHED" | "INACTIVE" {
    switch (status) {
      case "verified":
      case "valid":
        return "PUBLISHED";
      case "in_progress":
      case "pending_review":
        return "PENDING_REVIEW";
      case "rejected":
      case "invalid":
        return "INACTIVE";
      case "pending":
      default:
        return "DRAFT";
    }
  }

  private mapImageValidationStatusForValidation(
    status: string
  ): "PENDING" | "IN_PROGRESS" | "COMPLETED" | "REJECTED" {
    switch (status) {
      case "verified":
      case "valid":
        return "COMPLETED";
      case "in_progress":
      case "pending_review":
        return "IN_PROGRESS";
      case "rejected":
      case "invalid":
        return "REJECTED";
      case "pending":
      default:
        return "PENDING";
    }
  }

  private mapAddressValidationStatus(
    status: string
  ): "PENDING" | "IN_PROGRESS" | "COMPLETED" | "REJECTED" {
    switch (status) {
      case "completed":
      case "validated":
        return "COMPLETED";
      case "in_progress":
      case "pending_review":
        return "IN_PROGRESS";
      case "failed":
      case "invalid":
        return "REJECTED";
      case "pending":
      default:
        return "PENDING";
    }
  }

  private buildInternalNotes(record: LegacyDeaRecord): string {
    const lines = [
      "=== LEGACY MIGRATION DATA ===",
      `Provisional Number: ${record.numeroProvisionalDea}`,
      `Legacy ID: ${record.id}`,
      "",
      "--- Review Information ---",
      `Reviewed by: ${record.nombre}`,
      `Email: ${record.correoElectronico}`,
      `Review period: ${record.horaInicio} to ${record.horaFinalizacion}`,
      "",
      "--- Validation Status ---",
      `Image verification: ${record.image_verification_status}`,
      `Address validation: ${record.address_validation_status}`,
    ];

    const comments = this.sanitizeString(record.comentarioLibre);
    if (comments) {
      lines.push("", "--- Comments ---", comments);
    }

    return lines.join("\n");
  }

  private buildOriginObservations(
    record: LegacyDeaRecord,
    vs: LegacyVerificationSession | null
  ): string {
    return JSON.stringify({
      legacy_id: record.id,
      provisional_number: record.numeroProvisionalDea,
      review_date: record.horaFinalizacion,
      reviewer: {
        name: record.nombre,
        email: record.correoElectronico,
      },
      verification_session_id: vs?.id || null,
      image_verification_status: record.image_verification_status,
      address_validation_status: record.address_validation_status,
      created_at: record.createdAt,
      updated_at: record.updatedAt,
    });
  }

  private buildResponsibleObservations(record: LegacyDeaRecord): string | null {
    const parts: string[] = [];

    if (record.titularidadLocal) {
      parts.push(`Titularidad del local: ${record.titularidadLocal}`);
    }
    if (record.usoLocal) {
      parts.push(`Uso del local: ${record.usoLocal}`);
    }

    return parts.length > 0 ? parts.join(" | ") : null;
  }
}
