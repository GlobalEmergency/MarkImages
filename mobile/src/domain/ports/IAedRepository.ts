import { Aed, AedsByBoundsResult, CreateAedData, NearbyAed } from "../models/Aed";
import { BoundingBox } from "../models/Location";

export interface IAedRepository {
  getByBounds(bounds: BoundingBox, zoom: number): Promise<AedsByBoundsResult>;
  getById(id: string): Promise<Aed>;
  getNearby(lat: number, lng: number, radius?: number, limit?: number): Promise<NearbyAed[]>;
  create(data: CreateAedData): Promise<Aed>;
}
