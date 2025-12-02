/**
 * ClusterMarker Component
 *
 * Componente para renderizar un cluster de DEAs en el mapa.
 * Siguiendo SOLID:
 * - Single Responsibility: Solo renderiza un cluster
 * - Open/Closed: Extensible mediante props sin modificar el componente
 */

"use client";

import L from "leaflet";
import { Marker, Popup } from "react-leaflet";
import { MapPin } from "lucide-react";
import type { AedCluster } from "@/types/aed";

interface ClusterMarkerProps {
  cluster: AedCluster;
  onClusterClick?: (cluster: AedCluster) => void;
}

/**
 * Crea un icono personalizado para clusters
 * El tamaño y color dependen del número de DEAs en el cluster
 */
function createClusterIcon(count: number): L.DivIcon {
  // Calcular tamaño basado en el conteo (mínimo 40px, máximo 70px)
  const baseSize = 40;
  const maxSize = 70;
  const size = Math.min(maxSize, baseSize + Math.log10(count) * 15);

  // Color según cantidad
  let colorStart = "#3B82F6"; // blue-500
  let colorEnd = "#8B5CF6"; // purple-600

  if (count > 100) {
    colorStart = "#DC2626"; // red-600
    colorEnd = "#F59E0B"; // amber-500
  } else if (count > 50) {
    colorStart = "#F59E0B"; // amber-500
    colorEnd = "#EAB308"; // yellow-500
  } else if (count > 20) {
    colorStart = "#8B5CF6"; // purple-600
    colorEnd = "#EC4899"; // pink-500
  }

  return L.divIcon({
    className: "custom-cluster-marker",
    html: `
      <div style="
        position: relative;
        width: ${size}px;
        height: ${size}px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: transform 0.2s ease;
      " 
      onmouseover="this.style.transform='scale(1.1)'"
      onmouseout="this.style.transform='scale(1)'">
        <div style="
          position: absolute;
          width: 100%;
          height: 100%;
          background: linear-gradient(135deg, ${colorStart} 0%, ${colorEnd} 100%);
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
          opacity: 0.9;
        "></div>
        <div style="
          position: relative;
          z-index: 1;
          color: white;
          font-weight: bold;
          font-size: ${Math.max(12, size / 3)}px;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
        ">${count}</div>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

/**
 * Componente que renderiza un marcador de cluster
 */
export function ClusterMarker({ cluster, onClusterClick }: ClusterMarkerProps) {
  const handleClick = () => {
    if (onClusterClick) {
      onClusterClick(cluster);
    }
  };

  return (
    <Marker
      position={[cluster.center.lat, cluster.center.lng]}
      icon={createClusterIcon(cluster.count)}
      eventHandlers={{
        click: handleClick,
      }}
    >
      <Popup>
        <div className="min-w-[200px]">
          <div className="flex items-center gap-2 mb-3">
            <MapPin className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-gray-900">Cluster de DEAs</h3>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between items-center py-2 border-b border-gray-200">
              <span className="text-gray-600">DEAs en esta área:</span>
              <span className="font-bold text-lg text-blue-600">{cluster.count}</span>
            </div>

            <div className="text-xs text-gray-500 space-y-1">
              <p>Latitud: {cluster.center.lat.toFixed(4)}</p>
              <p>Longitud: {cluster.center.lng.toFixed(4)}</p>
            </div>
          </div>

          <button
            onClick={handleClick}
            className="w-full mt-3 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg text-sm font-medium hover:shadow-lg transition-all"
          >
            Aumentar zoom para ver DEAs
          </button>
        </div>
      </Popup>
    </Marker>
  );
}
