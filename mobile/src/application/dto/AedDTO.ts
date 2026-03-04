import { AedCluster, AedMapMarker } from "../../domain/models/Aed";

// Re-export domain types used by use cases
export type {
  NearbyAed,
  CreateAedData as CreateAedRequest,
  AedsByBoundsResult,
} from "../../domain/models/Aed";

/** Raw API response shape for clustered AEDs (infrastructure concern) */
export interface ClusteredAedsApiResponse {
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

/** Raw API response shape for nearby AEDs (infrastructure concern) */
export interface NearbyAedsApiResponse {
  success: boolean;
  data: Array<import("../../domain/models/Aed").NearbyAed>;
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
