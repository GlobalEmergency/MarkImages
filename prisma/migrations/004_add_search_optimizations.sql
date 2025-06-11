-- Activar extensiones de PostgreSQL para búsqueda optimizada
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Índices de trigrama para búsqueda fuzzy en nombres de vías
CREATE INDEX IF NOT EXISTS vias_nombre_trigram_idx ON vias 
USING gin(nombre_normalizado gin_trgm_ops);

CREATE INDEX IF NOT EXISTS vias_nombre_acentos_trigram_idx ON vias 
USING gin(nombre_con_acentos gin_trgm_ops);

-- Índice compuesto para búsqueda por tipo + nombre
CREATE INDEX IF NOT EXISTS vias_clase_nombre_idx ON vias(clase_via, nombre_normalizado);

-- Índice para búsqueda de direcciones completas optimizada
CREATE INDEX IF NOT EXISTS direcciones_complete_search_idx ON direcciones(via_id, distrito_id, numero, codigo_postal);

-- Índice parcial para direcciones con número (más comunes en búsquedas)
CREATE INDEX IF NOT EXISTS direcciones_numbered_idx ON direcciones(via_id, numero) 
WHERE numero IS NOT NULL;

-- Índice parcial para vías principales
CREATE INDEX IF NOT EXISTS vias_main_types_idx ON vias(nombre_normalizado) 
WHERE clase_via IN ('CALLE', 'AVENIDA', 'PLAZA', 'PASEO', 'GLORIETA', 'RONDA');

-- Índice compuesto para búsqueda por distrito y código postal
CREATE INDEX IF NOT EXISTS direcciones_distrito_cp_idx ON direcciones(distrito_id, codigo_postal);

-- Función para normalizar texto eliminando acentos y convirtiendo a minúsculas
CREATE OR REPLACE FUNCTION normalize_text(input_text TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN lower(unaccent(trim(input_text)));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Función para calcular similitud de nombres de vías
CREATE OR REPLACE FUNCTION calculate_street_similarity(
    input_name TEXT,
    official_name TEXT,
    official_name_accents TEXT DEFAULT NULL
)
RETURNS FLOAT AS $$
DECLARE
    normalized_input TEXT;
    normalized_official TEXT;
    normalized_accents TEXT;
    similarity_score FLOAT;
    max_similarity FLOAT := 0;
BEGIN
    normalized_input := normalize_text(input_name);
    normalized_official := normalize_text(official_name);
    
    -- Calcular similitud con nombre normalizado
    similarity_score := similarity(normalized_input, normalized_official);
    max_similarity := GREATEST(max_similarity, similarity_score);
    
    -- Si hay nombre con acentos, también calcularlo
    IF official_name_accents IS NOT NULL THEN
        normalized_accents := normalize_text(official_name_accents);
        similarity_score := similarity(normalized_input, normalized_accents);
        max_similarity := GREATEST(max_similarity, similarity_score);
    END IF;
    
    RETURN max_similarity;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Vista optimizada para búsquedas de direcciones
CREATE OR REPLACE VIEW direcciones_search_view AS
SELECT 
    d.id,
    d.via_id,
    d.distrito_id,
    d.barrio_id,
    d.numero,
    d.codigo_postal,
    d.latitud,
    d.longitud,
    v.codigo_via,
    v.clase_via,
    v.nombre as via_nombre,
    v.nombre_con_acentos as via_nombre_acentos,
    v.nombre_normalizado as via_nombre_normalizado,
    dist.codigo_distrito,
    dist.nombre as distrito_nombre,
    dist.nombre_normalizado as distrito_nombre_normalizado,
    b.nombre as barrio_nombre,
    b.nombre_normalizado as barrio_nombre_normalizado
FROM direcciones d
JOIN vias v ON d.via_id = v.id
JOIN distritos dist ON d.distrito_id = dist.id
LEFT JOIN barrios b ON d.barrio_id = b.id;

-- Los índices en las tablas base ya optimizan las consultas en la vista
-- No se pueden crear índices directamente en vistas en PostgreSQL
