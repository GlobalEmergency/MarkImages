-- Seed: Data sources for Spanish CCAA with open AED data
-- Includes: Comunidad de Madrid, Cataluña, Castilla y León, Euskadi
-- UPSERT: creates if not exists, updates config if already exists


-- ============================================================
-- 1. Comunidad de Madrid — JSON file (datos.comunidad.madrid)
-- Dataset: Desfibriladores externos fuera del ámbito sanitario
-- Records: ~2,700 | Format: JSON (flat download)
-- ============================================================

INSERT INTO external_data_sources (
  id,
  name,
  description,
  type,
  config,
  matching_strategy,
  matching_threshold,
  is_active,
  sync_frequency,
  auto_deactivate_missing,
  auto_update_fields,
  default_publication_mode,
  default_status,
  default_requires_attention,
  source_origin,
  country_code,
  region_code,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'DEAs Comunidad de Madrid',
  'Desfibriladores externos fuera del ámbito sanitario — Datos abiertos Comunidad de Madrid',
  'JSON_FILE',
  '{
    "fileUrl": "https://datos.comunidad.madrid/catalogo/dataset/d2478503-a4ae-4753-9540-9200071803c4/resource/42d08814-3361-4c2a-93fe-36664abc7953/download/desfibriladores_externos_fuera_ambito_sanitario.json",
    "jsonPath": "data",
    "fieldMappings": {
      "codigo_dea": "externalId",
      "direccion_via_codigo": "streetType",
      "direccion_via_nombre": "streetName",
      "direccion_portal_numero": "streetNumber",
      "direccion_piso": "floor",
      "direccion_puerta": "additionalInfo",
      "direccion_ubicacion": "specificLocation",
      "direccion_codigo_postal": "postalCode",
      "direccion_latitud": "latitude",
      "direccion_longitud": "longitude",
      "municipio_codigo": "cityCode",
      "municipio_nombre": "city",
      "tipo_establecimiento": "establishmentType",
      "tipo_titularidad": "ownershipType",
      "horario_acceso": "accessSchedule"
    }
  }'::jsonb,
  'HYBRID',
  75,
  true,
  'WEEKLY',
  false,
  ARRAY[]::text[],
  'LOCATION_ONLY',
  'PUBLISHED',
  true,
  'HEALTH_API',
  'ES',
  'ES-MD',
  NOW(),
  NOW()
) ON CONFLICT (name) DO UPDATE SET
  config = EXCLUDED.config,
  type = EXCLUDED.type,
  country_code = EXCLUDED.country_code,
  region_code = EXCLUDED.region_code,
  description = EXCLUDED.description,
  updated_at = NOW();


-- ============================================================
-- 2. Cataluña — Socrata SODA API (analisi.transparenciacatalunya.cat)
-- Dataset: Registre de desfibril·ladors instal·lats a Catalunya
-- Records: ~11,692 | Updated: weekly | Format: JSON (SODA API)
-- Pagination: offset-based ($limit/$offset), flat array response
-- ============================================================

INSERT INTO external_data_sources (
  id,
  name,
  description,
  type,
  config,
  matching_strategy,
  matching_threshold,
  is_active,
  sync_frequency,
  auto_deactivate_missing,
  auto_update_fields,
  default_publication_mode,
  default_status,
  default_requires_attention,
  source_origin,
  country_code,
  region_code,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'DEAs Cataluña - Generalitat',
  'Registre de desfibril·ladors instal·lats a Catalunya fora de l''àmbit sanitari — Dades Obertes Generalitat de Catalunya (Socrata). ~11.700 registros.',
  'REST_API',
  '{
    "apiEndpoint": "https://analisi.transparenciacatalunya.cat/resource/wpud-ukyg.json",
    "pagination": {
      "strategy": "offset",
      "limitParam": "$limit",
      "limitValue": 1000,
      "offsetParam": "$offset"
    },
    "fieldMappings": {
      "numero_inscripcio": "externalId",
      "latitud": "latitude",
      "longitud": "longitude",
      "nom_centre": "locationName",
      "tipus_via": "streetType",
      "nom_via": "streetName",
      "numero_via": "streetNumber",
      "pis": "floor",
      "porta": "additionalInfo",
      "espai_fisic": "specificLocation",
      "codi_postal": "postalCode",
      "municipi": "city",
      "provincia": "province",
      "titular": "organization",
      "fabricant": "manufacturer",
      "marca_model": "model",
      "numero_serie": "serialNumber",
      "vehicle": "isVehicle"
    }
  }'::jsonb,
  'HYBRID',
  75,
  true,
  'WEEKLY',
  false,
  ARRAY[]::text[],
  'LOCATION_ONLY',
  'PUBLISHED',
  true,
  'HEALTH_API',
  'ES',
  'ES-CT',
  NOW(),
  NOW()
) ON CONFLICT (name) DO UPDATE SET
  config = EXCLUDED.config,
  type = EXCLUDED.type,
  country_code = EXCLUDED.country_code,
  region_code = EXCLUDED.region_code,
  description = EXCLUDED.description,
  updated_at = NOW();


-- ============================================================
-- 3. Castilla y León — OpenDataSoft API v2.1 (datosabiertos.jcyl.es)
-- Dataset: DESA en espacios físicos
-- Records: ~2,499 | Updated: daily | Format: JSON (ODS v2.1)
-- Pagination: offset-based (limit/offset, max 100)
-- NOTE: No GPS coordinates — requires geocoding from address fields
-- ============================================================

INSERT INTO external_data_sources (
  id,
  name,
  description,
  type,
  config,
  matching_strategy,
  matching_threshold,
  is_active,
  sync_frequency,
  auto_deactivate_missing,
  auto_update_fields,
  default_publication_mode,
  default_status,
  default_requires_attention,
  source_origin,
  country_code,
  region_code,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'DEAs Castilla y León - Junta',
  'Registro de DESA en espacios físicos — Datos abiertos Junta de Castilla y León (OpenDataSoft). ~2.500 registros. Sin coordenadas GPS, requiere geocodificación.',
  'REST_API',
  '{
    "apiEndpoint": "https://analisis.datosabiertos.jcyl.es/api/explore/v2.1/catalog/datasets/registro-de-desfibriladores-externos-semiautomaticos-desa-en-espacios-fisicos/records",
    "responseDataPath": "results",
    "pagination": {
      "strategy": "offset",
      "limitParam": "limit",
      "limitValue": 100,
      "offsetParam": "offset",
      "totalCountPath": "total_count"
    },
    "fieldMappings": {
      "numero_serie": "externalId",
      "empresa": "organization",
      "ubicacion": "locationName",
      "tipo_via": "streetType",
      "via": "streetName",
      "numero": "streetNumber",
      "localidad": "city",
      "provincia": "province",
      "fecha_alta": "registrationDate",
      "fecha_baja": "deactivationDate"
    }
  }'::jsonb,
  'BY_ADDRESS',
  70,
  true,
  'WEEKLY',
  false,
  ARRAY[]::text[],
  'LOCATION_ONLY',
  'PUBLISHED',
  true,
  'HEALTH_API',
  'ES',
  'ES-CL',
  NOW(),
  NOW()
) ON CONFLICT (name) DO UPDATE SET
  config = EXCLUDED.config,
  type = EXCLUDED.type,
  country_code = EXCLUDED.country_code,
  region_code = EXCLUDED.region_code,
  description = EXCLUDED.description,
  updated_at = NOW();


-- ============================================================
-- 4. Euskadi / País Vasco — Static GeoJSON (opendata.euskadi.eus)
-- Dataset: Desfibriladores Externos Automatizados de Euskadi
-- Records: ~3,192 | Updated: monthly | Format: GeoJSON
-- GeoJSON auto-detection flattens properties.* and extracts
-- latitude/longitude from geometry.coordinates automatically.
-- Do NOT set jsonPath — let auto-detection handle it.
-- ============================================================

INSERT INTO external_data_sources (
  id,
  name,
  description,
  type,
  config,
  matching_strategy,
  matching_threshold,
  is_active,
  sync_frequency,
  auto_deactivate_missing,
  auto_update_fields,
  default_publication_mode,
  default_status,
  default_requires_attention,
  source_origin,
  country_code,
  region_code,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'DEAs Euskadi - Gobierno Vasco',
  'Desfibriladores Externos Automatizados de Euskadi — Open Data Euskadi (GeoJSON). ~3.200 registros. 3 provincias: Bizkaia, Gipuzkoa, Araba/Álava.',
  'JSON_FILE',
  '{
    "fileUrl": "https://opendata.euskadi.eus/contenidos/ds_localizaciones/desfibriladores/opendata/desfibriladores.geojson",
    "fieldMappings": {
      "codigo_dea": "externalId",
      "direccion": "address",
      "municipio": "city",
      "provincia": "province",
      "organismo": "organization",
      "ubicacion": "specificLocation",
      "horario": "accessSchedule",
      "numserie": "serialNumber",
      "modelo": "model"
    }
  }'::jsonb,
  'HYBRID',
  75,
  true,
  'MONTHLY',
  false,
  ARRAY[]::text[],
  'LOCATION_ONLY',
  'PUBLISHED',
  true,
  'HEALTH_API',
  'ES',
  'ES-PV',
  NOW(),
  NOW()
) ON CONFLICT (name) DO UPDATE SET
  config = EXCLUDED.config,
  type = EXCLUDED.type,
  country_code = EXCLUDED.country_code,
  region_code = EXCLUDED.region_code,
  description = EXCLUDED.description,
  updated_at = NOW();
