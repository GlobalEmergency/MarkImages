/**
 * Tabla con el historial de importaciones del usuario
 */

"use client";

import { FileText, RefreshCw, Eye, Calendar, Package } from "lucide-react";

import type { ImportBatch } from "@/types/import";

import ImportProgressBar from "./ImportProgressBar";
import ImportStatusBadge from "./ImportStatusBadge";
import ImportActionButtons from "./ImportActionButtons";

interface ImportHistoryTableProps {
  batches: ImportBatch[];
  loading: boolean;
  onRefresh: () => void;
  onViewDetails: (batchId: string) => void;
}

export default function ImportHistoryTable({
  batches,
  loading,
  onRefresh,
  onViewDetails,
}: ImportHistoryTableProps) {
  // Formatear fecha relativa
  const formatRelativeDate = (dateString: string): string => {
    const date = new Date(dateString);
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

  // Empty state
  if (!loading && batches.length === 0) {
    return (
      <div className="text-center py-16 px-4 bg-white rounded-xl border-2 border-dashed border-gray-300">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Package className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No hay importaciones aún</h3>
        <p className="text-sm text-gray-500 max-w-sm mx-auto">
          Sube tu primer archivo CSV para comenzar a importar DEAs al sistema
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
          <h2 className="text-lg font-semibold text-gray-900">Historial de Importaciones</h2>
          <p className="text-sm text-gray-500 mt-1">
            {batches.length} importación{batches.length !== 1 ? "es" : ""}
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
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <FileText className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-900 truncate max-w-[200px]">
                        {batch.name}
                      </p>
                      <p className="text-xs text-gray-500 hidden sm:block">{batch.file_name}</p>
                    </div>
                  </div>
                </td>

                {/* Fecha */}
                <td className="px-4 sm:px-6 py-4 whitespace-nowrap hidden md:table-cell">
                  <div className="flex items-center text-sm text-gray-500">
                    <Calendar className="w-4 h-4 mr-1.5" />
                    {formatRelativeDate(batch.created_at)}
                  </div>
                </td>

                {/* Estado */}
                <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                  <ImportStatusBadge status={batch.status} />
                </td>

                {/* Progreso */}
                <td className="px-4 sm:px-6 py-4 whitespace-nowrap hidden lg:table-cell">
                  <div className="w-40">
                    <ImportProgressBar
                      total={batch.total_records}
                      successful={batch.successful_records}
                      failed={batch.failed_records}
                      status={batch.status}
                    />
                  </div>
                </td>

                {/* Registros */}
                <td className="px-4 sm:px-6 py-4 whitespace-nowrap hidden sm:table-cell">
                  <div className="text-sm space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-gray-500">Total:</span>
                      <span className="font-medium text-gray-900">{batch.total_records}</span>
                    </div>
                    {batch.status !== "PENDING" && (
                      <>
                        <div className="flex items-center space-x-2">
                          <span className="text-green-600">✓</span>
                          <span className="text-green-600 font-medium">
                            {batch.successful_records}
                          </span>
                        </div>
                        {batch.failed_records > 0 && (
                          <div className="flex items-center space-x-2">
                            <span className="text-red-600">✗</span>
                            <span className="text-red-600 font-medium">{batch.failed_records}</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </td>

                {/* Acciones */}
                <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex items-center justify-end gap-2">
                    <ImportActionButtons
                      batchId={batch.id}
                      status={batch.status}
                      onActionComplete={onRefresh}
                    />
                    <button
                      onClick={() => onViewDetails(batch.id)}
                      className="inline-flex items-center space-x-1 text-blue-600 hover:text-blue-800 transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                      <span className="hidden sm:inline">Detalles</span>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
