"use client";

import { useState, useCallback } from "react";

interface AddressData {
  street: string;
  number: string;
  city: string;
  postalCode: string;
  country: string;
}

interface GeolocationState {
  geolocating: boolean;
  reverseGeocoding: boolean;
  error: string | null;
}

interface UseGeolocationReturn extends GeolocationState {
  /** Request the user's current GPS position and reverse geocode it */
  requestPosition: () => void;
  /** Reverse geocode arbitrary coordinates into an address */
  reverseGeocode: (lat: number, lng: number) => Promise<AddressData | null>;
}

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org/reverse";

/**
 * Extracts address fields from a Nominatim reverse geocoding response.
 *
 * Nominatim returns different keys depending on location density
 * (road vs pedestrian vs footway, city vs town vs village), so we
 * apply a priority chain for each field.
 */
function parseNominatimAddress(address: Record<string, string>): AddressData {
  return {
    street: address.road || address.pedestrian || address.footway || "",
    number: address.house_number || "",
    city: address.city || address.town || address.village || address.municipality || "",
    postalCode: address.postcode || "",
    country: address.country || "",
  };
}

/**
 * Hook that encapsulates browser geolocation and Nominatim reverse geocoding.
 *
 * SRP: Only responsible for obtaining coordinates and translating them to an address.
 * The consumer decides what to do with the results (e.g. update form state).
 *
 * @param onPosition Called when coordinates are obtained (GPS or manual)
 * @param onAddress  Called when reverse geocoding produces an address
 */
export function useGeolocation(
  onPosition: (lat: number, lng: number) => void,
  onAddress: (address: AddressData) => void
): UseGeolocationReturn {
  const [state, setState] = useState<GeolocationState>({
    geolocating: false,
    reverseGeocoding: false,
    error: null,
  });

  const reverseGeocode = useCallback(
    async (lat: number, lng: number): Promise<AddressData | null> => {
      setState((prev) => ({ ...prev, reverseGeocoding: true }));
      try {
        const res = await fetch(
          `${NOMINATIM_BASE}?lat=${lat}&lon=${lng}&format=json&addressdetails=1&accept-language=es`,
          { headers: { "User-Agent": "DeaMap/1.0" } }
        );
        if (!res.ok) return null;

        const data = await res.json();
        const address = parseNominatimAddress(data.address || {});
        onAddress(address);
        return address;
      } catch {
        // Reverse geocoding is best-effort; user can still fill fields manually
        return null;
      } finally {
        setState((prev) => ({ ...prev, reverseGeocoding: false }));
      }
    },
    [onAddress]
  );

  const requestPosition = useCallback(() => {
    if (!navigator.geolocation) {
      setState((prev) => ({
        ...prev,
        error: "Tu navegador no soporta geolocalización",
      }));
      return;
    }

    setState({ geolocating: true, reverseGeocoding: false, error: null });

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        onPosition(latitude, longitude);
        await reverseGeocode(latitude, longitude);
        setState((prev) => ({ ...prev, geolocating: false }));
      },
      (err) => {
        const messages: Record<number, string> = {
          [err.PERMISSION_DENIED]:
            "Permiso de ubicación denegado. Actívalo en la configuración del navegador.",
          [err.POSITION_UNAVAILABLE]: "No se pudo determinar tu ubicación.",
          [err.TIMEOUT]: "Se agotó el tiempo para obtener la ubicación.",
        };
        setState({
          geolocating: false,
          reverseGeocoding: false,
          error: messages[err.code] || "Error de geolocalización desconocido.",
        });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, [onPosition, reverseGeocode]);

  return {
    ...state,
    requestPosition,
    reverseGeocode,
  };
}

export type { AddressData };
