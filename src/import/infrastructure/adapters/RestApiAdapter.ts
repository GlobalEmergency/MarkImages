/**
 * Adapter: REST API genérico con paginación configurable
 * Capa de Infraestructura - Implementa IDataSourceAdapter para APIs REST
 *
 * Soporta tres estrategias de paginación:
 * - offset: ?offset=100&limit=50 (CKAN, OpenDataSoft)
 * - page: ?page=3&per_page=50 (APIs REST comunes)
 * - cursor: ?cursor=abc123&limit=50 (APIs modernas)
 * - none: sin paginación (respuesta completa en un request)
 *
 * Los nombres de parámetros son configurables para adaptarse a cualquier API.
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

export class RestApiAdapter implements IDataSourceAdapter {
  readonly type = "REST_API" as const;

  private readonly maxRetries = 3;
  private readonly retryDelayMs = 1000;
  private readonly fetchTimeoutMs = 30_000;
  private readonly defaultPageSize = 100;

  async *fetchRecords(config: DataSourceConfig): AsyncGenerator<ImportRecord> {
    const endpoint = this.getEndpoint(config);
    const fieldMappings = config.fieldMappings || {};
    const pagination = config.pagination;

    if (!pagination || pagination.strategy === "none") {
      yield* this.fetchAllAtOnce(endpoint, config, fieldMappings);
      return;
    }

    switch (pagination.strategy) {
      case "offset":
        yield* this.fetchWithOffsetPagination(endpoint, config, fieldMappings);
        break;
      case "page":
        yield* this.fetchWithPagePagination(endpoint, config, fieldMappings);
        break;
      case "cursor":
        yield* this.fetchWithCursorPagination(endpoint, config, fieldMappings);
        break;
    }
  }

  async getRecordCount(config: DataSourceConfig): Promise<number> {
    const endpoint = this.getEndpoint(config);
    const pagination = config.pagination;

    // If the API has a totalCount path, try a minimal request
    if (pagination?.totalCountPath) {
      const url = new URL(endpoint);
      const limitParam = pagination.limitParam || "limit";
      url.searchParams.set(limitParam, "1");

      const data = await this.fetchJson(url.toString(), config);
      const total = this.getNestedValue(data, pagination.totalCountPath);
      if (typeof total === "number") return total;
    }

    // Otherwise, fetch all and count
    const data = await this.fetchJson(endpoint, config);
    const records = this.extractRecords(data, config.responseDataPath);
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

    if (!config.apiEndpoint) {
      issues.push({
        row: 0,
        field: "apiEndpoint",
        value: "",
        severity: "CRITICAL",
        message: "Se requiere el endpoint de la API",
      });
    } else {
      try {
        new URL(config.apiEndpoint);
      } catch {
        issues.push({
          row: 0,
          field: "apiEndpoint",
          value: config.apiEndpoint,
          severity: "CRITICAL",
          message: "El endpoint de la API no es una URL válida",
        });
      }
    }

    if (config.pagination) {
      const validStrategies = ["offset", "page", "cursor", "none"];
      if (!validStrategies.includes(config.pagination.strategy)) {
        issues.push({
          row: 0,
          field: "pagination.strategy",
          value: config.pagination.strategy,
          severity: "ERROR",
          message: `Estrategia de paginación inválida. Valores permitidos: ${validStrategies.join(", ")}`,
        });
      }

      if (config.pagination.strategy === "cursor" && !config.pagination.cursorResponsePath) {
        issues.push({
          row: 0,
          field: "pagination.cursorResponsePath",
          value: "",
          severity: "WARNING",
          message: "Para paginación por cursor, se recomienda especificar cursorResponsePath",
        });
      }
    }

    return issues.length > 0 ? ValidationResult.withIssues(issues) : ValidationResult.success();
  }

  async getPreview(config: DataSourceConfig, limit: number = 5): Promise<ImportRecord[]> {
    const endpoint = this.getEndpoint(config);
    const fieldMappings = config.fieldMappings || {};
    const pagination = config.pagination;

    // Request only a few records for preview
    const url = new URL(endpoint);
    if (pagination && pagination.strategy !== "none") {
      const limitParam = pagination.limitParam || "limit";
      url.searchParams.set(limitParam, limit.toString());
    }

    const data = await this.fetchJson(url.toString(), config);
    const records = this.extractRecords(data, config.responseDataPath).slice(0, limit);
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
          message: validation.criticalErrors[0]?.message || "Error de validación",
        };
      }

      const endpoint = this.getEndpoint(config);
      const url = new URL(endpoint);

      // Request minimal data for connection test
      if (config.pagination && config.pagination.strategy !== "none") {
        const limitParam = config.pagination.limitParam || "limit";
        url.searchParams.set(limitParam, "1");
      }

      const data = await this.fetchJson(url.toString(), config);
      const records = this.extractRecords(data, config.responseDataPath);
      const sampleFields = records.length > 0 ? Object.keys(records[0]) : [];

      // Try to get total count
      let recordCount = records.length;
      if (config.pagination?.totalCountPath) {
        const total = this.getNestedValue(data, config.pagination.totalCountPath);
        if (typeof total === "number") recordCount = total;
      }

      return {
        success: true,
        message: `Conexión exitosa. ${recordCount} registros disponibles.`,
        recordCount,
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

  // ============================================================
  // Pagination strategies
  // ============================================================

  private async *fetchAllAtOnce(
    endpoint: string,
    config: DataSourceConfig,
    fieldMappings: Record<string, string>
  ): AsyncGenerator<ImportRecord> {
    console.log(`📥 Fetching all records from: ${endpoint}`);
    const data = await this.fetchJson(endpoint, config);
    const records = this.extractRecords(data, config.responseDataPath);
    const externalIdField = this.resolveExternalIdField(records, config);

    console.log(`📋 Found ${records.length} records, ID field: '${externalIdField}'`);

    for (let i = 0; i < records.length; i++) {
      const { record: enriched, mappings } = await enrichRecordIfNeeded(
        records[i],
        fieldMappings,
        config.fieldTransformers
      );
      yield ImportRecord.fromApiRecord(enriched, mappings, i, externalIdField);
      if ((i + 1) % 1000 === 0) {
        console.log(`📥 Processed ${i + 1} records...`);
      }
    }

    console.log(`✅ Finished processing ${records.length} records`);
  }

  private async *fetchWithOffsetPagination(
    endpoint: string,
    config: DataSourceConfig,
    fieldMappings: Record<string, string>
  ): AsyncGenerator<ImportRecord> {
    const pagination = config.pagination!;
    const limitParam = pagination.limitParam || "limit";
    const offsetParam = pagination.offsetParam || "offset";
    const pageSize = pagination.limitValue || this.defaultPageSize;

    let offset = 0;
    let rowIndex = 0;
    let hasMore = true;

    while (hasMore) {
      const url = new URL(endpoint);
      url.searchParams.set(limitParam, pageSize.toString());
      url.searchParams.set(offsetParam, offset.toString());

      const data = await this.fetchJson(url.toString(), config);
      const records = this.extractRecords(data, config.responseDataPath);

      if (rowIndex === 0 && records.length > 0) {
        const externalIdField = this.resolveExternalIdField(records, config);
        console.log(`📋 Offset pagination, ID field: '${externalIdField}', page size: ${pageSize}`);
      }

      const externalIdField = this.resolveExternalIdField(records, config);
      for (const record of records) {
        const { record: enriched, mappings } = await enrichRecordIfNeeded(
          record,
          fieldMappings,
          config.fieldTransformers
        );
        yield ImportRecord.fromApiRecord(enriched, mappings, rowIndex, externalIdField);
        rowIndex++;
      }

      hasMore = this.checkHasMore(data, records, pagination, offset, pageSize);
      offset += pageSize;

      if (rowIndex % 1000 === 0) {
        console.log(`📥 Fetched ${rowIndex} records...`);
      }
    }

    console.log(`✅ Finished fetching ${rowIndex} records (offset pagination)`);
  }

  private async *fetchWithPagePagination(
    endpoint: string,
    config: DataSourceConfig,
    fieldMappings: Record<string, string>
  ): AsyncGenerator<ImportRecord> {
    const pagination = config.pagination!;
    const limitParam = pagination.limitParam || "per_page";
    const pageParam = pagination.pageParam || "page";
    const pageSize = pagination.limitValue || this.defaultPageSize;

    let page = 1;
    let rowIndex = 0;
    let hasMore = true;

    while (hasMore) {
      const url = new URL(endpoint);
      url.searchParams.set(limitParam, pageSize.toString());
      url.searchParams.set(pageParam, page.toString());

      const data = await this.fetchJson(url.toString(), config);
      const records = this.extractRecords(data, config.responseDataPath);

      const externalIdField = this.resolveExternalIdField(records, config);
      for (const record of records) {
        const { record: enriched, mappings } = await enrichRecordIfNeeded(
          record,
          fieldMappings,
          config.fieldTransformers
        );
        yield ImportRecord.fromApiRecord(enriched, mappings, rowIndex, externalIdField);
        rowIndex++;
      }

      hasMore = this.checkHasMore(data, records, pagination, (page - 1) * pageSize, pageSize);
      page++;

      if (rowIndex % 1000 === 0) {
        console.log(`📥 Fetched ${rowIndex} records...`);
      }
    }

    console.log(`✅ Finished fetching ${rowIndex} records (page pagination)`);
  }

  private async *fetchWithCursorPagination(
    endpoint: string,
    config: DataSourceConfig,
    fieldMappings: Record<string, string>
  ): AsyncGenerator<ImportRecord> {
    const pagination = config.pagination!;
    const limitParam = pagination.limitParam || "limit";
    const cursorParam = pagination.cursorParam || "cursor";
    const cursorResponsePath = pagination.cursorResponsePath || "next_cursor";
    const pageSize = pagination.limitValue || this.defaultPageSize;

    let cursor: string | null = null;
    let rowIndex = 0;

    while (true) {
      const url = new URL(endpoint);
      url.searchParams.set(limitParam, pageSize.toString());
      if (cursor) {
        url.searchParams.set(cursorParam, cursor);
      }

      const data = await this.fetchJson(url.toString(), config);
      const records = this.extractRecords(data, config.responseDataPath);

      if (records.length === 0) break;

      const externalIdField = this.resolveExternalIdField(records, config);
      for (const record of records) {
        const { record: enriched, mappings } = await enrichRecordIfNeeded(
          record,
          fieldMappings,
          config.fieldTransformers
        );
        yield ImportRecord.fromApiRecord(enriched, mappings, rowIndex, externalIdField);
        rowIndex++;
      }

      // Get next cursor
      const nextCursor = this.getNestedValue(data, cursorResponsePath);
      if (!nextCursor || typeof nextCursor !== "string") break;
      cursor = nextCursor;

      if (rowIndex % 1000 === 0) {
        console.log(`📥 Fetched ${rowIndex} records...`);
      }
    }

    console.log(`✅ Finished fetching ${rowIndex} records (cursor pagination)`);
  }

  // ============================================================
  // Helpers
  // ============================================================

  private getEndpoint(config: DataSourceConfig): string {
    if (!config.apiEndpoint) {
      throw new Error("Se requiere apiEndpoint para REST_API");
    }
    validateExternalUrl(config.apiEndpoint);
    return config.apiEndpoint;
  }

  private async fetchJson(url: string, config: DataSourceConfig): Promise<unknown> {
    const method = config.method || "GET";
    const headers: Record<string, string> = {
      Accept: "application/json",
      ...config.headers,
    };

    if (config.authToken) {
      headers["Authorization"] = `Bearer ${config.authToken}`;
    }

    const fetchOptions: globalThis.RequestInit = {
      method,
      headers,
      signal: AbortSignal.timeout(this.fetchTimeoutMs),
    };

    if (method === "POST" && config.requestBody) {
      headers["Content-Type"] = "application/json";
      fetchOptions.body = JSON.stringify(config.requestBody);
    }

    return this.fetchWithRetry(url, fetchOptions);
  }

  private async fetchWithRetry(
    url: string,
    options: globalThis.RequestInit,
    attempt: number = 1
  ): Promise<unknown> {
    try {
      const response = await fetch(url, options);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      if (attempt < this.maxRetries) {
        console.warn(
          `⚠️ REST API request failed (attempt ${attempt}/${this.maxRetries}), retrying...`
        );
        await this.delay(this.retryDelayMs * attempt);
        return this.fetchWithRetry(url, options, attempt + 1);
      }
      throw error;
    }
  }

  /**
   * Extrae registros de la respuesta usando responseDataPath o auto-detección
   */
  private extractRecords(data: unknown, responseDataPath?: string): Record<string, unknown>[] {
    if (Array.isArray(data)) return data;

    if (typeof data !== "object" || data === null) return [];

    const obj = data as Record<string, unknown>;

    // Use configured path
    if (responseDataPath) {
      const value = this.getNestedValue(obj, responseDataPath);
      if (Array.isArray(value)) return value as Record<string, unknown>[];
      return [];
    }

    // Auto-detect: try common patterns
    const commonPaths = ["data", "records", "results", "items", "elements", "features"];
    for (const path of commonPaths) {
      if (obj[path] && Array.isArray(obj[path])) {
        const arr = obj[path] as unknown[];

        // GeoJSON features: flatten geometry into properties
        if (
          path === "features" &&
          arr.length > 0 &&
          typeof arr[0] === "object" &&
          arr[0] !== null &&
          "properties" in arr[0]
        ) {
          return arr.map((f) => {
            const feature = f as {
              properties?: Record<string, unknown>;
              geometry?: { type: string; coordinates: number[] };
            };
            const record = { ...feature.properties };
            if (feature.geometry?.type === "Point" && Array.isArray(feature.geometry.coordinates)) {
              record.longitude = feature.geometry.coordinates[0];
              record.latitude = feature.geometry.coordinates[1];
            }
            return record as Record<string, unknown>;
          });
        }

        return arr as Record<string, unknown>[];
      }
    }

    console.log(
      `⚠️ Could not auto-detect records array. Keys: ${Object.keys(obj).slice(0, 5).join(", ")}`
    );
    return [];
  }

  /**
   * Accede a un valor anidado usando dot notation
   */
  private getNestedValue(obj: unknown, path: string): unknown {
    const parts = path.split(".");
    let current: unknown = obj;

    for (const part of parts) {
      if (typeof current !== "object" || current === null) return undefined;
      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }

  /**
   * Determina si hay más páginas basándose en la config y los datos
   */
  private checkHasMore(
    data: unknown,
    records: Record<string, unknown>[],
    pagination: NonNullable<DataSourceConfig["pagination"]>,
    currentOffset: number,
    pageSize: number
  ): boolean {
    // Empty page = no more
    if (records.length === 0) return false;

    // Less than page size = last page
    if (records.length < pageSize) return false;

    // Check explicit hasMore flag
    if (pagination.hasMorePath) {
      const hasMore = this.getNestedValue(data, pagination.hasMorePath);
      if (typeof hasMore === "boolean") return hasMore;
    }

    // Check total count
    if (pagination.totalCountPath) {
      const total = this.getNestedValue(data, pagination.totalCountPath);
      if (typeof total === "number") {
        return currentOffset + records.length < total;
      }
    }

    // Default: assume more if we got a full page
    return records.length >= pageSize;
  }

  private resolveExternalIdField(
    records: Record<string, unknown>[],
    config?: DataSourceConfig
  ): string {
    // Explicit config takes priority over auto-detection
    if (config?.externalIdField) return config.externalIdField;
    return this.detectExternalIdField(records);
  }

  private detectExternalIdField(records: Record<string, unknown>[]): string {
    if (records.length === 0) return "id";
    const keys = Object.keys(records[0]);

    const idCandidates = [
      "id",
      "id_dea",
      "codigo_dea",
      "external_id",
      "dea_id",
      "numero_inscripcio",
      "_id",
      "uid",
    ];
    for (const candidate of idCandidates) {
      if (keys.includes(candidate)) return candidate;
    }

    return keys[0] || "id";
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
