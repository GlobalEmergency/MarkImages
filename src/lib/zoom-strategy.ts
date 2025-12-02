/**
 * Zoom Strategy - Different query strategies based on map zoom level
 *
 * This module defines how many DEAs to load and what sampling to apply
 * based on the current zoom level of the map.
 */

import type { ZoomStrategy } from "@/types/aed";

/**
 * Get the appropriate query strategy for a given zoom level
 *
 * Zoom levels guide:
 * - 0-8: Continental/Country view - Show sampled data
 * - 9-12: Regional/City view - Show limited data
 * - 13+: Local/Neighborhood view - Show all data in bounds
 *
 * @param zoom - Current map zoom level (0-20)
 * @returns Query strategy with limit, sampling and order
 */
export function getQueryStrategy(zoom: number): ZoomStrategy {
  if (zoom <= 6) {
    // Continental/Country view - Heavy clustering (grid ~22km)
    return {
      limit: 300,
      sampling: null,
      orderBy: "sequence",
      clusteringEnabled: true,
      clusterGridSize: 2, // ~22km grid (duplicado)
      minClusterSize: 2, // Minimum 2 DEAs to form a cluster
    };
  } else if (zoom <= 8) {
    // Continental/Country view - Heavy clustering (grid ~22km)
    return {
      limit: 300,
      sampling: null,
      orderBy: "sequence",
      clusteringEnabled: true,
      clusterGridSize: 0.5, // ~22km grid (duplicado)
      minClusterSize: 2, // Minimum 2 DEAs to form a cluster
    };
  } else if (zoom <= 10) {
    // Regional view - Moderate clustering (grid ~11km)
    return {
      limit: 500,
      sampling: null,
      orderBy: "sequence",
      clusteringEnabled: true,
      clusterGridSize: 0.3, // ~11km grid (duplicado desde 5km)
      minClusterSize: 3,
    };
  } else if (zoom <= 11) {
    // City view - Light clustering (grid ~2km)
    return {
      limit: 800,
      sampling: null,
      orderBy: "sequence",
      clusteringEnabled: true,
      clusterGridSize: 0.1, // ~2km grid (duplicado desde 1km)
      minClusterSize: 5,
    };
  } else if (zoom <= 12) {
    // City view - Light clustering (grid ~2km)
    return {
      limit: 800,
      sampling: null,
      orderBy: "sequence",
      clusteringEnabled: true,
      clusterGridSize: 0.05, // ~2km grid (duplicado desde 1km)
      minClusterSize: 5,
    };
  } else if (zoom <= 13) {
    // City view - Light clustering (grid ~2km)
    return {
      limit: 800,
      sampling: null,
      orderBy: "sequence",
      clusteringEnabled: true,
      clusterGridSize: 0.025, // ~2km grid (duplicado desde 1km)
      minClusterSize: 5,
    };
  } else if (zoom <= 14) {
    // Neighborhood view - Very light clustering (grid ~1km)
    return {
      limit: 1000,
      sampling: null,
      orderBy: "created_at",
      clusteringEnabled: true,
      clusterGridSize: 0.01, // ~1km grid (duplicado desde 500m)
      minClusterSize: 8,
    };
  } else if (zoom <= 15) {
    // Neighborhood view - Very light clustering (grid ~1km)
    return {
      limit: 1000,
      sampling: null,
      orderBy: "created_at",
      clusteringEnabled: true,
      clusterGridSize: 0.005, // ~1km grid (duplicado desde 500m)
      minClusterSize: 8,
    };
  } else {
    // Street view - No clustering, show all individual DEAs
    return {
      limit: 1500,
      sampling: null,
      orderBy: "created_at",
      clusteringEnabled: false,
      clusterGridSize: null,
      minClusterSize: 0,
    };
  }
}

/**
 * Validate bounding box coordinates
 * @returns true if valid, false otherwise
 */
export function isValidBoundingBox(
  minLat: number,
  maxLat: number,
  minLng: number,
  maxLng: number
): boolean {
  // Check ranges
  if (minLat < -90 || minLat > 90) return false;
  if (maxLat < -90 || maxLat > 90) return false;
  if (minLng < -180 || minLng > 180) return false;
  if (maxLng < -180 || maxLng > 180) return false;

  // Check min < max
  if (minLat >= maxLat) return false;
  if (minLng >= maxLng) return false;

  // Check reasonable size (not larger than half the world)
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
