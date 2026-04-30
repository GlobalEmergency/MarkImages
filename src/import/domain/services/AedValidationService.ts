/**
 * AED Validation Service (Domain Service)
 *
 * Servicio de dominio para validar reglas de negocio de AEDs.
 * Puro, sin dependencias externas, solo lÃ³gica de negocio.
 */

import { ValidationError } from "../value-objects/ValidationError";
import { AedImportData } from "../value-objects/AedImportData";

export interface AedValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

export class AedValidationService {
  /**
   * Valida que los campos obligatorios estÃ©n presentes
   */
  validateRequiredFields(
    data: AedImportData,
    row: number,
    mappings: Map<string, string> // systemField -> csvColumn
  ): AedValidationResult {
    const errors: ValidationError[] = [];

    // Nombre es obligatorio
    if (!data.proposedName || data.proposedName.trim() === "") {
      const csvColumn = mappings.get("proposedName") || "proposedName";
      errors.push(
        ValidationError.create({
          row,
          field: "proposedName",
          csvColumn,
          value: data.proposedName || "",
          errorType: "MISSING_DATA",
          message: "El campo 'nombre' es obligatorio y no puede estar vacÃ­o",
          severity: "error",
          correctionSuggestion: `Completa el campo '${csvColumn}' en la fila ${row}`,
        })
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Valida el formato del cÃ³digo postal
   */
  validatePostalCode(
    postalCode: string | undefined,
    row: number,
    csvColumn?: string
  ): AedValidationResult {
    const errors: ValidationError[] = [];

    if (postalCode && postalCode.trim() !== "") {
      const trimmed = postalCode.trim();

      // Debe tener exactamente 5 dÃ­gitos
      if (trimmed.length !== 5) {
        errors.push(
          ValidationError.create({
            row,
            field: "postalCode",
            csvColumn,
            value: postalCode,
            errorType: "INVALID_POSTAL_CODE",
            message: `El cÃ³digo postal "${postalCode}" debe tener exactamente 5 dÃ­gitos`,
            severity: "error",
            correctionSuggestion:
              "Los cÃ³digos postales de Madrid tienen 5 dÃ­gitos (ej: 28001, 28042)",
          })
        );
      }

      // Debe ser numÃ©rico
      if (!/^\d{5}$/.test(trimmed)) {
        errors.push(
          ValidationError.create({
            row,
            field: "postalCode",
            csvColumn,
            value: postalCode,
            errorType: "INVALID_POSTAL_CODE",
            message: `El cÃ³digo postal "${postalCode}" debe contener solo dÃ­gitos`,
            severity: "error",
            correctionSuggestion: "Usa solo nÃºmeros (ej: 28001, no 28.001 ni 28-001)",
          })
        );
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Valida que el nombre tenga un formato aceptable
   */
  validateName(name: string | undefined, row: number, csvColumn?: string): AedValidationResult {
    const errors: ValidationError[] = [];

    if (name && name.trim() !== "") {
      const trimmed = name.trim();

      // Longitud mÃ­nima
      if (trimmed.length < 3) {
        errors.push(
          ValidationError.create({
            row,
            field: "proposedName",
            csvColumn,
            value: name,
            errorType: "INVALID_FORMAT",
            message: `El nombre "${name}" es demasiado corto (mÃ­nimo 3 caracteres)`,
            severity: "warning",
            correctionSuggestion: "Proporciona un nombre mÃ¡s descriptivo",
          })
        );
      }

      // Longitud mÃ¡xima
      if (trimmed.length > 255) {
        errors.push(
          ValidationError.create({
            row,
            field: "proposedName",
            csvColumn,
            value: name,
            errorType: "INVALID_FORMAT",
            message: `El nombre es demasiado largo (mÃ¡ximo 255 caracteres)`,
            severity: "error",
            correctionSuggestion: "Acorta el nombre del AED",
          })
        );
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Valida todos los aspectos de un registro AED
   */
  validateAedRecord(
    data: AedImportData,
    row: number,
    mappings: Map<string, string>
  ): AedValidationResult {
    const allErrors: ValidationError[] = [];

    // Validar campos obligatorios
    const requiredResult = this.validateRequiredFields(data, row, mappings);
    allErrors.push(...requiredResult.errors);

    // Validar nombre
    const nameResult = this.validateName(data.proposedName, row, mappings.get("proposedName"));
    allErrors.push(...nameResult.errors);

    // Validar cÃ³digo postal
    const postalCodeResult = this.validatePostalCode(
      data.postalCode,
      row,
      mappings.get("postalCode")
    );
    allErrors.push(...postalCodeResult.errors);

    return {
      isValid: allErrors.length === 0,
      errors: allErrors,
    };
  }
}
