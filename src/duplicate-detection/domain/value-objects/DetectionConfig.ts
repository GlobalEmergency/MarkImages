/**
 * Detection Configuration — Centralized thresholds and spatial parameters
 *
 * All duplicate detection parameters in one place.
 * Imported by domain services and infrastructure implementations.
 */

export const DetectionConfig = {
  /**
   * SCORING THRESHOLDS (0-115 max possible points)
   *
   * - confirmed (>= 75): Automatic rejection / block
   * - possible (45-74): Import but flag requires_attention = true
   * - below 45: Not a duplicate
   *
   * The "possible" threshold was lowered from 60 to 45 to support
   * cross-source detection where name data may be absent (e.g., CM codes)
   * and establishment_type may be NULL. With graduated proximity and
   * fuzzy address matching, 45pts represents a reliable signal:
   *   proximity(25) + postal(5) + addressVariant(15) = 45 for nearby AEDs.
   */
  thresholds: {
    confirmed: 75,
    possible: 45,
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
