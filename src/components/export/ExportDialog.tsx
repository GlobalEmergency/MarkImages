/**
 * Diálogo para crear una nueva exportación con filtros
 */

"use client";

import { useState } from "react";
import { X, Download, Loader2 } from "lucide-react";

import { ExportFilters } from "@/export/domain/ports/IExportRepository";
import { AED_STATUS_OPTIONS } from "@/lib/aed-status-config";

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (name: string, filters: ExportFilters) => Promise<void>;
}

export default function ExportDialog({ isOpen, onClose, onExport }: ExportDialogProps) {
  const [name, setName] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string[]>([]);
  const [sourceOrigin, setSourceOrigin] = useState("");
  const [cityName, setCityName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const statusOptions = AED_STATUS_OPTIONS;

  const sourceOriginOptions = [
    { value: "", label: "Todos los orígenes" },
    { value: "WEB_FORM", label: "Formulario web" },
    { value: "ADMIN_FORM", label: "Formulario admin" },
    { value: "CSV_IMPORT", label: "Importación CSV" },
    { value: "EXCEL_IMPORT", label: "Importación Excel" },
    { value: "EXTERNAL_API", label: "API externa" },
  ];

  const handleToggleStatus = (status: string) => {
    setSelectedStatus((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );
  };

  const handleExport = async () => {
    try {
      setError(null);
      setLoading(true);

      const filters: ExportFilters = {};

      if (selectedStatus.length > 0) {
        filters.status = selectedStatus;
      }

      if (sourceOrigin) {
        filters.sourceOrigin = sourceOrigin;
      }

      if (cityName.trim()) {
        filters.cityName = cityName.trim();
      }

      await onExport(name || "Exportación de DEAs", filters);

      // Reset form
      setName("");
      setSelectedStatus([]);
      setSourceOrigin("");
      setCityName("");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear exportación");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div
        className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Download className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Nueva Exportación</h2>
              <p className="text-sm text-gray-500">Configura los filtros para la exportación CSV</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            disabled={loading}
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Error message */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Nombre de la exportación */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nombre de la exportación (opcional)
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Exportación DEAs Madrid"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              disabled={loading}
            />
          </div>

          {/* Filtro por estado */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Estado de los DEAs
            </label>
            <div className="grid grid-cols-2 gap-2">
              {statusOptions.map((option) => (
                <label
                  key={option.value}
                  className={`flex items-center space-x-2 px-4 py-2 border rounded-lg cursor-pointer transition-all ${
                    selectedStatus.includes(option.value)
                      ? "bg-green-50 border-green-500 text-green-700"
                      : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedStatus.includes(option.value)}
                    onChange={() => handleToggleStatus(option.value)}
                    className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                    disabled={loading}
                  />
                  <span className="text-sm font-medium">{option.label}</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {selectedStatus.length === 0
                ? "Se exportarán DEAs de todos los estados"
                : `Se exportarán DEAs con estado: ${selectedStatus.map((s) => statusOptions.find((o) => o.value === s)?.label).join(", ")}`}
            </p>
          </div>

          {/* Filtro por origen */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Origen de los datos
            </label>
            <select
              value={sourceOrigin}
              onChange={(e) => setSourceOrigin(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              disabled={loading}
            >
              {sourceOriginOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro por ciudad */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Ciudad</label>
            <input
              type="text"
              value={cityName}
              onChange={(e) => setCityName(e.target.value)}
              placeholder="Ej: Madrid, Barcelona..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              disabled={loading}
            />
            <p className="text-xs text-gray-500 mt-1">Filtra los DEAs por nombre de ciudad</p>
          </div>

          {/* Info box */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Información:</strong> La exportación se procesa en segundo plano. Podrás ver
              el progreso y descargar el archivo CSV cuando termine.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 flex items-center justify-end space-x-3 bg-gray-50">
          <button
            onClick={onClose}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors font-medium"
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            onClick={handleExport}
            disabled={loading}
            className="px-6 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:shadow-lg transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Exportando...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Crear Exportación</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
