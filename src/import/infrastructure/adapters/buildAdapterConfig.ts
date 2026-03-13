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
  // Extract field mappings - support both singular and plural forms
  const fieldMapping = (configData as any).fieldMapping as Record<string, string> | undefined;
  const fieldMappings = (configData as any).fieldMappings as Record<string, string> | undefined;

  const baseConfig: DataSourceConfig = {
    type,
    fieldMappings: fieldMappings || fieldMapping,
  };

  if (type === "JSON_FILE") {
    // Para JSON_FILE, usar fileUrl y jsonPath
    return {
      ...baseConfig,
      fileUrl: (configData as any).fileUrl as string | undefined,
      jsonPath: (configData as any).jsonPath as string | undefined,
      // También soportar apiEndpoint como alternativa a fileUrl
      apiEndpoint: (configData as any).apiEndpoint as string | undefined,
    };
  }

  if (type === "CKAN_API") {
    const apiEndpoint = (configData as any).apiEndpoint as string | undefined;

    // Extraer baseUrl desde apiEndpoint si es necesario (para API CKAN tradicional)
    let baseUrl = (configData as any).baseUrl as string | undefined;
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
      resourceId: (configData as any).resourceId as string | undefined,
      pageSize: (configData as any).pageSize as number | undefined,
    };
  }

  if (type === "REST_API") {
    return {
      ...baseConfig,
      apiEndpoint: (configData as any).apiEndpoint as string | undefined,
      headers: (configData as any).headers as Record<string, string> | undefined,
      authToken: (configData as any).authToken as string | undefined,
      method: (configData as any).method as "GET" | "POST" | undefined,
      requestBody: (configData as any).requestBody,
      responseDataPath: (configData as any).responseDataPath as string | undefined,
      pagination: (configData as any).pagination as DataSourceConfig["pagination"] | undefined,
    };
  }

  // Para CSV_FILE u otros tipos, devolver la configuración base
  return baseConfig;
}
