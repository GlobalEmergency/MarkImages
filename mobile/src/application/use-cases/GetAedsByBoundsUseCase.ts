import { IAedRepository } from "../../domain/ports/IAedRepository";
import { BoundingBox } from "../../domain/models/Location";
import { ClusteredAedsResponse } from "../dto/AedDTO";

export class GetAedsByBoundsUseCase {
  constructor(private readonly aedRepository: IAedRepository) {}

  async execute(bounds: BoundingBox, zoom: number): Promise<ClusteredAedsResponse> {
    return this.aedRepository.getByBounds(bounds, zoom);
  }
}
