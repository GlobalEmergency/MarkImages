/**
 * Entity: SesiÃ³n de importaciÃ³n
 * Representa el estado completo de una sesiÃ³n de importaciÃ³n con mapeo
 * Capa de Dominio
 */

import { ColumnMapping } from "../value-objects/ColumnMapping";
import { CsvPreview } from "../value-objects/CsvPreview";
import { ValidationResult } from "../value-objects/ValidationResult";

export type ImportSessionStatus =
  | "PREVIEW" // Usuario viendo preview del CSV
  | "MAPPING" // Usuario configurando mapeos
  | "VALIDATING" // Sistema validando datos
  | "READY" // Listo para importar
  | "IMPORTING" // ImportaciÃ³n en progreso
  | "COMPLETED" // Completado
  | "FAILED"; // FallÃ³

export class ImportSession {
  private constructor(
    private readonly id: string,
    private readonly userId: string,
    private readonly fileName: string,
    private readonly filePath: string,
    private status: ImportSessionStatus,
    private preview: CsvPreview | null,
    private mappings: Map<string, ColumnMapping>,
    private validationResult: ValidationResult | null,
    private batchId: string | null,
    private readonly createdAt: Date,
    private updatedAt: Date
  ) {}

  // Getters
  get sessionId(): string {
    return this.id;
  }

  get currentStatus(): ImportSessionStatus {
    return this.status;
  }

  get csvPreview(): CsvPreview | null {
    return this.preview;
  }

  get columnMappings(): Map<string, ColumnMapping> {
    return new Map(this.mappings);
  }

  get validation(): ValidationResult | null {
    return this.validationResult;
  }

  get importBatchId(): string | null {
    return this.batchId;
  }

  get uploadedFileName(): string {
    return this.fileName;
  }

  get uploadedBy(): string {
    return this.userId;
  }

  /**
   * Crea una nueva sesiÃ³n de importaciÃ³n
   */
  static create(userId: string, fileName: string, filePath: string): ImportSession {
    return new ImportSession(
      this.generateId(),
      userId,
      fileName,
      filePath,
      "PREVIEW",
      null,
      new Map(),
      null,
      null,
      new Date(),
      new Date()
    );
  }

  /**
   * Establece el preview del CSV
   */
  setPreview(preview: CsvPreview): void {
    if (this.status !== "PREVIEW") {
      throw new Error("Can only set preview in PREVIEW status");
    }

    this.preview = preview;
    this.status = "MAPPING";
    this.updatedAt = new Date();
  }

  /**
   * Establece los mapeos de columnas
   */
  setMappings(mappings: ColumnMapping[]): void {
    if (this.status !== "MAPPING") {
      throw new Error("Can only set mappings in MAPPING status");
    }

    this.mappings = new Map(mappings.map((mapping) => [mapping.systemFieldKey, mapping]));
    this.status = "VALIDATING";
    this.updatedAt = new Date();
  }

  /**
   * Actualiza un mapeo especÃ­fico
   */
  updateMapping(mapping: ColumnMapping): void {
    if (this.status !== "MAPPING") {
      throw new Error("Can only update mappings in MAPPING status");
    }

    this.mappings.set(mapping.systemFieldKey, mapping);
    this.updatedAt = new Date();
  }

  /**
   * Elimina un mapeo
   */
  removeMapping(systemFieldKey: string): void {
    if (this.status !== "MAPPING") {
      throw new Error("Can only remove mappings in MAPPING status");
    }

    this.mappings.delete(systemFieldKey);
    this.updatedAt = new Date();
  }

  /**
   * Establece el resultado de validaciÃ³n
   */
  setValidation(validation: ValidationResult): void {
    if (this.status !== "VALIDATING") {
      throw new Error("Can only set validation in VALIDATING status");
    }

    this.validationResult = validation;

    // Si la validaciÃ³n tiene errores crÃ­ticos, volver a MAPPING
    if (!validation.isValid) {
      this.status = "MAPPING";
    } else {
      this.status = "READY";
    }

    this.updatedAt = new Date();
  }

  /**
   * Inicia el proceso de importaciÃ³n
   */
  startImport(batchId: string): void {
    if (this.status !== "READY") {
      throw new Error("Can only start import when status is READY");
    }

    this.batchId = batchId;
    this.status = "IMPORTING";
    this.updatedAt = new Date();
  }

  /**
   * Marca la importaciÃ³n como completada
   */
  markAsCompleted(): void {
    if (this.status !== "IMPORTING") {
      throw new Error("Can only complete when status is IMPORTING");
    }

    this.status = "COMPLETED";
    this.updatedAt = new Date();
  }

  /**
   * Marca la importaciÃ³n como fallida
   */
  markAsFailed(): void {
    this.status = "FAILED";
    this.updatedAt = new Date();
  }

  /**
   * Vuelve al estado de mapeo (si hay errores en validaciÃ³n)
   */
  backToMapping(): void {
    if (this.status !== "VALIDATING" && this.status !== "READY") {
      throw new Error("Can only go back to mapping from VALIDATING or READY");
    }

    this.status = "MAPPING";
    this.validationResult = null;
    this.updatedAt = new Date();
  }

  /**
   * Verifica si todos los campos requeridos estÃ¡n mapeados
   */
  hasAllRequiredMappings(requiredFields: string[]): boolean {
    return requiredFields.every((field) => this.mappings.has(field));
  }

  /**
   * Obtiene los campos requeridos que faltan por mapear
   */
  getMissingRequiredFields(requiredFields: string[]): string[] {
    return requiredFields.filter((field) => !this.mappings.has(field));
  }

  /**
   * Verifica si la sesiÃ³n estÃ¡ lista para validar
   */
  canValidate(requiredFields: string[]): boolean {
    return this.hasAllRequiredMappings(requiredFields) && this.status === "MAPPING";
  }

  /**
   * Verifica si la sesiÃ³n estÃ¡ lista para importar
   */
  canImport(): boolean {
    return (
      this.status === "READY" && this.validationResult !== null && this.validationResult.isValid
    );
  }

  /**
   * Genera un ID Ãºnico para la sesiÃ³n
   */
  private static generateId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }

  /**
   * Convierte a objeto plano para serializaciÃ³n
   */
  toJSON(): {
    id: string;
    userId: string;
    fileName: string;
    filePath: string;
    status: ImportSessionStatus;
    preview: ReturnType<CsvPreview["toJSON"]> | null;
    mappings: Array<ReturnType<ColumnMapping["toJSON"]>>;
    validation: ReturnType<ValidationResult["toJSON"]> | null;
    batchId: string | null;
    createdAt: string;
    updatedAt: string;
  } {
    return {
      id: this.id,
      userId: this.userId,
      fileName: this.fileName,
      filePath: this.filePath,
      status: this.status,
      preview: this.preview?.toJSON() || null,
      mappings: Array.from(this.mappings.values()).map((m) => m.toJSON()),
      validation: this.validationResult?.toJSON() || null,
      batchId: this.batchId,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }

  /**
   * Crea desde objeto plano
   */
  static fromJSON(data: {
    id: string;
    userId: string;
    fileName: string;
    filePath: string;
    status: ImportSessionStatus;
    preview: ReturnType<CsvPreview["toJSON"]> | null;
    mappings: Array<ReturnType<ColumnMapping["toJSON"]>>;
    validation: ReturnType<ValidationResult["toJSON"]> | null;
    batchId: string | null;
    createdAt: string;
    updatedAt: string;
  }): ImportSession {
    const mappings = new Map(
      data.mappings.map((m) => {
        const mapping = ColumnMapping.fromJSON(m);
        return [mapping.systemFieldKey, mapping];
      })
    );

    return new ImportSession(
      data.id,
      data.userId,
      data.fileName,
      data.filePath,
      data.status,
      data.preview ? CsvPreview.fromJSON(data.preview) : null,
      mappings,
      data.validation ? ValidationResult.fromJSON(data.validation) : null,
      data.batchId,
      new Date(data.createdAt),
      new Date(data.updatedAt)
    );
  }
}
