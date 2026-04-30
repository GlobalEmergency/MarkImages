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
  const requestIdRef = useRef(0);

  const fetchDetail = useCallback(async () => {
    if (!aedId) return;
    const thisRequest = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const data = await getAedDetailUseCase.execute(aedId);
      if (thisRequest === requestIdRef.current) setAed(data);
    } catch (err) {
      if (thisRequest === requestIdRef.current) {
        setError(err instanceof Error ? err.message : "Error cargando detalle");
      }
    } finally {
      if (thisRequest === requestIdRef.current) setLoading(false);
    }
  }, [aedId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  return { aed, loading, error, refetch: fetchDetail };
}
