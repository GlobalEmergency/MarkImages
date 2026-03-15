/**
 * Device Helpers — Shared logic for creating/updating AedDevice records
 *
 * Used by both syncRecordProcessor (external API sync) and
 * aedRecordProcessor (CSV import) to avoid duplicating device logic.
 */

import type { PrismaClient } from "@/generated/client/client";

/** Prisma transaction client (same type used in $transaction callbacks) */
type TxClient = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

const DEVICE_FIELDS = [
  "deviceBrand",
  "deviceModel",
  "deviceSerialNumber",
  "deviceManufacturingDate",
  "deviceInstallationDate",
  "deviceExpirationDate",
  "deviceLastMaintenanceDate",
  "isMobileUnit",
] as const;

/**
 * Checks if the record contains any device-related data.
 */
export function hasDeviceData(data: Record<string, unknown>): boolean {
  return DEVICE_FIELDS.some((field) => {
    const value = data[field];
    return value !== null && value !== undefined && String(value).trim() !== "";
  });
}

/**
 * Parses a date string to a Date object, returning null on invalid input.
 */
function parseDateOrNull(value: unknown): Date | null {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  if (!str) return null;
  const date = new Date(str);
  return isNaN(date.getTime()) ? null : date;
}

function toStringOrNull(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  return str || null;
}

/**
 * Creates or updates the current device for an AED.
 *
 * - If the AED already has a current device → updates it.
 * - If no current device exists → creates one with is_current = true.
 * - Only executes if the record contains device data (brand, model, serial, etc.).
 *
 * This is a no-op if hasDeviceData() returns false.
 */
export async function createOrUpdateDevice(
  tx: TxClient,
  aedId: string,
  data: Record<string, unknown>
): Promise<void> {
  if (!hasDeviceData(data)) return;

  const isMobile = String(data.isMobileUnit ?? "")
    .toLowerCase()
    .trim();

  const deviceData = {
    brand: toStringOrNull(data.deviceBrand),
    model: toStringOrNull(data.deviceModel),
    serial_number: toStringOrNull(data.deviceSerialNumber),
    manufacturing_date: parseDateOrNull(data.deviceManufacturingDate),
    installation_date: parseDateOrNull(data.deviceInstallationDate),
    expiration_date: parseDateOrNull(data.deviceExpirationDate),
    last_maintenance_date: parseDateOrNull(data.deviceLastMaintenanceDate),
    is_mobile: isMobile === "true" || isMobile === "t" || isMobile === "1" || isMobile === "oui",
  };

  // Find existing current device for this AED
  const currentDevice = await tx.aedDevice.findFirst({
    where: { aed_id: aedId, is_current: true },
    select: { id: true },
  });

  if (currentDevice) {
    await tx.aedDevice.update({
      where: { id: currentDevice.id },
      data: deviceData,
    });
  } else {
    await tx.aedDevice.create({
      data: {
        aed_id: aedId,
        ...deviceData,
        is_current: true,
      },
    });
  }
}
