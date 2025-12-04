# Autenticación de SharePoint por Batch

## Descripción

Sistema de autenticación de SharePoint basado en cookies proporcionadas por el usuario durante el proceso de importación. Las cookies se almacenan temporalmente en el batch y se eliminan automáticamente al finalizar la importación.

## Problema Resuelto

**Antes:** Las cookies de SharePoint estaban hardcodeadas en `.env`, lo que generaba:

- Riesgo de seguridad al compartir credenciales
- Imposibilidad de múltiples usuarios con diferentes credenciales
- Cookies expiradas afectaban todas las importaciones

**Ahora:**

- Cada importación usa sus propias cookies proporcionadas por el usuario
- Las cookies se solicitan solo cuando se detectan URLs de SharePoint
- Se validan antes de la importación
- Se eliminan automáticamente al finalizar

## Flujo de Usuario

### 1. Proceso de Importación Normal (Sin SharePoint)

Si el CSV no contiene URLs de SharePoint, el proceso es normal:

```
1. Subir CSV → 2. Mapear Columnas → 3. Validar → 4. Importar
```

### 2. Proceso con SharePoint Detectado

```
1. Subir CSV
2. Mapear Columnas
3. Validar Datos
   └─> ⚠️ Sistema detecta URLs de SharePoint
   └─> 🔐 Modal solicita cookies al usuario
       - Usuario pega cookies del navegador
       - Sistema valida con imagen de prueba
       - Si válidas → Continuar
       - Si inválidas → Error con instrucciones
4. Importar (usando cookies validadas)
5. Al finalizar → Cookies eliminadas automáticamente
```

## Arquitectura

### 1. Detección de SharePoint URLs

**Ubicación:** `src/application/import/use-cases/PreValidateDataUseCase.ts`

Durante la validación (Paso 3), el sistema:

1. Lee las primeras 10 filas del CSV
2. Revisa campos de imagen mapeados
3. Detecta si hay URLs de dominios SharePoint
4. Retorna información de detección:

```typescript
{
  detected: boolean;
  sampleUrls: string[];  // Hasta 3 URLs de muestra
  imageFields: string[]; // Campos donde se detectó
}
```

### 2. Modal de Solicitud de Cookies

**Ubicación:** `src/components/import/SharePointCookiesModal.tsx`

**Características:**

- Se muestra automáticamente cuando se detecta SharePoint
- Permite pegar todas las cookies del navegador
- Extrae automáticamente `FedAuth` y `rtFa`
- Valida las cookies con una imagen de prueba
- Muestra campos detectados con SharePoint
- Instrucciones paso a paso

**UI/UX:**

```
┌─────────────────────────────────────────────┐
│ 🔐 Autenticación de SharePoint Requerida   │
│                                             │
│ Se detectaron 2 campos con SharePoint:     │
│  • frontImageUrl                            │
│  • locationImageUrl                         │
│                                             │
│ Pega las cookies de SharePoint aquí:       │
│ ┌─────────────────────────────────────┐   │
│ │ FedAuth=xxx; rtFa=yyy; MSFPC=zzz... │   │
│ └─────────────────────────────────────┘   │
│                                             │
│ ✅ Cookies detectadas:                     │
│  • FedAuth: xxx...                         │
│  • rtFa: yyy...                            │
│                                             │
│ [Cancelar]            [Validar Cookies]    │
└─────────────────────────────────────────────┘
```

### 3. Validación de Cookies

**Endpoint:** `POST /api/sharepoint/validate-cookies`

**Request:**

```json
{
  "testImageUrl": "https://sharepoint.com/.../image.jpg",
  "customCookies": {
    "FedAuth": "xxx",
    "rtFa": "yyy"
  }
}
```

**Validaciones:**

1. ✅ No redirige a página de login
2. ✅ Content-Type es `image/*`
3. ✅ Tamaño mínimo (>1KB)
4. ✅ Magic bytes válidos (JPEG, PNG, etc.)

**Response (válido):**

```json
{
  "valid": true,
  "message": "✅ Cookies de SharePoint válidas",
  "details": {
    "statusCode": 200,
    "contentType": "image/jpeg"
  }
}
```

### 4. Almacenamiento en Batch

**Tabla:** `import_batches`
**Campo:** `import_parameters` (JSON)

```json
{
  "mappings": [...],
  "sharepointAuth": {
    "cookies": {
      "FedAuth": "xxx",
      "rtFa": "yyy"
    },
    "validatedAt": "2025-01-04T15:30:00Z"
  }
}
```

**Ubicación del código:** `src/app/api/import/route.ts`

### 5. Uso Durante la Importación

**Ubicación:** `src/lib/importProcessor.ts`

El procesador:

1. Lee `import_parameters` del batch
2. Extrae `sharepointAuth.cookies` si existen
3. Las pasa al `SharePointImageDownloader`
4. Descarga imágenes con autenticación
5. **Al finalizar:** Elimina las cookies del batch

```typescript
// Inicio: Leer cookies
const sharePointCookies = batch.import_parameters?.sharepointAuth?.cookies;

// Durante: Usar para descargar imágenes
await imageDownloader.download({
  url: photoUrl,
  auth: { type: "cookies", cookies: sharePointCookies },
});

// Final: Limpiar cookies
delete import_parameters.sharepointAuth;
await prisma.importBatch.update({
  data: { import_parameters: cleanedParameters },
});
```

### 6. Limpieza Automática

Las cookies se eliminan:

- ✅ Al completar la importación exitosamente
- ✅ Al completar con errores
- ✅ Al fallar la importación
- ✅ En cualquier escenario de finalización

**Código de limpieza:**

```typescript
let cleanedParameters = { ...batch.import_parameters };
delete cleanedParameters.sharepointAuth;
console.log(`🧹 Cleaned SharePoint cookies from batch`);
```

## Cómo Obtener las Cookies

### Método Recomendado: Copiar Todas las Cookies

1. Abre SharePoint en tu navegador e inicia sesión
2. Abre DevTools (F12) → pestaña **Network**
3. Recarga la página y selecciona cualquier petición
4. En **Request Headers**, busca `Cookie:`
5. Copia TODO el valor:
   ```
   MSFPC=xxx; rtFa=yyy; FedAuth=zzz; SIMI=www...
   ```
6. Pégalo en el modal cuando se solicite
7. El sistema extrae automáticamente `FedAuth` y `rtFa`

### Método Alternativo: Copiar Cookies Específicas

1. Abre SharePoint en tu navegador
2. DevTools (F12) → **Application** → **Cookies**
3. Selecciona el dominio de SharePoint
4. Busca y copia:
   - `FedAuth`
   - `rtFa`
5. Construye el string manualmente:
   ```
   FedAuth=valor1; rtFa=valor2
   ```

## Seguridad

### ✅ Buenas Prácticas Implementadas

1. **Sin almacenamiento permanente:** Las cookies NO están en `.env`
2. **Alcance limitado:** Cookies solo para ese batch específico
3. **Limpieza automática:** Se eliminan al finalizar
4. **Validación previa:** Se verifican antes de usar
5. **Sin logs:** Las cookies no se loggean en consola
6. **Aislamiento:** Cada batch tiene sus propias cookies

### 🔒 Consideraciones

- Las cookies se almacenan en `import_parameters` (JSON)
- Son visibles en la base de datos mientras el batch está activo
- Se eliminan automáticamente incluso si el servidor se cae (recuperación)
- Solo el usuario que inicia la importación puede ver su batch

### 🚨 NO Implementado (Futuro)

- [ ] Cifrado de cookies en BD
- [ ] Expiración automática de cookies antiguas
- [ ] Auditoría de uso de cookies
- [ ] Rotación de cookies

## Testing

### Test Manual Completo

1. **Preparar CSV con SharePoint URLs:**

   ```csv
   nombre,foto1
   DEA1,https://sharepoint.com/image1.jpg
   ```

2. **Iniciar Importación:**
   - Ir a `/import`
   - Click en "Nueva Importación"
   - Subir CSV

3. **Mapear Columnas:**
   - Mapear `foto1` → `frontImageUrl`
   - Continuar

4. **Validación:**
   - Click en "Iniciar Validación"
   - **✅ Debe aparecer modal de cookies**
   - Pegar cookies del navegador
   - **✅ Debe detectar FedAuth y rtFa**
   - Click en "Validar Cookies"
   - **✅ Debe validar correctamente**
   - Modal se cierra automáticamente

5. **Importación:**
   - Click en "Iniciar Importación"
   - **✅ Debe completarse sin errores**

6. **Verificar Limpieza:**
   - Consultar BD: `SELECT import_parameters FROM import_batches WHERE id = ?`
   - **✅ NO debe contener `sharepointAuth`**

### Casos de Prueba

| Caso                  | Entrada           | Resultado Esperado    |
| --------------------- | ----------------- | --------------------- |
| Sin SharePoint        | CSV sin URLs SP   | No solicita cookies   |
| Con SharePoint válido | Cookies válidas   | Importación exitosa   |
| Cookies inválidas     | Cookies expiradas | Error en validación   |
| Cookies parciales     | Solo FedAuth      | Validación exitosa    |
| Cancelar modal        | Click en cancelar | Importación cancelada |
| Sin pegar cookies     | Modal vacío       | Botón deshabilitado   |

## Troubleshooting

### "No se detectaron FedAuth o rtFa"

**Causa:** El string pegado no contiene las cookies requeridas

**Solución:**

1. Verificar que se copió el valor completo de `Cookie:`
2. Asegurarse de haber iniciado sesión en SharePoint
3. Copiar desde una petición reciente (no cache)

### "Cookies inválidas o han expirado"

**Causa:** Las cookies ya no son válidas

**Solución:**

1. Cerrar sesión en SharePoint
2. Volver a iniciar sesión
3. Copiar cookies nuevamente

### "Error al descargar imagen de SharePoint"

**Causa:** Cookies válidas pero URL incorrecta o imagen eliminada

**Solución:**

1. Verificar que la URL de la imagen existe
2. Verificar permisos de la imagen en SharePoint
3. Intentar acceder a la imagen manualmente

### Modal no aparece

**Causa:** No se detectaron URLs de SharePoint

**Verificar:**

1. Las columnas están correctamente mapeadas
2. Las URLs son de dominios SharePoint conocidos
3. Las URLs están en los primeros 10 registros

## Limitaciones Conocidas

1. **Solo detecta en primeras 10 filas:** Si las URLs SharePoint están después de la fila 10, no se detectarán
2. **Dominios hardcodeados:** Solo detecta dominios conocidos (sharepoint.com, sharepoint-df.com, microsoft.sharepoint.com)
3. **Sin renovación automática:** Si las cookies expiran durante una importación larga, fallará
4. **Una sola validación:** No re-valida si la importación tarda mucho

## Mejoras Futuras

### Corto Plazo

- [ ] Detectar SharePoint en todo el CSV (no solo 10 primeras filas)
- [ ] Soporte para más dominios SharePoint
- [ ] Mejor manejo de errores de autenticación durante importación

### Medio Plazo

- [ ] Cifrado de cookies en BD
- [ ] Re-validación automática si cookies expiran
- [ ] Cache de cookies válidas por dominio
- [ ] Soporte para OAuth en lugar de cookies

### Largo Plazo

- [ ] Integración con Microsoft Graph API
- [ ] Soporte para otros proveedores (Google Drive, Dropbox)
- [ ] Sistema de credenciales reutilizables por usuario
- [ ] Auditoría completa de acceso a credenciales

## Referencias

- [SharePoint REST API](https://docs.microsoft.com/en-us/sharepoint/dev/sp-add-ins/get-to-know-the-sharepoint-rest-service)
- [Sistema de Importación](./import-recovery-resume.md)
- [Arquitectura Hexagonal](../architecture/hexagonal.md)

## Changelog

### v2.0.0 (2025-01-04)

- 🔄 Cambio completo: Cookies por batch en lugar de .env
- ✨ Detección automática de SharePoint en validación
- 🔐 Modal de solicitud de cookies
- ✅ Validación previa de cookies
- 🧹 Limpieza automática al finalizar
- ❌ Eliminada dependencia de .env

### v1.0.0 (2025-01-04)

- ✨ Implementación inicial con .env
- ✅ Validación proactiva de cookies
- 🎨 UI en página de verificación
