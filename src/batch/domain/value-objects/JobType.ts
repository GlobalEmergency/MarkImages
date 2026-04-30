/**
 * Job Type Value Object
 *
 * Represents the type of batch job operation.
 * Each type defines a specific kind of batch processing task.
 */

export const JobType = {
  // Import operations
  AED_CSV_IMPORT: "AED_CSV_IMPORT",
  AED_EXTERNAL_SYNC: "AED_EXTERNAL_SYNC",

  // Export operations
  AED_CSV_EXPORT: "AED_CSV_EXPORT",
  AED_JSON_EXPORT: "AED_JSON_EXPORT",

  // Bulk operations
  BULK_AED_UPDATE: "BULK_AED_UPDATE",
  BULK_AED_DELETE: "BULK_AED_DELETE",
  BULK_STATUS_CHANGE: "BULK_STATUS_CHANGE",

  // Verification operations
  BULK_VERIFICATION: "BULK_VERIFICATION",

  // Maintenance operations
  DATA_CLEANUP: "DATA_CLEANUP",
  IMAGE_OPTIMIZATION: "IMAGE_OPTIMIZATION",

  // Report generation
  REPORT_GENERATION: "REPORT_GENERATION",
} as const;

// eslint-disable-next-line no-redeclare
export type JobType = (typeof JobType)[keyof typeof JobType];

/**
 * Job type metadata for UI and validation
 */
export interface JobTypeMetadata {
  type: JobType;
  label: string;
  description: string;
  category: "import" | "export" | "bulk" | "verification" | "maintenance" | "report";
  requiresFile: boolean;
  supportsChunking: boolean;
  estimatedTimePerRecord: number; // milliseconds
}

export const JOB_TYPE_METADATA: Record<JobType, JobTypeMetadata> = {
  [JobType.AED_CSV_IMPORT]: {
    type: JobType.AED_CSV_IMPORT,
    label: "Importación CSV de DEAs",
    description: "Importa desfibriladores desde un archivo CSV",
    category: "import",
    requiresFile: true,
    supportsChunking: true,
    estimatedTimePerRecord: 100,
  },
  [JobType.AED_EXTERNAL_SYNC]: {
    type: JobType.AED_EXTERNAL_SYNC,
    label: "Sincronización Externa",
    description: "Sincroniza DEAs desde una fuente de datos externa",
    category: "import",
    requiresFile: false,
    supportsChunking: true,
    estimatedTimePerRecord: 150,
  },
  [JobType.AED_CSV_EXPORT]: {
    type: JobType.AED_CSV_EXPORT,
    label: "Exportación CSV de DEAs",
    description: "Exporta desfibriladores a un archivo CSV",
    category: "export",
    requiresFile: false,
    supportsChunking: true,
    estimatedTimePerRecord: 10,
  },
  [JobType.AED_JSON_EXPORT]: {
    type: JobType.AED_JSON_EXPORT,
    label: "Exportación JSON de DEAs",
    description: "Exporta desfibriladores a un archivo JSON",
    category: "export",
    requiresFile: false,
    supportsChunking: true,
    estimatedTimePerRecord: 10,
  },
  [JobType.BULK_AED_UPDATE]: {
    type: JobType.BULK_AED_UPDATE,
    label: "Actualización Masiva de DEAs",
    description: "Actualiza múltiples campos en varios DEAs",
    category: "bulk",
    requiresFile: false,
    supportsChunking: true,
    estimatedTimePerRecord: 50,
  },
  [JobType.BULK_AED_DELETE]: {
    type: JobType.BULK_AED_DELETE,
    label: "Eliminación Masiva de DEAs",
    description: "Elimina múltiples DEAs del sistema",
    category: "bulk",
    requiresFile: false,
    supportsChunking: true,
    estimatedTimePerRecord: 30,
  },
  [JobType.BULK_STATUS_CHANGE]: {
    type: JobType.BULK_STATUS_CHANGE,
    label: "Cambio Masivo de Estado",
    description: "Cambia el estado de múltiples DEAs",
    category: "bulk",
    requiresFile: false,
    supportsChunking: true,
    estimatedTimePerRecord: 20,
  },
  [JobType.BULK_VERIFICATION]: {
    type: JobType.BULK_VERIFICATION,
    label: "Verificación Masiva",
    description: "Verifica múltiples DEAs en lote",
    category: "verification",
    requiresFile: false,
    supportsChunking: true,
    estimatedTimePerRecord: 100,
  },
  [JobType.DATA_CLEANUP]: {
    type: JobType.DATA_CLEANUP,
    label: "Limpieza de Datos",
    description: "Limpia datos huérfanos y corrige inconsistencias",
    category: "maintenance",
    requiresFile: false,
    supportsChunking: true,
    estimatedTimePerRecord: 20,
  },
  [JobType.IMAGE_OPTIMIZATION]: {
    type: JobType.IMAGE_OPTIMIZATION,
    label: "Optimización de Imágenes",
    description: "Optimiza y redimensiona imágenes de DEAs",
    category: "maintenance",
    requiresFile: false,
    supportsChunking: true,
    estimatedTimePerRecord: 500,
  },
  [JobType.REPORT_GENERATION]: {
    type: JobType.REPORT_GENERATION,
    label: "Generación de Reportes",
    description: "Genera reportes estadísticos",
    category: "report",
    requiresFile: false,
    supportsChunking: false,
    estimatedTimePerRecord: 1000,
  },
};

export function getJobTypeMetadata(type: JobType): JobTypeMetadata {
  return JOB_TYPE_METADATA[type];
}

export function isValidJobType(type: string): type is JobType {
  return Object.values(JobType).includes(type as JobType);
}
