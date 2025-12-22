/**
 * Adapter: JSON File (descarga directa de archivos JSON)
 * Capa de Infraestructura - Implementa IDataSourceAdapter para archivos JSON
 *
 * Soporta:
 * - URLs directas de archivos JSON
 * - Extracción de registros desde una ruta configurable (jsonPath)
 * - Mapeo de campos personalizado
 */

import type {
  IDataSourceAdapter,
  DataSourceConfig,
  ConnectionTestResult,
} from "@/import/domain/ports/IDataSourceAdapter";
import { ImportRecord } from "@/import/domain/value-objects/ImportRecord";
import { ValidationResult } from "@/import/domain/value-objects/ValidationResult";

export class JsonFileAdapter implements IDataSourceAdapter {
  readonly type = "JSON_FILE" as const;

  private readonly maxRetries = 3;
  private readonly retryDelayMs = 1000;

  // Cache para evitar descargas múltiples del mismo archivo
  private dataCache: Map<string, { data: unknown; timestamp: number }> = new Map();
  private readonly cacheTtlMs = 5 * 60 * 1000; // 5 minutos

  /**
   * Obtiene la URL del archivo JSON
   */
  private getFileUrl(config: DataSourceConfig): string {
    const url = config.fileUrl || config.apiEndpoint;
    if (!url) {
      throw new Error("Se requiere fileUrl o apiEndpoint para JSON_FILE");
    }
    return url;
  }

  /**
   * Extrae registros del JSON usando la ruta especificada
   * @param data - Datos JSON parseados
   * @param jsonPath - Ruta al array de datos (ej: "data", "records", "result.items")
   */
  private extractRecordsFromPath(data: unknown, jsonPath?: string): Record<string, unknown>[] {
    // Si es directamente un array, devolverlo
    if (Array.isArray(data)) {
      console.log(`✅ JSON es un array directo con ${data.length} registros`);
      return data;
    }

    if (typeof data !== "object" || data === null) {
      throw new Error("El JSON no es un objeto válido");
    }

    const obj = data as Record<string, unknown>;

    // Si se especifica jsonPath, usarlo
    if (jsonPath) {
      const parts = jsonPath.replace(/^\$\.?/, "").split(".");
      let current: unknown = obj;

      for (const part of parts) {
        if (part === "") continue;
        if (typeof current !== "object" || current === null) {
          throw new Error(`Ruta JSON inválida: no se encontró '${part}' en '${jsonPath}'`);
        }
        current = (current as Record<string, unknown>)[part];
      }

      if (Array.isArray(current)) {
        console.log(`✅ Encontrados ${current.length} registros en '${jsonPath}'`);
        return current as Record<string, unknown>[];
      }

      throw new Error(`La ruta '${jsonPath}' no contiene un array de registros`);
    }

    // Auto-detectar la ruta si no se especifica
    const commonPaths = ["data", "records", "items", "results", "features"];

    for (const path of commonPaths) {
      if (obj[path] && Array.isArray(obj[path])) {
        console.log(
          `✅ Auto-detectado array en '${path}' con ${(obj[path] as unknown[]).length} registros`
        );
        return obj[path] as Record<string, unknown>[];
      }
    }

    // Si tiene 'features' (GeoJSON), extraer properties
    if (obj.features && Array.isArray(obj.features)) {
      const features = obj.features as Array<{
        properties?: Record<string, unknown>;
        geometry?: { type: string; coordinates: number[] };
      }>;
      console.log(`✅ Detectado GeoJSON con ${features.length} features`);
      return features.map((f) => {
        const record = { ...f.properties };
        if (f.geometry?.type === "Point" && Array.isArray(f.geometry.coordinates)) {
          record.longitude = f.geometry.coordinates[0];
          record.latitude = f.geometry.coordinates[1];
        }
        return record as Record<string, unknown>;
      });
    }

    throw new Error(
      `No se encontró un array de registros. Especifica jsonPath para indicar dónde están los datos. ` +
        `Claves disponibles: ${Object.keys(obj).join(", ")}`
    );
  }

  /**
   * Detecta el campo de ID externo basado en los campos disponibles
   */
  private detectExternalIdField(records: Record<string, unknown>[]): string {
    if (records.length === 0) return "id";
    const firstRecord = records[0];
    const keys = Object.keys(firstRecord);

    // Buscar campos comunes de ID
    const idCandidates = ["id", "codigo_dea", "id_dea", "external_id", "dea_id", "_id"];
    for (const candidate of idCandidates) {
      if (keys.includes(candidate)) return candidate;
    }

    return keys[0] || "id";
  }

  async *fetchRecords(config: DataSourceConfig): AsyncGenerator<ImportRecord> {
    const url = this.getFileUrl(config);
    const fieldMappings = config.fieldMappings || {};

    // Usar caché para evitar descarga doble
    const data = await this.getCachedData(url);

    const records = this.extractRecordsFromPath(data, config.jsonPath);
    const externalIdField = this.detectExternalIdField(records);

    console.log(`📋 Procesando ${records.length} registros, ID field: '${externalIdField}'`);

    for (let rowIndex = 0; rowIndex < records.length; rowIndex++) {
      yield ImportRecord.fromApiRecord(records[rowIndex], fieldMappings, rowIndex, externalIdField);

      if ((rowIndex + 1) % 1000 === 0) {
        console.log(`📥 Procesados ${rowIndex + 1}/${records.length} registros...`);
      }
    }

    console.log(`✅ Procesamiento completado: ${records.length} registros`);
  }

  async getRecordCount(config: DataSourceConfig): Promise<number> {
    const url = this.getFileUrl(config);

    // Usar caché para evitar descarga doble
    const data = await this.getCachedData(url);

    const records = this.extractRecordsFromPath(data, config.jsonPath);
    return records.length;
  }

  async validateConfig(config: DataSourceConfig): Promise<ValidationResult> {
    const issues: Array<{ severity: string; message: string; row?: number; field?: string; value?: string }> = [];

    const url = config.fileUrl || config.apiEndpoint;

    if (!url) {
      issues.push({
        row: 0,
        field: "fileUrl",
        value: "",
        severity: "CRITICAL",
        message: "Se requiere la URL del archivo JSON (fileUrl o apiEndpoint)",
      });
    } else {
      try {
        new URL(url);
      } catch {
        issues.push({
          row: 0,
          field: "fileUrl",
          value: url,
          severity: "CRITICAL",
          message: "La URL del archivo JSON no es válida",
        });
      }
    }

    // jsonPath es opcional - se auto-detecta si no se proporciona
    if (config.jsonPath) {
      // Validar formato básico del jsonPath
      if (!/^(\$\.)?[\w.]+$/.test(config.jsonPath)) {
        issues.push({
          row: 0,
          field: "jsonPath",
          value: config.jsonPath,
          severity: "WARNING",
          message:
            "El formato de jsonPath puede no ser válido. Usa formato simple como 'data' o 'result.records'",
        });
      }
    }

    return issues.length > 0 ? ValidationResult.withIssues(issues) : ValidationResult.success();
  }

  async getPreview(config: DataSourceConfig, limit: number = 5): Promise<ImportRecord[]> {
    const url = this.getFileUrl(config);
    const fieldMappings = config.fieldMappings || {};

    // Usar caché para evitar descarga doble
    const data = await this.getCachedData(url);

    const records = this.extractRecordsFromPath(data, config.jsonPath).slice(0, limit);
    const externalIdField = this.detectExternalIdField(records);

    return records.map((record, index) =>
      ImportRecord.fromApiRecord(record, fieldMappings, index, externalIdField)
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

      const url = this.getFileUrl(config);

      // Usar caché para evitar descarga doble
      const data = await this.getCachedData(url);
      const records = this.extractRecordsFromPath(data, config.jsonPath);

      // Obtener campos disponibles del primer registro
      const sampleFields = records.length > 0 ? Object.keys(records[0]) : [];

      return {
        success: true,
        message: `Conexión exitosa. ${records.length} registros disponibles.`,
        recordCount: records.length,
        sampleFields,
        responseTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        message: `Error: ${error instanceof Error ? error.message : "Error desconocido"}`,
        responseTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Fetch con reintentos
   */
  private async fetchWithRetry(url: string, attempt: number = 1): Promise<globalThis.Response> {
    try {
      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response;
    } catch (error) {
      if (attempt < this.maxRetries) {
        console.warn(`⚠️ Intento ${attempt}/${this.maxRetries} fallido, reintentando...`);
        await this.delay(this.retryDelayMs * attempt);
        return this.fetchWithRetry(url, attempt + 1);
      }
      throw error;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Obtiene datos del JSON con caché para evitar descargas múltiples
   * @param url - URL del archivo JSON
   * @returns Datos JSON parseados
   */
  private async getCachedData(url: string): Promise<unknown> {
    const cached = this.dataCache.get(url);
    const now = Date.now();

    // Si hay datos en caché y no han expirado, usarlos
    if (cached && now - cached.timestamp < this.cacheTtlMs) {
      console.log(`📦 Usando datos en caché para: ${url}`);
      return cached.data;
    }

    // Descargar y cachear
    console.log(`📥 Descargando JSON desde: ${url}`);
    const response = await this.fetchWithRetry(url);
    const data = await response.json();

    // Guardar en caché
    this.dataCache.set(url, { data, timestamp: now });
    console.log(`💾 Datos cacheados para: ${url}`);

    return data;
  }

  /**
   * Limpia la caché (útil después de una sincronización completa)
   */
  clearCache(): void {
    this.dataCache.clear();
    console.log(`🧹 Caché limpiada`);
  }

  /**
   * Limpia entradas expiradas de la caché
   */
  private cleanExpiredCache(): void {
    const now = Date.now();
    for (const [url, cached] of this.dataCache) {
      if (now - cached.timestamp >= this.cacheTtlMs) {
        this.dataCache.delete(url);
      }
    }
  }
}
