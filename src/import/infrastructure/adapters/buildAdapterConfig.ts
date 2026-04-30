/**
 * Utilidad para construir configuración de adaptadores de fuentes de datos
 * Capa de Infraestructura - Utilidad compartida
 *
 * Esta función normaliza la configuración almacenada en la BD para que sea
 * compatible con los adaptadores (CkanApiAdapter, JsonFileAdapter, RestApiAdapter, etc.)
 *
 * Soporta:
 * - JSON_FILE: URLs directas de archivos JSON (fileUrl + jsonPath)
 * - CKAN_API: URLs directas de JSON (apiEndpoint) o APIs tradicionales (baseUrl + resourceId)
 * - REST_API: APIs REST genéricas con paginación configurable (apiEndpoint + pagination)
 */

import type { DataSourceConfig, DataSourceType } from "@/import/domain/ports/IDataSourceAdapter";

/**
 * Construye la configuración del adapter a partir de los datos almacenados
 * Mapea los campos del formulario a los esperados por el adapter
 */
export function buildDataSourceConfig(
  type: DataSourceType,
  configData: DataSourceConfig | Record<string, unknown>
): DataSourceConfig {
  const cfg = configData as Record<string, unknown>;

  // Extract field mappings - support both singular and plural forms
  const fieldMapping = cfg.fieldMapping as Record<string, string> | undefined;
  const fieldMappings = cfg.fieldMappings as Record<string, string> | undefined;

  // Extract field transformers
  const fieldTransformers = cfg.fieldTransformers as Record<string, string | string[]> | undefined;

  const baseConfig: DataSourceConfig = {
    type,
    fieldMappings: fieldMappings || fieldMapping,
    fieldTransformers,
    externalIdField: cfg.externalIdField as string | undefined,
  };

  if (type === "JSON_FILE") {
    // Para JSON_FILE, usar fileUrl y jsonPath
    return {
      ...baseConfig,
      fileUrl: cfg.fileUrl as string | undefined,
      jsonPath: cfg.jsonPath as string | undefined,
      // También soportar apiEndpoint como alternativa a fileUrl
      apiEndpoint: cfg.apiEndpoint as string | undefined,
    };
  }

  if (type === "CKAN_API") {
    const apiEndpoint = cfg.apiEndpoint as string | undefined;

    // Extraer baseUrl desde apiEndpoint si es necesario (para API CKAN tradicional)
    let baseUrl = cfg.baseUrl as string | undefined;
    if (!baseUrl && apiEndpoint) {
      try {
        const url = new URL(apiEndpoint);
        baseUrl = `${url.protocol}//${url.host}`;
      } catch {
        baseUrl = undefined;
      }
    }

    return {
      ...baseConfig,
      apiEndpoint,
      baseUrl,
      resourceId: cfg.resourceId as string | undefined,
      pageSize: cfg.pageSize as number | undefined,
    };
  }

  if (type === "REST_API") {
    return {
      ...baseConfig,
      apiEndpoint: cfg.apiEndpoint as string | undefined,
      headers: cfg.headers as Record<string, string> | undefined,
      authToken: cfg.authToken as string | undefined,
      method: cfg.method as "GET" | "POST" | undefined,
      requestBody: cfg.requestBody,
      responseDataPath: cfg.responseDataPath as string | undefined,
      pagination: cfg.pagination as DataSourceConfig["pagination"] | undefined,
    };
  }

  if (type === "CSV_FILE") {
    // CSV_FILE soporta ficheros locales (filePath) y remotos (fileUrl)
    return {
      ...baseConfig,
      filePath: cfg.filePath as string | undefined,
      fileUrl: cfg.fileUrl as string | undefined,
      apiEndpoint: cfg.apiEndpoint as string | undefined,
      csvDelimiter: cfg.csvDelimiter as string | undefined,
      encoding: cfg.encoding as string | undefined,
      columnMappings: cfg.columnMappings as DataSourceConfig["columnMappings"] | undefined,
    };
  }

  // Para otros tipos, devolver la configuración base
  return baseConfig;
}
