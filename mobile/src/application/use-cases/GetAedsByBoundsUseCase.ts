import { IAedRepository } from "../../domain/ports/IAedRepository";
import { AedsByBoundsResult } from "../../domain/models/Aed";
import { BoundingBox } from "../../domain/models/Location";

export class GetAedsByBoundsUseCase {
  constructor(private readonly aedRepository: IAedRepository) {}

  async execute(bounds: BoundingBox, zoom: number): Promise<AedsByBoundsResult> {
    return this.aedRepository.getByBounds(bounds, zoom);
  }
}
