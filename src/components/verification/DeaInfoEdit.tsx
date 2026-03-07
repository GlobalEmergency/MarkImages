"use client";

import { Loader2, Pencil, X, Check } from "lucide-react";
import { useState } from "react";
import { getStatusLabel, getStatusColor } from "@/lib/aed-status-config";

interface DeaInfoEditProps {
  aedId: string;
  initialData: {
    code?: string | null;
    provisional_number?: number | null;
    name: string;
    establishment_type?: string | null;
    location?: {
      street_type?: string | null;
      street_name?: string | null;
      street_number?: string | null;
      district_name?: string | null;
    } | null;
    status: string;
    images_count: number;
  };
  onUpdate?: () => void;
}

interface EditableFields {
  name: string;
  code: string;
  establishment_type: string;
}

export default function DeaInfoEdit({ aedId, initialData, onUpdate }: DeaInfoEditProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editedData, setEditedData] = useState<EditableFields>({
    name: initialData.name,
    code: initialData.code || "",
    establishment_type: initialData.establishment_type || "",
  });

  const hasChanges = () => {
    return (
      editedData.name !== initialData.name ||
      editedData.code !== (initialData.code || "") ||
      editedData.establishment_type !== (initialData.establishment_type || "")
    );
  };

  const handleSave = async () => {
    if (!hasChanges()) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/aeds/${aedId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: editedData.name.trim(),
          code: editedData.code.trim() || null,
          establishment_type: editedData.establishment_type.trim() || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Error al guardar cambios");
      }

      setIsEditing(false);
      onUpdate?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditedData({
      name: initialData.name,
      code: initialData.code || "",
      establishment_type: initialData.establishment_type || "",
    });
    setError(null);
    setIsEditing(false);
  };

  const getDisplayCode = () => {
    if (initialData.code) return initialData.code;
    if (initialData.provisional_number) return `#${initialData.provisional_number}`;
    return "Sin código";
  };

  if (!isEditing) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6">
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900">Información del DEA</h2>
          <button
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-1 text-blue-600 hover:text-blue-700 text-sm font-medium transition-colors"
            title="Editar información"
          >
            <Pencil className="w-4 h-4" />
            <span className="hidden sm:inline">Editar</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <div>
            <p className="text-xs sm:text-sm text-gray-500">Código</p>
            <p className="font-medium text-gray-900 text-sm sm:text-base">{getDisplayCode()}</p>
          </div>

          <div>
            <p className="text-xs sm:text-sm text-gray-500">Nombre</p>
            <p className="font-medium text-gray-900 text-sm sm:text-base">{initialData.name}</p>
          </div>

          {initialData.establishment_type && (
            <div>
              <p className="text-xs sm:text-sm text-gray-500">Tipo de establecimiento</p>
              <p className="font-medium text-gray-900 text-sm sm:text-base">
                {initialData.establishment_type}
              </p>
            </div>
          )}

          {initialData.location && (
            <div>
              <p className="text-xs sm:text-sm text-gray-500">Ubicación</p>
              <p className="font-medium text-gray-900 text-sm sm:text-base">
                {initialData.location.street_type} {initialData.location.street_name}{" "}
                {initialData.location.street_number}
                {initialData.location.district_name && ` - ${initialData.location.district_name}`}
              </p>
            </div>
          )}

          <div>
            <p className="text-xs sm:text-sm text-gray-500">Estado</p>
            <span
              className={`inline-block text-xs font-medium px-2.5 py-0.5 rounded ${getStatusColor(
                initialData.status
              )}`}
            >
              {getStatusLabel(initialData.status)}
            </span>
          </div>

          {initialData.images_count > 0 && (
            <div>
              <p className="text-xs sm:text-sm text-gray-500">Imágenes</p>
              <p className="font-medium text-gray-900 text-sm sm:text-base">
                {initialData.images_count} imagen(es)
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6">
      <div className="flex items-start justify-between mb-4">
        <h2 className="text-base sm:text-lg font-semibold text-gray-900">
          Editar Información del DEA
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCancel}
            disabled={isSaving}
            className="flex items-center gap-1 text-gray-600 hover:text-gray-700 text-sm font-medium transition-colors disabled:opacity-50"
            title="Cancelar"
          >
            <X className="w-4 h-4" />
            <span className="hidden sm:inline">Cancelar</span>
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !hasChanges()}
            className="flex items-center gap-1 bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm font-medium transition-colors"
            title="Guardar cambios"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="hidden sm:inline">Guardando...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span className="hidden sm:inline">Guardar</span>
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Código <span className="text-gray-400">(opcional)</span>
          </label>
          <input
            type="text"
            value={editedData.code}
            onChange={(e) => setEditedData({ ...editedData, code: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            placeholder="Ej: DEA-001"
          />
          <p className="mt-1 text-xs text-gray-500">
            Código único del DEA. Si está vacío, se mostrará el número provisional.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nombre <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={editedData.name}
            onChange={(e) => setEditedData({ ...editedData, name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            placeholder="Nombre del DEA"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tipo de establecimiento <span className="text-gray-400">(opcional)</span>
          </label>
          <input
            type="text"
            value={editedData.establishment_type}
            onChange={(e) =>
              setEditedData({
                ...editedData,
                establishment_type: e.target.value,
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            placeholder="Ej: Centro comercial, Hospital, Oficinas"
          />
        </div>

        <div className="border-t pt-4">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Información no editable aquí</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            {initialData.location && (
              <div>
                <p className="text-xs text-gray-500">Ubicación</p>
                <p className="text-gray-700">
                  {initialData.location.street_type} {initialData.location.street_name}{" "}
                  {initialData.location.street_number}
                </p>
              </div>
            )}
            <div>
              <p className="text-xs text-gray-500">Estado</p>
              <span
                className={`inline-block text-xs font-medium px-2.5 py-0.5 rounded ${getStatusColor(
                  initialData.status
                )}`}
              >
                {getStatusLabel(initialData.status)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
