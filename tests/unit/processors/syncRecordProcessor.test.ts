import { describe, it, expect, beforeEach } from "vitest";
import {
  createSyncRecordProcessor,
  createSyncStats,
} from "@/import/infrastructure/processors/syncRecordProcessor";
import { createMockPrisma, createMockContext } from "./helpers/mockPrisma";

// ============================================================
// Helpers
// ============================================================

function makeExistingAed(overrides?: Record<string, unknown>) {
  return {
    id: "existing-aed-id",
    location_id: "existing-loc-id",
    schedule_id: null,
    responsible_id: null,
    last_verified_at: null,
    name: "Existing AED",
    code: null,
    establishment_type: null,
    external_reference: null,
    data_source_id: "ds-same", // same as default dataSourceId
    source_origin: "EXTERNAL_API",
    internal_notes: null,
    latitude: 40.42,
    longitude: -3.71,
    ...overrides,
  };
}

const DS_ID = "ds-same";
const DS_OTHER = "ds-other";

function makeProcessor(
  prisma: ReturnType<typeof createMockPrisma>,
  overrides?: Partial<Parameters<typeof createSyncRecordProcessor>[0]>
) {
  const stats = createSyncStats();
  const processor = createSyncRecordProcessor({
    prisma: prisma as any,
    dataSourceId: DS_ID,
    sourceOrigin: "EXTERNAL_API",
    syncFrequency: "MANUAL",
    stats,
    ...overrides,
  });
  return { processor, stats };
}

// ============================================================
// Tests
// ============================================================

describe("createSyncRecordProcessor", () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  const context = createMockContext();

  beforeEach(() => {
    prisma = createMockPrisma();
    // Default: data source lookup returns defaults
    prisma.externalDataSource.findUnique.mockResolvedValue({
      default_status: "PENDING_REVIEW",
      default_requires_attention: true,
      default_publication_mode: "LOCATION_ONLY",
    });
  });

  // ----------------------------------------------------------
  // Use case 1: Create new AED (no existing match)
  // ----------------------------------------------------------
  describe("create new AED", () => {
    it("creates AED with location, schedule, responsible, device", async () => {
      prisma.aedDevice.findFirst.mockResolvedValue(null);
      prisma.aed.findUnique.mockResolvedValue(null); // no code conflict

      const { processor, stats } = makeProcessor(prisma);

      await processor(
        {
          name: "Hospital Central",
          externalId: "EXT-001",
          latitude: "40.42",
          longitude: "-3.71",
          streetName: "Calle Mayor",
          streetNumber: "10",
          city: "Madrid",
          accessSchedule: "L-V 09:00-21:00",
          weekdayOpening: "09:00",
          weekdayClosing: "21:00",
          accessRestriction: "true",
          isPmrAccessible: "oui",
          submitterName: "Admin",
          submitterEmail: "admin@hospital.es",
          deviceBrand: "Philips",
          deviceModel: "FRx",
        },
        context
      );

      // Created entities
      expect(prisma.aedLocation.create).toHaveBeenCalledOnce();
      expect(prisma.aedSchedule.create).toHaveBeenCalledOnce();
      expect(prisma.aedResponsible.create).toHaveBeenCalledOnce();
      expect(prisma.aed.create).toHaveBeenCalledOnce();
      expect(prisma.aedDevice.create).toHaveBeenCalledOnce();

      // Schedule includes access restriction and PMR
      const schedData = prisma.aedSchedule.create.mock.calls[0][0].data;
      expect(schedData.has_restricted_access).toBe(true);
      expect(schedData.is_pmr_accessible).toBe(true);
      expect(schedData.weekday_opening).toBe("09:00");

      // AED has correct status from defaults
      const aedData = prisma.aed.create.mock.calls[0][0].data;
      expect(aedData.status).toBe("PENDING_REVIEW");
      expect(aedData.requires_attention).toBe(true);
      expect(aedData.data_source_id).toBe(DS_ID);
      expect(aedData.external_reference).toBe("EXT-001");

      // Stats incremented
      expect(stats.created).toBe(1);
      expect(stats.updated).toBe(0);
    });

    it("uses externalId as code when it is a real reference", async () => {
      prisma.aed.findUnique.mockResolvedValue(null); // no code conflict

      const { processor } = makeProcessor(prisma);

      await processor(
        {
          name: "Test",
          externalId: "REAL-CODE-001",
          latitude: "40",
          longitude: "-3",
        },
        context
      );

      const aedData = prisma.aed.create.mock.calls[0][0].data;
      expect(aedData.code).toBe("REAL-CODE-001");
    });

    it("does NOT use auto-generated externalId (api-N) as code", async () => {
      const { processor } = makeProcessor(prisma);

      await processor(
        {
          name: "Test",
          externalId: "api-42",
          latitude: "40",
          longitude: "-3",
        },
        context
      );

      const aedData = prisma.aed.create.mock.calls[0][0].data;
      expect(aedData.code).toBeNull();
    });

    it("appends suffix when code already exists in DB", async () => {
      // First findUnique (code check) returns existing
      prisma.aed.findUnique.mockResolvedValueOnce({ id: "other-aed" });

      const { processor } = makeProcessor(prisma);

      await processor(
        {
          name: "Test",
          externalId: "DUPLICATE-CODE",
          latitude: "40",
          longitude: "-3",
        },
        context
      );

      const aedData = prisma.aed.create.mock.calls[0][0].data;
      expect(aedData.code).toMatch(/^DUPLICATE-CODE-/);
    });

    it("registers external identifier for real references", async () => {
      prisma.aed.findUnique.mockResolvedValue(null);

      const { processor } = makeProcessor(prisma);

      await processor(
        {
          name: "Test",
          externalId: "REAL-REF",
          latitude: "40",
          longitude: "-3",
        },
        context
      );

      expect(prisma.$executeRaw).toHaveBeenCalled();
    });

    it("does NOT create schedule when no schedule data present", async () => {
      const { processor } = makeProcessor(prisma);

      await processor(
        {
          name: "Minimal",
          latitude: "40",
          longitude: "-3",
        },
        context
      );

      expect(prisma.aedSchedule.create).not.toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------
  // Use case 2: Update existing AED (same data source)
  // ----------------------------------------------------------
  describe("update existing AED (same source)", () => {
    it("updates location, AED fields, and device", async () => {
      const existing = makeExistingAed();
      prisma.aedDevice.findFirst.mockResolvedValue(null);

      const { processor, stats } = makeProcessor(prisma);

      await processor(
        {
          _existingAed: existing,
          externalId: "EXT-001",
          name: "Updated Name",
          latitude: "40.43",
          longitude: "-3.72",
          streetName: "Calle Nueva",
          streetNumber: "20",
          deviceBrand: "Zoll",
        },
        context
      );

      // Location updated
      expect(prisma.aedLocation.update).toHaveBeenCalledWith({
        where: { id: "existing-loc-id" },
        data: expect.objectContaining({
          street_name: "Calle Nueva",
          street_number: "20",
        }),
      });

      // AED updated
      expect(prisma.aed.update).toHaveBeenCalledWith({
        where: { id: "existing-aed-id" },
        data: expect.objectContaining({
          name: "Updated Name",
          latitude: 40.43,
          longitude: -3.72,
          data_source_id: DS_ID,
        }),
      });

      // Device created
      expect(prisma.aedDevice.create).toHaveBeenCalledOnce();

      // Stats
      expect(stats.updated).toBe(1);
      expect(stats.created).toBe(0);
    });

    it("creates schedule on update when AED had no schedule before", async () => {
      const existing = makeExistingAed({ schedule_id: null });

      const { processor } = makeProcessor(prisma);

      await processor(
        {
          _existingAed: existing,
          externalId: "EXT-001",
          name: "Test",
          weekdayOpening: "08:00",
          accessRestriction: "true",
          isPmrAccessible: "no",
        },
        context
      );

      expect(prisma.aedSchedule.create).toHaveBeenCalledOnce();
      const schedData = prisma.aedSchedule.create.mock.calls[0][0].data;
      expect(schedData.has_restricted_access).toBe(true);
      expect(schedData.is_pmr_accessible).toBe(false);
    });

    it("updates existing schedule when AED already has one", async () => {
      const existing = makeExistingAed({ schedule_id: "existing-sched-id" });

      const { processor } = makeProcessor(prisma);

      await processor(
        {
          _existingAed: existing,
          externalId: "EXT-001",
          name: "Test",
          weekdayOpening: "10:00",
          weekdayClosing: "20:00",
        },
        context
      );

      expect(prisma.aedSchedule.update).toHaveBeenCalledWith({
        where: { id: "existing-sched-id" },
        data: expect.objectContaining({
          weekday_opening: "10:00",
          weekday_closing: "20:00",
        }),
      });
      expect(prisma.aedSchedule.create).not.toHaveBeenCalled();
    });

    it("protects existing code (never overwrites non-null code)", async () => {
      const existing = makeExistingAed({ code: "EXISTING-CODE" });

      const { processor } = makeProcessor(prisma);

      await processor(
        {
          _existingAed: existing,
          externalId: "NEW-REF",
          name: "Test",
        },
        context
      );

      // Code should NOT be in the update
      const aedUpdate = prisma.aed.update.mock.calls[0][0].data;
      expect(aedUpdate.code).toBeUndefined();
    });

    it("assigns code from externalId when AED has no code", async () => {
      const existing = makeExistingAed({ code: null });

      const { processor } = makeProcessor(prisma);

      await processor(
        {
          _existingAed: existing,
          externalId: "REAL-CODE-001",
          name: "Test",
        },
        context
      );

      const aedUpdate = prisma.aed.update.mock.calls[0][0].data;
      expect(aedUpdate.code).toBe("REAL-CODE-001");
    });
  });

  // ----------------------------------------------------------
  // Use case 3: Verified AED protection (Tier 1)
  // ----------------------------------------------------------
  describe("verified AED protection", () => {
    it("only updates metadata for verified AEDs, NOT location/schedule/device", async () => {
      const existing = makeExistingAed({
        last_verified_at: new Date("2025-01-01"),
      });

      const { processor, stats } = makeProcessor(prisma);

      await processor(
        {
          _existingAed: existing,
          externalId: "EXT-001",
          name: "Should Not Update",
          latitude: "99.99",
          longitude: "-99.99",
          streetName: "Should Not Update",
          deviceBrand: "Should Not Update",
        },
        context
      );

      // Only AED update with metadata (last_synced_at, internal_notes)
      expect(prisma.aed.update).toHaveBeenCalledOnce();
      const updateData = prisma.aed.update.mock.calls[0][0].data;
      expect(updateData.last_synced_at).toBeDefined();
      expect(updateData.internal_notes).toBeDefined();
      // Name, coordinates, etc. NOT updated
      expect(updateData.name).toBeUndefined();
      expect(updateData.latitude).toBeUndefined();

      // Location NOT updated
      expect(prisma.aedLocation.update).not.toHaveBeenCalled();

      // Device NOT touched
      expect(prisma.aedDevice.create).not.toHaveBeenCalled();
      expect(prisma.aedDevice.update).not.toHaveBeenCalled();

      // External identifier IS registered
      expect(prisma.$executeRaw).toHaveBeenCalled();

      // Stats: still counts as updated
      expect(stats.updated).toBe(1);
    });
  });

  // ----------------------------------------------------------
  // Use case 4: Cross-source match → duplicate review
  // ----------------------------------------------------------
  describe("cross-source match (duplicate review)", () => {
    it("creates new AED with PENDING_REVIEW for cross-source matches", async () => {
      const existing = makeExistingAed({
        data_source_id: DS_OTHER, // different data source
      });
      prisma.aed.findUnique.mockResolvedValue(null); // no code conflict
      prisma.aedDevice.findFirst.mockResolvedValue(null);

      const { processor, stats } = makeProcessor(prisma);

      await processor(
        {
          _existingAed: existing,
          externalId: "CROSS-REF",
          name: "Duplicate Candidate",
          latitude: "40.42",
          longitude: "-3.71",
        },
        context
      );

      // Creates a NEW AED (not updates the existing one)
      expect(prisma.aed.create).toHaveBeenCalledOnce();
      const aedData = prisma.aed.create.mock.calls[0][0].data;
      expect(aedData.status).toBe("PENDING_REVIEW");
      expect(aedData.requires_attention).toBe(true);
      // Internal notes mention cross-source (appendInternalNote returns array of note objects)
      expect(JSON.stringify(aedData.internal_notes)).toContain("Cross-source");

      // Stats: counted as created
      expect(stats.created).toBe(1);
      expect(stats.updated).toBe(0);
    });
  });

  // ----------------------------------------------------------
  // Use case 5: Dry run
  // ----------------------------------------------------------
  describe("dry run", () => {
    it("does NOT create or update any entities in dry run mode", async () => {
      const { processor, stats } = makeProcessor(prisma, { dryRun: true });

      await processor(
        {
          name: "Test",
          externalId: "EXT-001",
          latitude: "40",
          longitude: "-3",
        },
        context
      );

      expect(prisma.aedLocation.create).not.toHaveBeenCalled();
      expect(prisma.aed.create).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();

      expect(stats.skipped).toBe(1);
    });
  });

  // ----------------------------------------------------------
  // Use case 6: Stats accumulation
  // ----------------------------------------------------------
  describe("stats accumulation", () => {
    it("accumulates stats across multiple records", async () => {
      prisma.aed.findUnique.mockResolvedValue(null);
      prisma.aedDevice.findFirst.mockResolvedValue(null);

      const { processor, stats } = makeProcessor(prisma);

      // Record 1: new
      await processor({ name: "New 1", latitude: "40", longitude: "-3" }, context);

      // Record 2: update
      await processor(
        { _existingAed: makeExistingAed(), externalId: "E1", name: "Updated" },
        context
      );

      // Record 3: new
      await processor({ name: "New 2", latitude: "41", longitude: "-4" }, context);

      expect(stats.created).toBe(2);
      expect(stats.updated).toBe(1);
      expect(stats.skipped).toBe(0);
    });
  });

  // ----------------------------------------------------------
  // Use case 7: responsible creation on update
  // ----------------------------------------------------------
  describe("responsible on update", () => {
    it("creates responsible when AED had none", async () => {
      const existing = makeExistingAed({ responsible_id: null });

      const { processor } = makeProcessor(prisma);

      await processor(
        {
          _existingAed: existing,
          externalId: "EXT-1",
          name: "Test",
          submitterName: "New Contact",
          submitterEmail: "new@example.com",
        },
        context
      );

      expect(prisma.aedResponsible.create).toHaveBeenCalledOnce();
    });

    it("updates responsible when AED already has one", async () => {
      const existing = makeExistingAed({ responsible_id: "existing-resp-id" });

      const { processor } = makeProcessor(prisma);

      await processor(
        {
          _existingAed: existing,
          externalId: "EXT-1",
          name: "Test",
          submitterName: "Updated Name",
        },
        context
      );

      expect(prisma.aedResponsible.update).toHaveBeenCalledWith({
        where: { id: "existing-resp-id" },
        data: expect.objectContaining({ name: "Updated Name" }),
      });
      expect(prisma.aedResponsible.create).not.toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------
  // Helpers: isRealExternalRef
  // ----------------------------------------------------------
  describe("external reference filtering", () => {
    it("does NOT register row-/api-/json- prefixed IDs as external identifiers", async () => {
      const { processor } = makeProcessor(prisma);

      // Create with auto-generated ref
      await processor(
        { name: "Test", externalId: "row-5", latitude: "40", longitude: "-3" },
        context
      );

      // $executeRaw should NOT have been called for external identifier
      // (only $transaction is called, not $executeRaw for the external_identifier upsert)
      const rawCalls = prisma.$executeRaw.mock.calls;
      expect(rawCalls.length).toBe(0);
    });
  });

  // ----------------------------------------------------------
  // Use case: locationDetails combines additionalInfo + specificLocation
  // ----------------------------------------------------------
  describe("location details combination", () => {
    it("combines additionalInfo and specificLocation into location_details", async () => {
      prisma.aed.findUnique.mockResolvedValue(null);

      const { processor } = makeProcessor(prisma);

      await processor(
        {
          name: "Test",
          latitude: "40",
          longitude: "-3",
          additionalInfo: "Planta 2",
          specificLocation: "Junto ascensor",
        },
        context
      );

      expect(prisma.aedLocation.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          location_details: "Planta 2. Junto ascensor",
        }),
      });
    });
  });

  // ----------------------------------------------------------
  // Corner cases
  // ----------------------------------------------------------
  describe("corner cases", () => {
    it("handles record with no name (defaults to 'Sin nombre')", async () => {
      prisma.aed.findUnique.mockResolvedValue(null);

      const { processor } = makeProcessor(prisma);

      await processor({ latitude: "40", longitude: "-3" }, context);

      const aedData = prisma.aed.create.mock.calls[0][0].data;
      expect(aedData.name).toBe("Sin nombre");
    });

    it("handles null coordinates in new AED", async () => {
      prisma.aed.findUnique.mockResolvedValue(null);

      const { processor } = makeProcessor(prisma);

      await processor({ name: "No coords" }, context);

      const aedData = prisma.aed.create.mock.calls[0][0].data;
      expect(aedData.latitude).toBeNull();
      expect(aedData.longitude).toBeNull();
    });

    it("handles existing AED with null data_source_id (first-time sync ownership)", async () => {
      const existing = makeExistingAed({ data_source_id: null });

      const { processor, stats } = makeProcessor(prisma);

      await processor({ _existingAed: existing, externalId: "EXT-1", name: "Test" }, context);

      // null data_source_id → isCrossSource is false → updateAed
      expect(prisma.aed.update).toHaveBeenCalledOnce();
      expect(stats.updated).toBe(1);
    });

    it("verified AED with null data_source_id gets assigned on sync", async () => {
      const existing = makeExistingAed({
        data_source_id: null,
        last_verified_at: new Date("2025-01-01"),
      });

      const { processor } = makeProcessor(prisma);

      await processor({ _existingAed: existing, externalId: "EXT-1", name: "Test" }, context);

      const updateData = prisma.aed.update.mock.calls[0][0].data;
      // data_source_id should be assigned since original was null
      expect(updateData.data_source_id).toBe(DS_ID);
    });

    it("ownershipType falls back to ownership for responsible name", async () => {
      prisma.aed.findUnique.mockResolvedValue(null);

      const { processor } = makeProcessor(prisma);

      await processor(
        {
          name: "Test",
          latitude: "40",
          longitude: "-3",
          ownershipType: "Privado",
        },
        context
      );

      const respData = prisma.aedResponsible.create.mock.calls[0][0].data;
      expect(respData.name).toBe("Privado");
      expect(respData.ownership).toBe("Privado");
    });

    it("responsible defaults to 'Sin nombre' when only email is provided", async () => {
      prisma.aed.findUnique.mockResolvedValue(null);

      const { processor } = makeProcessor(prisma);

      await processor(
        {
          name: "Test",
          latitude: "40",
          longitude: "-3",
          submitterEmail: "anon@example.com",
        },
        context
      );

      const respData = prisma.aedResponsible.create.mock.calls[0][0].data;
      expect(respData.name).toBe("Sin nombre");
    });

    it("automatic sync (non-MANUAL) does not change behavior in current implementation", async () => {
      prisma.aed.findUnique.mockResolvedValue(null);

      const { processor, stats } = makeProcessor(prisma, {
        syncFrequency: "DAILY",
      });

      await processor({ name: "Test", latitude: "40", longitude: "-3" }, context);

      expect(stats.created).toBe(1);
      expect(prisma.aed.create).toHaveBeenCalledOnce();
    });

    it("creates schedule from only has24hSurveillance field", async () => {
      prisma.aed.findUnique.mockResolvedValue(null);

      const { processor } = makeProcessor(prisma);

      await processor(
        {
          name: "Test",
          latitude: "40",
          longitude: "-3",
          has24hSurveillance: "true",
        },
        context
      );

      expect(prisma.aedSchedule.create).toHaveBeenCalledOnce();
      const schedData = prisma.aedSchedule.create.mock.calls[0][0].data;
      expect(schedData.has_24h_surveillance).toBe(true);
    });

    it("creates schedule from only accessRestriction field", async () => {
      prisma.aed.findUnique.mockResolvedValue(null);

      const { processor } = makeProcessor(prisma);

      await processor(
        {
          name: "Test",
          latitude: "40",
          longitude: "-3",
          accessRestriction: "true",
        },
        context
      );

      expect(prisma.aedSchedule.create).toHaveBeenCalledOnce();
    });

    it("creates schedule from only isPmrAccessible field", async () => {
      prisma.aed.findUnique.mockResolvedValue(null);

      const { processor } = makeProcessor(prisma);

      await processor(
        {
          name: "Test",
          latitude: "40",
          longitude: "-3",
          isPmrAccessible: "oui",
        },
        context
      );

      expect(prisma.aedSchedule.create).toHaveBeenCalledOnce();
      const schedData = prisma.aedSchedule.create.mock.calls[0][0].data;
      expect(schedData.is_pmr_accessible).toBe(true);
    });

    it("does NOT create schedule when only empty schedule fields exist", async () => {
      prisma.aed.findUnique.mockResolvedValue(null);

      const { processor } = makeProcessor(prisma);

      await processor(
        {
          name: "Test",
          latitude: "40",
          longitude: "-3",
          accessSchedule: "",
          weekdayOpening: null,
          accessRestriction: "",
        },
        context
      );

      expect(prisma.aedSchedule.create).not.toHaveBeenCalled();
    });

    it("source_details serializes raw data as JSON", async () => {
      prisma.aed.findUnique.mockResolvedValue(null);

      const { processor } = makeProcessor(prisma);

      await processor(
        {
          name: "Test",
          latitude: "40",
          longitude: "-3",
          _rawData: { original: "data", nested: { a: 1 } },
        },
        context
      );

      const aedData = prisma.aed.create.mock.calls[0][0].data;
      const parsed = JSON.parse(aedData.source_details);
      expect(parsed.original).toBe("data");
      expect(parsed.nested.a).toBe(1);
    });

    it("cross-source match still creates device data", async () => {
      const existing = makeExistingAed({ data_source_id: DS_OTHER });
      prisma.aed.findUnique.mockResolvedValue(null);
      prisma.aedDevice.findFirst.mockResolvedValue(null);

      const { processor } = makeProcessor(prisma);

      await processor(
        {
          _existingAed: existing,
          externalId: "CROSS-1",
          name: "Test",
          latitude: "40",
          longitude: "-3",
          deviceBrand: "Philips",
          deviceModel: "FRx",
        },
        context
      );

      expect(prisma.aedDevice.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          brand: "Philips",
          model: "FRx",
          is_current: true,
        }),
      });
    });

    it("coordinate with Spanish comma format", async () => {
      prisma.aed.findUnique.mockResolvedValue(null);

      const { processor } = makeProcessor(prisma);

      await processor({ name: "Test", latitude: "40,416775", longitude: "-3,703790" }, context);

      const aedData = prisma.aed.create.mock.calls[0][0].data;
      expect(aedData.latitude).toBeCloseTo(40.416775);
      expect(aedData.longitude).toBeCloseTo(-3.70379);
    });

    it("data source defaults are cached across multiple records", async () => {
      prisma.aed.findUnique.mockResolvedValue(null);

      const { processor } = makeProcessor(prisma);

      await processor({ name: "First", latitude: "40", longitude: "-3" }, context);
      await processor({ name: "Second", latitude: "41", longitude: "-4" }, context);

      // externalDataSource.findUnique should only be called once (cached)
      expect(prisma.externalDataSource.findUnique).toHaveBeenCalledTimes(1);
    });
  });
});
