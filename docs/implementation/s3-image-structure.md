# Nueva Estructura de Rutas S3 para Imágenes

**Fecha de implementación:** 2025-12-02  
**Versión:** 1.0.0

## 📋 Resumen

Se ha implementado una nueva estructura organizada para el almacenamiento de imágenes en S3, con seguridad mejorada mediante hash aleatorio en las imágenes originales.

## 🎯 Estructura de Rutas S3

### Formato

```
/AEDID(uuid)/
  ├── IMAGEID(uuid)_original_HASH.ext    ← Original con hash de seguridad
  ├── IMAGEID(uuid).ext                   ← Procesada (verificada)
  └── IMAGEID(uuid)_thumb.ext             ← Thumbnail (futuro)
```

### Ejemplo Real

```
550e8400-e29b-41d4-a716-446655440000/
  ├── 123e4567-e89b-12d3-a456-426614174000_original_8f4c9a2b.jpg
  ├── 123e4567-e89b-12d3-a456-426614174000.jpg
  └── 123e4567-e89b-12d3-a456-426614174000_thumb.jpg
```

## 🔐 Seguridad

### Hash de Seguridad en Originales

- **Método:** `crypto.randomBytes(4).toString('hex')`
- **Longitud:** 8 caracteres hexadecimales
- **Combinaciones posibles:** 4.3 mil millones
- **Objetivo:** Evitar que las imágenes originales sean predecibles o descubribles

### ¿Por Qué Solo en Originales?

- ✅ **Original**: Necesita protección (puede contener información sensible sin procesar)
- ❌ **Processed**: Ya pasó por verificación, es segura para mostrar públicamente
- ❌ **Thumbnail**: Derivada de la procesada, también segura

## 📁 Archivos Modificados

### 1. `src/lib/s3-utils.ts` (NUEVO)

Funciones auxiliares para generación de rutas y hash:

```typescript
- generateSecurityHash(): string
- buildImageKey(aedId, imageId, variant, extension): string
- extractExtension(filename): string
- parseS3Url(url): object | null
- buildS3Url(bucket, region, key): string
```

### 2. `src/domain/storage/ports/IImageStorage.ts`

Añadidos parámetros opcionales para nueva estructura:

```typescript
interface ImageUploadOptions {
  // ... campos existentes
  aedId?: string;
  imageId?: string;
  variant?: ImageVariant;
}
```

### 3. `src/infrastructure/storage/adapters/S3ImageStorageAdapter.ts`

Lógica de decisión para usar nueva estructura o legacy:

```typescript
if (aedId && imageId) {
  // Nueva estructura con hash
  key = buildImageKey(aedId, imageId, variant, extension);
} else {
  // Backward compatibility: estructura legacy
  key = `${prefix}/${timestamp}-${sanitizedFilename}`;
}
```

### 4. `scripts/legacy-migration/services/ImageMigrator.ts`

Migración actualizada para usar nueva estructura:

```typescript
async migrateImages(
  aedId: string,              // UUID del AED en el nuevo sistema
  legacyRecord: LegacyDeaRecord,
  verificationSession: LegacyVerificationSession | null
): Promise<ImageData[]>
```

**Características:**

- Genera `imageId` único por cada imagen
- Detecta si viene solo original o original+processed
- Sube con nomenclatura correcta según tipo
- Actualiza columnas de BD correctamente

### 5. `scripts/legacy-migration/migrate-legacy-deas.ts`

Script principal actualizado:

```typescript
// Genera UUID del AED antes de migrar imágenes
const aedId = randomUUID();

// Migra imágenes con el aedId
transformed.images = await imageMigrator.migrateImages(aedId, record, verificationSession);

// Crea AED con UUID pre-generado
await saveAed(currentDb, transformed, batchId!, aedId);
```

## 🔄 Flujos de Trabajo

### Flujo 1: Subida Nueva (API)

```typescript
// 1. Usuario sube imagen
POST / api / upload;

// 2. Se genera/recibe aedId e imageId
const aedId = req.body.aedId; // UUID del AED
const imageId = randomUUID(); // Nuevo UUID para imagen

// 3. Se sube con nueva estructura
await imageStorage.upload({
  buffer,
  filename,
  contentType,
  aedId,
  imageId,
  variant: "original",
});

// Resultado:
// /550e8400.../123e4567..._original_8f4c9a2b.jpg
```

### Flujo 2: Migración Legacy

```typescript
// 1. Script genera UUID del AED
const aedId = randomUUID();

// 2. ImageMigrator genera UUID por imagen
const imageId = randomUUID();

// 3. Descarga imagen legacy
const buffer = await downloadImage(sourceUrl);

// 4. Sube con nueva estructura
const key = buildImageKey(aedId, imageId, "original", "jpg");
// Resultado: /550e8400.../123e4567..._original_8f4c9a2b.jpg

// 5. Si existe processed, usa mismo imageId
const keyProcessed = buildImageKey(aedId, imageId, "processed", "jpg");
// Resultado: /550e8400.../123e4567....jpg
```

### Flujo 3: Generación de Thumbnails (Futuro)

```typescript
// Proceso posterior que:
// 1. Lee original_url de la BD
// 2. Descarga imagen original
// 3. Genera thumbnail con Sharp
// 4. Extrae aedId e imageId de la URL original
// 5. Sube thumbnail con buildImageKey(aedId, imageId, 'thumb', ext)
// 6. Actualiza columna thumbnail_url en BD
```

## 🗄️ Base de Datos

### Campos en `aed_images`

```sql
CREATE TABLE aed_images (
  id                UUID PRIMARY KEY,
  aed_id            UUID NOT NULL,
  type              VARCHAR NOT NULL,  -- FRONT, LOCATION
  order             INT NOT NULL,

  -- URLs con nueva estructura
  original_url      TEXT NOT NULL,     -- con hash de seguridad
  processed_url     TEXT,              -- sin hash (procesada)
  thumbnail_url     TEXT,              -- sin hash (thumbnail)

  -- Metadata
  width             INT,
  height            INT,
  size_bytes        INT,
  format            VARCHAR,

  -- Verificación
  is_verified       BOOLEAN DEFAULT false,
  verified_at       TIMESTAMP,

  created_at        TIMESTAMP DEFAULT NOW()
);
```

## 🔧 Backward Compatibility

La implementación mantiene compatibilidad con el sistema anterior:

```typescript
// Si NO se proporcionan aedId/imageId
// → Usa estructura legacy: dea-foto/timestamp-filename.jpg

// Si SÍ se proporcionan
// → Usa nueva estructura: aedId/imageId_variant_hash.ext
```

## ✅ Validación

### Tests Realizados

- [x] Linter: `npm run lint:fix` - ✅ Sin errores críticos
- [x] Build: `npm run build` - ✅ Compilación exitosa
- [x] TypeScript: ✅ Sin errores de tipos

### Tests Pendientes

- [ ] Ejecutar migración en entorno de prueba
- [ ] Verificar rutas S3 generadas
- [ ] Validar que imágenes procesadas se suban sin hash
- [ ] Confirmar que imágenes originales tienen hash aleatorio

## 📊 Ventajas de la Nueva Estructura

1. **Organización por AED**: Fácil navegación en S3
2. **Trazabilidad**: Cada imagen tiene UUID único
3. **Versionado implícito**: original → processed → thumb
4. **Seguridad mejorada**: Hash aleatorio en originales
5. **Backward compatible**: No rompe sistema actual
6. **Preparado para el futuro**: Thumbnails, optimizaciones, etc.

## 🚀 Próximos Pasos

1. Ejecutar `npm run migrate:legacy` en entorno de prueba
2. Verificar estructura de archivos en S3
3. Implementar proceso de generación de thumbnails
4. Actualizar documentación de API si es necesario
5. Considerar migración de imágenes legacy existentes (opcional)

## 📝 Notas Técnicas

- Hash se genera con `crypto.randomBytes` (criptográficamente seguro)
- Extension se extrae automáticamente de filename/URL
- Si base64 data URI, detecta automáticamente la extensión
- URLs construidas con `buildS3Url` para consistencia
- ImageMigrator maneja reintentos automáticos (3 intentos)

---

**Autor:** Claude/Cline  
**Revisión:** Pendiente  
**Estado:** ✅ Implementado
