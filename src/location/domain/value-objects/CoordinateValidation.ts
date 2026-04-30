/**
 * Coordinate Validation Value Object
 *
 * Encapsulates the validation result of coordinate comparison
 */

export enum CoordinateValidationStatus {
  VALID = "VALID", // < 50m - Usar coordenadas geocoded
  NEEDS_VERIFICATION = "NEEDS_VERIFICATION", // 50-100m - Revisión manual
  INVALID = "INVALID", // > 100m - Coordenadas sospechosas
  NO_COMPARISON = "NO_COMPARISON", // Sin coordenadas originales para comparar
}

export interface CoordinateValidationData {
  status: CoordinateValidationStatus;
  distance_meters?: number;
  original_coords?: {
    latitude: number;
    longitude: number;
  };
  geocoded_coords?: {
    latitude: number;
    longitude: number;
  };
  reason?: string;
  validated_at: Date;
}

export class CoordinateValidation {
  private constructor(private readonly data: CoordinateValidationData) {}

  static createValid(
    distanceMeters: number,
    originalCoords: { latitude: number; longitude: number },
    geocodedCoords: { latitude: number; longitude: number }
  ): CoordinateValidation {
    return new CoordinateValidation({
      status: CoordinateValidationStatus.VALID,
      distance_meters: distanceMeters,
      original_coords: originalCoords,
      geocoded_coords: geocodedCoords,
      reason: `Coordenadas validadas. Distancia: ${distanceMeters.toFixed(1)}m`,
      validated_at: new Date(),
    });
  }

  static createNeedsVerification(
    distanceMeters: number,
    originalCoords: { latitude: number; longitude: number },
    geocodedCoords: { latitude: number; longitude: number }
  ): CoordinateValidation {
    return new CoordinateValidation({
      status: CoordinateValidationStatus.NEEDS_VERIFICATION,
      distance_meters: distanceMeters,
      original_coords: originalCoords,
      geocoded_coords: geocodedCoords,
      reason: `Coordenadas difieren en ${distanceMeters.toFixed(1)}m. Requiere verificación manual.`,
      validated_at: new Date(),
    });
  }

  static createInvalid(
    distanceMeters: number,
    originalCoords: { latitude: number; longitude: number },
    geocodedCoords: { latitude: number; longitude: number }
  ): CoordinateValidation {
    return new CoordinateValidation({
      status: CoordinateValidationStatus.INVALID,
      distance_meters: distanceMeters,
      original_coords: originalCoords,
      geocoded_coords: geocodedCoords,
      reason: `Coordenadas sospechosas. Distancia: ${distanceMeters.toFixed(1)}m excede umbral de 100m.`,
      validated_at: new Date(),
    });
  }

  static createNoComparison(): CoordinateValidation {
    return new CoordinateValidation({
      status: CoordinateValidationStatus.NO_COMPARISON,
      reason: "No hay coordenadas originales para comparar",
      validated_at: new Date(),
    });
  }

  get status(): CoordinateValidationStatus {
    return this.data.status;
  }

  get distanceMeters(): number | undefined {
    return this.data.distance_meters;
  }

  get reason(): string | undefined {
    return this.data.reason;
  }

  isValid(): boolean {
    return this.data.status === CoordinateValidationStatus.VALID;
  }

  needsVerification(): boolean {
    return this.data.status === CoordinateValidationStatus.NEEDS_VERIFICATION;
  }

  isInvalid(): boolean {
    return this.data.status === CoordinateValidationStatus.INVALID;
  }

  shouldUseGeocodedCoordinates(): boolean {
    // Solo usar coordenadas geocoded si son VALID (< 50m)
    return this.data.status === CoordinateValidationStatus.VALID;
  }

  shouldBlockPublication(): boolean {
    // Bloquear publicación si es INVALID (> 100m)
    return this.data.status === CoordinateValidationStatus.INVALID;
  }

  toJSON(): CoordinateValidationData {
    return { ...this.data };
  }
}
