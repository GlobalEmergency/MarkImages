/**
 * Editor visual de mapeo de columnas CSV a campos del sistema
 * Permite al usuario configurar el mapeo de forma interactiva
 */

"use client";

import { Search, RotateCcw } from "lucide-react";
import { useState, useMemo, useCallback } from "react";

import { useColumnMapping } from "@/hooks/useColumnMapping";

import MappingRow from "./MappingRow";
import MappingSummary from "./MappingSummary";

interface ColumnMappingEditorProps {
  preview: {
    headers: string[];
    rows: string[][];
    totalRows: number;
  };
  suggestions: Array<{
    csvColumn: string;
    systemField: string;
    confidence: number;
  }>;
  initialMappings?: Array<{
    csvColumn: string;
    systemField: string;
    confidence: number;
  }>;
  onMappingsConfirmed: (
    mappings: Array<{ csvColumn: string; systemField: string; confidence: number }>
  ) => void;
}

export default function ColumnMappingEditor({
  preview,
  suggestions,
  initialMappings,
  onMappingsConfirmed,
}: ColumnMappingEditorProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const {
    mappingStates,
    summary,
    updateMapping,
    clearAllMappings,
    isFieldMapped,
    getMappingsForSubmit,
  } = useColumnMapping(preview.headers, initialMappings || suggestions);

  // Obtener datos de muestra para cada columna
  const getSampleDataForColumn = useCallback(
    (csvColumn: string): string[] => {
      if (!preview.headers || !preview.rows) return [];

      const columnIndex = preview.headers.indexOf(csvColumn);
      if (columnIndex === -1) return [];

      return preview.rows.slice(0, 3).map((row) => {
        if (!row || !Array.isArray(row)) return "";
        const value = row[columnIndex];
        return value?.toString().trim() || "";
      });
    },
    [preview.headers, preview.rows]
  );

  // Filtrar columnas según término de búsqueda
  // 🔧 MEJORADO: También filtra columnas completamente vacías
  const filteredMappingStates = useMemo(() => {
    // Primero filtrar columnas vacías
    const nonEmptyStates = mappingStates.filter((state) => {
      const sampleData = getSampleDataForColumn(state.csvColumn);
      const hasData = sampleData.some((value) => value.trim().length > 0);
      return hasData || state.csvColumn.trim().length > 0; // Mantener si tiene nombre aunque datos vacíos
    });

    // Luego aplicar filtro de búsqueda
    if (!searchTerm.trim()) return nonEmptyStates;

    const term = searchTerm.toLowerCase();
    return nonEmptyStates.filter((state) => state.csvColumn.toLowerCase().includes(term));
  }, [mappingStates, searchTerm, getSampleDataForColumn]);

  const handleConfirm = () => {
    const mappings = getMappingsForSubmit();
    onMappingsConfirmed(mappings);
  };

  return (
    <div className="space-y-6">
      {/* Resumen del estado */}
      <MappingSummary summary={summary} />

      {/* Barra de herramientas */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        {/* Búsqueda */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar columna..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Botón de limpiar */}
        <button
          onClick={clearAllMappings}
          className="flex items-center justify-center space-x-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          <span className="text-sm font-medium">Limpiar todo</span>
        </button>
      </div>

      {/* Lista de mapeos */}
      <div className="space-y-3">
        {filteredMappingStates.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
            <Search className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600">No se encontraron columnas que coincidan</p>
            <p className="text-sm text-gray-500 mt-1">Intenta con otro término de búsqueda</p>
          </div>
        ) : (
          filteredMappingStates.map((state) => (
            <MappingRow
              key={state.csvColumn}
              csvColumn={state.csvColumn}
              systemField={state.systemField}
              confidence={state.confidence}
              sampleData={getSampleDataForColumn(state.csvColumn)}
              isRequired={state.isRequired}
              onUpdate={(field) => updateMapping(state.csvColumn, field)}
              isFieldMapped={isFieldMapped}
            />
          ))
        )}
      </div>

      {/* Info adicional */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start space-x-2">
          <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
            <span className="text-white text-xs font-bold">i</span>
          </div>
          <div className="flex-1">
            <h4 className="font-medium text-blue-900 mb-1">Sugerencias automáticas</h4>
            <p className="text-sm text-blue-800">
              El sistema ha analizado las columnas de tu CSV y ha sugerido mapeos automáticos
              basándose en la similitud de nombres. Revisa y ajusta los mapeos según sea necesario.
            </p>
            <p className="text-sm text-blue-800 mt-2">
              Los campos marcados con <span className="text-red-600 font-bold">*</span> son
              obligatorios.
            </p>
          </div>
        </div>
      </div>

      {/* Botón de continuar */}
      <div className="flex justify-end pt-4 border-t">
        <button
          onClick={handleConfirm}
          disabled={!summary.canProceed}
          className={`px-6 py-3 rounded-lg font-medium transition-all ${
            summary.canProceed
              ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg hover:shadow-xl hover:scale-105 active:scale-95"
              : "bg-gray-300 text-gray-500 cursor-not-allowed"
          }`}
        >
          {summary.canProceed
            ? "Continuar con validación →"
            : `Mapea los ${summary.requiredTotal - summary.requiredMapped} campos faltantes`}
        </button>
      </div>
    </div>
  );
}
