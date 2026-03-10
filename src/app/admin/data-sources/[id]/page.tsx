"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

interface DataSource {
  id: string;
  name: string;
  type: string;
  description: string | null;
  // Campos específicos de CKAN_API
  apiEndpoint: string | null;
  resourceId: string | null;
  // Campos específicos de JSON_FILE
  fileUrl: string | null;
  jsonPath: string | null;
  // Campos específicos de CSV_FILE
  filePath: string | null;
  // Campos comunes
  fieldMapping: Record<string, string> | null;
  filterConfig: Record<string, unknown> | null;
  isActive: boolean;
  syncFrequency: string;
  defaultPublicationMode: string;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  totalRecordsSync: number;
  recordsCreated: number;
  recordsUpdated: number;
  recordsDeactivated: number;
  createdAt: string;
  updatedAt: string;
}

interface PreviewRecord {
  externalId: string;
  rowIndex: number;
  contentHash: string;
  fields: {
    name: string | null;
    establishmentType: string | null;
    streetType: string | null;
    streetName: string | null;
    streetNumber: string | null;
    postalCode: string | null;
    city: string | null;
    district: string | null;
    latitude: number | null;
    longitude: number | null;
    accessDescription: string | null;
    accessSchedule: string | null;
  };
  hasCoordinates: boolean;
  hasMinimumFields: boolean;
  missingFields: string[];
}

interface SyncResult {
  jobId: string;
  dataSourceId: string;
  dryRun?: boolean;
  continued?: boolean;
  stats: {
    total: number;
    processed: number;
    created: number;
    skipped: number;
    failed: number;
  };
  progress: {
    total: number;
    processed: number;
    percentage: number;
    hasMore: boolean;
    status: string;
  };
}

interface CurrentJob {
  id: string;
  name: string;
  status: string;
  progress: {
    percentage: number;
    totalRecords: number;
    processedRecords: number;
    successfulRecords: number;
    failedRecords: number;
    skippedRecords: number;
    currentChunk: number;
    totalChunks: number;
  };
  result: {
    recordsCreated: number;
    recordsUpdated: number;
    recordsSkipped: number;
    recordsDeactivated: number;
    errorCount: number;
  };
  startedAt: string | null;
  completedAt: string | null;
  lastHeartbeat: string | null;
  durationMs: number;
  resumeCount: number;
  metadata?: Record<string, unknown>;
}

export default function DataSourceDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [dataSource, setDataSource] = useState<DataSource | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionResult, setConnectionResult] = useState<{
    success: boolean;
    message: string;
    recordCount?: number;
  } | null>(null);
  const [preview, setPreview] = useState<PreviewRecord[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    isActive: true,
    syncFrequency: "MANUAL",
    defaultPublicationMode: "LOCATION_ONLY",
  });
  const [currentJob, setCurrentJob] = useState<CurrentJob | null>(null);
  const [loadingJob, setLoadingJob] = useState(false);
  const [forcingReset, setForcingReset] = useState(false);
  const [recovering, setRecovering] = useState(false);

  const fetchDataSource = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/data-sources/${id}`);

      if (response.status === 401 || response.status === 403) {
        router.push("/");
        return;
      }

      if (response.status === 404) {
        setError("Fuente de datos no encontrada");
        return;
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Error al cargar fuente de datos");
      }

      setDataSource(data.data);
      setEditForm({
        name: data.data.name,
        description: data.data.description || "",
        isActive: data.data.isActive,
        syncFrequency: data.data.syncFrequency,
        defaultPublicationMode: data.data.defaultPublicationMode || "LOCATION_ONLY",
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    fetchDataSource();
  }, [fetchDataSource]);

  const fetchCurrentJob = useCallback(async () => {
    try {
      setLoadingJob(true);
      const response = await fetch(`/api/admin/data-sources/${id}/current-job`);

      if (!response.ok) {
        throw new Error("Error al cargar job actual");
      }

      const data = await response.json();

      if (data.success && data.data) {
        setCurrentJob(data.data);
      } else {
        setCurrentJob(null);
      }
    } catch (err) {
      console.error("Error fetching current job:", err);
      setCurrentJob(null);
    } finally {
      setLoadingJob(false);
    }
  }, [id]);

  // Initial fetch on mount
  useEffect(() => {
    fetchCurrentJob();
  }, [fetchCurrentJob]);

  // Auto-refresh job status when there's an active job.
  // Uses a ref to avoid resetting the interval every time currentJob changes.
  const currentJobRef = useRef(currentJob);
  currentJobRef.current = currentJob;

  useEffect(() => {
    const interval = setInterval(() => {
      const job = currentJobRef.current;
      if (job && ["IN_PROGRESS", "RESUMING", "WAITING", "QUEUED", "PENDING"].includes(job.status)) {
        fetchCurrentJob();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [fetchCurrentJob]);

  const forceResetJob = async () => {
    if (!currentJob) return;

    if (
      !confirm(
        "¿Estás seguro de que deseas forzar el reset de este job? Esto lo marcará como INTERRUMPIDO y podrá ser reanudado posteriormente."
      )
    ) {
      return;
    }

    try {
      setForcingReset(true);

      const response = await fetch(`/api/admin/jobs/${currentJob.id}/force-reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: "Forzado desde UI - Job atascado sin heartbeat",
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Error al forzar reset");
      }

      // Refresh job status
      await fetchCurrentJob();
      await fetchDataSource();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al forzar reset");
    } finally {
      setForcingReset(false);
    }
  };

  const continueCurrentJob = async () => {
    if (!currentJob) return;

    try {
      setRecovering(true);

      // Call the sync API with continueJobId to resume the existing job
      const response = await fetch(`/api/admin/data-sources/${id}/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ continueJobId: currentJob.id }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Error al continuar sincronización");
      }

      // Refresh state
      await fetchCurrentJob();
      await fetchDataSource();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al continuar sincronización");
    } finally {
      setRecovering(false);
    }
  };

  const triggerSync = async (dryRun: boolean = false) => {
    try {
      setSyncing(true);
      setSyncResult(null);

      const response = await fetch(`/api/admin/data-sources/${id}/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Error al sincronizar");
      }

      setSyncResult(data.data);
      await fetchDataSource(); // Refrescar datos
      await fetchCurrentJob(); // Actualizar estado del job automáticamente
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al sincronizar");
    } finally {
      setSyncing(false);
    }
  };

  const testConnection = async () => {
    try {
      setTestingConnection(true);
      setConnectionResult(null);

      const response = await fetch(`/api/admin/data-sources/${id}/preview`, {
        method: "POST",
      });

      const data = await response.json();

      if (!data.success) {
        setConnectionResult({ success: false, message: data.error || "Error de conexión" });
        return;
      }

      setConnectionResult({
        success: true,
        message: "Conexión exitosa",
        recordCount: data.data.recordCount,
      });
    } catch (err) {
      setConnectionResult({
        success: false,
        message: err instanceof Error ? err.message : "Error de conexión",
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const loadPreview = async () => {
    try {
      setLoadingPreview(true);
      const response = await fetch(`/api/admin/data-sources/${id}/preview?limit=10`);

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Error al cargar preview");
      }

      setPreview(data.data.preview?.records || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar preview");
    } finally {
      setLoadingPreview(false);
    }
  };

  const updateDataSource = async () => {
    try {
      const response = await fetch(`/api/admin/data-sources/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Error al actualizar");
      }

      // Re-fetch full data source state (PUT returns thin response)
      await fetchDataSource();
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al actualizar");
    }
  };

  const deleteDataSource = async () => {
    if (
      !confirm(
        "¿Estás seguro de que deseas eliminar esta fuente de datos? Esta acción no se puede deshacer."
      )
    ) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/data-sources/${id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Error al eliminar");
      }

      router.push("/admin/data-sources");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al eliminar");
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

  const getJobStatusInfo = (status: string) => {
    const statusConfig: Record<string, { color: string; label: string; icon: string }> = {
      PENDING: {
        color: "bg-yellow-100 text-yellow-800 border-yellow-300",
        label: "Pendiente",
        icon: "⏳",
      },
      QUEUED: { color: "bg-blue-100 text-blue-800 border-blue-300", label: "En cola", icon: "📋" },
      IN_PROGRESS: {
        color: "bg-blue-500 text-white border-blue-600",
        label: "En progreso",
        icon: "⚙️",
      },
      RESUMING: {
        color: "bg-blue-400 text-white border-blue-500",
        label: "Reanudando",
        icon: "▶️",
      },
      WAITING: {
        color: "bg-purple-100 text-purple-800 border-purple-300",
        label: "Esperando",
        icon: "⏸️",
      },
      PAUSED: { color: "bg-gray-100 text-gray-800 border-gray-300", label: "Pausado", icon: "⏸" },
      INTERRUPTED: {
        color: "bg-orange-100 text-orange-800 border-orange-300",
        label: "Interrumpido",
        icon: "⚠️",
      },
      COMPLETED: {
        color: "bg-green-100 text-green-800 border-green-300",
        label: "Completado",
        icon: "✅",
      },
      COMPLETED_WITH_WARNINGS: {
        color: "bg-yellow-100 text-yellow-800 border-yellow-300",
        label: "Completado con avisos",
        icon: "⚠️",
      },
      FAILED: { color: "bg-red-100 text-red-800 border-red-300", label: "Fallido", icon: "❌" },
      CANCELLED: {
        color: "bg-gray-100 text-gray-800 border-gray-300",
        label: "Cancelado",
        icon: "🚫",
      },
    };
    return (
      statusConfig[status] || {
        color: "bg-gray-100 text-gray-800 border-gray-300",
        label: status,
        icon: "❓",
      }
    );
  };

  const getTimeSinceLastHeartbeat = (lastHeartbeat: string | null) => {
    if (!lastHeartbeat) return null;
    const now = Date.now();
    const heartbeatTime = new Date(lastHeartbeat).getTime();
    const diff = now - heartbeatTime;
    const seconds = Math.floor(diff / 1000);

    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  };

  const isJobStuck = (job: CurrentJob | null) => {
    if (!job) return false;
    if (!["IN_PROGRESS", "RESUMING"].includes(job.status)) return false;
    if (!job.lastHeartbeat) return true;

    const now = Date.now();
    const heartbeatTime = new Date(job.lastHeartbeat).getTime();
    const diff = now - heartbeatTime;

    // Stuck if no heartbeat for more than 2.5 minutes
    return diff > 150000;
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Cargando fuente de datos...</div>
      </div>
    );
  }

  if (error && !dataSource) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link
            href="/admin/data-sources"
            className="text-sm text-blue-600 hover:text-blue-800 mb-4 inline-block"
          >
            ← Volver a fuentes de datos
          </Link>
          <div className="bg-red-50 border-l-4 border-red-400 p-4">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!dataSource) return null;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/admin/data-sources"
            className="text-sm text-blue-600 hover:text-blue-800 mb-2 inline-block"
          >
            ← Volver a fuentes de datos
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold text-gray-900">{dataSource.name}</h1>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTypeBadgeColor(dataSource.type)}`}
                >
                  {getTypeLabel(dataSource.type)}
                </span>
                {!dataSource.isActive && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                    Inactiva
                  </span>
                )}
              </div>
              <p className="mt-2 text-sm text-gray-600">
                {dataSource.description || "Sin descripción"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setEditing(true)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
                Editar
              </button>
              <button
                onClick={deleteDataSource}
                className="inline-flex items-center px-4 py-2 border border-red-300 rounded-md shadow-sm text-sm font-medium text-red-700 bg-white hover:bg-red-50"
              >
                <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
                Eliminar
              </button>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
            <div className="flex">
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
                <button
                  onClick={() => setError(null)}
                  className="text-xs text-red-600 underline mt-1"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {editing && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h2 className="text-lg font-semibold mb-4">Editar Fuente de Datos</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Nombre</label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Descripción</label>
                  <textarea
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    rows={3}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Frecuencia de Sincronización
                  </label>
                  <select
                    value={editForm.syncFrequency}
                    onChange={(e) => setEditForm({ ...editForm, syncFrequency: e.target.value })}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  >
                    <option value="MANUAL">Manual</option>
                    <option value="DAILY">Diaria</option>
                    <option value="WEEKLY">Semanal</option>
                    <option value="MONTHLY">Mensual</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Modo de Publicación por Defecto
                  </label>
                  <select
                    value={editForm.defaultPublicationMode}
                    onChange={(e) =>
                      setEditForm({ ...editForm, defaultPublicationMode: e.target.value })
                    }
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  >
                    <option value="NONE">Ninguno - No publicar</option>
                    <option value="LOCATION_ONLY">Solo ubicación</option>
                    <option value="BASIC_INFO">Info básica (ubicación + horario + tipo)</option>
                    <option value="FULL">Información completa</option>
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    Nivel de información que se publicará automáticamente al importar desde esta
                    fuente
                  </p>
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={editForm.isActive}
                    onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="isActive" className="ml-2 block text-sm text-gray-700">
                    Activa
                  </label>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <button
                  onClick={() => setEditing(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={updateDataSource}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                >
                  Guardar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg
                    className="h-6 w-6 text-gray-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"
                    />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Total Sincronizados
                    </dt>
                    <dd className="flex items-baseline">
                      <div className="text-2xl font-semibold text-gray-900">
                        {dataSource.totalRecordsSync}
                      </div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg
                    className="h-6 w-6 text-green-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                    />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Creados</dt>
                    <dd className="flex items-baseline">
                      <div className="text-2xl font-semibold text-green-600">
                        {dataSource.recordsCreated}
                      </div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg
                    className="h-6 w-6 text-blue-400"
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
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Actualizados</dt>
                    <dd className="flex items-baseline">
                      <div className="text-2xl font-semibold text-blue-600">
                        {dataSource.recordsUpdated}
                      </div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg
                    className="h-6 w-6 text-red-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M20 12H4"
                    />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Desactivados</dt>
                    <dd className="flex items-baseline">
                      <div className="text-2xl font-semibold text-red-600">
                        {dataSource.recordsDeactivated}
                      </div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Job Status Section */}
        {currentJob && (
          <div className="mb-8 bg-white shadow rounded-lg border-2 border-blue-200">
            <div className="px-4 py-3 sm:px-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-blue-100">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="text-base sm:text-lg font-medium text-gray-900 flex items-center gap-2">
                  <span className="text-xl">{getJobStatusInfo(currentJob.status).icon}</span>
                  Estado de Sincronización
                </h2>
                <span
                  className={`inline-flex items-center px-3 py-1 rounded-full text-xs sm:text-sm font-medium border-2 ${getJobStatusInfo(currentJob.status).color}`}
                >
                  {getJobStatusInfo(currentJob.status).label}
                </span>
              </div>
            </div>

            <div className="px-4 py-4 sm:px-6 space-y-4">
              {/* Heartbeat & Status Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-700">Heartbeat:</span>
                  {currentJob.lastHeartbeat &&
                  ["IN_PROGRESS", "RESUMING"].includes(currentJob.status) ? (
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-block w-2 h-2 rounded-full ${isJobStuck(currentJob) ? "bg-red-500 animate-pulse" : "bg-green-500 animate-pulse"}`}
                      ></span>
                      <span
                        className={
                          isJobStuck(currentJob) ? "text-red-600 font-semibold" : "text-green-600"
                        }
                      >
                        hace {getTimeSinceLastHeartbeat(currentJob.lastHeartbeat)}
                      </span>
                    </div>
                  ) : (
                    <span className="text-gray-500">
                      {currentJob.lastHeartbeat
                        ? `hace ${getTimeSinceLastHeartbeat(currentJob.lastHeartbeat)}`
                        : "Sin heartbeat"}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-700">Duración:</span>
                  <span className="text-gray-900">{formatDuration(currentJob.durationMs)}</span>
                </div>
              </div>

              {/* Stuck Warning */}
              {isJobStuck(currentJob) && (
                <div className="bg-red-50 border-l-4 border-red-400 p-3 rounded">
                  <div className="flex items-start">
                    <span className="text-red-600 text-xl mr-2">⚠️</span>
                    <div>
                      <p className="text-sm font-medium text-red-800">Job Atascado</p>
                      <p className="text-xs text-red-700 mt-1">
                        Este job lleva {getTimeSinceLastHeartbeat(currentJob.lastHeartbeat)} sin
                        heartbeat. Puede estar bloqueado.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Progress Bar */}
              {currentJob.progress && currentJob.progress.totalRecords > 0 && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-gray-700">Progreso</span>
                    <span className="text-gray-900 font-semibold">
                      {currentJob.progress.percentage.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500 ease-out flex items-center justify-end pr-2"
                      style={{ width: `${currentJob.progress.percentage}%` }}
                    >
                      {currentJob.progress.percentage > 10 && (
                        <span className="text-xs font-bold text-white">
                          {currentJob.progress.percentage.toFixed(0)}%
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>
                      {currentJob.progress.processedRecords.toLocaleString()} de{" "}
                      {currentJob.progress.totalRecords.toLocaleString()} registros
                    </span>
                    <span>
                      Chunk {currentJob.progress.currentChunk} de {currentJob.progress.totalChunks}
                    </span>
                  </div>
                </div>
              )}

              {/* Statistics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {currentJob.progress.successfulRecords}
                  </div>
                  <div className="text-xs text-gray-600 mt-1">Exitosos</div>
                </div>
                <div className="bg-red-50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {currentJob.progress.failedRecords}
                  </div>
                  <div className="text-xs text-gray-600 mt-1">Fallidos</div>
                </div>
                <div className="bg-yellow-50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-yellow-600">
                    {currentJob.progress.skippedRecords}
                  </div>
                  <div className="text-xs text-gray-600 mt-1">Omitidos</div>
                </div>
                <div className="bg-blue-50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-blue-600">{currentJob.resumeCount}</div>
                  <div className="text-xs text-gray-600 mt-1">Reintentos</div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-2 pt-3 border-t border-gray-200">
                {isJobStuck(currentJob) && (
                  <button
                    onClick={forceResetJob}
                    disabled={forcingReset}
                    className="flex-1 inline-flex justify-center items-center px-4 py-2 border border-red-300 rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {forcingReset ? (
                      <>
                        <svg className="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24">
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
                        Reseteando...
                      </>
                    ) : (
                      <>
                        <svg
                          className="h-4 w-4 mr-2"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                          />
                        </svg>
                        Forzar Reset
                      </>
                    )}
                  </button>
                )}
                {["WAITING", "PAUSED", "INTERRUPTED"].includes(currentJob.status) && (
                  <button
                    onClick={continueCurrentJob}
                    disabled={recovering}
                    className="flex-1 inline-flex justify-center items-center px-4 py-2 border border-green-300 rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {recovering ? (
                      <>
                        <svg className="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24">
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
                        Continuando...
                      </>
                    ) : (
                      <>
                        <svg
                          className="h-4 w-4 mr-2"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        Continuar Sincronización
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Job Details */}
              <details className="text-xs text-gray-600 border-t border-gray-200 pt-3">
                <summary className="cursor-pointer font-medium hover:text-gray-900">
                  Ver detalles del job
                </summary>
                <dl className="mt-2 space-y-1">
                  <div className="flex justify-between">
                    <dt>Job ID:</dt>
                    <dd className="font-mono">{currentJob.id.substring(0, 8)}...</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Nombre:</dt>
                    <dd>{currentJob.name}</dd>
                  </div>
                  {currentJob.startedAt && (
                    <div className="flex justify-between">
                      <dt>Iniciado:</dt>
                      <dd>{formatDate(currentJob.startedAt)}</dd>
                    </div>
                  )}
                  {currentJob.completedAt && (
                    <div className="flex justify-between">
                      <dt>Completado:</dt>
                      <dd>{formatDate(currentJob.completedAt)}</dd>
                    </div>
                  )}
                </dl>
              </details>
            </div>
          </div>
        )}

        {/* No Active Job Message */}
        {!loadingJob && !currentJob && (
          <div className="mb-8 bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
            <div className="text-gray-400 text-4xl mb-2">💤</div>
            <p className="text-sm text-gray-600">No hay sincronizaciones activas en este momento</p>
            <p className="text-xs text-gray-500 mt-1">
              El estado del job aparecerá aquí cuando se ejecute una sincronización
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Configuration Info */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">Configuración</h2>
            </div>
            <div className="px-6 py-4">
              <dl className="space-y-4">
                {/* Campos específicos de CKAN_API */}
                {dataSource.type === "CKAN_API" && (
                  <>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Endpoint API</dt>
                      <dd className="mt-1 text-sm text-gray-900 break-all">
                        {dataSource.apiEndpoint || "N/A"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Resource ID</dt>
                      <dd className="mt-1 text-sm text-gray-900 font-mono">
                        {dataSource.resourceId || "N/A"}
                      </dd>
                    </div>
                  </>
                )}

                {/* Campos específicos de JSON_FILE */}
                {dataSource.type === "JSON_FILE" && (
                  <>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">URL del Archivo</dt>
                      <dd className="mt-1 text-sm text-gray-900 break-all">
                        {dataSource.fileUrl || "N/A"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">JSON Path</dt>
                      <dd className="mt-1 text-sm text-gray-900 font-mono">
                        {dataSource.jsonPath || "N/A"}
                      </dd>
                    </div>
                  </>
                )}

                {/* Campos específicos de CSV_FILE */}
                {dataSource.type === "CSV_FILE" && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Ruta del Archivo</dt>
                    <dd className="mt-1 text-sm text-gray-900 break-all">
                      {dataSource.filePath || "N/A"}
                    </dd>
                  </div>
                )}

                {/* Campos comunes a todos los tipos */}
                <div>
                  <dt className="text-sm font-medium text-gray-500">
                    Frecuencia de Sincronización
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {getSyncFrequencyLabel(dataSource.syncFrequency)}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Última Sincronización</dt>
                  <dd className="mt-1 text-sm text-gray-900 flex items-center gap-2">
                    {formatDate(dataSource.lastSyncAt)}
                    {getStatusBadge(dataSource.lastSyncStatus)}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Creado</dt>
                  <dd className="mt-1 text-sm text-gray-900">{formatDate(dataSource.createdAt)}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Actualizado</dt>
                  <dd className="mt-1 text-sm text-gray-900">{formatDate(dataSource.updatedAt)}</dd>
                </div>
              </dl>
            </div>
          </div>

          {/* Sync Controls */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">Sincronización</h2>
            </div>
            <div className="px-6 py-4 space-y-4">
              {/* Info Banner */}
              <div className="bg-blue-50 border-l-4 border-blue-400 p-3 rounded">
                <div className="flex items-start">
                  <span className="text-blue-600 text-lg mr-2">ℹ️</span>
                  <div>
                    <p className="text-sm font-medium text-blue-800">Proceso en Segundo Plano</p>
                    <p className="text-xs text-blue-700 mt-1">
                      Las sincronizaciones se ejecutan automáticamente en segundo plano mediante un
                      cron job que se ejecuta cada minuto. Esto evita timeouts y permite procesar
                      grandes volúmenes de datos sin interrupciones.
                    </p>
                  </div>
                </div>
              </div>
              {/* Connection Test */}
              <div>
                <button
                  onClick={testConnection}
                  disabled={testingConnection}
                  className={`w-full inline-flex justify-center items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium
                    ${testingConnection ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "text-gray-700 bg-white hover:bg-gray-50"}`}
                >
                  {testingConnection ? (
                    <>
                      <svg className="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24">
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
                      Probando conexión...
                    </>
                  ) : (
                    <>
                      <svg
                        className="h-4 w-4 mr-2"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 10V3L4 14h7v7l9-11h-7z"
                        />
                      </svg>
                      Probar Conexión
                    </>
                  )}
                </button>
                {connectionResult && (
                  <div
                    className={`mt-2 p-3 rounded-md ${connectionResult.success ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}
                  >
                    <p className="text-sm">{connectionResult.message}</p>
                    {connectionResult.recordCount !== undefined && (
                      <p className="text-xs mt-1">
                        Registros disponibles: {connectionResult.recordCount}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Dry Run */}
              <div>
                <button
                  onClick={() => triggerSync(true)}
                  disabled={syncing || !dataSource.isActive}
                  className={`w-full inline-flex justify-center items-center px-4 py-2 border border-yellow-300 rounded-md shadow-sm text-sm font-medium
                    ${syncing || !dataSource.isActive ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "text-yellow-700 bg-yellow-50 hover:bg-yellow-100"}`}
                >
                  <svg
                    className="h-4 w-4 mr-2"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                    />
                  </svg>
                  Simulación (Dry Run)
                </button>
                <p className="mt-1 text-xs text-gray-500">
                  Simula la sincronización sin guardar cambios
                </p>
              </div>

              {/* Full Sync */}
              <div>
                <button
                  onClick={() => triggerSync(false)}
                  disabled={syncing || !dataSource.isActive}
                  className={`w-full inline-flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white
                    ${syncing || !dataSource.isActive ? "bg-gray-400 cursor-not-allowed" : "bg-green-600 hover:bg-green-700"}`}
                >
                  {syncing ? (
                    <>
                      <svg className="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24">
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
                        className="h-4 w-4 mr-2"
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
                      Ejecutar Sincronización
                    </>
                  )}
                </button>
              </div>

              {/* Sync Result */}
              {syncResult && (
                <div className="mt-4 p-4 bg-gray-50 rounded-md">
                  <h3 className="text-sm font-medium text-gray-900 mb-2">
                    Resultado de Sincronización
                  </h3>
                  <dl className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <dt className="text-gray-500">Job ID</dt>
                      <dd className="font-mono text-xs">{syncResult.jobId}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Estado</dt>
                      <dd>{getStatusBadge(syncResult.progress.status)}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Procesados</dt>
                      <dd className="font-semibold">
                        {syncResult.stats.processed} / {syncResult.stats.total}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Creados</dt>
                      <dd className="text-green-600 font-semibold">{syncResult.stats.created}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Omitidos</dt>
                      <dd className="text-gray-600 font-semibold">{syncResult.stats.skipped}</dd>
                    </div>
                    {syncResult.stats.failed > 0 && (
                      <div className="col-span-2">
                        <dt className="text-gray-500">Errores</dt>
                        <dd className="text-red-600 font-semibold">{syncResult.stats.failed}</dd>
                      </div>
                    )}
                  </dl>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Preview Section */}
        <div className="mt-8 bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-medium text-gray-900">Vista Previa de Datos</h2>
            <button
              onClick={loadPreview}
              disabled={loadingPreview}
              className={`inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded-md
                ${loadingPreview ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "text-gray-700 bg-white hover:bg-gray-50"}`}
            >
              {loadingPreview ? "Cargando..." : "Cargar Preview"}
            </button>
          </div>
          <div className="px-6 py-4">
            {preview.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">
                Haz clic en &quot;Cargar Preview&quot; para ver una muestra de los datos de la
                fuente externa
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        ID Externo
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Datos Mapeados
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Estado
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {preview.map((record, index) => (
                      <tr key={index}>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-mono text-gray-900">
                          {record.externalId}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          <pre className="text-xs bg-gray-50 p-2 rounded overflow-x-auto max-w-xl">
                            {JSON.stringify(record.fields, null, 2)}
                          </pre>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1">
                              <span
                                className={`inline-block w-2 h-2 rounded-full ${record.hasCoordinates ? "bg-green-400" : "bg-red-400"}`}
                              ></span>
                              <span className="text-xs">
                                {record.hasCoordinates ? "Con coordenadas" : "Sin coordenadas"}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span
                                className={`inline-block w-2 h-2 rounded-full ${record.hasMinimumFields ? "bg-green-400" : "bg-yellow-400"}`}
                              ></span>
                              <span className="text-xs">
                                {record.hasMinimumFields
                                  ? "Campos completos"
                                  : "Campos incompletos"}
                              </span>
                            </div>
                            {record.missingFields.length > 0 && (
                              <div className="text-xs text-red-600">
                                Falta: {record.missingFields.join(", ")}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Field Mapping */}
        {dataSource.fieldMapping && (
          <div className="mt-8 bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">Mapeo de Campos</h2>
            </div>
            <div className="px-6 py-4">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Campo Interno
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Campo Externo
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {Object.entries(dataSource.fieldMapping).map(([internal, external]) => (
                      <tr key={internal}>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                          {internal}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 font-mono">
                          {external}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
