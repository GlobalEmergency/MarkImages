/**
 * Puerto: Adaptador de fuentes de datos
 * Capa de Dominio - Interface unificada para CSV, APIs y archivos JSON
 */

import type { ColumnMapping } from "../value-objects/ColumnMapping";
import type { ImportRecord } from "../value-objects/ImportRecord";
import type { ValidationResult } from "../value-objects/ValidationResult";

/**
 * Tipos de fuentes de datos soportadas
 */
export type DataSourceType = "CSV_FILE" | "CKAN_API" | "JSON_FILE" | "REST_API";

/**
 * Frecuencia de sincronizaciÃ³n para fuentes de datos externas
 */
export type SyncFrequency = "MANUAL" | "DAILY" | "WEEKLY" | "MONTHLY";

/**
 * Estrategia de matching para detectar duplicados
 */
export type MatchingStrategy = "BY_EXTERNAL_CODE" | "BY_COORDINATES" | "BY_ADDRESS" | "HYBRID";

/**
 * ConfiguraciÃ³n unificada para cualquier tipo de fuente de datos
 */
export interface DataSourceConfig {
  type: DataSourceType;

  // ============================================
  // Para CSV_FILE
  // ============================================
  filePath?: string;
  columnMappings?: ColumnMapping[];

  // ============================================
  // Para CKAN_API (ej: datos.comunidad.madrid)
  // ============================================
  baseUrl?: string;
  resourceId?: string;
  pageSize?: number;

  // ============================================
  // Para JSON_FILE
  // ============================================
  fileUrl?: string;
  jsonPath?: string; // JSONPath para extraer registros (ej: "$.data.records")

  // ============================================
  // Para REST_API
  // ============================================
  apiEndpoint?: string;
  authToken?: string;
  headers?: Record<string, string>;
  method?: "GET" | "POST"; // default GET
  requestBody?: unknown; // Para POST APIs (ej: Overpass)

  // PaginaciÃ³n configurable (REST_API)
  pagination?: {
    strategy: "offset" | "page" | "cursor" | "none";
    // Nombres de parÃ¡metros configurables
    limitParam?: string; // default: 'limit'
    limitValue?: number; // default: 100
    offsetParam?: string; // default: 'offset' (strategy=offset)
    pageParam?: string; // default: 'page' (strategy=page)
    cursorParam?: string; // default: 'cursor' (strategy=cursor)
    // DÃ³nde encontrar el cursor del siguiente resultado
    cursorResponsePath?: string; // ej: 'next_cursor', 'meta.next'
    // CÃ³mo saber si hay mÃ¡s pÃ¡ginas
    totalCountPath?: string; // ej: 'total', 'meta.total_count'
    hasMorePath?: string; // ej: 'has_more', 'meta.has_next'
  };

  // DÃ³nde estÃ¡n los registros en la respuesta JSON
  responseDataPath?: string; // ej: 'results', 'data.records', 'elements'

  // ============================================
  // Para archivos CSV remotos
  // ============================================
  csvDelimiter?: string; // default: ',' â€” usar ';' para ficheros europeos/LATAM
  encoding?: string; // default: 'utf-8' â€” usar 'latin1' para fuentes con ISO-8859-1

  // ============================================
  // ComÃºn para APIs y JSON
  // ============================================
  fieldMappings?: Record<string, string>; // Campo API â†’ Campo sistema

  // Campo de la fuente que identifica de forma Ãºnica cada registro.
  // Se usa como externalId para deduplicaciÃ³n y como cÃ³digo del AED.
  // Si no se especifica, se auto-detecta buscando campos comunes (id, codigo_dea, etc.).
  externalIdField?: string;

  // ============================================
  // Transformadores de campos (opcional)
  // ============================================
  fieldTransformers?: Record<string, string | string[]>; // Campo fuente â†’ transformer(s) a aplicar
}

/**
 * ConfiguraciÃ³n persistente de una fuente de datos externa
 */
export interface ExternalDataSourceConfig {
  id: string;
  name: string;
  description?: string;
  type: DataSourceType;
  config: DataSourceConfig;

  // Scope regional
  sourceOrigin: string; // EXTERNAL_API, HEALTH_API, etc.
  countryCode: string; // ISO 3166-1 alpha-2: "ES", "FR", "IT", etc.
  regionCode: string; // ISO 3166-2: "ES-MD", "ES-CT", "FR-IDF", etc.

  // Matching
  matchingStrategy: MatchingStrategy;
  matchingThreshold: number; // 0-100

  // Scheduling
  isActive: boolean;
  syncFrequency: SyncFrequency;
  lastSyncAt?: Date;
  nextScheduledSyncAt?: Date;

  // Behavior
  autoDeactivateMissing: boolean; // Marcar inactivos los que no estÃ©n en fuente
  autoUpdateFields: string[]; // Campos a actualizar automÃ¡ticamente

  // Audit
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
}

/**
 * Resultado de test de conexiÃ³n a fuente de datos
 */
export interface ConnectionTestResult {
  success: boolean;
  message: string;
  recordCount?: number;
  sampleFields?: string[];
  responseTimeMs?: number;
}

/**
 * Puerto: Adaptador de fuente de datos
 * Implementaciones: CsvDataSourceAdapter, CkanApiAdapter, JsonFileAdapter
 */
export interface IDataSourceAdapter {
  /**
   * Tipo de fuente que maneja este adapter
   */
  readonly type: DataSourceType;

  /**
   * Obtiene todos los registros de la fuente de forma lazy (generator)
   * Unifica CSV rows y API records en ImportRecord
   *
   * @param config ConfiguraciÃ³n de la fuente
   * @yields ImportRecord para cada registro
   */
  fetchRecords(config: DataSourceConfig): AsyncGenerator<ImportRecord>;

  /**
   * Obtiene el nÃºmero total de registros sin descargarlos
   * Ãštil para mostrar progreso y estimar tiempo
   *
   * @param config ConfiguraciÃ³n de la fuente
   * @returns NÃºmero total de registros
   */
  getRecordCount(config: DataSourceConfig): Promise<number>;

  /**
   * Valida la configuraciÃ³n antes de procesar
   *
   * @param config ConfiguraciÃ³n a validar
   * @returns Resultado de validaciÃ³n con errores/warnings
   */
  validateConfig(config: DataSourceConfig): Promise<ValidationResult>;

  /**
   * Obtiene un preview (primeros N registros) para mostrar al usuario
   *
   * @param config ConfiguraciÃ³n de la fuente
   * @param limit NÃºmero mÃ¡ximo de registros (default: 5)
   * @returns Array de ImportRecord
   */
  getPreview(config: DataSourceConfig, limit?: number): Promise<ImportRecord[]>;

  /**
   * Prueba la conexiÃ³n a la fuente de datos
   *
   * @param config ConfiguraciÃ³n de la fuente
   * @returns Resultado del test con mensaje y detalles
   */
  testConnection(config: DataSourceConfig): Promise<ConnectionTestResult>;
}

/**
 * Factory para crear el adapter correcto segÃºn el tipo de fuente
 */
export interface IDataSourceAdapterFactory {
  /**
   * Crea un adapter para el tipo de fuente especificado
   *
   * @param type Tipo de fuente de datos
   * @returns Adapter correspondiente
   * @throws Error si el tipo no estÃ¡ soportado
   */
  create(type: DataSourceType): IDataSourceAdapter;

  /**
   * Verifica si un tipo de fuente estÃ¡ soportado
   *
   * @param type Tipo a verificar
   * @returns true si estÃ¡ soportado
   */
  supports(type: DataSourceType): boolean;

  /**
   * Lista los tipos de fuente soportados
   */
  getSupportedTypes(): DataSourceType[];
}
