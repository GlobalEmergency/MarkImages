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
  if (zoom <= 8) {
    // Continental/Country view - Heavy sampling
    return {
      limit: 200,
      sampling: "grid_0.05", // ~5km grid sampling
      orderBy: "sequence", // Use sequence for consistent sampling
    };
  } else if (zoom <= 10) {
    // Regional view - Moderate sampling
    return {
      limit: 400,
      sampling: "grid_0.01", // ~1km grid sampling
      orderBy: "sequence",
    };
  } else if (zoom <= 12) {
    // City view - Light sampling
    return {
      limit: 600,
      sampling: null,
      orderBy: "created_at",
    };
  } else if (zoom <= 14) {
    // Neighborhood view - No sampling
    return {
      limit: 800,
      sampling: null,
      orderBy: "created_at",
    };
  } else {
    // Street view - Maximum detail
    return {
      limit: 1000,
      sampling: null,
      orderBy: "created_at",
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
