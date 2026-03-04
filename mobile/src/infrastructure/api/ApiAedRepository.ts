import { IAedRepository } from "../../domain/ports/IAedRepository";
import { Aed, AedsByBoundsResult, CreateAedData, NearbyAed } from "../../domain/models/Aed";
import { BoundingBox } from "../../domain/models/Location";
import { ClusteredAedsApiResponse, NearbyAedsApiResponse } from "../../application/dto/AedDTO";
import { IHttpClient } from "../../domain/ports/IHttpClient";
import { ApiResponse } from "./HttpClient";

export class ApiAedRepository implements IAedRepository {
  constructor(private readonly httpClient: IHttpClient) {}

  async getByBounds(bounds: BoundingBox, zoom: number): Promise<AedsByBoundsResult> {
    const response = await this.httpClient.get<ClusteredAedsApiResponse>("/api/aeds/by-bounds", {
      minLat: bounds.minLat,
      maxLat: bounds.maxLat,
      minLng: bounds.minLng,
      maxLng: bounds.maxLng,
      zoom,
    });
    return {
      markers: response.data.markers,
      clusters: response.data.clusters,
      stats: response.stats,
    };
  }

  async getById(id: string): Promise<Aed> {
    const response = await this.httpClient.get<ApiResponse<Aed>>(`/api/aeds/${id}`);
    return response.data;
  }

  async getNearby(lat: number, lng: number, radius = 5, limit = 20): Promise<NearbyAed[]> {
    const response = await this.httpClient.get<NearbyAedsApiResponse>("/api/aeds/nearby", {
      lat,
      lng,
      radius,
      limit,
    });
    return response.data;
  }

  async create(data: CreateAedData): Promise<Aed> {
    const response = await this.httpClient.post<ApiResponse<Aed>>("/api/aeds", data);
    return response.data;
  }
}
