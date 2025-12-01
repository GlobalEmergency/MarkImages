/**
 * Hook para gestionar el estado y lógica del mapeo de columnas
 * Permite al usuario mapear columnas CSV a campos del sistema
 */

import { useState, useCallback, useMemo } from 'react';

import { REQUIRED_FIELDS } from '@/domain/import/value-objects/FieldDefinition';

export interface MappingState {
  csvColumn: string;
  systemField: string | null;
  confidence: number;
  isRequired: boolean;
}

export interface MappingSummary {
  totalColumns: number;
  mappedColumns: number;
  unmappedColumns: number;
  requiredMapped: number;
  requiredTotal: number;
  optionalMapped: number;
  canProceed: boolean;
  missingRequiredFields: string[];
}

export function useColumnMapping(
  csvColumns: string[],
  initialSuggestions: Array<{ csvColumn: string; systemField: string; confidence: number }> = []
) {
  // Estado: mapeos actuales
  const [mappings, setMappings] = useState<Record<string, string | null>>(() => {
    const initial: Record<string, string | null> = {};
    csvColumns.forEach((col) => {
      initial[col] = null;
    });
    
    // Aplicar sugerencias iniciales
    initialSuggestions.forEach((suggestion) => {
      if (initial[suggestion.csvColumn] !== undefined) {
        initial[suggestion.csvColumn] = suggestion.systemField;
      }
    });
    
    return initial;
  });

  // Actualizar mapeo de una columna
  const updateMapping = useCallback((csvColumn: string, systemField: string | null) => {
    setMappings((prev) => ({
      ...prev,
      [csvColumn]: systemField,
    }));
  }, []);

  // Limpiar mapeo de una columna
  const clearMapping = useCallback((csvColumn: string) => {
    setMappings((prev) => ({
      ...prev,
      [csvColumn]: null,
    }));
  }, []);

  // Limpiar todos los mapeos
  const clearAllMappings = useCallback(() => {
    const cleared: Record<string, string | null> = {};
    csvColumns.forEach((col) => {
      cleared[col] = null;
    });
    setMappings(cleared);
  }, [csvColumns]);

  // Obtener todos los campos del sistema mapeados actualmente
  const mappedSystemFields = useMemo(() => {
    return new Set(Object.values(mappings).filter((field): field is string => field !== null));
  }, [mappings]);

  // Verificar si un campo del sistema ya está mapeado
  const isFieldMapped = useCallback(
    (systemField: string) => {
      return mappedSystemFields.has(systemField);
    },
    [mappedSystemFields]
  );

  // Obtener el estado de cada mapeo
  const mappingStates = useMemo((): MappingState[] => {
    const requiredFieldKeys = new Set(REQUIRED_FIELDS.map((f) => f.key));

    return csvColumns.map((csvColumn) => {
      const systemField = mappings[csvColumn];
      const suggestion = initialSuggestions.find((s) => s.csvColumn === csvColumn);

      return {
        csvColumn,
        systemField,
        confidence: suggestion?.confidence ?? 0,
        isRequired: systemField ? requiredFieldKeys.has(systemField) : false,
      };
    });
  }, [csvColumns, mappings, initialSuggestions]);

  // Calcular resumen de mapeos
  const summary = useMemo((): MappingSummary => {
    const totalColumns = csvColumns.length;
    const mappedColumns = Object.values(mappings).filter((field) => field !== null).length;
    const unmappedColumns = totalColumns - mappedColumns;

    const requiredFieldKeys = new Set(REQUIRED_FIELDS.map((f) => f.key));
    const mappedFields = Object.values(mappings).filter((field): field is string => field !== null);

    const requiredMapped = mappedFields.filter((field) => requiredFieldKeys.has(field)).length;
    const requiredTotal = REQUIRED_FIELDS.length;
    const optionalMapped = mappedFields.filter((field) => !requiredFieldKeys.has(field)).length;

    const missingRequiredFields = REQUIRED_FIELDS.filter(
      (field) => !mappedFields.includes(field.key)
    ).map((field) => field.label);

    const canProceed = requiredMapped === requiredTotal;

    return {
      totalColumns,
      mappedColumns,
      unmappedColumns,
      requiredMapped,
      requiredTotal,
      optionalMapped,
      canProceed,
      missingRequiredFields,
    };
  }, [csvColumns, mappings]);

  // Obtener mapeos en formato para enviar al backend
  const getMappingsForSubmit = useCallback(() => {
    return Object.entries(mappings)
      .filter(([, systemField]) => systemField !== null)
      .map(([csvColumn, systemField]) => ({
        csvColumn,
        systemField: systemField!,
        confidence: initialSuggestions.find((s) => s.csvColumn === csvColumn)?.confidence ?? 1.0,
      }));
  }, [mappings, initialSuggestions]);

  return {
    mappings,
    mappingStates,
    summary,
    updateMapping,
    clearMapping,
    clearAllMappings,
    isFieldMapped,
    getMappingsForSubmit,
  };
}
