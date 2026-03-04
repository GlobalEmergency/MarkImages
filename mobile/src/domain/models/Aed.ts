export type PublicationMode = "NONE" | "LOCATION_ONLY" | "BASIC_INFO" | "FULL";

export type AedImageType = "FRONT" | "LOCATION" | "ACCESS" | "SIGNAGE" | "CONTEXT" | "PLATE";

export interface AedImage {
  id: string;
  type: AedImageType;
  original_url: string;
  processed_url: string | null;
  thumbnail_url: string | null;
  order: number;
}

export interface AedMapMarker {
  id: string;
  code: string;
  name: string;
  latitude: number;
  longitude: number;
  establishment_type: string;
  publication_mode: PublicationMode;
}

export interface AedCluster {
  id: string;
  center: {
    lat: number;
    lng: number;
  };
  count: number;
  bounds: {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  };
}

export interface Aed {
  id: string;
  code: string;
  name: string;
  establishment_type: string;
  latitude: number;
  longitude: number;
  published_at: string | null;
  publication_mode: PublicationMode;
  location: {
    street_type: string;
    street_name: string;
    street_number: string | null;
    postal_code: string;
    district_name?: string | null;
    neighborhood_name?: string | null;
    city_name?: string | null;
    access_instructions?: string | null;
  };
  schedule: {
    has_24h_surveillance: boolean;
    weekday_opening: string | null;
    weekday_closing: string | null;
  } | null;
  responsible?: {
    name: string;
    email: string;
    phone: string | null;
  } | null;
  images?: AedImage[];
}

/** An AED with its distance from a reference point (km) */
export interface NearbyAed extends Aed {
  distance: number;
}

/** Data required to create a new AED */
export interface CreateAedData {
  name: string;
  establishment_type?: string;
  latitude: number;
  longitude: number;
  location?: {
    street_name?: string;
    street_number?: string;
    postal_code?: string;
    city_name?: string;
  };
  source_details?: string;
}

/** Result of querying AEDs within map bounds */
export interface AedsByBoundsResult {
  markers: AedMapMarker[];
  clusters: AedCluster[];
  stats: {
    total_in_view: number;
    clustered: number;
    individual: number;
  };
}
