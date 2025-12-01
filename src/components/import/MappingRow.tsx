/**
 * Componente de fila individual de mapeo
 * Representa el mapeo de una columna CSV a un campo del sistema
 */

'use client';

import { CheckCircle, AlertTriangle, X, ChevronDown } from 'lucide-react';
import { useState } from 'react';

import { getAllFields, getFieldByKey } from '@/domain/import/value-objects/FieldDefinition';

interface MappingRowProps {
  csvColumn: string;
  systemField: string | null;
  confidence: number;
  sampleData: string[];
  isRequired: boolean;
  onUpdate: (systemField: string | null) => void;
  isFieldMapped: (fieldKey: string) => boolean;
}

export default function MappingRow({
  csvColumn,
  systemField,
  confidence,
  sampleData,
  isRequired,
  onUpdate,
  isFieldMapped,
}: MappingRowProps) {
  const [isOpen, setIsOpen] = useState(false);
  const allFields = getAllFields();
  const selectedField = systemField ? getFieldByKey(systemField) : null;

  // Determinar color y estilo según estado
  const getStatusStyle = () => {
    if (!systemField) {
      return {
        border: 'border-gray-300',
        bg: 'bg-white',
        icon: <div className="w-5 h-5 rounded-full border-2 border-gray-300" />,
      };
    }

    if (isRequired) {
      return {
        border: 'border-green-300',
        bg: 'bg-green-50',
        icon: <CheckCircle className="w-5 h-5 text-green-600" />,
      };
    }

    if (confidence > 0 && confidence < 0.7) {
      return {
        border: 'border-amber-300',
        bg: 'bg-amber-50',
        icon: <AlertTriangle className="w-5 h-5 text-amber-600" />,
      };
    }

    return {
      border: 'border-blue-300',
      bg: 'bg-blue-50',
      icon: <CheckCircle className="w-5 h-5 text-blue-600" />,
    };
  };

  const status = getStatusStyle();

  return (
    <div className={`border rounded-lg ${status.border} ${status.bg} transition-all`}>
      {/* Header de la fila */}
      <div className="p-3 sm:p-4">
        <div className="flex items-start space-x-3">
          {/* Icono de estado */}
          <div className="flex-shrink-0 mt-1">{status.icon}</div>

          {/* Contenido principal */}
          <div className="flex-1 min-w-0">
            {/* Nombre de la columna CSV */}
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-gray-900 truncate">{csvColumn}</h4>
              {confidence > 0 && systemField && (
                <span className="text-xs font-medium text-gray-500 ml-2">
                  {Math.round(confidence * 100)}%
                </span>
              )}
            </div>

            {/* Vista previa de datos */}
            <div className="mb-3">
              <p className="text-xs text-gray-500 mb-1">Vista previa:</p>
              <div className="flex flex-wrap gap-1">
                {sampleData.slice(0, 3).map((value, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-1 bg-white rounded text-xs text-gray-700 border border-gray-200"
                  >
                    {value || '(vacío)'}
                  </span>
                ))}
              </div>
            </div>

            {/* Selector de campo */}
            <div className="relative">
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between px-3 py-2 bg-white border border-gray-300 rounded-lg hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              >
                <span className="text-sm truncate">
                  {selectedField ? (
                    <span>
                      <span className="font-medium">{selectedField.label}</span>
                      {selectedField.required && (
                        <span className="ml-1 text-red-600">*</span>
                      )}
                    </span>
                  ) : (
                    <span className="text-gray-400">Seleccionar campo...</span>
                  )}
                </span>
                <div className="flex items-center space-x-2">
                  {systemField && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdate(null);
                      }}
                      className="p-1 hover:bg-gray-100 rounded transition-colors"
                      title="Limpiar mapeo"
                    >
                      <X className="w-4 h-4 text-gray-500" />
                    </button>
                  )}
                  <ChevronDown
                    className={`w-4 h-4 text-gray-500 transition-transform ${
                      isOpen ? 'transform rotate-180' : ''
                    }`}
                  />
                </div>
              </button>

              {/* Dropdown de opciones */}
              {isOpen && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  <div className="p-2 space-y-1">
                    {/* Campos requeridos primero */}
                    <div className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Campos requeridos
                    </div>
                    {allFields
                      .filter((field) => field.required)
                      .map((field) => {
                        const isMapped = isFieldMapped(field.key);
                        const isSelected = systemField === field.key;

                        return (
                          <button
                            key={field.key}
                            onClick={() => {
                              if (!isMapped || isSelected) {
                                onUpdate(isSelected ? null : field.key);
                                setIsOpen(false);
                              }
                            }}
                            disabled={isMapped && !isSelected}
                            className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                              isSelected
                                ? 'bg-blue-100 text-blue-900 font-medium'
                                : isMapped
                                  ? 'text-gray-400 cursor-not-allowed'
                                  : 'hover:bg-gray-100 text-gray-700'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span>{field.label}</span>
                              {isMapped && !isSelected && (
                                <span className="text-xs">(ya mapeado)</span>
                              )}
                            </div>
                            {field.description && (
                              <p className="text-xs text-gray-500 mt-0.5">
                                {field.description}
                              </p>
                            )}
                          </button>
                        );
                      })}

                    {/* Campos opcionales */}
                    <div className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wide mt-2">
                      Campos opcionales
                    </div>
                    {allFields
                      .filter((field) => !field.required)
                      .map((field) => {
                        const isMapped = isFieldMapped(field.key);
                        const isSelected = systemField === field.key;

                        return (
                          <button
                            key={field.key}
                            onClick={() => {
                              if (!isMapped || isSelected) {
                                onUpdate(isSelected ? null : field.key);
                                setIsOpen(false);
                              }
                            }}
                            disabled={isMapped && !isSelected}
                            className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                              isSelected
                                ? 'bg-blue-100 text-blue-900 font-medium'
                                : isMapped
                                  ? 'text-gray-400 cursor-not-allowed'
                                  : 'hover:bg-gray-100 text-gray-700'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span>{field.label}</span>
                              {isMapped && !isSelected && (
                                <span className="text-xs">(ya mapeado)</span>
                              )}
                            </div>
                            {field.description && (
                              <p className="text-xs text-gray-500 mt-0.5">
                                {field.description}
                              </p>
                            )}
                          </button>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
