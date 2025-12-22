/**
 * Duplicate Detection Service (Domain Service)
 *
 * Servicio de dominio para detectar duplicados de AEDs.
 * Usa el patrón de cascada: ID → Code → External Reference
 * Sigue el principio DIP (depende de IAedRepository, no de implementación concreta)
 */

import { IAedRepository, DuplicateCheckResult } from "../ports/IAedRepository";
import { AedImportData } from "../value-objects/AedImportData";
import { ValidationError } from "../value-objects/ValidationError";

export interface DuplicateValidationResult {
  isDuplicate: boolean;
  error?: ValidationError;
  matchInfo?: DuplicateCheckResult;
}

export class DuplicateDetectionService {
  constructor(private readonly aedRepository: IAedRepository) {}

  /**
   * Verifica si un registro es duplicado usando cascada de matching:
   * 1. Por ID (si el usuario lo proporciona)
   * 2. Por code
   * 3. Por external_reference
   *
   * Esto permite re-ejecutar importaciones de forma segura
   */
  async checkDuplicate(
    data: AedImportData,
    row: number,
    skipDuplicates: boolean = true
  ): Promise<DuplicateValidationResult> {
    const id = data.id?.trim();
    const code = data.code?.trim();
    const externalRef = data.externalReference?.trim();

    // Si no hay ningún identificador, no podemos verificar duplicados
    if (!id && !code && !externalRef) {
      return { isDuplicate: false };
    }

    // ========================================
    // PRIORIDAD 1: Buscar por ID
    // ========================================
    if (id) {
      try {
        const existingById = await this.aedRepository.findById(id);

        if (existingById && existingById.isDuplicate) {
          if (skipDuplicates) {
            // Es duplicado pero se permite saltar
            return {
              isDuplicate: true,
              matchInfo: existingById,
            };
          } else {
            // Es duplicado y no se permite
            return {
              isDuplicate: true,
              error: ValidationError.create({
                row,
                field: "id",
                value: id,
                errorType: "DUPLICATE",
                message: `Ya existe un AED con el ID "${id}"`,
                severity: "error",
                correctionSuggestion: `El AED duplicado tiene código: ${existingById.matchedCode || "N/A"}`,
              }),
              matchInfo: existingById,
            };
          }
        }
      } catch (error) {
        // ID no válido o no es UUID, continuar con otros métodos
        console.warn(`Invalid ID format during duplicate check: ${id}`, error);
      }
    }

    // ========================================
    // PRIORIDAD 2: Buscar por code
    // ========================================
    if (code) {
      const existingByCode = await this.aedRepository.findByCode(code);

      if (existingByCode && existingByCode.isDuplicate) {
        if (skipDuplicates) {
          return {
            isDuplicate: true,
            matchInfo: existingByCode,
          };
        } else {
          return {
            isDuplicate: true,
            error: ValidationError.create({
              row,
              field: "code",
              value: code,
              errorType: "DUPLICATE",
              message: `Ya existe un AED con el código "${code}"`,
              severity: "error",
              correctionSuggestion: `El AED duplicado tiene ID: ${existingByCode.matchedAedId}`,
            }),
            matchInfo: existingByCode,
          };
        }
      }
    }

    // ========================================
    // PRIORIDAD 3: Buscar por external_reference
    // ========================================
    if (externalRef) {
      const existingByExtRef = await this.aedRepository.findByExternalReference(externalRef);

      if (existingByExtRef && existingByExtRef.isDuplicate) {
        if (skipDuplicates) {
          return {
            isDuplicate: true,
            matchInfo: existingByExtRef,
          };
        } else {
          return {
            isDuplicate: true,
            error: ValidationError.create({
              row,
              field: "externalReference",
              value: externalRef,
              errorType: "DUPLICATE",
              message: `Ya existe un AED con la referencia externa "${externalRef}"`,
              severity: "error",
              correctionSuggestion: `El AED duplicado tiene código: ${existingByExtRef.matchedCode || "N/A"}`,
            }),
            matchInfo: existingByExtRef,
          };
        }
      }
    }

    // No se encontró ningún duplicado
    return { isDuplicate: false };
  }
}
