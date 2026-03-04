/**
 * Geocoding Service Interface (Port)
 *
 * Abstraction for geocoding services (Google Maps, OSM, etc.)
 * Following Dependency Inversion Principle (SOLID)
 */

export interface GeocodingAddress {
  street_type?: string;
  street_name?: string;
  street_number?: string;
  postal_code?: string;
  city_name?: string;
  city_code?: string;
  district_code?: string;
  district_name?: string;
  neighborhood_code?: string;
  neighborhood_name?: string;
}

export interface GeocodingCoordinates {
  latitude: number;
  longitude: number;
}

export interface GeocodingResult {
  address: GeocodingAddress;
  coordinates: GeocodingCoordinates;
  formatted_address: string;
  source: "google" | "osm" | "hybrid";
}

export interface IGeocodingService {
  /**
   * Forward geocoding: address -> coordinates
   */
  geocodeAddress(address: string): Promise<GeocodingResult | null>;

  /**
   * Reverse geocoding: coordinates -> address
   */
  reverseGeocode(latitude: number, longitude: number): Promise<GeocodingResult | null>;
}
