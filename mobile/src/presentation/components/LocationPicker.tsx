import React, { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";

import { Coordinates } from "../../domain/models/Location";
import { DEFAULT_MAP_CENTER } from "../utils/constants";

interface LocationPickerProps {
  initialPosition?: Coordinates;
  onChange: (coords: Coordinates) => void;
}

const pickerIcon = L.divIcon({
  html: `<div style="
    width: 40px; height: 40px; border-radius: 50% 50% 50% 0;
    background: #ef4444; transform: rotate(-45deg);
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 2px 8px rgba(0,0,0,0.4); border: 3px solid white;
  "><div style="width: 12px; height: 12px; border-radius: 50%; background: white; transform: rotate(45deg);"></div></div>`,
  className: "",
  iconSize: [40, 40],
  iconAnchor: [20, 40],
});

const DraggableMarker: React.FC<{
  position: [number, number];
  onChange: (coords: Coordinates) => void;
}> = ({ position, onChange }) => {
  const [pos, setPos] = useState<[number, number]>(position);

  useEffect(() => {
    setPos(position);
  }, [position]);

  useMapEvents({
    click(e) {
      const newPos: [number, number] = [e.latlng.lat, e.latlng.lng];
      setPos(newPos);
      onChange({ latitude: e.latlng.lat, longitude: e.latlng.lng });
    },
  });

  return (
    <Marker
      position={pos}
      icon={pickerIcon}
      draggable
      eventHandlers={{
        dragend: (e) => {
          const latlng = e.target.getLatLng();
          const newPos: [number, number] = [latlng.lat, latlng.lng];
          setPos(newPos);
          onChange({ latitude: latlng.lat, longitude: latlng.lng });
        },
      }}
    />
  );
};

const LocationPicker: React.FC<LocationPickerProps> = ({ initialPosition, onChange }) => {
  const center = useMemo<[number, number]>(
    () =>
      initialPosition ? [initialPosition.latitude, initialPosition.longitude] : DEFAULT_MAP_CENTER,
    [initialPosition]
  );

  return (
    <div
      style={{
        height: 250,
        borderRadius: 12,
        overflow: "hidden",
        border: "1px solid var(--ion-color-light)",
      }}
    >
      <MapContainer
        center={center}
        zoom={15}
        style={{ width: "100%", height: "100%" }}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <DraggableMarker position={center} onChange={onChange} />
      </MapContainer>
    </div>
  );
};

export default LocationPicker;
