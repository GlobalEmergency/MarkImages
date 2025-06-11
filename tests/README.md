# Tests del Sistema de Validación de Direcciones

Este directorio contiene las pruebas para el sistema de validación de direcciones de Madrid optimizado.

## Estructura de Tests

### `validation-system.test.ts`
Test principal que valida el funcionamiento completo del nuevo sistema de validación de direcciones.

**Casos de prueba incluidos:**
1. **Dirección exacta** - Valida coincidencias exactas en el callejero oficial
2. **Búsqueda fuzzy** - Prueba tolerancia a errores tipográficos
3. **Dirección no existente** - Manejo de direcciones inválidas
4. **Búsqueda geográfica** - Validación por proximidad de coordenadas
5. **Validación de componentes** - Verificación de todos los elementos de dirección

### `address-validation.test.ts`
Test con formato Jest (para futuras implementaciones con framework de testing).

## Ejecución de Tests

### Comando principal
```bash
npm test
```

### Comando específico para validación
```bash
npm run test:validation
```

### Ejecución directa
```bash
npx tsx tests/validation-system.test.ts
```

## Resultados Esperados

Los tests validan:
- ✅ **Status de validación**: `valid`, `needs_review`, `invalid`
- ✅ **Confianza**: Valor entre 0 y 1
- ✅ **Tipo de coincidencia**: `exact`, `fuzzy`, `geographic`
- ✅ **Sugerencias**: Array de direcciones alternativas
- ✅ **Acciones recomendadas**: Array de acciones para corrección

## Integración con CI/CD

Estos tests están preparados para ejecutarse en GitHub Actions:

```yaml
- name: Run Address Validation Tests
  run: npm test
```

## Casos de Prueba Detallados

### Test 1: Dirección Exacta
- **Input**: CALLE GRAN VIA, 1, 28013, Distrito 1
- **Esperado**: Coincidencia exacta con alta confianza
- **Validación**: Coordenadas y distancia a dirección oficial

### Test 2: Búsqueda Fuzzy
- **Input**: CALLE GRAN BIA (error tipográfico)
- **Esperado**: Sistema detecta error y sugiere corrección
- **Validación**: Manejo robusto de errores tipográficos

### Test 3: Dirección No Existente
- **Input**: CALLE INEXISTENTE, 999
- **Esperado**: Status `invalid` con mensaje claro
- **Validación**: Manejo correcto de direcciones inexistentes

### Test 4: Búsqueda Geográfica
- **Input**: Coordenadas de Plaza Mayor
- **Esperado**: Encuentra direcciones cercanas por proximidad
- **Validación**: Cálculo correcto de distancias

### Test 5: Validación de Componentes
- **Input**: CALLE ALCALA, 100, 28009, Distrito 4
- **Esperado**: Validación completa de todos los componentes
- **Validación**: Verificación de tipo vía, nombre, código postal, distrito

## Métricas de Éxito

- **Cobertura**: 100% de los casos de uso principales
- **Rendimiento**: Respuesta < 2 segundos por test
- **Precisión**: Confianza > 90% para direcciones válidas
- **Robustez**: Manejo correcto de errores y casos edge

## Mantenimiento

Los tests deben actualizarse cuando:
- Se modifique la estructura de datos de direcciones
- Se añadan nuevas funcionalidades de validación
- Se cambien los criterios de confianza
- Se actualice el callejero oficial de Madrid

## Troubleshooting

### Error de conexión a base de datos
Verificar que la base de datos esté disponible y las migraciones aplicadas:
```bash
npm run db:push
```

### Datos de Madrid no cargados
Cargar los datos del callejero oficial:
```bash
npm run load-madrid-data
```

### Tests fallan por timeout
Aumentar el timeout en el entorno de CI o verificar rendimiento de consultas SQL.
