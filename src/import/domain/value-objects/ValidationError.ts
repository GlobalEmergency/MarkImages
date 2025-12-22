/**
 * Validation Error Value Object
 *
 * Representa un error de validación durante la importación de AEDs.
 * Es inmutable y tipado para facilitar el manejo de errores.
 */

export type ValidationErrorType =
  | "MISSING_DATA"
  | "MISSING_FIELD"
  | "INVALID_FORMAT"
  | "INVALID_COORDINATE"
  | "INVALID_POSTAL_CODE"
  | "DUPLICATE"
  | "IMAGE_ERROR"
  | "VALIDATION"
  | "BUSINESS_RULE_VIOLATION"
  | "PROCESSING_ERROR";

export type ValidationSeverity = "error" | "warning" | "info";

export interface ValidationErrorData {
  row: number;
  field?: string;
  csvColumn?: string;
  value?: string;
  errorType: ValidationErrorType;
  message: string;
  severity: ValidationSeverity;
  correctionSuggestion?: string;
}

export class ValidationError {
  private constructor(private readonly data: ValidationErrorData) {}

  static create(data: ValidationErrorData): ValidationError {
    return new ValidationError(data);
  }

  get row(): number {
    return this.data.row;
  }

  get field(): string | undefined {
    return this.data.field;
  }

  get csvColumn(): string | undefined {
    return this.data.csvColumn;
  }

  get value(): string | undefined {
    return this.data.value;
  }

  get errorType(): ValidationErrorType {
    return this.data.errorType;
  }

  get message(): string {
    return this.data.message;
  }

  get severity(): ValidationSeverity {
    return this.data.severity;
  }

  get correctionSuggestion(): string | undefined {
    return this.data.correctionSuggestion;
  }

  toJSON(): ValidationErrorData {
    return { ...this.data };
  }
}
