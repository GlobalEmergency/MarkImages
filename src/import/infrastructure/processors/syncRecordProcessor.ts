/**
 * Sync Record Processor — @batchactions/core RecordProcessorFn
 *
 * Processes a single record from an external data source sync.
 * Handles both creation of new AEDs and updating existing ones.
 *
 * Business logic ported from ExternalSyncProcessor:
 * - 3-tier duplicate detection (external_ref → coordinates → skip)
 * - 4 merge scenarios (isMerging × isAutomaticSync)
 * - Verified AED protection
 * - Code protection (existing codes are never overwritten)
 * - Audit trail via internal_notes and AedFieldChange
 *
 * Key optimization: existing AEDs are batch pre-loaded in beforeProcess
 * hook and stored in the record's _existingAed field, eliminating N+1 queries.
 */

import type { ParsedRecord, ProcessingContext } from "@batchactions/core";
import type { PrismaClient } from "@/generated/client/client";
import type { AedStatus, PublicationMode, SourceOrigin } from "@/generated/client/enums";
import { SYSTEM_USER_UUID } from "@/constants/system";
import { appendInternalNote } from "@/lib/audit";
import { createOrUpdateDevice } from "./deviceHelpers";

// ============================================================
// Types
// ============================================================

export interface SyncProcessorOptions {
  prisma: PrismaClient;
  dataSourceId: string;
  /** Source origin string (e.g. "EXTERNAL_API", "HEALTH_API") */
  sourceOrigin: string;
  /** Sync frequency from data source config */
  syncFrequency: string;
  /** Whether this is a dry run (no DB writes) */
  dryRun?: boolean;
  /** Accumulator for tracking creates/updates/skips (shared across records) */
  stats?: SyncStats;
}

/** Mutable accumulator for tracking sync operation results */
export interface SyncStats {
  created: number;
  updated: number;
  skipped: number;
}

/** Creates a fresh SyncStats accumulator */
export function createSyncStats(): SyncStats {
  return { created: 0, updated: 0, skipped: 0 };
}

/** Existing AED data pre-loaded by beforeProcess hook */
interface ExistingAedData {
  id: string;
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
  latitude: unknown;
  longitude: unknown;
}

/** Data source defaults pre-loaded once */
interface DataSourceDefaults {
  default_status: string | null;
  default_requires_attention: boolean | null;
  default_publication_mode: string | null;
}

// ============================================================
// Helpers
// ============================================================

function toStringOrNull(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  return str || null;
}

function parseCoordinate(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const str = String(value).trim().replace(/,/g, ".");
  if (!str) return null;
  const num = parseFloat(str);
  return isNaN(num) ? null : num;
}

/**
 * Parses a value as boolean, recognizing Spanish formats.
 * Handles "Sí", "si", "S", "1", "true", "yes", "y", "verdadero".
 */
function parseBoolean(value: unknown): boolean {
  if (!value) return false;
  if (typeof value === "boolean") return value;
  const str = String(value).toLowerCase().trim();
  return ["true", "1", "sí", "si", "yes", "y", "s", "verdadero", "t", "oui"].includes(str);
}

function parseBooleanOrNull(value: unknown): boolean | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return value;
  const str = String(value).toLowerCase().trim();
  if (!str) return null;
  if (["true", "1", "sí", "si", "yes", "y", "s", "t", "oui"].includes(str)) return true;
  if (["false", "0", "no", "n", "f", "non"].includes(str)) return false;
  return null;
}

function isRealExternalRef(ref: string | null): boolean {
  if (!ref) return false;
  return (
    !ref.startsWith("row-") &&
    !ref.startsWith("api-") &&
    !ref.startsWith("json-") &&
    !ref.startsWith("record-")
  );
}

function combineLocationDetails(additionalInfo: unknown, specificLocation: unknown): string | null {
  const parts: string[] = [];
  if (additionalInfo) parts.push(String(additionalInfo).trim());
  if (specificLocation) parts.push(String(specificLocation).trim());
  return parts.length > 0 ? parts.join(". ").trim() : null;
}

// ============================================================
// Factory
// ============================================================

/**
 * Creates the RecordProcessorFn for external sync operations.
 *
 * The record's `_existingAed` field is populated by the beforeProcess hook
 * (see syncHooks.ts). If present, the processor updates the existing AED.
 * If absent, a new AED is created.
 */
export function createSyncRecordProcessor(
  options: SyncProcessorOptions
): (record: ParsedRecord, context: ProcessingContext) => Promise<void> {
  const { prisma, dataSourceId, sourceOrigin, syncFrequency, dryRun = false, stats } = options;

  const isAutomaticSync = syncFrequency !== "MANUAL";

  // Cache data source defaults (loaded on first call).
  // Cache the Promise to prevent concurrent calls from issuing multiple queries.
  let defaultsPromise: Promise<DataSourceDefaults> | null = null;

  function getDefaults(): Promise<DataSourceDefaults> {
    if (!defaultsPromise) {
      defaultsPromise = prisma.externalDataSource
        .findUnique({
          where: { id: dataSourceId },
          select: {
            default_status: true,
            default_requires_attention: true,
            default_publication_mode: true,
          },
        })
        .then(
          (ds) =>
            ds || {
              default_status: null,
              default_requires_attention: null,
              default_publication_mode: null,
            }
        );
    }
    return defaultsPromise;
  }

  return async (record: ParsedRecord, _context: ProcessingContext): Promise<void> => {
    const data = record as Record<string, unknown>;
    const existingAed = data._existingAed as ExistingAedData | undefined;
    const externalId = toStringOrNull(data.externalId);

    if (dryRun) {
      if (stats) stats.skipped++;
      return;
    }

    // Suspected duplicate: no externalId + coordinate/detector match → create and flag
    const suspectedDuplicate = data._suspectedDuplicate as
      | { matchedAedId: string; matchedAedName: string; matchReason: string }
      | undefined;

    if (suspectedDuplicate) {
      await createAedWithDuplicateFlag(prisma, data, suspectedDuplicate, {
        dataSourceId,
        sourceOrigin,
        externalId,
        getDefaults,
      });
      if (stats) stats.created++;
    } else if (existingAed) {
      // Cross-source: AED belongs to a different data source → create as
      // PENDING_REVIEW for manual deduplication in /verify/duplicates
      const isCrossSource = !!(
        existingAed.data_source_id && existingAed.data_source_id !== dataSourceId
      );

      if (isCrossSource) {
        await createAedForDuplicateReview(prisma, data, existingAed, {
          dataSourceId,
          sourceOrigin,
          externalId,
        });
        if (stats) stats.created++;
      } else {
        await updateAed(prisma, existingAed, data, {
          dataSourceId,
          sourceOrigin,
          isAutomaticSync,
          externalId,
        });
        if (stats) stats.updated++;
      }
    } else {
      await createAed(prisma, data, {
        dataSourceId,
        sourceOrigin,
        externalId,
        getDefaults,
      });
      if (stats) stats.created++;
    }
  };
}

// ============================================================
// Create AED
// ============================================================

async function createAed(
  prisma: PrismaClient,
  data: Record<string, unknown>,
  opts: {
    dataSourceId: string;
    sourceOrigin: string;
    externalId: string | null;
    getDefaults: () => Promise<DataSourceDefaults>;
  }
): Promise<void> {
  const defaults = await opts.getDefaults();
  const latitude = parseCoordinate(data.latitude);
  const longitude = parseCoordinate(data.longitude);
  const locationDetails = combineLocationDetails(data.additionalInfo, data.specificLocation);
  const baseCode = isRealExternalRef(opts.externalId) ? opts.externalId : null;

  await prisma.$transaction(async (tx) => {
    // 1. Location
    const location = await tx.aedLocation.create({
      data: {
        street_type: toStringOrNull(data.streetType),
        street_name: toStringOrNull(data.streetName),
        street_number: toStringOrNull(data.streetNumber),
        postal_code: toStringOrNull(data.postalCode),
        floor: toStringOrNull(data.floor),
        location_details: locationDetails,
        access_instructions: toStringOrNull(data.accessDescription),
        city_name: toStringOrNull(data.city),
        city_code: toStringOrNull(data.cityCode),
        district_name: toStringOrNull(data.district),
      },
    });

    // 2. Schedule (conditional)
    let scheduleId: string | null = null;
    if (
      data.accessSchedule ||
      data.scheduleDescription ||
      data.weekdayOpening ||
      data.accessRestriction ||
      data.isPmrAccessible ||
      data.has24hSurveillance
    ) {
      const schedule = await tx.aedSchedule.create({
        data: {
          description: toStringOrNull(data.accessSchedule || data.scheduleDescription),
          weekday_opening: toStringOrNull(data.weekdayOpening),
          weekday_closing: toStringOrNull(data.weekdayClosing),
          saturday_opening: toStringOrNull(data.saturdayOpening),
          saturday_closing: toStringOrNull(data.saturdayClosing),
          sunday_opening: toStringOrNull(data.sundayOpening),
          sunday_closing: toStringOrNull(data.sundayClosing),
          has_24h_surveillance: parseBoolean(data.has24hSurveillance),
          has_restricted_access: parseBoolean(data.accessRestriction),
          is_pmr_accessible: parseBooleanOrNull(data.isPmrAccessible),
        },
      });
      scheduleId = schedule.id;
    }

    // 3. Responsible (conditional)
    let responsibleId: string | null = null;
    if (
      data.ownershipType ||
      data.ownership ||
      data.submitterName ||
      data.submitterEmail ||
      data.submitterPhone
    ) {
      const responsible = await tx.aedResponsible.create({
        data: {
          name:
            toStringOrNull(data.submitterName) ||
            toStringOrNull(data.ownershipType) ||
            "Sin nombre",
          email: toStringOrNull(data.submitterEmail),
          phone: toStringOrNull(data.submitterPhone),
          ownership: toStringOrNull(data.ownershipType || data.ownership),
        },
      });
      responsibleId = responsible.id;
    }

    // 4. AED — resolve unique code (externalId may collide if source IDs aren't unique)
    let code = baseCode;
    if (code) {
      const existing = await tx.aed.findUnique({ where: { code }, select: { id: true } });
      if (existing) {
        // Append a short suffix to make the code unique
        code = `${baseCode}-${Date.now().toString(36)}`;
      }
    }
    const createdAed = await tx.aed.create({
      data: {
        name: toStringOrNull(data.name) || "Sin nombre",
        code,
        establishment_type: toStringOrNull(data.establishmentType),
        latitude,
        longitude,
        location_id: location.id,
        schedule_id: scheduleId,
        responsible_id: responsibleId,
        external_reference: opts.externalId,
        source_origin: (opts.sourceOrigin || "EXTERNAL_API") as SourceOrigin,
        source_details: JSON.stringify(data._rawData || data),
        data_source_id: opts.dataSourceId,
        status: (defaults.default_status || "PENDING_REVIEW") as AedStatus,
        requires_attention: defaults.default_requires_attention ?? true,
        publication_mode: (defaults.default_publication_mode || "LOCATION_ONLY") as PublicationMode,
        last_synced_at: new Date(),
        created_by: SYSTEM_USER_UUID,
      },
      select: { id: true },
    });

    // 5. Register external identifier for multi-source tracking
    if (opts.externalId && isRealExternalRef(opts.externalId)) {
      await tx.$executeRaw`
        INSERT INTO aed_external_identifiers (aed_id, data_source_id, external_identifier, first_seen_at, last_seen_at, is_current_in_source)
        VALUES (${createdAed.id}::uuid, ${opts.dataSourceId}::uuid, ${opts.externalId}, NOW(), NOW(), true)
        ON CONFLICT (data_source_id, external_identifier)
        DO UPDATE SET last_seen_at = NOW(), is_current_in_source = true, removed_from_source_at = NULL, aed_id = ${createdAed.id}::uuid
      `;
    }

    // 6. Device (conditional — if device data exists)
    await createOrUpdateDevice(tx, createdAed.id, data);

    // Stash created ID so afterProcess hook can register it in the cache
    data._createdAedId = createdAed.id;
  });
}

// ============================================================
// Create AED with suspected duplicate flag
//
// When an incoming record has NO externalId and matches an existing
// AED by coordinates or duplicate detector, we create a NEW AED
// (never merge) and flag it with requires_attention=true + internal note.
// A human reviewer decides if it's a real duplicate or a distinct device.
// ============================================================

async function createAedWithDuplicateFlag(
  prisma: PrismaClient,
  data: Record<string, unknown>,
  suspectedDuplicate: { matchedAedId: string; matchedAedName: string; matchReason: string },
  opts: {
    dataSourceId: string;
    sourceOrigin: string;
    externalId: string | null;
    getDefaults: () => Promise<DataSourceDefaults>;
  }
): Promise<void> {
  // Load the real matched AED from the database
  const matchedAed = await prisma.aed.findUnique({
    where: { id: suspectedDuplicate.matchedAedId },
    select: {
      id: true,
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
      latitude: true,
      longitude: true,
    },
  });

  if (!matchedAed) {
    // Matched AED no longer exists — just create normally
    await createAed(prisma, data, opts);
    return;
  }

  await createAedForDuplicateReview(prisma, data, matchedAed, {
    dataSourceId: opts.dataSourceId,
    sourceOrigin: opts.sourceOrigin,
    externalId: opts.externalId,
  });
}

// ============================================================
// Create AED for duplicate review (cross-source match)
//
// When an incoming record matches an existing AED from a DIFFERENT
// data source (via spatial proximity), create a new AED with status
// PENDING_REVIEW and requires_attention=true. The user reviews it
// in /verify/duplicates and decides: keep both or reject as duplicate.
// ============================================================

async function createAedForDuplicateReview(
  prisma: PrismaClient,
  data: Record<string, unknown>,
  matchedAed: ExistingAedData,
  opts: {
    dataSourceId: string;
    sourceOrigin: string;
    externalId: string | null;
  }
): Promise<void> {
  const latitude = parseCoordinate(data.latitude);
  const longitude = parseCoordinate(data.longitude);
  const locationDetails = combineLocationDetails(data.additionalInfo, data.specificLocation);
  const baseCode = isRealExternalRef(opts.externalId) ? opts.externalId : null;

  // Build the duplicate note in the format the verify/duplicates UI expects:
  //   Similar a "NAME" en "ADDRESS", score: N
  const matchedName = matchedAed.name || "Sin nombre";
  const matchedAddress = [matchedAed.source_origin, matchedAed.external_reference]
    .filter(Boolean)
    .join(" ref:");
  const duplicateNote = appendInternalNote(
    null,
    `Similar a "${matchedName}" en "${matchedAddress}", score: 75. ` +
      `Cross-source match: el DEA existente (${matchedAed.id}) pertenece a otra fuente de datos.`,
    "duplicate",
    "ExternalSyncService"
  );

  await prisma.$transaction(async (tx) => {
    // 1. Location
    const location = await tx.aedLocation.create({
      data: {
        street_type: toStringOrNull(data.streetType),
        street_name: toStringOrNull(data.streetName),
        street_number: toStringOrNull(data.streetNumber),
        postal_code: toStringOrNull(data.postalCode),
        floor: toStringOrNull(data.floor),
        location_details: locationDetails,
        access_instructions: toStringOrNull(data.accessDescription),
        city_name: toStringOrNull(data.city),
        city_code: toStringOrNull(data.cityCode),
        district_name: toStringOrNull(data.district),
      },
    });

    // 2. Schedule (conditional)
    let scheduleId: string | null = null;
    if (
      data.accessSchedule ||
      data.scheduleDescription ||
      data.weekdayOpening ||
      data.accessRestriction ||
      data.isPmrAccessible ||
      data.has24hSurveillance
    ) {
      const schedule = await tx.aedSchedule.create({
        data: {
          description: toStringOrNull(data.accessSchedule || data.scheduleDescription),
          weekday_opening: toStringOrNull(data.weekdayOpening),
          weekday_closing: toStringOrNull(data.weekdayClosing),
          saturday_opening: toStringOrNull(data.saturdayOpening),
          saturday_closing: toStringOrNull(data.saturdayClosing),
          sunday_opening: toStringOrNull(data.sundayOpening),
          sunday_closing: toStringOrNull(data.sundayClosing),
          has_24h_surveillance: parseBoolean(data.has24hSurveillance),
          has_restricted_access: parseBoolean(data.accessRestriction),
          is_pmr_accessible: parseBooleanOrNull(data.isPmrAccessible),
        },
      });
      scheduleId = schedule.id;
    }

    // 3. Responsible (conditional)
    let responsibleId: string | null = null;
    if (
      data.ownershipType ||
      data.ownership ||
      data.submitterName ||
      data.submitterEmail ||
      data.submitterPhone
    ) {
      const responsible = await tx.aedResponsible.create({
        data: {
          name:
            toStringOrNull(data.submitterName) ||
            toStringOrNull(data.ownershipType) ||
            "Sin nombre",
          email: toStringOrNull(data.submitterEmail),
          phone: toStringOrNull(data.submitterPhone),
          ownership: toStringOrNull(data.ownershipType || data.ownership),
        },
      });
      responsibleId = responsible.id;
    }

    // 4. AED — unique code
    let code = baseCode;
    if (code) {
      const existing = await tx.aed.findUnique({ where: { code }, select: { id: true } });
      if (existing) {
        code = `${baseCode}-${Date.now().toString(36)}`;
      }
    }

    const createdAed = await tx.aed.create({
      data: {
        name: toStringOrNull(data.name) || "Sin nombre",
        code,
        establishment_type: toStringOrNull(data.establishmentType),
        latitude,
        longitude,
        location_id: location.id,
        schedule_id: scheduleId,
        responsible_id: responsibleId,
        external_reference: opts.externalId,
        source_origin: (opts.sourceOrigin || "EXTERNAL_API") as SourceOrigin,
        source_details: JSON.stringify(data._rawData || data),
        data_source_id: opts.dataSourceId,
        status: "PENDING_REVIEW" as AedStatus,
        requires_attention: true,
        publication_mode: "LOCATION_ONLY" as PublicationMode,
        internal_notes: duplicateNote,
        last_synced_at: new Date(),
        created_by: SYSTEM_USER_UUID,
      },
      select: { id: true },
    });

    // 5. Register external identifier
    await registerExternalIdentifier(tx, createdAed.id, opts.dataSourceId, opts.externalId);

    // 6. Device
    await createOrUpdateDevice(tx, createdAed.id, data);

    // Stash for cache
    data._createdAedId = createdAed.id;
  });
}

// ============================================================
// Update AED — 2 protection tiers + same-source update
//
// Tier 1: Verified AED → metadata only
// Tier 2: Same-source update → authoritative overwrite
//
// Note: Cross-source matches are handled by createAedForDuplicateReview
// above, so updateAed only handles same-source scenarios.
// ============================================================

async function updateAed(
  prisma: PrismaClient,
  aed: ExistingAedData,
  data: Record<string, unknown>,
  opts: {
    dataSourceId: string;
    sourceOrigin: string;
    isAutomaticSync: boolean;
    externalId: string | null;
  }
): Promise<void> {
  const { dataSourceId, sourceOrigin, externalId } = opts;

  await prisma.$transaction(async (tx) => {
    // ==============================
    // TIER 1: VERIFIED AED PROTECTION
    // ==============================
    if (aed.last_verified_at) {
      const notes = appendInternalNote(
        aed.internal_notes,
        `Sync detectó match con DEA verificado (sin modificar datos). ` +
          `Fuente: data_source_id="${dataSourceId}", external_id="${externalId}".`,
        "verified_sync_skip",
        "ExternalSyncService"
      );

      await tx.aed.update({
        where: { id: aed.id },
        data: {
          data_source_id: aed.data_source_id ?? dataSourceId,
          last_synced_at: new Date(),
          internal_notes: notes,
        },
      });

      await registerExternalIdentifier(tx, aed.id, dataSourceId, externalId);
      return;
    }

    // ==============================
    // TIER 2: SAME-SOURCE UPDATE (authoritative)
    // This data source owns the AED → full update
    // ==============================
    const latitude = parseCoordinate(data.latitude);
    const longitude = parseCoordinate(data.longitude);
    const locationDetails = combineLocationDetails(data.additionalInfo, data.specificLocation);

    // Update location
    if (aed.location_id) {
      await tx.aedLocation.update({
        where: { id: aed.location_id },
        data: {
          street_type: toStringOrNull(data.streetType),
          street_name: toStringOrNull(data.streetName),
          street_number: toStringOrNull(data.streetNumber),
          postal_code: toStringOrNull(data.postalCode),
          floor: toStringOrNull(data.floor),
          location_details: locationDetails,
          access_instructions: toStringOrNull(data.accessDescription),
          city_name: toStringOrNull(data.city),
          city_code: toStringOrNull(data.cityCode),
          district_name: toStringOrNull(data.district),
        },
      });
    }

    // Update or create schedule
    let scheduleIdUpdate: string | null | undefined;
    if (
      data.accessSchedule ||
      data.scheduleDescription ||
      data.weekdayOpening ||
      data.accessRestriction ||
      data.isPmrAccessible ||
      data.has24hSurveillance
    ) {
      const scheduleData = {
        description: toStringOrNull(data.accessSchedule || data.scheduleDescription),
        weekday_opening: toStringOrNull(data.weekdayOpening),
        weekday_closing: toStringOrNull(data.weekdayClosing),
        saturday_opening: toStringOrNull(data.saturdayOpening),
        saturday_closing: toStringOrNull(data.saturdayClosing),
        sunday_opening: toStringOrNull(data.sundayOpening),
        sunday_closing: toStringOrNull(data.sundayClosing),
        has_24h_surveillance: parseBoolean(data.has24hSurveillance),
        has_restricted_access: parseBoolean(data.accessRestriction),
        is_pmr_accessible: parseBooleanOrNull(data.isPmrAccessible),
      };
      if (aed.schedule_id) {
        await tx.aedSchedule.update({ where: { id: aed.schedule_id }, data: scheduleData });
      } else {
        const schedule = await tx.aedSchedule.create({ data: scheduleData });
        scheduleIdUpdate = schedule.id;
      }
    }

    // Update or create responsible
    let responsibleIdUpdate: string | null | undefined;
    if (
      data.ownershipType ||
      data.ownership ||
      data.submitterName ||
      data.submitterEmail ||
      data.submitterPhone
    ) {
      const respData = {
        name:
          toStringOrNull(data.submitterName) || toStringOrNull(data.ownershipType) || "Sin nombre",
        email: toStringOrNull(data.submitterEmail),
        phone: toStringOrNull(data.submitterPhone),
        ownership: toStringOrNull(data.ownershipType || data.ownership),
      };
      if (aed.responsible_id) {
        await tx.aedResponsible.update({ where: { id: aed.responsible_id }, data: respData });
      } else {
        const resp = await tx.aedResponsible.create({ data: respData });
        responsibleIdUpdate = resp.id;
      }
    }

    // Code protection: only assign if AED has no code
    let codeUpdate: string | null | undefined;
    if (!aed.code && isRealExternalRef(externalId)) {
      codeUpdate = externalId;
    }

    await tx.aed.update({
      where: { id: aed.id },
      data: {
        name: toStringOrNull(data.name) || undefined,
        code: codeUpdate,
        establishment_type: toStringOrNull(data.establishmentType),
        latitude,
        longitude,
        external_reference: externalId,
        source_details: JSON.stringify(data._rawData || data),
        source_origin: sourceOrigin as SourceOrigin,
        data_source_id: dataSourceId,
        schedule_id: scheduleIdUpdate,
        responsible_id: responsibleIdUpdate,
        last_synced_at: new Date(),
      },
    });

    await registerExternalIdentifier(tx, aed.id, dataSourceId, externalId);
    await createOrUpdateDevice(tx, aed.id, data);
  });
}

// ============================================================
// Register external identifier (shared helper)
// ============================================================

async function registerExternalIdentifier(
  tx: Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0],
  aedId: string,
  dataSourceId: string,
  externalId: string | null
): Promise<void> {
  if (!externalId || !isRealExternalRef(externalId)) return;
  await tx.$executeRaw`
    INSERT INTO aed_external_identifiers (aed_id, data_source_id, external_identifier, first_seen_at, last_seen_at, is_current_in_source)
    VALUES (${aedId}::uuid, ${dataSourceId}::uuid, ${externalId}, NOW(), NOW(), true)
    ON CONFLICT (data_source_id, external_identifier)
    DO UPDATE SET last_seen_at = NOW(), is_current_in_source = true, removed_from_source_at = NULL
  `;
}
