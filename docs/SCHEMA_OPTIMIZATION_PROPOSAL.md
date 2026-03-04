# Propuesta de Optimización del Schema de Base de Datos

## Resumen de Problemas Detectados

El análisis del schema actual revela **redundancias significativas** en varias áreas. Este documento propone una simplificación que reduciría la complejidad sin perder funcionalidad.

---

## 1. COORDENADAS DUPLICADAS (Crítico)

### Problema Actual

Las coordenadas están almacenadas en **3 lugares diferentes**:

| Ubicación     | Campos                                                   |
| ------------- | -------------------------------------------------------- |
| `Aed`         | `latitude`, `longitude`, `coordinates_precision`, `geom` |
| `AedLocation` | `latitude`, `longitude`, `coordinates_precision`         |

**Total: 7 campos para la misma información**

### Propuesta

Mantener coordenadas **SOLO en `Aed`** (tabla principal):

- `latitude`, `longitude` → Para consultas rápidas
- `geom` → Para consultas espaciales PostGIS
- `coordinates_precision` → Una sola vez

**Eliminar de `AedLocation`**: `latitude`, `longitude`, `coordinates_precision`

**Ahorro: 3 campos**

---

## 2. CAMPOS DE NOTAS EXCESIVOS EN `Aed`

### Problema Actual

La tabla `Aed` tiene **9 campos de texto para notas/observaciones**:

```
ACTIVOS:
- public_notes          → "Información pública visible para todos"
- internal_notes        → "Notas internas consolidadas"
- validation_notes      → "Notas de validación"
- attention_reason      → "Razón de atención requerida"
- rejection_reason      → "Razón de rechazo"
- publication_notes     → "Notas de publicación"

DEPRECADOS (aún en schema):
- origin_observations   → @deprecated
- validation_observations → @deprecated
```

### Propuesta

Consolidar en **3 campos**:

| Campo              | Uso                                                                                 |
| ------------------ | ----------------------------------------------------------------------------------- |
| `public_notes`     | Información visible públicamente                                                    |
| `internal_notes`   | Todo lo interno: observaciones de origen, razones de atención, notas de publicación |
| `rejection_reason` | Razón de rechazo (específico para workflow)                                         |

**Eliminar**:

- `validation_notes` → Mover a `AedValidation.notes`
- `attention_reason` → Consolidar en `internal_notes`
- `publication_notes` → Consolidar en `internal_notes`
- `origin_observations` → Ya deprecado, eliminar definitivamente
- `validation_observations` → Ya deprecado, eliminar definitivamente

**Ahorro: 5 campos**

---

## 3. CAMPOS DE ACCESO EXCESIVOS EN `AedLocation`

### Problema Actual

La tabla `AedLocation` tiene **8 campos de texto libre**:

```
ACTIVOS:
- additional_info        → "Información adicional de dirección"
- specific_location      → "Ubicación específica"
- access_instructions    → "Instrucciones de acceso"
- public_notes           → "Notas públicas"

DEPRECADOS (aún en schema):
- access_description     → @deprecated
- visible_references     → @deprecated
- access_warnings        → @deprecated
- location_observations  → @deprecated
```

### Propuesta

Consolidar en **2 campos**:

| Campo                 | Uso                                                                                            |
| --------------------- | ---------------------------------------------------------------------------------------------- |
| `location_details`    | Combina: `additional_info` + `specific_location` + `floor` (ej: "Planta 2, junto a recepción") |
| `access_instructions` | Combina: instrucciones de acceso, referencias visibles, avisos                                 |

**Eliminar**:

- `additional_info` → Fusionar en `location_details`
- `specific_location` → Fusionar en `location_details`
- `public_notes` → Redundante con `Aed.public_notes`
- `access_description` → Ya deprecado, eliminar
- `visible_references` → Ya deprecado, eliminar
- `access_warnings` → Ya deprecado, eliminar
- `location_observations` → Ya deprecado, eliminar

**Ahorro: 6 campos** (manteniendo `floor` separado por utilidad en búsquedas)

---

## 4. CAMPOS EXCESIVOS EN `AedSchedule`

### Problema Actual

```
- description           → "Descripción del horario"
- observations          → "Observaciones"
- schedule_exceptions   → "Excepciones de horario"
- access_instructions   → "Instrucciones de acceso"
```

**4 campos de texto libre que frecuentemente contienen información similar**

### Propuesta

Consolidar en **2 campos**:

| Campo         | Uso                                                                         |
| ------------- | --------------------------------------------------------------------------- |
| `description` | Descripción general del horario + excepciones                               |
| `notes`       | Observaciones adicionales e instrucciones de acceso específicas del horario |

**Eliminar**:

- `schedule_exceptions` → Fusionar en `description`
- `access_instructions` → Fusionar en `notes` o eliminar (ya está en `AedLocation`)

**Ahorro: 2 campos**

---

## 5. CAMPOS DUPLICADOS EN `AedResponsible`

### Problema Actual

```
- observations    → "Observaciones"
- contact_notes   → "Notas de contacto"
```

### Propuesta

Mantener solo **1 campo**:

| Campo   | Uso                                  |
| ------- | ------------------------------------ |
| `notes` | Todas las notas sobre el responsable |

**Ahorro: 1 campo**

---

## 6. DUPLICACIÓN CON `AedAddressValidation`

### Problema Actual

`AedAddressValidation` replica toda la información geográfica:

```
- official_street_name
- official_number
- official_postal_code
- official_city_name
- official_city_code
- official_district_code
- official_district_name
- official_neighborhood_code
- official_neighborhood_name
```

Esto es **9 campos** que duplican lo que ya está en `AedLocation`.

### Propuesta

Esta duplicación tiene sentido semántico (dirección original vs dirección oficial validada), pero se puede simplificar:

| Campo                        | Uso                                                |
| ---------------------------- | -------------------------------------------------- |
| `validated_address` (JSON)   | Contiene la dirección oficial validada como objeto |
| `address_corrections` (JSON) | Diferencias detectadas entre original y validada   |

**Ahorro: 7 campos** (reemplazando 9 por 2 JSON)

---

## 7. CAMPOS DEPRECADOS SIN ELIMINAR

### Problema Actual

Hay campos marcados como `@deprecated` que siguen en el schema:

En `Aed`:

- `origin_observations`
- `validation_observations`

En `AedLocation`:

- `access_description`
- `visible_references`
- `access_warnings`
- `location_observations`

### Propuesta

Crear una migración para eliminar definitivamente estos 6 campos una vez migrados los datos.

---

## Resumen de Optimización

### Campos a Eliminar/Consolidar

| Tabla                  | Campos Actuales | Campos Propuestos | Ahorro       |
| ---------------------- | --------------- | ----------------- | ------------ |
| `Aed` (notas)          | 8               | 3                 | **5 campos** |
| `AedLocation` (coords) | 3               | 0                 | **3 campos** |
| `AedLocation` (notas)  | 8               | 2                 | **6 campos** |
| `AedSchedule`          | 4               | 2                 | **2 campos** |
| `AedResponsible`       | 2               | 1                 | **1 campo**  |
| `AedAddressValidation` | 9               | 2 (JSON)          | **7 campos** |
| Campos deprecados      | 6               | 0                 | **6 campos** |

**TOTAL: ~30 campos eliminados/consolidados**

---

## Schema Propuesto Simplificado

### Aed (Simplificado)

```prisma
model Aed {
  id                        String                   @id @default(uuid()) @db.Uuid
  code                      String?                  @unique
  provisional_number        Int?
  name                      String
  establishment_type        String?

  // GEOSPATIAL - Único lugar para coordenadas
  latitude                  Float?
  longitude                 Float?
  coordinates_precision     String?
  geom                      Unsupported("geometry(Point, 4326)")?

  // Origin and traceability
  source_origin             SourceOrigin             @default(WEB_FORM)
  source_details            String?
  batch_job_id              String?                  @db.Uuid
  external_reference        String?

  // NOTAS SIMPLIFICADAS (solo 3 campos)
  public_notes              String?    // Visible públicamente
  internal_notes            String?    // Todo lo interno
  rejection_reason          String?    // Razón de rechazo específica

  requires_attention        Boolean                  @default(false)

  // Verification
  last_verified_at          DateTime?
  verification_method       String?
  is_publicly_accessible    Boolean    @default(true)
  installation_date         DateTime?

  // Status & Publication
  status                    AedStatus                @default(DRAFT)
  status_metadata           Json?
  published_at              DateTime?
  publication_mode          PublicationMode          @default(LOCATION_ONLY)
  publication_requested_at  DateTime?
  publication_approved_at   DateTime?
  publication_approved_by   String?                  @db.Uuid

  // Ownership
  owner_user_id             String?                  @db.Uuid
  sequence                  Int                      @default(autoincrement())

  // Relationships
  location_id               String                   @unique @db.Uuid
  responsible_id            String?                  @db.Uuid
  schedule_id               String?                  @unique @db.Uuid

  // ... resto de relaciones igual ...
}
```

### AedLocation (Simplificado)

```prisma
model AedLocation {
  id                      String    @id @default(uuid()) @db.Uuid

  // Dirección
  street_type             String?
  street_name             String?
  street_number           String?
  postal_code             String?

  // SIN coordenadas (están en Aed)

  // Geografía
  city_name               String?
  city_code               String?
  district_code           String?
  district_name           String?
  neighborhood_code       String?
  neighborhood_name       String?

  // ACCESO SIMPLIFICADO (solo 3 campos)
  floor                   String?              // Mantener separado para filtros
  location_details        String?              // Combina: additional_info + specific_location
  access_instructions     String?              // Todo sobre acceso

  // ... resto igual ...
}
```

### AedSchedule (Simplificado)

```prisma
model AedSchedule {
  id                      String    @id @default(uuid()) @db.Uuid

  // Flags
  has_24h_surveillance    Boolean   @default(false)
  has_restricted_access   Boolean   @default(false)

  // Horarios estructurados
  weekday_opening         String?
  weekday_closing         String?
  saturday_opening        String?
  saturday_closing        String?
  sunday_opening          String?
  sunday_closing          String?

  // Días especiales
  holidays_as_weekday     Boolean   @default(false)
  closed_on_holidays      Boolean   @default(false)
  closed_in_august        Boolean   @default(false)

  // NOTAS SIMPLIFICADAS (solo 2 campos)
  description             String?   // Descripción + excepciones
  notes                   String?   // Observaciones adicionales

  // ... resto igual ...
}
```

### AedResponsible (Simplificado)

```prisma
model AedResponsible {
  id                String    @id @default(uuid()) @db.Uuid
  name              String
  email             String?
  phone             String?
  alternative_phone String?
  ownership         String?
  local_ownership   String?
  local_use         String?
  organization      String?
  position          String?
  department        String?

  // NOTAS SIMPLIFICADAS (solo 1 campo)
  notes             String?   // Todas las observaciones

  // ... resto igual ...
}
```

---

## Plan de Migración

### Fase 1: Migración de Datos

```sql
-- 1. Consolidar notas en Aed
UPDATE aeds SET
  internal_notes = CONCAT_WS(E'\n---\n',
    NULLIF(internal_notes, ''),
    NULLIF(origin_observations, ''),
    CASE WHEN attention_reason IS NOT NULL THEN CONCAT('Atención: ', attention_reason) END,
    CASE WHEN publication_notes IS NOT NULL THEN CONCAT('Publicación: ', publication_notes) END
  )
WHERE origin_observations IS NOT NULL
   OR attention_reason IS NOT NULL
   OR publication_notes IS NOT NULL;

-- 2. Consolidar notas de ubicación
UPDATE aed_locations SET
  access_instructions = CONCAT_WS(E'\n',
    NULLIF(access_instructions, ''),
    NULLIF(access_description, ''),
    NULLIF(visible_references, ''),
    NULLIF(access_warnings, '')
  ),
  -- Crear location_details combinando campos
  -- (esto requiere agregar la columna primero)
WHERE access_description IS NOT NULL
   OR visible_references IS NOT NULL;

-- 3. Mover coordenadas de AedLocation a Aed (si no están ya)
UPDATE aeds a SET
  latitude = COALESCE(a.latitude, l.latitude),
  longitude = COALESCE(a.longitude, l.longitude),
  coordinates_precision = COALESCE(a.coordinates_precision, l.coordinates_precision)
FROM aed_locations l
WHERE a.location_id = l.id
  AND a.latitude IS NULL
  AND l.latitude IS NOT NULL;
```

### Fase 2: Eliminar Columnas

```sql
-- Eliminar campos deprecados
ALTER TABLE aeds DROP COLUMN origin_observations;
ALTER TABLE aeds DROP COLUMN validation_observations;
ALTER TABLE aeds DROP COLUMN attention_reason;
ALTER TABLE aeds DROP COLUMN publication_notes;
ALTER TABLE aeds DROP COLUMN validation_notes;

ALTER TABLE aed_locations DROP COLUMN latitude;
ALTER TABLE aed_locations DROP COLUMN longitude;
ALTER TABLE aed_locations DROP COLUMN coordinates_precision;
ALTER TABLE aed_locations DROP COLUMN access_description;
ALTER TABLE aed_locations DROP COLUMN visible_references;
ALTER TABLE aed_locations DROP COLUMN access_warnings;
ALTER TABLE aed_locations DROP COLUMN location_observations;
ALTER TABLE aed_locations DROP COLUMN additional_info;
ALTER TABLE aed_locations DROP COLUMN specific_location;
ALTER TABLE aed_locations DROP COLUMN public_notes;

ALTER TABLE aed_schedules DROP COLUMN observations;
ALTER TABLE aed_schedules DROP COLUMN schedule_exceptions;
ALTER TABLE aed_schedules DROP COLUMN access_instructions;

ALTER TABLE aed_responsibles DROP COLUMN observations;
-- Renombrar contact_notes a notes
ALTER TABLE aed_responsibles RENAME COLUMN contact_notes TO notes;
```

---

## Beneficios de la Optimización

1. **Menos confusión**: Claro dónde guardar cada tipo de información
2. **Mejor rendimiento**: Menos columnas = índices más pequeños, queries más rápidas
3. **Menor mantenimiento**: Un solo lugar para cada concepto
4. **Datos más limpios**: Sin duplicación de información entre tablas
5. **Migración más fácil**: Menos campos que mapear en imports/exports

---

## Preguntas Antes de Implementar

1. ¿Hay alguna integración externa que dependa de los campos deprecados?
2. ¿Quieres mantener `validation_notes` separado de `AedValidation.notes`?
3. ¿El campo `public_notes` en `AedLocation` tiene un uso diferente al de `Aed`?
4. ¿Prefieres JSON o campos separados para la dirección validada en `AedAddressValidation`?

---

_Documento generado: 2025-12-21_
