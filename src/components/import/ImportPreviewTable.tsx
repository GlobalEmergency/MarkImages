/**
 * ImportPreviewTable: Muestra preview de registros validados
 * Permite ver cómo quedarán los datos antes de importar
 */

"use client";

import { useState } from "react";
import { CheckCircle, XCircle, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";

interface PreviewRecord {
  rowNumber: number;
  status: "valid" | "invalid" | "skipped";
  mappedData: Record<string, unknown>;
  originalData: Record<string, unknown>;
  errors?: Array<{
    field?: string;
    message: string;
  }>;
}

interface ImportPreviewTableProps {
  previewRecords?: PreviewRecord[];
}

export default function ImportPreviewTable({ previewRecords }: ImportPreviewTableProps) {
  const [activeTab, setActiveTab] = useState<"valid" | "invalid" | "skipped">("valid");
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  if (!previewRecords || previewRecords.length === 0) {
    return null;
  }

  // Filtrar registros por estado
  const validRecords = previewRecords.filter((r) => r.status === "valid");
  const invalidRecords = previewRecords.filter((r) => r.status === "invalid");
  const skippedRecords = previewRecords.filter((r) => r.status === "skipped");

  const toggleRow = (rowNumber: number) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(rowNumber)) {
      newExpanded.delete(rowNumber);
    } else {
      newExpanded.add(rowNumber);
    }
    setExpandedRows(newExpanded);
  };

  const renderRecordCard = (record: PreviewRecord) => {
    const isExpanded = expandedRows.has(record.rowNumber);
    const data = record.mappedData;

    return (
      <div key={record.rowNumber} className="border rounded-lg overflow-hidden mb-3">
        {/* Header */}
        <div
          onClick={() => toggleRow(record.rowNumber)}
          className={`p-4 cursor-pointer transition-colors ${
            record.status === "valid"
              ? "bg-green-50 hover:bg-green-100"
              : record.status === "invalid"
                ? "bg-red-50 hover:bg-red-100"
                : "bg-blue-50 hover:bg-blue-100"
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-1">
                {record.status === "valid" && <CheckCircle className="w-5 h-5 text-green-600" />}
                {record.status === "invalid" && <XCircle className="w-5 h-5 text-red-600" />}
                {record.status === "skipped" && <AlertCircle className="w-5 h-5 text-blue-600" />}
                <span className="font-semibold text-gray-900">Fila {record.rowNumber}</span>
              </div>
              <div className="text-sm text-gray-700 font-medium">
                {String(data.proposedName || "Sin nombre")}
              </div>
              {data.streetName !== undefined &&
                data.streetName !== null &&
                data.streetName !== "" && (
                  <div className="text-sm text-gray-600">
                    {String(data.streetType || "")} {String(data.streetName)}{" "}
                    {String(data.streetNumber || "")}
                  </div>
                )}
            </div>
            {isExpanded ? (
              <ChevronUp className="w-5 h-5 text-gray-400 flex-shrink-0" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
            )}
          </div>
        </div>

        {/* Detalles expandibles */}
        {isExpanded && (
          <div className="p-4 bg-white border-t">
            {/* Errores si existen */}
            {record.errors && record.errors.length > 0 && (
              <div className="mb-4 p-3 bg-red-50 rounded-lg">
                <h5 className="font-semibold text-red-900 mb-2 text-sm">Errores:</h5>
                <ul className="space-y-1">
                  {record.errors.map((error, idx) => (
                    <li key={idx} className="text-sm text-red-700">
                      • {error.field ? `${error.field}: ` : ""}
                      {error.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Datos mapeados */}
            <div className="space-y-2">
              <h5 className="font-semibold text-gray-900 text-sm mb-2">Datos mapeados:</h5>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                {Object.entries(data).map(([key, value]) => {
                  if (value === undefined || value === null || value === "") return null;
                  return (
                    <div key={key} className="flex flex-col">
                      <span className="text-gray-500 text-xs">{key}:</span>
                      <span className="text-gray-900 font-medium break-words">{String(value)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const currentRecords =
    activeTab === "valid"
      ? validRecords
      : activeTab === "invalid"
        ? invalidRecords
        : skippedRecords;

  return (
    <div className="mt-6 border rounded-lg overflow-hidden bg-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-4">
        <h3 className="text-lg font-bold text-white flex items-center space-x-2">
          <span>👁️</span>
          <span>Preview de Registros</span>
        </h3>
        <p className="text-sm text-blue-100 mt-1">
          Muestra de cómo quedarán los datos después de la importación
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b bg-gray-50">
        <button
          onClick={() => setActiveTab("valid")}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === "valid"
              ? "bg-white border-b-2 border-green-500 text-green-700"
              : "text-gray-600 hover:text-gray-800"
          }`}
        >
          <div className="flex items-center justify-center space-x-2">
            <CheckCircle className="w-4 h-4" />
            <span>Válidos ({validRecords.length})</span>
          </div>
        </button>

        {invalidRecords.length > 0 && (
          <button
            onClick={() => setActiveTab("invalid")}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === "invalid"
                ? "bg-white border-b-2 border-red-500 text-red-700"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            <div className="flex items-center justify-center space-x-2">
              <XCircle className="w-4 h-4" />
              <span>Inválidos ({invalidRecords.length})</span>
            </div>
          </button>
        )}

        {skippedRecords.length > 0 && (
          <button
            onClick={() => setActiveTab("skipped")}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === "skipped"
                ? "bg-white border-b-2 border-blue-500 text-blue-700"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            <div className="flex items-center justify-center space-x-2">
              <AlertCircle className="w-4 h-4" />
              <span>Omitidos ({skippedRecords.length})</span>
            </div>
          </button>
        )}
      </div>

      {/* Content */}
      <div className="p-4 max-h-96 overflow-y-auto">
        {currentRecords.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No hay registros{" "}
            {activeTab === "valid" ? "válidos" : activeTab === "invalid" ? "inválidos" : "omitidos"}{" "}
            para mostrar
          </div>
        ) : (
          <div>{currentRecords.map(renderRecordCard)}</div>
        )}
      </div>

      {/* Footer */}
      <div className="bg-gray-50 px-4 py-3 border-t text-sm text-gray-600 text-center">
        Haz clic en cada registro para ver todos los detalles
      </div>
    </div>
  );
}
