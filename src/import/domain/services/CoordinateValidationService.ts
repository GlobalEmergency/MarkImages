/**
 * Coordinate Validation Service (Domain Service)
 *
 * Servicio de dominio para validar coordenadas geogrÃ¡ficas.
 * Puro, sin dependencias externas, solo lÃ³gica de negocio.
 */

import { ValidationError } from "../value-objects/ValidationError";

export interface CoordinateValidationResult {
  isValid: boolean;
  error?: ValidationError;
}

export class CoordinateValidationService {
  /**
   * Valida una coordenada de latitud
   */
  validateLatitude(
    latitude: string | undefined,
    row: number,
    csvColumn?: string
  ): CoordinateValidationResult {
    if (!latitude || latitude.trim() === "") {
      return { isValid: true }; // Latitud es opcional
    }

    // Normalizar comas a puntos
    const normalizedLat = latitude.replace(",", ".");

    // Verificar que sea un nÃºmero
    if (isNaN(parseFloat(normalizedLat))) {
      return {
        isValid: false,
        error: ValidationError.create({
          row,
          field: "latitude",
          csvColumn,
          value: latitude,
          errorType: "INVALID_COORDINATE",
          message: `La latitud "${latitude}" no es un nÃºmero vÃ¡lido`,
          severity: "error",
          correctionSuggestion:
            "Usa formato decimal con punto (ej: 40.4165). Si usas coma, reemplÃ¡zala por punto.",
        }),
      };
    }

    const latValue = parseFloat(normalizedLat);

    // Verificar rango vÃ¡lido
    if (latValue < -90 || latValue > 90) {
      return {
        isValid: false,
        error: ValidationError.create({
          row,
          field: "latitude",
          csvColumn,
          value: latitude,
          errorType: "INVALID_COORDINATE",
          message: `La latitud ${latValue} estÃ¡ fuera del rango vÃ¡lido (-90 a 90)`,
          severity: "error",
          correctionSuggestion:
            "Verifica las coordenadas. Para Madrid, la latitud debe estar cerca de 40.4",
        }),
      };
    }

    return { isValid: true };
  }

  /**
   * Valida una coordenada de longitud
   */
  validateLongitude(
    longitude: string | undefined,
    row: number,
    csvColumn?: string
  ): CoordinateValidationResult {
    if (!longitude || longitude.trim() === "") {
      return { isValid: true }; // Longitud es opcional
    }

    // Normalizar comas a puntos
    const normalizedLon = longitude.replace(",", ".");

    // Verificar que sea un nÃºmero
    if (isNaN(parseFloat(normalizedLon))) {
      return {
        isValid: false,
        error: ValidationError.create({
          row,
          field: "longitude",
          csvColumn,
          value: longitude,
          errorType: "INVALID_COORDINATE",
          message: `La longitud "${longitude}" no es un nÃºmero vÃ¡lido`,
          severity: "error",
          correctionSuggestion:
            "Usa formato decimal con punto (ej: -3.7038). Si usas coma, reemplÃ¡zala por punto.",
        }),
      };
    }

    const lonValue = parseFloat(normalizedLon);

    // Verificar rango vÃ¡lido
    if (lonValue < -180 || lonValue > 180) {
      return {
        isValid: false,
        error: ValidationError.create({
          row,
          field: "longitude",
          csvColumn,
          value: longitude,
          errorType: "INVALID_COORDINATE",
          message: `La longitud ${lonValue} estÃ¡ fuera del rango vÃ¡lido (-180 a 180)`,
          severity: "error",
          correctionSuggestion:
            "Verifica las coordenadas. Para Madrid, la longitud debe estar cerca de -3.7",
        }),
      };
    }

    return { isValid: true };
  }

  /**
   * Valida que ambas coordenadas estÃ©n presentes o ambas ausentes
   */
  validateCoordinatePair(
    latitude: string | undefined,
    longitude: string | undefined,
    row: number
  ): CoordinateValidationResult {
    const hasLat = latitude && latitude.trim() !== "";
    const hasLon = longitude && longitude.trim() !== "";

    if (hasLat && !hasLon) {
      return {
        isValid: false,
        error: ValidationError.create({
          row,
          field: "longitude",
          errorType: "MISSING_DATA",
          message: "Si se proporciona latitud, la longitud es obligatoria",
          severity: "error",
          correctionSuggestion: "Proporciona ambas coordenadas o ninguna",
        }),
      };
    }

    if (!hasLat && hasLon) {
      return {
        isValid: false,
        error: ValidationError.create({
          row,
          field: "latitude",
          errorType: "MISSING_DATA",
          message: "Si se proporciona longitud, la latitud es obligatoria",
          severity: "error",
          correctionSuggestion: "Proporciona ambas coordenadas o ninguna",
        }),
      };
    }

    return { isValid: true };
  }

  /**
   * Valida coordenadas completas (latitud, longitud y par)
   */
  validateCoordinates(
    latitude: string | undefined,
    longitude: string | undefined,
    row: number,
    latCsvColumn?: string,
    lonCsvColumn?: string
  ): CoordinateValidationResult {
    // Validar par
    const pairResult = this.validateCoordinatePair(latitude, longitude, row);
    if (!pairResult.isValid) {
      return pairResult;
    }

    // Si no hay coordenadas, es vÃ¡lido
    if (!latitude && !longitude) {
      return { isValid: true };
    }

    // Validar latitud
    const latResult = this.validateLatitude(latitude, row, latCsvColumn);
    if (!latResult.isValid) {
      return latResult;
    }

    // Validar longitud
    const lonResult = this.validateLongitude(longitude, row, lonCsvColumn);
    if (!lonResult.isValid) {
      return lonResult;
    }

    return { isValid: true };
  }
}
