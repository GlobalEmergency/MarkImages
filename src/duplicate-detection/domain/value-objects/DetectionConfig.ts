/**
 * Detection Configuration — Centralized thresholds and spatial parameters
 *
 * All duplicate detection parameters in one place.
 * Imported by domain services and infrastructure implementations.
 */

export const DetectionConfig = {
  /**
   * SCORING THRESHOLDS (0-100 points)
   *
   * - confirmed (>= 75): Automatic rejection / block
   * - possible (60-74): Import but flag requires_attention = true
   * - below 60: Not a duplicate
   */
  thresholds: {
    confirmed: 75,
    possible: 60,
  },

  /**
   * SPATIAL SEARCH (PostGIS)
   */
  spatial: {
    /** Search radius in degrees (~100m at mid latitudes) */
    searchRadiusDegrees: 0.001,
    /** WGS84 coordinate system */
    srid: 4326,
  },

  /**
   * FALLBACK — When no coordinates available
   */
  fallback: {
    usePostalCodeFilter: true,
    searchAllIfNoPostalCode: false,
  },

  /**
   * STATUS FILTER — Exclude these statuses from duplicate matching
   */
  filters: {
    excludeStatuses: ["REJECTED", "INACTIVE"] as const,
  },
} as const;

export type DetectionConfigType = typeof DetectionConfig;
