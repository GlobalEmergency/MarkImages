-- Migration: Add admin_level_1 field to aed_locations
--
-- admin_level_1 stores the first-level administrative division (region/state)
-- derived from coordinates via Nominatim reverse geocoding.
-- This is universal: "Comunidad de Madrid" (ES), "Île-de-France" (FR),
-- "Bayern" (DE), "California" (US), etc.
--
-- Step 1: Add the column
-- Step 2: Backfill for Spain using the province INE code → community mapping
-- Step 3: Add index for geographic queries

-- Step 1: Add column
ALTER TABLE "aed_locations" ADD COLUMN IF NOT EXISTS "admin_level_1" TEXT;

-- Step 2: Backfill existing Spanish records from city_code/postal_code → community name
-- Uses COALESCE(city_code, postal_code) to get the best available province prefix.
-- The first 2 digits of both fields are the INE province code in Spain.
UPDATE "aed_locations"
SET "admin_level_1" = CASE LEFT(COALESCE(NULLIF("city_code", ''), NULLIF("postal_code", '')), 2)
  WHEN '01' THEN 'País Vasco'
  WHEN '02' THEN 'Castilla-La Mancha'
  WHEN '03' THEN 'Comunitat Valenciana'
  WHEN '04' THEN 'Andalucía'
  WHEN '05' THEN 'Castilla y León'
  WHEN '06' THEN 'Extremadura'
  WHEN '07' THEN 'Illes Balears'
  WHEN '08' THEN 'Cataluña'
  WHEN '09' THEN 'Castilla y León'
  WHEN '10' THEN 'Extremadura'
  WHEN '11' THEN 'Andalucía'
  WHEN '12' THEN 'Comunitat Valenciana'
  WHEN '13' THEN 'Castilla-La Mancha'
  WHEN '14' THEN 'Andalucía'
  WHEN '15' THEN 'Galicia'
  WHEN '16' THEN 'Castilla-La Mancha'
  WHEN '17' THEN 'Cataluña'
  WHEN '18' THEN 'Andalucía'
  WHEN '19' THEN 'Castilla-La Mancha'
  WHEN '20' THEN 'País Vasco'
  WHEN '21' THEN 'Andalucía'
  WHEN '22' THEN 'Aragón'
  WHEN '23' THEN 'Andalucía'
  WHEN '24' THEN 'Castilla y León'
  WHEN '25' THEN 'Cataluña'
  WHEN '26' THEN 'La Rioja'
  WHEN '27' THEN 'Galicia'
  WHEN '28' THEN 'Comunidad de Madrid'
  WHEN '29' THEN 'Andalucía'
  WHEN '30' THEN 'Región de Murcia'
  WHEN '31' THEN 'Navarra'
  WHEN '32' THEN 'Galicia'
  WHEN '33' THEN 'Asturias'
  WHEN '34' THEN 'Castilla y León'
  WHEN '35' THEN 'Canarias'
  WHEN '36' THEN 'Galicia'
  WHEN '37' THEN 'Castilla y León'
  WHEN '38' THEN 'Canarias'
  WHEN '39' THEN 'Cantabria'
  WHEN '40' THEN 'Castilla y León'
  WHEN '41' THEN 'Andalucía'
  WHEN '42' THEN 'Castilla y León'
  WHEN '43' THEN 'Cataluña'
  WHEN '44' THEN 'Aragón'
  WHEN '45' THEN 'Castilla-La Mancha'
  WHEN '46' THEN 'Comunitat Valenciana'
  WHEN '47' THEN 'Castilla y León'
  WHEN '48' THEN 'País Vasco'
  WHEN '49' THEN 'Castilla y León'
  WHEN '50' THEN 'Aragón'
  WHEN '51' THEN 'Ceuta'
  WHEN '52' THEN 'Melilla'
  ELSE NULL
END
WHERE "admin_level_1" IS NULL
  AND COALESCE(NULLIF("city_code", ''), NULLIF("postal_code", '')) IS NOT NULL;

-- Step 3: Add index for geographic hierarchy queries
CREATE INDEX IF NOT EXISTS "idx_aed_locations_admin_level_1" ON "aed_locations" ("admin_level_1");
