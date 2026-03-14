/**
 * Hook to fetch AEDs by geographic bounding box with server-side clustering.
 * Optimized: skips fetches when bounds haven't changed significantly,
 * uses AbortController for request cancellation, debounced.
 */

import { useState, useEffect, useCallback, useRef } from "react";

import type { AedMapMarker, AedCluster, BoundingBox, ClusteredAedsResponse } from "@/types/aed";

interface UseAedsByBoundsResult {
  aeds: AedMapMarker[];
  clusters: AedCluster[];
  loading: boolean;
  error: string | null;
  stats: {
    total_in_view: number;
    clustered: number;
    individual: number;
  };
  strategy: string;
  refetch: () => void;
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

  // Threshold: ~1% of the viewport size
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
  debounceMs: number = 300
): UseAedsByBoundsResult {
  const [aeds, setAeds] = useState<AedMapMarker[]>([]);
  const [clusters, setClusters] = useState<AedCluster[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({
    total_in_view: 0,
    clustered: 0,
    individual: 0,
  });
  const [strategy, setStrategy] = useState<string>("full");

  // eslint-disable-next-line no-undef
  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastFetchedBoundsRef = useRef<BoundingBox | null>(null);
  const lastFetchedZoomRef = useRef<number>(0);

  const fetchAeds = useCallback(async (boundingBox: BoundingBox, zoomLevel: number) => {
    // Skip if bounds haven't changed significantly
    if (
      !boundsChangedSignificantly(
        lastFetchedBoundsRef.current,
        boundingBox,
        lastFetchedZoomRef.current,
        zoomLevel
      )
    ) {
      return;
    }

    try {
      // Cancel any ongoing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // eslint-disable-next-line no-undef
      abortControllerRef.current = new AbortController();

      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        minLat: boundingBox.minLat.toFixed(6),
        maxLat: boundingBox.maxLat.toFixed(6),
        minLng: boundingBox.minLng.toFixed(6),
        maxLng: boundingBox.maxLng.toFixed(6),
        zoom: zoomLevel.toString(),
      });

      const response = await fetch(`/api/aeds/by-bounds?${params.toString()}`, {
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: ClusteredAedsResponse = await response.json();

      if (data.success) {
        setAeds(data.data.markers);
        setClusters(data.data.clusters);
        setStats(data.stats);
        setStrategy(data.strategy);
        lastFetchedBoundsRef.current = boundingBox;
        lastFetchedZoomRef.current = zoomLevel;
      } else {
        throw new Error("Invalid response from server");
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      setError(err instanceof Error ? err.message : "Unknown error");
      console.error("Error fetching AEDs by bounds:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const debouncedFetch = useCallback(
    (boundingBox: BoundingBox, zoomLevel: number) => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }

      debounceTimeoutRef.current = setTimeout(() => {
        fetchAeds(boundingBox, zoomLevel);
      }, debounceMs);
    },
    [fetchAeds, debounceMs]
  );

  useEffect(() => {
    if (!bounds) return;

    debouncedFetch(bounds, zoom);

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [bounds, zoom, debouncedFetch]);

  const refetch = useCallback(() => {
    if (bounds) {
      // Force refetch by clearing last fetched bounds
      lastFetchedBoundsRef.current = null;
      fetchAeds(bounds, zoom);
    }
  }, [bounds, zoom, fetchAeds]);

  return {
    aeds,
    clusters,
    loading,
    error,
    stats,
    strategy,
    refetch,
  };
}
