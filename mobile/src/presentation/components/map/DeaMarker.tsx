import React, { useMemo } from "react";
import { Marker, Popup } from "react-leaflet";
import L from "leaflet";

import { AedMapMarker } from "../../../domain/models/Aed";

interface DeaMarkerProps {
  aed: AedMapMarker;
  onSelect: (aed: AedMapMarker) => void;
}

const deaIcon = L.divIcon({
  html: `<div style="
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: linear-gradient(135deg, #3b82f6, #8b5cf6);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    border: 2px solid white;
  ">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
      <path d="M13 3L4 14h7l-2 7 9-11h-7l2-7z"/>
    </svg>
  </div>`,
  className: "",
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

const DeaMarker: React.FC<DeaMarkerProps> = React.memo(({ aed, onSelect }) => {
  const eventHandlers = useMemo(() => ({ click: () => onSelect(aed) }), [aed, onSelect]);

  return (
    <Marker position={[aed.latitude, aed.longitude]} icon={deaIcon} eventHandlers={eventHandlers}>
      <Popup>
        <strong>{aed.name}</strong>
        {aed.establishment_type && (
          <>
            <br />
            <small>{aed.establishment_type}</small>
          </>
        )}
      </Popup>
    </Marker>
  );
});

DeaMarker.displayName = "DeaMarker";

export default DeaMarker;
