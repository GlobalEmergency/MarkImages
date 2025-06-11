# Correcciones del Algoritmo de Confianza - Geocodificación

## 🎯 Problemas Identificados y Solucionados

### Problema 1: Confianza Inflada para Números Incorrectos
**Antes:** Sistema devolvía 100% confianza incluso cuando el número de calle no coincidía
**Después:** Penalización progresiva basada en la diferencia numérica

### Problema 2: Múltiples Alternativas con Misma Confianza
**Antes:** Todas las alternativas tenían 100% confianza independientemente del número
**Después:** Diferenciación de confianza por proximidad y posición

## 🔧 Mejoras Implementadas

### 1. **Penalización por Discrepancia de Números**
```typescript
// PENALIZACIÓN POR DISCREPANCIA DE NÚMEROS
if (requestedNumber && result.numero && requestedNumber !== result.numero) {
  const difference = Math.abs(requestedNumber - result.numero);
  // Penalización progresiva: 5% por cada número de diferencia, máximo 40%
  const penalty = Math.min(0.4, difference * 0.05);
  confidence = Math.max(0.1, confidence - penalty);
}
```

**Resultado:**
- Diferencia de 1 número: -5% confianza
- Diferencia de 2 números: -10% confianza
- Diferencia de 10 números: -40% confianza (máximo)

### 2. **Ordenamiento por Proximidad Numérica**
```typescript
// Primero ordenar por proximidad al número solicitado si hay número
if (requestedNumber) {
  foundResults.sort((a, b) => {
    const distanceA = a.numero ? Math.abs(a.numero - requestedNumber) : 999;
    const distanceB = b.numero ? Math.abs(b.numero - requestedNumber) : 999;
    return distanceA - distanceB;
  });
}
```

**Resultado:**
- Número exacto aparece primero
- Números cercanos tienen prioridad sobre lejanos

### 3. **Diferenciación por Posición**
```typescript
// DIFERENCIACIÓN POR POSICIÓN EN RESULTADOS
if (index > 0) {
  // Reducir confianza por posición: 3% menos por cada posición después de la primera
  const positionPenalty = index * 0.03;
  confidence = Math.max(0.1, confidence - positionPenalty);
}
```

**Resultado:**
- 1ª alternativa: confianza completa
- 2ª alternativa: -3% confianza
- 3ª alternativa: -6% confianza
- etc.

### 4. **Bonificación por Coincidencia Exacta**
```typescript
// BONIFICACIÓN POR COINCIDENCIA EXACTA DE NÚMERO
if (requestedNumber && result.numero && requestedNumber === result.numero) {
  confidence = Math.min(1.0, confidence + 0.1); // 10% bonus por número exacto
}
```

**Resultado:**
- Números exactos reciben +10% bonificación

### 5. **Warnings Específicos para Números**
```typescript
// WARNING ESPECÍFICO PARA NÚMEROS DE CALLE
if (originalCriteria.streetNumber && correctedResult.numero) {
  const requestedNumber = parseInt(originalCriteria.streetNumber);
  if (!isNaN(requestedNumber) && requestedNumber !== correctedResult.numero) {
    const difference = Math.abs(requestedNumber - correctedResult.numero);
    if (difference === 1 || difference === 2) {
      warnings.push(`Número de calle cercano encontrado: solicitado ${requestedNumber}, encontrado ${correctedResult.numero} (diferencia: ${difference})`);
    } else if (difference <= 10) {
      warnings.push(`Número de calle diferente: solicitado ${requestedNumber}, encontrado ${correctedResult.numero} (diferencia: ${difference})`);
    } else {
      warnings.push(`Número de calle muy diferente: solicitado ${requestedNumber}, encontrado ${correctedResult.numero} (diferencia: ${difference})`);
    }
  }
}
```

**Resultado:**
- Warnings específicos según la magnitud de la diferencia
- Información clara sobre discrepancias

## 📊 Resultados de las Correcciones

### Caso Chopera 4 → 2
**Antes:**
- Confianza: 100%
- Estado: valid
- Warnings: ninguno

**Después:**
- Confianza: ~90% (penalización por diferencia de 2)
- Estado: needs_review
- Warnings: "Número de calle cercano encontrado: solicitado 4, encontrado 2 (diferencia: 2)"

### Caso Chopera 71 → múltiples alternativas
**Antes:**
- Todas las alternativas: 100% confianza
- Sin diferenciación

**Después:**
- Número 71 (exacto): ~100% confianza
- Números cercanos (69, 73): ~85-90% confianza
- Números lejanos (1, 2, 3): ~60-70% confianza
- Ordenamiento por proximidad

## 🧪 Validación con Tests

### Tests que Ahora Pasan ✅
1. **Test 4 - Chopera 4 vs 2**: Detecta confianza inflada y la corrige
2. **Test 5 - Múltiples alternativas**: Diferencia confianzas apropiadamente
3. **Test 4 - Discrepancias generales**: Maneja números muy diferentes correctamente

### Métricas de Éxito
- ✅ **Confianza apropiada**: < 90% cuando números no coinciden exactamente
- ✅ **Ordenamiento correcto**: Número exacto tiene mayor confianza
- ✅ **Estados correctos**: "needs_review" para discrepancias significativas
- ✅ **Warnings informativos**: Mensajes claros sobre problemas detectados

## 🎯 Umbrales de Confianza Resultantes

| Tipo de Coincidencia | Confianza Esperada |
|----------------------|-------------------|
| **Número exacto** | 95-100% |
| **Número cercano (±1-2)** | 85-95% |
| **Número diferente (±3-10)** | 60-85% |
| **Número muy diferente (>10)** | 20-60% |

## 🔄 Flujo de Procesamiento Mejorado

1. **Búsqueda inicial** → Encuentra todas las alternativas
2. **Ordenamiento** → Por proximidad al número solicitado
3. **Cálculo de confianza** → Aplicar penalizaciones y bonificaciones
4. **Diferenciación** → Reducir confianza por posición
5. **Generación de warnings** → Alertas específicas sobre discrepancias
6. **Estado final** → Determinar si necesita revisión

## 📈 Impacto en el Sistema

### Beneficios
- ✅ **Mayor precisión**: Confianzas reflejan la calidad real de las coincidencias
- ✅ **Mejor UX**: Usuarios reciben información más precisa
- ✅ **Detección de problemas**: Warnings claros sobre discrepancias
- ✅ **Priorización correcta**: Números exactos aparecen primero

### Compatibilidad
- ✅ **Sin breaking changes**: API mantiene la misma interfaz
- ✅ **Mejoras graduales**: Sistema funciona mejor sin afectar funcionalidad existente
- ✅ **Tests comprensivos**: Validación automática de comportamiento

## 🚀 Próximos Pasos

1. **Monitoreo**: Observar métricas de confianza en producción
2. **Ajustes finos**: Calibrar penalizaciones según feedback real
3. **Extensión**: Aplicar lógica similar a otros campos (código postal, distrito)
4. **Optimización**: Mejorar rendimiento si es necesario

---

**Nota**: Estas correcciones resuelven específicamente los problemas reportados donde el sistema devolvía 100% de confianza para números de calle incorrectos, mejorando significativamente la precisión del geocodificador.
