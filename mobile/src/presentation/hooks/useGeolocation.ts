import { useCallback, useState } from "react";

import { Coordinates } from "../../domain/models/Location";
import { geolocationService } from "../../infrastructure/di/container";

interface UseGeolocationResult {
  position: Coordinates | null;
  loading: boolean;
  error: string | null;
  getCurrentPosition: () => Promise<Coordinates | null>;
}

export function useGeolocation(): UseGeolocationResult {
  const [position, setPosition] = useState<Coordinates | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getCurrentPosition = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const hasPermission = await geolocationService.checkPermission();
      if (!hasPermission) {
        const granted = await geolocationService.requestPermission();
        if (!granted) {
          setError("Permiso de ubicación denegado");
          setLoading(false);
          return null;
        }
      }

      const coords = await geolocationService.getCurrentPosition();
      setPosition(coords);
      return coords;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error obteniendo ubicación";
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { position, loading, error, getCurrentPosition };
}
