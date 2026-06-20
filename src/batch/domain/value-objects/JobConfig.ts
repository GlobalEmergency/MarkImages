/**
 * Job Config Value Object
 *
 * Generic configuration container for batch jobs.
 * Each job type can have its own specific configuration structure.
 */

import { JobType } from "./JobType";

/**
 * Base configuration shared by all job types
 */
export interface BaseJobConfig {
  // Execution settings
  chunkSize: number; // Records per chunk (default: 100)
  maxRetries: number; // Max retries per record (default: 3)
  retryDelayMs: number; // Delay between retries (default: 1000)
  timeoutMs: number; // Max time per chunk (default: 90000 for Vercel)

  // Checkpoint settings
  checkpointFrequency: number; // Save checkpoint every N records (default: 10)
  heartbeatIntervalMs: number; // Heartbeat interval (default: 30000)

  // Behavior flags
  skipOnError: boolean; // Continue on individual record errors (default: true)
  dryRun: boolean; // Don't make actual changes (default: false)
  validateOnly: boolean; // Only validate, don't process (default: false)

  // Notification settings
  notifyOnComplete: boolean; // Send notification when done
  notifyOnError: boolean; // Send notification on errors
}

/**
 * Configuration for AED CSV Import
 */
export interface AedCsvImportConfig extends BaseJobConfig {
  type: typeof JobType.AED_CSV_IMPORT;
  filePath: string;
  columnMappings: Array<{
    csvColumn: string;
    systemField: string;
  }>;
  delimiter?: string;
  skipDuplicates: boolean;
  duplicateThreshold: number;
  organizationId?: string;
  sharePointAuth?: {
    fedAuth: string;
    rtFa?: string;
  };
}

/**
 * Configuration for External Data Source Sync
 */
export interface ExternalSyncConfig extends BaseJobConfig {
  type: typeof JobType.AED_EXTERNAL_SYNC;
  dataSourceId: string;
  forceFullSync: boolean;
  autoDeactivateMissing: boolean;
  fieldMappings?: Record<string, string>;
}

/**
 * Configuration for AED Export
 */
export interface AedExportConfig extends BaseJobConfig {
  type: typeof JobType.AED_CSV_EXPORT | typeof JobType.AED_JSON_EXPORT;
  filters?: {
    status?: string[];
    organizationId?: string;
    regionCode?: string;
    cityCode?: string;
    cityName?: string; // Added for UI consistency
    dateFrom?: Date;
    dateTo?: Date;
  };
  fields: string[];
  includeImages: boolean;
  format: "csv" | "json";
  useImportFormat?: boolean; // Habilita el formato full de 58 columnas
  delimiter?: string; // Permite separador personalizado (por defecto ';')
  outputPath?: string;
}

/**
 * Configuration for Bulk Update
 */
export interface BulkUpdateConfig extends BaseJobConfig {
  type: typeof JobType.BULK_AED_UPDATE;
  targetIds: string[];
  updates: Record<string, unknown>;
  filters?: Record<string, unknown>;
}

/**
 * Configuration for Bulk Status Change
 */
export interface BulkStatusChangeConfig extends BaseJobConfig {
  type: typeof JobType.BULK_STATUS_CHANGE;
  targetIds: string[];
  newStatus: string;
  reason?: string;
}

/**
 * Configuration for Bulk Delete
 */
export interface BulkDeleteConfig extends BaseJobConfig {
  type: typeof JobType.BULK_AED_DELETE;
  targetIds: string[];
  hardDelete: boolean;
}

/**
 * Configuration for Bulk Verification
 */
export interface BulkVerificationConfig extends BaseJobConfig {
  type: typeof JobType.BULK_VERIFICATION;
  targetIds: string[];
  verificationType: string;
  verificationData: Record<string, unknown>;
}

/**
 * Configuration for Data Cleanup
 */
export interface DataCleanupConfig extends BaseJobConfig {
  type: typeof JobType.DATA_CLEANUP;
  cleanupTypes: Array<"orphans" | "duplicates" | "invalid" | "expired">;
}

/**
 * Configuration for Report Generation
 */
export interface ReportGenerationConfig extends BaseJobConfig {
  type: typeof JobType.REPORT_GENERATION;
  reportType: string;
  parameters: Record<string, unknown>;
  format: "pdf" | "xlsx" | "csv";
}

/**
 * Union of all job configurations
 */
export type JobConfig =
  | AedCsvImportConfig
  | ExternalSyncConfig
  | AedExportConfig
  | BulkUpdateConfig
  | BulkStatusChangeConfig
  | BulkDeleteConfig
  | BulkVerificationConfig
  | DataCleanupConfig
  | ReportGenerationConfig;

/**
 * Default values for base configuration
 */
export const DEFAULT_BASE_CONFIG: BaseJobConfig = {
  chunkSize: 100,
  maxRetries: 3,
  retryDelayMs: 1000,
  timeoutMs: 90000, // 90 seconds (Vercel limit is 100)
  checkpointFrequency: 10,
  heartbeatIntervalMs: 30000,
  skipOnError: true,
  dryRun: false,
  validateOnly: false,
  notifyOnComplete: false,
  notifyOnError: false,
};

/**
 * Merge provided config with defaults
 */
export function mergeWithDefaults<T extends Partial<BaseJobConfig>>(config: T): T & BaseJobConfig {
  return {
    ...DEFAULT_BASE_CONFIG,
    ...config,
  };
}

/**
 * Validate configuration based on job type
 */
export function validateJobConfig(config: JobConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Base validations
  if (config.chunkSize < 1 || config.chunkSize > 1000) {
    errors.push("chunkSize must be between 1 and 1000");
  }

  if (config.timeoutMs < 1000 || config.timeoutMs > 100000) {
    errors.push("timeoutMs must be between 1000 and 100000");
  }

  // Type-specific validations
  switch (config.type) {
    case JobType.AED_CSV_IMPORT:
      if (!config.filePath) {
        errors.push("filePath is required for CSV import");
      }
      if (!config.columnMappings || config.columnMappings.length === 0) {
        errors.push("columnMappings is required for CSV import");
      }
      break;

    case JobType.AED_EXTERNAL_SYNC:
      if (!config.dataSourceId) {
        errors.push("dataSourceId is required for external sync");
      }
      break;

    case JobType.BULK_AED_UPDATE:
    case JobType.BULK_STATUS_CHANGE:
    case JobType.BULK_AED_DELETE:
    case JobType.BULK_VERIFICATION:
      if (!config.targetIds || config.targetIds.length === 0) {
        errors.push("targetIds is required for bulk operations");
      }
      break;
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Calculate estimated duration based on config
 */
export function estimateJobDuration(
  config: JobConfig,
  totalRecords: number,
  msPerRecord: number = 100
): {
  estimatedMs: number;
  estimatedChunks: number;
  estimatedInvocations: number;
} {
  const totalMs = totalRecords * msPerRecord;
  const totalChunks = Math.ceil(totalRecords / config.chunkSize);
  const invocations = Math.ceil(totalMs / config.timeoutMs);

  return {
    estimatedMs: totalMs,
    estimatedChunks: totalChunks,
    estimatedInvocations: Math.max(1, invocations),
  };
}
