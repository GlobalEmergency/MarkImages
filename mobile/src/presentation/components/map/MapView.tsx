import React, { useCallback, useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer } from "react-leaflet";
import type { Map as LeafletMap } from "leaflet";

import { AedCluster, AedMapMarker } from "../../../domain/models/Aed";
import { Coordinates, BoundingBox } from "../../../domain/models/Location";
import { useAedsByBounds } from "../../hooks/useAedsByBounds";
import MapEventHandler from "./MapEventHandler";
import ClusterMarker from "./ClusterMarker";
import DeaMarker from "./DeaMarker";
import UserPositionMarker from "./UserPositionMarker";
import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM } from "../../utils/constants";

interface MapViewProps {
  onMarkerSelect: (aed: AedMapMarker) => void;
  userPosition?: Coordinates | null;
  /** Increment this counter to force the map to fly to userPosition */
  flyToCounter?: number;
}

const MapView: React.FC<MapViewProps> = ({ onMarkerSelect, userPosition, flyToCounter = 0 }) => {
  const mapRef = useRef<LeafletMap | null>(null);
  const hasCentered = useRef(false);
  const [bounds, setBounds] = useState<BoundingBox | null>(null);
  const [zoom, setZoom] = useState(DEFAULT_MAP_ZOOM);

  const { markers, clusters, loading } = useAedsByBounds(bounds, zoom);

  const handleBoundsChange = useCallback((newBounds: BoundingBox, newZoom: number) => {
    setBounds(newBounds);
    setZoom(newZoom);
  }, []);

  const handleZoomToCluster = useCallback((cluster: AedCluster) => {
    if (mapRef.current) {
      mapRef.current.fitBounds([
        [cluster.bounds.minLat, cluster.bounds.minLng],
        [cluster.bounds.maxLat, cluster.bounds.maxLng],
      ]);
    }
  }, []);

  // Auto-center on user position the first time
  useEffect(() => {
    if (userPosition && !hasCentered.current && mapRef.current) {
      mapRef.current.flyTo([userPosition.latitude, userPosition.longitude], 15);
      hasCentered.current = true;
    }
  }, [userPosition]);

  // Keep a ref to userPosition so the flyTo effect doesn't re-fire on position changes
  const userPositionRef = useRef(userPosition);
  useEffect(() => {
    userPositionRef.current = userPosition;
  }, [userPosition]);

  // Fly to user position when the locate button is pressed (flyToCounter increments)
  useEffect(() => {
    if (flyToCounter > 0 && userPositionRef.current && mapRef.current) {
      mapRef.current.flyTo(
        [userPositionRef.current.latitude, userPositionRef.current.longitude],
        16
      );
    }
  }, [flyToCounter]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <MapContainer
        center={DEFAULT_MAP_CENTER}
        zoom={DEFAULT_MAP_ZOOM}
        style={{ width: "100%", height: "100%" }}
        ref={mapRef}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapEventHandler onBoundsChange={handleBoundsChange} />

        {userPosition && <UserPositionMarker position={userPosition} />}

        {clusters.map((cluster) => (
          <ClusterMarker key={cluster.id} cluster={cluster} onZoomToCluster={handleZoomToCluster} />
        ))}

        {markers.map((aed) => (
          <DeaMarker key={aed.id} aed={aed} onSelect={onMarkerSelect} />
        ))}
      </MapContainer>

      {loading && (
        <div
          style={{
            position: "absolute",
            top: 12,
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(0,0,0,0.7)",
            color: "white",
            padding: "6px 16px",
            borderRadius: 20,
            fontSize: 13,
            zIndex: 1000,
            pointerEvents: "none",
          }}
        >
          Cargando DEAs...
        </div>
      )}
    </div>
  );
};

export default MapView;
