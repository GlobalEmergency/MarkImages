/**
 * MapEventHandler - Listens to Leaflet map movement events.
 * Only listens to moveend (which fires on zoom changes too),
 * avoiding duplicate event handling.
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

  useMapEvents({
    moveend: () => {
      onMove(map);
    },
    // zoomend removed - moveend fires after zoom changes too
  });

  useEffect(() => {
    if (initialLoad) {
      onMove(map);
    }
  }, [map, onMove, initialLoad]);

  return null;
}
