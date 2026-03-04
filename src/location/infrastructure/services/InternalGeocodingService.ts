/**
 * Internal Geocoding Service
 *
 * Adapter that uses our internal /api/geocode endpoint
 * Reutiliza la infraestructura existente (SOLID: Single Responsibility)
 */

import {
  IGeocodingService,
  GeocodingResult,
  GeocodingAddress,
} from "@/location/domain/ports/IGeocodingService";

interface InternalGeocodeResponse {
  display_name: string;
  lat: string;
  lon: string;
  address: {
    road?: string;
    house_number?: string;
    postcode?: string;
    city?: string;
    town?: string;
    municipality?: string;
  };
  source: "google" | "osm";
}

export class InternalGeocodingService implements IGeocodingService {
  private readonly baseUrl: string;

  constructor(baseUrl?: string) {
    // Permitir inyectar URL para testing (Dependency Injection)
    // En servidor (batch jobs), usar localhost. En producción, usar la URL del entorno.
    this.baseUrl =
      baseUrl || process.env.NEXT_PUBLIC_APP_URL || `http://localhost:${process.env.PORT || 3000}`;
  }

  async geocodeAddress(address: string): Promise<GeocodingResult | null> {
    try {
      // Validar que la dirección no esté vacía o sea solo "España"
      if (!address || address.trim() === "" || address.trim() === "España") {
        console.warn(`[InternalGeocodingService] Invalid or empty address: "${address}"`);
        return null;
      }

      const url = `${this.baseUrl}/api/geocode?q=${encodeURIComponent(address)}`;
      const response = await fetch(url);

      if (!response.ok) {
        console.error(`[InternalGeocodingService] Geocoding failed: ${response.status}`);
        return null;
      }

      const results: InternalGeocodeResponse[] = await response.json();

      if (!results || results.length === 0) {
        console.warn(`[InternalGeocodingService] No results for address: ${address}`);
        return null;
      }

      // Tomar el primer resultado (el más relevante)
      return this.mapToGeocodingResult(results[0]);
    } catch (error) {
      console.error(`[InternalGeocodingService] Error geocoding address:`, error);
      return null;
    }
  }

  async reverseGeocode(latitude: number, longitude: number): Promise<GeocodingResult | null> {
    try {
      // Usar Google Geocoding API directamente para reverse geocoding
      const googleApiKey = process.env.GOOGLE_MAPS_API_KEY;

      if (!googleApiKey) {
        console.warn(
          "[InternalGeocodingService] Google Maps API key not configured. Reverse geocoding unavailable."
        );
        return null;
      }

      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${googleApiKey}&language=es&region=es`;
      const response = await fetch(url);

      if (!response.ok) {
        console.error(`[InternalGeocodingService] Reverse geocoding failed: ${response.status}`);
        return null;
      }

      const data = await response.json();

      if (data.status !== "OK" || !data.results || data.results.length === 0) {
        console.warn(
          `[InternalGeocodingService] No reverse geocoding results for: ${latitude}, ${longitude}. Status: ${data.status}, Error: ${data.error_message || "N/A"}`
        );
        return null;
      }

      return this.mapGoogleResultToGeocodingResult(data.results[0]);
    } catch (error) {
      console.error(`[InternalGeocodingService] Error in reverse geocoding:`, error);
      return null;
    }
  }

  private mapToGeocodingResult(result: InternalGeocodeResponse): GeocodingResult {
    const address: GeocodingAddress = {
      street_name: result.address.road,
      street_number: result.address.house_number,
      postal_code: result.address.postcode,
      city_name: result.address.city || result.address.town || result.address.municipality,
    };

    return {
      address,
      coordinates: {
        latitude: parseFloat(result.lat),
        longitude: parseFloat(result.lon),
      },
      formatted_address: result.display_name,
      source: result.source,
    };
  }

  private mapGoogleResultToGeocodingResult(googleResult: any): GeocodingResult {
    const components = googleResult.address_components || [];

    const streetNumber = components.find((c: any) => c.types.includes("street_number"))?.long_name;
    const route = components.find((c: any) => c.types.includes("route"))?.long_name;
    const postalCode = components.find((c: any) => c.types.includes("postal_code"))?.long_name;
    const locality =
      components.find((c: any) => c.types.includes("locality"))?.long_name ||
      components.find((c: any) => c.types.includes("administrative_area_level_2"))?.long_name;

    // Extraer distrito y barrio de Google (administrative_area_level_3, administrative_area_level_4)
    const district = components.find((c: any) =>
      c.types.includes("administrative_area_level_3")
    )?.long_name;
    const neighborhood = components.find((c: any) => c.types.includes("neighborhood"))?.long_name;

    const address: GeocodingAddress = {
      street_name: route,
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
