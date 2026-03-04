import { IAedRepository } from "../../domain/ports/IAedRepository";
import { Aed, CreateAedData } from "../../domain/models/Aed";

export class CreateAedUseCase {
  constructor(private readonly aedRepository: IAedRepository) {}

  async execute(data: CreateAedData): Promise<Aed> {
    if (!data.name?.trim()) {
      throw new Error("El nombre del DEA es obligatorio");
    }
    if (data.latitude == null || data.longitude == null) {
      throw new Error("La ubicación es obligatoria");
    }
    if (data.latitude < -90 || data.latitude > 90) {
      throw new Error("Latitud inválida");
    }
    if (data.longitude < -180 || data.longitude > 180) {
      throw new Error("Longitud inválida");
    }

    return this.aedRepository.create({
      ...data,
      name: data.name.trim(),
    });
  }
}
