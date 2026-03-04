/**
 * Adapter: API CKAN (datos.comunidad.madrid)
 * Capa de Infraestructura - Implementa IDataSourceAdapter para APIs CKAN
 * Soporta tanto la API datastore_search como descarga directa de JSON
 */

import type {
  IDataSourceAdapter,
  DataSourceConfig,
  ConnectionTestResult,
} from "@/import/domain/ports/IDataSourceAdapter";
import { ImportRecord } from "@/import/domain/value-objects/ImportRecord";
import { ValidationResult } from "@/import/domain/value-objects/ValidationResult";

/**
 * Respuesta de la API CKAN datastore_search
 */
interface CkanResponse {
  success: boolean;
  result: {
    records: Record<string, unknown>[];
    total: number;
    fields?: Array<{ id: string; type: string }>;
    _links?: {
      start: string;
      next?: string;
    };
  };
  error?: {
    message: string;
    __type: string;
  };
}

/**
 * Mapeo predefinido de campos para la API de Madrid
 */
export const MADRID_FIELD_MAPPINGS: Record<string, string> = {
  codigo_dea: "id",
  direccion_via_codigo: "streetType",
  direccion_via_nombre: "streetName",
  direccion_portal_numero: "streetNumber",
  direccion_piso: "floor",
  direccion_puerta: "additionalInfo",
  direccion_ubicacion: "specificLocation",
  direccion_codigo_postal: "postalCode",
  direccion_latitud: "latitude",
  direccion_longitud: "longitude",
  direccion_coordenada_x: "utmX",
  direccion_coordenada_y: "utmY",
  municipio_codigo: "cityCode",
  municipio_nombre: "city",
  tipo_establecimiento: "establishmentType",
  tipo_titularidad: "ownershipType",
  horario_acceso: "accessSchedule",
};

export class CkanApiAdapter implements IDataSourceAdapter {
  readonly type = "CKAN_API" as const;

  private readonly defaultPageSize = 100;
  private readonly maxRetries = 3;
  private readonly retryDelayMs = 1000;

  /**
   * Detecta si la URL es una descarga directa de JSON
   */
  private isDirectJsonUrl(url: string | undefined): boolean {
    if (!url) return false;
    return url.endsWith(".json") || url.includes("/download/");
  }

  /**
   * Obtiene la URL efectiva para fetching
   * Prioriza apiEndpoint si es una URL directa JSON
   */
  private getEffectiveUrl(config: DataSourceConfig): { url: string; isDirect: boolean } {
    // Si hay apiEndpoint y es una URL JSON directa, usarla
    if (config.apiEndpoint && this.isDirectJsonUrl(config.apiEndpoint)) {
      return { url: config.apiEndpoint, isDirect: true };
    }

    // Si no, usar el patrón CKAN tradicional
    if (config.baseUrl && config.resourceId) {
      return {
        url: this.buildSearchUrl(
          config.baseUrl,
          config.resourceId,
          config.pageSize || this.defaultPageSize,
          0
        ),
        isDirect: false,
      };
    }

    throw new Error("Se requiere apiEndpoint (URL JSON directa) o baseUrl + resourceId (API CKAN)");
  }

  /**
   * Detecta el campo de ID externo basado en los campos disponibles
   */
  private detectExternalIdField(records: Record<string, unknown>[]): string {
    if (records.length === 0) return "id";
    const firstRecord = records[0];
    const keys = Object.keys(firstRecord);

    // Buscar campos comunes de ID
    const idCandidates = ["id_dea", "codigo_dea", "id", "external_id", "dea_id"];
    for (const candidate of idCandidates) {
      if (keys.includes(candidate)) return candidate;
    }

    return keys[0] || "id";
  }

  async *fetchRecords(config: DataSourceConfig): AsyncGenerator<ImportRecord> {
    const fieldMappings = config.fieldMappings || MADRID_FIELD_MAPPINGS;
    const { url, isDirect } = this.getEffectiveUrl(config);

    if (isDirect) {
      // Descarga directa de JSON
      yield* this.fetchRecordsFromDirectJson(url, fieldMappings);
    } else {
      // API CKAN tradicional
      yield* this.fetchRecordsFromCkanApi(config, fieldMappings);
    }
  }

  /**
   * Fetch records desde una URL JSON directa
   */
  private async *fetchRecordsFromDirectJson(
    url: string,
    fieldMappings: Record<string, string>
  ): AsyncGenerator<ImportRecord> {
    console.log(`📥 Fetching records from direct JSON URL: ${url}`);

    const response = await fetch(url, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    // Determinar el array de registros
    let records: Record<string, unknown>[];
    if (Array.isArray(data)) {
      records = data;
    } else if (data.data && Array.isArray(data.data)) {
      records = data.data;
    } else if (data.records && Array.isArray(data.records)) {
      records = data.records;
    } else {
      throw new Error(
        "Formato JSON no reconocido: se esperaba un array o un objeto con 'data' o 'records'"
      );
    }

    const externalIdField = this.detectExternalIdField(records);
    console.log(
      `📋 Found ${records.length} records, using '${externalIdField}' as external ID field`
    );

    for (let rowIndex = 0; rowIndex < records.length; rowIndex++) {
      yield ImportRecord.fromApiRecord(records[rowIndex], fieldMappings, rowIndex, externalIdField);

      if ((rowIndex + 1) % 1000 === 0) {
        console.log(`📥 Processed ${rowIndex + 1} records...`);
      }
    }

    console.log(`✅ Finished processing ${records.length} records from direct JSON`);
  }

  /**
   * Fetch records desde API CKAN tradicional
   */
  private async *fetchRecordsFromCkanApi(
    config: DataSourceConfig,
    fieldMappings: Record<string, string>
  ): AsyncGenerator<ImportRecord> {
    const baseUrl = config.baseUrl!;
    const resourceId = config.resourceId!;
    const pageSize = config.pageSize || this.defaultPageSize;

    let offset = 0;
    let rowIndex = 0;
    let hasMore = true;

    while (hasMore) {
      const url = this.buildSearchUrl(baseUrl, resourceId, pageSize, offset);
      const response = await this.fetchWithRetry(url);

      if (!response.success) {
        throw new Error(`CKAN API error: ${response.error?.message || "Unknown error"}`);
      }

      const records = response.result.records;

      for (const record of records) {
        yield ImportRecord.fromApiRecord(
          record,
          fieldMappings,
          rowIndex,
          "codigo_dea" // Campo de ID externo para Madrid
        );
        rowIndex++;
      }

      // Verificar si hay más páginas
      hasMore = records.length >= pageSize;
      offset += pageSize;

      // Log de progreso cada 1000 registros
      if (rowIndex % 1000 === 0) {
        console.log(`📥 Fetched ${rowIndex} records from CKAN API...`);
      }
    }

    console.log(`✅ Finished fetching ${rowIndex} records from CKAN API`);
  }

  async getRecordCount(config: DataSourceConfig): Promise<number> {
    const { url, isDirect } = this.getEffectiveUrl(config);

    if (isDirect) {
      // Para JSON directo, necesitamos descargar todo el archivo para contar
      const response = await fetch(url, {
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const records = this.extractRecordsFromJson(data);
      return records.length;
    }

    // API CKAN tradicional
    const searchUrl = this.buildSearchUrl(config.baseUrl!, config.resourceId!, 0, 0);
    const response = await this.fetchWithRetry(searchUrl);

    if (!response.success) {
      throw new Error(`CKAN API error: ${response.error?.message || "Unknown error"}`);
    }

    return response.result.total;
  }

  /**
   * Extrae los registros de una respuesta JSON
   * Soporta múltiples formatos: CKAN API, JSON directo, GeoJSON
   */
  private extractRecordsFromJson(data: unknown): Record<string, unknown>[] {
    console.log("🔍 Extracting records from JSON data...");

    // Raw array
    if (Array.isArray(data)) {
      console.log(`✅ Found direct array with ${data.length} records`);
      return data;
    }

    if (typeof data === "object" && data !== null) {
      const obj = data as any;

      // CKAN API standard format: { success: true, result: { records: [...] } }
      if (obj.result?.records && Array.isArray(obj.result.records)) {
        console.log(
          `✅ Found CKAN result.records format with ${obj.result.records.length} records`
        );
        return obj.result.records;
      }

      // Direct data array
      if (obj.data && Array.isArray(obj.data)) {
        console.log(`✅ Found data array with ${obj.data.length} records`);
        return obj.data;
      }

      // Direct records array
      if (obj.records && Array.isArray(obj.records)) {
        console.log(`✅ Found records array with ${obj.records.length} records`);
        return obj.records;
      }

      // GeoJSON format: { features: [{ properties: {...}, geometry: {...} }] }
      if (obj.features && Array.isArray(obj.features)) {
        console.log(`✅ Found GeoJSON features with ${obj.features.length} records`);
        return obj.features.map((f: any) => {
          // Extract properties and flatten geometry coordinates
          const record = { ...f.properties };
          if (f.geometry?.type === "Point" && Array.isArray(f.geometry.coordinates)) {
            record.longitude = f.geometry.coordinates[0];
            record.latitude = f.geometry.coordinates[1];
          }
          return record;
        });
      }

      // Check if it might be a serialized JSON string
      const keys = Object.keys(obj);
      console.log(
        `⚠️ Unknown JSON structure. Keys: ${keys.slice(0, 5).join(", ")}${keys.length > 5 ? "..." : ""}`
      );

      // Log first record sample for debugging
      if (keys.length > 0) {
        console.log("📋 First key sample:", keys[0]);
        console.log("📋 First value sample:", JSON.stringify(obj[keys[0]]).substring(0, 200));
      }
    }

    console.log("❌ No valid records array found in JSON data");
    return [];
  }

  async validateConfig(config: DataSourceConfig): Promise<ValidationResult> {
    const issues: Array<{
      severity: string;
      message: string;
      row?: number;
      field?: string;
      value?: string;
    }> = [];

    // Verificar si es URL directa o API CKAN
    const hasDirectUrl = config.apiEndpoint && this.isDirectJsonUrl(config.apiEndpoint);
    const hasCkanConfig = config.baseUrl && config.resourceId;

    if (!hasDirectUrl && !hasCkanConfig) {
      issues.push({
        row: 0,
        field: "config",
        value: "",
        severity: "ERROR",
        message: "Se requiere apiEndpoint (URL JSON directa) o baseUrl + resourceId (API CKAN)",
      });
    }

    // Validar URL directa si existe
    if (config.apiEndpoint) {
      try {
        new URL(config.apiEndpoint);
      } catch {
        issues.push({
          row: 0,
          field: "apiEndpoint",
          value: config.apiEndpoint,
          severity: "ERROR",
          message: "El endpoint de la API no es una URL válida",
        });
      }
    }

    // Validar baseUrl si existe
    if (config.baseUrl) {
      try {
        new URL(config.baseUrl);
      } catch {
        issues.push({
          row: 0,
          field: "baseUrl",
          value: config.baseUrl,
          severity: "ERROR",
          message: "La URL base no es válida",
        });
      }
    }

    // Validar resourceId si se está usando API CKAN (no URL directa)
    if (!hasDirectUrl && config.resourceId) {
      if (!/^[0-9a-f-]{36}$/i.test(config.resourceId)) {
        issues.push({
          row: 0,
          field: "resourceId",
          value: config.resourceId,
          severity: "WARNING",
          message: "El ID del recurso no parece ser un UUID válido",
        });
      }
    }

    if (config.pageSize && (config.pageSize < 1 || config.pageSize > 1000)) {
      issues.push({
        row: 0,
        field: "pageSize",
        value: config.pageSize.toString(),
        severity: "WARNING",
        message: "El tamaño de página debe estar entre 1 y 1000",
      });
    }

    return issues.length > 0 ? ValidationResult.withIssues(issues) : ValidationResult.success();
  }

  async getPreview(config: DataSourceConfig, limit: number = 5): Promise<ImportRecord[]> {
    const { url, isDirect } = this.getEffectiveUrl(config);
    const fieldMappings = config.fieldMappings || MADRID_FIELD_MAPPINGS;

    if (isDirect) {
      // Descarga directa de JSON
      const response = await fetch(url, {
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const records = this.extractRecordsFromJson(data).slice(0, limit);
      const externalIdField = this.detectExternalIdField(records);

      return records.map((record, index) =>
        ImportRecord.fromApiRecord(record, fieldMappings, index, externalIdField)
      );
    }

    // API CKAN tradicional
    const searchUrl = this.buildSearchUrl(config.baseUrl!, config.resourceId!, limit, 0);
    const response = await this.fetchWithRetry(searchUrl);

    if (!response.success) {
      throw new Error(`CKAN API error: ${response.error?.message || "Unknown error"}`);
    }

    return response.result.records.map((record, index) =>
      ImportRecord.fromApiRecord(record, fieldMappings, index, "codigo_dea")
    );
  }

  async testConnection(config: DataSourceConfig): Promise<ConnectionTestResult> {
    const startTime = Date.now();

    try {
      const validation = await this.validateConfig(config);

      if (validation.hasCriticalErrors()) {
        return {
          success: false,
          message: validation.criticalErrors[0]?.message || "Error de validación",
        };
      }

      const { url, isDirect } = this.getEffectiveUrl(config);
      const responseTimeMs = Date.now() - startTime;

      if (isDirect) {
        // Test descarga directa de JSON
        const response = await fetch(url, {
          headers: { Accept: "application/json" },
        });

        if (!response.ok) {
          return {
            success: false,
            message: `Error HTTP: ${response.status} ${response.statusText}`,
            responseTimeMs: Date.now() - startTime,
          };
        }

        const data = await response.json();
        const records = this.extractRecordsFromJson(data);

        // Obtener campos disponibles del primer registro
        const sampleFields = records.length > 0 ? Object.keys(records[0]) : [];

        return {
          success: true,
          message: `Conexión exitosa. ${records.length} registros disponibles (JSON directo).`,
          recordCount: records.length,
          sampleFields,
          responseTimeMs: Date.now() - startTime,
        };
      }

      // API CKAN tradicional
      const searchUrl = this.buildSearchUrl(config.baseUrl!, config.resourceId!, 1, 0);
      const response = await this.fetchWithRetry(searchUrl);

      if (!response.success) {
        return {
          success: false,
          message: `Error de API: ${response.error?.message || "Unknown error"}`,
          responseTimeMs,
        };
      }

      // Obtener campos disponibles
      const sampleFields = response.result.fields?.map((f) => f.id) || [];

      return {
        success: true,
        message: `Conexión exitosa. ${response.result.total} registros disponibles.`,
        recordCount: response.result.total,
        sampleFields,
        responseTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        message: `Error de conexión: ${error instanceof Error ? error.message : "Error desconocido"}`,
        responseTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Construye la URL de búsqueda CKAN
   */
  private buildSearchUrl(
    baseUrl: string,
    resourceId: string,
    limit: number,
    offset: number
  ): string {
    const url = new URL(`${baseUrl}/api/3/action/datastore_search`);
    url.searchParams.set("resource_id", resourceId);
    url.searchParams.set("limit", limit.toString());
    url.searchParams.set("offset", offset.toString());
    return url.toString();
  }

  /**
   * Fetch con reintentos
   */
  private async fetchWithRetry(url: string, attempt: number = 1): Promise<CkanResponse> {
    try {
      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return (await response.json()) as CkanResponse;
    } catch (error) {
      if (attempt < this.maxRetries) {
        console.warn(
          `⚠️ CKAN API request failed (attempt ${attempt}/${this.maxRetries}), retrying...`
        );
        await this.delay(this.retryDelayMs * attempt);
        return this.fetchWithRetry(url, attempt + 1);
      }
      throw error;
    }
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Configuración predefinida para la API de la Comunidad de Madrid
 */
export function createMadridConfig(resourceId: string): DataSourceConfig {
  return {
    type: "CKAN_API",
    baseUrl: "https://datos.comunidad.madrid",
    resourceId,
    pageSize: 100,
    fieldMappings: MADRID_FIELD_MAPPINGS,
  };
}

/**
 * Resource ID conocido para DEAs de Madrid
 */
export const MADRID_DEA_RESOURCE_ID = "42d08814-3361-4c2a-93fe-36664abc7953";
