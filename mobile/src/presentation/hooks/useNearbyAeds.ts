import { useCallback, useEffect, useRef, useState } from "react";

import { NearbyAed } from "../../domain/models/Aed";
import { Coordinates } from "../../domain/models/Location";
import { getNearbyAedsUseCase, geolocationService } from "../../infrastructure/di/container";

interface UseNearbyAedsResult {
  aeds: NearbyAed[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  position: Coordinates | null;
  refresh: () => Promise<void>;
  locationDenied: boolean;
}

export function useNearbyAeds(radius = 5, limit = 20): UseNearbyAedsResult {
  const [aeds, setAeds] = useState<NearbyAed[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [position, setPosition] = useState<Coordinates | null>(null);
  const [locationDenied, setLocationDenied] = useState(false);
  const mountedRef = useRef(true);

  const fetchNearby = useCallback(
    async (coords: Coordinates, isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const data = await getNearbyAedsUseCase.execute(
          coords.latitude,
          coords.longitude,
          radius,
          limit
        );
        if (mountedRef.current) setAeds(data);
      } catch (err) {
        if (mountedRef.current) {
          setError(err instanceof Error ? err.message : "Error cargando DEAs cercanos");
        }
      } finally {
        if (mountedRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [radius, limit]
  );

  const initLocation = useCallback(async () => {
    try {
      const hasPermission = await geolocationService.checkPermission();
      if (!hasPermission) {
        const granted = await geolocationService.requestPermission();
        if (!granted) {
          if (mountedRef.current) {
            setLocationDenied(true);
            setLoading(false);
          }
          return;
        }
      }
      const coords = await geolocationService.getCurrentPosition();
      if (mountedRef.current) {
        setPosition(coords);
        await fetchNearby(coords);
      }
    } catch {
      if (mountedRef.current) {
        setError("No se pudo obtener la ubicación");
        setLoading(false);
      }
    }
  }, [fetchNearby]);

  useEffect(() => {
    mountedRef.current = true;
    initLocation();
    return () => {
      mountedRef.current = false;
    };
  }, [initLocation]);

  const refresh = useCallback(async () => {
    if (position) {
      await fetchNearby(position, true);
    } else {
      await initLocation();
    }
  }, [position, fetchNearby, initLocation]);

  return { aeds, loading, refreshing, error, position, refresh, locationDenied };
}
