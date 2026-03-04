import { IAedRepository } from "../../domain/ports/IAedRepository";
import { AedsByBoundsResult } from "../../domain/models/Aed";
import { BoundingBox } from "../../domain/models/Location";

export class GetAedsByBoundsUseCase {
  constructor(private readonly aedRepository: IAedRepository) {}

  async execute(bounds: BoundingBox, zoom: number): Promise<AedsByBoundsResult> {
    if (bounds.minLat > bounds.maxLat || bounds.minLng > bounds.maxLng) {
      throw new Error("Bounds inválidos: min debe ser menor que max");
    }
    if (bounds.minLat < -90 || bounds.maxLat > 90 || bounds.minLng < -180 || bounds.maxLng > 180) {
      throw new Error("Bounds fuera de rango geográfico");
    }
    if (zoom < 0 || zoom > 22) {
      throw new Error("Zoom debe estar entre 0 y 22");
    }
    return this.aedRepository.getByBounds(bounds, zoom);
  }
}
