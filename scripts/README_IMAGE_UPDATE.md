# Scripts de Actualización de Imágenes DEA

Este directorio contiene scripts para actualizar las URLs de las imágenes (`foto1` y `foto2`) en los registros DEA utilizando la API de Picsum Photos.

## Archivos

- `update-dea-images.ts` - Script principal en TypeScript
- `update-images.js` - Script en JavaScript (más fácil de ejecutar)
- `test-image-generation.js` - Script de prueba para verificar funcionamiento

## Características

### 🖼️ Tipos de Imágenes
- **Imágenes con seed**: Consistentes pero aleatorias usando `https://picsum.photos/seed/{seed}/{width}/{height}`
- **Imágenes específicas**: Usando IDs específicos con `https://picsum.photos/id/{id}/{width}/{height}`
- **Mezcla aleatoria**: Cada DEA recibe una combinación aleatoria de ambos tipos

### 📐 Tamaños de Imagen (Formato Móvil)
Todas las imágenes simulan fotos de teléfono móvil con al menos 2000px en una dimensión.
**NO incluye formatos cuadrados** - solo horizontales y verticales:

**Formatos Verticales (Portrait - típicos de móvil):**
- 1500x2000 (Portrait estándar)
- 1600x2400 (Portrait alto)
- 1200x2000 (Portrait estrecho)
- 1440x2560 (Portrait móvil moderno)
- 1080x2340 (Portrait móvil 19.5:9)
- 1125x2436 (Portrait iPhone X/11/12)

**Formatos Horizontales (Landscape - móvil girado):**
- 2000x1500 (Landscape estándar)
- 2400x1600 (Landscape ancho)
- 2000x1200 (Landscape ultra ancho)
- 2560x1440 (Landscape widescreen)
- 2340x1080 (Landscape móvil 19.5:9)
- 2436x1125 (Landscape iPhone X/11/12)

### 🎯 IDs de Imágenes Específicas
El script incluye más de 200 IDs específicos de Picsum Photos para garantizar variedad en los tipos de imágenes.

## Uso

### Paso 0: Ejecutar Pruebas (Recomendado)

Antes de actualizar todas las imágenes, ejecuta el script de prueba:

```bash
# Ejecutar pruebas de funcionamiento
node scripts/test-image-generation.js
```

Este script verificará:
- ✅ Generación correcta de URLs
- ✅ Conexión a la base de datos
- ✅ Tamaños de imagen (≥ 2000px)
- ✅ Muestra de registros actuales
- ✅ Simulación de actualización

### Opción 1: Script JavaScript (Recomendado)

```bash
# Actualizar todas las imágenes DEA
node scripts/update-images.js

# Actualizar solo DEAs específicos por ID
node scripts/update-images.js --specific 1 2 3 4 5
```

### Opción 2: Script TypeScript

```bash
# Opción A: Usar tsx (recomendado para TypeScript)
npx tsx scripts/update-dea-images.ts

# Opción B: Usar ts-node con configuración ESM
npx ts-node --esm scripts/update-dea-images.ts

# Actualizar DEAs específicos
npx tsx scripts/update-dea-images.ts --specific 1 2 3 4 5
```

**Nota**: Si tienes problemas con TypeScript, usa el script JavaScript que funciona sin configuración adicional.

### Opción 3: Usando npm scripts

Puedes agregar estos comandos a tu `package.json`:

```json
{
  "scripts": {
    "update-images": "node scripts/update-images.js",
    "update-images-specific": "node scripts/update-images.js --specific"
  }
}
```

Luego ejecutar:
```bash
npm run update-images
npm run update-images-specific 1 2 3
```

## Funcionamiento

### 🔄 Proceso de Actualización

1. **Conexión a la base de datos** usando Prisma Client
2. **Obtención de registros DEA** con sus IDs y números provisionales
3. **Procesamiento en lotes** de 10 registros para optimizar rendimiento
4. **Generación de seeds únicos** para cada imagen basados en:
   - ID del DEA
   - Tipo de foto (foto1/foto2)
   - Timestamp actual
5. **Selección aleatoria** de:
   - Tamaño de imagen
   - Tipo de imagen (seed vs específica)
   - ID específico (si aplica)
6. **Actualización de la base de datos** con las nuevas URLs
7. **Reporte de progreso** en tiempo real

### 🛡️ Características de Seguridad

- **Procesamiento en lotes**: Evita sobrecargar la base de datos
- **Pausas entre lotes**: 100ms de pausa para reducir carga
- **Manejo de errores**: Captura y reporta errores detalladamente
- **Desconexión automática**: Cierra la conexión a la base de datos al finalizar

### 📊 Salida del Script

El script proporciona información detallada durante la ejecución:

```
🚀 Iniciando actualización de imágenes DEA...
📊 Encontrados 150 registros DEA para actualizar
✅ DEA 1001 (ID: 1) actualizado:
   📸 Foto1: https://picsum.photos/seed/dea-1-foto1-1702834567890/2000/1500
   📸 Foto2: https://picsum.photos/id/237/1500/2000
📈 Progreso: 10/150 registros actualizados
...
🎉 ¡Actualización completada exitosamente!
📊 Total de registros actualizados: 150

📋 Muestra de registros actualizados:
DEA 1001:
  Foto1: https://picsum.photos/seed/dea-1-foto1-1702834567890/2000/1500
  Foto2: https://picsum.photos/id/237/1500/2000
```

## Requisitos

- Node.js
- Prisma Client configurado
- Base de datos PostgreSQL con el esquema DEA
- Variable de entorno `DATABASE_URL` configurada

## Notas Importantes

### 🔒 Backup Recomendado
Antes de ejecutar el script en producción, se recomienda hacer un backup de la base de datos:

```sql
-- Backup de las URLs actuales
CREATE TABLE dea_images_backup AS 
SELECT id, numeroProvisionalDea, foto1, foto2, updatedAt 
FROM dea_records;
```

### 🌐 URLs Generadas
Las URLs generadas siguen estos patrones:

- **Con seed**: `https://picsum.photos/seed/dea-{id}-{tipo}-{timestamp}/{width}/{height}`
- **Específicas**: `https://picsum.photos/id/{imageId}/{width}/{height}`

### 🔄 Regeneración
Para regenerar las imágenes de un DEA específico, simplemente ejecuta el script con el parámetro `--specific` y el ID correspondiente.

## Troubleshooting

### Error de conexión a la base de datos
```bash
# Verificar que la variable DATABASE_URL esté configurada
echo $DATABASE_URL

# Verificar conexión con Prisma
npx prisma db pull
```

### Error con TypeScript (.ts files)
Si obtienes el error `Unknown file extension ".ts"`, usa una de estas soluciones:

```bash
# Solución 1: Usar el script JavaScript (recomendado)
node scripts/update-images.js

# Solución 2: Instalar tsx
npm install -g tsx
npx tsx scripts/update-dea-images.ts

# Solución 3: Usar ts-node con ESM
npx ts-node --esm scripts/update-dea-images.ts
```

### Error de ESLint con require()
El archivo JavaScript puede mostrar warnings de ESLint. Esto es normal para scripts de utilidad y no afecta la funcionalidad.

### Memoria insuficiente
Si tienes muchos registros DEA (>10,000), considera ajustar el `batchSize` en el script a un valor menor (ej: 5).

## Ejemplos de URLs Generadas

```
https://picsum.photos/seed/dea-1-foto1-1702834567890/1500/2000
https://picsum.photos/id/237/2340/1080
https://picsum.photos/seed/dea-2-foto2-1702834567891/1125/2436
https://picsum.photos/id/42/2560/1440
```

Cada URL garantiza:
- ✅ Al menos 2000px en una dimensión
- ✅ Formato de teléfono móvil (horizontal o vertical)
- ✅ NO imágenes cuadradas
- ✅ Imágenes diferentes para cada DEA
- ✅ Consistencia en regeneraciones (mismo seed = misma imagen)
- ✅ Variedad en tipos y orientaciones móviles
