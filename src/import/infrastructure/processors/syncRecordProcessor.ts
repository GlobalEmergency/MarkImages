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
import { recordFieldChange, appendInternalNote } from "@/lib/audit";

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

    if (existingAed) {
      await updateAed(prisma, existingAed, data, {
        dataSourceId,
        sourceOrigin,
        isAutomaticSync,
        externalId,
      });
      if (stats) stats.updated++;
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
  const code = isRealExternalRef(opts.externalId) ? opts.externalId : null;

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
    if (data.accessSchedule || data.scheduleDescription) {
      const schedule = await tx.aedSchedule.create({
        data: {
          description: toStringOrNull(data.accessSchedule || data.scheduleDescription),
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

    // 4. AED
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
        status: (defaults.default_status || "PUBLISHED") as AedStatus,
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

    // Stash created ID so afterProcess hook can register it in the cache
    data._createdAedId = createdAed.id;
  });
}

// ============================================================
// Update AED — 4 merge scenarios
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
  const { dataSourceId, sourceOrigin, isAutomaticSync, externalId } = opts;

  // Is this a merge (different external_reference)?
  const isMerging = aed.external_reference && externalId && aed.external_reference !== externalId;

  // Coerce isMerging to boolean (external_reference comparison may yield string)
  const isMergingBool = Boolean(isMerging);

  await prisma.$transaction(async (tx) => {
    // ==============================
    // VERIFIED AED PROTECTION (must come BEFORE merge logic)
    // ==============================
    if (aed.last_verified_at) {
      // For verified AEDs: only update sync metadata, never business data.
      // Preserve foreign ownership: don't overwrite data_source_id from another source.
      const verifiedUpdate: Record<string, unknown> = {
        data_source_id: aed.data_source_id ?? dataSourceId,
        last_synced_at: new Date(),
      };
      if (!isMergingBool) {
        verifiedUpdate.external_reference = externalId;
      }
      // If merging, record the transition in notes but don't change source fields
      if (isMergingBool) {
        const notes = appendInternalNote(
          aed.internal_notes,
          `Merge detectado en DEA verificado (sin modificar datos). ` +
            `external_reference anterior="${aed.external_reference}", nueva="${externalId}".`,
          "verified_merge_skip",
          "ExternalSyncService"
        );
        verifiedUpdate.internal_notes = notes;
      }
      await tx.aed.update({ where: { id: aed.id }, data: verifiedUpdate });

      // Register identifier even for verified AEDs (tracks that this source still sees it)
      if (externalId && isRealExternalRef(externalId)) {
        await tx.$executeRaw`
          INSERT INTO aed_external_identifiers (aed_id, data_source_id, external_identifier, first_seen_at, last_seen_at, is_current_in_source)
          VALUES (${aed.id}::uuid, ${dataSourceId}::uuid, ${externalId}, NOW(), NOW(), true)
          ON CONFLICT (data_source_id, external_identifier)
          DO UPDATE SET last_seen_at = NOW(), is_current_in_source = true, removed_from_source_at = NULL
        `;
      }
      return;
    }

    // ==============================
    // MERGE LOGIC: build merge notes + record audit (no AED update yet)
    // ==============================
    let mergeNotes: unknown = undefined;

    if (isMergingBool) {
      if (isAutomaticSync) {
        // CASE 1: Automatic sync takeover — record transition
        mergeNotes = appendInternalNote(
          aed.internal_notes,
          `DEA asumido por sincronización automática. ` +
            `Datos previos: external_reference="${aed.external_reference}", source_origin="${aed.source_origin}". ` +
            `Nuevos datos: external_reference="${externalId}", source_origin="${sourceOrigin}".`,
          "automatic_sync_takeover",
          "ExternalSyncService"
        );

        try {
          await recordFieldChange(tx, {
            aedId: aed.id,
            fieldName: "source_origin_automatic_transition",
            oldValue: `${aed.source_origin}:${aed.external_reference}`,
            newValue: `${sourceOrigin}:${externalId}`,
            changedBy: SYSTEM_USER_UUID,
            changeSource: "IMPORT",
          });
        } catch {
          /* non-critical */
        }
      } else {
        // CASE 2: Manual import merge — keep original source
        mergeNotes = appendInternalNote(
          aed.internal_notes,
          `Actualizado por importación puntual. ` +
            `Se mantiene: external_reference="${aed.external_reference}", source_origin="${aed.source_origin}". ` +
            `Datos de importación: external_reference="${externalId}", fuente="${dataSourceId}".`,
          "manual_import_update",
          "ExternalSyncService"
        );

        try {
          await recordFieldChange(tx, {
            aedId: aed.id,
            fieldName: "manual_import_merge",
            oldValue: aed.external_reference || "",
            newValue: externalId || "",
            changedBy: SYSTEM_USER_UUID,
            changeSource: "IMPORT",
          });
        } catch {
          /* non-critical */
        }
      }
    }

    // ==============================
    // UNVERIFIED AED: Update business data (single AED update)
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
    if (data.accessSchedule || data.scheduleDescription) {
      const desc = toStringOrNull(data.accessSchedule || data.scheduleDescription);
      if (aed.schedule_id) {
        await tx.aedSchedule.update({
          where: { id: aed.schedule_id },
          data: { description: desc },
        });
      } else {
        const schedule = await tx.aedSchedule.create({
          data: { description: desc },
        });
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
        await tx.aedResponsible.update({
          where: { id: aed.responsible_id },
          data: respData,
        });
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

    // Build single AED update (merge metadata + business data combined).
    // Preserve foreign ownership: only claim data_source_id if AED has none
    // or already belongs to this data source. Cross-source matches should
    // NOT steal ownership from the original source.
    const preserveOwnership = aed.data_source_id && aed.data_source_id !== dataSourceId;

    const updateData: Record<string, unknown> = {
      schedule_id: scheduleIdUpdate,
      responsible_id: responsibleIdUpdate,
      last_synced_at: new Date(),
      data_source_id: preserveOwnership ? aed.data_source_id : dataSourceId,
    };

    // Include merge notes if present
    if (mergeNotes !== undefined) {
      updateData.internal_notes = mergeNotes;
    }

    if (isMergingBool && isAutomaticSync) {
      // CASE 1: Merge + automatic sync — update ALL fields (authoritative source).
      // Explicit takeover: this IS the intended ownership transfer.
      updateData.data_source_id = dataSourceId;
      updateData.name = toStringOrNull(data.name) || undefined;
      updateData.code = codeUpdate;
      updateData.establishment_type = toStringOrNull(data.establishmentType);
      updateData.latitude = latitude;
      updateData.longitude = longitude;
      updateData.external_reference = externalId;
      updateData.source_origin = sourceOrigin;
      updateData.source_details = JSON.stringify({
        current_source: sourceOrigin,
        previous_source: {
          origin: aed.source_origin,
          external_reference: aed.external_reference,
          data_source_id: aed.data_source_id,
        },
        raw_data: data._rawData || data,
      });
    } else if (isMergingBool && !isAutomaticSync) {
      // CASE 2: Merge + manual import — only complementary fields
      if (!aed.code && codeUpdate) updateData.code = codeUpdate;
      if (latitude && longitude) {
        updateData.latitude = latitude;
        updateData.longitude = longitude;
      }
      if (toStringOrNull(data.establishmentType) && !aed.establishment_type) {
        updateData.establishment_type = toStringOrNull(data.establishmentType);
      }
      updateData.source_details = JSON.stringify({
        original_source: aed.source_origin,
        original_external_ref: aed.external_reference,
        last_import: {
          external_reference: externalId,
          data_source_id: dataSourceId,
          imported_at: new Date().toISOString(),
          raw_data: data._rawData || data,
        },
      });
    } else {
      // CASE 3: Normal update (same external_reference)
      updateData.name = toStringOrNull(data.name) || undefined;
      updateData.code = codeUpdate;
      updateData.establishment_type = toStringOrNull(data.establishmentType);
      updateData.latitude = latitude;
      updateData.longitude = longitude;
      updateData.external_reference = externalId;
      updateData.source_details = JSON.stringify(data._rawData || data);
      if (isAutomaticSync) {
        updateData.source_origin = sourceOrigin;
      }
    }

    await tx.aed.update({ where: { id: aed.id }, data: updateData });

    // Register external identifier for multi-source tracking
    if (externalId && isRealExternalRef(externalId)) {
      await tx.$executeRaw`
        INSERT INTO aed_external_identifiers (aed_id, data_source_id, external_identifier, first_seen_at, last_seen_at, is_current_in_source)
        VALUES (${aed.id}::uuid, ${dataSourceId}::uuid, ${externalId}, NOW(), NOW(), true)
        ON CONFLICT (data_source_id, external_identifier)
        DO UPDATE SET last_seen_at = NOW(), is_current_in_source = true, removed_from_source_at = NULL
      `;
    }
  });
}
