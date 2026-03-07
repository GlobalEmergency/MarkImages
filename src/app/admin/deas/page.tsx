/**
 * Admin DEAs Page - Administrative Table View
 * Shows all DEAs in a filterable, paginated table with admin permissions
 */

"use client";

import { DeasList } from "@/components/shared/DeasList";
import { AED_STATUS_FILTER_OPTIONS_ALL } from "@/lib/aed-status-config";

export default function AdminDeasPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Gestión de DEAs</h1>
          <p className="mt-2 text-sm text-gray-600">
            Tabla administrativa con todos los desfibriladores del sistema
          </p>
        </div>

        <DeasList
          adminMode={true}
          config={{
            filters: [
              {
                key: "search",
                type: "search",
                label: "Buscar",
                placeholder: "Buscar por nombre, código, dirección o ciudad...",
              },
              {
                key: "aed_status",
                type: "select",
                label: "Estado del DEA",
                options: AED_STATUS_FILTER_OPTIONS_ALL,
              },
              {
                key: "coordinate_validation",
                type: "select",
                label: "Validación Coordenadas",
                options: [
                  { value: "all", label: "Todas" },
                  { value: "INVALID", label: "⚠️ Inválidas (revisar)" },
                  { value: "NEEDS_VALIDATION", label: "🔍 Necesitan validación" },
                  { value: "VALID", label: "✅ Válidas" },
                  { value: "NO_COMPARISON", label: "❓ Sin comparar" },
                ],
              },
              {
                key: "organization_id",
                type: "select",
                label: "Organización",
                options: [], // Se cargará dinámicamente
              },
            ],
            pagination: {
              enabled: true,
              serverSide: true,
              defaultLimit: 25,
              limitOptions: [10, 25, 50, 100],
            },
            permissions: {
              canView: true,
              canEdit: true,
              canDelete: true,
              canCreate: true,
            },
            emptyMessage: "No se encontraron DEAs",
          }}
        />
      </div>
    </div>
  );
}
