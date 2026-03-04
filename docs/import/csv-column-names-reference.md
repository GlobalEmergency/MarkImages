# Referencia Rápida de Nombres de Columna para CSV

## 🎯 Resumen Ejecutivo

El sistema ahora soporta **3 formatos** de nombres de columna:

1. **Español tradicional** - "Propuesta de denominación", "Nombre de la vía"
2. **Inglés** - "proposed name", "street name", "latitude", "longitude"
3. **Nombres técnicos** - `proposedName`, `streetName`, `latitude`, `longitude`

**Todos hacen match automático** con confianza ≥70% 🎯

---

## 📋 Tabla de Referencia Rápida

### Campos Obligatorios

| Español                   | Inglés        | Técnico        | Alternativas                            |
| ------------------------- | ------------- | -------------- | --------------------------------------- |
| Propuesta de denominación | proposed name | `proposedName` | name, establishment name, facility name |
| Nombre de la vía          | street name   | `streetName`   | street, road name, avenue               |
| Número de la vía          | street number | `streetNumber` | number, building number                 |

### Coordenadas GPS (Muy Recomendado)

| Español                                              | Inglés    | Técnico     | Alternativas       |
| ---------------------------------------------------- | --------- | ----------- | ------------------ |
| Coordenadas-Latitud (norte)                          | latitude  | `latitude`  | lat, y, norte      |
| Coordenadas-Longitud (oeste, por lo tanto, negativa) | longitude | `longitude` | lon, lng, x, oeste |

### Identificación

| Español                 | Inglés             | Técnico             | Alternativas                  |
| ----------------------- | ------------------ | ------------------- | ----------------------------- |
| Código DEA              | aed code           | `code`              | id, defibrillator code        |
| Número provisional DEA  | provisional number | `provisionalNumber` | temporary number              |
| Tipo de establecimiento | establishment type | `establishmentType` | facility type, category, type |
| Referencia externa      | external reference | `externalReference` | external id, ref              |

### Dirección

| Español                  | Inglés            | Técnico            | Alternativas                        |
| ------------------------ | ----------------- | ------------------ | ----------------------------------- |
| Tipo de vía              | street type       | `streetType`       | road type                           |
| Complemento de dirección | additional info   | `additionalInfo`   | address complement, address details |
| Código postal            | postal code       | `postalCode`       | zip code, postcode, cp              |
| Ciudad                   | city name         | `cityName`         | city, municipality                  |
| Distrito                 | district          | `district`         | area, region, zone                  |
| Planta                   | floor             | `floor`            | level, storey, story, piso          |
| Ubicación específica     | specific location | `specificLocation` | exact location, position            |

### Responsable/Contacto

| Español              | Inglés            | Técnico            | Alternativas                 |
| -------------------- | ----------------- | ------------------ | ---------------------------- |
| Nombre               | contact name      | `submitterName`    | name, responsible            |
| Correo electrónico   | email             | `submitterEmail`   | mail, contact email          |
| Teléfono             | phone             | `submitterPhone`   | contact phone, mobile        |
| Teléfono alternativo | alternative phone | `alternativePhone` | secondary phone              |
| Organización         | organization      | `organization`     | company, institution, entity |
| Cargo                | position          | `position`         | role, title, job title       |
| Departamento         | department        | `department`       | area, section, division      |

### Horarios

| Español                             | Inglés               | Técnico               | Alternativas             |
| ----------------------------------- | -------------------- | --------------------- | ------------------------ |
| Descripción del horario             | schedule description | `scheduleDescription` | schedule, opening hours  |
| Hora de APERTURA de lunes a viernes | weekday opening      | `weekdayOpening`      | monday to friday opening |
| Hora de CIERRE de lunes a viernes   | weekday closing      | `weekdayClosing`      | monday to friday closing |
| Hora de APERTURA los sábados        | saturday opening     | `saturdayOpening`     | -                        |
| Hora de CIERRE los sábados          | saturday closing     | `saturdayClosing`     | -                        |
| Hora de APERTURA los domingos       | sunday opening       | `sundayOpening`       | -                        |
| Hora de CIERRE los domingos         | sunday closing       | `sundayClosing`       | -                        |
| ¿Tiene vigilante 24 horas...?       | 24h surveillance     | `has24hSurveillance`  | surveillance, security   |
| Acceso restringido                  | restricted access    | `hasRestrictedAccess` | limited access           |
| Cerrado en agosto                   | closed in august     | `closedInAugust`      | vacation                 |

### Instrucciones de Acceso

| Español                 | Inglés              | Técnico              | Alternativas                |
| ----------------------- | ------------------- | -------------------- | --------------------------- |
| Instrucciones de acceso | access instructions | `accessInstructions` | how to access, how to reach |
| Descripción del acceso  | access description  | `accessDescription`  | how to access               |
| Referencias visibles    | visible references  | `visibleReferences`  | landmarks                   |
| Advertencias de acceso  | access warnings     | `accessWarnings`     | access restrictions         |

### Imágenes

| Español        | Inglés         | Técnico            | Alternativas                  |
| -------------- | -------------- | ------------------ | ----------------------------- |
| Foto 1         | photo 1        | `photo1Url`        | image 1, picture              |
| Foto 2         | photo 2        | `photo2Url`        | image 2, picture              |
| Foto frontal   | front photo    | `photoFrontUrl`    | front image                   |
| Foto ubicación | location photo | `photoLocationUrl` | location image, context photo |
| Foto acceso    | access photo   | `photoAccessUrl`   | access image, entrance photo  |

### Observaciones y Estado

| Español              | Inglés              | Técnico              | Alternativas                         |
| -------------------- | ------------------- | -------------------- | ------------------------------------ |
| Observaciones origen | origin observations | `originObservations` | source observations, origin notes    |
| Notas internas       | internal notes      | `internalNotes`      | comments, internal comments          |
| Comentario libre     | free comment        | `freeComment`        | comment, additional comment, remarks |
| Estado               | status              | `status`             | state, condition                     |
| Requiere atención    | requires attention  | `requiresAttention`  | needs review                         |

### Origen de Datos

| Español             | Inglés         | Técnico         | Alternativas   |
| ------------------- | -------------- | --------------- | -------------- |
| Origen de datos     | data source    | `sourceOrigin`  | source, origin |
| Detalles del origen | source details | `sourceDetails` | source info    |

---

## 💡 Ejemplos de CSV

### Ejemplo 1: CSV en Español (Tradicional)

```csv
Propuesta de denominación;Nombre de la vía;Número de la vía;Coordenadas-Latitud (norte);Coordenadas-Longitud (oeste, por lo tanto, negativa);Código postal;Distrito
Hospital General;Gran Vía;14;40.416775;-3.703790;28001;Centro
```

### Ejemplo 2: CSV en Inglés

```csv
proposed name,street name,street number,latitude,longitude,postal code,district
General Hospital,Gran Via,14,40.416775,-3.703790,28001,Centro
```

### Ejemplo 3: CSV con Nombres Técnicos (Ideal para desarrolladores)

```csv
proposedName,streetName,streetNumber,latitude,longitude,postalCode,district
General Hospital,Gran Via,14,40.416775,-3.703790,28001,Centro
```

### Ejemplo 4: CSV Mixto (También funciona)

```csv
proposedName,street name,streetNumber,latitude,longitude,cp,distrito
General Hospital,Gran Via,14,40.416775,-3.703790,28001,Centro
```

### Ejemplo 5: CSV Completo con Muchos Campos (Inglés)

```csv
proposedName,streetName,streetNumber,latitude,longitude,postalCode,floor,specificLocation,establishmentType,submitterEmail,submitterPhone,weekdayOpening,weekdayClosing,photo1Url
General Hospital,Gran Via,14,40.416775,-3.703790,28001,Floor 3,Emergency Room,Hospital,contact@hospital.com,+34912345678,00:00,23:59,https://example.com/photo.jpg
```

---

## 🔍 Cómo Funciona el Match Automático

El sistema calcula un **score de confianza** (0-100%) basado en:

1. **Similitud de nombres** (40%)
2. **Keywords** (30%) ← Aquí entra inglés y nombres técnicos
3. **Patrones de datos** (20%)
4. **Contexto** (10%)

**Match automático**: ≥70% de confianza ✅
**Manual requerido**: <70% de confianza ⚠️

### Ejemplos de Match

| Columna CSV                 | Match             | Confianza | Motivo                     |
| --------------------------- | ----------------- | --------- | -------------------------- |
| `proposedName`              | ✅ proposedName   | 100%      | Nombre técnico exacto      |
| `proposed name`             | ✅ proposedName   | 95%       | Keyword en inglés          |
| `Propuesta de denominación` | ✅ proposedName   | 100%      | Nombre español oficial     |
| `nombre`                    | ✅ proposedName   | 75%       | Keyword español            |
| `latitude`                  | ✅ latitude       | 100%      | Nombre técnico exacto      |
| `lat`                       | ✅ latitude       | 90%       | Keyword común              |
| `Coordenadas-Latitud`       | ✅ latitude       | 95%       | Keyword español            |
| `email`                     | ✅ submitterEmail | 90%       | Keyword + pattern email    |
| `phone`                     | ✅ submitterPhone | 85%       | Keyword + pattern teléfono |
| `photo1Url`                 | ✅ photo1Url      | 100%      | Nombre técnico exacto      |
| `photo 1`                   | ✅ photo1Url      | 90%       | Keyword                    |
| `xyz123`                    | ❌ (sin match)    | <40%      | No se parece a nada        |

---

## 🎯 Recomendaciones

### Para Usuarios No Técnicos

✅ Usa los **nombres en español** tal como están en la especificación oficial

- Ejemplo: "Propuesta de denominación", "Nombre de la vía"

### Para Desarrolladores / APIs

✅ Usa los **nombres técnicos** directamente (camelCase)

- Ejemplo: `proposedName`, `streetName`, `latitude`, `longitude`
- **Ventaja**: Match exacto 100%, sin normalización

### Para Integraciones Internacionales

✅ Usa los **nombres en inglés** (snake_case o espacios)

- Ejemplo: "proposed name", "street name", "latitude", "longitude"
- **Ventaja**: Estándar internacional, fácil de leer

### Para CSVs Mixtos

✅ Usa **cualquier combinación** - el sistema es flexible

- Ejemplo: `proposedName`, "street name", "Código postal"
- **El sistema detectará automáticamente cada columna**

---

## 🚀 Tips Avanzados

### 1. Usar camelCase sin espacios (más fácil)

```csv
proposedName,streetName,streetNumber,latitude,longitude
Hospital General,Gran Via,14,40.416775,-3.703790
```

### 2. Sin acentos también funciona

```csv
propuesta de denominacion,nombre de la via,numero de la via
Hospital General,Gran Via,14
```

### 3. Abreviaturas comunes funcionan

```csv
nombre,calle,num,lat,lon,cp,tel,email
Hospital General,Gran Via,14,40.416775,-3.703790,28001,912345678,admin@hospital.com
```

### 4. Variantes en inglés

```csv
name,street,number,lat,lng,zip,phone,mail
Hospital General,Gran Via,14,40.416775,-3.703790,28001,912345678,admin@hospital.com
```

---

## 📚 Más Información

- **Especificación completa**: Ver `csv-format-specification.md`
- **Sistema de mapeo**: Ver `column-mapping-system.md`
- **Código fuente**: `src/import/domain/value-objects/FieldDefinition.ts`

---

**✨ Actualizado**: 2026-01-14
**🎯 Cambio**: Ahora soporta nombres técnicos y traducciones al inglés para todos los campos
