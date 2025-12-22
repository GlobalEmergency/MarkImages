/**
 * Validation Result Value Object
 *
 * Representa el resultado de una validación de importación.
 * Contiene estadísticas, errores y advertencias.
 */

import { ValidationError, ValidationErrorData, ValidationErrorType, ValidationSeverity } from "./ValidationError";

// Re-exportar tipos para facilitar el uso desde adapters
export { ValidationError };
export type { ValidationErrorData, ValidationErrorType, ValidationSeverity };

export interface PreviewRecord {
  rowNumber: number;
  status: 'valid' | 'invalid' | 'skipped';
  mappedData: Record<string, unknown>;
  originalData: Record<string, unknown>;
  errors?: ValidationErrorData[];
}

export interface SharePointInfo {
  detected: boolean;
  sampleUrls: string[];
  imageFields: string[];
}

export interface ValidationSummary {
  isValid: boolean;
  totalRecords: number;
  validRecords: number;
  invalidRecords: number;
  skippedRecords: number;
  warningRecords: number;
  processedRecords: number;
  wouldCreate: number;
  wouldSkip: number;
  errors: ValidationErrorData[];
  warnings: ValidationErrorData[];
  errorSummary: {
    byType: Record<string, number>;
    byField: Record<string, number>;
    total: number;
  };
  previewRecords?: PreviewRecord[];
  sharepoint?: SharePointInfo;
}

export class ValidationResult {
  private constructor(
    private readonly errors: ValidationError[],
    private readonly warnings: ValidationError[],
    private readonly stats: {
      totalRecords: number;
      validRecords: number;
      invalidRecords: number;
      skippedRecords: number;
      warningRecords: number;
    },
    private readonly previewRecords?: PreviewRecord[],
    private readonly sharePointInfo?: SharePointInfo
  ) {}

  static empty(): ValidationResult {
    return new ValidationResult([], [], {
      totalRecords: 0,
      validRecords: 0,
      invalidRecords: 0,
      skippedRecords: 0,
      warningRecords: 0,
    }, [], undefined);
  }

  static create(
    errors: ValidationError[],
    warnings: ValidationError[],
    stats: {
      totalRecords: number;
      validRecords: number;
      invalidRecords: number;
      skippedRecords: number;
      warningRecords: number;
    },
    previewRecords?: PreviewRecord[],
    sharePointInfo?: SharePointInfo
  ): ValidationResult {
    return new ValidationResult(errors, warnings, stats, previewRecords, sharePointInfo);
  }

  get isValid(): boolean {
    return this.errors.length === 0;
  }

  get hasWarnings(): boolean {
    return this.warnings.length > 0;
  }

  get totalRecords(): number {
    return this.stats.totalRecords;
  }

  get validRecords(): number {
    return this.stats.validRecords;
  }

  get invalidRecords(): number {
    return this.stats.invalidRecords;
  }

  get skippedRecords(): number {
    return this.stats.skippedRecords;
  }

  get warningRecords(): number {
    return this.stats.warningRecords;
  }

  get processedRecords(): number {
    return this.stats.validRecords + this.stats.invalidRecords + this.stats.skippedRecords;
  }

  getErrors(): ValidationError[] {
    return [...this.errors];
  }

  getWarnings(): ValidationError[] {
    return [...this.warnings];
  }

  /**
   * Agrupa errores por tipo
   */
  getErrorsByType(): Record<string, number> {
    const byType: Record<string, number> = {};
    this.errors.forEach((error) => {
      byType[error.errorType] = (byType[error.errorType] || 0) + 1;
    });
    return byType;
  }

  /**
   * Agrupa errores por campo
   */
  getErrorsByField(): Record<string, number> {
    const byField: Record<string, number> = {};
    this.errors.forEach((error) => {
      if (error.field) {
        byField[error.field] = (byField[error.field] || 0) + 1;
      }
    });
    return byField;
  }

  /**
   * Serializa para API response
   */
  toSummary(maxErrors: number = 50, maxWarnings: number = 20): ValidationSummary {
    return {
      isValid: this.isValid,
      totalRecords: this.totalRecords,
      validRecords: this.validRecords,
      invalidRecords: this.invalidRecords,
      skippedRecords: this.skippedRecords,
      warningRecords: this.warningRecords,
      processedRecords: this.processedRecords,
      wouldCreate: this.validRecords,
      wouldSkip: this.skippedRecords,
      errors: this.errors.slice(0, maxErrors).map((e) => e.toJSON()),
      warnings: this.warnings.slice(0, maxWarnings).map((w) => w.toJSON()),
      errorSummary: {
        byType: this.getErrorsByType(),
        byField: this.getErrorsByField(),
        total: this.errors.length,
      },
      previewRecords: this.previewRecords,
      sharepoint: this.sharePointInfo,
    };
  }

  /**
   * Serializa para almacenamiento
   */
  toJSON(): {
    errors: ValidationErrorData[];
    warnings: ValidationErrorData[];
    stats: {
      totalRecords: number;
      validRecords: number;
      invalidRecords: number;
      skippedRecords: number;
      warningRecords: number;
    };
  } {
    return {
      errors: this.errors.map((e) => e.toJSON()),
      warnings: this.warnings.map((w) => w.toJSON()),
      stats: this.stats,
    };
  }

  /**
   * Deserializa desde almacenamiento
   */
  static fromJSON(data: {
    errors: ValidationErrorData[];
    warnings: ValidationErrorData[];
    stats: {
      totalRecords: number;
      validRecords: number;
      invalidRecords: number;
      skippedRecords: number;
      warningRecords: number;
    };
  }): ValidationResult {
    const errors = data.errors.map((e) => ValidationError.create(e));
    const warnings = data.warnings.map((w) => ValidationError.create(w));
    return new ValidationResult(errors, warnings, data.stats);
  }

  /**
   * Crea un resultado exitoso sin errores
   */
  static success(): ValidationResult {
    return ValidationResult.empty();
  }

  /**
   * Crea un resultado con issues desde los adaptadores
   * (Compatibilidad con IDataSourceAdapter)
   */
  static withIssues(issues: Array<{ severity: string; message: string; row?: number; field?: string; value?: string }>): ValidationResult {
    const errors = issues
      .filter((i) => i.severity === "CRITICAL" || i.severity === "ERROR")
      .map((i) =>
        ValidationError.create({
          row: i.row || 0,
          field: i.field,
          value: i.value,
          errorType: "BUSINESS_RULE_VIOLATION",
          message: i.message,
          severity: "error",
        })
      );

    const warnings = issues
      .filter((i) => i.severity === "WARNING")
      .map((i) =>
        ValidationError.create({
          row: i.row || 0,
          field: i.field,
          value: i.value,
          errorType: "BUSINESS_RULE_VIOLATION",
          message: i.message,
          severity: "warning",
        })
      );

    return new ValidationResult(errors, warnings, {
      totalRecords: 0,
      validRecords: 0,
      invalidRecords: errors.length,
      skippedRecords: 0,
      warningRecords: warnings.length,
    }, undefined, undefined);
  }

  /**
   * Verifica si hay errores críticos
   * (Compatibilidad con IDataSourceAdapter)
   */
  hasCriticalErrors(): boolean {
    return !this.isValid;
  }

  /**
   * Obtiene los errores críticos
   * (Compatibilidad con IDataSourceAdapter)
   */
  get criticalErrors(): Array<{ message: string }> {
    return this.errors.map((e) => ({ message: e.message }));
  }
}
