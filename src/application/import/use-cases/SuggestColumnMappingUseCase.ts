/**
 * Use Case: Sugerir mapeo de columnas
 * Genera sugerencias automáticas de mapeo basadas en nombres de columnas
 * Capa de Aplicación
 */

import { ColumnMappingService } from '@/domain/import/services/ColumnMappingService';
import { ColumnMapping } from '@/domain/import/value-objects/ColumnMapping';
import { CsvPreview } from '@/domain/import/value-objects/CsvPreview';

export interface SuggestColumnMappingRequest {
  preview: CsvPreview;
  prioritizeRequired?: boolean;
}

export interface SuggestColumnMappingResponse {
  suggestions: ColumnMapping[];
  stats: {
    totalSuggestions: number;
    requiredMapped: number;
    requiredTotal: number;
    averageConfidence: number;
  };
  unmappedColumns: string[];
  missingRequiredFields: string[];
}

export class SuggestColumnMappingUseCase {
  private readonly mappingService: ColumnMappingService;

  constructor() {
    this.mappingService = new ColumnMappingService();
  }

  /**
   * Ejecuta la sugerencia de mapeos
   */
  execute(request: SuggestColumnMappingRequest): SuggestColumnMappingResponse {
    const { preview, prioritizeRequired = true } = request;

    // Generar sugerencias
    const suggestions = prioritizeRequired
      ? this.mappingService.suggestRequiredMappings(preview)
      : this.mappingService.suggestMappings(preview);

    // Resolver conflictos (si una columna sugiere múltiples campos, elegir el mejor)
    const resolvedSuggestions = this.mappingService.resolveConflicts(suggestions);

    // Obtener estadísticas
    const stats = this.mappingService.getMappingStats(resolvedSuggestions);

    // Validar campos requeridos
    const validation = this.mappingService.validateRequiredMappings(resolvedSuggestions);

    // Identificar columnas no mapeadas
    const mappedCsvColumns = new Set(resolvedSuggestions.map((s) => s.csvColumnName));
    const unmappedColumns = preview.columnHeaders.filter(
      (header) => !mappedCsvColumns.has(header)
    );

    return {
      suggestions: resolvedSuggestions,
      stats: {
        totalSuggestions: resolvedSuggestions.length,
        requiredMapped: stats.requiredMapped,
        requiredTotal: stats.requiredTotal,
        averageConfidence: stats.averageConfidence,
      },
      unmappedColumns,
      missingRequiredFields: validation.missingFields.map((f) => f.key),
    };
  }
}
