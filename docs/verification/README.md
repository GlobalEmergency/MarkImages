# Sistema de Verificación de DEAs

**Versión:** 2.0  
**Última actualización:** 25 de noviembre de 2025

---

## 📋 Índice

1. [Visión General](#visión-general)
2. [Proceso de Validación de Dirección](#proceso-de-validación-de-dirección)
3. [Proceso de Verificación de Imágenes](#proceso-de-verificación-de-imágenes)
4. [Estados y Transiciones](#estados-y-transiciones)
5. [Flujo Completo de Verificación](#flujo-completo-de-verificación)
6. [Casos Especiales](#casos-especiales)
7. [Criterios de Publicación](#criterios-de-publicación)
8. [Anexo Técnico](#anexo-técnico)

---

## Visión General

El sistema de verificación de DEAs implementa **DOS PROCESOS INDEPENDIENTES pero NECESARIOS** para que un DEA pueda ser publicado:

### 🗺️ **1. Validación de Dirección** (`addressValidationStatus`)

Proceso de validación de la ubicación física del DEA contra datos oficiales del Ayuntamiento de Madrid.

### 📸 **2. Verificación de Imágenes** (`imageVerificationStatus`)

Proceso de verificación visual mediante fotografías donde se marca con flechas la ubicación exacta del DEA.

### ⚡ Independencia de los Procesos

- Ambos procesos son **independientes** y pueden ejecutarse en cualquier momento
- Ambos son **obligatorios** para que el DEA esté completo y publicable
- **Orden recomendado**: Validar dirección primero, luego verificar imágenes (mantiene coherencia)
- Un DEA puede tener:
  - ✅ Dirección validada pero imágenes pendientes
  - ✅ Imágenes verificadas pero dirección pendiente
  - ❌ NO publicable hasta que ambos estén completos

---

## Proceso de Validación de Dirección

### Objetivo

Validar que la dirección proporcionada coincida con los datos oficiales del Ayuntamiento de Madrid en términos de:

- Tipo y nombre de vía
- Código postal
- Distrito
- Coordenadas geográficas

### Modalidades de Validación

#### 🤖 **Validación Automática**

- Ejecutada por tareas programadas en el backend
- Compara automáticamente contra base de datos oficial
- Auto-aprueba si cumple todos los criterios de coincidencia
- Ideal para lotes grandes de DEAs

#### 👤 **Validación Manual**

- Proceso interactivo paso a paso
- Operador revisa y confirma cada aspecto
- Permite correcciones manuales cuando los datos no coinciden exactamente
- Necesaria para casos ambiguos o excepcionales

### Proceso Paso a Paso (Validación Manual)

El proceso consta de **4 pasos secuenciales**:

#### **Paso 1: Confirmar Dirección**

- **Objetivo**: Buscar y confirmar la dirección oficial en el callejero de Madrid
- **Entrada**: Datos proporcionados por el usuario (tipo vía, nombre, número)
- **Proceso**:
  - Sistema busca automáticamente en base de datos oficial
  - Muestra sugerencias de coincidencias
  - Operador selecciona la dirección correcta
- **Resultado**: Dirección oficial confirmada
- **Puede saltarse**: ❌ NO - Es siempre obligatorio

#### **Paso 2: Verificar Código Postal**

- **Objetivo**: Confirmar que el código postal coincide con la dirección
- **Entrada**: CP del registro vs CP de la dirección oficial
- **Proceso**:
  - Si coinciden → Paso se **salta automáticamente** ✅
  - Si difieren → Operador confirma el CP correcto
- **Resultado**: CP validado
- **Puede saltarse**: ✅ SÍ - Auto-aprobado si coincide

#### **Paso 3: Verificar Distrito**

- **Objetivo**: Confirmar que el distrito coincide con la dirección
- **Entrada**: Distrito del registro vs distrito de la dirección oficial
- **Proceso**:
  - Si coinciden → Paso se **salta automáticamente** ✅
  - Si difieren → Operador confirma el distrito correcto
- **Resultado**: Distrito validado
- **Puede saltarse**: ✅ SÍ - Auto-aprobado si coincide

#### **Paso 4: Verificar Coordenadas**

- **Objetivo**: Confirmar que las coordenadas GPS son precisas
- **Entrada**: Coordenadas del registro vs coordenadas oficiales
- **Proceso**:
  - Sistema calcula distancia entre ambos puntos
  - Si distancia < 50m → Paso se **salta automáticamente** ✅
  - Si distancia > 50m → Operador confirma coordenadas correctas
- **Resultado**: Coordenadas validadas
- **Puede saltarse**: ✅ SÍ - Auto-aprobado si distancia es mínima

### Resultado Final

Al completar los 4 pasos:

- ✅ El DEA recibe `addressValidationStatus = 'completed'`
- ✅ Los campos definitivos (`def*`) se actualizan con los valores validados:
  - `defTipoVia`, `defNombreVia`, `defNumero`
  - `defCp`, `defDistrito`
  - `defLat`, `defLon`

### Optimización de Pasos

**Si la dirección ya fue validada previamente** (`addressValidationStatus = 'completed'`):

- ⚡ Los pasos 1 y 2 se **saltan automáticamente**
- ⚡ El proceso continúa directamente desde el paso 3 (verificación de distrito)
- ⚡ Se utilizan los datos definitivos (`def*`) ya almacenados

---

## Proceso de Verificación de Imágenes

### Objetivo

Verificar visualmente la ubicación exacta del DEA mediante fotografías con indicadores claros.

### Proceso Paso a Paso

#### **Paso 1: Validación de Datos DEA**

- **Objetivo**: Confirmar información básica del DEA
- **Entrada**: Datos del registro (nombre, tipo establecimiento, horarios, etc.)
- **Proceso**:
  - Si `addressValidationStatus = 'completed'` → **Paso se salta** ⚡
  - Si dirección no validada → Operador revisa datos manualmente
- **Resultado**: Datos básicos confirmados

#### **Paso 2: Selección de Imágenes**

- **Objetivo**: Seleccionar qué imágenes se utilizarán
- **Entrada**: Foto1 y Foto2 (si existe)
- **Proceso**:
  - Operador revisa ambas imágenes
  - Marca cada imagen como:
    - ✅ **Válida**: Se usará en el proceso
    - ❌ **No válida**: Se descarta
  - Puede intercambiar el orden (si la segunda es mejor que la primera)
  - Puede marcar el DEA completo como **inválido** (sin imágenes utilizables)
- **Resultado**: Imágenes seleccionadas para procesamiento

#### **Paso 3: Recorte de Imagen**

- **Objetivo**: Extraer la parte relevante de la imagen
- **Entrada**: Imagen válida seleccionada
- **Proceso**:
  - Operador define área de recorte (crop)
  - Sistema genera imagen cuadrada 1000x1000px
  - Resultado: Imagen recortada optimizada
- **Resultado**: Imagen recortada lista para marcado

#### **Paso 4: Marcado con Flecha**

- **Objetivo**: Indicar ubicación exacta del DEA en la imagen
- **Entrada**: Imagen recortada
- **Proceso**:
  - Operador traza flecha desde parte inferior hacia el DEA
  - Sistema procesa y superpone flecha roja estándar
  - Configuración: Ancho 40px, color #dc2626 (rojo)
- **Resultado**: Imagen procesada con flecha indicadora

#### **Paso 5: Revisión y Confirmación**

- **Objetivo**: Revisar resultado final antes de completar
- **Entrada**: Imagen procesada con flecha
- **Proceso**:
  - Operador revisa la imagen final
  - Confirma que la flecha indica claramente el DEA
  - Puede volver a pasos anteriores si es necesario
- **Resultado**: Verificación completada

### Resultado Final

Al completar el proceso:

- ✅ El DEA recibe `imageVerificationStatus = 'verified'`
- ✅ Se genera un registro en `verification_sessions` con estado `VERIFIED`
- ✅ La imagen procesada queda almacenada y referenciada
- ⚠️ La imagen **original** del DEA (`foto1`) se mantiene intacta

### Casos Especiales en Verificación de Imágenes

#### DEA Marcado como Inválido

- Si el operador marca el DEA como inválido (sin imágenes útiles):
  - ❌ `imageVerificationStatus = 'invalid'`
  - ❌ El DEA NO se puede publicar
  - 📝 Se registra el motivo del rechazo

#### Verificación Descartada

- Si se decide no continuar con la verificación:
  - ⚠️ `imageVerificationStatus = 'discarded'`
  - 📝 Se registra razón del descarte
  - 🔄 Puede re-verificarse posteriormente

#### Cancelación de Verificación

- Si se cancela una verificación en progreso:
  - 🔙 El estado vuelve al anterior (ej: `pending`)
  - 🗑️ No se guardan cambios
  - 🔄 Puede reiniciarse cuando sea necesario

---

## Estados y Transiciones

### Estados de Validación de Dirección

| Estado      | Descripción                                | ¿Publicable?                |
| ----------- | ------------------------------------------ | --------------------------- |
| `pending`   | Dirección aún no validada (estado inicial) | ❌ NO                       |
| `completed` | Dirección validada exitosamente            | ✅ SÍ (si imágenes también) |

**Transiciones:**

```
pending → [Proceso de validación] → completed
```

### Estados de Verificación de Imágenes

| Estado         | Descripción                                   | ¿Publicable?                 |
| -------------- | --------------------------------------------- | ---------------------------- |
| `pending`      | Sin verificación de imágenes (estado inicial) | ❌ NO                        |
| `pre_verified` | Pre-verificado (salta validación de datos)    | ⚡ Especial                  |
| `in_progress`  | Verificación en curso                         | ⏳ En proceso                |
| `verified`     | Imágenes verificadas exitosamente             | ✅ SÍ (si dirección también) |
| `invalid`      | Marcado como inválido (sin imágenes útiles)   | ❌ NO                        |
| `discarded`    | Verificación descartada                       | ⚠️ Puede re-verificarse      |

**Transiciones:**

```
pending → in_progress → verified
pending → in_progress → invalid
pending → in_progress → discarded
pre_verified → in_progress → verified
verified → in_progress → verified (re-verificación)
```

---

## Flujo Completo de Verificación

### Flujo Recomendado (Orden Coherente)

```
1. DEA Creado
   ├─ addressValidationStatus: 'pending'
   └─ imageVerificationStatus: 'pending'

2. Validar Dirección (Manual o Automática)
   ├─ Paso 1: Confirmar dirección oficial
   ├─ Paso 2: Verificar CP (puede auto-saltarse)
   ├─ Paso 3: Verificar distrito (puede auto-saltarse)
   └─ Paso 4: Verificar coordenadas (puede auto-saltarse)

   Resultado:
   └─ addressValidationStatus: 'completed'

3. Verificar Imágenes
   ├─ Paso 1: Validar datos DEA (se salta si dirección OK)
   ├─ Paso 2: Seleccionar imágenes
   ├─ Paso 3: Recortar imagen
   ├─ Paso 4: Marcar con flecha
   └─ Paso 5: Revisar y confirmar

   Resultado:
   └─ imageVerificationStatus: 'verified'

4. DEA Completo y Publicable ✅
   ├─ addressValidationStatus: 'completed'
   └─ imageVerificationStatus: 'verified'
```

### Flujo Alternativo (Orden Flexible)

Los procesos pueden ejecutarse en orden inverso si es necesario:

```
1. Verificar Imágenes primero
   └─ imageVerificationStatus: 'verified'

2. Validar Dirección después
   └─ addressValidationStatus: 'completed'

3. DEA Completo ✅
```

---

## Casos Especiales

### 🚀 DEA Pre-verificado

**Concepto**: DEA cuya dirección ya fue verificada por otro medio (ej: importación desde sistema oficial).

**Estado inicial**:

```
imageVerificationStatus: 'pre_verified'
```

**Comportamiento**:

- ⚡ **Salta validación de dirección completamente**
- ⚡ Comienza directamente en selección de imágenes (Paso 2)
- ⚡ No requiere confirmar datos básicos (Paso 1)

**Uso típico**: Lotes de DEAs importados de fuentes oficiales donde la dirección ya está garantizada.

### ❌ DEA Inválido

**Razones**:

- Sin imágenes utilizables (borrosas, incorrectas, etc.)
- Ubicación no corresponde con la dirección
- Información contradictoria

**Estado final**:

```
imageVerificationStatus: 'invalid'
```

**Consecuencias**:

- ❌ NO se puede publicar
- 📝 Queda registrado el motivo
- 🔄 Puede actualizarse con nuevas imágenes y re-verificarse

### ⚠️ Verificación Descartada

**Razones**:

- DEA ya no existe en la ubicación
- Información desactualizada
- Duplicado de otro registro

**Estado final**:

```
imageVerificationStatus: 'discarded'
```

**Consecuencias**:

- ⚠️ Queda marcado como descartado
- 📝 Se registra motivo del descarte
- 🔄 Puede re-verificarse si cambia la situación

### 🔄 Re-verificación

**Cuándo es necesaria**:

- Cambio de ubicación del DEA
- Actualización de imágenes
- Corrección de datos

**Proceso**:

- Estado previo se guarda temporalmente
- Se puede cancelar y volver al estado anterior
- Si se completa, reemplaza la verificación anterior

---

## Criterios de Publicación

### DEA Publicable ✅

Un DEA es publicable cuando cumple **TODOS** estos criterios:

1. ✅ **Dirección validada**:
   - `addressValidationStatus = 'completed'`
   - Campos `def*` completos (defTipoVia, defNombreVia, defCp, defDistrito, defLat, defLon)

2. ✅ **Imágenes verificadas**:
   - `imageVerificationStatus = 'verified'`
   - Imagen procesada con flecha almacenada
   - Sesión de verificación en estado `VERIFIED`

3. ✅ **Información básica completa**:
   - Datos del establecimiento (nombre, tipo, titularidad)
   - Horarios de acceso
   - Descripción de acceso (opcional pero recomendado)

### DEA NO Publicable ❌

Un DEA NO es publicable si:

- ❌ `addressValidationStatus = 'pending'` (dirección sin validar)
- ❌ `imageVerificationStatus = 'pending'` (imágenes sin verificar)
- ❌ `imageVerificationStatus = 'invalid'` (marcado como inválido)
- ❌ `imageVerificationStatus = 'in_progress'` (verificación sin completar)
- ❌ Falta información básica obligatoria

### Estados Intermedios ⏳

Algunos estados permiten trabajo parcial pero no publicación:

- ⏳ `imageVerificationStatus = 'discarded'` → Puede re-verificarse
- ⏳ `imageVerificationStatus = 'in_progress'` → Debe completarse o cancelarse

---

## Anexo Técnico

### Campos de Base de Datos

#### Tabla: `dea_records`

**Validación de Dirección:**

- `addressValidationStatus` (VARCHAR): Estado de validación de dirección
  - Valores: `'pending'`, `'completed'`
  - Por defecto: `'pending'`

**Verificación de Imágenes:**

- `imageVerificationStatus` (VARCHAR): Estado de verificación de imágenes
  - Valores: `'pending'`, `'pre_verified'`, `'in_progress'`, `'verified'`, `'invalid'`, `'discarded'`
  - Por defecto: `'pending'`

**Campos Definitivos (resultado de validación):**

- `defTipoVia`, `defNombreVia`, `defNumero`: Dirección validada
- `defCp`: Código postal validado
- `defDistrito`: Distrito validado
- `defLat`, `defLon`: Coordenadas validadas

#### Tabla: `verification_sessions`

Registra cada sesión de verificación de imágenes:

- `status`: Estado de la sesión (`in_progress`, `verified`, `discarded`)
- `currentStep`: Paso actual del proceso
- `stepData`: Datos de cada paso (JSON)
- `markedAsInvalid`: Indica si fue marcado como inválido
- `processedImageUrl`: URL de imagen procesada final

### Servicios Principales

#### `stepValidationService.ts`

- Gestiona validación de dirección paso a paso
- Métodos: `initializeStepValidation`, `executeStep1-4`
- Actualiza `addressValidationStatus`

#### `simpleVerificationService.ts`

- Gestiona verificación de imágenes
- Métodos: `startVerification`, `completeVerification`, `discardVerification`
- Actualiza `imageVerificationStatus`

### Endpoints API

**Validación de Dirección:**

- `POST /api/dea/[id]/validate-steps` - Ejecutar pasos de validación

**Verificación de Imágenes:**

- `POST /api/verify/[id]/start` - Iniciar verificación
- `POST /api/verify/[id]/select-images` - Seleccionar imágenes
- `POST /api/verify/[id]/crop` - Recortar imagen
- `POST /api/verify/[id]/add-arrow` - Añadir flecha
- `POST /api/verify/[id]/complete` - Completar verificación

### Datos Oficiales

**Fuente**: Ayuntamiento de Madrid

**Tablas cargadas:**

- `direcciones`: 213,431 direcciones oficiales
- `vias`: 9,393 viales normalizados
- `distritos`: 21 distritos
- `barrios`: Barrios por distrito

**Actualización**: Los datos pueden actualizarse ejecutando `npm run load-madrid-data`

---

## Conclusión

El sistema de verificación de DEAs garantiza que cada desfibrilador publicado tenga:

1. ✅ **Ubicación precisa y validada** contra datos oficiales
2. ✅ **Imágenes claras** que indican exactamente dónde está el DEA
3. ✅ **Información completa** para su correcta localización en emergencias

Los dos procesos son independientes pero complementarios, permitiendo flexibilidad en el orden de ejecución mientras se mantiene la calidad y precisión de los datos publicados.

---

**Documento creado:** 25 de noviembre de 2025  
**Última revisión:** 25 de noviembre de 2025  
**Versión:** 2.0
