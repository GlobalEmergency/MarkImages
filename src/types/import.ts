/**
 * Types for DEA CSV Import System
 */

export interface ImportBatch {
  id: string;
  name: string;
  description: string | null;
  source_origin: string;
  file_name: string | null;
  file_url: string | null;
  file_size: number | null;
  total_records: number;
  successful_records: number;
  failed_records: number;
  warning_records: number;
  status: ImportStatus;
  completed_at: string | null;
  duration_seconds: number | null;
  imported_by: string;
  created_at: string;
  _count?: {
    errors: number;
    aeds: number;
  };
}

export type ImportStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "COMPLETED_WITH_ERRORS"
  | "FAILED"
  | "CANCELLED"
  | "INTERRUPTED"
  | "RESUMING";

export interface ImportError {
  id: string;
  import_batch_id: string;
  row_number: number | null;
  record_reference: string | null;
  error_type: ImportErrorType;
  affected_field: string | null;
  original_value: string | null;
  error_message: string;
  severity: ErrorSeverity;
  row_data: Record<string, unknown> | null;
  created_at: string;
}

export type ImportErrorType =
  | "VALIDATION"
  | "FORMAT"
  | "DUPLICATE_DATA"
  | "MISSING_DATA"
  | "INVALID_DATA"
  | "RELATION_NOT_FOUND"
  | "INVALID_COORDINATES"
  | "ADDRESS_NOT_FOUND"
  | "SYSTEM_ERROR";

export type ErrorSeverity = "INFO" | "WARNING" | "ERROR" | "CRITICAL";

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// Dry-run validation report
export interface ValidationIssueData {
  rowNumber: number;
  issueType: "DUPLICATE" | "VALIDATION" | "IMAGE_ERROR" | "MISSING_FIELD";
  severity: "ERROR" | "WARNING";
  field?: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface DryRunReport {
  dryRun: true;
  totalRecords: number;
  validRecords: number;
  invalidRecords: number;

  issues: {
    duplicates: number;
    validationErrors: number;
    imageErrors: number;
    missingFields: number;
  };

  // Solo primeros N para mostrar en UI
  sampleIssues: ValidationIssueData[];

  // Resumen
  summary: {
    wouldImport: number;
    wouldSkip: number;
    estimatedDurationSeconds: number;
  };

  // Para exportar reporte completo
  exportUrl?: string;
}

export interface RealImportResponse {
  dryRun: false;
  batchId: string;
  totalRecords: number;
  successfulRecords: number;
  failedRecords: number;
  errors: Array<{ row: number; message: string }>;
}
