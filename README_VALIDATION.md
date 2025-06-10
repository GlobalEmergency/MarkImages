# Sistema de Validación y Normalización DEA Madrid

## Resumen del Sistema Implementado

Se ha implementado un sistema completo de validación y normalización de datos para los registros de desfibriladores (DEA) de Madrid, que incluye:

### 🎯 Funcionalidades Principales

1. **Validación Geográfica con Datos Oficiales**
   - Integración con datos del callejero oficial del Ayuntamiento de Madrid
   - Validación de códigos postales y distritos
   - Verificación de coordenadas con tolerancia de 20 metros
   - Sugerencias automáticas de correcciones

2. **Normalización de Campos de Texto**
   - Limpieza automática de espacios y caracteres
   - Capitalización correcta según reglas españolas
   - Normalización de titularidad y denominaciones
   - Corrección de nombres de vías

3. **Generación de Códigos DEA Únicos**
   - Formato: `RM + distrito(2) + CP(2) + D + secuencial(4)`
   - Ejemplo: `RM1044D0456`
   - Garantía de unicidad por distrito
   - Asignación automática de secuenciales

## 📊 Datos Cargados

- **213,431 direcciones oficiales** del Ayuntamiento de Madrid
- **9,393 viales** con denominaciones normalizadas
- **11,092 registros** de viales por distrito
- Cobertura completa de los 21 distritos de Madrid

## 🏗️ Arquitectura del Sistema

### Base de Datos
```sql
-- Nuevas tablas añadidas al schema de Prisma
- madrid_addresses: Direcciones oficiales con coordenadas
- madrid_streets: Viales oficiales normalizados
- madrid_street_districts: Viales por distrito
- dea_codes: Códigos DEA únicos generados
```

### Servicios Implementados

#### 1. MadridGeocodingService
- Búsqueda de direcciones en datos oficiales
- Validación geográfica con cálculo de distancias
- Sugerencias de correcciones automáticas

#### 2. TextNormalizationService
- Normalización de texto con reglas específicas
- Capitalización correcta para español
- Limpieza de espacios y caracteres especiales

#### 3. DeaCodeService
- Generación de códigos únicos por distrito
- Validación de formato de códigos
- Gestión de secuenciales por distrito

#### 4. DeaValidationService
- Orquestación de todas las validaciones
- Aplicación automática de correcciones
- Procesamiento en lotes

### APIs Implementadas

#### Validación Individual
```
GET  /api/dea/[id]/validate     - Validar un registro
POST /api/dea/[id]/validate     - Aplicar correcciones
```

#### Validación en Lote
```
GET  /api/dea/validate-batch    - Estadísticas de validación
POST /api/dea/validate-batch    - Validar múltiples registros
```

#### Búsqueda de Direcciones
```
GET  /api/madrid/search-address - Buscar por nombre de vía
POST /api/madrid/search-address - Buscar por coordenadas
```

## 🖥️ Interfaz de Usuario

### Página de Validación (`/validate`)
- Lista de registros DEA con filtros
- Panel de validación interactivo
- Estadísticas en tiempo real
- Aplicación selectiva de correcciones

### Componentes React
- `DeaValidationPanel`: Panel principal de validación
- Integración con la navegación existente
- Diseño responsive con Tailwind CSS

## 🚀 Cómo Usar el Sistema

### 1. Cargar Datos de Madrid (Una sola vez)
```bash
npm run load-madrid-data
```

### 2. Acceder a la Validación
- Navegar a `/validate` en la aplicación
- Seleccionar un registro DEA de la lista
- Revisar las validaciones automáticas
- Aplicar correcciones según sea necesario

### 3. Validación Programática
```typescript
// Validar un registro específico
const validation = await deaValidationService.validateDeaRecord(deaId);

// Aplicar correcciones automáticamente
await deaValidationService.applyValidationCorrections(deaId, {
  applyGeographic: true,
  applyTextNormalization: true,
  applyDeaCode: true
});

// Validación en lote
const batchResult = await deaValidationService.validateBatch(
  [1, 2, 3, 4, 5],
  { autoApplyCorrections: true }
);
```

## 📋 Proceso de Validación

### 1. Validación Geográfica
- ✅ Verificar código postal contra datos oficiales
- ✅ Validar distrito correspondiente
- ✅ Calcular distancia entre coordenadas (máx. 20m)
- ✅ Sugerir datos oficiales si no coinciden

### 2. Normalización de Texto
- ✅ Limpiar espacios extra y caracteres
- ✅ Aplicar capitalización correcta
- ✅ Normalizar titularidad y denominación
- ✅ Corregir nombres de vías

### 3. Generación de Código DEA
- ✅ Generar código único por distrito
- ✅ Formato estándar: RM + distrito + CP + secuencial
- ✅ Verificar unicidad antes de asignar
- ✅ Actualizar registro con código generado

## 🔧 Configuración y Mantenimiento

### Variables de Entorno
```env
DATABASE_URL="postgresql://..."  # Base de datos PostgreSQL
```

### Comandos Disponibles
```bash
npm run dev                 # Desarrollo
npm run build              # Construcción
npm run db:push            # Actualizar esquema BD
npm run load-madrid-data   # Cargar datos oficiales
```

### Actualización de Datos
Los datos del Ayuntamiento se pueden actualizar reemplazando los archivos CSV en `data/CSV/` y ejecutando nuevamente el comando de carga.

## 📈 Métricas y Estadísticas

El sistema proporciona métricas en tiempo real:
- Total de registros
- Registros completamente validados
- Registros sin código DEA
- Registros con problemas geográficos
- Porcentaje de completitud

## 🛠️ Tecnologías Utilizadas

- **Backend**: Next.js 15, TypeScript, Prisma ORM
- **Base de Datos**: PostgreSQL
- **Frontend**: React, Tailwind CSS, Lucide Icons
- **Validación**: Servicios personalizados con datos oficiales
- **Geocodificación**: Datos del Ayuntamiento de Madrid

## 🔍 Casos de Uso Principales

### Para Administradores
1. Validar registros existentes masivamente
2. Generar códigos DEA únicos automáticamente
3. Corregir datos geográficos inconsistentes
4. Normalizar campos de texto

### Para Operadores
1. Revisar registros individuales
2. Aplicar correcciones sugeridas
3. Validar manualmente casos especiales
4. Monitorear estadísticas de calidad

## 📝 Próximos Pasos Sugeridos

1. **Automatización**: Configurar validación automática en la carga de nuevos registros
2. **Reportes**: Generar informes de calidad de datos
3. **Alertas**: Notificaciones para registros que requieren revisión manual
4. **Integración**: Conectar con sistemas externos del Ayuntamiento
5. **Auditoría**: Registro de cambios y trazabilidad

## 🎉 Resultado Final

El sistema está completamente funcional y listo para usar. Proporciona:

- ✅ Validación automática contra datos oficiales
- ✅ Normalización inteligente de texto
- ✅ Generación de códigos únicos
- ✅ Interfaz intuitiva para operadores
- ✅ APIs para integración programática
- ✅ Estadísticas y métricas en tiempo real

**¡El sistema está listo para mejorar significativamente la calidad y consistencia de los datos DEA de Madrid!**
