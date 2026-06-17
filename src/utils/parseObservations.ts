/**
 * Utility to parse and format observations from JSON or plain text
 */

export interface ParsedObservations {
  isJson: boolean;
  rawText?: string;
  data?: {
    // General Information
    provisionalNumber?: string;
    establishmentType?: string;
    localOwnership?: string;
    ownership?: string;
    localUse?: string;
    entrance?: string;

    // Location
    streetType?: string;
    streetName?: string;
    streetNumber?: string;
    postalCode?: string;
    district?: string;
    neighborhood?: string;
    latitude?: number;
    longitude?: number;

    // Schedule
    scheduleDescription?: string;

    // Access
    accessDescription?: string;

    // Photos
    photoUrl?: string;
    photo2Url?: string;

    // Other fields
    [key: string]: unknown;
  };
}

/**
 * Try to parse observations as JSON, fall back to plain text
 */
export function parseObservations(observations: string | null | undefined): ParsedObservations {
  if (!observations) {
    return { isJson: false };
  }

  // Try to parse as JSON
  try {
    const parsed = JSON.parse(observations);
    if (typeof parsed === "object" && parsed !== null) {
      return {
        isJson: true,
        data: parsed,
      };
    }
  } catch {
    // Not JSON, treat as plain text
  }

  // Plain text fallback
  return {
    isJson: false,
    rawText: observations,
  };
}

/**
 * Format street address from parsed data
 */
export function formatAddress(data?: ParsedObservations["data"]): string | null {
  if (!data) return null;

  const parts: string[] = [];

  if (data.streetType) parts.push(data.streetType);
  if (data.streetName) parts.push(data.streetName);
  if (data.streetNumber) parts.push(data.streetNumber);

  return parts.length > 0 ? parts.join(" ") : null;
}

/**
 * Format district and neighborhood
 */
export function formatDistrictInfo(data?: ParsedObservations["data"]): string | null {
  if (!data) return null;

  const parts: string[] = [];

  if (data.district) parts.push(data.district);
  if (data.neighborhood) parts.push(data.neighborhood);

  return parts.length > 0 ? parts.join(" - ") : null;
}

/**
 * Get all "other" fields not explicitly handled
 */
export function getOtherFields(data?: ParsedObservations["data"]): Record<string, unknown> {
  if (!data) return {};

  const knownFields = new Set([
    "provisionalNumber",
    "establishmentType",
    "localOwnership",
    "ownership",
    "localUse",
    "entrance",
    "streetType",
    "streetName",
    "streetNumber",
    "postalCode",
    "district",
    "neighborhood",
    "latitude",
    "longitude",
    "scheduleDescription",
    "accessDescription",
    "photoUrl",
    "photo2Url",
  ]);

  const otherFields: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (!knownFields.has(key) && value !== null && value !== undefined && value !== "") {
      otherFields[key] = value;
    }
  }

  return otherFields;
}

/**
 * Format a field name for display (camelCase to readable)
 */
export function formatFieldName(fieldName: string): string {
  // Add space before capital letters and capitalize first letter
  return fieldName
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}
