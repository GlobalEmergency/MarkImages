-- Performance: index for city name lookups used by /locations, /api/v1/aeds/city, sitemap
CREATE INDEX IF NOT EXISTS "idx_aed_locations_city_name" ON "aed_locations" ("city_name");

-- Performance: index for city_code prefix queries (LEFT(city_code, 2) for province grouping)
CREATE INDEX IF NOT EXISTS "idx_aed_locations_city_code" ON "aed_locations" ("city_code");
