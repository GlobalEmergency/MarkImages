/**
 * Pure function that maps the simplified DEA form data into the API request payload.
 *
 * This is intentionally framework-agnostic (no React, no fetch) so it can be
 * unit-tested without mocking.
 *
 * Follows the Interface Segregation Principle: consumers only pass what they have.
 */

interface SimpleDeaFormData {
  // Location
  latitude: string;
  longitude: string;
  street: string;
  number: string;
  city: string;
  postalCode: string;

  // Details
  name: string;
  establishmentType: string;
  observations: string;

  // Extra details
  accessDescription: string;
  floor: string;
  specificLocation: string;
  scheduleDescription: string;
}

interface ImagePayload {
  original_url: string;
  type: string;
  order: number;
}

interface AedApiPayload {
  name: string;
  establishment_type?: string;
  latitude?: number;
  longitude?: number;
  origin_observations?: string;
  source_details: string;
  location: {
    street_name?: string;
    street_number?: string;
    postal_code?: string;
    city_name?: string;
    access_instructions?: string;
    floor?: string;
    location_details?: string;
  };
  images?: ImagePayload[];
}

/**
 * Merges the user's observations with structured extra-detail fields
 * into a single text block.
 *
 * Each extra-detail field is prefixed with a label so admins can parse it.
 */
function buildObservations(form: SimpleDeaFormData): string {
  const parts: string[] = [];

  if (form.observations) parts.push(form.observations);
  if (form.accessDescription) parts.push(`Acceso: ${form.accessDescription}`);
  if (form.floor) parts.push(`Planta: ${form.floor}`);
  if (form.specificLocation) parts.push(`Ubicación específica: ${form.specificLocation}`);
  if (form.scheduleDescription) parts.push(`Horario: ${form.scheduleDescription}`);

  return parts.join("\n");
}

/**
 * Build the API payload from form data and (optionally) uploaded images.
 *
 * @param form   The form state from the wizard
 * @param images Uploaded image payloads (empty array if none)
 * @returns      A plain object ready to be JSON.stringify'd and POST'd to /api/aeds
 */
export function buildAedPayload(
  form: SimpleDeaFormData,
  images: ImagePayload[] = []
): AedApiPayload {
  const hasCoords = form.latitude !== "" && form.longitude !== "";

  const observations = buildObservations(form);

  return {
    name: form.name,
    establishment_type: form.establishmentType || undefined,
    latitude: hasCoords ? parseFloat(form.latitude) : undefined,
    longitude: hasCoords ? parseFloat(form.longitude) : undefined,
    origin_observations: observations || undefined,
    source_details: hasCoords
      ? "Formulario simplificado v2 - con geolocalización"
      : "Formulario simplificado v2 - dirección sin geocodificar",
    location: {
      street_name: form.street || undefined,
      street_number: form.number || undefined,
      postal_code: form.postalCode || undefined,
      city_name: form.city || undefined,
      access_instructions: form.accessDescription || undefined,
      floor: form.floor || undefined,
      location_details: form.specificLocation || undefined,
    },
    images: images.length > 0 ? images : undefined,
  };
}

/** Re-export for tests */
export { buildObservations };
export type { SimpleDeaFormData, AedApiPayload, ImagePayload };
