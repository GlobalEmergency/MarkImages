/**
 * Enrich Location With Geocoding Use Case
 *
 * Responsabilidad Ãºnica: Enriquecer ubicaciÃ³n con datos de geocoding
 * y validar coordenadas.
 *
 * Casos de uso:
 * 1. Sincronizaciones externas con datos incompletos
 * 2. Importaciones CSV con direcciones sin estructura
 * 3. Admin panel para validaciÃ³n manual
 */

import { PrismaClient } from "@/generated/client/client";
import { IGeocodingService, GeocodingResult } from "@/location/domain/ports/IGeocodingService";
import { CoordinateValidation } from "@/location/domain/value-objects/CoordinateValidation";
import { GeographicDistance } from "@/location/domain/value-objects/GeographicDistance";

/**
 * Type for AedLocation data retrieved from database
 */
interface AedLocationData {
  id: string;
  postal_code: string | null;
  city_name: string | null;
  district_name: string | null;
  neighborhood_name: string | null;
  street_number: string | null;
}

/**
 * Type for location update data
 * Uses Record<string, unknown> for Prisma compatibility with JSON fields
 */
type LocationUpdateData = Record<string, unknown>;

export interface EnrichLocationInput {
  locationId: string;
  rawAddress?: string; // DirecciÃ³n sin estructura (ej: "C/ PALOMA 43, 28981, PARLA")
  originalCoords?: {
    latitude: number;
    longitude: number;
  };
  forceEnrich?: boolean; // Forzar enriquecimiento aunque ya tenga datos
}

export interface EnrichLocationOutput {
  locationId: string;
  enriched: boolean;
  fieldsUpdated: string[];
  coordinateValidation: CoordinateValidation;
  geocodingSource?: "google" | "osm" | "hybrid";
}

export class EnrichLocationWithGeocodingUseCase {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly geocodingService: IGeocodingService
  ) {}

  async execute(input: EnrichLocationInput): Promise<EnrichLocationOutput> {
    // 1. Leer ubicaciÃ³n actual
    const location = await this.prisma.aedLocation.findUnique({
      where: { id: input.locationId },
    });

    if (!location) {
      throw new Error(`Location not found: ${input.locationId}`);
    }

    // 2. Verificar si necesita enriquecimiento
    const needsEnrichment =
      input.forceEnrich || !location.postal_code || !location.city_name || !location.district_name;

    if (!needsEnrichment) {
      return {
        locationId: input.locationId,
        enriched: false,
        fieldsUpdated: [],
        coordinateValidation: CoordinateValidation.createNoComparison(),
      };
    }

    // 3. Decidir estrategia de geocoding
    let geocodingResult;

    // Priorizar direcciÃ³n sobre coordenadas porque:
    // 1. Las direcciones de fuentes oficiales son mÃ¡s confiables
    // 2. Nos da coordenadas validadas por Google
    // 3. Las coordenadas originales pueden tener formato incorrecto
    if (input.rawAddress) {
      // Estrategia 1: Forward geocoding desde direcciÃ³n (mÃ¡s confiable)

      geocodingResult = await this.geocodingService.geocodeAddress(input.rawAddress);
    } else if (input.originalCoords) {
      // Estrategia 2: Reverse geocoding como fallback

      geocodingResult = await this.geocodingService.reverseGeocode(
        input.originalCoords.latitude,
        input.originalCoords.longitude
      );
    } else {
      return {
        locationId: input.locationId,
        enriched: false,
        fieldsUpdated: [],
        coordinateValidation: CoordinateValidation.createNoComparison(),
      };
    }

    if (!geocodingResult) {
      return {
        locationId: input.locationId,
        enriched: false,
        fieldsUpdated: [],
        coordinateValidation: CoordinateValidation.createNoComparison(),
      };
    }

    // 4. Validar coordenadas (si tenemos originales)
    const coordinateValidation = this.validateCoordinates(
      input.originalCoords,
      geocodingResult.coordinates
    );

    // 5. Actualizar ubicaciÃ³n con datos enriquecidos
    const fieldsUpdated = await this.updateLocation(
      input.locationId,
      location,
      geocodingResult,
      coordinateValidation
    );

    return {
      locationId: input.locationId,
      enriched: true,
      fieldsUpdated,
      coordinateValidation,
      geocodingSource: geocodingResult.source,
    };
  }

  private validateCoordinates(
    originalCoords: { latitude: number; longitude: number } | undefined,
    geocodedCoords: { latitude: number; longitude: number }
  ): CoordinateValidation {
    if (!originalCoords) {
      return CoordinateValidation.createNoComparison();
    }

    const distanceMeters = GeographicDistance.calculateDistanceInMeters(
      originalCoords.latitude,
      originalCoords.longitude,
      geocodedCoords.latitude,
      geocodedCoords.longitude
    );

    // Umbrales de validaciÃ³n
    const VALID_THRESHOLD_METERS = 50;
    const VERIFICATION_THRESHOLD_METERS = 100;

    if (distanceMeters < VALID_THRESHOLD_METERS) {
      return CoordinateValidation.createValid(distanceMeters, originalCoords, geocodedCoords);
    } else if (distanceMeters < VERIFICATION_THRESHOLD_METERS) {
      return CoordinateValidation.createNeedsVerification(
        distanceMeters,
        originalCoords,
        geocodedCoords
      );
    } else {
      return CoordinateValidation.createInvalid(distanceMeters, originalCoords, geocodedCoords);
    }
  }

  private async updateLocation(
    locationId: string,
    currentLocation: AedLocationData,
    geocodingResult: GeocodingResult,
    coordinateValidation: CoordinateValidation
  ): Promise<string[]> {
    const fieldsUpdated: string[] = [];
    const updateData: LocationUpdateData = {};

    // Solo actualizar campos vacÃ­os (conservador)
    if (!currentLocation.postal_code && geocodingResult.address.postal_code) {
      updateData.postal_code = geocodingResult.address.postal_code;
      fieldsUpdated.push("postal_code");
    }

    if (!currentLocation.city_name && geocodingResult.address.city_name) {
      updateData.city_name = geocodingResult.address.city_name;
      fieldsUpdated.push("city_name");
    }

    if (!currentLocation.district_name && geocodingResult.address.district_name) {
      updateData.district_name = geocodingResult.address.district_name;
      fieldsUpdated.push("district_name");
    }

    if (!currentLocation.neighborhood_name && geocodingResult.address.neighborhood_name) {
      updateData.neighborhood_name = geocodingResult.address.neighborhood_name;
      fieldsUpdated.push("neighborhood_name");
    }

    // Actualizar street_number si estÃ¡ vacÃ­o
    if (!currentLocation.street_number && geocodingResult.address.street_number) {
      updateData.street_number = geocodingResult.address.street_number;
      fieldsUpdated.push("street_number");
    }

    // Guardar validaciÃ³n de coordenadas en JSON
    updateData.geocoding_validation = coordinateValidation.toJSON();
    fieldsUpdated.push("geocoding_validation");

    if (fieldsUpdated.length > 0) {
      await this.prisma.aedLocation.update({
        where: { id: locationId },
        data: updateData,
      });
    }

    return fieldsUpdated;
  }
}
