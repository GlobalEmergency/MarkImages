/**
 * Barra de progreso para importaciones con segmentos de éxito y error
 */

import type { ImportStatus } from "@/types/import";

interface ImportProgressBarProps {
  total: number;
  successful: number;
  failed: number;
  status: ImportStatus;
}

export default function ImportProgressBar({
  total,
  successful,
  failed,
  status,
}: ImportProgressBarProps) {
  const processed = successful + failed;
  const percentage = total > 0 ? Math.round((processed / total) * 100) : 0;
  const successPercentage = total > 0 ? (successful / total) * 100 : 0;
  const failurePercentage = total > 0 ? (failed / total) * 100 : 0;

  return (
    <div className="space-y-1">
      {/* Barra de progreso */}
      <div className="relative w-full h-2 bg-gray-200 rounded-full overflow-hidden">
        {/* Segmento de éxito */}
        <div
          className="absolute top-0 left-0 h-full bg-green-500 transition-all duration-500"
          style={{ width: `${successPercentage}%` }}
        />
        {/* Segmento de fallos */}
        <div
          className="absolute top-0 h-full bg-red-500 transition-all duration-500"
          style={{
            left: `${successPercentage}%`,
            width: `${failurePercentage}%`,
          }}
        />
        {/* Animación para IN_PROGRESS y RESUMING */}
        {(status === "IN_PROGRESS" || status === "RESUMING") && (
          <div
            className="absolute top-0 left-0 h-full bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse"
            style={{ width: "30%", animation: "slideProgress 1.5s infinite" }}
          />
        )}
      </div>

      {/* Texto del porcentaje */}
      <div className="flex justify-between items-center text-xs text-gray-600">
        <span>
          {processed} / {total}
        </span>
        <span className="font-medium">{percentage}%</span>
      </div>

      {/* Estilos personalizados para la animación */}
      <style jsx>{`
        @keyframes slideProgress {
          0% {
            left: -30%;
          }
          100% {
            left: 100%;
          }
        }
      `}</style>
    </div>
  );
}
