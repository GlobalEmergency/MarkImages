"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface DataSource {
  id: string;
  name: string;
  type: string;
  description: string | null;
  apiEndpoint: string | null;
  isActive: boolean;
  syncFrequency: string;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  totalRecordsSync: number;
  recordsCreated: number;
  recordsUpdated: number;
  recordsDeactivated: number;
  createdAt: string;
  stats?: {
    totalBatches: number;
    successfulSyncs: number;
    failedSyncs: number;
  };
}

export default function DataSourcesPage() {
  const router = useRouter();
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [filter, setFilter] = useState({
    type: "",
    isActive: "true",
  });

  const fetchDataSources = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filter.type) params.append("type", filter.type);
      if (filter.isActive) params.append("isActive", filter.isActive);

      const response = await fetch(`/api/admin/data-sources?${params.toString()}`);

      if (response.status === 401 || response.status === 403) {
        router.push("/");
        return;
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Error al cargar fuentes de datos");
      }

      setDataSources(data.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDataSources();
  }, [filter]);

  const triggerSync = async (id: string) => {
    if (syncing) return;

    try {
      setSyncing(id);
      const response = await fetch(`/api/admin/data-sources/${id}/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun: false }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Error al sincronizar");
      }

      // Refrescar lista
      await fetchDataSources();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al sincronizar");
    } finally {
      setSyncing(null);
    }
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      CKAN_API: "API CKAN",
      CSV_FILE: "Archivo CSV",
      JSON_FILE: "Archivo JSON",
      REST_API: "API REST",
    };
    return labels[type] || type;
  };

  const getTypeBadgeColor = (type: string) => {
    const colors: Record<string, string> = {
      CKAN_API: "bg-blue-100 text-blue-800",
      CSV_FILE: "bg-green-100 text-green-800",
      JSON_FILE: "bg-yellow-100 text-yellow-800",
      REST_API: "bg-purple-100 text-purple-800",
    };
    return colors[type] || "bg-gray-100 text-gray-800";
  };

  const getStatusBadge = (status: string | null) => {
    if (!status) return null;

    const statusConfig: Record<string, { color: string; label: string }> = {
      COMPLETED: { color: "bg-green-100 text-green-800", label: "Completado" },
      IN_PROGRESS: { color: "bg-blue-100 text-blue-800", label: "En progreso" },
      FAILED: { color: "bg-red-100 text-red-800", label: "Fallido" },
      PENDING: { color: "bg-yellow-100 text-yellow-800", label: "Pendiente" },
    };

    const config = statusConfig[status] || { color: "bg-gray-100 text-gray-800", label: status };

    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}
      >
        {config.label}
      </span>
    );
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Nunca";
    return new Date(dateString).toLocaleString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getSyncFrequencyLabel = (freq: string) => {
    const labels: Record<string, string> = {
      MANUAL: "Manual",
      DAILY: "Diaria",
      WEEKLY: "Semanal",
      MONTHLY: "Mensual",
    };
    return labels[freq] || freq;
  };

  if (loading && dataSources.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Cargando fuentes de datos...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <Link
                href="/admin"
                className="text-sm text-blue-600 hover:text-blue-800 mb-2 inline-block"
              >
                â† Volver al panel
              </Link>
              <h1 className="text-3xl font-bold text-gray-900">Fuentes de Datos Externas</h1>
              <p className="mt-2 text-sm text-gray-600">
                Gestiona las conexiones con APIs externas para importar DEAs automÃ¡ticamente
              </p>
            </div>
            <Link
              href="/admin/data-sources/new"
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Nueva Fuente
            </Link>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-4 rounded-lg shadow mb-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="type-filter" className="block text-sm font-medium text-gray-700">
                Tipo
              </label>
              <select
                id="type-filter"
                value={filter.type}
                onChange={(e) => setFilter({ ...filter, type: e.target.value })}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
              >
                <option value="">Todos los tipos</option>
                <option value="CKAN_API">API CKAN</option>
                <option value="CSV_FILE">Archivo CSV</option>
                <option value="JSON_FILE">Archivo JSON</option>
                <option value="REST_API">API REST</option>
              </select>
            </div>

            <div>
              <label htmlFor="status-filter" className="block text-sm font-medium text-gray-700">
                Estado
              </label>
              <select
                id="status-filter"
                value={filter.isActive}
                onChange={(e) => setFilter({ ...filter, isActive: e.target.value })}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
              >
                <option value="">Todos</option>
                <option value="true">Activas</option>
                <option value="false">Inactivas</option>
              </select>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Data Sources List */}
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {dataSources.length === 0 ? (
              <li className="px-6 py-8 text-center text-gray-500">
                No se encontraron fuentes de datos
              </li>
            ) : (
              dataSources.map((source) => (
                <li key={source.id}>
                  <div className="px-6 py-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3">
                          <Link
                            href={`/admin/data-sources/${source.id}`}
                            className="text-lg font-medium text-blue-600 hover:text-blue-800 truncate"
                          >
                            {source.name}
                          </Link>
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTypeBadgeColor(source.type)}`}
                          >
                            {getTypeLabel(source.type)}
                          </span>
                          {!source.isActive && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                              Inactiva
                            </span>
                          )}
                          {source.lastSyncStatus && getStatusBadge(source.lastSyncStatus)}
                        </div>
                        <div className="mt-2 text-sm text-gray-500">
                          {source.description || "Sin descripciÃ³n"}
                        </div>
                        <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                          <span className="flex items-center">
                            <svg
                              className="h-4 w-4 mr-1"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                              />
                            </svg>
                            Frecuencia: {getSyncFrequencyLabel(source.syncFrequency)}
                          </span>
                          <span className="flex items-center">
                            <svg
                              className="h-4 w-4 mr-1"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                              />
                            </svg>
                            Ãšltima sync: {formatDate(source.lastSyncAt)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-6 text-sm text-gray-500">
                        <div className="text-center">
                          <div className="text-2xl font-semibold text-gray-900">
                            {source.totalRecordsSync}
                          </div>
                          <div className="text-xs">Total sync</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-semibold text-green-600">
                            {source.recordsCreated}
                          </div>
                          <div className="text-xs">Creados</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-semibold text-blue-600">
                            {source.recordsUpdated}
                          </div>
                          <div className="text-xs">Actualizados</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => triggerSync(source.id)}
                            disabled={syncing === source.id || !source.isActive}
                            className={`inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white
                              ${
                                syncing === source.id || !source.isActive
                                  ? "bg-gray-400 cursor-not-allowed"
                                  : "bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                              }`}
                          >
                            {syncing === source.id ? (
                              <>
                                <svg
                                  className="animate-spin h-4 w-4 mr-1"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                >
                                  <circle
                                    className="opacity-25"
                                    cx="12"
                                    cy="12"
                                    r="10"
                                    stroke="currentColor"
                                    strokeWidth="4"
                                  ></circle>
                                  <path
                                    className="opacity-75"
                                    fill="currentColor"
                                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                  ></path>
                                </svg>
                                Sincronizando...
                              </>
                            ) : (
                              <>
                                <svg
                                  className="h-4 w-4 mr-1"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                  />
                                </svg>
                                Sincronizar
                              </>
                            )}
                          </button>
                          <Link
                            href={`/admin/data-sources/${source.id}`}
                            className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                          >
                            Ver detalles
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
