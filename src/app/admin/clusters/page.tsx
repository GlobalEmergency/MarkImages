"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface CacheMetadata {
  last_regenerated: string;
  total_aeds: number;
  total_clusters: number;
  duration_ms: number;
}

interface ZoomStat {
  zoomLevel: number;
  clusterCount: number;
}

interface CacheStatus {
  metadata: CacheMetadata | null;
  stats: ZoomStat[];
  totalClusters: number;
  isEmpty: boolean;
}

type RegenerationPhase = "idle" | "starting" | "processing" | "finalizing" | "done" | "error";

export default function AdminClustersPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [cacheStatus, setCacheStatus] = useState<CacheStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Regeneration state
  const [phase, setPhase] = useState<RegenerationPhase>("idle");
  const [zoomLevels, setZoomLevels] = useState<number[]>([]);
  const [currentZoomIndex, setCurrentZoomIndex] = useState(0);
  const [processedZooms, setProcessedZooms] = useState<
    Array<{ zoomLevel: number; clustersGenerated: number; durationMs: number }>
  >([]);
  const [totalAeds, setTotalAeds] = useState(0);
  const [regenError, setRegenError] = useState<string | null>(null);
  const startTimeRef = useRef(0);
  const abortRef = useRef(false);

  const fetchCacheStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/clusters");
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      const data = await res.json();
      if (data.success) {
        setCacheStatus(data.data);
      }
    } catch {
      setError("Error al cargar estado de la cache");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    // Auth check
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (!data.user || data.user.role !== "ADMIN") {
          router.push("/");
          return;
        }
        fetchCacheStatus();
      })
      .catch(() => router.push("/login"));
  }, [router, fetchCacheStatus]);

  const runRegeneration = useCallback(async () => {
    abortRef.current = false;
    setPhase("starting");
    setRegenError(null);
    setProcessedZooms([]);
    setCurrentZoomIndex(0);
    startTimeRef.current = Date.now();

    try {
      // Step 1: Start - clear cache, get zoom levels
      const startRes = await fetch("/api/admin/clusters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      });
      const startData = await startRes.json();
      if (!startData.success) throw new Error(startData.error);

      const levels: number[] = startData.data.zoomLevels;
      const aedCount: number = startData.data.totalAeds;
      setZoomLevels(levels);
      setTotalAeds(aedCount);
      setPhase("processing");

      // Step 2: Process each zoom level sequentially
      let totalClusters = 0;
      const results: Array<{ zoomLevel: number; clustersGenerated: number; durationMs: number }> =
        [];

      for (let i = 0; i < levels.length; i++) {
        if (abortRef.current) break;

        setCurrentZoomIndex(i);
        const processRes = await fetch("/api/admin/clusters", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "process", zoomLevel: levels[i] }),
        });
        const processData = await processRes.json();
        if (!processData.success) throw new Error(processData.error);

        const result = processData.data;
        totalClusters += result.clustersGenerated;
        results.push(result);
        setProcessedZooms([...results]);
      }

      if (abortRef.current) {
        setPhase("idle");
        return;
      }

      // Step 3: Finalize
      setPhase("finalizing");
      const totalDurationMs = Date.now() - startTimeRef.current;
      await fetch("/api/admin/clusters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "finalize",
          totalAeds: aedCount,
          totalClusters,
          totalDurationMs,
        }),
      });

      setPhase("done");
      // Refresh status
      await fetchCacheStatus();
    } catch (err) {
      setRegenError(err instanceof Error ? err.message : "Error desconocido");
      setPhase("error");
    }
  }, [fetchCacheStatus]);

  const progressPercent =
    zoomLevels.length > 0 ? Math.round((processedZooms.length / zoomLevels.length) * 100) : 0;

  const isRunning = phase === "starting" || phase === "processing" || phase === "finalizing";

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <Link href="/admin" className="text-sm text-blue-600 hover:text-blue-800 mb-2 block">
            &larr; Volver al panel
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Cache de Clusters del Mapa</h1>
          <p className="mt-2 text-sm text-gray-600">
            Los clusters pre-computados permiten renderizar el mapa con millones de puntos de forma
            instantánea. Sin la cache, cada movimiento del mapa requiere una query pesada sobre
            todos los DEAs.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Current Status Card */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="px-6 py-5 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Estado actual</h2>
          </div>
          <div className="px-6 py-5">
            {cacheStatus?.isEmpty ? (
              <div className="text-center py-8">
                <svg
                  className="mx-auto h-12 w-12 text-yellow-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
                <h3 className="mt-4 text-lg font-medium text-gray-900">Cache vacía</h3>
                <p className="mt-2 text-sm text-gray-500">
                  El mapa está usando queries en tiempo real, lo que puede ser lento con muchos
                  puntos. Genera la cache para mejorar el rendimiento.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
                <div>
                  <p className="text-sm text-gray-500">Total clusters</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {cacheStatus?.totalClusters.toLocaleString("es-ES")}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">DEAs indexados</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {cacheStatus?.metadata?.total_aeds.toLocaleString("es-ES") ?? "-"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Tiempo de generación</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {cacheStatus?.metadata
                      ? `${(cacheStatus.metadata.duration_ms / 1000).toFixed(1)}s`
                      : "-"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Última actualización</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {cacheStatus?.metadata
                      ? new Date(cacheStatus.metadata.last_regenerated).toLocaleString("es-ES")
                      : "-"}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Zoom levels breakdown */}
        {cacheStatus && !cacheStatus.isEmpty && cacheStatus.stats.length > 0 && (
          <div className="bg-white rounded-lg shadow mb-6">
            <div className="px-6 py-5 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Clusters por nivel de zoom</h2>
            </div>
            <div className="px-6 py-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
                {cacheStatus.stats.map((stat) => (
                  <div key={stat.zoomLevel} className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-500">Zoom {stat.zoomLevel}</p>
                    <p className="text-lg font-bold text-gray-900">
                      {stat.clusterCount.toLocaleString("es-ES")}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Regeneration Card */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="px-6 py-5 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Regenerar cache</h2>
            <p className="mt-1 text-sm text-gray-500">
              Recalcula los clusters para todos los niveles de zoom. Se procesa un nivel a la vez
              para evitar timeouts. La cache anterior se borra al comenzar.
            </p>
          </div>
          <div className="px-6 py-5">
            {/* Progress bar when running */}
            {isRunning && (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">
                    {phase === "starting" && "Iniciando..."}
                    {phase === "processing" &&
                      `Procesando zoom ${zoomLevels[currentZoomIndex]} (${processedZooms.length + 1}/${zoomLevels.length})`}
                    {phase === "finalizing" && "Finalizando..."}
                  </span>
                  <span className="text-sm font-medium text-blue-600">{progressPercent}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-blue-600 h-3 rounded-full transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                {totalAeds > 0 && (
                  <p className="mt-2 text-xs text-gray-500">
                    Procesando {totalAeds.toLocaleString("es-ES")} DEAs publicados
                  </p>
                )}
              </div>
            )}

            {/* Processed zoom levels log */}
            {processedZooms.length > 0 && (
              <div className="mb-6 max-h-48 overflow-y-auto">
                <div className="space-y-1">
                  {processedZooms.map((z) => (
                    <div
                      key={z.zoomLevel}
                      className="flex items-center justify-between text-sm py-1 px-3 bg-green-50 rounded"
                    >
                      <span className="text-green-800">
                        Zoom {z.zoomLevel} — {z.clustersGenerated.toLocaleString("es-ES")} clusters
                      </span>
                      <span className="text-green-600">{(z.durationMs / 1000).toFixed(1)}s</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Done message */}
            {phase === "done" && (
              <div className="mb-6 bg-green-50 border-l-4 border-green-400 p-4">
                <p className="text-sm text-green-800 font-medium">
                  Cache regenerada correctamente en{" "}
                  {((Date.now() - startTimeRef.current) / 1000).toFixed(1)}s
                </p>
              </div>
            )}

            {/* Error message */}
            {phase === "error" && regenError && (
              <div className="mb-6 bg-red-50 border-l-4 border-red-400 p-4">
                <p className="text-sm text-red-700">{regenError}</p>
              </div>
            )}

            {/* Action button */}
            <button
              onClick={runRegeneration}
              disabled={isRunning}
              className={`w-full sm:w-auto px-6 py-3 rounded-lg text-sm font-medium transition-all ${
                isRunning
                  ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                  : "bg-blue-600 text-white hover:bg-blue-700 shadow hover:shadow-lg"
              }`}
            >
              {isRunning ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Procesando...
                </span>
              ) : cacheStatus?.isEmpty ? (
                "Generar cache de clusters"
              ) : (
                "Regenerar cache"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
