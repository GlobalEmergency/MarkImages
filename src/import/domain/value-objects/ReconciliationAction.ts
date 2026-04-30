/**
 * Value Object: AcciÃ³n de reconciliaciÃ³n
 * Capa de Dominio - Representa la acciÃ³n a tomar para un registro
 *
 * Determina si un registro debe ser creado, actualizado, saltado,
 * marcado como conflicto, o si el AED existente debe desactivarse
 */

import type { ImportRecord } from "./ImportRecord";

/**
 * Tipos de acciones de reconciliaciÃ³n
 */
export type ReconciliationActionType =
  | "CREATE" // Crear nuevo AED
  | "UPDATE" // Actualizar AED existente
  | "SKIP" // Saltar (sin cambios o ya enriquecido)
  | "DEACTIVATE" // Desactivar AED (no estÃ¡ en fuente)
  | "CONFLICT"; // Conflicto que requiere revisiÃ³n manual

/**
 * Detalle de un conflicto entre valores
 */
export interface ConflictDetail {
  /**
   * Campo en conflicto
   */
  field: string;

  /**
   * Valor actual en la base de datos
   */
  currentValue: unknown;

  /**
   * Valor en la fuente externa
   */
  externalValue: unknown;

  /**
   * Estrategia sugerida para resolver
   */
  suggestedResolution?: "KEEP_CURRENT" | "USE_EXTERNAL" | "MERGE" | "REVIEW";
}

/**
 * Value Object: AcciÃ³n de reconciliaciÃ³n
 */
export class ReconciliationAction {
  private constructor(
    public readonly type: ReconciliationActionType,
    public readonly record: ImportRecord | null,
    public readonly matchedAedId: string | null,
    public readonly changedFields: string[],
    public readonly conflictDetails: ConflictDetail[],
    public readonly reason: string,
    public readonly hasWarning: boolean,
    public readonly warningMessage: string | null
  ) {}

  // ============================================
  // FACTORY METHODS
  // ============================================

  /**
   * Crear nuevo AED
   */
  static create(record: ImportRecord): ReconciliationAction {
    return new ReconciliationAction(
      "CREATE",
      record,
      null,
      [],
      [],
      "Nuevo registro - no existe en la base de datos",
      false,
      null
    );
  }

  /**
   * Crear nuevo AED con advertencia (posible duplicado)
   */
  static createWithWarning(record: ImportRecord, warningMessage: string): ReconciliationAction {
    return new ReconciliationAction(
      "CREATE",
      record,
      null,
      [],
      [],
      "Nuevo registro con advertencia",
      true,
      warningMessage
    );
  }

  /**
   * Actualizar AED existente
   */
  static update(
    record: ImportRecord,
    aedId: string,
    changedFields: string[]
  ): ReconciliationAction {
    const fieldsDesc = changedFields.length > 0 ? changedFields.join(", ") : "contenido";
    return new ReconciliationAction(
      "UPDATE",
      record,
      aedId,
      changedFields,
      [],
      `Actualizar campos: ${fieldsDesc}`,
      false,
      null
    );
  }

  /**
   * Saltar registro (sin cambios)
   */
  static skip(record: ImportRecord, aedId: string, reason: string): ReconciliationAction {
    return new ReconciliationAction("SKIP", record, aedId, [], [], reason, false, null);
  }

  /**
   * Saltar por no haber cambios
   */
  static skipNoChanges(record: ImportRecord, aedId: string): ReconciliationAction {
    return ReconciliationAction.skip(
      record,
      aedId,
      "Sin cambios - el registro ya estÃ¡ actualizado"
    );
  }

  /**
   * Saltar porque estÃ¡ enriquecido manualmente
   */
  static skipEnriched(record: ImportRecord, aedId: string): ReconciliationAction {
    return ReconciliationAction.skip(
      record,
      aedId,
      "Registro enriquecido - no sobrescribir datos manuales"
    );
  }

  /**
   * Desactivar AED (ya no estÃ¡ en la fuente)
   */
  static deactivate(aedId: string, reason?: string): ReconciliationAction {
    return new ReconciliationAction(
      "DEACTIVATE",
      null,
      aedId,
      [],
      [],
      reason || "No encontrado en fuente externa - marcar como inactivo",
      false,
      null
    );
  }

  /**
   * Marcar como conflicto para revisiÃ³n manual
   */
  static conflict(
    record: ImportRecord,
    aedId: string,
    conflictDetails: ConflictDetail[]
  ): ReconciliationAction {
    const fieldsInConflict = conflictDetails.map((c) => c.field).join(", ");
    return new ReconciliationAction(
      "CONFLICT",
      record,
      aedId,
      [],
      conflictDetails,
      `Conflicto en campos: ${fieldsInConflict}`,
      true,
      `Se encontrÃ³ un posible duplicado con conflictos en: ${fieldsInConflict}`
    );
  }

  /**
   * Conflicto por posible duplicado (score alto pero no exacto)
   */
  static possibleDuplicate(
    record: ImportRecord,
    aedId: string,
    score: number
  ): ReconciliationAction {
    return new ReconciliationAction(
      "CONFLICT",
      record,
      aedId,
      [],
      [
        {
          field: "duplicate_score",
          currentValue: aedId,
          externalValue: record.externalId,
          suggestedResolution: "REVIEW",
        },
      ],
      `Posible duplicado con score ${score}/100`,
      true,
      `Posible duplicado detectado (score: ${score}/100). Requiere revisiÃ³n manual.`
    );
  }

  // ============================================
  // MÃ‰TODOS DE CONSULTA
  // ============================================

  /**
   * Verifica si la acciÃ³n requiere crear un nuevo AED
   */
  isCreate(): boolean {
    return this.type === "CREATE";
  }

  /**
   * Verifica si la acciÃ³n requiere actualizar un AED
   */
  isUpdate(): boolean {
    return this.type === "UPDATE";
  }

  /**
   * Verifica si la acciÃ³n es saltar
   */
  isSkip(): boolean {
    return this.type === "SKIP";
  }

  /**
   * Verifica si la acciÃ³n requiere desactivar
   */
  isDeactivate(): boolean {
    return this.type === "DEACTIVATE";
  }

  /**
   * Verifica si hay conflicto
   */
  isConflict(): boolean {
    return this.type === "CONFLICT";
  }

  /**
   * Verifica si afecta a un AED existente
   */
  affectsExistingAed(): boolean {
    return this.matchedAedId !== null;
  }

  /**
   * Verifica si requiere revisiÃ³n manual
   */
  requiresManualReview(): boolean {
    return this.type === "CONFLICT" || this.hasWarning;
  }

  /**
   * Obtiene el nÃºmero de campos en conflicto
   */
  getConflictCount(): number {
    return this.conflictDetails.length;
  }

  // ============================================
  // SERIALIZACIÃ“N
  // ============================================

  /**
   * Convierte a objeto plano para serializaciÃ³n
   */
  toJSON(): {
    type: ReconciliationActionType;
    matchedAedId: string | null;
    changedFields: string[];
    conflictDetails: ConflictDetail[];
    reason: string;
    hasWarning: boolean;
    warningMessage: string | null;
    record: ReturnType<ImportRecord["toJSON"]> | null;
  } {
    return {
      type: this.type,
      matchedAedId: this.matchedAedId,
      changedFields: this.changedFields,
      conflictDetails: this.conflictDetails,
      reason: this.reason,
      hasWarning: this.hasWarning,
      warningMessage: this.warningMessage,
      record: this.record?.toJSON() || null,
    };
  }

  /**
   * Genera un mensaje descriptivo de la acciÃ³n
   */
  describe(): string {
    switch (this.type) {
      case "CREATE":
        return this.hasWarning
          ? `CREAR (con advertencia): ${this.warningMessage}`
          : `CREAR: ${this.record?.externalId || "nuevo registro"}`;

      case "UPDATE":
        return `ACTUALIZAR ${this.matchedAedId}: ${this.changedFields.join(", ")}`;

      case "SKIP":
        return `SALTAR ${this.matchedAedId}: ${this.reason}`;

      case "DEACTIVATE":
        return `DESACTIVAR ${this.matchedAedId}: ${this.reason}`;

      case "CONFLICT":
        return `CONFLICTO ${this.matchedAedId}: ${this.conflictDetails.map((c) => c.field).join(", ")}`;

      default:
        return `${this.type}: ${this.reason}`;
    }
  }
}
