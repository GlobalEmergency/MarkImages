/**
 * Publication Filter Utility
 *
 * Filters AED data based on publication_mode to control
 * what information is visible to the public.
 */

import type { PublicationMode } from "@/generated/client/client";

/**
 * Complete AED data structure (all fields)
 */
export interface AedFullData {
  id: string;
  code: string | null;
  name: string;
  establishment_type?: string | null;
  latitude: number | null;
  longitude: number | null;
  published_at?: Date | null;
  publication_mode: PublicationMode;

  location?: {
    id?: string;
    street_type: string | null;
    street_name: string | null;
    street_number: string | null;
    postal_code: string | null;
    city_name?: string | null;
    city_code?: string | null;
    district_code?: string | null;
    district_name?: string | null;
    neighborhood_code?: string | null;
    neighborhood_name?: string | null;
    floor?: string | null;
    location_details?: string | null;
    access_instructions?: string | null;
  } | null;

  schedule?: {
    id?: string;
    description?: string | null;
    has_24h_surveillance: boolean;
    has_restricted_access?: boolean;
    weekday_opening: string | null;
    weekday_closing: string | null;
    saturday_opening?: string | null;
    saturday_closing?: string | null;
    sunday_opening?: string | null;
    sunday_closing?: string | null;
    holidays_as_weekday?: boolean;
    closed_on_holidays?: boolean;
    closed_in_august?: boolean;
    notes?: string | null;
  } | null;

  responsible?: {
    id?: string;
    name: string;
    email: string | null;
    phone: string | null;
    alternative_phone?: string | null;
    ownership?: string | null;
    local_ownership?: string | null;
    local_use?: string | null;
    organization?: string | null;
    position?: string | null;
    department?: string | null;
    notes?: Record<string, unknown>[] | null;
  } | null;

  images?: Array<{
    id: string;
    type: string;
    original_url: string;
    processed_url: string | null;
    thumbnail_url: string | null;
    order: number;
  }>;
}

/**
 * Filtered AED data (partial based on publication_mode)
 */
export type AedFilteredData = Partial<AedFullData>;

/**
 * Filters AED data based on publication_mode
 *
 * Publication Modes:
 * - NONE: No data returned (should not be public)
 * - LOCATION_ONLY: Only basic identification + location data
 * - BASIC_INFO: Location + schedule + establishment type
 * - FULL: All information including photos, responsible, contact details
 *
 * @param aed - Complete AED data object
 * @returns Filtered AED data according to publication_mode
 */
export function filterAedByPublicationMode(aed: AedFullData): AedFilteredData | null {
  // NONE: Not visible publicly - return null
  if (aed.publication_mode === "NONE") {
    return null;
  }

  // Base data always included (minimal identification)
  const base = {
    id: aed.id,
    code: aed.code,
    name: aed.name,
    latitude: aed.latitude,
    longitude: aed.longitude,
    publication_mode: aed.publication_mode,
  };

  // LOCATION_ONLY: Location data + schedule (schedule is essential for users)
  if (aed.publication_mode === "LOCATION_ONLY") {
    return {
      ...base,
      location: aed.location
        ? {
            id: aed.location.id,
            city_name: aed.location.city_name,
            postal_code: aed.location.postal_code,
            district_name: aed.location.district_name,
            neighborhood_name: aed.location.neighborhood_name,
            street_type: aed.location.street_type,
            street_name: aed.location.street_name,
            street_number: aed.location.street_number,
            floor: aed.location.floor,
            location_details: aed.location.location_details,
            // Explicitly exclude sensitive fields
            city_code: null,
            district_code: null,
            neighborhood_code: null,
            access_instructions: null,
          }
        : null,
      schedule: aed.schedule
        ? {
            id: aed.schedule.id,
            description: aed.schedule.description,
            has_24h_surveillance: aed.schedule.has_24h_surveillance,
            has_restricted_access: aed.schedule.has_restricted_access,
            weekday_opening: aed.schedule.weekday_opening,
            weekday_closing: aed.schedule.weekday_closing,
            saturday_opening: aed.schedule.saturday_opening,
            saturday_closing: aed.schedule.saturday_closing,
            sunday_opening: aed.schedule.sunday_opening,
            sunday_closing: aed.schedule.sunday_closing,
          }
        : null,
    };
  }

  // BASIC_INFO: Location + schedule + establishment type
  if (aed.publication_mode === "BASIC_INFO") {
    return {
      ...base,
      establishment_type: aed.establishment_type,
      location: aed.location
        ? {
            ...aed.location,
          }
        : null,
      schedule: aed.schedule
        ? {
            id: aed.schedule.id,
            description: aed.schedule.description,
            has_24h_surveillance: aed.schedule.has_24h_surveillance,
            has_restricted_access: aed.schedule.has_restricted_access,
            weekday_opening: aed.schedule.weekday_opening,
            weekday_closing: aed.schedule.weekday_closing,
            saturday_opening: aed.schedule.saturday_opening,
            saturday_closing: aed.schedule.saturday_closing,
            sunday_opening: aed.schedule.sunday_opening,
            sunday_closing: aed.schedule.sunday_closing,
            holidays_as_weekday: aed.schedule.holidays_as_weekday,
            closed_on_holidays: aed.schedule.closed_on_holidays,
            closed_in_august: aed.schedule.closed_in_august,
            notes: aed.schedule.notes,
          }
        : null,
    };
  }

  // FULL: All information
  if (aed.publication_mode === "FULL") {
    return aed;
  }

  // Fallback: return base data
  return base;
}

/**
 * Helper to check if a publication_mode should be visible on the map
 */
export function isPubliclyVisible(publicationMode: PublicationMode): boolean {
  return publicationMode !== "NONE";
}

/**
 * Helper to get human-readable label for publication_mode
 */
export function getPublicationModeLabel(mode: PublicationMode): string {
  switch (mode) {
    case "NONE":
      return "No publicado";
    case "LOCATION_ONLY":
      return "Solo ubicación";
    case "BASIC_INFO":
      return "Información básica";
    case "FULL":
      return "Información completa";
    default:
      return "Desconocido";
  }
}

/**
 * Helper to get description for publication_mode
 */
export function getPublicationModeDescription(mode: PublicationMode): string {
  switch (mode) {
    case "NONE":
      return "No visible públicamente";
    case "LOCATION_ONLY":
      return "Solo datos de ubicación (sin contacto ni horarios)";
    case "BASIC_INFO":
      return "Ubicación + horarios + tipo de establecimiento";
    case "FULL":
      return "Toda la información: fotos, responsable, contacto";
    default:
      return "";
  }
}
