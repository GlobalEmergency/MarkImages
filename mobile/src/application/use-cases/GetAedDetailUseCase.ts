import { IAedRepository } from "../../domain/ports/IAedRepository";
import { Aed } from "../../domain/models/Aed";

export class GetAedDetailUseCase {
  constructor(private readonly aedRepository: IAedRepository) {}

  async execute(id: string): Promise<Aed> {
    if (!id?.trim()) {
      throw new Error("ID del DEA es obligatorio");
    }
    return this.aedRepository.getById(id);
  }
}
