/**
 * Use Case: Pre-validar datos del CSV
 * Valida los datos antes de la importación usando los mapeos configurados
 * Capa de Aplicación
 */

import { CsvRowMapper } from "@/domain/import/services/CsvRowMapper";
import { ColumnMapping } from "@/domain/import/value-objects/ColumnMapping";
import { CsvPreview } from "@/domain/import/value-objects/CsvPreview";
import { ValidationIssue, ValidationResult } from "@/domain/import/value-objects/ValidationResult";

export interface PreValidateDataRequest {
  preview: CsvPreview;
  mappings: ColumnMapping[];
  filePath: string;
  maxRowsToValidate?: number;
}

export interface PreValidateDataResponse {
  validation: ValidationResult;
  summary: {
    totalRowsValidated: number;
    criticalErrors: number;
    errors: number;
    warnings: number;
    canProceed: boolean;
  };
  sharepoint?: {
    detected: boolean;
    sampleUrls: string[];
    imageFields: string[];
  };
}

export class PreValidateDataUseCase {
  constructor() {}

  /**
   * Ejecuta la pre-validación de datos
   */
  async execute(request: PreValidateDataRequest): Promise<PreValidateDataResponse> {
    const { preview, mappings, filePath, maxRowsToValidate = 100 } = request;

    try {
      // Convertir mappings a un Map para acceso rápido
      const mappingMap = new Map(mappings.map((m) => [m.systemFieldKey, m.csvColumnName]));

      // Leer archivo completo (o primeras N filas)
      const rows = await this.readCsvRows(filePath, preview.csvDelimiter, maxRowsToValidate);

      // Detectar URLs de SharePoint en campos de imagen
      const sharepointInfo = this.detectSharePointUrls(rows, mappingMap, preview);

      const issues: ValidationIssue[] = [];

      // Validar cada fila
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]!;
        const rowNumber = i + 2; // +2 porque 1-based y saltamos header

        // Validar campos requeridos
        const requiredIssues = this.validateRequiredFields(row, mappingMap, preview, rowNumber);
        issues.push(...requiredIssues);

        // Validar coordenadas
        const coordinateIssues = this.validateCoordinates(row, mappingMap, preview, rowNumber);
        issues.push(...coordinateIssues);

        // Validar código postal
        const postalCodeIssues = this.validatePostalCode(row, mappingMap, preview, rowNumber);
        issues.push(...postalCodeIssues);
      }

      // Crear resultado de validación
      const validation = ValidationResult.withIssues(issues);
      const summary = validation.getSummary();

      return {
        validation,
        summary: {
          totalRowsValidated: rows.length,
          criticalErrors: summary.criticalCount,
          errors: summary.errorCount,
          warnings: summary.warningCount,
          canProceed: summary.canProceed,
        },
        sharepoint: sharepointInfo.detected ? sharepointInfo : undefined,
      };
    } catch (error) {
      console.error("Error during pre-validation:", error);

      // Retornar error crítico
      const criticalIssue: ValidationIssue = {
        row: 0,
        field: "system",
        value: "",
        severity: "CRITICAL",
        message: error instanceof Error ? error.message : "Error crítico durante la validación",
      };

      const validation = ValidationResult.withSingleIssue(criticalIssue);

      return {
        validation,
        summary: {
          totalRowsValidated: 0,
          criticalErrors: 1,
          errors: 0,
          warnings: 0,
          canProceed: false,
        },
      };
    }
  }

  /**
   * Lee las filas del CSV
   */
  private async readCsvRows(
    filePath: string,
    delimiter: string,
    maxRows: number
  ): Promise<string[][]> {
    const fs = await import("fs/promises");
    const content = await fs.readFile(filePath, "utf-8");
    const lines = content.split("\n").filter((line) => line.trim());

    // Saltar header y tomar hasta maxRows
    const dataLines = lines.slice(1, Math.min(lines.length, maxRows + 1));

    return dataLines.map((line) => this.parseRow(line, delimiter));
  }

  /**
   * Parsea una línea del CSV
   */
  private parseRow(line: string, delimiter: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i]!;
      const nextChar = line[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        result.push(current);
        current = "";
      } else {
        current += char;
      }
    }

    result.push(current);
    return result;
  }

  /**
   * Valida que los campos requeridos no estén vacíos
   * USA LA MISMA LÓGICA que ImportDeaBatchUseCase para garantizar consistencia
   */
  private validateRequiredFields(
    row: string[],
    mappingMap: Map<string, string>,
    preview: CsvPreview,
    rowNumber: number
  ): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    // 1. Construir objeto raw desde el array (nombre columna → valor)
    const rawData: Record<string, string> = {};
    for (const [_systemField, csvColumn] of mappingMap.entries()) {
      const columnIndex = preview.getColumnIndex(csvColumn);
      if (columnIndex !== -1) {
        rawData[csvColumn] = row[columnIndex] || "";
      }
    }

    // 2. Construir mappings en el formato que espera CsvRowMapper
    const mappings = Array.from(mappingMap.entries()).map(([systemField, csvColumn]) => ({
      csvColumn,
      systemField,
    }));

    // 3. Usar el servicio compartido para construir DynamicCsvRow
    // Esta es la MISMA lógica que usa ImportDeaBatchUseCase
    const dynamicRow = CsvRowMapper.buildDynamicRow(rawData, mappings);

    // 4. Validar usando hasMinimumRequiredFields() (igual que en importación)
    if (!dynamicRow.hasMinimumRequiredFields()) {
      issues.push({
        row: rowNumber,
        field: "system",
        value: "",
        severity: "ERROR",
        message: "Missing minimum required fields (proposedName, streetName, streetNumber)",
      });
    }

    return issues;
  }

  /**
   * Valida coordenadas geográficas
   */
  private validateCoordinates(
    row: string[],
    mappingMap: Map<string, string>,
    preview: CsvPreview,
    rowNumber: number
  ): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    // Validar latitud
    const latColumn = mappingMap.get("latitude");
    if (latColumn) {
      const latIndex = preview.getColumnIndex(latColumn);
      if (latIndex !== -1) {
        const latValue = row[latIndex] || "";
        if (latValue.trim()) {
          const lat = parseFloat(latValue.replace(",", "."));
          if (isNaN(lat) || lat < -90 || lat > 90) {
            issues.push({
              row: rowNumber,
              field: "latitude",
              value: latValue,
              severity: "ERROR",
              message: "Latitud inválida (debe estar entre -90 y 90)",
            });
          }
        }
      }
    }

    // Validar longitud
    const lonColumn = mappingMap.get("longitude");
    if (lonColumn) {
      const lonIndex = preview.getColumnIndex(lonColumn);
      if (lonIndex !== -1) {
        const lonValue = row[lonIndex] || "";
        if (lonValue.trim()) {
          const lon = parseFloat(lonValue.replace(",", "."));
          if (isNaN(lon) || lon < -180 || lon > 180) {
            issues.push({
              row: rowNumber,
              field: "longitude",
              value: lonValue,
              severity: "ERROR",
              message: "Longitud inválida (debe estar entre -180 y 180)",
            });
          }
        }
      }
    }

    return issues;
  }

  /**
   * Valida código postal
   */
  private validatePostalCode(
    row: string[],
    mappingMap: Map<string, string>,
    preview: CsvPreview,
    rowNumber: number
  ): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const csvColumn = mappingMap.get("postalCode");

    if (!csvColumn) return issues;

    const columnIndex = preview.getColumnIndex(csvColumn);
    if (columnIndex === -1) return issues;

    const postalCode = row[columnIndex] || "";
    if (!postalCode.trim()) return issues;

    // Validar formato de código postal (5 dígitos)
    if (!/^\d{5}$/.test(postalCode.trim())) {
      issues.push({
        row: rowNumber,
        field: "postalCode",
        value: postalCode,
        severity: "WARNING",
        message: "Código postal debe tener 5 dígitos",
      });
    }

    return issues;
  }

  /**
   * Detecta URLs de SharePoint en campos de imagen
   */
  private detectSharePointUrls(
    rows: string[][],
    mappingMap: Map<string, string>,
    preview: CsvPreview
  ): { detected: boolean; sampleUrls: string[]; imageFields: string[] } {
    const SHAREPOINT_DOMAINS = ["sharepoint.com", "sharepoint-df.com", "microsoft.sharepoint.com"];

    const IMAGE_FIELDS = [
      "photo1Url",
      "photo2Url",
      "frontImageUrl",
      "locationImageUrl",
      "accessImageUrl",
      "signageImageUrl",
      "contextImageUrl",
      "plateImageUrl",
    ];

    const sharepointUrls = new Set<string>();
    const detectedFields = new Set<string>();

    console.log(`🔍 Detecting SharePoint URLs...`);
    console.log(`   - Rows to scan: ${Math.min(rows.length, 10)}`);
    console.log(`   - Mapped fields:`, Array.from(mappingMap.entries()));

    // Revisar solo las primeras 10 filas para detectar SharePoint
    const sampleSize = Math.min(rows.length, 10);

    for (let i = 0; i < sampleSize; i++) {
      const row = rows[i]!;

      // Revisar cada campo de imagen
      for (const imageField of IMAGE_FIELDS) {
        const csvColumn = mappingMap.get(imageField);
        if (!csvColumn) continue;

        const columnIndex = preview.getColumnIndex(csvColumn);
        if (columnIndex === -1) {
          console.log(`   ⚠️ Column not found: ${csvColumn} for field ${imageField}`);
          continue;
        }

        const value = row[columnIndex] || "";
        if (!value.trim()) continue;

        console.log(
          `   📋 Checking field ${imageField} (${csvColumn}): ${value.substring(0, 50)}...`
        );

        // Verificar si es una URL de SharePoint
        try {
          const url = new URL(value);
          const isSharePoint = SHAREPOINT_DOMAINS.some((domain) =>
            url.hostname.toLowerCase().includes(domain)
          );

          if (isSharePoint) {
            console.log(`   ✅ SharePoint URL detected in ${imageField}: ${value}`);
            sharepointUrls.add(value);
            detectedFields.add(imageField);
          }
        } catch {
          console.log(`   ❌ Invalid URL in ${imageField}: ${value}`);
          // No es una URL válida, ignorar
        }
      }

      // Si ya encontramos suficientes muestras, salir
      if (sharepointUrls.size >= 3) break;
    }

    const result = {
      detected: sharepointUrls.size > 0,
      sampleUrls: Array.from(sharepointUrls).slice(0, 3),
      imageFields: Array.from(detectedFields),
    };

    console.log(`🔍 SharePoint detection result:`, result);

    return result;
  }
}
