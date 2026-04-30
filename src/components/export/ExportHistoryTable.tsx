/**
 * Tabla con el historial de exportaciones del usuario
 */

"use client";

import { FileDown, RefreshCw, Download, Calendar, Package } from "lucide-react";

import { ExportBatchInfo } from "@/export/domain/ports/IExportRepository";

import ExportProgressBar from "./ExportProgressBar";
import ExportStatusBadge from "./ExportStatusBadge";

interface ExportHistoryTableProps {
  batches: ExportBatchInfo[];
  loading: boolean;
  onRefresh: () => void;
}

export default function ExportHistoryTable({
  batches,
  loading,
  onRefresh,
}: ExportHistoryTableProps) {
  // Formatear fecha relativa
  const formatRelativeDate = (date: Date): string => {
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInMinutes < 1) return "Hace un momento";
    if (diffInMinutes < 60) return `Hace ${diffInMinutes}m`;
    if (diffInHours < 24) return `Hace ${diffInHours}h`;
    if (diffInDays < 7) return `Hace ${diffInDays}d`;

    return date.toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  // Formatear tamaño de archivo
  const formatFileSize = (bytes?: number | null): string => {
    if (!bytes) return "-";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Empty state
  if (!loading && batches.length === 0) {
    return (
      <div className="text-center py-16 px-4 bg-white rounded-xl border-2 border-dashed border-gray-300">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Package className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No hay exportaciones aún</h3>
        <p className="text-sm text-gray-500 max-w-sm mx-auto">
          Crea tu primera exportación para generar archivos CSV con los datos de los DEAs
        </p>
      </div>
    );
  }

  // Loading skeleton
  if (loading && batches.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-6 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse flex space-x-4">
              <div className="h-12 bg-gray-200 rounded w-12" />
              <div className="flex-1 space-y-2 py-1">
                <div className="h-4 bg-gray-200 rounded w-3/4" />
                <div className="h-3 bg-gray-200 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="p-4 sm:p-6 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Historial de Exportaciones</h2>
          <p className="text-sm text-gray-500 mt-1">
            {batches.length} exportación{batches.length !== 1 ? "es" : ""}
          </p>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          title="Actualizar"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          <span className="hidden sm:inline">Actualizar</span>
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Archivo
              </th>
              <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                Fecha
              </th>
              <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Estado
              </th>
              <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">
                Progreso
              </th>
              <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">
                Registros
              </th>
              <th className="px-4 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {batches.map((batch) => (
              <tr key={batch.id} className="hover:bg-gray-50 transition-colors">
                {/* Archivo */}
                <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <FileDown className="w-5 h-5 text-green-600" />
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-900 truncate max-w-[200px]">
                        {batch.name}
                      </p>
                      <p className="text-xs text-gray-500 hidden sm:block">
                        {batch.fileName || "Generando..."}
                      </p>
                    </div>
                  </div>
                </td>

                {/* Fecha */}
                <td className="px-4 sm:px-6 py-4 whitespace-nowrap hidden md:table-cell">
                  <div className="flex items-center text-sm text-gray-500">
                    <Calendar className="w-4 h-4 mr-1.5" />
                    {formatRelativeDate(new Date(batch.createdAt))}
                  </div>
                </td>

                {/* Estado */}
                <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                  <ExportStatusBadge status={batch.status} />
                </td>

                {/* Progreso */}
                <td className="px-4 sm:px-6 py-4 whitespace-nowrap hidden lg:table-cell">
                  <ExportProgressBar batch={batch} />
                </td>

                {/* Registros */}
                <td className="px-4 sm:px-6 py-4 whitespace-nowrap hidden sm:table-cell">
                  <div className="text-sm text-gray-900">
                    {batch.totalRecords > 0 ? (
                      <>
                        <span className="font-medium">{batch.totalRecords}</span>{" "}
                        <span className="text-gray-500">registros</span>
                      </>
                    ) : (
                      <span className="text-gray-500">-</span>
                    )}
                  </div>
                  {batch.fileSize && (
                    <div className="text-xs text-gray-500">{formatFileSize(batch.fileSize)}</div>
                  )}
                </td>

                {/* Acciones */}
                <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  {batch.status === "COMPLETED" && batch.fileUrl ? (
                    <a
                      href={batch.fileUrl}
                      download={batch.fileName || "export.csv"}
                      className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      <span>Descargar</span>
                    </a>
                  ) : batch.status === "FAILED" ? (
                    <span className="text-red-600 text-sm">Error</span>
                  ) : (
                    <span className="text-gray-400 text-sm">Procesando...</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
