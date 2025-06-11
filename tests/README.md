# Tests del Sistema de Validación de Direcciones

Este directorio contiene una suite completa de tests para verificar el funcionamiento del sistema de geocodificación y validación de direcciones de Madrid, incluyendo casos específicos para problemas identificados.

## 🎯 Casos Problemáticos Identificados

Los tests cubren específicamente estos problemas reportados:

### Caso 1: Paseo De la Chopera 4 → Sistema devuelve 2
- **Problema**: Confianza 100% pero número incorrecto
- **Test**: `chopera-validation.test.ts` - Test 4
- **Validación**: Confianza debe reducirse cuando el número no coincide

### Caso 2: Paseo De la Chopera 71 → Múltiples alternativas con 100% confianza
- **Problema**: Todas las alternativas (71, 73, 75) tienen 100% confianza
- **Test**: `chopera-validation.test.ts` - Test 5
- **Validación**: Número exacto debe tener mayor confianza que cercanos

## 📁 Estructura de Tests

### `chopera-validation.test.ts`
**Tests específicos para problemas con "De la Chopera"**
- ✅ Test 1: Validación básica de "Paseo De la Chopera 4"
- ✅ Test 2: Variaciones del nombre "Chopera"
- ✅ Test 3: Calidad de las sugerencias
- 🔍 Test 4: **Caso problemático - Número 4 vs 2 (confianza inflada)**
- 🔍 Test 5: **Caso problemático - Múltiples alternativas con confianza inflada**

### `street-number-validation.test.ts`
**Tests específicos para validación de números de calle**
- ✅ Test 1: Números cercanos (diferencia de 1-2 números)
- ✅ Test 2: Números muy diferentes (diferencia >10)
- ✅ Test 3: Múltiples alternativas con números diferentes
- ✅ Test 4: Generación de warnings para discrepancias

### `address-validation.test.ts`
**Tests generales del sistema de validación**
- ✅ Test 1: Dirección exacta
- ✅ Test 2: Búsqueda fuzzy con errores tipográficos
- ✅ Test 3: Direcciones no existentes
- ✅ Test 4: Discrepancias en números de calle
- ✅ Test 5: Priorización de números exactos
- ✅ Test 6: Búsqueda geográfica
- ✅ Test 7: Generación de recomendaciones
- ✅ Test 8: Flujo de integración completo

### `validation-system.test.ts`
**Tests de integración del sistema completo**
- ✅ Test 1-5: Casos básicos del sistema
- 🔍 Test 6: **Caso problemático Chopera 4 → 2**
- 🔍 Test 7: **Caso problemático Chopera 71 → múltiples alternativas**

### `run-all-tests.ts`
**Ejecutor completo de toda la suite de tests**
- Ejecuta todos los tests en secuencia
- Proporciona resumen detallado
- Sugiere correcciones específicas

## 🚀 Ejecución de Tests

### Ejecutar toda la suite
```bash
npx tsx tests/run-all-tests.ts
```

### Ejecutar tests individuales
```bash
# Tests específicos de Chopera
npx tsx tests/chopera-validation.test.ts

# Tests de números de calle
npx tsx tests/street-number-validation.test.ts

# Tests generales del sistema
npx tsx tests/address-validation.test.ts

# Tests de integración
npx tsx tests/validation-system.test.ts
```

### Comandos npm (si están configurados)
```bash
npm test                    # Ejecutar suite completa
npm run test:chopera       # Tests específicos de Chopera
npm run test:numbers       # Tests de números de calle
npm run test:validation    # Tests generales
```

## 🔍 Problemas Detectados por los Tests

### 1. Confianza Inflada
- **Síntoma**: Sistema devuelve 100% confianza para números incorrectos
- **Test que lo detecta**: `chopera-validation.test.ts` Test 4 y 5
- **Corrección necesaria**: Penalizar confianza cuando números no coinciden

### 2. Falta de Diferenciación en Alternativas
- **Síntoma**: Múltiples alternativas con la misma confianza alta
- **Test que lo detecta**: `street-number-validation.test.ts` Test 3
- **Corrección necesaria**: Ordenar por proximidad al número solicitado

### 3. Estados de Validación Incorrectos
- **Síntoma**: Estado "valid" cuando debería ser "needs_review"
- **Test que lo detecta**: Múltiples tests
- **Corrección necesaria**: Ajustar lógica de determinación de estados

### 4. Warnings Insuficientes
- **Síntoma**: No se generan warnings para discrepancias de números
- **Test que lo detecta**: `street-number-validation.test.ts` Test 4
- **Corrección necesaria**: Implementar warnings específicos

## 📊 Métricas de Éxito

### Criterios de Aprobación
- ✅ **Confianza apropiada**: < 90% cuando números no coinciden exactamente
- ✅ **Ordenamiento correcto**: Número exacto tiene mayor confianza
- ✅ **Estados correctos**: "needs_review" para discrepancias significativas
- ✅ **Warnings informativos**: Mensajes claros sobre problemas detectados

### Umbrales de Confianza Esperados
- **Coincidencia exacta**: 95-100%
- **Número cercano (±1-2)**: 70-90%
- **Número diferente (±3-10)**: 40-70%
- **Número muy diferente (>10)**: <40%

## 🔧 Sugerencias de Mejora

### Para el Algoritmo de Confianza
```typescript
// Penalizar discrepancias de números
if (inputNumber !== foundNumber) {
  const difference = Math.abs(inputNumber - foundNumber);
  const penalty = Math.min(0.3, difference * 0.05);
  confidence = Math.max(0, confidence - penalty);
}
```

### Para el Ordenamiento de Alternativas
```typescript
// Ordenar por proximidad al número solicitado
suggestions.sort((a, b) => {
  const distanceA = Math.abs(a.numero - requestedNumber);
  const distanceB = Math.abs(b.numero - requestedNumber);
  return distanceA - distanceB;
});
```

### Para la Generación de Warnings
```typescript
// Generar warnings específicos
if (bestMatch.numero !== parseInt(inputNumber)) {
  warnings.push(`Número encontrado (${bestMatch.numero}) difiere del solicitado (${inputNumber})`);
}
```

## 🎯 Casos de Test Específicos

### Chopera 4 → 2
```typescript
// Input
streetType: 'Paseo'
streetName: 'De la Chopera'
streetNumber: '4'
postalCode: '28045'
district: '2. Arganzuela'

// Validaciones
- Confianza < 95% si devuelve número 2
- Estado = 'needs_review'
- Warning sobre discrepancia de números
```

### Chopera 71 → 73, 75, 71
```typescript
// Input
streetType: 'Paseo'
streetName: 'De la Chopera'
streetNumber: '71'
postalCode: '28045'
district: '2. Arganzuela'

// Validaciones
- Número 71 tiene mayor confianza que 73 y 75
- No todas las alternativas tienen 100% confianza
- Estado apropiado según discrepancias
```

## 📈 Integración Continua

### GitHub Actions
```yaml
name: Geocoding Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npx tsx tests/run-all-tests.ts
```

### Reportes de Test
Los tests generan reportes detallados que incluyen:
- ✅ Número de tests pasados/fallidos
- 📊 Porcentaje de éxito
- 🔍 Problemas específicos detectados
- 💡 Sugerencias de corrección
- ⏱️ Tiempo de ejecución

## 🛠️ Mantenimiento

### Actualizar Tests
Cuando se modifique el algoritmo de geocodificación:
1. Ejecutar `npx tsx tests/run-all-tests.ts`
2. Revisar tests fallidos
3. Actualizar umbrales si es necesario
4. Documentar cambios en este README

### Agregar Nuevos Casos
Para agregar nuevos casos problemáticos:
1. Crear test específico en el archivo apropiado
2. Agregar al `run-all-tests.ts`
3. Documentar en este README
4. Actualizar criterios de éxito

## 📞 Troubleshooting

### Tests Fallan por Timeout
```bash
# Verificar conexión a BD
npm run db:status

# Cargar datos si es necesario
npm run load-madrid-data
```

### Datos Inconsistentes
```bash
# Recargar datos de Madrid
npm run load-madrid-data-optimized

# Verificar integridad
npm run verify-data
```

### Problemas de Rendimiento
- Verificar índices en la base de datos
- Revisar consultas SQL en el repositorio
- Considerar cache para búsquedas frecuentes

---

**Nota**: Estos tests están diseñados para detectar y prevenir regresiones en el sistema de geocodificación, especialmente para los casos problemáticos identificados donde el sistema devuelve confianzas infladas para números de calle incorrectos.
