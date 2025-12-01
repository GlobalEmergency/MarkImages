/**
 * Hook para obtener detalles y errores de un batch específico
 */

import { useEffect, useState } from "react";

import type { ImportError } from "@/types/import";

interface BatchDetails {
  batch: {
    id: string;
    name: string;
    status: string;
    createdAt: string;
    startedAt: string | null;
    completedAt: string | null;
  };
  progress: {
    total: number;
    successful: number;
    failed: number;
    percentage: number;
  };
  stats: {
    durationSeconds: number | null;
  };
}

export function useImportDetails(batchId: string | null) {
  const [batch, setBatch] = useState<BatchDetails | null>(null);
  const [errors, setErrors] = useState<ImportError[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!batchId) {
      setBatch(null);
      setErrors([]);
      return;
    }

    const fetchDetails = async () => {
      setLoading(true);
      setError(null);

      try {
        const [batchRes, errorsRes] = await Promise.all([
          fetch(`/api/import/${batchId}`),
          fetch(`/api/import/${batchId}/errors`),
        ]);

        if (!batchRes.ok) {
          const batchData = await batchRes.json();
          throw new Error(batchData.error || "Error al obtener detalles del batch");
        }

        if (!errorsRes.ok) {
          const errorsData = await errorsRes.json();
          throw new Error(errorsData.error || "Error al obtener errores");
        }

        const batchData = await batchRes.json();
        const errorsData = await errorsRes.json();

        setBatch(batchData.data);
        setErrors(errorsData.errors || []);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Error desconocido";
        setError(message);
        console.error("Error fetching import details:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [batchId]);

  return { batch, errors, loading, error };
}
