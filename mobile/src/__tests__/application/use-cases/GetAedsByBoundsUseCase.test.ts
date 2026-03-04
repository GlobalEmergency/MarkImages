import { describe, it, expect, vi, beforeEach } from "vitest";
import { GetAedsByBoundsUseCase } from "../../../application/use-cases/GetAedsByBoundsUseCase";
import { IAedRepository } from "../../../domain/ports/IAedRepository";
import { BoundingBox } from "../../../domain/models/Location";
import { AedsByBoundsResult } from "../../../domain/models/Aed";

function createMockAedRepository(overrides: Partial<IAedRepository> = {}): IAedRepository {
  return {
    getByBounds: vi.fn().mockResolvedValue({
      markers: [],
      clusters: [],
      stats: { total_in_view: 0, clustered: 0, individual: 0 },
    }),
    getById: vi.fn(),
    getNearby: vi.fn(),
    create: vi.fn(),
    ...overrides,
  };
}

const validBounds: BoundingBox = {
  minLat: 40.0,
  maxLat: 41.0,
  minLng: -4.0,
  maxLng: -3.0,
};

describe("GetAedsByBoundsUseCase", () => {
  let aedRepository: IAedRepository;
  let useCase: GetAedsByBoundsUseCase;

  beforeEach(() => {
    aedRepository = createMockAedRepository();
    useCase = new GetAedsByBoundsUseCase(aedRepository);
  });

  // --- Invalid bounds ---

  it("throws when minLat > maxLat", async () => {
    const bounds: BoundingBox = {
      minLat: 42.0,
      maxLat: 40.0,
      minLng: -4.0,
      maxLng: -3.0,
    };

    await expect(useCase.execute(bounds, 12)).rejects.toThrow(
      "Bounds inválidos: min debe ser menor que max"
    );
  });

  it("throws when minLng > maxLng", async () => {
    const bounds: BoundingBox = {
      minLat: 40.0,
      maxLat: 41.0,
      minLng: -2.0,
      maxLng: -4.0,
    };

    await expect(useCase.execute(bounds, 12)).rejects.toThrow(
      "Bounds inválidos: min debe ser menor que max"
    );
  });

  // --- Out of range bounds ---

  it("throws when minLat < -90", async () => {
    const bounds: BoundingBox = {
      minLat: -91,
      maxLat: 41.0,
      minLng: -4.0,
      maxLng: -3.0,
    };

    await expect(useCase.execute(bounds, 12)).rejects.toThrow("Bounds fuera de rango geográfico");
  });

  it("throws when maxLat > 90", async () => {
    const bounds: BoundingBox = {
      minLat: 40.0,
      maxLat: 91.0,
      minLng: -4.0,
      maxLng: -3.0,
    };

    await expect(useCase.execute(bounds, 12)).rejects.toThrow("Bounds fuera de rango geográfico");
  });

  it("throws when minLng < -180", async () => {
    const bounds: BoundingBox = {
      minLat: 40.0,
      maxLat: 41.0,
      minLng: -181,
      maxLng: -3.0,
    };

    await expect(useCase.execute(bounds, 12)).rejects.toThrow("Bounds fuera de rango geográfico");
  });

  it("throws when maxLng > 180", async () => {
    const bounds: BoundingBox = {
      minLat: 40.0,
      maxLat: 41.0,
      minLng: -4.0,
      maxLng: 181,
    };

    await expect(useCase.execute(bounds, 12)).rejects.toThrow("Bounds fuera de rango geográfico");
  });

  // --- Invalid zoom ---

  it("throws when zoom is negative", async () => {
    await expect(useCase.execute(validBounds, -1)).rejects.toThrow("Zoom debe estar entre 0 y 22");
  });

  it("throws when zoom > 22", async () => {
    await expect(useCase.execute(validBounds, 23)).rejects.toThrow("Zoom debe estar entre 0 y 22");
  });

  // --- Valid calls ---

  it("calls repository with valid bounds and zoom", async () => {
    await useCase.execute(validBounds, 15);

    expect(aedRepository.getByBounds).toHaveBeenCalledWith(validBounds, 15);
    expect(aedRepository.getByBounds).toHaveBeenCalledTimes(1);
  });

  it("returns the repository response correctly", async () => {
    const expectedResult: AedsByBoundsResult = {
      markers: [
        {
          id: "aed-1",
          code: "DEA-001",
          name: "Pharmacy AED",
          latitude: 40.5,
          longitude: -3.5,
          establishment_type: "FARMACIA",
          publication_mode: "FULL",
        },
      ],
      clusters: [
        {
          id: "cluster-1",
          center: { lat: 40.5, lng: -3.5 },
          count: 5,
          bounds: { minLat: 40.4, maxLat: 40.6, minLng: -3.6, maxLng: -3.4 },
        },
      ],
      stats: { total_in_view: 6, clustered: 5, individual: 1 },
    };

    (aedRepository.getByBounds as ReturnType<typeof vi.fn>).mockResolvedValue(expectedResult);

    const result = await useCase.execute(validBounds, 14);

    expect(result).toEqual(expectedResult);
  });

  it("accepts boundary zoom values 0 and 22", async () => {
    await expect(useCase.execute(validBounds, 0)).resolves.toBeDefined();
    await expect(useCase.execute(validBounds, 22)).resolves.toBeDefined();
  });

  it("accepts boundary lat values -90 and 90", async () => {
    const extremeBounds: BoundingBox = {
      minLat: -90,
      maxLat: 90,
      minLng: -180,
      maxLng: 180,
    };
    await expect(useCase.execute(extremeBounds, 5)).resolves.toBeDefined();
  });
});
