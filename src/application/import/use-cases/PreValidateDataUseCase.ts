/**
 * Use Case: Pre-validar datos del CSV
 * Valida los datos antes de la importación usando los mapeos configurados
 * Capa de Aplicación
 */

import { PrismaClient } from '@prisma/client';

import { mapDistrictNameToId } from '@/domain/import/constants/DistrictMapping';
import { CsvRowMapper } from '@/domain/import/services/CsvRowMapper';
import { ColumnMapping } from '@/domain/import/value-objects/ColumnMapping';
import { CsvPreview } from '@/domain/import/value-objects/CsvPreview';
import { ValidationIssue, ValidationResult } from '@/domain/import/value-objects/ValidationResult';

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
}

export class PreValidateDataUseCase {
  private readonly prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

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

      const issues: ValidationIssue[] = [];

      // Validar cada fila
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]!;
        const rowNumber = i + 2; // +2 porque 1-based y saltamos header

        // Validar campos requeridos
        const requiredIssues = this.validateRequiredFields(
          row,
          mappingMap,
          preview,
          rowNumber
        );
        issues.push(...requiredIssues);

        // Validar distrito
        const districtIssues = await this.validateDistrict(row, mappingMap, preview, rowNumber);
        issues.push(...districtIssues);

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
      };
    } catch (error) {
      console.error('Error during pre-validation:', error);

      // Retornar error crítico
      const criticalIssue: ValidationIssue = {
        row: 0,
        field: 'system',
        value: '',
        severity: 'CRITICAL',
        message:
          error instanceof Error ? error.message : 'Error crítico durante la validación',
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
    } finally {
      await this.prisma.$disconnect();
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
    const fs = await import('fs/promises');
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n').filter((line) => line.trim());

    // Saltar header y tomar hasta maxRows
    const dataLines = lines.slice(1, Math.min(lines.length, maxRows + 1));

    return dataLines.map((line) => this.parseRow(line, delimiter));
  }

  /**
   * Parsea una línea del CSV
   */
  private parseRow(line: string, delimiter: string): string[] {
    const result: string[] = [];
    let current = '';
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
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current.trim());
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
        rawData[csvColumn] = row[columnIndex] || '';
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
        field: 'system',
        value: '',
        severity: 'ERROR',
        message: 'Missing minimum required fields (proposedName, streetName, streetNumber)',
      });
    }

    return issues;
  }

  /**
   * Valida que el distrito exista en la base de datos
   * Nota: El distrito es OPCIONAL, solo se valida si está presente
   */
  private async validateDistrict(
    row: string[],
    mappingMap: Map<string, string>,
    preview: CsvPreview,
    rowNumber: number
  ): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];
    const csvColumn = mappingMap.get('district');

    // Si no está mapeado, no validar (es opcional)
    if (!csvColumn) return issues;

    const columnIndex = preview.getColumnIndex(csvColumn);
    if (columnIndex === -1) return issues;

    const districtValue = row[columnIndex] || '';
    
    // Si está vacío, no es un error (es opcional)
    if (!districtValue.trim()) return issues;

    // Si hay valor, validarlo
    const districtId = mapDistrictNameToId(districtValue);

    if (districtId === null) {
      issues.push({
        row: rowNumber,
        field: 'district',
        value: districtValue,
        severity: 'WARNING', // Cambiar a WARNING porque es opcional
        message: `Distrito "${districtValue}" no encontrado en el sistema`,
        suggestion: 'Verifica el nombre del distrito. Formatos válidos: "Centro", "1. Centro", etc.',
      });
    } else {
      // Verificar que el distrito exista en BD
      const districtExists = await this.prisma.district.findFirst({
        where: { id: districtId },
      });

      if (!districtExists) {
        issues.push({
          row: rowNumber,
          field: 'district',
          value: districtValue,
          severity: 'WARNING', // Cambiar a WARNING porque es opcional
          message: `Distrito con ID ${districtId} no existe en la base de datos`,
        });
      }
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
    const latColumn = mappingMap.get('latitude');
    if (latColumn) {
      const latIndex = preview.getColumnIndex(latColumn);
      if (latIndex !== -1) {
        const latValue = row[latIndex] || '';
        if (latValue.trim()) {
          const lat = parseFloat(latValue.replace(',', '.'));
          if (isNaN(lat) || lat < -90 || lat > 90) {
            issues.push({
              row: rowNumber,
              field: 'latitude',
              value: latValue,
              severity: 'ERROR',
              message: 'Latitud inválida (debe estar entre -90 y 90)',
            });
          }
        }
      }
    }

    // Validar longitud
    const lonColumn = mappingMap.get('longitude');
    if (lonColumn) {
      const lonIndex = preview.getColumnIndex(lonColumn);
      if (lonIndex !== -1) {
        const lonValue = row[lonIndex] || '';
        if (lonValue.trim()) {
          const lon = parseFloat(lonValue.replace(',', '.'));
          if (isNaN(lon) || lon < -180 || lon > 180) {
            issues.push({
              row: rowNumber,
              field: 'longitude',
              value: lonValue,
              severity: 'ERROR',
              message: 'Longitud inválida (debe estar entre -180 y 180)',
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
    const csvColumn = mappingMap.get('postalCode');

    if (!csvColumn) return issues;

    const columnIndex = preview.getColumnIndex(csvColumn);
    if (columnIndex === -1) return issues;

    const postalCode = row[columnIndex] || '';
    if (!postalCode.trim()) return issues;

    // Validar formato de código postal (5 dígitos)
    if (!/^\d{5}$/.test(postalCode.trim())) {
      issues.push({
        row: rowNumber,
        field: 'postalCode',
        value: postalCode,
        severity: 'WARNING',
        message: 'Código postal debe tener 5 dígitos',
      });
    }

    return issues;
  }
}
