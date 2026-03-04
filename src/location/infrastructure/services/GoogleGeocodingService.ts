/**
 * Google Geocoding Service
 *
 * Direct integration with Google Maps Geocoding API
 * Used for batch processing and sync operations
 */

import {
  IGeocodingService,
  GeocodingResult,
  GeocodingAddress,
} from "@/location/domain/ports/IGeocodingService";

interface GoogleGeocodeResponse {
  status: string;
  error_message?: string;
  results: GoogleGeocodeResult[];
}

interface GoogleGeocodeResult {
  formatted_address: string;
  address_components: Array<{
    long_name: string;
    short_name: string;
    types: string[];
  }>;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
    location_type: string;
  };
  place_id: string;
}

export class GoogleGeocodingService implements IGeocodingService {
  private readonly apiKey: string;
  private readonly baseUrl = "https://maps.googleapis.com/maps/api/geocode/json";

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.GOOGLE_MAPS_API_KEY || "";

    if (!this.apiKey) {
      console.warn("[GoogleGeocodingService] ⚠️ No API key provided. Geocoding will not work.");
    } else {
      // Log que el servicio está configurado (sin mostrar la key completa)
      const maskedKey =
        this.apiKey.substring(0, 8) + "..." + this.apiKey.substring(this.apiKey.length - 4);
      console.log(`[GoogleGeocodingService] ✅ Initialized with API key: ${maskedKey}`);
    }
  }

  /**
   * Forward geocoding: address -> coordinates
   */
  async geocodeAddress(address: string): Promise<GeocodingResult | null> {
    if (!this.apiKey) {
      console.error("[GoogleGeocodingService] No API key configured");
      return null;
    }

    try {
      // Validate address
      if (!address || address.trim() === "" || address.trim() === "España") {
        console.warn(`[GoogleGeocodingService] Invalid or empty address: "${address}"`);
        return null;
      }

      const url = `${this.baseUrl}?address=${encodeURIComponent(address)}&key=${this.apiKey}&language=es&region=es`;

      console.log(`[GoogleGeocodingService] Geocoding address: ${address}`);

      const response = await fetch(url);

      if (!response.ok) {
        console.error(
          `[GoogleGeocodingService] HTTP error: ${response.status} ${response.statusText}`
        );
        return null;
      }

      const data: GoogleGeocodeResponse = await response.json();

      if (data.status !== "OK") {
        if (data.status === "ZERO_RESULTS") {
          console.warn(`[GoogleGeocodingService] No results for address: ${address}`);
        } else {
          console.error(
            `[GoogleGeocodingService] API error: ${data.status} - ${data.error_message || "Unknown error"}`
          );
        }
        return null;
      }

      if (!data.results || data.results.length === 0) {
        console.warn(`[GoogleGeocodingService] Empty results for address: ${address}`);
        return null;
      }

      const result = this.mapGoogleResult(data.results[0]);
      console.log(
        `[GoogleGeocodingService] Found: ${result.formatted_address} (${result.coordinates.latitude}, ${result.coordinates.longitude})`
      );

      return result;
    } catch (error) {
      console.error(`[GoogleGeocodingService] Error geocoding address:`, error);
      return null;
    }
  }

  /**
   * Reverse geocoding: coordinates -> address
   */
  async reverseGeocode(latitude: number, longitude: number): Promise<GeocodingResult | null> {
    if (!this.apiKey) {
      console.error("[GoogleGeocodingService] No API key configured");
      return null;
    }

    try {
      const url = `${this.baseUrl}?latlng=${latitude},${longitude}&key=${this.apiKey}&language=es&region=es`;

      console.log(`[GoogleGeocodingService] Reverse geocoding: ${latitude}, ${longitude}`);

      const response = await fetch(url);

      if (!response.ok) {
        console.error(
          `[GoogleGeocodingService] HTTP error: ${response.status} ${response.statusText}`
        );
        return null;
      }

      const data: GoogleGeocodeResponse = await response.json();

      if (data.status !== "OK") {
        if (data.status === "ZERO_RESULTS") {
          console.warn(
            `[GoogleGeocodingService] No results for coordinates: ${latitude}, ${longitude}`
          );
        } else {
          console.error(
            `[GoogleGeocodingService] API error: ${data.status} - ${data.error_message || "Unknown error"}`
          );
        }
        return null;
      }

      if (!data.results || data.results.length === 0) {
        console.warn(
          `[GoogleGeocodingService] Empty results for coordinates: ${latitude}, ${longitude}`
        );
        return null;
      }

      return this.mapGoogleResult(data.results[0]);
    } catch (error) {
      console.error(`[GoogleGeocodingService] Error in reverse geocoding:`, error);
      return null;
    }
  }

  /**
   * Maps Google API response to our GeocodingResult interface
   */
  private mapGoogleResult(googleResult: GoogleGeocodeResult): GeocodingResult {
    const components = googleResult.address_components || [];

    // Extract address components by type
    const getComponent = (type: string): string | undefined =>
      components.find((c) => c.types.includes(type))?.long_name;

    const streetNumber = getComponent("street_number");
    const route = getComponent("route");
    const postalCode = getComponent("postal_code");
    const locality = getComponent("locality") || getComponent("administrative_area_level_2");
    const district = getComponent("administrative_area_level_3");
    const neighborhood = getComponent("neighborhood") || getComponent("sublocality_level_1");

    // Try to extract street type from route (e.g., "Calle de Alcalá" -> "Calle")
    let streetType: string | undefined;
    let streetName = route;

    if (route) {
      const streetTypeMatch = route.match(
        /^(Calle|Avenida|Plaza|Paseo|Carrera|Camino|Travesía|Glorieta|Ronda|Costanilla|Carretera)\s+/i
      );
      if (streetTypeMatch) {
        streetType = streetTypeMatch[1];
        streetName = route.substring(streetTypeMatch[0].length);
      }
    }

    const address: GeocodingAddress = {
      street_type: streetType,
      street_name: streetName,
      street_number: streetNumber,
      postal_code: postalCode,
      city_name: locality,
      district_name: district,
      neighborhood_name: neighborhood,
    };

    return {
      address,
      coordinates: {
        latitude: googleResult.geometry.location.lat,
        longitude: googleResult.geometry.location.lng,
      },
      formatted_address: googleResult.formatted_address,
      source: "google",
    };
  }
}
