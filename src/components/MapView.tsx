/**
 * MapView - Dynamic map component with clustering and geospatial queries
 * Optimized for large datasets (500K+ markers)
 */

"use client";

import L from "leaflet";
import { AlertCircle, Loader2, MapPin } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";

import { MapEventHandler } from "@/components/MapEventHandler";
import { useAedsByBounds } from "@/hooks/useAedsByBounds";
import type { AedMapMarker, BoundingBox } from "@/types/aed";

import "leaflet/dist/leaflet.css";

interface MapViewProps {
  onAedClick?: (aed: { id: string; code: string; name: string }) => void;
}

// Custom marker icon
const createCustomIcon = () => {
  return L.divIcon({
    className: "custom-marker",
    html: `
      <div style="
        background: linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%);
        width: 32px;
        height: 32px;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        border: 3px solid white;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          stroke-width="3"
          stroke-linecap="round"
          stroke-linejoin="round"
          style="transform: rotate(45deg);"
        >
          <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
        </svg>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });
};

export default function MapView({ onAedClick }: MapViewProps) {
  const [bounds, setBounds] = useState<BoundingBox | null>(null);
  const [zoom, setZoom] = useState(12);

  // Fetch AEDs within bounds
  const { aeds, loading, error, truncated, strategy } = useAedsByBounds(bounds, zoom);

  useEffect(() => {
    // Ensure Leaflet styles are loaded
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    link.integrity = "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=";
    link.crossOrigin = "";
    document.head.appendChild(link);

    // Load marker cluster styles
    const clusterLink = document.createElement("link");
    clusterLink.rel = "stylesheet";
    clusterLink.href = "https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css";
    document.head.appendChild(clusterLink);

    const clusterDefaultLink = document.createElement("link");
    clusterDefaultLink.rel = "stylesheet";
    clusterDefaultLink.href =
      "https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css";
    document.head.appendChild(clusterDefaultLink);

    return () => {
      try {
        document.head.removeChild(link);
        document.head.removeChild(clusterLink);
        document.head.removeChild(clusterDefaultLink);
      } catch {
        // Ignore errors during cleanup
      }
    };
  }, []);

  const handleMapMove = useCallback((map: L.Map) => {
    const mapBounds = map.getBounds();
    setBounds({
      minLat: mapBounds.getSouth(),
      maxLat: mapBounds.getNorth(),
      minLng: mapBounds.getWest(),
      maxLng: mapBounds.getEast(),
    });
    setZoom(map.getZoom());
  }, []);

  const handleMarkerClick = useCallback(
    (aed: AedMapMarker) => {
      if (onAedClick) {
        onAedClick({ id: aed.id, code: aed.code, name: aed.name });
      }
    },
    [onAedClick]
  );

  return (
    <div className="relative w-full h-[600px] rounded-xl overflow-hidden shadow-xl">
      <MapContainer
        center={[40.4168, -3.7038]} // Madrid center
        zoom={12}
        scrollWheelZoom={true}
        className="w-full h-full"
        style={{ zIndex: 0 }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Map event handler */}
        <MapEventHandler onMove={handleMapMove} />

        {/* Marker clustering */}
        <MarkerClusterGroup
          chunkedLoading
          maxClusterRadius={50}
          spiderfyOnMaxZoom={true}
          showCoverageOnHover={false}
          zoomToBoundsOnClick={true}
        >
          {aeds.map((aed) => (
            <Marker
              key={aed.id}
              position={[aed.latitude, aed.longitude]}
              icon={createCustomIcon()}
              eventHandlers={{
                click: () => handleMarkerClick(aed),
              }}
            >
              <Popup>
                <div className="min-w-[200px]">
                  <h3 className="font-bold text-gray-900 mb-2">{aed.name}</h3>
                  <p className="text-sm text-gray-600 mb-2">{aed.code}</p>

                  <div className="space-y-2 text-sm">
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-gray-700">{aed.establishment_type}</p>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleMarkerClick(aed)}
                    className="w-full mt-3 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg text-sm font-medium hover:shadow-lg transition-all"
                  >
                    Ver detalles
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}
        </MarkerClusterGroup>
      </MapContainer>

      {/* Loading indicator */}
      {loading && (
        <div className="absolute top-4 left-4 z-[1000] bg-white rounded-lg shadow-lg px-4 py-2 flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
          <span className="text-sm font-medium text-gray-700">Cargando DEAs...</span>
        </div>
      )}

      {/* Error indicator */}
      {error && (
        <div className="absolute top-4 left-4 z-[1000] bg-red-50 border border-red-200 rounded-lg shadow-lg px-4 py-2 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600" />
          <span className="text-sm font-medium text-red-700">{error}</span>
        </div>
      )}

      {/* Info indicator */}
      {!loading && !error && aeds.length > 0 && (
        <div className="absolute bottom-4 left-4 z-[1000] bg-white rounded-lg shadow-lg px-4 py-2 flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium text-gray-700">
              {aeds.length} DEA{aeds.length !== 1 ? "s" : ""} visibles
            </span>
          </div>
          {truncated && (
            <span className="text-xs text-amber-600 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              Hay más DEAs. Aumenta el zoom para ver todos
            </span>
          )}
          <span className="text-xs text-gray-500">Estrategia: {strategy}</span>
        </div>
      )}

      {/* No results indicator */}
      {!loading && !error && aeds.length === 0 && bounds && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[1000] bg-white rounded-lg shadow-lg px-6 py-4 text-center">
          <MapPin className="w-8 h-8 text-gray-400 mx-auto mb-2" />
          <p className="text-sm font-medium text-gray-700">No hay DEAs en esta área</p>
          <p className="text-xs text-gray-500 mt-1">Mueve o reduce el zoom del mapa</p>
        </div>
      )}
    </div>
  );
}
