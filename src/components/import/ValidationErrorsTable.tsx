/**
 * ValidationErrorsTable: Muestra errores de validación de forma detallada
 * Con filtros, búsqueda y sugerencias de corrección
 */

"use client";

import { useState, useMemo } from "react";
import { AlertCircle, AlertTriangle, Info, Lightbulb, Search, Filter } from "lucide-react";

interface ValidationError {
  row: number;
  field?: string;
  csvColumn?: string;
  value?: string;
  errorType: string;
  message: string;
  suggestion?: string;
  severity: "info" | "warning" | "error" | "critical";
}

interface ValidationErrorsTableProps {
  errors: ValidationError[];
  errorSummary?: {
    byType: Record<string, number>;
    byField: Record<string, number>;
    total: number;
  };
}

export default function ValidationErrorsTable({
  errors,
  errorSummary,
}: ValidationErrorsTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedField, setSelectedField] = useState<string>("all");
  const [selectedSeverity, setSelectedSeverity] = useState<string>("all");

  // Filtrar errores
  const filteredErrors = useMemo(() => {
    return errors.filter((error) => {
      // Filtro de búsqueda
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const matchesSearch =
          error.message.toLowerCase().includes(search) ||
          error.field?.toLowerCase().includes(search) ||
          error.csvColumn?.toLowerCase().includes(search) ||
          error.value?.toLowerCase().includes(search) ||
          error.row.toString().includes(search);

        if (!matchesSearch) return false;
      }

      // Filtro de tipo
      if (selectedType !== "all" && error.errorType !== selectedType) {
        return false;
      }

      // Filtro de campo
      if (selectedField !== "all" && error.field !== selectedField) {
        return false;
      }

      // Filtro de severidad
      if (selectedSeverity !== "all" && error.severity !== selectedSeverity) {
        return false;
      }

      return true;
    });
  }, [errors, searchTerm, selectedType, selectedField, selectedSeverity]);

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "critical":
      case "error":
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case "warning":
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case "info":
        return <Info className="w-5 h-5 text-blue-500" />;
      default:
        return <AlertCircle className="w-5 h-5 text-gray-500" />;
    }
  };

  const getErrorTypeBadgeColor = (errorType: string) => {
    switch (errorType) {
      case "MISSING_DATA":
        return "bg-orange-100 text-orange-800 border-orange-200";
      case "INVALID_COORDINATE":
        return "bg-purple-100 text-purple-800 border-purple-200";
      case "INVALID_POSTAL_CODE":
        return "bg-pink-100 text-pink-800 border-pink-200";
      case "PROCESSING_ERROR":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  return (
    <div className="space-y-4">
      {/* Resumen de errores */}
      {errorSummary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="text-2xl font-bold text-red-900">{errorSummary.total}</div>
            <div className="text-sm text-red-700">Errores totales</div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="text-2xl font-bold text-blue-900">
              {Object.keys(errorSummary.byType).length}
            </div>
            <div className="text-sm text-blue-700">Tipos de error</div>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="text-2xl font-bold text-purple-900">
              {Object.keys(errorSummary.byField).length}
            </div>
            <div className="text-sm text-purple-700">Campos afectados</div>
          </div>
        </div>
      )}

      {/* Filtros y búsqueda */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Búsqueda */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Filtro por tipo */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
            >
              <option value="all">Todos los tipos</option>
              {errorSummary &&
                Object.entries(errorSummary.byType).map(([type, count]) => (
                  <option key={type} value={type}>
                    {type} ({count})
                  </option>
                ))}
            </select>
          </div>

          {/* Filtro por campo */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <select
              value={selectedField}
              onChange={(e) => setSelectedField(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
            >
              <option value="all">Todos los campos</option>
              {errorSummary &&
                Object.entries(errorSummary.byField).map(([field, count]) => (
                  <option key={field} value={field}>
                    {field} ({count})
                  </option>
                ))}
            </select>
          </div>

          {/* Filtro por severidad */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <select
              value={selectedSeverity}
              onChange={(e) => setSelectedSeverity(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
            >
              <option value="all">Todas las severidades</option>
              <option value="critical">Crítico</option>
              <option value="error">Error</option>
              <option value="warning">Advertencia</option>
              <option value="info">Información</option>
            </select>
          </div>
        </div>

        <div className="mt-3 text-sm text-gray-600">
          Mostrando {filteredErrors.length} de {errors.length} errores
        </div>
      </div>

      {/* Tabla de errores */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="max-h-[500px] overflow-y-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fila
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tipo
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Campo
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Valor
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Error
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredErrors.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    No se encontraron errores con los filtros seleccionados
                  </td>
                </tr>
              ) : (
                filteredErrors.map((error, index) => (
                  <tr key={index} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        {getSeverityIcon(error.severity)}
                        <span className="font-mono text-sm font-medium text-gray-900">
                          {error.row}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getErrorTypeBadgeColor(error.errorType)}`}
                      >
                        {error.errorType}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm">
                        <div className="font-medium text-gray-900">{error.field || "-"}</div>
                        {error.csvColumn && (
                          <div className="text-xs text-gray-500">CSV: {error.csvColumn}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="max-w-xs truncate text-sm text-gray-900 font-mono">
                        {error.value ? `"${error.value}"` : <span className="text-gray-400">vacío</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        <div className="text-sm text-gray-900">{error.message}</div>
                        {error.suggestion && (
                          <div className="flex items-start space-x-2 bg-blue-50 border border-blue-200 rounded p-2 mt-2">
                            <Lightbulb className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                            <div className="text-xs text-blue-800">{error.suggestion}</div>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Leyenda de severidades */}
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <span className="text-gray-600 font-medium">Severidad:</span>
        <div className="flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 text-red-500" />
          <span className="text-gray-600">Crítico/Error</span>
        </div>
        <div className="flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 text-yellow-500" />
          <span className="text-gray-600">Advertencia</span>
        </div>
        <div className="flex items-center space-x-2">
          <Info className="w-4 h-4 text-blue-500" />
          <span className="text-gray-600">Información</span>
        </div>
      </div>
    </div>
  );
}
