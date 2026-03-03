import React from "react";
import { Marker, Circle } from "react-leaflet";
import L from "leaflet";

import { Coordinates } from "../../../domain/models/Location";

interface UserPositionMarkerProps {
  position: Coordinates;
}

const userIcon = L.divIcon({
  className: "",
  html: `
    <div style="
      width: 16px;
      height: 16px;
      background: #4285F4;
      border: 3px solid white;
      border-radius: 50%;
      box-shadow: 0 0 0 2px rgba(66,133,244,0.3), 0 2px 4px rgba(0,0,0,0.3);
    "></div>
  `,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

const UserPositionMarker: React.FC<UserPositionMarkerProps> = ({ position }) => {
  return (
    <>
      <Circle
        center={[position.latitude, position.longitude]}
        radius={100}
        pathOptions={{
          color: "#4285F4",
          fillColor: "#4285F4",
          fillOpacity: 0.1,
          weight: 1,
        }}
      />
      <Marker
        position={[position.latitude, position.longitude]}
        icon={userIcon}
        interactive={false}
      />
    </>
  );
};

export default UserPositionMarker;
