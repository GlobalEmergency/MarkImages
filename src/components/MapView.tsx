/**
 * MapView - Dynamic map component with server-side clustering
 * Optimized for 3M+ points with hybrid rendering (clusters + individual markers)
 */

"use client";

import L from "leaflet";
import { AlertCircle, Loader2, MapPin } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";

import { MapEventHandler } from "@/components/MapEventHandler";
import { ClusterMarker } from "@/components/ClusterMarker";
import { useAedsByBounds } from "@/hooks/useAedsByBounds";
import type { AedMapMarker, AedCluster, BoundingBox } from "@/types/aed";

import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

interface MapViewProps {
  onAedClick?: (aed: { id: string; code: string; name: string }) => void;
  searchLocation?: { lat: number; lng: number } | null;
  onSearchLocationChange?: (location: { lat: number; lng: number }) => void;
  onAddressChange?: (address: string) => void;
}

// ============================================
// CACHED ICONS - Created once, reused forever
// ============================================

const aedIcon = L.divIcon({
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
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="transform: rotate(45deg);">
        <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
      </svg>
    </div>
  `,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
});

const searchLocationIcon = L.divIcon({
  className: "search-location-marker",
  html: `
    <div style="position: relative; width: 48px; height: 48px;">
      <div style="
        position: absolute; top: 50%; left: 50%;
        transform: translate(-50%, -50%);
        width: 48px; height: 48px;
        background: rgba(220, 38, 38, 0.3);
        border-radius: 50%;
        animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
      "></div>
      <div style="
        position: absolute; top: 50%; left: 50%;
        background: linear-gradient(135deg, #DC2626 0%, #991B1B 100%);
        width: 40px; height: 40px;
        border-radius: 50% 50% 50% 0;
        transform: translate(-50%, -50%) rotate(-45deg);
        border: 4px solid white;
        box-shadow: 0 6px 12px rgba(0, 0, 0, 0.4);
        display: flex; align-items: center; justify-content: center;
      ">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="white" style="transform: rotate(45deg);">
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="3" fill="#DC2626" />
        </svg>
      </div>
    </div>
    <style>
      @keyframes pulse {
        0%, 100% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        50% { opacity: 0.5; transform: translate(-50%, -50%) scale(1.5); }
      }
    </style>
  `,
  iconSize: [48, 48],
  iconAnchor: [24, 24],
  popupAnchor: [0, -24],
});

// Client-side spiderfy cluster icon (for overlapping markers at same location)
const spiderfyIconCreateFunction = (cluster: { getChildCount: () => number }) => {
  const count = cluster.getChildCount();
  return L.divIcon({
    html: `<div style="
      background: linear-gradient(135deg, #10B981 0%, #059669 100%);
      width: 34px; height: 34px;
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
      display: flex; align-items: center; justify-content: center;
      color: white; font-weight: bold; font-size: 13px;
    ">${count}</div>`,
    className: "client-marker-cluster",
    iconSize: L.point(34, 34, true),
  });
};

// ============================================
// MAP CONTROLLER COMPONENTS
// ============================================

function MapController({ targetBounds }: { targetBounds: L.LatLngBounds | null }) {
  const map = useMap();

  useEffect(() => {
    if (targetBounds) {
      map.fitBounds(targetBounds, {
        padding: [50, 50],
        maxZoom: 15,
        animate: true,
        duration: 0.5,
      });
    }
  }, [targetBounds, map]);

  return null;
}

function SearchLocationController({ location }: { location: { lat: number; lng: number } | null }) {
  const map = useMap();

  useEffect(() => {
    if (location) {
      map.setView([location.lat, location.lng], 17, {
        animate: true,
        duration: 1,
      });
    }
  }, [location, map]);

  return null;
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function MapView({
  onAedClick,
  searchLocation,
  onSearchLocationChange,
  onAddressChange,
}: MapViewProps) {
  const [bounds, setBounds] = useState<BoundingBox | null>(null);
  const [zoom, setZoom] = useState(12);
  const [targetBounds, setTargetBounds] = useState<L.LatLngBounds | null>(null);
  const [selectedAedId, setSelectedAedId] = useState<string | null>(null);

  // Ref to close previous popup before opening a new one
  const mapRef = useRef<L.Map | null>(null);

  const { aeds, clusters, loading, error } = useAedsByBounds(bounds, zoom);

  // Store map ref on first event
  const handleMapMove = useCallback((map: L.Map) => {
    mapRef.current = map;
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
      // Close any open popup first to prevent stuck popups
      if (mapRef.current) {
        mapRef.current.closePopup();
      }
      setSelectedAedId(aed.id);
      onAedClick?.({ id: aed.id, code: aed.code, name: aed.name });
    },
    [onAedClick]
  );

  const handleClusterClick = useCallback((cluster: AedCluster) => {
    // Close any open popup
    if (mapRef.current) {
      mapRef.current.closePopup();
    }
    setSelectedAedId(null);
    const clusterBounds = L.latLngBounds(
      [cluster.bounds.minLat, cluster.bounds.minLng],
      [cluster.bounds.maxLat, cluster.bounds.maxLng]
    );
    setTargetBounds(clusterBounds);
  }, []);

  // Find selected AED for popup rendering (only render popup for the selected one)
  const selectedAed = useMemo(
    () => (selectedAedId ? aeds.find((a) => a.id === selectedAedId) : null),
    [selectedAedId, aeds]
  );

  // Memoize cluster markers to prevent re-renders when aeds change
  const clusterMarkers = useMemo(
    () =>
      clusters.map((cluster) => (
        <ClusterMarker key={cluster.id} cluster={cluster} onClusterClick={handleClusterClick} />
      )),
    [clusters, handleClusterClick]
  );

  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden shadow-xl">
      <MapContainer
        center={[40.4168, -3.7038]}
        zoom={12}
        scrollWheelZoom={true}
        className="w-full h-full"
        style={{ zIndex: 0 }}
        preferCanvas={true}
      >
        {/* Base map layer */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={20}
        />

        {/* Labels overlay */}
        <TileLayer
          attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
          maxZoom={20}
          pane="overlayPane"
        />

        {/* Map event handler - moveend only (zoomend is redundant) */}
        <MapEventHandler onMove={handleMapMove} />

        {/* Map controller for zoom animations */}
        <MapController targetBounds={targetBounds} />

        {/* Search location controller */}
        <SearchLocationController location={searchLocation ?? null} />

        {/* Search location marker */}
        {searchLocation && (
          <Marker
            position={[searchLocation.lat, searchLocation.lng]}
            icon={searchLocationIcon}
            zIndexOffset={1000}
            draggable={true}
            eventHandlers={{
              dragend: async (e) => {
                const marker = e.target;
                const position = marker.getLatLng();

                onSearchLocationChange?.({
                  lat: position.lat,
                  lng: position.lng,
                });

                if (onAddressChange) {
                  try {
                    const response = await fetch(
                      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${position.lat}&lon=${position.lng}&addressdetails=1`,
                      {
                        headers: {
                          "User-Agent": "DEA-Madrid-WebApp/1.0",
                        },
                      }
                    );

                    if (response.ok) {
                      const data = await response.json();
                      onAddressChange(data.display_name || "");
                    }
                  } catch (error) {
                    console.error("Error reverse geocoding:", error);
                  }
                }
              },
            }}
          >
            <Popup>
              <div className="min-w-[200px]">
                <h3 className="font-bold text-red-600 mb-2">Tu ubicación</h3>
                <p className="text-sm text-gray-600 mb-2">Buscando DEAs cercanos desde aquí</p>
                <p className="text-xs text-gray-500 italic mb-2">
                  Arrastra este marcador para ajustar la búsqueda
                </p>
                <div className="mt-2 text-xs text-gray-500">
                  <p>Lat: {searchLocation.lat.toFixed(6)}</p>
                  <p>Lng: {searchLocation.lng.toFixed(6)}</p>
                </div>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Server-side clusters - no popup, just zoom on click */}
        {clusterMarkers}

        {/* Individual AED markers with client-side spiderfy for overlapping */}
        <MarkerClusterGroup
          showCoverageOnHover={false}
          spiderfyOnMaxZoom={true}
          disableClusteringAtZoom={16}
          maxClusterRadius={15}
          spiderfyDistanceMultiplier={1.5}
          zoomToBoundsOnClick={false}
          animate={false}
          chunkedLoading={true}
          chunkInterval={100}
          chunkDelay={10}
          removeOutsideVisibleBounds={true}
          iconCreateFunction={spiderfyIconCreateFunction}
        >
          {aeds.map((aed) => (
            <Marker
              key={aed.id}
              position={[aed.latitude, aed.longitude]}
              icon={aedIcon}
              eventHandlers={{
                click: () => handleMarkerClick(aed),
              }}
            >
              {selectedAed && selectedAed.id === aed.id && (
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
              )}
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
    </div>
  );
}
