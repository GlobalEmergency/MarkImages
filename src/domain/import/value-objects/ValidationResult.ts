/**
 * Value Object: Resultado de validación de datos
 * Contiene issues encontrados durante la validación
 * Capa de Dominio
 */

export type ValidationSeverity = 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';

export interface ValidationIssue {
  row: number;
  field: string;
  value: string;
  severity: ValidationSeverity;
  message: string;
  suggestion?: string;
}

export class ValidationResult {
  private constructor(private readonly issues: ValidationIssue[]) {}

  get allIssues(): ValidationIssue[] {
    return [...this.issues];
  }

  /**
   * Obtiene solo los errores críticos
   */
  get criticalErrors(): ValidationIssue[] {
    return this.issues.filter((issue) => issue.severity === 'CRITICAL');
  }

  /**
   * Obtiene solo los errores
   */
  get errors(): ValidationIssue[] {
    return this.issues.filter((issue) => issue.severity === 'ERROR');
  }

  /**
   * Obtiene solo los warnings
   */
  get warnings(): ValidationIssue[] {
    return this.issues.filter((issue) => issue.severity === 'WARNING');
  }

  /**
   * Obtiene solo los info
   */
  get infos(): ValidationIssue[] {
    return this.issues.filter((issue) => issue.severity === 'INFO');
  }

  /**
   * Verifica si la validación fue exitosa (sin errores críticos ni errores)
   */
  isValid(): boolean {
    return this.criticalErrors.length === 0 && this.errors.length === 0;
  }

  /**
   * Verifica si hay errores críticos que bloquean la importación
   */
  hasCriticalErrors(): boolean {
    return this.criticalErrors.length > 0;
  }

  /**
   * Verifica si hay warnings
   */
  hasWarnings(): boolean {
    return this.warnings.length > 0;
  }

  /**
   * Obtiene el total de issues
   */
  get totalIssues(): number {
    return this.issues.length;
  }

  /**
   * Agrupa issues por fila
   */
  groupByRow(): Map<number, ValidationIssue[]> {
    const grouped = new Map<number, ValidationIssue[]>();

    for (const issue of this.issues) {
      const rowIssues = grouped.get(issue.row) || [];
      rowIssues.push(issue);
      grouped.set(issue.row, rowIssues);
    }

    return grouped;
  }

  /**
   * Agrupa issues por campo
   */
  groupByField(): Map<string, ValidationIssue[]> {
    const grouped = new Map<string, ValidationIssue[]>();

    for (const issue of this.issues) {
      const fieldIssues = grouped.get(issue.field) || [];
      fieldIssues.push(issue);
      grouped.set(issue.field, fieldIssues);
    }

    return grouped;
  }

  /**
   * Obtiene un resumen de la validación
   */
  getSummary(): {
    totalIssues: number;
    criticalCount: number;
    errorCount: number;
    warningCount: number;
    infoCount: number;
    isValid: boolean;
    canProceed: boolean;
  } {
    return {
      totalIssues: this.totalIssues,
      criticalCount: this.criticalErrors.length,
      errorCount: this.errors.length,
      warningCount: this.warnings.length,
      infoCount: this.infos.length,
      isValid: this.isValid(),
      canProceed: !this.hasCriticalErrors(),
    };
  }

  /**
   * Crea un resultado de validación exitosa (sin issues)
   */
  static success(): ValidationResult {
    return new ValidationResult([]);
  }

  /**
   * Crea un resultado con issues
   */
  static withIssues(issues: ValidationIssue[]): ValidationResult {
    return new ValidationResult(issues);
  }

  /**
   * Crea un resultado con un solo issue
   */
  static withSingleIssue(issue: ValidationIssue): ValidationResult {
    return new ValidationResult([issue]);
  }

  /**
   * Combina múltiples resultados de validación
   */
  static combine(results: ValidationResult[]): ValidationResult {
    const allIssues = results.flatMap((result) => result.allIssues);
    return new ValidationResult(allIssues);
  }

  /**
   * Convierte a objeto plano para serialización
   */
  toJSON(): {
    issues: ValidationIssue[];
    summary: ReturnType<ValidationResult['getSummary']>;
  } {
    return {
      issues: this.issues,
      summary: this.getSummary(),
    };
  }

  /**
   * Crea desde objeto plano
   */
  static fromJSON(data: { issues: ValidationIssue[] }): ValidationResult {
    return new ValidationResult(data.issues);
  }
}
