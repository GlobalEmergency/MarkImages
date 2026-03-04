/**
 * Componente de resumen del estado del mapeo de columnas
 * Muestra indicadores visuales del progreso y validación
 */

"use client";

import { CheckCircle, AlertCircle, Circle, XCircle } from "lucide-react";

import type { MappingSummary as MappingSummaryType } from "@/hooks/useColumnMapping";

interface MappingSummaryProps {
  summary: MappingSummaryType;
}

export default function MappingSummary({ summary }: MappingSummaryProps) {
  const {
    totalColumns,
    mappedColumns,
    unmappedColumns,
    requiredMapped,
    requiredTotal,
    optionalMapped,
    canProceed,
    missingRequiredFields,
  } = summary;

  return (
    <div className="space-y-4">
      {/* Estado general */}
      <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-blue-200">
        <div className="flex items-center space-x-3">
          {canProceed ? (
            <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-white" />
            </div>
          ) : (
            <div className="w-10 h-10 bg-amber-500 rounded-full flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-white" />
            </div>
          )}
          <div>
            <h3 className="font-bold text-gray-900">
              {canProceed ? "¡Listo para continuar!" : "Mapeo incompleto"}
            </h3>
            <p className="text-sm text-gray-600">
              {canProceed
                ? "Todos los campos requeridos están mapeados"
                : `Faltan ${requiredTotal - requiredMapped} campos requeridos`}
            </p>
          </div>
        </div>
      </div>

      {/* Grid de estadísticas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Campos requeridos */}
        <StatCard
          icon={
            requiredMapped === requiredTotal ? (
              <CheckCircle className="w-5 h-5 text-green-600" />
            ) : (
              <XCircle className="w-5 h-5 text-red-600" />
            )
          }
          label="Campos requeridos"
          value={`${requiredMapped}/${requiredTotal}`}
          color={requiredMapped === requiredTotal ? "green" : "red"}
        />

        {/* Campos opcionales */}
        <StatCard
          icon={<Circle className="w-5 h-5 text-blue-600" />}
          label="Campos opcionales"
          value={optionalMapped.toString()}
          color="blue"
        />

        {/* Columnas mapeadas */}
        <StatCard
          icon={<CheckCircle className="w-5 h-5 text-purple-600" />}
          label="Columnas mapeadas"
          value={`${mappedColumns}/${totalColumns}`}
          color="purple"
        />

        {/* Columnas sin mapear */}
        <StatCard
          icon={<Circle className="w-5 h-5 text-gray-400" />}
          label="Sin mapear"
          value={unmappedColumns.toString()}
          color="gray"
        />
      </div>

      {/* Campos faltantes */}
      {missingRequiredFields.length > 0 && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start space-x-2">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-medium text-red-900 mb-1">Campos requeridos faltantes</h4>
              <p className="text-sm text-red-700 mb-2">
                Debes mapear los siguientes campos antes de continuar:
              </p>
              <ul className="list-disc list-inside space-y-1">
                {missingRequiredFields.map((field) => (
                  <li key={field} className="text-sm text-red-700">
                    {field}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Leyenda */}
      <div className="p-3 bg-gray-50 rounded-lg">
        <h4 className="text-xs font-medium text-gray-700 mb-2">Leyenda:</h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <LegendItem color="green" label="Campo requerido mapeado" />
          <LegendItem color="blue" label="Campo opcional mapeado" />
          <LegendItem color="amber" label="Sugerencia automática" />
          <LegendItem color="gray" label="Sin mapear" />
        </div>
      </div>
    </div>
  );
}

// Componente auxiliar para tarjetas de estadística
function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: "green" | "red" | "blue" | "purple" | "gray";
}) {
  const colorClasses = {
    green: "bg-green-50 border-green-200",
    red: "bg-red-50 border-red-200",
    blue: "bg-blue-50 border-blue-200",
    purple: "bg-purple-50 border-purple-200",
    gray: "bg-gray-50 border-gray-200",
  };

  return (
    <div className={`p-3 rounded-lg border ${colorClasses[color]}`}>
      <div className="flex items-center space-x-2 mb-1">
        {icon}
        <span className="text-xs font-medium text-gray-700">{label}</span>
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
    </div>
  );
}

// Componente auxiliar para leyenda
function LegendItem({ color, label }: { color: string; label: string }) {
  const colorClasses: Record<string, string> = {
    green: "bg-green-500",
    blue: "bg-blue-500",
    amber: "bg-amber-500",
    gray: "bg-gray-400",
  };

  return (
    <div className="flex items-center space-x-1.5">
      <div className={`w-3 h-3 rounded-full ${colorClasses[color]}`} />
      <span className="text-gray-600">{label}</span>
    </div>
  );
}
