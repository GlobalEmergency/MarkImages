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

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(false);
  const requestIdRef = useRef(0);

  const fetchData = useCallback(async (b: BoundingBox, z: number) => {
    // Track request id so only the latest response updates state
    const currentRequestId = ++requestIdRef.current;

    setLoading(true);
    setError(null);

    try {
      const response = await getAedsByBoundsUseCase.execute(b, z);
      if (mountedRef.current && currentRequestId === requestIdRef.current) {
        setMarkers(response.markers);
        setClusters(response.clusters);
        setStats(response.stats);
      }
    } catch (err) {
      if (mountedRef.current && currentRequestId === requestIdRef.current) {
        setError(err instanceof Error ? err.message : "Error cargando DEAs");
      }
    } finally {
      if (mountedRef.current && currentRequestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, []);

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

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return { markers, clusters, loading, error, stats };
}
