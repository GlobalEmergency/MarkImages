-- Add composite index on (zoom_level, geom) for efficient anti-join queries.
-- When fetching individual markers, we check NOT EXISTS against the cache
-- using zoom_level + ST_SnapToGrid(geom) equality. This index accelerates
-- that lookup, especially as the cache grows with more data points.

CREATE INDEX IF NOT EXISTS "idx_aed_cluster_cache_zoom_geom"
  ON "aed_cluster_cache" ("zoom_level", "geom");
