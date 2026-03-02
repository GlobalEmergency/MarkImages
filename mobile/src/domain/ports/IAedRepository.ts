import { Aed, AedMapMarker } from "../models/Aed";
import { BoundingBox } from "../models/Location";
import { ClusteredAedsResponse, CreateAedRequest } from "../../application/dto/AedDTO";

export interface IAedRepository {
  getByBounds(bounds: BoundingBox, zoom: number): Promise<ClusteredAedsResponse>;
  getById(id: string): Promise<Aed>;
  getNearby(lat: number, lng: number, radius?: number, limit?: number): Promise<AedMapMarker[]>;
  create(data: CreateAedRequest): Promise<Aed>;
}
