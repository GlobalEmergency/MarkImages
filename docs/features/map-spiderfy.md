# Spiderfy para Marcadores Superpuestos en el Mapa

## Problema Resuelto

Cuando múltiples DEAs están ubicados en la misma posición o muy cercanos (por ejemplo, varios DEAs en un mismo hospital o edificio grande), los marcadores del mapa se superponían completamente, haciendo imposible:

- Ver todos los marcadores disponibles
- Clickear en los marcadores que estaban debajo
- Acceder a la información de cada DEA

## Solución Implementada

Se implementó **Spiderfy** utilizando la librería `@changey/react-leaflet-markercluster`, que proporciona:

### 1. **Detección Automática de Superposición**

- El sistema detecta automáticamente cuando hay múltiples marcadores en la misma ubicación o muy cercanos
- Se activa solo cuando es necesario, sin afectar la performance del mapa

### 2. **Efecto "Abanico" (Spiderfy)**

Cuando se hace click en un grupo de marcadores superpuestos:

- Los marcadores se "abren en abanico" automáticamente
- Se crean líneas conectoras desde el punto central hacia cada marcador
- Cada marcador queda visible y accesible
- Se puede hacer click en cada uno individualmente

### 3. **Arquitectura Híbrida**

La solución combina lo mejor de dos mundos:

#### **Server-Side Clustering (ya existente)**

- PostGIS maneja el clustering de grandes cantidades de DEAs
- Optimiza el rendimiento para datasets grandes
- Reduce la cantidad de datos transferidos

#### **Client-Side Spiderfy (nuevo)**

- Leaflet.markercluster maneja solo las superposiciones locales
- Se activa solo para marcadores individuales muy cercanos
- No interfiere con el clustering del servidor

## Archivos Modificados

### 1. **src/components/MapView.tsx**

- Añadido `MarkerClusterGroup` envolviendo los marcadores individuales
- Configuración de spiderfy optimizada:
  - `spiderfyOnMaxZoom: true` - Activa spiderfy en zoom máximo
  - `disableClusteringAtZoom: 18` - Desactiva clustering del cliente en zoom 18
  - `maxClusterRadius: 40` - Radio pequeño para detectar solo superposiciones reales
  - `spiderfyDistanceMultiplier: 1.5` - Distancia óptima entre marcadores

### 2. **src/types/react-leaflet-markercluster.d.ts** (nuevo)

- Declaraciones de tipos TypeScript para la librería
- Define interfaces para todas las props disponibles

### 3. **src/app/globals.css**

- Estilos personalizados para el efecto spiderfy
- Estilos de las líneas conectoras
- Animaciones y transiciones suaves
- Efectos hover mejorados

### 4. **package.json**

Dependencias añadidas:

```json
{
  "@changey/react-leaflet-markercluster": "^4.0.0",
  "leaflet.markercluster": "^1.5.3"
}
```

## Configuración Técnica

### MarkerClusterGroup Props

```typescript
<MarkerClusterGroup
  showCoverageOnHover={false}           // No mostrar área de cobertura
  spiderfyOnMaxZoom={true}              // Activar spiderfy en zoom máximo
  disableClusteringAtZoom={16}          // Desactivar clustering cliente en zoom ≥16
  maxClusterRadius={15}                 // Solo marcadores LITERALMENTE superpuestos (15px)
  spiderfyDistanceMultiplier={1.5}      // Distancia entre marcadores en abanico
  zoomToBoundsOnClick={false}           // No cambiar zoom al hacer click
  iconCreateFunction={(cluster) => {}}  // Icono personalizado para clusters
>
  {/* Marcadores individuales */}
</MarkerClusterGroup>
```

### Por qué estos valores (Ultra Restrictivos)

- **maxClusterRadius: 15** - Solo agrupa marcadores a menos de 15px (LITERALMENTE encima uno del otro)
- **disableClusteringAtZoom: 16** - Desactiva clustering en zoom ≥16, solo spiderfy puro
- **zoomToBoundsOnClick: false** - No interfiere con la navegación del usuario
- **spiderfyDistanceMultiplier: 1.5** - Distancia óptima para que los marcadores no se superpongan tras abrirse

**IMPORTANTE**: Esta configuración está diseñada para NO interferir con el clustering del servidor (PostGIS) y solo activarse cuando hay marcadores en la misma ubicación exacta.

## Beneficios

### ✅ UX Mejorada

- Los usuarios pueden ver y acceder a todos los DEAs, incluso los superpuestos
- Interacción intuitiva: click para abrir, click fuera para cerrar
- Feedback visual claro con líneas conectoras

### ✅ Performance Optimizada

- El clustering del servidor maneja grandes cantidades (miles de DEAs)
- El spiderfy del cliente solo se activa localmente cuando es necesario
- Sin impacto en tiempos de carga

### ✅ Escalabilidad

- Funciona igual de bien con 10 o 10,000 DEAs
- Se adapta automáticamente al nivel de zoom
- Combina clustering backend + spiderfy frontend de forma transparente

### ✅ Compatibilidad

- Funciona con el sistema de clustering existente de PostGIS
- No rompe funcionalidad existente
- Compatible con todos los navegadores modernos

## Comportamiento del Usuario

### Escenario 1: Marcadores Muy Cercanos

1. El usuario hace zoom en una zona con múltiples DEAs cercanos
2. Los marcadores aparecen agrupados en un cluster verde pequeño
3. Al hacer click, los marcadores se abren en abanico
4. El usuario puede clickear en cada marcador individual para ver detalles

### Escenario 2: Marcadores en la Misma Ubicación Exacta

1. Varios DEAs en el mismo edificio (ej: Hospital con 3 DEAs)
2. Aparece un solo marcador con número indicando cantidad
3. Al hacer click, los marcadores se separan en forma de abanico
4. Cada DEA es accesible individualmente

### Escenario 3: Zoom Alejado

1. El sistema usa clustering del servidor (PostGIS)
2. Muestra clusters grandes con cientos de DEAs
3. Al hacer zoom, los clusters se dividen progresivamente
4. Finalmente, cuando está cerca, spiderfy maneja las superposiciones

## Estilos CSS Personalizados

### Líneas Conectoras Spiderfy

```css
.leaflet-cluster-spider-leg {
  stroke: #3b82f6; /* Azul del tema */
  stroke-width: 2px;
  stroke-opacity: 0.6;
}
```

### Animaciones

```css
.marker-cluster {
  transition: all 0.3s ease-in-out;
}

.leaflet-marker-icon:hover {
  transform: scale(1.1);
  transition: transform 0.2s ease-in-out;
}
```

## Testing

### Casos de Prueba

1. ✅ Múltiples DEAs en el mismo hospital
2. ✅ DEAs en edificios contiguos
3. ✅ DEAs en la misma calle con números diferentes
4. ✅ Zoom desde vista general hasta ubicación específica
5. ✅ Performance con 3000+ DEAs en vista

### Navegadores Probados

- Chrome/Edge (Chromium)
- Firefox
- Safari (iOS y macOS)
- Mobile browsers

## Mantenimiento

### Ajustar Radio de Clustering

Si necesitas cambiar cuándo se activa el spiderfy:

```typescript
maxClusterRadius={20}  // Más sensible: agrupa marcadores algo más lejanos
maxClusterRadius={10}  // Ultra restrictivo: solo marcadores exactamente encima
```

⚠️ **No usar valores > 20px** para evitar conflictos con el clustering del servidor.

### Cambiar Distancia del Abanico

```typescript
spiderfyDistanceMultiplier={2}    // Más separación
spiderfyDistanceMultiplier={1}    // Menos separación
```

### Desactivar en Cierto Zoom

```typescript
disableClusteringAtZoom={15}  // Desactivar antes (más restrictivo)
disableClusteringAtZoom={17}  // Desactivar después (menos restrictivo)
```

⚠️ **Recomendado: 16** - Balance perfecto entre funcionalidad y no interferencia con clustering del servidor.

## Referencias

- [Leaflet.markercluster](https://github.com/Leaflet/Leaflet.markercluster)
- [React Leaflet MarkerCluster](https://github.com/changey/react-leaflet-markercluster)
- [Leaflet Documentation](https://leafletjs.com/)

## Changelog

### v1.0.0 - 2025-12-03

- ✅ Implementación inicial de Spiderfy
- ✅ Configuración híbrida (servidor + cliente)
- ✅ Estilos personalizados
- ✅ Documentación completa
- ✅ Testing en navegadores principales
