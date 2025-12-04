-- Migration: Auto-populate geom field with trigger
-- Fecha: 2025-12-04
-- Propósito: Mantener el campo geom sincronizado automáticamente con latitude/longitude

-- 1. Crear función que actualiza geom automáticamente
CREATE OR REPLACE FUNCTION update_aed_geom()
RETURNS TRIGGER AS $$
BEGIN
  -- Si hay coordenadas válidas, crear el punto geográfico
  IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    NEW.geom := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
  ELSE
    -- Si no hay coordenadas, limpiar geom
    NEW.geom := NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Crear trigger que ejecuta la función en INSERT y UPDATE
DROP TRIGGER IF EXISTS trigger_update_aed_geom ON aeds;
CREATE TRIGGER trigger_update_aed_geom
  BEFORE INSERT OR UPDATE OF latitude, longitude
  ON aeds
  FOR EACH ROW
  EXECUTE FUNCTION update_aed_geom();

-- 3. Poblar geom en registros existentes (one-time)
UPDATE aeds
SET geom = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
WHERE latitude IS NOT NULL
  AND longitude IS NOT NULL
  AND geom IS NULL;

-- 4. Verificar que el índice espacial existe
-- (Debería existir de migraciones anteriores, pero lo creamos si no existe)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'aeds' AND indexname = 'idx_aeds_geom'
  ) THEN
    CREATE INDEX idx_aeds_geom ON aeds USING GIST (geom);
  END IF;
END $$;
