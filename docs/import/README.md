# Sistema de Importación de DEAs

Sistema completo para importar DEAs desde archivos CSV siguiendo arquitectura DDD y hexagonal.

## 📋 Índice

1. [Arquitectura](#arquitectura)
2. [Flujo de Importación](#flujo-de-importación)
3. [API Endpoints](#api-endpoints)
4. [Uso con Postman](#uso-con-postman)
5. [Estructura de Datos](#estructura-de-datos)
6. [Manejo de Errores](#manejo-de-errores)
7. [Trazabilidad](#trazabilidad)

## 🏗️ Arquitectura

El sistema sigue **DDD (Domain-Driven Design)** y **Arquitectura Hexagonal**:

```
📁 domain/                    # Capa de Dominio (sin dependencias)
  ├── import/
  │   ├── value-objects/      # CsvRow
  │   ├── constants/          # Mapeo de distritos
  │   └── ports/              # IImportRepository
  └── storage/
      └── ports/              # IImageStorage, IImageDownloader

📁 application/               # Capa de Aplicación (casos de uso)
  ├── import/
  │   └── use-cases/         # ImportDeaBatchUseCase
  └── storage/
      └── use-cases/         # UploadImageUseCase

📁 infrastructure/            # Capa de Infraestructura (implementaciones)
  ├── import/
  │   ├── parsers/           # CsvParserAdapter (papaparse)
  │   └── repositories/      # PrismaImportRepository
  └── storage/
      └── adapters/          # S3ImageStorageAdapter, SharePointImageDownloader

📁 app/api/                   # Capa de Interfaz (API REST)
  └── import/
      ├── route.ts           # POST /api/import
      └── [batchId]/
          └── route.ts       # GET /api/import/[batchId]
```

## 🔄 Flujo de Importación

```
1. POST /api/import
   ↓
2. Parse CSV (papaparse)
   ↓
3. Crear ImportBatch (PENDING)
   ↓
4. Actualizar estado (IN_PROGRESS)
   ↓
5. Procesar en chunks de 50 registros
   ├─ Validar campos mínimos
   ├─ Parsear coordenadas
   ├─ Mapear distrito
   ├─ Descargar imágenes SharePoint → S3
   ├─ Crear AED en DB (DRAFT)
   └─ Registrar errores
   ↓
6. Actualizar estado (COMPLETED)
   ↓
7. Retornar resultado
```

## 📡 API Endpoints

### POST /api/import

Inicia la importación de un batch de DEAs.

**Request Body:**

```json
{
  "filePath": "data/CSV/REGISTRO DEA MADRID 3550 (20250826).csv",
  "batchName": "Importación Inicial Mayo 2025",
  "importedBy": "admin@example.com",
  "sharePointCookies": {
    "rtFa": "...",
    "FedAuth": "..."
  },
  "chunkSize": 50
}
```

**Parámetros:**

- `filePath` (string, requerido): Ruta relativa al proyecto del archivo CSV
- `batchName` (string, requerido): Nombre descriptivo del batch
- `importedBy` (string, opcional): Email del usuario que importa (default: "system")
- `sharePointCookies` (object, opcional): Cookies de autenticación de SharePoint
  - `rtFa`: Cookie rtFa
  - `FedAuth`: Cookie FedAuth
- `chunkSize` (number, opcional): Tamaño de chunks para procesamiento (default: 50)

**Response Success (200):**

```json
{
  "success": true,
  "message": "Import completed",
  "data": {
    "batchId": "uuid-123",
    "totalRecords": 3500,
    "successfulRecords": 3450,
    "failedRecords": 50,
    "errors": [
      {
        "row": 123,
        "message": "Missing minimum required fields"
      }
    ]
  }
}
```

**Response Error (500):**

```json
{
  "success": false,
  "error": "Error message"
}
```

### GET /api/import/[batchId]

Consulta el estado de un batch de importación.

**URL:** `/api/import/{batchId}`

**Response Success (200):**

```json
{
  "success": true,
  "data": {
    "batch": {
      "id": "uuid-123",
      "name": "Importación Inicial Mayo 2025",
      "status": "COMPLETED",
      "createdAt": "2025-05-28T16:00:00Z",
      "startedAt": "2025-05-28T16:00:01Z",
      "completedAt": "2025-05-28T18:30:00Z"
    },
    "progress": {
      "total": 3500,
      "successful": 3450,
      "failed": 50,
      "percentage": 100
    },
    "stats": {
      "durationSeconds": 9000
    }
  }
}
```

## 🔧 Uso con Postman

### 1. Obtener Cookies de SharePoint

1. Abre Chrome/Edge
2. Navega a `https://madrid-my.sharepoint.com`
3. Inicia sesión
4. Abre DevTools (F12) → Application → Cookies
5. Copia los valores de `rtFa` y `FedAuth`

### 2. Importar con Postman

**Configuración:**

- **Method:** POST
- **URL:** `http://localhost:3000/api/import`
- **Headers:**
  - `Content-Type: application/json`
- **Body (raw JSON):**

```json
{
  "filePath": "data/CSV/REGISTRO DEA MADRID 3550 (20250826).csv",
  "batchName": "Importación Inicial - Prueba",
  "importedBy": "admin@madrid.es",
  "sharePointCookies": {
    "rtFa": "VALOR_COPIADO_AQUI",
    "FedAuth": "VALOR_COPIADO_AQUI"
  },
  "chunkSize": 50
}
```

### 3. Consultar Estado

**Configuración:**

- **Method:** GET
- **URL:** `http://localhost:3000/api/import/{batchId}`

Donde `{batchId}` es el ID retornado en el paso anterior.

## 📊 Estructura de Datos CSV

**Columnas requeridas:**

- `Propuesta de denominación` → Nombre del DEA
- `Nombre de la vía` → Calle
- `Número de la vía` → Número
- `Código postal` O `Distrito` → Ubicación

**Columnas opcionales pero importantes:**

- `Coordenadas-Latitud (norte)` → Latitud
- `Coordenadas-Longitud (oeste...)` → Longitud
- `Foto 1` → URL de imagen frontal
- `Foto 2` → URL de imagen de ubicación
- `Correo electrónico` → Email responsable
- `Tipo de establecimiento` → Tipo
- Horarios de apertura/cierre

**Separador:** Punto y coma (`;`)

## ⚠️ Manejo de Errores

### Tipos de Errores

1. **Validación**: Campos mínimos faltantes
2. **Formato**: Coordenadas inválidas
3. **Imágenes**: Fallo en descarga/upload
4. **Sistema**: Errores de DB, network, etc.

### Estrategia de Errores

- **Campos mínimos faltantes** → Se omite el registro, se registra error
- **Imágenes fallidas** → Se importa DEA sin imágenes, continúa
- **Coordenadas inválidas** → Se importa con coordenadas null
- **Distrito no mapeado** → Se importa sin distrito

### Consultar Errores

Los errores se registran en la tabla `import_errors`:

```sql
SELECT * FROM import_errors
WHERE import_batch_id = 'uuid-123'
ORDER BY row_number;
```

## 📝 Trazabilidad

Cada DEA importado tiene:

```typescript
{
  status: 'DRAFT',
  source_origin: 'CSV_IMPORT',
  import_batch_id: 'uuid-del-batch',
  external_reference: 'ID-del-CSV',
  requires_attention: true,
  attention_reason: 'Imported - Pending verification',
  origin_observations: '{ ...JSON completo del CSV... }'
}
```

### Consultar DEAs de un Batch

```sql
SELECT id, name, status, requires_attention
FROM aeds
WHERE import_batch_id = 'uuid-123';
```

### Verificar Imágenes Importadas

```sql
SELECT a.name, i.type, i.original_url
FROM aeds a
JOIN aed_images i ON i.aed_id = a.id
WHERE a.import_batch_id = 'uuid-123';
```

## 🔍 Monitoreo

### Ver Progreso en Logs

Durante la importación, los logs muestran:

```
📄 Parsing CSV file: data/CSV/...
📦 Creating import batch: Importación Inicial
🔄 Processing chunk 1/70 (50 records)
✅ Processed 10 records successfully
✅ Processed 20 records successfully
...
❌ Row 123: Missing minimum required fields
...
✅ Import completed: 3450 successful, 50 failed
```

### Verificar Estado en DB

```sql
SELECT
  id,
  name,
  status,
  total_records,
  successful_records,
  failed_records,
  started_at,
  completed_at
FROM import_batches
ORDER BY created_at DESC;
```

## ✅ Checklist Post-Importación

Después de importar:

1. [ ] Verificar cantidad de registros importados
2. [ ] Revisar errores en `import_errors`
3. [ ] Validar que las imágenes se subieron a S3
4. [ ] Comprobar que los DEAs están en estado `DRAFT`
5. [ ] Verificar que `requires_attention = true`
6. [ ] Revisar campos `origin_observations` (JSON completo)

## 🚀 Próximos Pasos

Después de la importación, los DEAs pueden:

1. **Validarse** con el sistema de verificación existente
2. **Procesarse** las imágenes (blur de caras, recorte, etc.)
3. **Publicarse** cambiando estado a `PUBLISHED`

## 📚 Referencias

- [Arquitectura Hexagonal](../architecture/hexagonal.md)
- [Domain-Driven Design](../architecture/ddd.md)
- [Sistema de Validación](../verification/README.md)
