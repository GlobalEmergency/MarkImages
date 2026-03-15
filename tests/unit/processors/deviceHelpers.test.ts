import { describe, it, expect, beforeEach } from "vitest";
import {
  hasDeviceData,
  createOrUpdateDevice,
} from "@/import/infrastructure/processors/deviceHelpers";
import { createMockPrisma } from "./helpers/mockPrisma";

describe("deviceHelpers", () => {
  // ----------------------------------------------------------
  // hasDeviceData — pure logic, no mocks needed
  // ----------------------------------------------------------
  describe("hasDeviceData", () => {
    it("returns false for empty record", () => {
      expect(hasDeviceData({})).toBe(false);
    });

    it("returns false when device fields are null/undefined/empty", () => {
      expect(
        hasDeviceData({ deviceBrand: null, deviceModel: undefined, deviceSerialNumber: "" })
      ).toBe(false);
    });

    it("returns true when brand is present", () => {
      expect(hasDeviceData({ deviceBrand: "Philips" })).toBe(true);
    });

    it("returns true when model is present", () => {
      expect(hasDeviceData({ deviceModel: "FRx" })).toBe(true);
    });

    it("returns true when serial number is present", () => {
      expect(hasDeviceData({ deviceSerialNumber: "SN-12345" })).toBe(true);
    });

    it("returns true when manufacturing date is present", () => {
      expect(hasDeviceData({ deviceManufacturingDate: "2023-01-15" })).toBe(true);
    });

    it("returns true when installation date is present", () => {
      expect(hasDeviceData({ deviceInstallationDate: "2024-03-01" })).toBe(true);
    });

    it("returns true when expiration date is present", () => {
      expect(hasDeviceData({ deviceExpirationDate: "2028-12-31" })).toBe(true);
    });

    it("returns true when last maintenance date is present", () => {
      expect(hasDeviceData({ deviceLastMaintenanceDate: "2025-06-01" })).toBe(true);
    });

    it("returns true when isMobileUnit is present", () => {
      expect(hasDeviceData({ isMobileUnit: "true" })).toBe(true);
    });

    it("ignores non-device fields", () => {
      expect(hasDeviceData({ name: "Hospital", city: "Madrid" })).toBe(false);
    });
  });

  // ----------------------------------------------------------
  // createOrUpdateDevice — use case tests with Prisma mock
  // ----------------------------------------------------------
  describe("createOrUpdateDevice", () => {
    let prisma: ReturnType<typeof createMockPrisma>;

    beforeEach(() => {
      prisma = createMockPrisma();
    });

    it("does nothing when record has no device data", async () => {
      await createOrUpdateDevice(prisma as any, "aed-1", { name: "Test" });

      expect(prisma.aedDevice.create).not.toHaveBeenCalled();
      expect(prisma.aedDevice.update).not.toHaveBeenCalled();
      expect(prisma.aedDevice.findFirst).not.toHaveBeenCalled();
    });

    it("creates a new device when no current device exists", async () => {
      prisma.aedDevice.findFirst.mockResolvedValue(null);

      await createOrUpdateDevice(prisma as any, "aed-1", {
        deviceBrand: "Philips",
        deviceModel: "FRx",
        deviceSerialNumber: "SN-001",
      });

      expect(prisma.aedDevice.findFirst).toHaveBeenCalledWith({
        where: { aed_id: "aed-1", is_current: true },
        select: { id: true },
      });
      expect(prisma.aedDevice.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          aed_id: "aed-1",
          brand: "Philips",
          model: "FRx",
          serial_number: "SN-001",
          is_current: true,
          is_mobile: false,
        }),
      });
    });

    it("updates existing device when current device exists", async () => {
      prisma.aedDevice.findFirst.mockResolvedValue({ id: "device-existing" });

      await createOrUpdateDevice(prisma as any, "aed-1", {
        deviceBrand: "Zoll",
        deviceModel: "AED Plus",
      });

      expect(prisma.aedDevice.update).toHaveBeenCalledWith({
        where: { id: "device-existing" },
        data: expect.objectContaining({
          brand: "Zoll",
          model: "AED Plus",
        }),
      });
      expect(prisma.aedDevice.create).not.toHaveBeenCalled();
    });

    it("parses isMobileUnit correctly for various true values", async () => {
      for (const val of ["true", "t", "1", "oui"]) {
        prisma.aedDevice.findFirst.mockResolvedValue(null);
        prisma.aedDevice.create.mockClear();

        await createOrUpdateDevice(prisma as any, "aed-1", {
          deviceBrand: "Test",
          isMobileUnit: val,
        });

        expect(prisma.aedDevice.create).toHaveBeenCalledWith({
          data: expect.objectContaining({ is_mobile: true }),
        });
      }
    });

    it("parses isMobileUnit as false for non-truthy values", async () => {
      prisma.aedDevice.findFirst.mockResolvedValue(null);

      await createOrUpdateDevice(prisma as any, "aed-1", {
        deviceBrand: "Test",
        isMobileUnit: "no",
      });

      expect(prisma.aedDevice.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ is_mobile: false }),
      });
    });

    it("parses dates correctly", async () => {
      prisma.aedDevice.findFirst.mockResolvedValue(null);

      await createOrUpdateDevice(prisma as any, "aed-1", {
        deviceBrand: "Test",
        deviceManufacturingDate: "2023-01-15",
        deviceInstallationDate: "2024-06-01",
        deviceExpirationDate: "2028-12-31",
        deviceLastMaintenanceDate: "2025-03-10",
      });

      const createCall = prisma.aedDevice.create.mock.calls[0][0].data;
      expect(createCall.manufacturing_date).toEqual(new Date("2023-01-15"));
      expect(createCall.installation_date).toEqual(new Date("2024-06-01"));
      expect(createCall.expiration_date).toEqual(new Date("2028-12-31"));
      expect(createCall.last_maintenance_date).toEqual(new Date("2025-03-10"));
    });

    it("returns null for invalid date strings", async () => {
      prisma.aedDevice.findFirst.mockResolvedValue(null);

      await createOrUpdateDevice(prisma as any, "aed-1", {
        deviceBrand: "Test",
        deviceManufacturingDate: "not-a-date",
        deviceExpirationDate: "",
      });

      const createCall = prisma.aedDevice.create.mock.calls[0][0].data;
      expect(createCall.manufacturing_date).toBeNull();
      expect(createCall.expiration_date).toBeNull();
    });

    // Corner cases
    it("handles whitespace-only device fields as no data", async () => {
      await createOrUpdateDevice(prisma as any, "aed-1", {
        deviceBrand: "   ",
        deviceModel: "  ",
        deviceSerialNumber: "\t",
      });

      // All values are whitespace → hasDeviceData returns false → no-op
      expect(prisma.aedDevice.findFirst).not.toHaveBeenCalled();
    });

    it("handles null values for all string fields gracefully", async () => {
      prisma.aedDevice.findFirst.mockResolvedValue(null);

      await createOrUpdateDevice(prisma as any, "aed-1", {
        deviceBrand: null,
        deviceModel: null,
        deviceSerialNumber: "SN-ONLY", // one real value triggers creation
      });

      const createCall = prisma.aedDevice.create.mock.calls[0][0].data;
      expect(createCall.brand).toBeNull();
      expect(createCall.model).toBeNull();
      expect(createCall.serial_number).toBe("SN-ONLY");
    });

    it("handles isMobileUnit as undefined (falsy)", async () => {
      prisma.aedDevice.findFirst.mockResolvedValue(null);

      await createOrUpdateDevice(prisma as any, "aed-1", {
        deviceBrand: "Test",
        // isMobileUnit not set at all
      });

      const createCall = prisma.aedDevice.create.mock.calls[0][0].data;
      expect(createCall.is_mobile).toBe(false);
    });

    it("handles ISO date with time component", async () => {
      prisma.aedDevice.findFirst.mockResolvedValue(null);

      await createOrUpdateDevice(prisma as any, "aed-1", {
        deviceBrand: "Test",
        deviceInstallationDate: "2024-06-15T14:30:00Z",
      });

      const createCall = prisma.aedDevice.create.mock.calls[0][0].data;
      expect(createCall.installation_date).toEqual(new Date("2024-06-15T14:30:00Z"));
    });

    it("handles European date formats (DD/MM/YYYY may be ambiguous)", async () => {
      prisma.aedDevice.findFirst.mockResolvedValue(null);

      // "15/06/2024" → Date() interprets as invalid or MM/DD depending on engine
      await createOrUpdateDevice(prisma as any, "aed-1", {
        deviceBrand: "Test",
        deviceManufacturingDate: "2024-06-15", // ISO format is unambiguous
      });

      const createCall = prisma.aedDevice.create.mock.calls[0][0].data;
      expect(createCall.manufacturing_date).toEqual(new Date("2024-06-15"));
    });
  });
});
