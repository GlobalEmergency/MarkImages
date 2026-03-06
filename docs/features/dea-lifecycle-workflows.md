# Flujos de Ciclo de Vida de DEAs — Documento de Diseño

> **Objetivo**: Definir los flujos completos de administración, gestión, verificación y publicación de DEAs para que el sistema sea flexible, trazable y útil para todos los actores involucrados.
>
> **Versión**: 2.0 — Revisión completa basada en auditoría de código fuente

---

## 1. Actores del Sistema

### Por rol global

| Rol           | Descripción               | Acceso                                       |
| ------------- | ------------------------- | -------------------------------------------- |
| **ADMIN**     | Administrador del sistema | Acceso total a todos los DEAs y operaciones  |
| **MODERATOR** | Moderador                 | Revisión y aprobación de contenido           |
| **USER**      | Usuario autenticado       | Según permisos de organización               |
| _(anónimo)_   | Usuario sin autenticar    | Puede ver DEAs públicos y enviar formularios |

### Por rol de organización (OrgMemberRole)

| Rol          | can_verify | can_edit | can_approve | can_manage_members |
| ------------ | ---------- | -------- | ----------- | ------------------ |
| **OWNER**    | ✅         | ✅       | ✅          | ✅                 |
| **ADMIN**    | ✅         | ✅       | ✅          | ❌                 |
| **VERIFIER** | ✅         | ❌       | ❌          | ❌                 |
| **MEMBER**   | ✅         | ❌       | ❌          | ❌                 |
| **VIEWER**   | ❌         | ❌       | ❌          | ❌                 |

> **Nota**: Los flags son customizables por miembro. Los valores de arriba son los defaults por rol.

### Por tipo de organización (OrganizationType)

| Tipo                  | Función principal                                                  | Tipos de asignación            | Restricción            |
| --------------------- | ------------------------------------------------------------------ | ------------------------------ | ---------------------- |
| **CIVIL_PROTECTION**  | Verificación de existencia, ubicación, fotos, señalización, acceso | CIVIL_PROTECTION               | 1 activa por DEA       |
| **CERTIFIED_COMPANY** | Datos técnicos del equipo, mantenimiento, estado del aparato       | CERTIFIED_COMPANY, MAINTENANCE | MAINTENANCE: 1 por DEA |
| **MUNICIPALITY**      | Aprobación de publicación, autorización oficial                    | _(sin asignación directa)_     | —                      |
| **OWNER**             | Datos del propietario/responsable, horarios, acceso                | OWNERSHIP                      | 1 por DEA              |
| **HEALTH_SERVICE**    | Datos sanitarios, certificaciones                                  | VERIFICATION                   | Múltiples por DEA      |
| **VOLUNTEER_GROUP**   | Verificación informal en campo                                     | VERIFICATION                   | Múltiples por DEA      |

---

## 2. Fuentes de Entrada de Datos

Los DEAs entran al sistema por múltiples vías:

| Fuente                               | Ruta                  | Estado inicial                   | publication_mode | requires_attention | Audit trail                |
| ------------------------------------ | --------------------- | -------------------------------- | ---------------- | ------------------ | -------------------------- |
| **Formulario web** (usuario/anónimo) | `POST /api/aeds`      | PENDING_REVIEW                   | LOCATION_ONLY    | false              | ✅ AedStatusChange         |
| **Formulario simple** (anónimo)      | `POST /api/aeds`      | PENDING_REVIEW                   | LOCATION_ONLY    | false              | ✅ AedStatusChange         |
| **Import CSV** (admin)               | Batch job             | DRAFT                            | configurable     | configurable       | ⚠️ Parcial                 |
| **Sync externa** (CKAN/API)          | ExternalSyncProcessor | configurable (default PUBLISHED) | configurable     | configurable       | ❌ **Sin AedStatusChange** |
| **Creación admin**                   | Panel admin           | DRAFT/PENDING_REVIEW             | LOCATION_ONLY    | false              | Según ruta                 |

### Problemas detectados en entrada de datos

1. **Sync externa no genera audit trail**: Los DEAs creados/actualizados por sync externa no crean registros de `AedStatusChange` ni `AedFieldChange`. Esto impide rastrear el origen y cambios de datos sincronizados.
2. **Rate limiting solo para anónimos**: Solo se limitan 5 envíos/hora por IP para usuarios no autenticados. Usuarios autenticados no tienen límite.
3. **Formulario simple ultra-mínimo**: Solo captura nombre, calle, número, ciudad. El admin debe completar el resto manualmente.

---

## 3. Estados del DEA (AedStatus)

```
                    ┌──────────────────────────────────────────────┐
                    │                                              │
  CREACIÓN ──→ DRAFT ──→ PENDING_REVIEW ──→ PUBLISHED ──→ INACTIVE
                 │              │                │            │
                 │              └──→ REJECTED     │            │
                 │                     │          │            │
                 └─────────────────────┴──────────┴────────────┘
                        (requires_attention = true → vuelve a cola de verificación)
```

### Transiciones válidas (máquina de estados)

| Desde          | Hacia          | Quién                      | Cuándo                                  | Auditable                                  |
| -------------- | -------------- | -------------------------- | --------------------------------------- | ------------------------------------------ |
| DRAFT          | PENDING_REVIEW | Sistema/Admin              | Datos mínimos completos                 | Sí                                         |
| DRAFT          | PUBLISHED      | Admin                      | Import masivo con datos ya verificados  | Sí                                         |
| PENDING_REVIEW | PUBLISHED      | Verificador (completion)   | Verificación completada                 | ⚠️ **Falta AedStatusChange**               |
| PENDING_REVIEW | REJECTED       | Admin/Verificador          | Datos incorrectos, duplicado, no existe | ⚠️ **Falta AedStatusChange en duplicados** |
| PUBLISHED      | INACTIVE       | Admin, org ADMIN/OWNER     | DEA retirado, cerrado, no accesible     | Sí                                         |
| PUBLISHED      | PENDING_REVIEW | Admin, org con can_approve | Re-verificación necesaria               | Sí                                         |
| INACTIVE       | PENDING_REVIEW | Admin                      | Posible reactivación tras revisión      | Sí                                         |
| REJECTED       | DRAFT          | Admin                      | Datos corregidos, segundo intento       | Sí                                         |
| REJECTED       | _(eliminado)_  | Sistema                    | Cleanup automático tras 30 días         | ⚠️ **Borra historial**                     |

### BUG: Sin validación de máquina de estados

**Estado actual**: El `PATCH /api/admin/deas/[id]` acepta **cualquier transición de estado** sin validar. Un admin podría hacer `DRAFT → INACTIVE` o `REJECTED → PUBLISHED` sin restricción.

**Solución propuesta**: Implementar función `isValidStatusTransition(from, to)` que valide contra la tabla de arriba antes de aplicar el cambio.

```typescript
const VALID_TRANSITIONS: Record<AedStatus, AedStatus[]> = {
  DRAFT: ["PENDING_REVIEW", "PUBLISHED"],
  PENDING_REVIEW: ["PUBLISHED", "REJECTED"],
  PUBLISHED: ["INACTIVE", "PENDING_REVIEW"],
  INACTIVE: ["PENDING_REVIEW"],
  REJECTED: ["DRAFT"],
};
```

### Campos de desactivación (por implementar)

Para `PUBLISHED → INACTIVE`, el DEA necesita metadata adicional:

| Campo                        | Tipo      | Descripción                            |
| ---------------------------- | --------- | -------------------------------------- |
| `deactivation_reason`        | String    | Razón textual de la desactivación      |
| `deactivation_type`          | Enum      | TEMPORARY, PERMANENT, ERROR, DUPLICATE |
| `expected_reactivation_date` | DateTime? | Solo para TEMPORARY                    |

**Opciones de implementación**:

- **Opción A**: Campos nuevos en el modelo `Aed` (requiere migración)
- **Opción B**: Usar el campo JSON existente `status_metadata` (sin migración, pero menos tipado)

---

## 4. Flujo de Verificación

### 4.1 Estado actual de la verificación

El flujo actual de verificación (`/verify/[id]`) es un wizard de 8 pasos:

```
ADDRESS_VALIDATION → IMAGE_SELECTION → IMAGE_CROP → IMAGE_BLUR →
IMAGE_ARROW → RESPONSIBLE_ASSIGNMENT → REVIEW → COMPLETED
```

**Comportamiento actual al completar**:

1. Procesa y sube imágenes a S3
2. Marca imágenes como `is_verified = true`
3. Crea registro `AedOrganizationVerification` (tipo FIELD_INSPECTION)
4. **Cambia status directamente a PUBLISHED** (sin aprobación)
5. Actualiza `last_verified_at`, `verification_method`
6. NO crea `AedStatusChange` (gap de auditoría)
7. NO limpia `requires_attention` (bug)

### 4.2 Problemas detectados en verificación

| Problema                                         | Impacto                                                  | Severidad |
| ------------------------------------------------ | -------------------------------------------------------- | --------- |
| Verificación publica directamente sin aprobación | Cualquier verificador puede publicar un DEA              | ALTA      |
| No se crea AedStatusChange al completar          | Transición PENDING_REVIEW→PUBLISHED no queda auditada    | ALTA      |
| `requires_attention` no se limpia al verificar   | DEA verificado sigue en cola de "requiere atención"      | MEDIA     |
| Verificaciones abandonadas no se limpian         | `AedValidation` en IN_PROGRESS persisten indefinidamente | MEDIA     |
| Race condition en verificación simultánea        | Dos usuarios verificando el mismo DEA: last-write-wins   | BAJA      |
| `process-image` auto-aprueba `is_verified=true`  | Sin confirmación humana separada para verificar imagen   | BAJA      |
| Es todo-o-nada: no hay verificación parcial      | Si el usuario abandona el wizard, no se guarda nada      | MEDIA     |

### 4.3 Niveles de Verificación (rediseño propuesto)

La verificación no es un proceso único sino **multi-nivel**, donde cada tipo de organización verifica lo que le compete:

#### Nivel 1: Verificación de campo (Protección Civil / Voluntarios)

- **Qué verifican**: Existencia física, ubicación exacta, fotos del entorno, señalización, accesibilidad
- **Campos**: `verified_address`, `verified_photos`, `verified_access`, `verified_signage`
- **Resultado**: Confirma que el DEA existe y es accesible
- **Efecto automático**: `status → PUBLISHED` (si estaba en PENDING_REVIEW), `publication_mode → LOCATION_ONLY`

#### Nivel 2: Verificación técnica (Empresa certificada / Mantenedor)

- **Qué verifican**: Estado del equipo, fecha de caducidad de electrodos/batería, modelo, número de serie
- **Campos propuestos**: `verified_equipment`, `verified_maintenance`, `verified_expiry`
- **Resultado**: Confirma que el DEA funciona y está en condiciones
- **Efecto automático**: Ninguno sobre status/publicación (datos técnicos complementarios)

#### Nivel 3: Verificación administrativa (Propietario / Responsable)

- **Qué verifican**: Datos del responsable, horarios de acceso, teléfono de contacto
- **Campos**: `verified_schedule`, `verified_responsible`
- **Resultado**: Confirma que los datos de contacto son correctos
- **Efecto automático**: `publication_mode → BASIC_INFO` (si está en LOCATION_ONLY y tiene aprobación)

#### Nivel 4: Aprobación oficial (Ayuntamiento / Autoridad)

- **Qué verifican**: Cumplimiento normativo, certificación oficial
- **Campos**: `certificate_number`, `certificate_expiry`, `approved_by_authority`
- **Resultado**: El DEA cumple la normativa local/regional
- **Efecto automático**: `publication_mode → FULL` (requiere `approved_by_authority` y `approved_for_full`)

### 4.4 Flujo de verificación por niveles

```
DEA en PENDING_REVIEW
    │
    ├── Nivel 1: Protección Civil verifica existencia/ubicación/fotos
    │   ├── ✅ → status=PUBLISHED, last_verified_at=now, requires_attention=false
    │   └── ✅ → AedStatusChange + AedOrganizationVerification creados
    │
    ├── Nivel 2: Empresa certificada verifica equipo/mantenimiento
    │   └── ✅ → Datos técnicos actualizados, AedOrganizationVerification creado
    │
    ├── Nivel 3: Propietario confirma horarios/responsable
    │   └── ✅ → publication_mode=BASIC_INFO (si aprobado), datos confirmados
    │
    └── Nivel 4: Ayuntamiento aprueba publicación completa
        └── ✅ → approved_by_authority=true, publication_mode=FULL
```

**Cada nivel es independiente** — no hay que esperar a completar todos para publicar. Nivel 1 es suficiente para PUBLISHED con LOCATION_ONLY. Los demás niveles mejoran la calidad y el publication_mode.

### 4.5 Filtros de verificación (implementado)

| Filtro                 | Descripción             | Query                              |
| ---------------------- | ----------------------- | ---------------------------------- |
| `never_verified`       | Sin verificación manual | `last_verified_at IS NULL`         |
| `requires_attention`   | Marcados para revisión  | `requires_attention = true`        |
| `verification_expired` | Verificación > 6 meses  | `last_verified_at < 6 meses atrás` |

### 4.6 Resolución de duplicados (implementado)

Flujo separado del wizard de verificación:

```
DEA importado con requires_attention=true + internal_notes.duplicate_*
    │
    ├── GET /api/verify/duplicates ──→ Lista DEAs candidatos a duplicado
    │
    └── PUT /api/verify/duplicates/[id]
        ├── action: "not_duplicate" → requires_attention=false (mantiene status)
        └── action: "confirm_duplicate" → status=REJECTED, rejection_reason set
            ⚠️ NO crea AedStatusChange (bug)
```

---

## 5. Flujo de Publicación

### Modos de publicación (PublicationMode)

```
NONE → LOCATION_ONLY → BASIC_INFO → FULL
```

### Datos visibles por modo

| Modo              | Datos visibles públicamente                                 | Quién puede aprobar                |
| ----------------- | ----------------------------------------------------------- | ---------------------------------- |
| **NONE**          | Nada (privado)                                              | —                                  |
| **LOCATION_ONLY** | Dirección, coordenadas, código postal, distrito, barrio     | Verificador Nivel 1                |
| **BASIC_INFO**    | + horario, tipo establecimiento                             | Verificador Nivel 3 con aprobación |
| **FULL**          | + fotos, responsable, contacto, notas, instrucciones acceso | Autoridad (Nivel 4)                |

> **Detalle técnico**: `filterAedByPublicationMode()` en `src/lib/publication-filter.ts` aplica el filtrado campo a campo.

### Flujo de escalado de publicación

1. DEA creado → `publication_mode: LOCATION_ONLY` (formulario web) o `NONE` (propuesto)
2. Verificación Nivel 1 completada → `publication_mode: LOCATION_ONLY` (automático)
3. Propietario confirma horarios → `publication_mode: BASIC_INFO` (requiere `approved_for_full`)
4. Autoridad aprueba → `publication_mode: FULL` (requiere `approved_by_authority` + `approved_for_full`)

### Publication mode efectivo con múltiples asignaciones

Cuando un DEA tiene múltiples organizaciones asignadas, el modo de publicación **más permisivo gana**:

```typescript
// getEffectivePublicationMode() en organization-permissions.ts
FULL (con approved_for_full + approved_by_authority) > BASIC_INFO (con approved_for_full) > LOCATION_ONLY > NONE
```

> **Riesgo**: Si una organización tiene FULL aprobado y otra solo LOCATION_ONLY, el efectivo es FULL. Esto podría exponer datos inesperadamente si no se gestiona bien.

### Problemas detectados en publicación

| Problema                                                     | Impacto                                            |
| ------------------------------------------------------------ | -------------------------------------------------- |
| Cambios de `publication_mode` no generan `AedFieldChange`    | Historial de campo incompleto                      |
| Bulk publication no registra timestamps individuales por DEA | No se sabe cuándo se actualizó cada DEA            |
| Merging permisivo puede exponer datos                        | La organización con más permisos "gana" para todas |

---

## 6. Acciones Administrativas sobre DEAs

### 6.1 Acciones existentes

| Acción              | Ruta                                      | Quién                          | Audit trail                                           |
| ------------------- | ----------------------------------------- | ------------------------------ | ----------------------------------------------------- |
| Editar datos        | `PATCH /api/admin/deas/[id]`              | Admin global, org con can_edit | ✅ Completo (AedFieldChange + AedStatusChange)        |
| Cambiar estado      | `PATCH /api/admin/deas/[id]`              | Admin global, org con can_edit | ✅ AedStatusChange (pero sin validar transición)      |
| Verificar           | `POST /api/verify/[id]/complete`          | Org con can_verify             | ⚠️ AedOrganizationVerification sí, AedStatusChange no |
| Cambiar publicación | `PATCH /api/aeds/[id]/publication`        | Admin, autenticado             | ✅ AedPublicationHistory                              |
| Procesar imagen     | `POST /api/admin/deas/[id]/process-image` | Admin, org con can_edit        | ✅ AedFieldChange                                     |
| Resolver duplicado  | `PUT /api/verify/duplicates/[id]`         | Admin, verificador             | ❌ Sin AedStatusChange                                |
| Cleanup rejected    | `DELETE /api/admin/cleanup/rejected-aeds` | Admin global                   | ⚠️ Hard delete (borra historial)                      |

### 6.2 Acciones propuestas (por implementar)

#### "Desactivar DEA" (soft delete temporal)

- **Cuándo**: DEA existe pero no está disponible temporalmente
- **Acción**: `status → INACTIVE`, `deactivation_reason`, `expected_reactivation_date`
- **Quién**: Admin global, org ADMIN/OWNER
- **Reversible**: Sí → vuelve a PENDING_REVIEW
- **Audit**: AedStatusChange con `deactivation_type` en notas

#### "Eliminar DEA" (soft delete permanente)

- **Cuándo**: DEA es error, duplicado, o dato falso
- **Acción**: `status → REJECTED`, `rejection_reason`
- **Quién**: Admin global
- **Cleanup**: Eliminación física automática tras 30 días
- **Mejora propuesta**: Archivar historial antes de eliminar (actualmente se pierde)

#### "Devolver a verificación"

- **Cuándo**: Datos incorrectos reportados, necesita re-verificar
- **Acción**: `status → PENDING_REVIEW`, `requires_attention = true`, `last_verified_at = null`
- **Quién**: Admin global, org con can_approve
- **Efecto**: Aparece en cola de verificación con filtro "requires_attention"

#### "Marcar para atención"

- **Cuándo**: Algo no está bien pero no requiere cambio de estado
- **Acción**: `requires_attention = true` + nota interna
- **Quién**: Cualquier verificador
- **Efecto**: Aparece en filtro "requires_attention"

#### "Reportar problema" (usuario público)

- **Cuándo**: Un usuario ve algo incorrecto en un DEA público
- **Estado actual**: Botón existe en `/dea/[id]` pero **no es funcional**
- **Propuesta**: Conectar con `AedChangeProposal` tipo `REPORT_ISSUE`
- **Quién**: Cualquier usuario (autenticado o anónimo con rate limit)

---

## 7. Sistema de Asignaciones (AedOrganizationAssignment)

### Estado actual

| Campo                   | Tipo             | Descripción                                                               |
| ----------------------- | ---------------- | ------------------------------------------------------------------------- |
| `assignment_type`       | AssignmentType   | CIVIL_PROTECTION, CERTIFIED_COMPANY, OWNERSHIP, MAINTENANCE, VERIFICATION |
| `status`                | AssignmentStatus | ACTIVE, REVOKED, COMPLETED, PENDING_APPROVAL                              |
| `publication_mode`      | PublicationMode  | Modo de publicación desde esta asignación                                 |
| `approved_for_full`     | Boolean          | Aprobado para publicación completa                                        |
| `approved_by_authority` | Boolean          | Aprobado por autoridad municipal                                          |

### Restricciones de unicidad

| Tipo de asignación | Máximo activas por DEA | Validación app                 | Validación BD        |
| ------------------ | ---------------------- | ------------------------------ | -------------------- |
| CIVIL_PROTECTION   | 1                      | ✅ `checkAssignmentConflict()` | ✅ Unique constraint |
| OWNERSHIP          | 1                      | ❌ **Falta**                   | ✅ Unique constraint |
| MAINTENANCE        | 1                      | ❌ **Falta**                   | ✅ Unique constraint |
| CERTIFIED_COMPANY  | Múltiples              | N/A                            | ✅                   |
| VERIFICATION       | Múltiples              | N/A                            | ✅                   |

> **BUG**: `checkAssignmentConflict()` solo valida CIVIL_PROTECTION. OWNERSHIP y MAINTENANCE fallan con error críptico de BD (unique constraint violation) en vez de un mensaje claro.

### Problemas detectados en asignaciones

1. **Sin validación de status transition**: No hay máquina de estados para `PENDING_APPROVAL → ACTIVE → REVOKED`
2. **Sin cascade al revocar CIVIL_PROTECTION**: Si se revoca la asignación de Protección Civil, las verificaciones asociadas quedan huérfanas
3. **Sin audit trail de cambios de aprobación**: No se registra quién/cuándo cambió `approved_for_full` o `approved_by_authority`
4. **Sin downgrade prevention**: Se puede bajar el publication_mode después de aprobado sin control

---

## 8. Propuestas de Cambio (Change Proposals)

Para cambios sugeridos por organizaciones que no tienen `can_edit`:

```
Org/Usuario sugiere cambio ──→ AedChangeProposal (PENDING)
                                       │
                             ┌─────────┼─────────┐
                             ▼         ▼         ▼
                       APPROVED   REJECTED  NEEDS_MORE_INFO
                       (se aplica  (se     (se pide más
                        el cambio)  rechaza)  información)
```

### Tipos de propuesta (ProposalChangeType)

| Tipo            | Quién propone         | Qué cambia              |
| --------------- | --------------------- | ----------------------- |
| UPDATE_SCHEDULE | Propietario, empresa  | Horarios de acceso      |
| UPDATE_LOCATION | Protección Civil      | Corrección de dirección |
| ADD_PHOTOS      | Cualquier verificador | Nuevas fotos            |
| UPDATE_ACCESS   | Protección Civil      | Información de acceso   |
| REPORT_ISSUE    | Cualquier usuario     | Problema detectado      |

### Estado actual

- **Schema**: Modelo `AedChangeProposal` definido con todos los campos necesarios
- **API**: ❌ No implementado (sin endpoints)
- **Frontend**: ❌ No implementado (botón "Reportar problema" sin funcionalidad)

---

## 9. Reclamaciones de Propiedad (Ownership Claims)

```
Usuario reclama propiedad ──→ AedOwnershipClaim (PENDING)
                                      │
                            ┌─────────┼──────────────┐
                            ▼         ▼              ▼
                      APPROVED   REJECTED   NEEDS_VERIFICATION
                      (se crea    (se       (verificación en
                       asignación  rechaza)   campo necesaria)
                       OWNERSHIP)
```

### Tipos de reclamación (ClaimType)

- ESTABLISHMENT_OWNER — propietario del establecimiento
- EQUIPMENT_OWNER — propietario del equipo DEA
- AUTHORIZED_MANAGER — gestor autorizado

### Estado actual

- **Schema**: Modelo `AedOwnershipClaim` definido
- **API**: ❌ No implementado
- **Frontend**: ❌ No implementado

---

## 10. Trazabilidad y Auditoría

### Modelos de auditoría

| Modelo                          | Qué registra                                   | Estado                        |
| ------------------------------- | ---------------------------------------------- | ----------------------------- |
| **AedStatusChange**             | Cambios de estado con razón y autor            | ⚠️ Gaps (ver abajo)           |
| **AedFieldChange**              | Cambios campo a campo con valor anterior/nuevo | ⚠️ Gaps                       |
| **AedPublicationHistory**       | Cambios de modo de publicación                 | ✅ Funcional                  |
| **AedOrganizationVerification** | Verificaciones completadas por org             | ✅ Funcional                  |
| **ValidationSession**           | Pasos de verificación (audit trail)            | ✅ Funcional                  |
| **AuditLog**                    | Log genérico de acciones                       | ❌ **Definido pero NO usado** |
| **AedCodeHistory**              | Historial de códigos asignados                 | ✅ Funcional                  |

### Gaps de auditoría detectados

| Acción                            |     AedStatusChange     | AedFieldChange | Debería                   |
| --------------------------------- | :---------------------: | :------------: | ------------------------- |
| Admin edita DEA                   |           ✅            |       ✅       | Correcto                  |
| Admin procesa imagen              |            —            |       ✅       | Correcto                  |
| Verificación completa → PUBLISHED |           ❌            |       ❌       | ✅ Ambos                  |
| Confirmar duplicado → REJECTED    |           ❌            |       ❌       | ✅ Ambos                  |
| Sync externa crea DEA             |           ❌            |       ❌       | ✅ AedStatusChange mínimo |
| Sync externa actualiza DEA        |           ❌            |       ❌       | ✅ AedFieldChange         |
| Cambio de publication_mode        | ✅ (PublicationHistory) |       ❌       | ✅ AedFieldChange         |
| Cambio de requires_attention      |           ❌            |       ❌       | ✅ AedFieldChange         |

### Cleanup y pérdida de datos

El endpoint `DELETE /api/admin/cleanup/rejected-aeds` hace **hard delete** de:

- AedImage, AedValidation, AedStatusChange, AedCodeHistory, Aed

**Problema**: Se pierde toda la trazabilidad. Propuesta: archivar registros de auditoría antes de eliminar, o mover a tabla de archivo.

---

## 11. Estadísticas de Organización

### Estado actual (`GET /api/organizations/[orgId]/stats`)

| Métrica                    | Cómo se calcula                                              | Problema                   |
| -------------------------- | ------------------------------------------------------------ | -------------------------- |
| `total_deas`               | Assignments ACTIVE de la org                                 | ✅ Correcto                |
| `verified_deas`            | Assignments tipo VERIFICATION con `last_verified_at != null` | ⚠️ Ignora CIVIL_PROTECTION |
| `pending_verifications`    | Never verified OR > 1 año                                    | ✅ Correcto                |
| `members_count`            | Miembros de la org                                           | ✅ Correcto                |
| `verifications_this_month` | AedOrganizationVerification del mes                          | ✅ Correcto                |
| `deas_by_status`           | Por tipo de assignment (active/inactive/pending)             | ✅ Correcto                |

**Bug**: `verified_deas` solo cuenta asignaciones tipo VERIFICATION. Los DEAs asignados como CIVIL_PROTECTION que han sido verificados no se cuentan como "verificados" en las estadísticas.

---

## 12. Acceso a Rutas Admin por Org Members (implementado)

### Flujo de acceso actual

| Tipo de usuario                   | GET admin/deas/[id] | PATCH admin/deas/[id] | process-image |
| --------------------------------- | ------------------- | --------------------- | ------------- |
| Admin global                      | ✅                  | ✅                    | ✅            |
| Org con can_edit                  | ✅ (lectura)        | ✅ (edición)          | ✅            |
| Org con can_verify (sin can_edit) | ✅ (lectura)        | ❌ 403                | ❌ 403        |
| Org MEMBER (sin flags)            | ❌ 403              | ❌ 403                | ❌ 403        |
| Sin autenticar                    | ❌ 401              | ❌ 401                | ❌ 401        |

**Implementación**: `requireAdminOrAedPermission()` en `src/lib/auth.ts` — verifica admin global OR permisos de org vía `getUserPermissionsForAed()`.

---

## 13. Resumen de Prioridades de Implementación

### Ya implementado ✅

- [x] Permisos org admin/editor para rutas admin de DEAs (`requireAdminOrAedPermission`)
- [x] Filtros de verificación basados en necesidad real (never_verified, requires_attention, verification_expired)
- [x] Eliminación de check `is_verified` para verificadores
- [x] Resolución de duplicados (`/api/verify/duplicates`)
- [x] Formularios público y simple de envío de DEAs
- [x] Sistema de publicación progresiva con filtrado por modo
- [x] Auditoría de campos en edición admin (AedFieldChange)
- [x] Cleanup automático de DEAs rejected

### Fase 1: Corrección de bugs y consistencia (prioridad alta)

1. **Máquina de estados** — Validar transiciones de status antes de aplicar cambios
2. **Audit trail completo** — AedStatusChange en verificación, duplicados y sync
3. **Limpiar requires_attention** al completar verificación
4. **Validar conflictos de asignación** para OWNERSHIP y MAINTENANCE (no solo CIVIL_PROTECTION)
5. **Corregir stats de org** — Contar CIVIL_PROTECTION en verified_deas

### Fase 2: Acciones administrativas (prioridad media-alta)

6. **Acción "Desactivar DEA"** — Botón en vista admin con razón y tipo
7. **Acción "Devolver a verificación"** — Reset de estado con nota
8. **Acción "Marcar para atención"** — Flag sin cambio de estado
9. **Archivar antes de cleanup** — Preservar historial de auditoría

### Fase 3: Verificación multi-nivel (prioridad media)

10. **Separar verificación por tipo de org** — Cada org verifica lo que le compete
11. **Escalado automático de publicación** — publication_mode sube con cada nivel
12. **Restricción de campos por tipo de org** — Cada org edita solo sus campos
13. **Limpieza de verificaciones abandonadas** — Cron para IN_PROGRESS > 24h

### Fase 4: Interacción con usuarios (prioridad baja)

14. **Reportar problema** — Conectar botón con AedChangeProposal (REPORT_ISSUE)
15. **Change Proposals API** — Endpoints para proponer/revisar cambios
16. **Ownership Claims API** — Endpoints para reclamar/aprobar propiedad

---

## 14. Campos del Schema por Implementar

### Nuevos campos propuestos para modelo Aed

```prisma
// Opción A: Campos explícitos (requiere migración)
deactivation_reason   String?
deactivation_type     DeactivationType?  // TEMPORARY, PERMANENT, ERROR, DUPLICATE
expected_reactivation DateTime?

// Opción B: Usar status_metadata JSON existente (sin migración)
// status_metadata: { deactivation_reason, deactivation_type, expected_reactivation }
```

### Nuevos campos propuestos para AedOrganizationVerification

```prisma
// Para verificación técnica (Nivel 2)
verified_equipment    Boolean @default(false)
verified_maintenance  Boolean @default(false)
verified_expiry       Boolean @default(false)
```

---

## Notas de Diseño

- **Flexibilidad**: Cada organización verifica/edita solo lo que le compete. No hay un flujo rígido único.
- **Trazabilidad**: Todo cambio debe quedar registrado con quién, cuándo, por qué y desde qué organización. Hay gaps que corregir.
- **Gradualidad**: Un DEA puede publicarse con datos mínimos (LOCATION_ONLY) e ir mejorando con más verificaciones.
- **Reversibilidad**: Las acciones destructivas son soft-deletes con período de gracia. El cleanup actual pierde historial.
- **Independencia de niveles**: Los niveles de verificación son paralelos, no secuenciales.
- **Consistencia**: Todas las transiciones de estado y cambios de campo deben generar registros de auditoría uniformes.
