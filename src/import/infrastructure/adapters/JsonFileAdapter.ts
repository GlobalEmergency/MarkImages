/**
 * Adapter: JSON File (descarga directa de archivos JSON)
 * Capa de Infraestructura - Implementa IDataSourceAdapter para archivos JSON
 *
 * Soporta:
 * - URLs directas de archivos JSON
 * - ExtracciÃ³n de registros desde una ruta configurable (jsonPath)
 * - Mapeo de campos personalizado
 */

import type {
  IDataSourceAdapter,
  DataSourceConfig,
  ConnectionTestResult,
} from "@/import/domain/ports/IDataSourceAdapter";
import { ImportRecord } from "@/import/domain/value-objects/ImportRecord";
import { ValidationResult } from "@/import/domain/value-objects/ValidationResult";
import { enrichRecordIfNeeded } from "./enrichRecord";
import { validateExternalUrl } from "./validateUrl";

export class JsonFileAdapter implements IDataSourceAdapter {
  readonly type = "JSON_FILE" as const;

  private readonly maxRetries = 3;
  private readonly retryDelayMs = 1000;
  private readonly fetchTimeoutMs = 30_000; // 30 seconds

  // Per-request cache: avoids duplicate downloads within a single operation
  // (e.g. fetchRecords + getRecordCount in the same sync run).
  // Cleared after each top-level operation to prevent stale data across
  // serverless invocations and unbounded memory growth.
  private dataCache: Map<string, unknown> = new Map();

  /**
   * Obtiene la URL del archivo JSON
   */
  private getFileUrl(config: DataSourceConfig): string {
    const url = config.fileUrl || config.apiEndpoint;
    if (!url) {
      throw new Error("Se requiere fileUrl o apiEndpoint para JSON_FILE");
    }
    validateExternalUrl(url);
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
      return data;
    }

    if (typeof data !== "object" || data === null) {
      throw new Error("El JSON no es un objeto vÃ¡lido");
    }

    const obj = data as Record<string, unknown>;

    // Si se especifica jsonPath, usarlo
    if (jsonPath) {
      const parts = jsonPath.replace(/^\$\.?/, "").split(".");
      let current: unknown = obj;

      for (const part of parts) {
        if (part === "") continue;
        if (typeof current !== "object" || current === null) {
          throw new Error(`Ruta JSON invÃ¡lida: no se encontrÃ³ '${part}' en '${jsonPath}'`);
        }
        current = (current as Record<string, unknown>)[part];
      }

      if (Array.isArray(current)) {
        return current as Record<string, unknown>[];
      }

      throw new Error(`La ruta '${jsonPath}' no contiene un array de registros`);
    }

    // Si tiene 'features' (GeoJSON), extraer properties y coordenadas
    if (obj.features && Array.isArray(obj.features)) {
      const features = obj.features as Array<{
        properties?: Record<string, unknown>;
        geometry?: { type: string; coordinates: number[] };
      }>;

      return features.map((f) => {
        const record = { ...f.properties };
        if (f.geometry?.type === "Point" && Array.isArray(f.geometry.coordinates)) {
          record.longitude = f.geometry.coordinates[0];
          record.latitude = f.geometry.coordinates[1];
        }
        return record as Record<string, unknown>;
      });
    }

    // Auto-detectar la ruta si no se especifica
    const commonPaths = ["data", "records", "items", "results"];

    for (const path of commonPaths) {
      if (obj[path] && Array.isArray(obj[path])) {
        return obj[path] as Record<string, unknown>[];
      }
    }

    throw new Error(
      `No se encontrÃ³ un array de registros. Especifica jsonPath para indicar dÃ³nde estÃ¡n los datos. ` +
        `Claves disponibles: ${Object.keys(obj).join(", ")}`
    );
  }

  /**
   * Detecta el campo de ID externo basado en los campos disponibles
   */
  private resolveExternalIdField(
    records: Record<string, unknown>[],
    config?: DataSourceConfig
  ): string {
    if (config?.externalIdField) return config.externalIdField;
    return this.detectExternalIdField(records);
  }

  private detectExternalIdField(records: Record<string, unknown>[]): string {
    if (records.length === 0) return "id";
    const firstRecord = records[0];
    const keys = Object.keys(firstRecord);

    const idCandidates = [
      "id",
      "codigo_dea",
      "id_dea",
      "external_id",
      "dea_id",
      "numero_inscripcio",
      "_id",
    ];
    for (const candidate of idCandidates) {
      if (keys.includes(candidate)) return candidate;
    }

    return keys[0] || "id";
  }

  async *fetchRecords(config: DataSourceConfig): AsyncGenerator<ImportRecord> {
    const url = this.getFileUrl(config);
    const fieldMappings = config.fieldMappings || {};

    // Usar cachÃ© para evitar descarga doble
    const data = await this.getCachedData(url);

    const records = this.extractRecordsFromPath(data, config.jsonPath);
    const externalIdField = this.resolveExternalIdField(records, config);

    for (let rowIndex = 0; rowIndex < records.length; rowIndex++) {
      const { record: enriched, mappings } = await enrichRecordIfNeeded(
        records[rowIndex],
        fieldMappings,
        config.fieldTransformers
      );
      yield ImportRecord.fromApiRecord(enriched, mappings, rowIndex, externalIdField);

      if ((rowIndex + 1) % 1000 === 0) {
      }
    }

    // Clear cache after full iteration to free memory
    this.clearCache();
  }

  async getRecordCount(config: DataSourceConfig): Promise<number> {
    const url = this.getFileUrl(config);

    // Usar cachÃ© para evitar descarga doble
    const data = await this.getCachedData(url);

    const records = this.extractRecordsFromPath(data, config.jsonPath);
    return records.length;
  }

  async validateConfig(config: DataSourceConfig): Promise<ValidationResult> {
    const issues: Array<{
      severity: string;
      message: string;
      row?: number;
      field?: string;
      value?: string;
    }> = [];

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
          message: "La URL del archivo JSON no es vÃ¡lida",
        });
      }
    }

    // jsonPath es opcional - se auto-detecta si no se proporciona
    if (config.jsonPath) {
      // Validar formato bÃ¡sico del jsonPath
      if (!/^(\$\.)?[\w.]+$/.test(config.jsonPath)) {
        issues.push({
          row: 0,
          field: "jsonPath",
          value: config.jsonPath,
          severity: "WARNING",
          message:
            "El formato de jsonPath puede no ser vÃ¡lido. Usa formato simple como 'data' o 'result.records'",
        });
      }
    }

    return issues.length > 0 ? ValidationResult.withIssues(issues) : ValidationResult.success();
  }

  async getPreview(config: DataSourceConfig, limit: number = 5): Promise<ImportRecord[]> {
    const url = this.getFileUrl(config);
    const fieldMappings = config.fieldMappings || {};

    // Usar cachÃ© para evitar descarga doble
    const data = await this.getCachedData(url);

    const records = this.extractRecordsFromPath(data, config.jsonPath).slice(0, limit);
    const externalIdField = this.resolveExternalIdField(records, config);

    const results: ImportRecord[] = [];
    for (let i = 0; i < records.length; i++) {
      const { record: enriched, mappings } = await enrichRecordIfNeeded(
        records[i],
        fieldMappings,
        config.fieldTransformers
      );
      results.push(ImportRecord.fromApiRecord(enriched, mappings, i, externalIdField));
    }
    return results;
  }

  async testConnection(config: DataSourceConfig): Promise<ConnectionTestResult> {
    const startTime = Date.now();

    try {
      const validation = await this.validateConfig(config);

      if (validation.hasCriticalErrors()) {
        return {
          success: false,
          message: validation.criticalErrors[0]?.message || "Error de validaciÃ³n",
        };
      }

      const url = this.getFileUrl(config);

      // Usar cachÃ© para evitar descarga doble
      const data = await this.getCachedData(url);
      const records = this.extractRecordsFromPath(data, config.jsonPath);

      // Obtener campos disponibles del primer registro
      const sampleFields = records.length > 0 ? Object.keys(records[0]) : [];

      return {
        success: true,
        message: `ConexiÃ³n exitosa. ${records.length} registros disponibles.`,
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
        signal: AbortSignal.timeout(this.fetchTimeoutMs),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response;
    } catch (error) {
      if (attempt < this.maxRetries) {
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
   * Obtiene datos del JSON con cachÃ© intra-operaciÃ³n para evitar descargas
   * mÃºltiples dentro de la misma invocaciÃ³n (e.g. preview + count).
   */
  private async getCachedData(url: string): Promise<unknown> {
    const cached = this.dataCache.get(url);
    if (cached !== undefined) {
      return cached;
    }

    const response = await this.fetchWithRetry(url);
    const data = await response.json();

    this.dataCache.set(url, data);
    return data;
  }

  /**
   * Limpia la cachÃ© (Ãºtil despuÃ©s de una sincronizaciÃ³n completa)
   */
  clearCache(): void {
    this.dataCache.clear();
  }
}
