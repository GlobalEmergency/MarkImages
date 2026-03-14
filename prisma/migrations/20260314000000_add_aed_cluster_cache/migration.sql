-- Pre-computed cluster cache for map rendering.
-- Stores clusters at each zoom level so the API can serve them
-- with a simple SELECT instead of real-time ST_SnapToGrid on 3M+ rows.

CREATE TABLE IF NOT EXISTS "aed_cluster_cache" (
  "id"         SERIAL PRIMARY KEY,
  "zoom_level" INT NOT NULL,
  "center_lat" DOUBLE PRECISION NOT NULL,
  "center_lng" DOUBLE PRECISION NOT NULL,
  "count"      INT NOT NULL,
  "bounds_min_lat" DOUBLE PRECISION NOT NULL,
  "bounds_max_lat" DOUBLE PRECISION NOT NULL,
  "bounds_min_lng" DOUBLE PRECISION NOT NULL,
  "bounds_max_lng" DOUBLE PRECISION NOT NULL,
  "geom"       geometry(Point, 4326),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Spatial index for fast bounding box lookups
CREATE INDEX IF NOT EXISTS "idx_aed_cluster_cache_geom"
  ON "aed_cluster_cache" USING GIST ("geom");

-- Composite index for zoom + bbox queries (fallback for non-spatial queries)
CREATE INDEX IF NOT EXISTS "idx_aed_cluster_cache_zoom_coords"
  ON "aed_cluster_cache" ("zoom_level", "center_lat", "center_lng");

-- Index for cleanup operations (TRUNCATE by zoom or full rebuild)
CREATE INDEX IF NOT EXISTS "idx_aed_cluster_cache_zoom"
  ON "aed_cluster_cache" ("zoom_level");

-- Track when clusters were last regenerated
CREATE TABLE IF NOT EXISTS "aed_cluster_cache_metadata" (
  "id"               SERIAL PRIMARY KEY,
  "last_regenerated"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  "total_aeds"       INT NOT NULL DEFAULT 0,
  "total_clusters"   INT NOT NULL DEFAULT 0,
  "duration_ms"      INT NOT NULL DEFAULT 0,
  "zoom_levels"      INT[] NOT NULL DEFAULT '{}'
);
