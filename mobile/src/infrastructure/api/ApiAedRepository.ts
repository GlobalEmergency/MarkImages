import { IAedRepository } from "../../domain/ports/IAedRepository";
import { Aed } from "../../domain/models/Aed";
import { BoundingBox } from "../../domain/models/Location";
import {
  ClusteredAedsResponse,
  CreateAedRequest,
  NearbyAed,
  NearbyAedsResponse,
} from "../../application/dto/AedDTO";
import { HttpClient, ApiResponse } from "./HttpClient";

export class ApiAedRepository implements IAedRepository {
  constructor(private readonly httpClient: HttpClient) {}

  async getByBounds(bounds: BoundingBox, zoom: number): Promise<ClusteredAedsResponse> {
    return this.httpClient.get<ClusteredAedsResponse>("/api/aeds/by-bounds", {
      minLat: bounds.minLat,
      maxLat: bounds.maxLat,
      minLng: bounds.minLng,
      maxLng: bounds.maxLng,
      zoom,
    });
  }

  async getById(id: string): Promise<Aed> {
    const response = await this.httpClient.get<ApiResponse<Aed>>(`/api/aeds/${id}`);
    return response.data;
  }

  async getNearby(lat: number, lng: number, radius = 5, limit = 20): Promise<NearbyAed[]> {
    const response = await this.httpClient.get<NearbyAedsResponse>("/api/aeds/nearby", {
      lat,
      lng,
      radius,
      limit,
    });
    return response.data;
  }

  async create(data: CreateAedRequest): Promise<Aed> {
    const response = await this.httpClient.post<ApiResponse<Aed>>("/api/aeds", data);
    return response.data;
  }
}
