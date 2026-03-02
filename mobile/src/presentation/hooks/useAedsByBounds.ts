import { useCallback, useEffect, useRef, useState } from "react";

import { AedCluster, AedMapMarker } from "../../domain/models/Aed";
import { BoundingBox } from "../../domain/models/Location";
import { getAedsByBoundsUseCase } from "../../infrastructure/di/container";

interface UseAedsByBoundsResult {
  markers: AedMapMarker[];
  clusters: AedCluster[];
  loading: boolean;
  error: string | null;
  stats: { total_in_view: number; clustered: number; individual: number } | null;
}

export function useAedsByBounds(
  bounds: BoundingBox | null,
  zoom: number,
  debounceMs = 300
): UseAedsByBoundsResult {
  const [markers, setMarkers] = useState<AedMapMarker[]>([]);
  const [clusters, setClusters] = useState<AedCluster[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<UseAedsByBoundsResult["stats"]>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchData = useCallback(
    async (b: BoundingBox, z: number) => {
      // Cancel previous request
      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();

      setLoading(true);
      setError(null);

      try {
        const response = await getAedsByBoundsUseCase.execute(b, z);
        setMarkers(response.data.markers);
        setClusters(response.data.clusters);
        setStats(response.stats);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Error cargando DEAs");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!bounds) return;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      fetchData(bounds, zoom);
    }, debounceMs);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [bounds, zoom, debounceMs, fetchData]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return { markers, clusters, loading, error, stats };
}
