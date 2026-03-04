import { IAedRepository } from "../../domain/ports/IAedRepository";
import { NearbyAed } from "../../domain/models/Aed";

export class GetNearbyAedsUseCase {
  constructor(private readonly aedRepository: IAedRepository) {}

  async execute(lat: number, lng: number, radius?: number, limit?: number): Promise<NearbyAed[]> {
    if (lat < -90 || lat > 90) throw new Error("Latitud inválida");
    if (lng < -180 || lng > 180) throw new Error("Longitud inválida");
    return this.aedRepository.getNearby(lat, lng, radius, limit);
  }
}
