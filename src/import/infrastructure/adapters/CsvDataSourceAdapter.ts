/**
 * Adapter: Fuente de datos CSV (local y remoto)
 * Capa de Infraestructura - Implementa IDataSourceAdapter para archivos CSV
 *
 * Soporta dos modos:
 * - Local: config.filePath → lee archivo del disco (importación manual)
 * - Remoto: config.fileUrl → descarga CSV desde URL (sync automático)
 *
 * En ambos casos delega el parseo a CsvParserAdapter (PapaParse).
 * El delimitador es configurable vía config.csvDelimiter (auto-detectado si no se especifica).
 */

import type {
  IDataSourceAdapter,
  DataSourceConfig,
  ConnectionTestResult,
} from "@/import/domain/ports/IDataSourceAdapter";
import { ImportRecord } from "@/import/domain/value-objects/ImportRecord";
import { ValidationResult } from "@/import/domain/value-objects/ValidationResult";
import { CsvParserAdapter } from "../parsers/CsvParserAdapter";
import { enrichRecordIfNeeded } from "./enrichRecord";
import { validateExternalUrl } from "./validateUrl";

export class CsvDataSourceAdapter implements IDataSourceAdapter {
  readonly type = "CSV_FILE" as const;

  private readonly csvParser: CsvParserAdapter;
  private readonly maxRetries = 3;
  private readonly retryDelayMs = 1000;
  private readonly fetchTimeoutMs = 30_000;

  // Per-request cache for remote CSVs (same pattern as JsonFileAdapter)
  private dataCache: Map<string, Record<string, string>[]> = new Map();

  constructor(csvParser?: CsvParserAdapter) {
    this.csvParser = csvParser || new CsvParserAdapter();
  }

  // ============================================
  // Resolución de fuente: local vs remota
  // ============================================

  private isRemote(config: DataSourceConfig): boolean {
    return !config.filePath && !!(config.fileUrl || config.apiEndpoint);
  }

  private getRemoteUrl(config: DataSourceConfig): string {
    const url = config.fileUrl || config.apiEndpoint;
    if (!url) {
      throw new Error("Se requiere fileUrl o apiEndpoint para CSV remoto");
    }
    validateExternalUrl(url);
    return url;
  }

  // ============================================
  // Obtención de registros
  // ============================================

  private async getRecords(config: DataSourceConfig): Promise<Record<string, string>[]> {
    if (this.isRemote(config)) {
      return this.getRemoteRecords(config);
    }
    return this.getLocalRecords(config);
  }

  private async getLocalRecords(config: DataSourceConfig): Promise<Record<string, string>[]> {
    if (!config.filePath) {
      throw new Error("filePath es requerido para CSV local");
    }
    const result = await this.csvParser.parseFile(config.filePath);
    return result.rows.map((row) => row.toJSON() as unknown as Record<string, string>);
  }

  private async getRemoteRecords(config: DataSourceConfig): Promise<Record<string, string>[]> {
    const url = this.getRemoteUrl(config);

    const cached = this.dataCache.get(url);
    if (cached) return cached;

    console.log(`📥 Descargando CSV desde: ${url}`);
    const response = await this.fetchWithRetry(url);
    const text = config.encoding
      ? new TextDecoder(config.encoding).decode(await response.arrayBuffer())
      : await response.text();

    const { records, errors } = this.csvParser.parseToRecords(text, config.csvDelimiter);

    if (errors.length > 0) {
      console.warn(
        `⚠️ ${errors.length} errores de parseo CSV (primeros 3):`,
        errors.slice(0, 3).map((e) => e.message)
      );
    }

    console.log(`📊 CSV parseado: ${records.length} registros`);
    this.dataCache.set(url, records);
    return records;
  }

  // ============================================
  // IDataSourceAdapter
  // ============================================

  async *fetchRecords(config: DataSourceConfig): AsyncGenerator<ImportRecord> {
    const records = await this.getRecords(config);

    if (this.isRemote(config)) {
      // Remoto: usa fieldMappings como REST_API/JSON_FILE
      const fieldMappings = config.fieldMappings || {};
      const externalIdField = this.resolveExternalIdField(records, config);

      console.log(`📋 Procesando ${records.length} registros CSV, ID field: '${externalIdField}'`);

      for (let i = 0; i < records.length; i++) {
        const { record: enriched, mappings } = await enrichRecordIfNeeded(
          records[i],
          fieldMappings,
          config.fieldTransformers
        );
        yield ImportRecord.fromApiRecord(enriched, mappings, i, externalIdField);

        if ((i + 1) % 1000 === 0) {
          console.log(`📥 Procesados ${i + 1}/${records.length} registros...`);
        }
      }
    } else {
      // Local: usa columnMappings (flujo de importación manual)
      for (let i = 0; i < records.length; i++) {
        yield ImportRecord.fromCsvRow(records[i], config.columnMappings || [], i);
      }
    }

    console.log(`✅ Procesamiento CSV completado: ${records.length} registros`);
    this.clearCache();
  }

  async getRecordCount(config: DataSourceConfig): Promise<number> {
    const records = await this.getRecords(config);
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

    if (this.isRemote(config)) {
      // Validación remota
      const url = config.fileUrl || config.apiEndpoint;
      if (!url) {
        issues.push({
          row: 0,
          field: "fileUrl",
          value: "",
          severity: "CRITICAL",
          message: "Se requiere la URL del archivo CSV (fileUrl o apiEndpoint)",
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
            message: "La URL del archivo CSV no es válida",
          });
        }
      }
    } else {
      // Validación local
      if (!config.filePath) {
        issues.push({
          row: 0,
          field: "filePath",
          value: "",
          severity: "CRITICAL",
          message: "Se requiere filePath o fileUrl para CSV",
        });
      } else {
        try {
          const fs = await import("fs/promises");
          const stats = await fs.stat(config.filePath);
          if (!stats.isFile()) {
            issues.push({
              row: 0,
              field: "filePath",
              value: config.filePath,
              severity: "CRITICAL",
              message: "La ruta no es un archivo válido",
            });
          }
          const maxSize = 50 * 1024 * 1024;
          if (stats.size > maxSize) {
            issues.push({
              row: 0,
              field: "filePath",
              value: config.filePath,
              severity: "CRITICAL",
              message: `El archivo excede el tamaño máximo de 50MB (${Math.round(stats.size / 1024 / 1024)}MB)`,
            });
          }
        } catch (error) {
          issues.push({
            row: 0,
            field: "filePath",
            value: config.filePath,
            severity: "CRITICAL",
            message: `Archivo no accesible: ${error instanceof Error ? error.message : "Error desconocido"}`,
          });
        }
      }
    }

    return issues.length > 0 ? ValidationResult.withIssues(issues) : ValidationResult.success();
  }

  async getPreview(config: DataSourceConfig, limit: number = 5): Promise<ImportRecord[]> {
    const records = await this.getRecords(config);
    const sliced = records.slice(0, limit);

    if (this.isRemote(config)) {
      const fieldMappings = config.fieldMappings || {};
      const externalIdField = this.resolveExternalIdField(sliced, config);

      const results: ImportRecord[] = [];
      for (let i = 0; i < sliced.length; i++) {
        const { record: enriched, mappings } = await enrichRecordIfNeeded(
          sliced[i],
          fieldMappings,
          config.fieldTransformers
        );
        results.push(ImportRecord.fromApiRecord(enriched, mappings, i, externalIdField));
      }
      return results;
    }

    return sliced.map((row, i) => ImportRecord.fromCsvRow(row, config.columnMappings || [], i));
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

      const records = await this.getRecords(config);
      const sampleFields = records.length > 0 ? Object.keys(records[0]) : [];

      return {
        success: true,
        message: `CSV válido. ${records.length} registros encontrados.`,
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

  // ============================================
  // Helpers
  // ============================================

  private resolveExternalIdField(
    records: Record<string, string>[],
    config: DataSourceConfig
  ): string {
    if (config.externalIdField) return config.externalIdField;
    if (records.length === 0) return "id";

    const keys = Object.keys(records[0]);
    const candidates = [
      "id",
      "codigo_dea",
      "id_dea",
      "external_id",
      "codequipo",
      "GEOCODIGO",
      "_id",
    ];
    for (const c of candidates) {
      if (keys.includes(c)) return c;
    }
    return keys[0] || "id";
  }

  private async fetchWithRetry(url: string, attempt: number = 1): Promise<globalThis.Response> {
    try {
      const response = await fetch(url, {
        headers: { Accept: "text/csv, text/plain, */*" },
        signal: AbortSignal.timeout(this.fetchTimeoutMs),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response;
    } catch (error) {
      if (attempt < this.maxRetries) {
        console.warn(`⚠️ Intento ${attempt}/${this.maxRetries} fallido, reintentando...`);
        await new Promise((r) => setTimeout(r, this.retryDelayMs * attempt));
        return this.fetchWithRetry(url, attempt + 1);
      }
      throw error;
    }
  }

  clearCache(): void {
    this.dataCache.clear();
  }
}
