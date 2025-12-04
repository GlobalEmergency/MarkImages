/**
 * Botones de acción para gestionar importaciones
 * Permite reanudar, pausar y cancelar importaciones
 */

"use client";

import { Play, XCircle, Loader2 } from "lucide-react";
import { useState } from "react";

import { useImportActions } from "@/hooks/useImportActions";

interface ImportActionButtonsProps {
  batchId: string;
  status: string;
  onActionComplete?: () => void;
}

export default function ImportActionButtons({
  batchId,
  status,
  onActionComplete,
}: ImportActionButtonsProps) {
  const { resumeBatch, cancelBatch, resuming, cancelling } = useImportActions();
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const handleResume = async () => {
    try {
      await resumeBatch(batchId);
      onActionComplete?.();
    } catch (error) {
      console.error("Failed to resume:", error);
      alert(`Error al reanudar: ${error instanceof Error ? error.message : "Error desconocido"}`);
    }
  };

  const handleCancelConfirm = async () => {
    try {
      await cancelBatch(batchId);
      setShowCancelConfirm(false);
      onActionComplete?.();
    } catch (error) {
      console.error("Failed to cancel:", error);
      alert(`Error al cancelar: ${error instanceof Error ? error.message : "Error desconocido"}`);
    }
  };

  // Determinar qué botones mostrar según el estado
  const canResume = status === "INTERRUPTED";
  const canCancel = ["IN_PROGRESS", "INTERRUPTED", "RESUMING"].includes(status);

  if (!canResume && !canCancel) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      {/* Botón Reanudar */}
      {canResume && (
        <button
          onClick={handleResume}
          disabled={resuming.loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Reanudar importación"
        >
          {resuming.loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Play className="w-3.5 h-3.5" />
          )}
          <span className="hidden sm:inline">Reanudar</span>
        </button>
      )}

      {/* Botón Cancelar */}
      {canCancel && (
        <>
          {!showCancelConfirm ? (
            <button
              onClick={() => setShowCancelConfirm(true)}
              disabled={cancelling.loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Cancelar importación"
            >
              {cancelling.loading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <XCircle className="w-3.5 h-3.5" />
              )}
              <span className="hidden sm:inline">Cancelar</span>
            </button>
          ) : (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">
              <span className="text-xs text-red-800 font-medium hidden sm:inline">¿Seguro?</span>
              <div className="flex gap-1">
                <button
                  onClick={handleCancelConfirm}
                  disabled={cancelling.loading}
                  className="px-2 py-1 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded transition-colors disabled:opacity-50"
                >
                  Sí
                </button>
                <button
                  onClick={() => setShowCancelConfirm(false)}
                  disabled={cancelling.loading}
                  className="px-2 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded transition-colors disabled:opacity-50"
                >
                  No
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
