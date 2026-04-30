"use client";

import { useState, useEffect } from "react";
import type { PublicationMode } from "@/generated/client/client";
import { getPublicationModeLabel, getPublicationModeDescription } from "@/lib/publication-filter";

interface PublicationModeSelectorProps {
  aedId: string;
  currentMode: PublicationMode;
  onUpdate?: (newMode: PublicationMode) => void;
  disabled?: boolean;
}

interface PublicationHistoryEntry {
  id: string;
  previous_mode: PublicationMode | null;
  new_mode: PublicationMode;
  changed_by: string | null;
  change_reason: string | null;
  created_at: string;
}

export default function PublicationModeSelector({
  aedId,
  currentMode,
  onUpdate,
  disabled = false,
}: PublicationModeSelectorProps) {
  const [selectedMode, setSelectedMode] = useState<PublicationMode>(currentMode);
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<PublicationHistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setSelectedMode(currentMode);
  }, [currentMode]);

  const publicationModes: Array<{ value: PublicationMode; label: string; description: string }> = [
    {
      value: "NONE",
      label: getPublicationModeLabel("NONE"),
      description: getPublicationModeDescription("NONE"),
    },
    {
      value: "LOCATION_ONLY",
      label: getPublicationModeLabel("LOCATION_ONLY"),
      description: getPublicationModeDescription("LOCATION_ONLY"),
    },
    {
      value: "BASIC_INFO",
      label: getPublicationModeLabel("BASIC_INFO"),
      description: getPublicationModeDescription("BASIC_INFO"),
    },
    {
      value: "FULL",
      label: getPublicationModeLabel("FULL"),
      description: getPublicationModeDescription("FULL"),
    },
  ];

  const handleUpdate = async () => {
    if (selectedMode === currentMode) {
      setError("El modo de publicación ya es " + getPublicationModeLabel(selectedMode));
      return;
    }

    setIsUpdating(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/aeds/${aedId}/publication`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          publication_mode: selectedMode,
          reason: reason || undefined,
          notes: notes || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Error al actualizar modo de publicación");
      }

      setSuccess(`Modo de publicación actualizado a: ${getPublicationModeLabel(selectedMode)}`);
      setReason("");
      setNotes("");

      // Notify parent component
      if (onUpdate) {
        onUpdate(selectedMode);
      }

      // Refresh history if shown
      if (showHistory) {
        fetchHistory();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setIsUpdating(false);
    }
  };

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const response = await fetch(`/api/aeds/${aedId}/publication`);
      const data = await response.json();

      if (response.ok && data.success) {
        setHistory(data.data.history || []);
      }
    } catch (err) {
      console.error("Error fetching publication history:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const toggleHistory = () => {
    if (!showHistory) {
      fetchHistory();
    }
    setShowHistory(!showHistory);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Modo de Publicación</h3>
        <span
          className={`px-3 py-1 rounded-full text-sm font-medium ${
            currentMode === "FULL"
              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
              : currentMode === "BASIC_INFO"
                ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                : currentMode === "LOCATION_ONLY"
                  ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                  : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
          }`}
        >
          {getPublicationModeLabel(currentMode)}
        </span>
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-400">
        Controla qué información de este DEA es visible públicamente en el mapa.
      </p>

      {/* Mode Selector */}
      <div className="space-y-3">
        {publicationModes.map((mode) => (
          <label
            key={mode.value}
            className={`flex items-start p-4 border-2 rounded-lg cursor-pointer transition-all ${
              selectedMode === mode.value
                ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
            } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            <input
              type="radio"
              name="publication_mode"
              value={mode.value}
              checked={selectedMode === mode.value}
              onChange={(e) => setSelectedMode(e.target.value as PublicationMode)}
              disabled={disabled}
              className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500"
            />
            <div className="ml-3 flex-1">
              <div className="font-medium text-gray-900 dark:text-white">{mode.label}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">{mode.description}</div>
            </div>
          </label>
        ))}
      </div>

      {/* Reason Input */}
      <div>
        <label
          htmlFor="reason"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
        >
          Razón del cambio (opcional)
        </label>
        <input
          id="reason"
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Ej: Propietario autorizó publicación completa"
          disabled={disabled || isUpdating}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white disabled:opacity-50"
        />
      </div>

      {/* Notes Input */}
      <div>
        <label
          htmlFor="notes"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
        >
          Notas adicionales (opcional)
        </label>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Información adicional sobre este cambio..."
          rows={3}
          disabled={disabled || isUpdating}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white disabled:opacity-50"
        />
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {success && (
        <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
          <p className="text-sm text-green-800 dark:text-green-200">{success}</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleUpdate}
          disabled={disabled || isUpdating || selectedMode === currentMode}
          className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-md transition-colors disabled:cursor-not-allowed"
        >
          {isUpdating ? "Actualizando..." : "Guardar cambio"}
        </button>

        <button
          onClick={toggleHistory}
          disabled={disabled || isUpdating}
          className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-medium rounded-md transition-colors"
        >
          {showHistory ? "Ocultar" : "Ver"} historial
        </button>
      </div>

      {/* History Section */}
      {showHistory && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <h4 className="font-medium text-gray-900 dark:text-white mb-3">Historial de cambios</h4>

          {loadingHistory ? (
            <p className="text-sm text-gray-600 dark:text-gray-400">Cargando historial...</p>
          ) : history.length === 0 ? (
            <p className="text-sm text-gray-600 dark:text-gray-400">Sin cambios registrados</p>
          ) : (
            <div className="space-y-3">
              {history.map((entry) => (
                <div
                  key={entry.id}
                  className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-md text-sm"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-gray-900 dark:text-white">
                      {entry.previous_mode ? getPublicationModeLabel(entry.previous_mode) : "—"} →{" "}
                      {getPublicationModeLabel(entry.new_mode)}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(entry.created_at).toLocaleString("es-ES")}
                    </span>
                  </div>
                  {entry.change_reason && (
                    <p className="text-gray-600 dark:text-gray-400">Razón: {entry.change_reason}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
