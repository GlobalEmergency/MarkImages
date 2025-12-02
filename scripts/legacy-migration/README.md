# Legacy DEA Migration

Script para migrar datos desde las tablas legacy `dea_records` y `verification_sessions` a la arquitectura actual.

## Características

✅ **Idempotente**: Puede ejecutarse múltiples veces sin duplicar datos  
✅ **Preserva imágenes**: Migra originales y procesadas (con marcas)  
✅ **Mapeo de estados**: Convierte estados legacy a actuales  
✅ **Trazabilidad**: Guarda metadata de revisor y validación  
✅ **Manejo de errores**: Continúa ante errores individuales  
✅ **Progress tracking**: Actualiza progreso en ImportBatch

## Variables de Entorno

Configurar en `.env.local`:

```bash
# Base de datos actual
DATABASE_URL="postgresql://user:pass@host/current_db"

# Base de datos legacy (OBLIGATORIO)
LEGACY_DATABASE_URL="postgresql://user:pass@host/legacy_db"

# AWS S3 (OBLIGATORIO para migrar imágenes)
AWS_S3_BUCKET="your-bucket-name"
AWS_REGION="eu-west-1"
AWS_ACCESS_KEY_ID="your-access-key"
AWS_SECRET_ACCESS_KEY="your-secret-key"

# Opciones (opcional)
MIGRATION_BATCH_SIZE=10
MIGRATION_DRY_RUN=false
MIGRATION_SKIP_IMAGES=false
MIGRATION_VERBOSE=false
```

## Uso

### Dry Run (Prueba sin escribir)

```bash
npm run migrate:legacy -- --dry-run
```

### Migración Real

```bash
npm run migrate:legacy
```

### Opciones

```bash
# Migrar sin imágenes (más rápido)
npm run migrate:legacy -- --skip-images

# Lotes más pequeños (5 registros por lote)
npm run migrate:legacy -- --batch-size=5

# Modo verbose (ver queries SQL)
npm run migrate:legacy -- --verbose

# Combinar opciones
npm run migrate:legacy -- --batch-size=20 --verbose
```

## Mapeo de Datos

### Estados Legacy → Actuales

| Legacy        | Actual           |
| ------------- | ---------------- |
| `verified`    | `PUBLISHED`      |
| `in_progress` | `PENDING_REVIEW` |
| `pending`     | `DRAFT`          |
| `rejected`    | `INACTIVE`       |

### Campos Utilizados

✅ **Usa columnas `def*`** (datos validados):

- `defTipoVia`, `defNombreVia`, `defNumero`
- `defCp`, `defDistrito`, `defBarrio`
- `defLat`, `defLon`, `defCodDea`

❌ **Ignora columnas `gm*` y originales**

### Imágenes

Para cada DEA se migran:

1. **Imagen 1 (FRONT)**:
   - `original_url`: `vs.original_image_url` o `foto1`
   - `processed_url`: `vs.processed_image_url` ✅ CON MARCAS

2. **Imagen 2 (LOCATION)**:
   - `original_url`: `vs.second_image_url` o `foto2`
   - `processed_url`: `vs.second_processed_image_url` ✅ CON MARCAS

## Datos del Responsable

⚠️ **Importante**:

- `correoElectronico` + `nombre` = **Revisor** (guardado en metadata)
- `titularidad` = **Titular** (organización responsable del DEA)

## Proceso de Migración

1. ✅ Verifica registros ya migrados (idempotencia)
2. ✅ Extrae datos de BD legacy con LEFT JOIN a verification_sessions
3. ✅ Transforma usando solo campos `def*`
4. ✅ Descarga y sube imágenes a S3 nuevo
5. ✅ Crea en transacción:
   - AedResponsible (find or create)
   - AedLocation
   - AedSchedule
   - Aed
   - AedImages (original + processed)
   - AedValidations (ADDRESS + IMAGES marcadas como COMPLETED)
   - AedAddressValidation
6. ✅ Actualiza progreso cada 5 lotes
7. ✅ Log de errores en `import_errors`

## Estructura Creada

```
ImportBatch (LEGACY_MIGRATION)
├─ Aed (status según image_verification_status)
│  ├─ AedLocation (con def* fields)
│  ├─ AedSchedule
│  ├─ AedResponsible (organización)
│  ├─ AedImages (original + processed)
│  ├─ AedValidations
│  │  ├─ ADDRESS (COMPLETED)
│  │  └─ IMAGES (COMPLETED)
│  └─ AedAddressValidation
└─ ImportErrors (si hay fallos)
```

## Validación Post-Migración

```sql
-- Ver total migrado
SELECT COUNT(*) FROM aeds WHERE source_origin = 'LEGACY_MIGRATION';

-- Ver con imágenes
SELECT
  COUNT(DISTINCT a.id) as aeds_count,
  COUNT(i.id) as images_count
FROM aeds a
LEFT JOIN aed_images i ON i.aed_id = a.id
WHERE a.source_origin = 'LEGACY_MIGRATION';

-- Ver estados
SELECT status, COUNT(*)
FROM aeds
WHERE source_origin = 'LEGACY_MIGRATION'
GROUP BY status;

-- Ver validaciones completadas
SELECT type, status, COUNT(*)
FROM aed_validations v
JOIN aeds a ON a.id = v.aed_id
WHERE a.source_origin = 'LEGACY_MIGRATION'
GROUP BY type, status;
```

## Troubleshooting

### Error: "Missing required configuration"

→ Verificar que `LEGACY_DATABASE_URL` esté en `.env.local`

### Error: "Connection timeout"

→ Verificar conectividad a BD legacy

### Imágenes no se migran

→ Verificar credenciales AWS S3  
→ Usar `--skip-images` para migrar solo datos

### "Already migrated" para todos

→ El script es idempotente, verifica `external_reference` en BD actual

## Arquitectura

El script sigue **DDD + Hexagonal + Outside-In**:

- **Domain**: `types.ts`, Value Objects
- **Application**: `DataTransformer`, `BatchCreator`
- **Infrastructure**: `LegacyDataExtractor`, `ImageMigrator`
- **Interfaces**: Script principal

## Autor

Implementado siguiendo las reglas de desarrollo del proyecto (SOLID, DDD, Clean Code).
