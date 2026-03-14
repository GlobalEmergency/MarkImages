/**
 * ClusterMarker Component
 *
 * Renders a server-side cluster on the map.
 * Clicking a cluster zooms into its bounds - no popup.
 */

"use client";

import L from "leaflet";
import { Marker } from "react-leaflet";
import type { AedCluster } from "@/types/aed";

interface ClusterMarkerProps {
  cluster: AedCluster;
  onClusterClick?: (cluster: AedCluster) => void;
}

// Icon cache keyed by count bracket to avoid recreating icons
const iconCache = new Map<string, L.DivIcon>();

/**
 * Creates (or returns cached) cluster icon.
 * Size and color depend on DEA count.
 */
function getClusterIcon(count: number): L.DivIcon {
  // Bucket counts to maximize cache hits
  let bucket: string;
  if (count < 10) bucket = String(count);
  else if (count < 100) bucket = `${Math.floor(count / 5) * 5}`;
  else if (count < 1000) bucket = `${Math.floor(count / 50) * 50}`;
  else bucket = `${Math.floor(count / 500) * 500}`;

  const cached = iconCache.get(bucket);
  if (cached) return cached;

  const baseSize = 40;
  const maxSize = 70;
  const size = Math.min(maxSize, baseSize + Math.log10(count) * 15);

  let colorStart = "#3B82F6";
  let colorEnd = "#8B5CF6";

  if (count > 100) {
    colorStart = "#DC2626";
    colorEnd = "#F59E0B";
  } else if (count > 50) {
    colorStart = "#F59E0B";
    colorEnd = "#EAB308";
  } else if (count > 20) {
    colorStart = "#8B5CF6";
    colorEnd = "#EC4899";
  }

  // Format display count
  const displayCount =
    count >= 1000 ? `${(count / 1000).toFixed(count >= 10000 ? 0 : 1)}k` : String(count);

  const icon = L.divIcon({
    className: "custom-cluster-marker",
    html: `
      <div style="
        width: ${size}px;
        height: ${size}px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
      ">
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
        ">${displayCount}</div>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });

  iconCache.set(bucket, icon);
  return icon;
}

/**
 * Cluster marker - click to zoom, no popup
 */
export function ClusterMarker({ cluster, onClusterClick }: ClusterMarkerProps) {
  return (
    <Marker
      position={[cluster.center.lat, cluster.center.lng]}
      icon={getClusterIcon(cluster.count)}
      eventHandlers={{
        click: () => onClusterClick?.(cluster),
      }}
    />
  );
}
