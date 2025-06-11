# Configuración de Google Street View

Este documento explica cómo configurar Google Street View en el sistema de validación de coordenadas DEA.

## Configuración de la API Key

### 1. Obtener una API Key de Google Maps

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un nuevo proyecto o selecciona uno existente
3. Habilita las siguientes APIs:
   - **Street View Static API**
   - **Maps JavaScript API** (opcional, para futuras mejoras)

4. Ve a "Credenciales" y crea una nueva API Key
5. Configura las restricciones de la API Key:
   - **Restricciones de aplicación**: HTTP referrers
   - **Restricciones de API**: Street View Static API

### 2. Configurar Variables de Entorno

Añade tu API Key al archivo `.env`:

```env
# Google Maps API Key para uso del servidor
GOOGLE_MAPS_API_KEY="tu_api_key_aqui"

# Google Maps API Key para uso del cliente (Next.js)
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="tu_api_key_aqui"
```

**Nota**: Ambas variables deben tener el mismo valor. La versión `NEXT_PUBLIC_` es necesaria para que el componente del cliente pueda acceder a la API key.

### 3. Configurar Restricciones de Seguridad

Para producción, configura las siguientes restricciones en Google Cloud Console:

#### Restricciones de HTTP Referrers:
```
https://tu-dominio.com/*
https://www.tu-dominio.com/*
```

#### Restricciones de IP (para desarrollo local):
```
127.0.0.1
localhost
```

## Funcionalidades Implementadas

### Componente StreetViewImage

El componente `StreetViewImage` proporciona:

- **Imágenes estáticas** de Google Street View
- **Manejo de errores** cuando no hay Street View disponible
- **Estados de carga** con indicadores visuales
- **Colores personalizados** que coinciden con los marcadores del mapa
- **Información de coordenadas** mostrada en cada imagen

### Integración en Validación

Las vistas de Street View se muestran en el **Paso 4** de la validación:

- **Vista lado a lado** de coordenadas del usuario vs oficiales
- **Colores consistentes** con los marcadores del mapa:
  - 🟡 **Amarillo (#eab308)**: Coordenadas del usuario
  - 🔵 **Azul (#003DF6)**: Coordenadas oficiales
- **Fallback elegante** cuando Street View no está disponible

## Parámetros de Street View

El componente utiliza los siguientes parámetros por defecto:

```typescript
{
  size: '400x300',        // Tamaño de la imagen
  heading: 0,             // Dirección de la cámara (0-360°)
  pitch: 0,               // Ángulo vertical (-90 a 90°)
  fov: 90                 // Campo de visión (10-120°)
}
```

## Costos y Límites

### Precios de Google Street View Static API (2024):
- **Primeras 100,000 solicitudes/mes**: Gratis
- **Solicitudes adicionales**: $7.00 USD por 1,000 solicitudes

### Límites de Uso:
- **Límite de solicitudes**: 25,000 por día por defecto
- **Límite de QPS**: 50 consultas por segundo

## Solución de Problemas

### Error: "API key no configurada"
- Verifica que `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` esté en el archivo `.env`
- Reinicia el servidor de desarrollo después de añadir la variable

### Error: "Street View no disponible"
- Es normal para algunas ubicaciones
- Google Street View no tiene cobertura universal
- El componente muestra un mensaje informativo en estos casos

### Error: "API key inválida"
- Verifica que la API key sea correcta
- Asegúrate de que Street View Static API esté habilitada
- Revisa las restricciones de dominio/IP

### Error de CORS
- Configura correctamente los HTTP referrers en Google Cloud Console
- Para desarrollo local, añade `localhost` y `127.0.0.1`

## Mejoras Futuras

### Posibles Extensiones:
1. **Street View interactivo** con Google Maps JavaScript API
2. **Múltiples ángulos** de vista para cada ubicación
3. **Detección automática** de la mejor dirección de cámara
4. **Zoom adaptativo** basado en el tipo de ubicación
5. **Integración con Street View panoramas** para vista 360°

## Seguridad

### Mejores Prácticas:
- **Nunca** expongas la API key en el código fuente público
- Usa **restricciones de dominio** en producción
- **Monitorea el uso** regularmente en Google Cloud Console
- **Rota las API keys** periódicamente
- Considera usar **API keys separadas** para desarrollo y producción

## Soporte

Para problemas relacionados con Google Street View:
- [Documentación oficial de Street View Static API](https://developers.google.com/maps/documentation/streetview/overview)
- [Google Maps Platform Support](https://developers.google.com/maps/support)
- [Precios y límites actualizados](https://developers.google.com/maps/billing-and-pricing/pricing)
