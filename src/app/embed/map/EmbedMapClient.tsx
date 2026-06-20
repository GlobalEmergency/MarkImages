"use client";

/**
 * EmbedMapClient — client-side map component for the embeddable widget.
 *
 * Imported dynamically with ssr: false from the page because Leaflet
 * requires access to `window` and cannot be server-rendered.
 */

import L from "leaflet";
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

// ──────────────────────────────────────────────
// Icons (created once, never re-created)
// ──────────────────────────────────────────────

const aedIcon = L.divIcon({
  className: "custom-marker",
  html: `
    <div style="
      background: linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%);
      width: 28px; height: 28px;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      border: 3px solid white;
      box-shadow: 0 3px 6px rgba(0,0,0,0.3);
      display: flex; align-items: center; justify-content: center;
    ">
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
        fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"
        style="transform: rotate(45deg);" aria-hidden="true">
        <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
      </svg>
    </div>
  `,
  iconSize: [28, 28],
  iconAnchor: [14, 28],
  popupAnchor: [0, -28],
});

const spiderfyIconCreate = (cluster: { getChildCount: () => number }) => {
  const count = cluster.getChildCount();
  return L.divIcon({
    html: `<div aria-label="${count} desfibriladores" style="
      background: linear-gradient(135deg, #10B981 0%, #059669 100%);
      width: 30px; height: 30px; border-radius: 50%;
      border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      display: flex; align-items: center; justify-content: center;
      color: white; font-weight: bold; font-size: 12px;
    "><span aria-hidden="true">${count}</span></div>`,
    className: "client-marker-cluster",
    iconSize: L.point(30, 30, true),
  });
};

// ──────────────────────────────────────────────
// Sub-controllers
// ──────────────────────────────────────────────

interface InitialViewProps {
  center: [number, number];
  zoom: number;
}

function InitialViewController({ center, zoom }: InitialViewProps) {
  const map = useMap();

  useEffect(() => {
    map.setView(center, zoom);
  }, [map, center, zoom]);

  return null;
}

function BoundsController({ targetBounds }: { targetBounds: L.LatLngBounds | null }) {
  const map = useMap();

  useEffect(() => {
    if (targetBounds) {
      map.fitBounds(targetBounds, { padding: [40, 40], maxZoom: 15, animate: true });
    }
  }, [targetBounds, map]);

  return null;
}

// ──────────────────────────────────────────────
// Public interface
// ──────────────────────────────────────────────

export interface EmbedMapClientProps {
  /** Initial map center */
  center: [number, number];
  /** Initial zoom level */
  zoom: number;
  /** Optional city name shown in a loading hint */
  cityLabel?: string;
}

export default function EmbedMapClient({ center, zoom, cityLabel }: EmbedMapClientProps) {
  const [bounds, setBounds] = useState<BoundingBox | null>(null);
  const [mapZoom, setMapZoom] = useState(zoom);
  const [targetBounds, setTargetBounds] = useState<L.LatLngBounds | null>(null);
  const [selectedAedId, setSelectedAedId] = useState<string | null>(null);
  const mapRef = useRef<L.Map | null>(null);

  const { aeds, clusters, loading } = useAedsByBounds(bounds, mapZoom);

  const handleMapMove = useCallback((map: L.Map) => {
    mapRef.current = map;
    const b = map.getBounds();
    setBounds({
      minLat: b.getSouth(),
      maxLat: b.getNorth(),
      minLng: b.getWest(),
      maxLng: b.getEast(),
    });
    setMapZoom(map.getZoom());
  }, []);

  const handleMarkerClick = useCallback((aed: AedMapMarker) => {
    mapRef.current?.closePopup();
    setSelectedAedId(aed.id);
  }, []);

  const handleClusterClick = useCallback((cluster: AedCluster) => {
    mapRef.current?.closePopup();
    setSelectedAedId(null);
    const lb = L.latLngBounds(
      [cluster.bounds.minLat, cluster.bounds.minLng],
      [cluster.bounds.maxLat, cluster.bounds.maxLng]
    );
    setTargetBounds(lb);
  }, []);

  const selectedAed = useMemo(
    () => (selectedAedId ? aeds.find((a) => a.id === selectedAedId) : null),
    [selectedAedId, aeds]
  );

  const clusterMarkers = useMemo(
    () =>
      clusters.map((cluster) => (
        <ClusterMarker key={cluster.id} cluster={cluster} onClusterClick={handleClusterClick} />
      )),
    [clusters, handleClusterClick]
  );

  return (
    <div className="relative w-full h-full" role="region" aria-label="Mapa de desfibriladores">
      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom={true}
        className="w-full h-full"
        style={{ zIndex: 0 }}
        preferCanvas={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={20}
        />
        <TileLayer
          attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
          maxZoom={20}
          pane="overlayPane"
        />

        <MapEventHandler onMove={handleMapMove} />
        <InitialViewController center={center} zoom={zoom} />
        <BoundsController targetBounds={targetBounds} />

        {/* Server-side clusters */}
        {clusterMarkers}

        {/* Individual markers with client-side spiderfy */}
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
          iconCreateFunction={spiderfyIconCreate}
        >
          {aeds.map((aed) => (
            <Marker
              key={aed.id}
              position={[aed.latitude, aed.longitude]}
              icon={aedIcon}
              alt={`DEA: ${aed.name}`}
              title={aed.name}
              eventHandlers={{ click: () => handleMarkerClick(aed) }}
            >
              {selectedAed?.id === aed.id && (
                <Popup>
                  <div className="min-w-[180px]">
                    <p className="font-bold text-gray-900 mb-1 text-sm">{aed.name}</p>
                    <p className="text-xs text-gray-500 mb-1">{aed.code}</p>
                    <p className="text-xs text-gray-600 mb-3">{aed.establishment_type}</p>
                    <a
                      href={`https://deamap.es/dea/${aed.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block w-full text-center px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 transition-colors"
                    >
                      Ver en DeaMap →
                    </a>
                  </div>
                </Popup>
              )}
            </Marker>
          ))}
        </MarkerClusterGroup>
      </MapContainer>

      {/* Loading indicator */}
      {loading && (
        <div className="absolute top-3 left-3 z-[1000] bg-white/90 backdrop-blur-sm rounded-lg shadow px-3 py-1.5 flex items-center gap-2 text-xs font-medium text-gray-700">
          <svg
            className="w-3.5 h-3.5 animate-spin text-blue-600"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          Cargando DEAs{cityLabel ? ` en ${cityLabel}` : ""}…
        </div>
      )}

      {/* "Powered by DeaMap" watermark */}
      <a
        href="https://deamap.es"
        target="_blank"
        rel="noopener noreferrer"
        className="absolute bottom-2 right-2 z-[1000] flex items-center gap-1 bg-white/90 backdrop-blur-sm rounded-full px-2.5 py-1 shadow text-[10px] font-semibold text-gray-700 hover:text-blue-700 transition-colors"
        aria-label="Datos proporcionados por DeaMap"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
        </svg>
        Powered by DeaMap
      </a>

      {/* Screen-reader status */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {!loading && aeds.length > 0 && `${aeds.length} desfibriladores cargados`}
      </div>
    </div>
  );
}
