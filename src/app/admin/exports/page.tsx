/**
 * Página de administración de exportaciones
 * Permite exportar DEAs a archivos CSV
 */

"use client";

import { Download, ChevronLeft, ChevronRight, ArrowLeft, FileDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";

import ExportHistoryTable from "@/components/export/ExportHistoryTable";
import ExportDialog from "@/components/export/ExportDialog";
import { useAuth } from "@/contexts/AuthContext";
import { useExportBatches } from "@/hooks/useExportBatches";
import { ExportFilters } from "@/export/domain/ports/IExportRepository";

export default function AdminExportsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  // Export state
  const [exportPage, setExportPage] = useState(1);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  const {
    batches: exportBatches,
    loading: exportLoading,
    error: exportError,
    pagination: exportPagination,
    refetch: refetchExports,
  } = useExportBatches({
    page: exportPage,
    limit: 20,
    autoRefresh: true,
    refreshInterval: 5000,
  });

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login?redirect=/admin/exports");
      return;
    }

    if (!authLoading && user && user.role !== "ADMIN") {
      router.push("/");
      return;
    }
  }, [authLoading, user, router]);

  const handleCreateExport = async (name: string, filters: ExportFilters) => {
    const response = await fetch("/api/export", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name, filters }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Error al crear exportación");
    }

    refetchExports();
  };

  const handlePreviousPage = () => {
    if (exportPage > 1) setExportPage(exportPage - 1);
  };

  const handleNextPage = () => {
    if (exportPagination && exportPage < exportPagination.totalPages) {
      setExportPage(exportPage + 1);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!user || user.role !== "ADMIN") {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/admin"
            className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Volver a Admin
          </Link>
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-full bg-yellow-100">
              <FileDown className="w-8 h-8 text-yellow-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Exportaciones</h1>
              <p className="mt-1 text-sm text-gray-600">
                Exportar datos de DEAs a diferentes formatos
              </p>
            </div>
          </div>
        </div>

        {/* Botón para nueva exportación */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-1">Nueva Exportación</h2>
          <p className="text-sm text-gray-600 mb-4">
            Exporta datos de DEAs a CSV con filtros personalizados (estado, ciudad, origen)
          </p>
          <button
            onClick={() => setExportDialogOpen(true)}
            className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg font-medium shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95 flex items-center justify-center space-x-2"
          >
            <Download className="w-5 h-5" />
            <span>Iniciar Nueva Exportación</span>
          </button>
        </div>

        {/* Error Message */}
        {exportError && (
          <div className="bg-red-50 border border-red-300 rounded-xl p-4 mb-6">
            <p className="text-red-800 font-medium">Error: {exportError}</p>
          </div>
        )}

        {/* Export History Table */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <ExportHistoryTable
            batches={exportBatches}
            loading={exportLoading}
            onRefresh={refetchExports}
          />

          {/* Pagination */}
          {exportPagination && exportPagination.totalPages > 1 && (
            <div className="border-t border-gray-200 px-4 sm:px-6 py-4 flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Página {exportPage} de {exportPagination.totalPages}
                <span className="hidden sm:inline"> ({exportPagination.total} total)</span>
              </div>

              <div className="flex space-x-2">
                <button
                  onClick={handlePreviousPage}
                  disabled={exportPage === 1}
                  className="px-4 py-2 bg-white border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span className="hidden sm:inline">Anterior</span>
                </button>

                <button
                  onClick={handleNextPage}
                  disabled={exportPage === exportPagination.totalPages}
                  className="px-4 py-2 bg-white border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
                >
                  <span className="hidden sm:inline">Siguiente</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Export Dialog */}
      <ExportDialog
        isOpen={exportDialogOpen}
        onClose={() => setExportDialogOpen(false)}
        onExport={handleCreateExport}
      />
    </div>
  );
}
