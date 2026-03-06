# AGENTS.md — Guía de Desarrollo para Agentes IA

Este documento establece las directrices **obligatorias** que deben seguir todos los agentes de IA (Claude Code, Copilot, etc.) al trabajar en el proyecto DeaMap. Es la fuente de verdad para convenciones, arquitectura, CI/CD y flujos de trabajo.

---

## 1. Checklist Pre-Commit (OBLIGATORIO)

Antes de dar por completada **cualquier** tarea o hacer commit:

### Web (raíz)

```bash
npm run lint:fix        # ESLint auto-fix → debe pasar sin errores
npm run build           # Next.js build → debe completarse sin errores
```

### Mobile (`mobile/`)

```bash
cd mobile
npm run lint            # ESLint → debe pasar sin errores
npm run type-check      # TypeScript → debe compilar sin errores
npm run build           # Vite build → debe generar dist/index.html
```

**No se puede completar ninguna tarea sin que estos comandos pasen.** Si un comando falla, corregir el error antes de continuar.

### Validación rápida (ambos proyectos)

```bash
npm run validate        # format:check + lint + type-check (solo web)
```

---

## 2. CI/CD Pipeline

### Estructura de Jobs

```
PR / Push a main|develop
    ↓
┌────────────────────────────────────────┐
│ migration-safety (solo PRs, 10min)     │
│ Detecta DROP TABLE, TRUNCATE, etc.     │
└────────────────────────────────────────┘
    ↓ (en paralelo)
┌──────────────┐ ┌────────────┐ ┌────────────────┐
│ quality      │ │ test       │ │ mobile-build   │
│ (15min)      │ │ (15min)    │ │ (15min)        │
│ type-check   │ │ unit tests │ │ type-check     │
│ lint         │ │ integration│ │ lint           │
│ format:check │ │            │ │ build (Vite)   │
└──────────────┘ └────────────┘ └────────────────┘
    ↓ (todos éxito)
┌────────────────────────────────────────┐
│ build (20min)                           │
│ Next.js production build                │
└────────────────────────────────────────┘
```

### Archivo: `.github/workflows/ci.yml`

- **Concurrency**: `cancel-in-progress: true` — cancela runs anteriores del mismo branch
- **Timeouts**: Cada job tiene `timeout-minutes` para evitar minutos desperdiciados
- **Caching**: npm cache por defecto en `actions/setup-node`

### Optimización de Costes

| Estrategia                    | Implementación                               | Ahorro                    |
| ----------------------------- | -------------------------------------------- | ------------------------- |
| Timeouts en todos los jobs    | `timeout-minutes: 10-20`                     | Evita jobs colgados       |
| Cancel in-progress            | `cancel-in-progress: true`                   | No duplica runs           |
| lint-staged en pre-commit     | Solo archivos staged                         | Menos errores llegan a CI |
| Android build condicional     | Solo en push a main con cambios mobile/      | No build en cada PR       |
| Vercel nativo                 | Next.js se despliega via Vercel, no desde CI | No duplica build          |
| Artifacts con retención corta | Debug APK 14d, Release 30d                   | Menos storage             |

---

## 3. Mobile Build & Release

### Workflow Android: `.github/workflows/build-android.yml`

**Triggers:**

- Push a `main` con cambios en `mobile/`
- Tags `mobile@*` (para release a Play Store)
- `workflow_dispatch` manual

**Jobs:**

1. **build-android** (45min timeout):
   - Node 22 + Java 21 + Gradle cache
   - `npm ci` + `npm run build` (Vite) + `npx cap sync android`
   - `./gradlew assembleDebug` (APK para testing)
   - `./gradlew bundleRelease` (AAB para Play Store)
   - Firma con secrets del repo
   - Upload artifacts

2. **deploy-play-store** (solo con tag `mobile@*`):
   - Download AAB firmado
   - Upload a Google Play (internal track)

### Secrets necesarios para Android

| Secret                             | Descripción                         |
| ---------------------------------- | ----------------------------------- |
| `ANDROID_SIGNING_KEY`              | Keystore en base64                  |
| `ANDROID_KEY_ALIAS`                | Alias de la key                     |
| `ANDROID_KEYSTORE_PASSWORD`        | Password del keystore               |
| `ANDROID_KEY_PASSWORD`             | Password de la key                  |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` | Service account para Play Store API |

### Flujo de Release Mobile

1. Editar `mobile/version.json` → incrementar versión (semver)
2. Ejecutar `node scripts/propagate-version.js` → sincroniza a package.json, build.gradle
3. Commit + push a main
4. `ensure-tags.yml` crea tag `mobile@x.y.z` automáticamente
5. `build-android.yml` se dispara con el tag → build + deploy a Play Store

---

## 4. Gestión de Versiones

### Source of Truth

Cada proyecto tiene su archivo `version.json`:

```
mobile/version.json    → { "version": "0.1.0" }  (app móvil)
package.json           → "version": "2.0.0"      (web, campo version)
```

### Reglas de Versionado

- **Semantic Versioning**: `MAJOR.MINOR.PATCH`
  - **MAJOR**: Cambios incompatibles (breaking changes)
  - **MINOR**: Nueva funcionalidad compatible
  - **PATCH**: Correcciones de bugs
- **Cada PR debe incrementar la versión** del proyecto afectado
- **Build number** (Android): `major * 10000 + minor * 100 + patch` (ej: 1.2.3 → 10203)

### Scripts de Versión

```bash
# Verificar que la versión fue incrementada respecto a main
node scripts/check-version-bump.js

# Propagar version.json → package.json, build.gradle, etc.
node scripts/propagate-version.js
```

### Auto-Tags: `.github/workflows/ensure-tags.yml`

En cada push a `main`:

- Lee `mobile/version.json` → crea tag `mobile@x.y.z` si no existe
- Lee `package.json` (root) → crea tag `web@x.y.z` si no existe
- Los tags disparan workflows de build/release automáticamente

---

## 5. Principios de Código

### 5.1 SOLID

- **S** (Single Responsibility): Cada clase/función tiene una única responsabilidad
- **O** (Open/Closed): Abierto para extensión, cerrado para modificación
- **L** (Liskov Substitution): Las implementaciones son intercambiables por sus interfaces
- **I** (Interface Segregation): Interfaces pequeñas y específicas (no "god interfaces")
- **D** (Dependency Inversion): Depender de abstracciones (ports), no de implementaciones concretas

### 5.2 Clean Code

- Funciones pequeñas con un propósito claro (max ~20 líneas ideal)
- Nombres descriptivos y significativos (sin abreviaciones crípticas)
- DRY: No duplicar código. Si algo se repite 3+ veces, extraer
- Preferir composición sobre herencia
- Minimizar complejidad ciclomática
- Código autodocumentado: el nombre de la función/variable ES la documentación

### 5.3 Cuándo usar comentarios

- Explicar decisiones de negocio complejas ("por qué", no "qué")
- Documentar limitaciones de APIs externas
- Workarounds temporales (con referencia al ticket/issue)
- JSDoc para APIs públicas exportadas
- **NUNCA**: Comentar código obvio, dejar código comentado, o "TODO" sin ticket

---

## 6. Domain-Driven Design (DDD)

### Estructura de capas

```
domain/           → Entidades, Value Objects, Events, Errors, Port interfaces
                    SIN dependencias externas (ni Prisma, ni HTTP, ni React)

application/      → Use Cases, DTOs
                    Orquesta dominio. Depende solo de interfaces del dominio

infrastructure/   → Repositories concretos, Services, Adapters, HTTP clients
                    Implementa las interfaces del dominio

interfaces/       → Controllers, API Routes, UI Components, Pages
(o presentation/)   Consume use cases. Capa más externa
```

### Reglas DDD

1. Las entidades de dominio **no** tienen dependencias externas
2. Los Value Objects son **inmutables** (usar `create()` factory, constructor privado)
3. Los repositorios se definen como **interfaces** en dominio, se implementan en infraestructura
4. Los Use Cases tienen un único método `execute()` con input tipado
5. Usar Domain Errors específicos del negocio (no lanzar Error genérico)
6. La capa de infraestructura **nunca** se importa directamente desde presentación
7. La inyección de dependencias se resuelve en un **composition root** (`di/container.ts`)

### Outside-In Development

Desarrollar siempre de fuera hacia dentro:

1. **Definir interfaz pública** (API route, componente, port)
2. **Escribir test** desde la perspectiva del consumidor
3. **Implementar use case** con mocks de repositorio
4. **Implementar dominio** (entidades, value objects)
5. **Implementar infraestructura** (repositorio concreto, HTTP client)

---

## 7. Testing

### Estrategia

| Tipo              | Framework  | Directorio                | Comando                          |
| ----------------- | ---------- | ------------------------- | -------------------------------- |
| Unit tests        | Vitest     | `tests/unit/`             | `npm run test:unit`              |
| Integration tests | Vitest     | `tests/integration/`      | `npm run test:integration`       |
| E2E tests         | Playwright | `tests/e2e/` (si existe)  | `npm run test:e2e`               |
| Mobile unit       | Vitest     | `mobile/src/**/*.test.ts` | `cd mobile && npm run test:unit` |

### Reglas de Testing

1. **Mocks para TODAS las dependencias externas** (DB, HTTP, filesystem)
2. **Patrón AAA**: Arrange → Act → Assert (separar con línea en blanco)
3. **Naming**: `should[ExpectedBehavior]When[Condition]`
4. **Tests independientes**: No compartir estado mutable entre tests
5. **Un assert por test** (o asserts del mismo concepto)

### Ejemplo

```typescript
describe("LoginUseCase", () => {
  it("shouldReturnUserWhenCredentialsAreValid", async () => {
    // Arrange
    const mockAuthRepo = {
      login: vi.fn().mockResolvedValue({ user: mockUser, token: "abc" }),
    } as unknown as IAuthRepository;
    const useCase = new LoginUseCase(mockAuthRepo);

    // Act
    const result = await useCase.execute({ email: "test@test.com", password: "Pass123!" });

    // Assert
    expect(result.user.email).toBe("test@test.com");
    expect(mockAuthRepo.login).toHaveBeenCalledOnce();
  });
});
```

---

## 8. Estructura del Proyecto

```
DeaMap/
├── src/                        # Web app (Next.js 15)
│   ├── app/                    # App Router (pages + API routes)
│   ├── components/             # React components
│   ├── lib/                    # Shared utilities (db, jwt, auth)
│   │   ├── auth.ts             # Auth helpers (requireAuth, requireAdmin, requireAdminOrAedPermission)
│   │   ├── audit.ts            # Audit trail helpers (recordStatusChange, recordFieldChange, appendInternalNote)
│   │   ├── aed-status.ts       # AED status state machine (validateStatusTransition)
│   │   └── organization-permissions.ts  # Org permission checks (getUserPermissionsForAed, checkAssignmentConflict)
│   ├── import/                 # DDD module: CSV import
│   │   ├── domain/
│   │   ├── application/
│   │   └── infrastructure/
│   ├── batch/                  # Batch processing system
│   └── types/                  # TypeScript type definitions
│
├── mobile/                     # Mobile app (Ionic React + Capacitor)
│   └── src/
│       ├── domain/             # Models + Port interfaces (puro TS)
│       ├── application/        # Use Cases + DTOs
│       ├── infrastructure/     # HTTP client, repositories, storage
│       └── presentation/       # Pages, components, hooks, navigation
│
├── prisma/
│   ├── schema.prisma           # Database schema (PostgreSQL + PostGIS)
│   └── migrations/             # NUNCA modificar migraciones existentes
│
├── scripts/                    # Utilidades y scripts de mantenimiento
├── tests/                      # Tests web (unit + integration)
└── .github/
    ├── workflows/              # GitHub Actions CI/CD
    └── dependabot.yml          # Dependency updates automation
```

---

## 9. Convenciones

### Commits (Conventional Commits)

```
type(scope): descripción corta

Tipos: feat, fix, refactor, test, docs, chore, ci, perf
Scopes: mobile, api, auth, import, batch, db, ci, deps

Ejemplos:
  feat(mobile): add offline map caching
  fix(api): correct CORS headers for Capacitor origins
  chore(deps): bump next from 15.0.0 to 15.1.0
  ci: add Android build workflow
  refactor(import): extract validation to value object
```

### Branches

```
feat/nombre-descriptivo     → Nueva funcionalidad
fix/nombre-descriptivo      → Corrección de bug
refactor/nombre-descriptivo → Refactoring
chore/nombre-descriptivo    → Tareas de mantenimiento
ci/nombre-descriptivo       → Cambios en CI/CD
```

### TypeScript

- **Strict mode** habilitado (`"strict": true`)
- Preferir `interface` sobre `type` para objetos
- Usar `type` para unions, intersections, mapped types
- Type imports: `import type { Foo } from "./foo"`
- No usar `any` (usar `unknown` + type guards si es necesario)
- Variables no usadas deben empezar con `_` (ej: `_unused`)
- Preferir `const` sobre `let`, nunca usar `var`

### ESLint + Prettier

**Web (raíz)**:

- ESLint: `eslint.config.mjs` (flat config, ESLint 9)
- Prettier: `.prettierrc` (100 chars, double quotes, trailing commas ES5)
- Ignora: `.next/`, `node_modules/`, `scripts/`, `prisma/`, `mobile/`

**Mobile**:

- ESLint: `mobile/eslint.config.js` (flat config)
- Prettier: `mobile/.prettierrc` (misma config que web)
- Ignora: `dist/`

---

## 10. Base de Datos (Prisma + PostgreSQL + PostGIS)

### Reglas de Migraciones (CRÍTICO)

1. **NUNCA** modificar una migración existente (Prisma verifica checksums → rompe producción)
2. **NUNCA** usar `DROP TABLE`, `DROP COLUMN`, `TRUNCATE`, `DELETE FROM` sin aprobación explícita
3. Usar `IF NOT EXISTS` / `IF EXISTS` guards donde sea posible
4. Nuevas columnas deben tener `DEFAULT` sensible
5. El CI (`migration-safety` job) detecta operaciones destructivas automáticamente
6. Las migraciones se ejecutan alfabéticamente por nombre de directorio

### Comandos de Base de Datos

```bash
npm run db:migrate:dev    # Crear nueva migración (desarrollo)
npm run db:migrate        # Aplicar migraciones (producción)
npm run db:studio         # Abrir Prisma Studio (GUI)
npm run db:seed:dummy     # Seed con datos de prueba (500 DEAs)
npm run db:branch:check   # Verificar base de datos de branch
```

### Branch Database System

Las ramas feature en Vercel obtienen bases de datos PostgreSQL aisladas:

- Gestionadas por `scripts/branch-database.js` y `scripts/migrate.js`
- Seed automático con 500 DEAs y usuarios de prueba
- Credenciales test: `admin@deamap.es` / `123456`

---

## 11. Frontend

### Web (Next.js 15 + React 19)

- **Server Components** por defecto. Solo usar `'use client'` cuando sea necesario
- **App Router**: Todas las rutas en `src/app/`
- **Optimización de imágenes**: Usar `next/image`
- **Suspense boundaries** para mejor UX en cargas
- **Mobile-first** con Tailwind CSS

```typescript
// Breakpoints Tailwind
sm: "640px"; // Mobile landscape
md: "768px"; // Tablet
lg: "1024px"; // Desktop
xl: "1280px"; // Large desktop
```

### Mobile (Ionic React + Capacitor)

- **Clean Architecture**: domain → application → infrastructure → presentation
- **Leaflet** para mapas (mismo que web, funciona en WebView). **NO** MapKit/Google Maps nativos. No se necesita `com.apple.developer.maps` en iOS
- **Capacitor Preferences** para token storage (SharedPreferences/UserDefaults)
- **Bearer token auth** (no cookies, Capacitor WebView no las comparte)
- **HTTP en nativo**: `CapacitorHttp.request()` llamado DIRECTAMENTE (no fetch-patching). `CapacitorHttp: { enabled: false }` en capacitor.config.ts. En web/dev se usa `fetch` estándar vía Vite proxy
- **Legacy support**: `@vitejs/plugin-legacy` con targets `Chrome >= 61, Android >= 5` + polyfill `globalThis` en index.html para WebViews antiguos

**Scripts de desarrollo:**

```bash
cd mobile
npm run dev               # Servidor Vite local
npm run android:live      # Live reload en dispositivo Android
npm run ios:live          # Live reload en dispositivo iOS
npm run android           # Build + deploy a dispositivo (producción)
npm run android:open      # Abrir Android Studio
npm run ios:open          # Abrir Xcode
```

---

## 12. Despliegue

### Web → Vercel (automático)

- Vercel detecta push a `main` y despliega automáticamente
- Build: `node scripts/migrate.js && next build`
- PRs obtienen preview deployments con URL única
- Branches feature obtienen base de datos aislada
- Cron: `/api/cron/process-waiting-jobs` cada minuto
- Config: `vercel.json` (timeouts, headers de seguridad, rewrites)

### Mobile → Google Play Store (via GitHub Actions)

- Crear tag `mobile@x.y.z` → dispara build + deploy automático
- Track: `internal` por defecto (testing), promover manualmente a producción
- Requiere secrets configurados en el repo (ver sección 3)

---

## 13. Reglas Clave para Agentes IA (Resumen Ejecutivo)

### SIEMPRE hacer:

- Ejecutar `npm run lint:fix` y `npm run build` antes de dar por terminada una tarea
- En mobile: ejecutar también `npm run lint` y `npm run type-check`
- Seguir SOLID, DDD y Clean Architecture en todo código nuevo
- Usar mocks en tests, patrón AAA, naming descriptivo
- Conventional Commits para mensajes de commit
- Verificar que las migraciones no son destructivas

### NUNCA hacer:

- Modificar migraciones existentes de Prisma
- Usar `any` en TypeScript (usar `unknown` + type guards)
- Importar implementaciones concretas desde capas superiores (violar DIP)
- Dejar código comentado o TODOs sin ticket
- Crear archivos innecesarios (preferir editar existentes)
- Hacer commit sin que lint y build pasen

### Prioridades:

1. **Corrección**: El código funciona correctamente
2. **Seguridad**: Sin vulnerabilidades (OWASP top 10)
3. **Simplicidad**: La solución más simple que funcione
4. **Mantenibilidad**: Código limpio, testeable, documentado por nombres
5. **Performance**: Solo optimizar cuando sea necesario y medido

---

## 14. Decisiones Arquitectónicas (Historial)

### Mobile — HTTP y WebView

**Problema:** El `hostname: "deamap.es"` en capacitor.config.ts (necesario para autofill de credenciales) hace que el WebView intercepte TODAS las peticiones a `https://deamap.es/*` como assets locales. `CapacitorHttp: { enabled: true }` NO intercepta peticiones al mismo hostname — las trata como "locales". Resultado: las API calls devuelven `index.html` (SPA fallback) en vez de JSON.

**Solución:** `HttpClient` usa `CapacitorHttp.request()` directamente en nativo (bypass total del WebView). En web/dev, `fetch` estándar vía Vite proxy. `CapacitorHttp: { enabled: false }`.

### Mobile — DDD Ports

**Ports creados:** `IHttpClient`, `IGeolocationService`, `IReverseGeocodeService`, `IAuthRepository`, `IAedRepository`.
**Regla:** Infraestructura nunca se importa desde presentation. Todo se resuelve en `mobile/src/infrastructure/di/container.ts`.

### Mobile — React Performance

- `React.memo` en markers de mapa (DeaMarker, ClusterMarker)
- `useMemo` para refs estables (center, event handlers)
- `useRef` para valores usados en effects (evita eslint-disable de exhaustive-deps)
- `requestIdRef` pattern para evitar stale data en hooks async (useAedDetail)

### Mobile — Value Objects

- `Password`: Valida reglas de contraseña. Método estático `Password.validate(password): string[]`
- Los VO se ubican en `mobile/src/domain/models/`

### Backend — Seguridad

- **requireAuth** lanza `AuthError` (nunca retorna null). No necesita null-check después. **NUNCA** añadir `if (!user)` / `if (!admin)` después de requireAuth/requireAdmin — es dead code.
- **requireAdmin** envuelve requireAuth + role check. Usar en rutas admin en vez de check manual.
- **requireAdminOrAedPermission**: Permite a miembros de organización con permisos específicos (can_edit, can_verify) acceder a rutas admin de DEAs asignados a su organización. Devuelve `{ user, isGlobalAdmin, permissions }`.
- **Image proxy**: requiere auth (NO en PUBLIC_PATHS). Previene SSRF.
- **PATCH endpoints**: deben usar allowlist de campos. Previene mass-assignment. Admin DEA PATCH usa constantes `TRACKABLE_AED_FIELDS` + `UNTRACKED_AED_FIELDS` = `ALLOWED_AED_FIELDS`.
- **Rate limiting**: usar `createRateLimiter()` de `src/lib/rate-limit.ts`. No crear rate limiters artesanales.
- **API errors**: usar `apiError()` de `src/lib/api-error.ts`. No exponer `error.message` en producción.

### Backend — Transacciones y Audit Trail

- **Transacciones**: TODAS las operaciones multi-write DEBEN usar `prisma.$transaction()`. I/O de red (S3 uploads, image downloads) va FUERA de la transacción; solo DB writes van DENTRO.
- **Audit trail**: Usar helpers centralizados de `src/lib/audit.ts`:
  - `recordStatusChange(tx, params)` — registra cambios de estado de AED
  - `recordFieldChange(tx, params)` — registra cambios de campos individuales
  - `appendInternalNote(currentNotes, text, type, author)` — construye array de notas internas (compatible con JSON de Prisma)
  - Todos aceptan `AuditTxClient` interface (funciona con prisma y con tx client dentro de transacción)
- **AED Status State Machine**: Usar `validateStatusTransition()` de `src/lib/aed-status.ts` antes de cualquier cambio de estado. Transiciones válidas: DRAFT→PENDING_REVIEW→PUBLISHED→INACTIVE, PUBLISHED→PENDING_REVIEW (re-verificación), REJECTED→DRAFT.

### Backend — Permisos de Organización

- `getUserPermissionsForAed()` en `src/lib/organization-permissions.ts` verifica membresía en organización + flags (can_edit, can_verify, can_approve).
- `checkAssignmentConflict()` valida conflictos de asignación (ownership, maintenance, civil protection).
- Los permisos se basan en **flags** del `OrganizationMember` (can_edit, can_verify), no en el rol directamente.

### Backend — SES/S3 Singletons

`getS3Client()` y `getSESClient()` siguen patrón singleton (lazy init). No crear clientes por cada request.

### CI/CD

- **GitHub Actions**: third-party actions pinneadas a commit SHA (no tags)
- **Prettier**: gate duro en CI (sin `continue-on-error`)
- **Version sync**: `scripts/propagate-version.js --check` en job quality
- **moduleResolution**: `"Bundler"` en tsconfigs mobile (ESM + Vite)

### Mobile — Compatibilidad

- **`globalThis` polyfill**: Inline en `index.html` antes del bundle. Necesario para WebViews Android pre-Chrome 71.
- **`@vitejs/plugin-legacy`**: Targets `Chrome >= 61, Android >= 5` para máxima compatibilidad.

### Mobile — Auth/UX Flow

**Problema:** El perfil redirigía a páginas standalone (`/login`, `/register`) lo que causaba una navegación fragmentada y poco fluida. El usuario perdía el tab bar al navegar. Se usaban iconos de Ionicons (`heartCircle`, `heartOutline`) como "logo" de la app, dando aspecto de branding ajeno.

**Solución:**

- **Formulario inline en ProfileTabPage**: Login y registro embebidos directamente en el tab Perfil con un toggle "¿No tienes cuenta? / ¿Ya tienes cuenta?". El usuario nunca sale de la navegación con tabs.
- **Branding propio**: Se usa `/icon-96x96.png` (icono de la app) en lugar de Ionicons genéricos como logotipo.
- **LoginPage / RegisterPage simplificadas**: Se mantienen como fallback para AuthGuard redirects y deep links, pero el flujo principal es el inline en el tab Perfil.
- **Sin navegación a páginas externas**: Tras login/register exitoso, el AuthContext se actualiza y el ProfileTabPage muestra automáticamente el perfil del usuario (no `history.push`).

### Release — Versionado iOS

**Problema:** `propagate-version.js` solo sincronizaba Android (build.gradle). Las versiones iOS en `project.pbxproj` (`MARKETING_VERSION`, `CURRENT_PROJECT_VERSION`) eran manuales y estaban desincronizadas.

**Solución:** `propagate-version.js` ahora propaga también a iOS:

- `MARKETING_VERSION` = version semver (ej: `1.0.0`)
- `CURRENT_PROJECT_VERSION` = build number con misma fórmula que Android (`major×1M + minor×1K + patch`)
- Funciona tanto en modo propagación como en `--check` (CI)

### Release — iOS CI/CD

**Decisión:** Firma manual con p12 + provisioning profile en GitHub Secrets (no Fastlane match).
**Razón:** Más simple, sin dependencias Ruby, mapea al patrón ya usado en Android.

**Workflow** `.github/workflows/build-ios.yml`: 3 jobs (build-ios, deploy-testflight, create-release) — misma estructura que Android.

- `macos-15` runner con Xcode 16.2
- Override de firma en xcodebuild CLI (no se modifica el pbxproj → desarrollo local sigue con Automatic signing)
- Keychain temporal con cleanup
- SPM package cache
- El job `create-release` es idempotente con `softprops/action-gh-release` — complementa el release creado por Android

**Secrets iOS requeridos:** `IOS_CERTIFICATE_P12_BASE64`, `IOS_CERTIFICATE_PASSWORD`, `IOS_PROVISIONING_PROFILE_BASE64`, `IOS_TEAM_ID`, `APP_STORE_CONNECT_API_KEY_ID`, `APP_STORE_CONNECT_API_ISSUER_ID`, `APP_STORE_CONNECT_API_KEY_BASE64`

### Release — Flujo Completo

```
mobile/version.json → propagate-version.js → package.json + build.gradle + project.pbxproj
push a main → ensure-tags.yml → tag mobile@x.y.z
tag → build-android.yml (Play Store internal) + build-ios.yml (TestFlight)
probar → promover a producción manualmente
```
