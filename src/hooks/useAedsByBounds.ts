/**
 * Hook to fetch AEDs by geographic bounding box with server-side clustering
 * Optimized for map visualization with debouncing and caching
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
 * Custom hook to fetch AEDs within a bounding box
 * Features:
 * - Debouncing to avoid excessive API calls
 * - Automatic abort of previous requests
 * - Loading and error states
 * - Truncation detection
 */
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

  // Ref to store the abort controller for cancellation
  // eslint-disable-next-line no-undef
  const abortControllerRef = useRef<AbortController | null>(null);

  // Ref to store the debounce timeout
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchAeds = useCallback(async (boundingBox: BoundingBox, zoomLevel: number) => {
    try {
      // Cancel any ongoing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Create new abort controller
      // eslint-disable-next-line no-undef
      abortControllerRef.current = new AbortController();

      setLoading(true);
      setError(null);

      // Build query params
      const params = new URLSearchParams({
        minLat: boundingBox.minLat.toString(),
        maxLat: boundingBox.maxLat.toString(),
        minLng: boundingBox.minLng.toString(),
        maxLng: boundingBox.maxLng.toString(),
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
      } else {
        throw new Error("Invalid response from server");
      }
    } catch (err) {
      // Ignore abort errors
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
      // Clear existing timeout
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }

      // Set new timeout
      debounceTimeoutRef.current = setTimeout(() => {
        fetchAeds(boundingBox, zoomLevel);
      }, debounceMs);
    },
    [fetchAeds, debounceMs]
  );

  // Effect to fetch AEDs when bounds or zoom changes
  useEffect(() => {
    if (!bounds) {
      return;
    }

    debouncedFetch(bounds, zoom);

    // Cleanup function
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
