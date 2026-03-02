import React, { useCallback, useRef, useState } from "react";
import { MapContainer, TileLayer } from "react-leaflet";
import type { Map as LeafletMap } from "leaflet";
import "leaflet/dist/leaflet.css";

import { AedCluster, AedMapMarker } from "../../../domain/models/Aed";
import { BoundingBox } from "../../../domain/models/Location";
import { useAedsByBounds } from "../../hooks/useAedsByBounds";
import MapEventHandler from "./MapEventHandler";
import ClusterMarker from "./ClusterMarker";
import DeaMarker from "./DeaMarker";

// Default center: Madrid
const DEFAULT_CENTER: [number, number] = [40.4168, -3.7038];
const DEFAULT_ZOOM = 12;

interface MapViewProps {
  onMarkerSelect: (aed: AedMapMarker) => void;
}

const MapView: React.FC<MapViewProps> = ({ onMarkerSelect }) => {
  const mapRef = useRef<LeafletMap | null>(null);
  const [bounds, setBounds] = useState<BoundingBox | null>(null);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);

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

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        style={{ width: "100%", height: "100%" }}
        ref={mapRef}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapEventHandler onBoundsChange={handleBoundsChange} />

        {clusters.map((cluster) => (
          <ClusterMarker
            key={cluster.id}
            cluster={cluster}
            onZoomToCluster={handleZoomToCluster}
          />
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
