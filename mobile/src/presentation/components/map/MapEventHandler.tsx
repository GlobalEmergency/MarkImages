import { useMapEvents } from "react-leaflet";

import { BoundingBox } from "../../../domain/models/Location";

interface MapEventHandlerProps {
  onBoundsChange: (bounds: BoundingBox, zoom: number) => void;
}

const MapEventHandler: React.FC<MapEventHandlerProps> = ({ onBoundsChange }) => {
  useMapEvents({
    moveend: (e) => {
      const map = e.target;
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
    },
    zoomend: (e) => {
      const map = e.target;
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
    },
  });

  return null;
};

export default MapEventHandler;
