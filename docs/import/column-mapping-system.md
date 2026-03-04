# Sistema de Mapeo de Columnas - Importación de DEAs

## Visión General

El sistema de mapeo de columnas permite importar archivos CSV con cualquier estructura, proporcionando una interfaz para que el usuario mapee las columnas del CSV a los campos requeridos del sistema.

## Arquitectura

### Domain Layer (Dominio)

#### Value Objects

- **`FieldDefinition`**: Define los campos del sistema (requeridos y opcionales)
- **`ColumnMapping`**: Representa el mapeo de una columna CSV a un campo del sistema
- **`CsvPreview`**: Contiene headers y muestra de datos del CSV
- **`ValidationResult`**: Resultado de validaciones con issues detectados

#### Entities

- **`ImportSession`**: Gestiona el estado completo de una sesión de importación

#### Services

- **`ColumnMappingService`**: Servicio de dominio para sugerencias automáticas y validación de mapeos

### Application Layer (Aplicación)

#### Use Cases

1. **`ParseCsvPreviewUseCase`**: Parsea CSV y genera preview
2. **`SuggestColumnMappingUseCase`**: Genera sugerencias automáticas de mapeo
3. **`PreValidateDataUseCase`**: Pre-valida datos antes de importar

### Infrastructure Layer (Infraestructura)

- Los use cases usan Prisma directamente para validaciones de BD

### Interface Layer (API + Frontend)

#### API Routes

- **`POST /api/import/preview`**: Sube CSV, genera preview y sugerencias
- **`POST /api/import/validate`**: Pre-valida datos con mapeos configurados
- **`POST /api/import/execute`**: Ejecuta la importación (pendiente adaptar)

#### Frontend Components

- **`ImportWizard`**: Componente principal que orquesta el flujo multi-paso

## Flujo de Importación

### Paso 1: Upload y Preview

```
Usuario sube CSV
  → POST /api/import/preview
  → ParseCsvPreviewUseCase
  → SuggestColumnMappingUseCase
  → Retorna preview + sugerencias
```

### Paso 2: Mapeo de Columnas

```
Usuario revisa sugerencias automáticas
  → Ajusta mapeos manualmente si es necesario
  → Confirma que campos requeridos están mapeados
```

### Paso 3: Validación

```
Usuario confirma mapeos
  → POST /api/import/validate
  → PreValidateDataUseCase
  → Valida:
    - Campos requeridos no vacíos
    - Distritos existen en BD
    - Coordenadas válidas
    - Códigos postales correctos
  → Retorna issues encontrados
```

### Paso 4: Importación

```
Si validación exitosa
  → POST /api/import/execute
  → Procesa batch completo usando mapeos
```

## Campos del Sistema

### Campos Requeridos

- `proposedName`: Nombre del establecimiento
- `district`: Distrito de Madrid
- `streetName`: Nombre de la vía
- `streetNumber`: Número del portal

### Campos Opcionales

- Información del responsable (email, nombre)
- Coordenadas (latitud, longitud)
- Dirección completa (tipo vía, complemento, CP)
- Fotos (URLs)
- Horarios (apertura/cierre)
- Vigilancia 24h
- Y más...

Ver `src/domain/import/value-objects/FieldDefinition.ts` para lista completa.

## Sugerencias Automáticas

El sistema usa algoritmos de similitud (Levenshtein distance) para sugerir mapeos:

1. **Normalización**: Elimina acentos, minúsculas, solo alfanuméricos
2. **Similitud**: Calcula distancia entre nombres
3. **Keywords**: Bonus por palabras clave ("distrito", "correo", "latitud", etc.)
4. **Confianza**: Score 0-1, sugiere automáticamente si >= 0.7

### Ejemplo

```typescript
CSV: "Correo electrónico" → Sistema: "submitterEmail" (0.85 confianza)
CSV: "Distrito"           → Sistema: "district"         (1.0 confianza)
CSV: "Nombre de la vía"   → Sistema: "streetName"       (0.78 confianza)
```

## Validaciones

### Pre-Validación (antes de importar)

- **Críticas**: Bloquean importación
  - Distrito no existe en BD
- **Errores**: Deberían corregirse
  - Campos requeridos vacíos
  - Distrito no reconocido
  - Coordenadas fuera de rango
- **Warnings**: Informativas
  - Código postal formato incorrecto
  - Campos opcionales vacíos

### Durante Importación

- Mapeo de distritos mejorado con más variantes
- Creación de relaciones (responsable, ubicación, horario)
- Manejo de errores por registro

## Uso

### Desde la UI

```
1. Ir a /import
2. Subir archivo CSV
3. Revisar preview y mapeos sugeridos
4. Ajustar mapeos si es necesario
5. Validar datos
6. Confirmar e importar
```

### Programático

```typescript
// 1. Preview
const formData = new FormData();
formData.append("file", csvFile);

const previewResponse = await fetch("/api/import/preview", {
  method: "POST",
  body: formData,
});

const { preview, suggestions, sessionId, filePath } = await previewResponse.json();

// 2. Validar
const validationResponse = await fetch("/api/import/validate", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    filePath,
    preview,
    mappings: suggestions, // o ajustados por el usuario
    maxRowsToValidate: 100,
  }),
});

const { validation, summary } = await validationResponse.json();

// 3. Si summary.canProceed === true → importar
```

## Extensibilidad

### Añadir Nuevos Campos

1. Agregar a `REQUIRED_FIELDS` o `OPTIONAL_FIELDS` en `FieldDefinition.ts`
2. Actualizar keywords en `ColumnMapping.calculateKeywordBonus()` si aplica
3. Añadir validación específica en `PreValidateDataUseCase` si es necesario

### Añadir Nuevas Validaciones

1. Crear método privado en `PreValidateDataUseCase`
2. Llamar desde `execute()` en el loop de validación
3. Retornar array de `ValidationIssue[]`

## Testing

### Unit Tests (pendiente)

- ColumnMapping.autoSuggest()
- ColumnMappingService
- ValidationResult

### Integration Tests (pendiente)

- API routes
- Use cases con DB

### E2E Tests (pendiente)

- Flujo completo desde upload hasta importación

## Mejoras Futuras

1. **Editor de Mapeo Completo**
   - Componente visual drag & drop
   - Vista previa de datos por columna
   - Sugerencias en tiempo real

2. **Validación Mejorada**
   - Validar formato de emails
   - Validar URLs de fotos
   - Geocodificación inversa para coordenadas

3. **Persistencia de Sesiones**
   - Guardar sesiones en BD
   - Recuperar sesiones interrumpidas

4. **Templates de Mapeo**
   - Guardar configuraciones de mapeo
   - Reutilizar para CSVs similares

5. **Transformaciones**
   - Permitir transformaciones de datos
   - Formateo automático (fechas, teléfonos, etc.)

## Problemas Resueltos

### Problema Original

Error de foreign key constraint en `district_id` porque:

- El mapeo de distrito fallaba
- Se intentaba insertar `null` o ID inexistente
- No había validación previa

### Solución Implementada

- Sistema de mapeo flexible permite cualquier estructura de CSV
- Validación previa detecta distritos inválidos ANTES de importar
- Usuario puede corregir errores antes de procesar el batch
- Sugerencias automáticas reducen errores de mapeo

## Referencias

- Arquitectura DDD: https://martinfowler.com/tags/domain%20driven%20design.html
- Hexagonal Architecture: https://alistair.cockburn.us/hexagonal-architecture/
- Clean Architecture: https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html
