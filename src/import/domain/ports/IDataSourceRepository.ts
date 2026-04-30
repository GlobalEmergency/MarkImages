/**
 * Puerto: Repositorio de fuentes de datos externas
 * Capa de Dominio - Interface para CRUD de ExternalDataSource
 */

import type {
  DataSourceType,
  SyncFrequency,
  MatchingStrategy,
  DataSourceConfig,
  ExternalDataSourceConfig,
} from "./IDataSourceAdapter";

/**
 * Datos para crear una nueva fuente de datos
 */
export interface CreateDataSourceData {
  name: string;
  description?: string;
  type: DataSourceType;
  config: DataSourceConfig;
  sourceOrigin: string;
  regionCode: string;
  matchingStrategy?: MatchingStrategy;
  matchingThreshold?: number;
  syncFrequency?: SyncFrequency;
  autoDeactivateMissing?: boolean;
  autoUpdateFields?: string[];
  createdBy?: string;
}

/**
 * Datos para actualizar una fuente de datos
 */
export interface UpdateDataSourceData {
  name?: string;
  description?: string;
  config?: DataSourceConfig;
  matchingStrategy?: MatchingStrategy;
  matchingThreshold?: number;
  isActive?: boolean;
  syncFrequency?: SyncFrequency;
  autoDeactivateMissing?: boolean;
  autoUpdateFields?: string[];
}

/**
 * Filtros para buscar fuentes de datos
 */
export interface DataSourceFilters {
  type?: DataSourceType;
  isActive?: boolean;
  regionCode?: string;
  sourceOrigin?: string;
  syncFrequency?: SyncFrequency;
}

/**
 * Opciones de paginación
 */
export interface PaginationOptions {
  page?: number;
  limit?: number;
  orderBy?: "name" | "createdAt" | "lastSyncAt" | "nextScheduledSyncAt";
  orderDirection?: "asc" | "desc";
}

/**
 * Resultado paginado
 */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Resumen de estadísticas de una fuente de datos
 */
export interface DataSourceStats {
  totalSyncs: number;
  successfulSyncs: number;
  failedSyncs: number;
  totalRecordsImported: number;
  lastSyncRecords: number;
  averageSyncDuration: number; // milliseconds
}

/**
 * Puerto: Repositorio de fuentes de datos
 * Implementación: PrismaDataSourceRepository
 */
export interface IDataSourceRepository {
  /**
   * Crea una nueva fuente de datos
   *
   * @param data Datos de la fuente
   * @returns ID de la fuente creada
   */
  create(data: CreateDataSourceData): Promise<string>;

  /**
   * Obtiene una fuente de datos por ID
   *
   * @param id ID de la fuente
   * @returns Fuente de datos o null si no existe
   */
  findById(id: string): Promise<ExternalDataSourceConfig | null>;

  /**
   * Obtiene una fuente de datos por nombre
   *
   * @param name Nombre de la fuente
   * @returns Fuente de datos o null si no existe
   */
  findByName(name: string): Promise<ExternalDataSourceConfig | null>;

  /**
   * Lista fuentes de datos con filtros y paginación
   *
   * @param filters Filtros opcionales
   * @param pagination Opciones de paginación
   * @returns Resultado paginado
   */
  findAll(
    filters?: DataSourceFilters,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<ExternalDataSourceConfig>>;

  /**
   * Actualiza una fuente de datos
   *
   * @param id ID de la fuente
   * @param data Datos a actualizar
   */
  update(id: string, data: UpdateDataSourceData): Promise<void>;

  /**
   * Elimina una fuente de datos
   *
   * @param id ID de la fuente
   */
  delete(id: string): Promise<void>;

  /**
   * Actualiza la fecha del último sync
   *
   * @param id ID de la fuente
   * @param syncedAt Fecha del sync
   */
  updateLastSync(id: string, syncedAt: Date): Promise<void>;

  /**
   * Actualiza la fecha del próximo sync programado
   *
   * @param id ID de la fuente
   * @param nextSyncAt Fecha del próximo sync
   */
  updateNextScheduledSync(id: string, nextSyncAt: Date | null): Promise<void>;

  /**
   * Obtiene fuentes de datos que necesitan sync
   * (nextScheduledSyncAt <= now AND isActive)
   *
   * @returns Array de fuentes que necesitan sync
   */
  findDueForSync(): Promise<ExternalDataSourceConfig[]>;

  /**
   * Obtiene estadísticas de una fuente de datos
   *
   * @param id ID de la fuente
   * @returns Estadísticas
   */
  getStats(id: string): Promise<DataSourceStats>;

  /**
   * Verifica si existe una fuente con el mismo nombre
   *
   * @param name Nombre a verificar
   * @param excludeId ID a excluir (para updates)
   * @returns true si existe
   */
  existsByName(name: string, excludeId?: string): Promise<boolean>;
}
