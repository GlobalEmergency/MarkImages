import { useCallback, useEffect, useRef, useState } from "react";

import { Aed } from "../../domain/models/Aed";
import { getAedDetailUseCase } from "../../infrastructure/di/container";

interface UseAedDetailResult {
  aed: Aed | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useAedDetail(aedId: string | null | undefined): UseAedDetailResult {
  const [aed, setAed] = useState<Aed | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetchDetail = useCallback(async () => {
    if (!aedId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getAedDetailUseCase.execute(aedId);
      if (mountedRef.current) setAed(data);
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : "Error cargando detalle");
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [aedId]);

  useEffect(() => {
    mountedRef.current = true;
    fetchDetail();
    return () => {
      mountedRef.current = false;
    };
  }, [fetchDetail]);

  return { aed, loading, error, refetch: fetchDetail };
}
