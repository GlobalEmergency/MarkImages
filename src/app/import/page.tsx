/**
 * Página principal de importación de DEA desde CSV
 * Permite subir archivos CSV y ver el historial de importaciones
 */

"use client";

import { Upload, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

import CsvUploadZone from "@/components/import/CsvUploadZone";
import ImportDetailsModal from "@/components/import/ImportDetailsModal";
import ImportHistoryTable from "@/components/import/ImportHistoryTable";
import { useImportBatches } from "@/hooks/useImportBatches";

export default function ImportPage() {
  const [page, setPage] = useState(1);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const { batches, loading, error, pagination, refetch } = useImportBatches({
    page,
    limit: 20,
    autoRefresh: true,
    refreshInterval: 5000,
  });

  const handleUploadStart = (batchId: string) => {
    // Actualizar lista de importaciones
    refetch();
  };

  const handleViewDetails = (batchId: string) => {
    setSelectedBatchId(batchId);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setTimeout(() => setSelectedBatchId(null), 200);
  };

  const handlePreviousPage = () => {
    if (page > 1) setPage(page - 1);
  };

  const handleNextPage = () => {
    if (pagination && page < pagination.totalPages) {
      setPage(page + 1);
    }
  };

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
            <Upload className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
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
              Importar DEAs
            </h1>
            <p className="opacity-90 text-sm sm:text-base">
              Sube archivos CSV para importar desfibriladores masivamente
            </p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-3 sm:px-4 md:px-6 py-4 pb-12 space-y-6">
        {/* Upload Section */}
        <div
          className="rounded-xl shadow-lg p-4 sm:p-6"
          style={{
            background: "rgba(255, 255, 255, 0.95)",
            backdropFilter: "blur(20px)",
          }}
        >
          <h2 className="text-xl font-bold text-gray-900 mb-1">
            Nueva Importación
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            Selecciona un archivo CSV para comenzar la importación
          </p>
          <CsvUploadZone onUploadStart={handleUploadStart} />
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
                Página {page} de {pagination.totalPages}
                <span className="hidden sm:inline">
                  {" "}
                  ({pagination.total} total)
                </span>
              </div>

              <div className="flex space-x-2">
                <button
                  onClick={handlePreviousPage}
                  disabled={page === 1}
                  className="px-4 py-2 bg-white border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span className="hidden sm:inline">Anterior</span>
                </button>

                <button
                  onClick={handleNextPage}
                  disabled={page === pagination.totalPages}
                  className="px-4 py-2 bg-white border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
                >
                  <span className="hidden sm:inline">Siguiente</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Details Modal */}
      <ImportDetailsModal
        batchId={selectedBatchId}
        isOpen={modalOpen}
        onClose={handleCloseModal}
      />
    </div>
  );
}
