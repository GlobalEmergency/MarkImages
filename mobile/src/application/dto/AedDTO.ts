import { Aed, AedCluster, AedMapMarker } from "../../domain/models/Aed";

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

export interface NearbyAed extends Aed {
  distance: number;
}

export interface NearbyAedsResponse {
  success: boolean;
  data: NearbyAed[];
  query: {
    lat: number;
    lng: number;
    radius: number;
    limit: number;
  };
  stats: {
    found: number;
    searchRadius: number;
  };
}

export interface CreateAedRequest {
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
