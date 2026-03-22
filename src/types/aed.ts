/**
 * AED (Automated External Defibrillator) Types
 */

export interface AedImage {
  id: string;
  type: "FRONT" | "LOCATION" | "ACCESS" | "SIGNAGE" | "CONTEXT" | "PLATE";
  original_url: string;
  processed_url: string | null;
  thumbnail_url: string | null;
  order: number;
  access_point_id?: string | null;
}

// ============================================
// ACCESS POINTS - How to reach each AED
// ============================================

export type AccessPointType = "PEDESTRIAN" | "VEHICLE" | "EMERGENCY" | "WHEELCHAIR" | "UNIVERSAL";

export type AccessRestrictionType =
  | "NONE"
  | "CODE"
  | "KEY"
  | "CARD"
  | "INTERCOM"
  | "SECURITY_GUARD"
  | "LOCKED_HOURS";

export interface AedAccessPoint {
  id: string;
  aed_id: string;
  latitude: number;
  longitude: number;
  type: AccessPointType;
  label: string | null;
  is_primary: boolean;

  // Access restrictions
  restriction_type: AccessRestrictionType;
  unlock_code: string | null;
  contact_phone: string | null;
  contact_name: string | null;

  // Availability
  available_24h: boolean;
  schedule_notes: string | null;

  // Indoor route
  floor_difference: number | null;
  has_elevator: boolean | null;
  estimated_minutes: number | null;
  indoor_steps: string[] | null;

  // Emergency
  emergency_phone: string | null;
  can_deliver_to_entrance: boolean;

  // Traceability
  verified: boolean;
  created_at: string;
  updated_at: string;

  // Nested images (when included)
  images?: AedImage[];
}

export interface Aed {
  id: string;
  code: string;
  name: string;
  establishment_type: string;
  latitude: number;
  longitude: number;
  published_at: string | null;
  publication_mode: "NONE" | "LOCATION_ONLY" | "BASIC_INFO" | "FULL";
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
    saturday_opening: string | null;
    saturday_closing: string | null;
    sunday_opening: string | null;
    sunday_closing: string | null;
  } | null;
  responsible?: {
    name: string;
    email: string;
    phone: string | null;
  } | null;
  images?: AedImage[];
  access_points?: AedAccessPoint[];
}

export interface AedsResponse {
  success: boolean;
  data: Aed[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface AedFilters {
  page?: number;
  limit?: number;
  search?: string;
}

// ============================================
// MAP TYPES - For geospatial queries
// ============================================

export interface BoundingBox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

export interface AedMapMarker {
  id: string;
  code: string;
  name: string;
  latitude: number;
  longitude: number;
  establishment_type: string;
  publication_mode: "NONE" | "LOCATION_ONLY" | "BASIC_INFO" | "FULL";
}

export interface AedsByBoundsResponse {
  success: boolean;
  data: AedMapMarker[];
  count: number;
  truncated: boolean; // true if there are more records not returned
  zoom_level: number;
  strategy: string;
}

export interface ZoomStrategy {
  limit: number;
  sampling: string | null;
  orderBy: string;
  clusteringEnabled: boolean;
  clusterGridSize: number | null;
  minClusterSize: number;
}

// ============================================
// CLUSTER TYPES - For server-side clustering
// ============================================

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

export interface ClusteredAedsResponse {
  success: boolean;
  data: {
    clusters: AedCluster[];
    markers: AedMapMarker[];
  };
  stats: {
    total_in_view: number;
    clustered: number;
    individual: number;
  };
  zoom_level: number;
  strategy: string;
  timing?: {
    clusters_ms: number;
    markers_ms: number;
    total_ms: number;
    cache_used: boolean;
  };
}
