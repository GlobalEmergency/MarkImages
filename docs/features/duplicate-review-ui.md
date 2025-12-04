# UI de Revisión de Duplicados

## Descripción

Interfaz completa para revisar manualmente los DEAs marcados como "posibles duplicados" durante la importación. Permite comparar lado a lado el DEA importado con el candidato similar existente y tomar una decisión informada.

---

## 🎯 Acceso a la Funcionalidad

### Opción 1: Desde Verificación Principal

1. Ir a `/verify`
2. Clic en el botón amarillo "⚠️ Ver Posibles Duplicados" (esquina superior derecha)

### Opción 2: URL Directa

- Listado: `/verify/duplicates`
- Comparación: `/verify/duplicates/[id]`

---

## 📋 Página de Listado (`/verify/duplicates`)

### Características

#### Stats Dashboard

- **Total Posibles Duplicados**: Cantidad total de DEAs marcados
- **Mostrando**: Cantidad actual en pantalla
- **Página**: Navegación entre páginas

#### Lista de DEAs

Cada card muestra:

- **Imagen** (primera foto del DEA)
- **Nombre y código**
- **Tipo de establecimiento**
- **Dirección completa**
- **Score de similitud** (badge con color según gravedad)
  - Rojo (80-100): Alta probabilidad
  - Naranja (70-79): Media probabilidad
  - Amarillo (60-69): Baja probabilidad
- **DEA similar** (nombre y dirección del candidato)
- **Botón**: "Revisar Comparación"

#### Filtros (Opcionales)

- Por distrito
- Por score mínimo
- Por tipo de establecimiento

#### Paginación

- 20 registros por página
- Navegación anterior/siguiente

---

## 🔍 Página de Comparación (`/verify/duplicates/[id]`)

### Layout de Comparación

#### Header

- Score de similitud grande (con color según gravedad)
- Breadcrumb: "← Volver al Listado"

#### Alertas

- **Warning amarillo**: Si score ≥ 70 advierte de alta probabilidad
- **Info azul**: Muestra distancia física entre ambos DEAs (si tienen coordenadas)

#### Grid de Comparación (2 columnas)

**Columna Izquierda: DEA Importado (Nuevo)**

- Fondo amarillo para destacar
- Etiqueta: "DEA Importado (Nuevo)"

**Columna Derecha: DEA Existente**

- Fondo verde
- Etiqueta: "DEA Existente"

Cada columna muestra:

1. **Imágenes** (hasta 4 en grid 2x2)
2. **Datos del DEA**:
   - Nombre
   - Código / Número provisional
   - Tipo de establecimiento
   - Dirección completa
   - Código postal
   - Distrito
   - Planta (si existe)
   - Ubicación específica (si existe)
   - Descripción de acceso
   - Responsable (nombre y teléfono)
   - Coordenadas GPS

#### Botones de Acción

**🟢 NO es Duplicado**

- Color: Verde
- Acción: Quita la marca `requires_attention`
- Requiere: Nota opcional explicando por qué
- Resultado: DEA disponible para verificación normal

**🔴 SÍ es Duplicado**

- Color: Rojo
- Acción: Marca DEA como `REJECTED`
- Requiere: Nota obligatoria explicando por qué
- Resultado: DEA rechazado permanentemente

---

## 💾 Registro de Decisiones

Todas las decisiones se registran en `internal_notes` con formato:

```
[2025-12-04T14:30:00.000Z] Revisión de duplicado por user@example.com: No es duplicado. Diferentes plantas del mismo edificio.
```

---

## 🔄 Flujo de Trabajo Recomendado

### 1. Revisar Listado

- Ordenar por score (más altos primero)
- Identificar casos obvios

### 2. Comparar Detalles

Para cada DEA sospechoso:

- Comparar imágenes
- Verificar coordenadas y distancia
- Revisar ubicación específica
- Comparar descripciones de acceso

### 3. Tomar Decisión

**Criterios para "NO es duplicado":**

- Diferentes plantas/niveles
- Ubicaciones específicas distintas (botiquín vs pista)
- Edificios diferentes en mismo complejo
- Distancia > 50m

**Criterios para "SÍ es duplicado":**

- Misma ubicación exacta
- Imágenes idénticas o muy similares
- Datos prácticamente iguales
- Distancia < 10m

### 4. Documentar

Siempre explicar la razón de la decisión

---

## 📊 API Endpoints

### `GET /api/verify/duplicates`

Lista todos los posibles duplicados

**Query params:**

- `page`: Número de página (default: 1)
- `limit`: Registros por página (default: 20)
- `district`: Filtrar por distrito
- `establishment_type`: Filtrar por tipo
- `min_score`: Score mínimo
- `max_score`: Score máximo

**Response:**

```json
{
  "data": [
    {
      "id": "uuid",
      "name": "DEA Name",
      "attention_reason": "Posible duplicado...",
      "location": {...},
      "images": [...]
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalRecords": 15,
    "totalPages": 1,
    "hasNextPage": false
  }
}
```

### `GET /api/verify/duplicates/[id]`

Obtiene detalles de un posible duplicado y su candidato

**Response:**

```json
{
  "aed": {...},           // DEA importado
  "candidateAed": {...},  // DEA existente similar
  "comparison": {
    "similarityScore": 74,
    "extractedCandidateName": "Name",
    "extractedCandidateAddress": "Address"
  }
}
```

### `PUT /api/verify/duplicates/[id]`

Actualiza estado del posible duplicado

**Body:**

```json
{
  "action": "not_duplicate" | "confirm_duplicate",
  "notes": "Razón de la decisión"
}
```

**Response:**

```json
{
  "success": true,
  "message": "DEA marcado como no duplicado",
  "aed": {...}
}
```

---

## 🎨 Componentes Utilizados

- `ConfirmDialog`: Diálogos de confirmación con input
- Iconos de Lucide: `AlertTriangle`, `CheckCircle`, `XCircle`, `MapPin`, `Image`, `Filter`, `Loader2`
- Tailwind CSS para estilos responsive

---

## 🔒 Seguridad

- Requiere autenticación (`requireAuth`)
- Solo usuarios con sesión válida pueden acceder
- Las acciones registran el email del usuario que las realizó

---

## 📱 Responsive Design

### Mobile

- Grid de 1 columna en comparación
- Botones full-width
- Stats en columna vertical

### Tablet

- Grid de 2 columnas en comparación
- Botones en fila

### Desktop

- Layout completo
- Grid 2 columnas optimizado

---

## 🐛 Manejo de Errores

### DEA no encontrado

- Status: 404
- Mensaje: "DEA no encontrado"
- Acción: Botón para volver al listado

### DEA no marcado como duplicado

- Status: 400
- Mensaje: "Este DEA no está marcado como posible duplicado"

### Candidato no encontrado

- Muestra mensaje en la columna derecha
- Permite continuar con la decisión

---

## 💡 Tips de Uso

1. **Priorizar por score**: Revisar primero los scores más altos (≥75)
2. **Verificar imágenes**: Las fotos son el mejor indicador
3. **Usar distancia GPS**: Si < 10m, alta probabilidad de duplicado
4. **Documentar bien**: Las notas ayudan en futuras revisiones
5. **Revisar plantas**: Mismo edificio ≠ duplicado si están en plantas diferentes

---

## 📈 Métricas

La interfaz permite:

- Ver cantidad total de duplicados pendientes
- Tracking de progreso (cuántos revisados vs totales)
- Filtrado para enfocarse en casos específicos

---

**Versión:** 1.0.0  
**Fecha:** 4 de diciembre de 2025  
**Autor:** Sistema de Verificación DEA Madrid
