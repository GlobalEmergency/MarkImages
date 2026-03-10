/**
 * AED Record Processor â€” @batchactions/import RecordProcessorFn
 *
 * FunciÃ³n callback que procesa un registro validado y crea las entidades
 * AED en la base de datos dentro de una transacciÃ³n Prisma:
 *
 * 1. AedLocation  (siempre se crea)
 * 2. AedSchedule  (condicional â€” si hay datos de horario)
 * 3. AedResponsible (condicional â€” si hay datos del responsable)
 * 4. Aed (transacciÃ³n atÃ³mica con relaciones)
 *
 * Las imÃ¡genes se procesan en el hook afterProcess, no aquÃ­.
 * El UUID del AED se pre-genera en beforeProcess (campo _aedId).
 */

import type { ParsedRecord, ProcessingContext } from "@batchactions/import";
import type { PrismaClient } from "@/generated/client/client";
import { randomUUID } from "crypto";

// ============================================================
// Tipos
// ============================================================

export interface AedRecordProcessorOptions {
  /** Prisma client para operaciones de base de datos */
  prisma: PrismaClient;
  /** Nombre/path del archivo CSV para source_details */
  fileName?: string;
  /** ID de la organización que importa (para asignación automática) */
  organizationId?: string;
  /** Tipo de asignación organizacional (default: OWNERSHIP) */
  assignmentType?: string;
  /** ID del usuario que importa (para assigned_by en la asignación) */
  userId?: string;
}

// ============================================================
// Helpers
// ============================================================

/**
 * Parsea un valor string como booleano.
 * Reconoce formatos espaÃ±ol e inglÃ©s.
 */
function parseBoolean(value: unknown): boolean {
  if (!value) return false;
  const str = String(value).toLowerCase().trim();
  return ["true", "1", "sÃ­", "si", "yes", "y", "s", "verdadero"].includes(str);
}

/**
 * Extrae un string limpio o null.
 */
function toStringOrNull(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  return str || null;
}

/**
 * Parsea coordenada: normaliza coma a punto y convierte a nÃºmero.
 */
function parseCoordinate(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  const str = String(value).trim().replace(/,/g, ".");
  if (!str) return undefined;
  const num = parseFloat(str);
  return isNaN(num) ? undefined : num;
}

/**
 * Verifica si hay datos de horario en el registro.
 */
function hasScheduleData(data: Record<string, unknown>): boolean {
  return !!(
    data.weekdayOpening ||
    data.weekdayClosing ||
    data.saturdayOpening ||
    data.saturdayClosing ||
    data.sundayOpening ||
    data.sundayClosing ||
    data.has24hSurveillance ||
    data.hasRestrictedAccess ||
    data.scheduleDescription
  );
}

/**
 * Verifica si hay datos del responsable en el registro.
 * Los nombres de campo corresponden a las keys del schema (FieldDefinition):
 * submitterName, submitterEmail, submitterPhone, alternativePhone,
 * ownership, localOwnership, organization, position, department.
 */
function hasResponsibleData(data: Record<string, unknown>): boolean {
  return !!(
    data.submitterName ||
    data.submitterEmail ||
    data.submitterPhone ||
    data.ownership ||
    data.localOwnership
  );
}

// ============================================================
// Factory del processor
// ============================================================

/**
 * Crea la funciÃ³n processor para @batchactions/import que maneja la creaciÃ³n
 * de entidades AED en la base de datos.
 *
 * @example
 * ```typescript
 * const processor = createAedRecordProcessor({
 *   prisma,
 *   fileName: "import_aeds.csv",
 * });
 *
 * const result = await importer.processChunk(processor, {
 *   maxDurationMs: 80_000,
 * });
 * ```
 */
export function createAedRecordProcessor(
  options: AedRecordProcessorOptions
): (record: ParsedRecord, context: ProcessingContext) => Promise<void> {
  const { prisma, fileName, organizationId, assignmentType, userId } = options;

  return async (record: ParsedRecord, context: ProcessingContext): Promise<void> => {
    const data = record as Record<string, unknown>;

    // UUID pre-generado en beforeProcess hook
    const aedId = (data._aedId as string) || randomUUID();

    // Parsear coordenadas
    const latitude = parseCoordinate(data.latitude);
    const longitude = parseCoordinate(data.longitude);

    // Transacción atómica: si cualquier paso falla, se hace rollback completo.
    // Esto evita registros huérfanos de Location/Schedule/Responsible.
    await prisma.$transaction(async (tx) => {
      // ========================================
      // 1. CREATE LOCATION (siempre)
      // ========================================
      const location = await tx.aedLocation.create({
        data: {
          street_type: toStringOrNull(data.streetType),
          street_name: toStringOrNull(data.streetName),
          street_number: toStringOrNull(data.streetNumber),
          postal_code: toStringOrNull(data.postalCode),
          city_name: toStringOrNull(data.city || data.cityName),
          city_code: toStringOrNull(data.cityCode),
          district_code: toStringOrNull(data.districtCode),
          district_name: toStringOrNull(data.district),
          neighborhood_code: toStringOrNull(data.neighborhoodCode),
          neighborhood_name: toStringOrNull(data.neighborhood || data.neighborhoodName),
          floor: toStringOrNull(data.floor),
          location_details: toStringOrNull(data.locationDetails),
          access_instructions: toStringOrNull(data.accessDescription),
        },
      });

      // ========================================
      // 2. CREATE SCHEDULE (condicional)
      // ========================================
      let scheduleId: string | undefined;

      if (hasScheduleData(data)) {
        const schedule = await tx.aedSchedule.create({
          data: {
            weekday_opening: toStringOrNull(data.weekdayOpening),
            weekday_closing: toStringOrNull(data.weekdayClosing),
            saturday_opening: toStringOrNull(data.saturdayOpening),
            saturday_closing: toStringOrNull(data.saturdayClosing),
            sunday_opening: toStringOrNull(data.sundayOpening),
            sunday_closing: toStringOrNull(data.sundayClosing),
            has_24h_surveillance: parseBoolean(data.has24hSurveillance),
            has_restricted_access: parseBoolean(data.hasRestrictedAccess),
            description: toStringOrNull(data.scheduleDescription),
            notes: toStringOrNull(data.scheduleNotes),
          },
        });
        scheduleId = schedule.id;
      }

      // ========================================
      // 3. CREATE RESPONSIBLE (condicional)
      // ========================================
      let responsibleId: string | undefined;

      if (hasResponsibleData(data)) {
        const responsible = await tx.aedResponsible.create({
          data: {
            name: toStringOrNull(data.submitterName) || "Sin especificar",
            email: toStringOrNull(data.submitterEmail),
            phone: toStringOrNull(data.submitterPhone),
            alternative_phone: toStringOrNull(data.alternativePhone),
            ownership: toStringOrNull(data.ownership),
            local_ownership: toStringOrNull(data.localOwnership),
            local_use: toStringOrNull(data.localUse),
            organization: toStringOrNull(data.organization),
            position: toStringOrNull(data.position),
            department: toStringOrNull(data.department),
          },
        });
        responsibleId = responsible.id;
      }

      // ========================================
      // 4. CREATE AED
      // ========================================
      await tx.aed.create({
        data: {
          id: aedId,

          // Código e identificadores
          code: toStringOrNull(data.code),
          external_reference: toStringOrNull(data.externalReference),

          // Datos básicos
          name: String(data.proposedName || "").trim(),
          establishment_type: toStringOrNull(data.establishmentType),

          // Coordenadas
          latitude,
          longitude,
          coordinates_precision: toStringOrNull(data.coordinatesPrecision),

          // Relaciones
          location_id: location.id,
          schedule_id: scheduleId,
          responsible_id: responsibleId,

          // Origen y trazabilidad
          source_origin: "CSV_IMPORT",
          source_details: `Importación CSV: ${fileName || "unknown"}`,
          batch_job_id: context.jobId,

          // Notas
          public_notes: toStringOrNull(data.publicNotes || data.freeComment),

          // Estado inicial
          status: "DRAFT",
        },
      });

      // ========================================
      // 5. CREATE ORG ASSIGNMENT (conditional)
      // ========================================
      if (organizationId) {
        await tx.aedOrganizationAssignment.create({
          data: {
            aed_id: aedId,
            organization_id: organizationId,
            assignment_type:
              (assignmentType as
                | "OWNERSHIP"
                | "MAINTENANCE"
                | "CIVIL_PROTECTION"
                | "CERTIFIED_COMPANY"
                | "VERIFICATION") || "OWNERSHIP",
            status: "ACTIVE",
            assigned_by: userId || null,
          },
        });
      }
    });

    // Nota: Las imágenes se descargan/suben en el hook afterProcess
    // para mantener separación de responsabilidades y evitar que
    // un fallo de imagen bloquee la creación del AED.
  };
}
