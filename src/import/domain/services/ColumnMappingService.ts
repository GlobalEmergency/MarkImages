/**
 * Domain Service: Servicio de mapeo de columnas
 * Orquesta la lógica de sugerencias automáticas de mapeo
 * Capa de Dominio
 */

import { ColumnMapping } from "../value-objects/ColumnMapping";
import { CsvPreview } from "../value-objects/CsvPreview";
import { FieldDefinition, getAllFields, REQUIRED_FIELDS } from "../value-objects/FieldDefinition";

export class ColumnMappingService {
  /**
   * Genera sugerencias automáticas de mapeo para todas las columnas del CSV
   * MEJORADO: Ahora pasa datos de muestra para pattern matching
   */
  suggestMappings(csvPreview: CsvPreview): ColumnMapping[] {
    const suggestions: ColumnMapping[] = [];
    const allFields = getAllFields();
    const csvHeaders = csvPreview.columnHeaders;

    // Intentar mapear cada columna del CSV con datos de muestra
    for (const csvHeader of csvHeaders) {
      // Usar el método público para obtener datos de muestra de esta columna
      const sampleData = csvPreview.getColumnSampleValues(csvHeader);

      const suggestion = ColumnMapping.autoSuggest(csvHeader, allFields, sampleData);

      if (suggestion && suggestion.isConfident()) {
        suggestions.push(suggestion);
      }
    }

    return suggestions;
  }

  /**
   * Genera sugerencias solo para campos requeridos
   * Prioriza los campos críticos
   * MEJORADO: Ahora también pasa datos de muestra
   */
  suggestRequiredMappings(csvPreview: CsvPreview): ColumnMapping[] {
    const suggestions: ColumnMapping[] = [];
    const csvHeaders = csvPreview.columnHeaders;

    // Intentar mapear solo campos requeridos con datos de muestra
    for (const csvHeader of csvHeaders) {
      const sampleData = csvPreview.getColumnSampleValues(csvHeader);
      const suggestion = ColumnMapping.autoSuggest(csvHeader, REQUIRED_FIELDS, sampleData);

      if (suggestion && suggestion.isConfident()) {
        suggestions.push(suggestion);
      }
    }

    return suggestions;
  }

  /**
   * Valida que un conjunto de mapeos cubra todos los campos requeridos
   */
  validateRequiredMappings(mappings: ColumnMapping[]): {
    isValid: boolean;
    missingFields: FieldDefinition[];
  } {
    const mappedFields = new Set(mappings.map((m) => m.systemFieldKey));
    const missingFields = REQUIRED_FIELDS.filter((field) => !mappedFields.has(field.key));

    return {
      isValid: missingFields.length === 0,
      missingFields,
    };
  }

  /**
   * Detecta mapeos duplicados (misma columna CSV mapeada a múltiples campos)
   */
  detectDuplicateMappings(mappings: ColumnMapping[]): {
    hasDuplicates: boolean;
    duplicates: Array<{ csvColumn: string; mappedTo: string[] }>;
  } {
    const csvColumnMap = new Map<string, string[]>();

    for (const mapping of mappings) {
      const existing = csvColumnMap.get(mapping.csvColumnName) || [];
      existing.push(mapping.systemFieldKey);
      csvColumnMap.set(mapping.csvColumnName, existing);
    }

    const duplicates = Array.from(csvColumnMap.entries())
      .filter(([, fields]) => fields.length > 1)
      .map(([csvColumn, mappedTo]) => ({ csvColumn, mappedTo }));

    return {
      hasDuplicates: duplicates.length > 0,
      duplicates,
    };
  }

  /**
   * Detecta campos del sistema mapeados múltiples veces (conflicto)
   */
  detectConflictingMappings(mappings: ColumnMapping[]): {
    hasConflicts: boolean;
    conflicts: Array<{ systemField: string; csvColumns: string[] }>;
  } {
    const systemFieldMap = new Map<string, string[]>();

    for (const mapping of mappings) {
      const existing = systemFieldMap.get(mapping.systemFieldKey) || [];
      existing.push(mapping.csvColumnName);
      systemFieldMap.set(mapping.systemFieldKey, existing);
    }

    const conflicts = Array.from(systemFieldMap.entries())
      .filter(([, columns]) => columns.length > 1)
      .map(([systemField, csvColumns]) => ({ systemField, csvColumns }));

    return {
      hasConflicts: conflicts.length > 0,
      conflicts,
    };
  }

  /**
   * Resuelve conflictos automáticamente eligiendo el mapeo con mayor confianza
   */
  resolveConflicts(mappings: ColumnMapping[]): ColumnMapping[] {
    const systemFieldMap = new Map<string, ColumnMapping>();

    for (const mapping of mappings) {
      const existing = systemFieldMap.get(mapping.systemFieldKey);

      if (!existing || mapping.confidenceScore > existing.confidenceScore) {
        systemFieldMap.set(mapping.systemFieldKey, mapping);
      }
    }

    return Array.from(systemFieldMap.values());
  }

  /**
   * Obtiene estadísticas del mapeo
   */
  getMappingStats(mappings: ColumnMapping[]): {
    totalMappings: number;
    requiredMapped: number;
    requiredTotal: number;
    optionalMapped: number;
    averageConfidence: number;
    highConfidenceMappings: number;
  } {
    const requiredFields = new Set(REQUIRED_FIELDS.map((f) => f.key));
    const requiredMapped = mappings.filter((m) => requiredFields.has(m.systemFieldKey)).length;
    const optionalMapped = mappings.length - requiredMapped;

    const confidenceSum = mappings.reduce((sum, m) => sum + m.confidenceScore, 0);
    const averageConfidence = mappings.length > 0 ? confidenceSum / mappings.length : 0;

    const highConfidenceMappings = mappings.filter((m) => m.isConfident()).length;

    return {
      totalMappings: mappings.length,
      requiredMapped,
      requiredTotal: REQUIRED_FIELDS.length,
      optionalMapped,
      averageConfidence,
      highConfidenceMappings,
    };
  }

  /**
   * Sugiere campos para columnas CSV no mapeadas
   */
  suggestForUnmappedColumns(
    csvHeaders: string[],
    existingMappings: ColumnMapping[]
  ): Map<string, FieldDefinition[]> {
    const mappedCsvColumns = new Set(existingMappings.map((m) => m.csvColumnName));
    const unmappedColumns = csvHeaders.filter((header) => !mappedCsvColumns.has(header));

    const suggestions = new Map<string, FieldDefinition[]>();

    for (const column of unmappedColumns) {
      const allFields = getAllFields();
      const possibleMatches: Array<{ field: FieldDefinition; score: number }> = [];

      for (const field of allFields) {
        const mapping = ColumnMapping.autoSuggest(column, [field]);
        if (mapping && mapping.confidenceScore > 0.3) {
          possibleMatches.push({
            field,
            score: mapping.confidenceScore,
          });
        }
      }

      // Ordenar por score descendente y tomar top 3
      possibleMatches.sort((a, b) => b.score - a.score);
      suggestions.set(
        column,
        possibleMatches.slice(0, 3).map((m) => m.field)
      );
    }

    return suggestions;
  }
}
