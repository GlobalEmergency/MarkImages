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
}

export interface Aed {
  id: string;
  code: string;
  name: string;
  establishment_type: string;
  latitude: number;
  longitude: number;
  published_at: string | null;
  location: {
    street_type: string;
    street_name: string;
    street_number: string | null;
    postal_code: string;
    district_name?: string | null;
    neighborhood_name?: string | null;
    city_name?: string | null;
    access_description?: string | null;
  };
  schedule: {
    has_24h_surveillance: boolean;
    weekday_opening: string | null;
    weekday_closing: string | null;
  } | null;
  responsible: {
    name: string;
    email: string;
    phone: string | null;
  };
  images?: AedImage[];
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
}
