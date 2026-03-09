/**
 * Página de administración de importaciones
 * Permite importar DEAs desde archivos CSV
 */

"use client";

import { Upload, ChevronLeft, ChevronRight, ArrowLeft, FileUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";

import ImportDetailsModal from "@/components/import/ImportDetailsModal";
import ImportHistoryTable from "@/components/import/ImportHistoryTable";
import ImportWizard from "@/components/import/ImportWizard";
import { useAuth } from "@/contexts/AuthContext";
import { useImportBatches } from "@/hooks/useImportBatches";

export default function AdminImportsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  // Import state
  const [importPage, setImportPage] = useState(1);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [showWizard, setShowWizard] = useState(false);

  const { batches, loading, error, pagination, refetch } = useImportBatches({
    page: importPage,
    limit: 20,
    autoRefresh: true,
    refreshInterval: 5000,
  });

  const canImport = user?.role === "ADMIN" || user?.permissions?.canImportAeds;

  // Organizations where the user can edit (for org editors)
  const editableOrgs =
    user?.permissions?.organizations?.filter((o) => o.permissions.can_edit) ?? [];
  const isGlobalAdmin = user?.role === "ADMIN";

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login?redirect=/admin/imports");
      return;
    }

    if (!authLoading && user && !canImport) {
      router.push("/");
      return;
    }
  }, [authLoading, user, router, canImport]);

  const handleWizardComplete = (_batchId: string) => {
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

  const handlePreviousPage = () => {
    if (importPage > 1) setImportPage(importPage - 1);
  };

  const handleNextPage = () => {
    if (pagination && importPage < pagination.totalPages) {
      setImportPage(importPage + 1);
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

  if (!user || !canImport) {
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
            <div className="p-3 rounded-full bg-purple-100">
              <FileUp className="w-8 h-8 text-purple-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Importaciones</h1>
              <p className="mt-1 text-sm text-gray-600">
                Importar DEAs masivamente desde archivos CSV
                {!isGlobalAdmin && editableOrgs.length > 0 && (
                  <span className="ml-2 inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                    {editableOrgs.length === 1
                      ? editableOrgs[0].name
                      : `${editableOrgs.length} organizaciones`}
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>

        {showWizard ? (
          /* Wizard de importación */
          <div className="bg-white rounded-xl shadow-lg p-6">
            <button
              onClick={() => setShowWizard(false)}
              className="mb-4 flex items-center space-x-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="font-medium">Volver al historial</span>
            </button>
            <ImportWizard
              onComplete={handleWizardComplete}
              organizations={editableOrgs}
              isGlobalAdmin={isGlobalAdmin}
            />
          </div>
        ) : (
          <>
            {/* Botón para nueva importación */}
            <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
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
              <div className="bg-red-50 border border-red-300 rounded-xl p-4 mb-6">
                <p className="text-red-800 font-medium">Error: {error}</p>
              </div>
            )}

            {/* History Table */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
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
        )}
      </div>

      {/* Details Modal */}
      <ImportDetailsModal batchId={selectedBatchId} isOpen={modalOpen} onClose={handleCloseModal} />
    </div>
  );
}
