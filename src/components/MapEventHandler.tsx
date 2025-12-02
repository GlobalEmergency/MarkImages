/**
 * MapEventHandler - Component to handle Leaflet map events
 *
 * This component listens to map movement and zoom events
 * and calls the provided callback with the current map instance
 */

"use client";

import { useMap, useMapEvents } from "react-leaflet";
import { useEffect } from "react";
import type { Map } from "leaflet";

interface MapEventHandlerProps {
  onMove: (map: Map) => void;
  initialLoad?: boolean;
}

export function MapEventHandler({ onMove, initialLoad = true }: MapEventHandlerProps) {
  const map = useMap();

  // Listen to map events
  useMapEvents({
    moveend: () => {
      onMove(map);
    },
    zoomend: () => {
      onMove(map);
    },
  });

  // Call onMove on initial load
  useEffect(() => {
    if (initialLoad) {
      onMove(map);
    }
  }, [map, onMove, initialLoad]);

  return null;
}
