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

/**
 * Check if bounds have changed significantly enough to warrant a re-fetch.
 * Avoids refetching on sub-pixel map movements.
 */
function boundsChangedSignificantly(
  prev: BoundingBox | null,
  next: BoundingBox,
  prevZoom: number,
  nextZoom: number
): boolean {
  if (!prev) return true;
  if (prevZoom !== nextZoom) return true;

  const latSpan = next.maxLat - next.minLat;
  const lngSpan = next.maxLng - next.minLng;
  const threshold = Math.min(latSpan, lngSpan) * 0.01;

  return (
    Math.abs(prev.minLat - next.minLat) > threshold ||
    Math.abs(prev.maxLat - next.maxLat) > threshold ||
    Math.abs(prev.minLng - next.minLng) > threshold ||
    Math.abs(prev.maxLng - next.maxLng) > threshold
  );
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
  const lastFetchedBoundsRef = useRef<BoundingBox | null>(null);
  const lastFetchedZoomRef = useRef(0);

  const fetchData = useCallback(async (b: BoundingBox, z: number) => {
    if (
      !boundsChangedSignificantly(lastFetchedBoundsRef.current, b, lastFetchedZoomRef.current, z)
    ) {
      return;
    }

    const currentRequestId = ++requestIdRef.current;

    setLoading(true);
    setError(null);

    try {
      const response = await getAedsByBoundsUseCase.execute(b, z);
      if (mountedRef.current && currentRequestId === requestIdRef.current) {
        setMarkers(response.markers);
        setClusters(response.clusters);
        setStats(response.stats);
        lastFetchedBoundsRef.current = b;
        lastFetchedZoomRef.current = z;
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
