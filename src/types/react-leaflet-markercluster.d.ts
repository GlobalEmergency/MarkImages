/**
 * Type declarations for react-leaflet-cluster
 * Extended type definitions for the cluster component
 */

declare module "react-leaflet-cluster" {
  import { ReactNode } from "react";
  import L from "leaflet";

  export interface MarkerClusterGroupProps {
    children?: ReactNode;
    showCoverageOnHover?: boolean;
    spiderfyOnMaxZoom?: boolean;
    disableClusteringAtZoom?: number;
    maxClusterRadius?: number | ((zoom: number) => number);
    spiderfyDistanceMultiplier?: number;
    iconCreateFunction?: (cluster: L.MarkerCluster) => L.DivIcon | L.Icon;
    animate?: boolean;
    animateAddingMarkers?: boolean;
    chunkedLoading?: boolean;
    chunkInterval?: number;
    chunkDelay?: number;
    chunkProgress?: (processed: number, total: number, elapsed: number) => void;
    polygonOptions?: L.PolylineOptions;
    singleMarkerMode?: boolean;
    spiderLegPolylineOptions?: L.PolylineOptions;
    zoomToBoundsOnClick?: boolean;
    removeOutsideVisibleBounds?: boolean;
  }

  export default function MarkerClusterGroup(props: MarkerClusterGroupProps): JSX.Element;
}
