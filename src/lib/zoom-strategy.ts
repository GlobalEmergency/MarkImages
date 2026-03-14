/**
 * Zoom Strategy - Query strategies based on map zoom level.
 * Optimized for datasets of 3M+ points worldwide.
 */

import type { ZoomStrategy } from "@/types/aed";

/**
 * Get the appropriate query strategy for a given zoom level.
 * Grid sizes and limits tuned for millions of AED points.
 */
export function getQueryStrategy(zoom: number): ZoomStrategy {
  if (zoom <= 4) {
    // World/Continental view - very heavy clustering
    return {
      limit: 200,
      sampling: null,
      orderBy: "sequence",
      clusteringEnabled: true,
      clusterGridSize: 5, // ~555km grid
      minClusterSize: 2,
    };
  } else if (zoom <= 6) {
    // Continental view - heavy clustering
    return {
      limit: 300,
      sampling: null,
      orderBy: "sequence",
      clusteringEnabled: true,
      clusterGridSize: 2, // ~222km grid
      minClusterSize: 2,
    };
  } else if (zoom <= 8) {
    // Country view - heavy clustering
    return {
      limit: 400,
      sampling: null,
      orderBy: "sequence",
      clusteringEnabled: true,
      clusterGridSize: 0.5, // ~55km grid
      minClusterSize: 2,
    };
  } else if (zoom <= 10) {
    // Regional view - moderate clustering
    return {
      limit: 500,
      sampling: null,
      orderBy: "sequence",
      clusteringEnabled: true,
      clusterGridSize: 0.2, // ~22km grid
      minClusterSize: 3,
    };
  } else if (zoom <= 11) {
    // City view - light clustering
    return {
      limit: 600,
      sampling: null,
      orderBy: "sequence",
      clusteringEnabled: true,
      clusterGridSize: 0.1, // ~11km grid
      minClusterSize: 3,
    };
  } else if (zoom <= 12) {
    // City view - light clustering
    return {
      limit: 800,
      sampling: null,
      orderBy: "sequence",
      clusteringEnabled: true,
      clusterGridSize: 0.05, // ~5km grid
      minClusterSize: 4,
    };
  } else if (zoom <= 13) {
    // District view
    return {
      limit: 800,
      sampling: null,
      orderBy: "sequence",
      clusteringEnabled: true,
      clusterGridSize: 0.02, // ~2.2km grid
      minClusterSize: 4,
    };
  } else if (zoom <= 14) {
    // Neighborhood view - very light clustering
    return {
      limit: 1000,
      sampling: null,
      orderBy: "sequence",
      clusteringEnabled: true,
      clusterGridSize: 0.01, // ~1.1km grid
      minClusterSize: 5,
    };
  } else if (zoom <= 15) {
    // Street view - minimal clustering
    return {
      limit: 1200,
      sampling: null,
      orderBy: "sequence",
      clusteringEnabled: true,
      clusterGridSize: 0.005, // ~550m grid
      minClusterSize: 5,
    };
  } else {
    // Max zoom - individual markers only
    return {
      limit: 1500,
      sampling: null,
      orderBy: "sequence",
      clusteringEnabled: false,
      clusterGridSize: null,
      minClusterSize: 0,
    };
  }
}

/**
 * Validate bounding box coordinates
 */
export function isValidBoundingBox(
  minLat: number,
  maxLat: number,
  minLng: number,
  maxLng: number
): boolean {
  if (minLat < -90 || minLat > 90) return false;
  if (maxLat < -90 || maxLat > 90) return false;
  if (minLng < -180 || minLng > 180) return false;
  if (maxLng < -180 || maxLng > 180) return false;

  if (minLat >= maxLat) return false;
  if (minLng >= maxLng) return false;

  const latDiff = maxLat - minLat;
  const lngDiff = maxLng - minLng;
  if (latDiff > 90 || lngDiff > 180) return false;

  return true;
}

/**
 * Get a descriptive name for the strategy
 */
export function getStrategyDescription(strategy: ZoomStrategy): string {
  if (strategy.sampling) {
    return `sampled (${strategy.sampling})`;
  }
  return "full";
}
