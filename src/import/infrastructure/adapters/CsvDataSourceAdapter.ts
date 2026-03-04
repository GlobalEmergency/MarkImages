/**
 * Adapter: Fuente de datos CSV
 * Capa de Infraestructura - Implementa IDataSourceAdapter para archivos CSV
 */

import type {
  IDataSourceAdapter,
  DataSourceConfig,
  ConnectionTestResult,
} from "@/import/domain/ports/IDataSourceAdapter";
import { ImportRecord } from "@/import/domain/value-objects/ImportRecord";
import { ValidationResult } from "@/import/domain/value-objects/ValidationResult";
import type { CsvParserAdapter, CsvParseResult } from "../parsers/CsvParserAdapter";

export class CsvDataSourceAdapter implements IDataSourceAdapter {
  readonly type = "CSV_FILE" as const;

  constructor(private readonly csvParser: CsvParserAdapter) {}

  async *fetchRecords(config: DataSourceConfig): AsyncGenerator<ImportRecord> {
    if (!config.filePath) {
      throw new Error("filePath is required for CSV source");
    }

    const parseResult = await this.csvParser.parseFile(config.filePath);

    let rowIndex = 0;
    for (const row of parseResult.rows) {
      // Convertir CsvRow a Record<string, string> (CsvRowData tiene solo propiedades string)
      const rowData = row.toJSON() as unknown as Record<string, string>;

      yield ImportRecord.fromCsvRow(rowData, config.columnMappings || [], rowIndex);
      rowIndex++;
    }
  }

  async getRecordCount(config: DataSourceConfig): Promise<number> {
    if (!config.filePath) {
      throw new Error("filePath is required for CSV source");
    }

    const parseResult = await this.csvParser.parseFile(config.filePath);
    return parseResult.totalRows;
  }

  async validateConfig(config: DataSourceConfig): Promise<ValidationResult> {
    const issues: Array<{
      severity: string;
      message: string;
      row?: number;
      field?: string;
      value?: string;
    }> = [];

    if (!config.filePath) {
      issues.push({
        row: 0,
        field: "filePath",
        value: "",
        severity: "ERROR",
        message: "El archivo CSV es requerido",
      });
      return ValidationResult.withIssues(issues);
    }

    // Verificar que el archivo existe
    try {
      const fs = await import("fs/promises");
      const stats = await fs.stat(config.filePath);

      if (!stats.isFile()) {
        issues.push({
          row: 0,
          field: "filePath",
          value: config.filePath,
          severity: "ERROR",
          message: "La ruta no es un archivo válido",
        });
      }

      // Verificar extensión
      if (!config.filePath.toLowerCase().endsWith(".csv")) {
        issues.push({
          row: 0,
          field: "filePath",
          value: config.filePath,
          severity: "WARNING",
          message: "El archivo no tiene extensión .csv",
        });
      }

      // Verificar tamaño (máximo 50MB)
      const maxSize = 50 * 1024 * 1024;
      if (stats.size > maxSize) {
        issues.push({
          row: 0,
          field: "filePath",
          value: config.filePath,
          severity: "ERROR",
          message: `El archivo excede el tamaño máximo de 50MB (${Math.round(stats.size / 1024 / 1024)}MB)`,
        });
      }
    } catch (error) {
      issues.push({
        row: 0,
        field: "filePath",
        value: config.filePath,
        severity: "ERROR",
        message: `El archivo no existe o no es accesible: ${error instanceof Error ? error.message : "Error desconocido"}`,
      });
    }

    // Verificar que haya mappings si se proporcionaron
    if (config.columnMappings && config.columnMappings.length === 0) {
      issues.push({
        row: 0,
        field: "columnMappings",
        value: "",
        severity: "WARNING",
        message: "No hay mapeos de columnas definidos",
      });
    }

    return issues.length > 0 ? ValidationResult.withIssues(issues) : ValidationResult.success();
  }

  async getPreview(config: DataSourceConfig, limit: number = 5): Promise<ImportRecord[]> {
    const records: ImportRecord[] = [];
    let count = 0;

    for await (const record of this.fetchRecords(config)) {
      records.push(record);
      count++;
      if (count >= limit) break;
    }

    return records;
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

      const parseResult: CsvParseResult = await this.csvParser.parseFile(config.filePath!);
      const responseTimeMs = Date.now() - startTime;

      // Obtener campos del header (usar primera fila si no hay headers explícitos)
      const sampleFields =
        parseResult.rows.length > 0 ? Object.keys(parseResult.rows[0]?.toJSON() || {}) : [];

      return {
        success: true,
        message: `Archivo CSV válido. ${parseResult.totalRows} registros encontrados.`,
        recordCount: parseResult.totalRows,
        sampleFields,
        responseTimeMs,
      };
    } catch (error) {
      return {
        success: false,
        message: `Error al leer el archivo: ${error instanceof Error ? error.message : "Error desconocido"}`,
        responseTimeMs: Date.now() - startTime,
      };
    }
  }
}
