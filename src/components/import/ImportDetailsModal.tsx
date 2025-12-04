/**
 * Modal que muestra detalles completos de una importación
 */

"use client";

import {
  X,
  Loader2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Info,
  Clock,
  Download,
  Ban,
} from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";

import { useCancelImport } from "@/hooks/useCancelImport";
import { useImportDetails } from "@/hooks/useImportDetails";
import type { ErrorSeverity } from "@/types/import";

import ImportProgressBar from "./ImportProgressBar";
import ImportStatusBadge from "./ImportStatusBadge";

interface ImportDetailsModalProps {
  batchId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

const severityConfig: Record<ErrorSeverity, { icon: typeof Info; color: string; label: string }> = {
  INFO: {
    icon: Info,
    color: "text-blue-600 bg-blue-50",
    label: "Info",
  },
  WARNING: {
    icon: AlertTriangle,
    color: "text-yellow-600 bg-yellow-50",
    label: "Advertencia",
  },
  ERROR: {
    icon: XCircle,
    color: "text-red-600 bg-red-50",
    label: "Error",
  },
  CRITICAL: {
    icon: AlertTriangle,
    color: "text-purple-600 bg-purple-50",
    label: "Crítico",
  },
};

export default function ImportDetailsModal({ batchId, isOpen, onClose }: ImportDetailsModalProps) {
  const { batch, errors, loading, error: loadError } = useImportDetails(batchId);
  const { cancelImport, cancelling } = useCancelImport();
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  // Determinar si se puede cancelar
  const canCancel =
    batch?.batch.status &&
    ["IN_PROGRESS", "PENDING", "INTERRUPTED", "RESUMING"].includes(batch.batch.status);

  // Manejar cancelación
  const handleCancelClick = () => {
    setShowCancelConfirm(true);
  };

  const handleConfirmCancel = async () => {
    if (!batchId) return;

    const result = await cancelImport(batchId);
    setShowCancelConfirm(false);

    if (result.success) {
      // Cerrar modal y refrescar la lista
      setTimeout(() => {
        onClose();
        window.location.reload(); // Forzar refresh de la lista
      }, 1000);
    }
  };

  const handleCancelModalCancel = () => {
    setShowCancelConfirm(false);
  };

  // Función para descargar errores como CSV
  const downloadErrorsLog = () => {
    if (errors.length === 0) {
      toast.error("No hay errores para descargar");
      return;
    }

    // Crear CSV
    const headers = "Fila,Tipo,Campo,Valor,Mensaje,Severidad\n";
    const rows = errors
      .map(
        (e) =>
          `${e.row_number || ""},${e.error_type},${e.affected_field || ""},${e.original_value || ""},"${e.error_message}",${e.severity}`
      )
      .join("\n");

    const csv = headers + rows;

    // Descargar
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `errores-${batch?.batch.name || "importacion"}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast.success("Log de errores descargado");
  };

  // Cerrar con ESC
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleEsc);
    }
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" onClick={onClose} />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Detalles de Importación</h2>
              {batch && <p className="text-sm text-gray-500 mt-1">{batch.batch.name}</p>}
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Cerrar"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          {/* Content */}
          <div className="overflow-y-auto max-h-[calc(90vh-80px)] px-6 py-6">
            {loading && (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-4" />
                <p className="text-gray-600">Cargando detalles...</p>
              </div>
            )}

            {loadError && (
              <div className="flex items-start space-x-2 p-4 bg-red-50 border border-red-200 rounded-lg">
                <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-800">Error al cargar detalles</p>
                  <p className="text-sm text-red-700 mt-1">{loadError}</p>
                </div>
              </div>
            )}

            {batch && (
              <div className="space-y-6">
                {/* Estado y Progreso */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-xl p-4">
                    <h3 className="text-sm font-medium text-gray-500 mb-2">Estado</h3>
                    <ImportStatusBadge status={batch.batch.status as any} />
                  </div>

                  <div className="bg-gray-50 rounded-xl p-4">
                    <h3 className="text-sm font-medium text-gray-500 mb-3">Progreso</h3>
                    <ImportProgressBar
                      total={batch.progress.total}
                      successful={batch.progress.successful}
                      failed={batch.progress.failed}
                      status={batch.batch.status as any}
                    />
                  </div>
                </div>

                {/* Estadísticas */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-blue-50 rounded-xl p-4">
                    <p className="text-sm text-blue-600 mb-1">Total</p>
                    <p className="text-2xl font-bold text-blue-900">{batch.progress.total}</p>
                  </div>

                  <div className="bg-green-50 rounded-xl p-4">
                    <p className="text-sm text-green-600 mb-1">Exitosos</p>
                    <p className="text-2xl font-bold text-green-900 flex items-center">
                      <CheckCircle className="w-5 h-5 mr-2" />
                      {batch.progress.successful}
                    </p>
                  </div>

                  <div className="bg-red-50 rounded-xl p-4">
                    <p className="text-sm text-red-600 mb-1">Fallidos</p>
                    <p className="text-2xl font-bold text-red-900 flex items-center">
                      <XCircle className="w-5 h-5 mr-2" />
                      {batch.progress.failed}
                    </p>
                  </div>

                  <div className="bg-purple-50 rounded-xl p-4">
                    <p className="text-sm text-purple-600 mb-1">Duración</p>
                    <p className="text-2xl font-bold text-purple-900 flex items-center">
                      <Clock className="w-5 h-5 mr-2" />
                      {batch.stats.durationSeconds
                        ? `${Math.floor(batch.stats.durationSeconds / 60)}m ${batch.stats.durationSeconds % 60}s`
                        : "-"}
                    </p>
                  </div>
                </div>

                {/* Errores */}
                {errors.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-gray-900">
                        Errores ({errors.length})
                      </h3>
                      <button
                        onClick={downloadErrorsLog}
                        className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                      >
                        <Download className="w-4 h-4" />
                        <span>Descargar Log</span>
                      </button>
                    </div>

                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {errors.map((error) => {
                        const config = severityConfig[error.severity];
                        const Icon = config.icon;

                        return (
                          <div
                            key={error.id}
                            className={`flex items-start space-x-3 p-4 rounded-lg border ${config.color}`}
                          >
                            <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-medium">
                                  {config.label}
                                  {error.row_number && ` - Fila ${error.row_number}`}
                                </span>
                                <span className="text-xs opacity-75">{error.error_type}</span>
                              </div>
                              <p className="text-sm font-medium mb-1">{error.error_message}</p>
                              {error.affected_field && (
                                <p className="text-xs opacity-75">
                                  Campo: {error.affected_field}
                                  {error.original_value && ` = "${error.original_value}"`}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {errors.length === 0 && batch.batch.status === "COMPLETED" && (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                      <CheckCircle className="w-8 h-8 text-green-600" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Importación Exitosa</h3>
                    <p className="text-sm text-gray-500">
                      Todos los registros se importaron correctamente
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-between items-center">
            {/* Botón cancelar importación - solo visible si se puede cancelar */}
            {canCancel && (
              <button
                onClick={handleCancelClick}
                disabled={cancelling}
                className="flex items-center space-x-2 px-6 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Ban className="w-4 h-4" />
                <span>{cancelling ? "Cancelando..." : "Cancelar Importación"}</span>
              </button>
            )}

            {/* Espaciador si no hay botón de cancelar */}
            {!canCancel && <div />}

            <button
              onClick={onClose}
              className="px-6 py-2 bg-white border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>

      {/* Modal de confirmación para cancelar */}
      {showCancelConfirm && (
        <div className="fixed inset-0 z-[60] overflow-y-auto">
          <div
            className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
            onClick={handleCancelModalCancel}
          />

          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
              <div className="text-center">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Ban className="w-6 h-6 text-red-600" />
                </div>

                <h3 className="text-lg font-bold text-gray-900 mb-2">¿Cancelar importación?</h3>

                <p className="text-sm text-gray-600 mb-6">
                  Esta acción detendrá la importación actual. Los registros ya procesados se
                  mantendrán, pero el resto no se importará. ¿Estás seguro?
                </p>

                <div className="flex space-x-3">
                  <button
                    onClick={handleCancelModalCancel}
                    disabled={cancelling}
                    className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
                  >
                    No, continuar
                  </button>

                  <button
                    onClick={handleConfirmCancel}
                    disabled={cancelling}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    {cancelling ? "Cancelando..." : "Sí, cancelar"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
