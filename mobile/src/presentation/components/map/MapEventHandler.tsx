import React from "react";
import { useMap, useMapEvents } from "react-leaflet";

import { BoundingBox } from "../../../domain/models/Location";

interface MapEventHandlerProps {
  onBoundsChange: (bounds: BoundingBox, zoom: number) => void;
}

const MapEventHandler: React.FC<MapEventHandlerProps> = ({ onBoundsChange }) => {
  const map = useMap();

  const handleMapChange = () => {
    const b = map.getBounds();
    const zoom = map.getZoom();
    onBoundsChange(
      {
        minLat: b.getSouth(),
        maxLat: b.getNorth(),
        minLng: b.getWest(),
        maxLng: b.getEast(),
      },
      zoom
    );
  };

  // Only listen to moveend — Leaflet fires moveend after every zoom change too
  useMapEvents({
    moveend: handleMapChange,
  });

  return null;
};

export default MapEventHandler;
