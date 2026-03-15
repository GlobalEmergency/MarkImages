import { describe, it, expect, beforeEach } from "vitest";
import { createAedRecordProcessor } from "@/import/infrastructure/processors/aedRecordProcessor";
import { createMockPrisma, createMockContext } from "./helpers/mockPrisma";

describe("createAedRecordProcessor", () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  const context = createMockContext();

  beforeEach(() => {
    prisma = createMockPrisma();
  });

  // ----------------------------------------------------------
  // Use case: minimal AED creation (location only)
  // ----------------------------------------------------------
  it("creates AED with location when given minimal data", async () => {
    const processor = createAedRecordProcessor({ prisma: prisma as any, fileName: "test.csv" });

    await processor(
      {
        _aedId: "aed-uuid-1",
        proposedName: "Hospital Central",
        streetName: "Calle Mayor",
        streetNumber: "10",
        latitude: "40.42",
        longitude: "-3.71",
      },
      context
    );

    // Location created
    expect(prisma.aedLocation.create).toHaveBeenCalledOnce();
    expect(prisma.aedLocation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        street_name: "Calle Mayor",
        street_number: "10",
      }),
    });

    // AED created with location reference
    expect(prisma.aed.create).toHaveBeenCalledOnce();
    expect(prisma.aed.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: "aed-uuid-1",
        name: "Hospital Central",
        latitude: 40.42,
        longitude: -3.71,
        source_origin: "CSV_IMPORT",
        status: "DRAFT",
      }),
    });

    // No schedule, no responsible created
    expect(prisma.aedSchedule.create).not.toHaveBeenCalled();
    expect(prisma.aedResponsible.create).not.toHaveBeenCalled();
  });

  // ----------------------------------------------------------
  // Use case: AED with schedule
  // ----------------------------------------------------------
  it("creates schedule when schedule data is present", async () => {
    const processor = createAedRecordProcessor({ prisma: prisma as any });

    await processor(
      {
        proposedName: "Farmacia",
        streetName: "Gran Vía",
        streetNumber: "1",
        weekdayOpening: "09:00",
        weekdayClosing: "21:00",
        has24hSurveillance: "false",
        hasRestrictedAccess: "true",
        isPmrAccessible: "sí",
      },
      context
    );

    expect(prisma.aedSchedule.create).toHaveBeenCalledOnce();
    expect(prisma.aedSchedule.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        weekday_opening: "09:00",
        weekday_closing: "21:00",
        has_24h_surveillance: false,
        has_restricted_access: true,
        is_pmr_accessible: true,
      }),
    });

    // AED links to schedule
    const aedData = prisma.aed.create.mock.calls[0][0].data;
    expect(aedData.schedule_id).toBeDefined();
  });

  // ----------------------------------------------------------
  // Use case: accessRestriction fallback
  // ----------------------------------------------------------
  it("sets has_restricted_access from accessRestriction when hasRestrictedAccess is absent", async () => {
    const processor = createAedRecordProcessor({ prisma: prisma as any });

    await processor(
      {
        proposedName: "Test",
        streetName: "Test",
        streetNumber: "1",
        accessRestriction: "true",
      },
      context
    );

    expect(prisma.aedSchedule.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        has_restricted_access: true,
      }),
    });
  });

  // ----------------------------------------------------------
  // Use case: isPmrAccessible is nullable
  // ----------------------------------------------------------
  it("sets is_pmr_accessible to null when value is unknown", async () => {
    const processor = createAedRecordProcessor({ prisma: prisma as any });

    await processor(
      {
        proposedName: "Test",
        streetName: "Test",
        streetNumber: "1",
        isPmrAccessible: "maybe",
      },
      context
    );

    expect(prisma.aedSchedule.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        is_pmr_accessible: null,
      }),
    });
  });

  // ----------------------------------------------------------
  // Use case: AED with responsible
  // ----------------------------------------------------------
  it("creates responsible when responsible data is present", async () => {
    const processor = createAedRecordProcessor({ prisma: prisma as any });

    await processor(
      {
        proposedName: "Centro Deportivo",
        streetName: "Avenida",
        streetNumber: "5",
        submitterName: "Juan García",
        submitterEmail: "juan@example.com",
        submitterPhone: "+34600111222",
        ownership: "Ayuntamiento",
      },
      context
    );

    expect(prisma.aedResponsible.create).toHaveBeenCalledOnce();
    expect(prisma.aedResponsible.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "Juan García",
        email: "juan@example.com",
        phone: "+34600111222",
        ownership: "Ayuntamiento",
      }),
    });
  });

  // ----------------------------------------------------------
  // Use case: responsible defaults to "Sin especificar"
  // ----------------------------------------------------------
  it("defaults responsible name to 'Sin especificar' when only email is present", async () => {
    const processor = createAedRecordProcessor({ prisma: prisma as any });

    await processor(
      {
        proposedName: "Test",
        streetName: "Test",
        streetNumber: "1",
        submitterEmail: "contact@example.com",
      },
      context
    );

    expect(prisma.aedResponsible.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "Sin especificar",
        email: "contact@example.com",
      }),
    });
  });

  // ----------------------------------------------------------
  // Use case: AED with device data
  // ----------------------------------------------------------
  it("creates device when device data is present", async () => {
    const processor = createAedRecordProcessor({ prisma: prisma as any });
    prisma.aedDevice.findFirst.mockResolvedValue(null);

    await processor(
      {
        proposedName: "Metro Estación",
        streetName: "Línea 1",
        streetNumber: "s/n",
        deviceBrand: "Philips",
        deviceModel: "HeartStart FRx",
        deviceSerialNumber: "PHX-2024-001",
        deviceExpirationDate: "2029-06-30",
        deviceLastMaintenanceDate: "2025-01-15",
      },
      context
    );

    expect(prisma.aedDevice.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        brand: "Philips",
        model: "HeartStart FRx",
        serial_number: "PHX-2024-001",
        is_current: true,
      }),
    });
  });

  // ----------------------------------------------------------
  // Use case: organization assignment
  // ----------------------------------------------------------
  it("creates org assignment when organizationId is provided", async () => {
    const processor = createAedRecordProcessor({
      prisma: prisma as any,
      organizationId: "org-1",
      assignmentType: "MAINTENANCE",
      userId: "user-1",
    });

    await processor({ proposedName: "Test", streetName: "Test", streetNumber: "1" }, context);

    expect(prisma.aedOrganizationAssignment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organization_id: "org-1",
        assignment_type: "MAINTENANCE",
        status: "ACTIVE",
        assigned_by: "user-1",
      }),
    });
  });

  it("does not create org assignment when organizationId is absent", async () => {
    const processor = createAedRecordProcessor({ prisma: prisma as any });

    await processor({ proposedName: "Test", streetName: "Test", streetNumber: "1" }, context);

    expect(prisma.aedOrganizationAssignment.create).not.toHaveBeenCalled();
  });

  // ----------------------------------------------------------
  // Use case: coordinate parsing with comma (Spanish format)
  // ----------------------------------------------------------
  it("parses Spanish comma-notation coordinates", async () => {
    const processor = createAedRecordProcessor({ prisma: prisma as any });

    await processor(
      {
        proposedName: "Test",
        streetName: "Test",
        streetNumber: "1",
        latitude: "40,416775",
        longitude: "-3,703790",
      },
      context
    );

    const aedData = prisma.aed.create.mock.calls[0][0].data;
    expect(aedData.latitude).toBeCloseTo(40.416775);
    expect(aedData.longitude).toBeCloseTo(-3.70379);
  });

  // ----------------------------------------------------------
  // Use case: boolean parsing (multilingual)
  // ----------------------------------------------------------
  it("parses French 'oui' as true for has_24h_surveillance", async () => {
    const processor = createAedRecordProcessor({ prisma: prisma as any });

    await processor(
      {
        proposedName: "Test",
        streetName: "Test",
        streetNumber: "1",
        has24hSurveillance: "oui",
      },
      context
    );

    expect(prisma.aedSchedule.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        has_24h_surveillance: true,
      }),
    });
  });

  // ----------------------------------------------------------
  // Use case: full pipeline (location + schedule + responsible + device)
  // ----------------------------------------------------------
  it("creates all entities in a single transaction for complete record", async () => {
    const processor = createAedRecordProcessor({
      prisma: prisma as any,
      fileName: "import_2025.csv",
      organizationId: "org-1",
    });
    prisma.aedDevice.findFirst.mockResolvedValue(null);

    await processor(
      {
        _aedId: "full-aed-id",
        proposedName: "Centro Comercial Ejemplo",
        code: "DEA-2025-001",
        establishmentType: "Centro Comercial",
        streetType: "Avenida",
        streetName: "de la Constitución",
        streetNumber: "15",
        postalCode: "28001",
        latitude: "40.42",
        longitude: "-3.71",
        weekdayOpening: "10:00",
        weekdayClosing: "22:00",
        has24hSurveillance: "false",
        hasRestrictedAccess: "false",
        isPmrAccessible: "sí",
        submitterName: "Gestión Inmobiliaria",
        submitterEmail: "gestion@ejemplo.com",
        ownership: "Privado",
        deviceBrand: "Cardiac Science",
        deviceModel: "Powerheart G5",
      },
      context
    );

    // All entities created
    expect(prisma.aedLocation.create).toHaveBeenCalledOnce();
    expect(prisma.aedSchedule.create).toHaveBeenCalledOnce();
    expect(prisma.aedResponsible.create).toHaveBeenCalledOnce();
    expect(prisma.aed.create).toHaveBeenCalledOnce();
    expect(prisma.aedDevice.create).toHaveBeenCalledOnce();
    expect(prisma.aedOrganizationAssignment.create).toHaveBeenCalledOnce();

    // AED has correct data
    const aedData = prisma.aed.create.mock.calls[0][0].data;
    expect(aedData.id).toBe("full-aed-id");
    expect(aedData.name).toBe("Centro Comercial Ejemplo");
    expect(aedData.code).toBe("DEA-2025-001");
    expect(aedData.source_details).toContain("import_2025.csv");
    expect(aedData.status).toBe("DRAFT");

    // Schedule correct
    const schedData = prisma.aedSchedule.create.mock.calls[0][0].data;
    expect(schedData.is_pmr_accessible).toBe(true);
    expect(schedData.has_restricted_access).toBe(false);

    // Transaction was used
    expect(prisma.$transaction).toHaveBeenCalledOnce();
  });

  // ----------------------------------------------------------
  // Corner cases
  // ----------------------------------------------------------
  describe("corner cases", () => {
    it("generates UUID when _aedId is not provided", async () => {
      const processor = createAedRecordProcessor({ prisma: prisma as any });

      await processor({ proposedName: "Test", streetName: "Calle", streetNumber: "1" }, context);

      const aedData = prisma.aed.create.mock.calls[0][0].data;
      // Should be a valid UUID (36 chars with hyphens)
      expect(aedData.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });

    it("handles null/undefined coordinates gracefully", async () => {
      const processor = createAedRecordProcessor({ prisma: prisma as any });

      await processor(
        { proposedName: "No coords", streetName: "Test", streetNumber: "1" },
        context
      );

      const aedData = prisma.aed.create.mock.calls[0][0].data;
      expect(aedData.latitude).toBeUndefined();
      expect(aedData.longitude).toBeUndefined();
    });

    it("handles empty string name (trims to empty)", async () => {
      const processor = createAedRecordProcessor({ prisma: prisma as any });

      await processor({ proposedName: "   ", streetName: "Test", streetNumber: "1" }, context);

      const aedData = prisma.aed.create.mock.calls[0][0].data;
      expect(aedData.name).toBe(""); // trimmed empty
    });

    it("handles coordinate value '0' (valid, Gulf of Guinea)", async () => {
      const processor = createAedRecordProcessor({ prisma: prisma as any });

      await processor(
        {
          proposedName: "Zero coords",
          streetName: "Test",
          streetNumber: "1",
          latitude: "0",
          longitude: "0",
        },
        context
      );

      const aedData = prisma.aed.create.mock.calls[0][0].data;
      expect(aedData.latitude).toBe(0);
      expect(aedData.longitude).toBe(0);
    });

    it("does NOT create schedule when only empty schedule fields exist", async () => {
      const processor = createAedRecordProcessor({ prisma: prisma as any });

      await processor(
        {
          proposedName: "Test",
          streetName: "Test",
          streetNumber: "1",
          weekdayOpening: "",
          weekdayClosing: null,
          has24hSurveillance: "",
        },
        context
      );

      // Empty/null/falsy values → hasScheduleData returns false
      expect(prisma.aedSchedule.create).not.toHaveBeenCalled();
    });

    it("creates schedule when only isPmrAccessible is set", async () => {
      const processor = createAedRecordProcessor({ prisma: prisma as any });

      await processor(
        {
          proposedName: "Test",
          streetName: "Test",
          streetNumber: "1",
          isPmrAccessible: "sí",
        },
        context
      );

      expect(prisma.aedSchedule.create).toHaveBeenCalledOnce();
      expect(prisma.aedSchedule.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ is_pmr_accessible: true }),
      });
    });

    it("toStringOrNull trims and returns null for whitespace-only", async () => {
      const processor = createAedRecordProcessor({ prisma: prisma as any });

      await processor(
        {
          proposedName: "Test",
          streetName: "Test",
          streetNumber: "1",
          code: "   ",
          externalReference: "\t",
          establishmentType: "  valid  ",
        },
        context
      );

      const aedData = prisma.aed.create.mock.calls[0][0].data;
      expect(aedData.code).toBeNull(); // whitespace → null
      expect(aedData.external_reference).toBeNull();
      expect(aedData.establishment_type).toBe("valid"); // trimmed
    });

    it("parseBooleanOrNull returns false for 'non' (French no)", async () => {
      const processor = createAedRecordProcessor({ prisma: prisma as any });

      await processor(
        {
          proposedName: "Test",
          streetName: "Test",
          streetNumber: "1",
          isPmrAccessible: "non",
        },
        context
      );

      const schedData = prisma.aedSchedule.create.mock.calls[0][0].data;
      expect(schedData.is_pmr_accessible).toBe(false);
    });

    it("handles multiple Spanish boolean formats", async () => {
      const processor = createAedRecordProcessor({ prisma: prisma as any });

      // "verdadero" for has24hSurveillance, "s" for hasRestrictedAccess
      await processor(
        {
          proposedName: "Test",
          streetName: "Test",
          streetNumber: "1",
          has24hSurveillance: "verdadero",
          hasRestrictedAccess: "s",
        },
        context
      );

      const schedData = prisma.aedSchedule.create.mock.calls[0][0].data;
      expect(schedData.has_24h_surveillance).toBe(true);
      expect(schedData.has_restricted_access).toBe(true);
    });

    it("uses context.jobId for batch_job_id reference", async () => {
      const processor = createAedRecordProcessor({ prisma: prisma as any });
      const ctx = createMockContext({ jobId: "my-job-123" });

      await processor({ proposedName: "Test", streetName: "Test", streetNumber: "1" }, ctx);

      const aedData = prisma.aed.create.mock.calls[0][0].data;
      expect(aedData.batch_job_id).toBe("my-job-123");
    });
  });
});
