/**
 * Barra de progreso para exportaciones
 */

import { ExportBatchInfo } from "@/export/domain/ports/IExportRepository";

interface ExportProgressBarProps {
  batch: ExportBatchInfo;
}

export default function ExportProgressBar({ batch }: ExportProgressBarProps) {
  const { status, totalRecords, successfulRecords } = batch;

  // Si estÃ¡ completado, mostrar 100%
  if (status === "COMPLETED") {
    return (
      <div className="w-full">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-gray-600 font-medium">Completado</span>
          <span className="text-green-600 font-medium">100%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
          <div
            className="bg-green-500 h-full rounded-full transition-all duration-300"
            style={{ width: "100%" }}
          />
        </div>
      </div>
    );
  }

  // Si estÃ¡ fallido
  if (status === "FAILED") {
    return (
      <div className="w-full">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-red-600 font-medium">Error</span>
          <span className="text-red-600 font-medium">âœ•</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
          <div className="bg-red-500 h-full rounded-full" style={{ width: "100%" }} />
        </div>
      </div>
    );
  }

  // Si estÃ¡ cancelado
  if (status === "CANCELLED") {
    return (
      <div className="w-full">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-gray-600 font-medium">Cancelado</span>
          <span className="text-gray-600 font-medium">-</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
          <div className="bg-gray-400 h-full rounded-full" style={{ width: "0%" }} />
        </div>
      </div>
    );
  }

  // En progreso o pendiente
  const percentage = totalRecords > 0 ? Math.round((successfulRecords / totalRecords) * 100) : 0;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-gray-600 font-medium">
          {status === "IN_PROGRESS" ? "Exportando..." : "Pendiente"}
        </span>
        <span className="text-blue-600 font-medium">{percentage}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            status === "IN_PROGRESS" ? "bg-blue-500 animate-pulse" : "bg-gray-400"
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
