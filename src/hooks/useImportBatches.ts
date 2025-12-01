/**
 * Hook para gestionar lista de importaciones con polling automático
 */

import { useEffect, useState, useCallback, useRef } from "react";
import toast from "react-hot-toast";

import type { ImportBatch, Pagination } from "@/types/import";

interface UseImportBatchesOptions {
  page?: number;
  limit?: number;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

interface UseImportBatchesReturn {
  batches: ImportBatch[];
  loading: boolean;
  error: string | null;
  pagination: Pagination | null;
  refetch: () => Promise<void>;
}

export function useImportBatches(
  options: UseImportBatchesOptions = {}
): UseImportBatchesReturn {
  const {
    page = 1,
    limit = 20,
    autoRefresh = true,
    refreshInterval = 5000,
  } = options;

  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const previousBatchesRef = useRef<ImportBatch[]>([]);

  const fetchBatches = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/import?page=${page}&limit=${limit}`);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Error al obtener importaciones");
      }

      const data = await response.json();
      setBatches(data.batches || []);
      setPagination(data.pagination || null);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Error desconocido";
      setError(message);
      console.error("Error fetching import batches:", err);
    } finally {
      setLoading(false);
    }
  }, [page, limit]);

  // Cargar datos iniciales
  useEffect(() => {
    fetchBatches();
  }, [fetchBatches]);

  // Detectar cambios de estado y mostrar notificaciones
  useEffect(() => {
    if (previousBatchesRef.current.length === 0) {
      // Primera carga, guardar y salir
      previousBatchesRef.current = batches;
      return;
    }

    // Detectar batches que cambiaron de IN_PROGRESS a otro estado
    batches.forEach((currentBatch) => {
      const previousBatch = previousBatchesRef.current.find(
        (b) => b.id === currentBatch.id
      );

      if (!previousBatch) return; // Nuevo batch, ignorar

      // Detectar si cambió de IN_PROGRESS a COMPLETED/ERRORS/FAILED
      const wasInProgress = previousBatch.status === "IN_PROGRESS";
      const isNowFinished =
        currentBatch.status === "COMPLETED" ||
        currentBatch.status === "COMPLETED_WITH_ERRORS" ||
        currentBatch.status === "FAILED";

      if (wasInProgress && isNowFinished) {
        // Mostrar notificación según el resultado
        if (currentBatch.status === "COMPLETED") {
          toast.success(
            `✅ Importación "${currentBatch.name}" completada: ${currentBatch.successful_records} registros exitosos`,
            {
              duration: 5000,
            }
          );
        } else if (currentBatch.status === "COMPLETED_WITH_ERRORS") {
          toast.error(
            `⚠️ Importación "${currentBatch.name}" completada con ${currentBatch.failed_records} errores`,
            {
              duration: 6000,
            }
          );
        } else if (currentBatch.status === "FAILED") {
          toast.error(
            `❌ Importación "${currentBatch.name}" falló completamente`,
            {
              duration: 6000,
            }
          );
        }
      }
    });

    // Actualizar referencia
    previousBatchesRef.current = batches;
  }, [batches]);

  // Polling: solo actualizar si hay batches activos
  useEffect(() => {
    if (!autoRefresh) return;

    // Verificar si hay batches activos (IN_PROGRESS o PENDING)
    const hasActiveBatches = batches.some(
      (b) => b.status === "IN_PROGRESS" || b.status === "PENDING"
    );

    if (!hasActiveBatches) return;

    console.log(
      `🔄 Polling active: ${batches.filter((b) => b.status === "IN_PROGRESS" || b.status === "PENDING").length} active batches`
    );

    const interval = setInterval(() => {
      fetchBatches();
    }, refreshInterval);

    return () => {
      clearInterval(interval);
      console.log("🛑 Polling stopped");
    };
  }, [batches, autoRefresh, refreshInterval, fetchBatches]);

  return {
    batches,
    loading,
    error,
    pagination,
    refetch: fetchBatches,
  };
}
