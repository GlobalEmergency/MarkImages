/**
 * Value Object: Problema detectado durante la validación de importación
 * Capa de Dominio
 */

export type IssueType = "DUPLICATE" | "VALIDATION" | "IMAGE_ERROR" | "MISSING_FIELD";
export type IssueSeverity = "ERROR" | "WARNING";

export interface ValidationIssueData {
  rowNumber: number;
  issueType: IssueType;
  severity: IssueSeverity;
  field?: string;
  message: string;
  details?: Record<string, unknown>;
}

export class ValidationIssue {
  private constructor(
    private readonly _rowNumber: number,
    private readonly _issueType: IssueType,
    private readonly _severity: IssueSeverity,
    private readonly _message: string,
    private readonly _field?: string,
    private readonly _details?: Record<string, unknown>
  ) {}

  static create(data: ValidationIssueData): ValidationIssue {
    return new ValidationIssue(
      data.rowNumber,
      data.issueType,
      data.severity,
      data.message,
      data.field,
      data.details
    );
  }

  static missingField(rowNumber: number, fieldName: string): ValidationIssue {
    return new ValidationIssue(
      rowNumber,
      "MISSING_FIELD",
      "ERROR",
      `Campo requerido faltante: ${fieldName}`,
      fieldName
    );
  }

  static duplicate(rowNumber: number, message: string, matchedAedId: string): ValidationIssue {
    return new ValidationIssue(rowNumber, "DUPLICATE", "WARNING", message, undefined, {
      matchedAedId,
    });
  }

  static imageError(rowNumber: number, imageUrl: string, error: string): ValidationIssue {
    return new ValidationIssue(
      rowNumber,
      "IMAGE_ERROR",
      "WARNING",
      `Imagen no accesible: ${error}`,
      "image",
      { imageUrl }
    );
  }

  static validationError(rowNumber: number, field: string, message: string): ValidationIssue {
    return new ValidationIssue(rowNumber, "VALIDATION", "ERROR", message, field);
  }

  get rowNumber(): number {
    return this._rowNumber;
  }

  get issueType(): IssueType {
    return this._issueType;
  }

  get severity(): IssueSeverity {
    return this._severity;
  }

  get message(): string {
    return this._message;
  }

  get field(): string | undefined {
    return this._field;
  }

  get details(): Record<string, unknown> | undefined {
    return this._details ? { ...this._details } : undefined;
  }

  isError(): boolean {
    return this._severity === "ERROR";
  }

  isWarning(): boolean {
    return this._severity === "WARNING";
  }

  toJSON(): ValidationIssueData {
    return {
      rowNumber: this._rowNumber,
      issueType: this._issueType,
      severity: this._severity,
      field: this._field,
      message: this._message,
      details: this.details,
    };
  }

  toString(): string {
    const fieldPart = this._field ? ` [${this._field}]` : "";
    return `Row ${this._rowNumber}${fieldPart}: ${this._message}`;
  }
}
