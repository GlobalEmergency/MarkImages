/**
 * Página principal de importación/exportación de DEA
 * Permite subir archivos CSV y exportar datos
 */

"use client";

import {
  Upload,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Download,
  FileUp,
  FileDown,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";

import ImportDetailsModal from "@/components/import/ImportDetailsModal";
import ImportHistoryTable from "@/components/import/ImportHistoryTable";
import ImportWizard from "@/components/import/ImportWizard";
import ExportHistoryTable from "@/components/export/ExportHistoryTable";
import ExportDialog from "@/components/export/ExportDialog";
import { useAuth } from "@/contexts/AuthContext";
import { useImportBatches } from "@/hooks/useImportBatches";
import { useExportBatches } from "@/hooks/useExportBatches";
import { ExportFilters } from "@/export/domain/ports/IExportRepository";

export default function ImportPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  // Tab state
  const [activeTab, setActiveTab] = useState<"imports" | "exports">("imports");

  // Import state
  const [importPage, setImportPage] = useState(1);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [showWizard, setShowWizard] = useState(false);

  // Export state
  const [exportPage, setExportPage] = useState(1);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  const { batches, loading, error, pagination, refetch } = useImportBatches({
    page: importPage,
    limit: 20,
    autoRefresh: true,
    refreshInterval: 5000,
  });

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
      router.push("/login?redirect=/import");
      return;
    }

    if (!authLoading && user && !user.is_verified) {
      router.push("/");
      return;
    }
  }, [authLoading, user, router]);

  const handleWizardComplete = (_batchId: string) => {
    // Actualizar lista de importaciones y cerrar wizard
    refetch();
    setShowWizard(false);
  };

  const handleViewDetails = (batchId: string) => {
    setSelectedBatchId(batchId);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setTimeout(() => setSelectedBatchId(null), 200);
  };

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

    // Refrescar la lista de exportaciones
    refetchExports();
  };

  const handlePreviousPage = () => {
    if (activeTab === "imports") {
      if (importPage > 1) setImportPage(importPage - 1);
    } else {
      if (exportPage > 1) setExportPage(exportPage - 1);
    }
  };

  const handleNextPage = () => {
    if (activeTab === "imports") {
      if (pagination && importPage < pagination.totalPages) {
        setImportPage(importPage + 1);
      }
    } else {
      if (exportPagination && exportPage < exportPagination.totalPages) {
        setExportPage(exportPage + 1);
      }
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

  if (!user) {
    return null;
  }

  return (
    <div
      className="min-h-screen"
      style={{
        background: "linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)",
        backgroundAttachment: "fixed",
      }}
    >
      {/* Hero Header */}
      <header className="text-center text-white px-4 sm:px-6 pt-6 pb-4 sm:pt-8 sm:pb-6">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mb-4">
          <div
            className="p-3 sm:p-4 rounded-full flex-shrink-0"
            style={{
              background: "rgba(255, 255, 255, 0.2)",
              backdropFilter: "blur(20px)",
              border: "2px solid rgba(255, 255, 255, 0.3)",
            }}
          >
            {activeTab === "imports" ? (
              <Upload className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
            ) : (
              <Download className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
            )}
          </div>
          <div className="text-center sm:text-left">
            <h1
              className="font-black text-3xl sm:text-4xl md:text-5xl mb-1"
              style={{
                background: "linear-gradient(135deg, #ffffff 0%, #f1f5f9 100%)",
                backgroundClip: "text",
                WebkitBackgroundClip: "text",
                color: "transparent",
                lineHeight: "1.1",
              }}
            >
              {activeTab === "imports" ? "Importar DEAs" : "Exportar DEAs"}
            </h1>
            <p className="opacity-90 text-sm sm:text-base">
              {activeTab === "imports"
                ? "Sube archivos CSV para importar desfibriladores masivamente"
                : "Exporta datos de DEAs en formato CSV con filtros personalizados"}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex justify-center mt-6">
          <div
            className="inline-flex rounded-lg p-1"
            style={{
              background: "rgba(255, 255, 255, 0.2)",
              backdropFilter: "blur(20px)",
            }}
          >
            <button
              onClick={() => setActiveTab("imports")}
              className={`px-6 py-2 rounded-lg font-medium transition-all ${
                activeTab === "imports"
                  ? "bg-white text-blue-600 shadow-lg"
                  : "text-white hover:bg-white hover:bg-opacity-10"
              }`}
            >
              <FileUp className="w-4 h-4 inline-block mr-2" />
              Importaciones
            </button>
            <button
              onClick={() => setActiveTab("exports")}
              className={`px-6 py-2 rounded-lg font-medium transition-all ${
                activeTab === "exports"
                  ? "bg-white text-green-600 shadow-lg"
                  : "text-white hover:bg-white hover:bg-opacity-10"
              }`}
            >
              <FileDown className="w-4 h-4 inline-block mr-2" />
              Exportaciones
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-3 sm:px-4 md:px-6 py-4 pb-12 space-y-6">
        {showWizard ? (
          /* Wizard de importación */
          <div
            className="rounded-xl shadow-lg p-4 sm:p-6"
            style={{
              background: "rgba(255, 255, 255, 0.95)",
              backdropFilter: "blur(20px)",
            }}
          >
            <button
              onClick={() => setShowWizard(false)}
              className="mb-4 flex items-center space-x-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="font-medium">Volver al historial</span>
            </button>
            <ImportWizard onComplete={handleWizardComplete} />
          </div>
        ) : activeTab === "imports" ? (
          <>
            {/* Botón para nueva importación */}
            <div
              className="rounded-xl shadow-lg p-4 sm:p-6"
              style={{
                background: "rgba(255, 255, 255, 0.95)",
                backdropFilter: "blur(20px)",
              }}
            >
              <h2 className="text-xl font-bold text-gray-900 mb-1">Nueva Importación</h2>
              <p className="text-sm text-gray-600 mb-4">
                Importa datos desde archivos CSV con mapeo de columnas y validación
              </p>
              <button
                onClick={() => setShowWizard(true)}
                className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg font-medium shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95 flex items-center justify-center space-x-2"
              >
                <Upload className="w-5 h-5" />
                <span>Iniciar Nueva Importación</span>
              </button>
            </div>

            {/* Error Message */}
            {error && (
              <div
                className="rounded-xl shadow-lg p-4 border border-red-300"
                style={{
                  background: "rgba(254, 226, 226, 0.95)",
                }}
              >
                <p className="text-red-800 font-medium">Error: {error}</p>
              </div>
            )}

            {/* History Table */}
            <div
              className="rounded-xl shadow-lg overflow-hidden"
              style={{
                background: "rgba(255, 255, 255, 0.95)",
                backdropFilter: "blur(20px)",
              }}
            >
              <ImportHistoryTable
                batches={batches}
                loading={loading}
                onRefresh={refetch}
                onViewDetails={handleViewDetails}
              />

              {/* Pagination */}
              {pagination && pagination.totalPages > 1 && (
                <div className="border-t border-gray-200 px-4 sm:px-6 py-4 flex items-center justify-between">
                  <div className="text-sm text-gray-700">
                    Página {importPage} de {pagination.totalPages}
                    <span className="hidden sm:inline"> ({pagination.total} total)</span>
                  </div>

                  <div className="flex space-x-2">
                    <button
                      onClick={handlePreviousPage}
                      disabled={importPage === 1}
                      className="px-4 py-2 bg-white border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span className="hidden sm:inline">Anterior</span>
                    </button>

                    <button
                      onClick={handleNextPage}
                      disabled={importPage === pagination.totalPages}
                      className="px-4 py-2 bg-white border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
                    >
                      <span className="hidden sm:inline">Siguiente</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Botón para nueva exportación */}
            <div
              className="rounded-xl shadow-lg p-4 sm:p-6"
              style={{
                background: "rgba(255, 255, 255, 0.95)",
                backdropFilter: "blur(20px)",
              }}
            >
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
              <div
                className="rounded-xl shadow-lg p-4 border border-red-300"
                style={{
                  background: "rgba(254, 226, 226, 0.95)",
                }}
              >
                <p className="text-red-800 font-medium">Error: {exportError}</p>
              </div>
            )}

            {/* Export History Table */}
            <div
              className="rounded-xl shadow-lg overflow-hidden"
              style={{
                background: "rgba(255, 255, 255, 0.95)",
                backdropFilter: "blur(20px)",
              }}
            >
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
          </>
        )}
      </main>

      {/* Details Modal */}
      <ImportDetailsModal batchId={selectedBatchId} isOpen={modalOpen} onClose={handleCloseModal} />

      {/* Export Dialog */}
      <ExportDialog
        isOpen={exportDialogOpen}
        onClose={() => setExportDialogOpen(false)}
        onExport={handleCreateExport}
      />
    </div>
  );
}
