# Campos Requeridos en el Sistema de Importación

## Campos Obligatorios

El sistema de importación de DEAs **solo requiere 3 campos obligatorios**:

### 1. Nombre del establecimiento (`proposedName`)
- **Descripción**: Nombre del establecimiento donde está ubicado el DEA
- **Ejemplos**: 
  - Hospital General
  - Centro Comercial Plaza
  - Ayuntamiento

### 2. Nombre de la vía (`streetName`)
- **Descripción**: Nombre de la calle o vía
- **Ejemplos**:
  - Gran Vía
  - Calle Mayor
  - Paseo de la Castellana

### 3. Número de la vía (`streetNumber`)
- **Descripción**: Número del portal
- **Ejemplos**:
  - 1
  - 25
  - 123 bis

## Campos Opcionales

Todos los demás campos son **opcionales**, incluyendo:

### Distrito (`district`)
- **Descripción**: Distrito de Madrid donde se ubica el DEA
- **Nota**: A pesar de ser útil, NO es obligatorio
- **Validación**: Si se proporciona, se valida contra la lista de distritos válidos (genera WARNING si no se encuentra)
- **Ejemplos**:
  - Centro
  - 1. Centro
  - Retiro
  - 3. Retiro

### Otros campos opcionales
- Correo electrónico
- Código postal
- Coordenadas (latitud/longitud)
- Fotos
- Horarios
- Tipo de establecimiento
- etc.

## Validación durante la Importación

### Validación de Campos Requeridos
- ❌ **ERROR**: Si falta alguno de los 3 campos obligatorios
- ✅ **OK**: Si todos están presentes, incluso sin distrito

### Validación de Distrito (si está presente)
- ⚠️ **WARNING**: Si el distrito no se encuentra en el sistema
- ⚠️ **WARNING**: Si el distrito no existe en la base de datos
- ✅ **OK**: Si está vacío (es opcional)
- ✅ **OK**: Si existe y es válido

### Flujo de Validación

```
1. Validar campos requeridos (3 campos)
   ├─ proposedName: obligatorio
   ├─ streetName: obligatorio
   └─ streetNumber: obligatorio

2. Validar distrito (opcional)
   ├─ Si está presente → validar formato y existencia (WARNING si falla)
   └─ Si está vacío → continuar sin error

3. Validar otros campos opcionales
   └─ Solo si están presentes
```

## Cambios Implementados (Enero 2025)

### Antes
- ❌ Distrito era **obligatorio**
- ❌ No se podía importar sin distrito
- ❌ Error si distrito estaba vacío

### Después
- ✅ Distrito es **opcional**
- ✅ Se puede importar sin distrito
- ✅ Solo WARNING si distrito inválido
- ✅ Solo 3 campos son obligatorios

## Archivos Modificados

1. **`src/domain/import/value-objects/FieldDefinition.ts`**
   - Movido `district` de `REQUIRED_FIELDS` a `OPTIONAL_FIELDS`

2. **`src/application/import/use-cases/PreValidateDataUseCase.ts`**
   - Eliminado `district` del array de campos requeridos
   - Cambiado severidad de ERROR a WARNING en validación de distrito

3. **`src/domain/import/value-objects/CsvRow.ts`**
   - Simplificado `hasMinimumRequiredFields()` para solo validar 3 campos

## Impacto en la UI

- El selector de mapeo de columnas mostrará distrito como **opcional**
- El resumen de mapeo contará distrito como campo opcional
- Los indicadores visuales reflejarán correctamente los 3 campos requeridos
- No se bloqueará la importación si falta distrito

## Testing

Para probar el cambio:

1. Importar CSV **sin columna de distrito** → ✅ Debe permitir continuar
2. Importar CSV **con distrito vacío** → ✅ Debe permitir continuar
3. Importar CSV **con distrito inválido** → ⚠️ Debe mostrar WARNING pero permitir continuar
4. Importar CSV **sin nombre** → ❌ Debe mostrar ERROR
5. Importar CSV **sin calle** → ❌ Debe mostrar ERROR
6. Importar CSV **sin número** → ❌ Debe mostrar ERROR
