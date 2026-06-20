/**
 * Puerto (interfaz) para el repositorio de exportaciones
 * Define el contrato para las operaciones de base de datos
 */

export interface CreateExportBatchData {
  name: string;
  description?: string;
  filters?: ExportFilters;
  exportedBy: string;
  ipAddress?: string;
}

export interface ExportFilters {
  status?: string[];
  sourceOrigin?: string;
  importBatchId?: string;
  cityName?: string;
  cityCode?: string;
  regionCode?: string;
  organizationId?: string;
  useImportFormat?: boolean;
}

export interface ExportBatchInfo {
  id: string;
  name: string;
  description?: string | null;
  filters?: ExportFilters | null;
  fileName?: string | null;
  fileUrl?: string | null;
  fileSize?: number | null;
  fileHash?: string | null;
  totalRecords: number;
  successfulRecords: number;
  failedRecords: number;
  status: string;
  startedAt?: Date | null;
  completedAt?: Date | null;
  durationSeconds?: number | null;
  errorMessage?: string | null;
  exportedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpdateExportBatchData {
  status?: string;
  fileName?: string;
  fileUrl?: string;
  fileSize?: number;
  fileHash?: string;
  totalRecords?: number;
  successfulRecords?: number;
  failedRecords?: number;
  startedAt?: Date;
  completedAt?: Date;
  durationSeconds?: number;
  errorMessage?: string;
  errorDetails?: any;
}

export interface IExportRepository {
  createBatch(data: CreateExportBatchData): Promise<string>;

  updateBatch(batchId: string, data: UpdateExportBatchData): Promise<void>;

  getBatchInfo(batchId: string): Promise<ExportBatchInfo | null>;

  listBatches(params: { page: number; limit: number; userId?: string }): Promise<{
    batches: ExportBatchInfo[];
    total: number;
  }>;

  deleteBatch(batchId: string): Promise<void>;
}
