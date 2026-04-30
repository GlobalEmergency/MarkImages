/**
 * Nominatim Reverse Geocoding Utility
 *
 * Uses the public Nominatim (OpenStreetMap) API to derive geographic hierarchy
 * from coordinates. Works worldwide — no API key required.
 *
 * Rate limit: 1 request/second (OSM policy for public API).
 * Concurrency-safe via promise-chain serialization.
 * @see https://operations.osmfoundation.org/policies/nominatim/
 */

const NOMINATIM_BASE_URL = "https://nominatim.openstreetmap.org";
const USER_AGENT = "DeaMap/1.0 (https://deamap.es)";
const TIMEOUT_MS = 15_000;
const MIN_INTERVAL_MS = 1_100; // ~1 req/s with safety margin

/**
 * Promise chain to serialize concurrent requests.
 * Each call waits for the previous one to complete + the rate limit interval.
 */
let requestChain: Promise<void> = Promise.resolve();

function enqueueThrottle(): Promise<void> {
  const next = requestChain.then(
    () => new Promise<void>((resolve) => setTimeout(resolve, MIN_INTERVAL_MS))
  );
  requestChain = next;
  return next;
}

export interface ReverseGeocodeResult {
  /** ISO 3166-1 alpha-2 country code (e.g., "ES", "FR", "DE") */
  countryCode: string;
  /** First-level admin division (e.g., "Comunidad de Madrid", "ÃŽle-de-France") */
  adminLevel1: string | null;
  /** City, town, or village name */
  city: string | null;
  /** Postal code */
  postalCode: string | null;
  /** Province/county (admin_level_2 equivalent) */
  province: string | null;
  /** Raw address object from Nominatim */
  rawAddress: Record<string, string>;
}

/**
 * Reverse geocode coordinates to get administrative hierarchy.
 *
 * @param lat Latitude
 * @param lon Longitude
 * @param retries Max retries (default 3)
 * @returns Geographic hierarchy or null if geocoding fails
 */
export async function reverseGeocode(
  lat: number,
  lon: number,
  retries = 3
): Promise<ReverseGeocodeResult | null> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      await enqueueThrottle();

      const url = `${NOMINATIM_BASE_URL}/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1&accept-language=es`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const response = await fetch(url, {
        headers: { "User-Agent": USER_AGENT },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (response.status === 429) {
        // Rate limited — wait longer before retry
        await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
        continue;
      }

      if (!response.ok) {
        if (attempt < retries - 1) continue;
        return null;
      }

      const data = await response.json();

      if (data.error) return null;

      const address = data.address || {};

      return {
        countryCode: (address.country_code || "").toUpperCase(),
        adminLevel1: address.state || address.region || null,
        city: address.city || address.town || address.village || address.municipality || null,
        postalCode: address.postcode || null,
        province: address.province || address.county || address.state_district || null,
        rawAddress: address,
      };
    } catch {
      if (attempt < retries - 1) {
        // Exponential backoff
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
        continue;
      }
      return null;
    }
  }
  return null;
}
