# Proxy de Imágenes de SharePoint

## Descripción

Este sistema implementa un proxy transparente para imágenes almacenadas en SharePoint que no tienen CORS habilitado. El proxy permite que las funcionalidades de crop y procesamiento de imágenes funcionen correctamente con URLs de SharePoint.

## Problema Resuelto

Las imágenes almacenadas en SharePoint/OneDrive no permiten acceso CORS desde dominios externos, lo que causa errores al intentar:
- Cargar imágenes con `crossOrigin = 'anonymous'`
- Procesar imágenes en canvas
- Realizar operaciones de crop

## Arquitectura

### 1. API Proxy (`/api/image-proxy`)
- **Ubicación**: `src/app/api/image-proxy/route.ts`
- **Función**: Actúa como intermediario entre el cliente y SharePoint
- **Características**:
  - Validación de URLs de SharePoint
  - Headers apropiados para evitar bloqueos
  - Manejo de errores y timeouts
  - Headers CORS correctos en la respuesta
  - Sistema de caché (1 hora local, 24 horas CDN)

### 2. Utilidades de Proxy (`sharePointProxy.ts`)
- **Ubicación**: `src/utils/sharePointProxy.ts`
- **Funciones**:
  - `isSharePointUrl()`: Detecta URLs de SharePoint
  - `getProxiedImageUrl()`: Convierte URL original a URL del proxy
  - `loadImageWithProxy()`: Carga imágenes con manejo automático de proxy

### 3. Integración Automática
- **imageUtils.ts**: Función `loadImage()` actualizada para usar proxy automáticamente
- **ImageCropper.tsx**: Usa el nuevo sistema de carga
- **ImageProcessingService.ts**: Métodos actualizados para SharePoint

## Uso

### Automático
El sistema detecta automáticamente URLs de SharePoint y las redirige a través del proxy:

```typescript
// Esto funciona automáticamente para URLs de SharePoint
const img = await loadImage('https://madrid-my.sharepoint.com/...');
```

### Manual
También puedes usar las funciones directamente:

```typescript
import { isSharePointUrl, getProxiedImageUrl } from '@/utils/sharePointProxy';

if (isSharePointUrl(imageUrl)) {
  const proxiedUrl = getProxiedImageUrl(imageUrl);
  // Usar proxiedUrl
}
```

## URLs Soportadas

El proxy detecta y maneja automáticamente URLs que contengan:
- `sharepoint.com`
- `sharepoint-df.com`
- `sharepointonline.com`

## Ejemplo de URL

**Original:**
```
https://madrid-my.sharepoint.com/personal/hernandeztal_madrid_es/Documents/Aplicaciones/Microsoft%20Forms/REVISI%C3%93N%20DEA%20MADRID/Pregunta/066DC560-B08F-46C7-BDD6-84715AD8EF92_Lucia%20sancho%20iba%C3%B1ez.jpeg
```

**A través del proxy:**
```
/api/image-proxy?url=https%3A//madrid-my.sharepoint.com/personal/hernandeztal_madrid_es/Documents/Aplicaciones/Microsoft%2520Forms/REVISI%25C3%2593N%2520DEA%2520MADRID/Pregunta/066DC560-B08F-46C7-BDD6-84715AD8EF92_Lucia%2520sancho%2520iba%25C3%25B1ez.jpeg
```

## Características de Seguridad

1. **Validación de URLs**: Solo permite URLs de SharePoint verificadas
2. **Timeout**: Límite de 30 segundos para evitar bloqueos
3. **Validación de contenido**: Verifica que la respuesta sea una imagen válida
4. **Headers de seguridad**: User-Agent y headers apropiados

## Rendimiento

- **Caché local**: 1 hora (`max-age=3600`)
- **Caché CDN**: 24 horas (`s-maxage=86400`)
- **Compresión**: Soporte para `Accept-Encoding`

## Manejo de Errores

El proxy maneja varios tipos de errores:
- URLs inválidas o no permitidas
- Timeouts de conexión
- Contenido no válido (no es imagen)
- Errores de red de SharePoint

## Compatibilidad

- ✅ Crop de imágenes
- ✅ Procesamiento en canvas
- ✅ Redimensionado
- ✅ Compresión
- ✅ Generación de miniaturas
- ✅ Dispositivos móviles
- ✅ Navegadores modernos

## Monitoreo

Los errores se registran en la consola del servidor para facilitar el debugging:
```
Error fetching image: 404 Not Found
Error in image proxy: TimeoutError
```

## Limitaciones

1. Solo funciona con URLs de SharePoint
2. Requiere que el servidor tenga acceso a SharePoint
3. Añade latencia adicional (proxy + red)
4. Dependiente de la disponibilidad de SharePoint
