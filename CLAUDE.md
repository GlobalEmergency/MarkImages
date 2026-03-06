# CLAUDE.md — Project Rules for DeaMap

## Project Overview

DeaMap is an AED (Automated External Defibrillator) management platform built with Next.js 15, Prisma ORM, and PostgreSQL with PostGIS. It uses Domain-Driven Design (DDD) architecture for the import module.

## Mandatory Rules

### Database Migrations (CRITICAL)

- **NEVER** create migrations that drop tables, columns, indexes, or constraints without explicit approval
- **NEVER** modify an existing migration file — Prisma verifies checksums and this will break production deployments
- **NEVER** use `DELETE FROM`, `TRUNCATE`, or `ALTER COLUMN ... TYPE` in migrations without explicit approval
- All new migrations must use `IF NOT EXISTS` / `IF EXISTS` guards where possible
- New migrations adding columns must use sensible `DEFAULT` values to avoid breaking existing rows
- The CI pipeline (`migration-safety` job) automatically detects destructive operations and blocks/warns on PRs
- When creating migrations that depend on other tables, verify the execution order (Prisma runs migrations alphabetically by directory name)

### Testing

- All PRs must pass the test suite (unit + integration)
- Tests are run with Vitest (not Jest). E2E tests use Playwright and are separate
- When modifying domain entities or value objects, update corresponding tests in `tests/`

### Code Style

- TypeScript strict mode is enabled
- ESLint and Prettier are configured — run `npm run lint` and `npm run format:check`
- Pre-commit hooks run type-check, lint, and build automatically

### API Route Patterns (IMPORTANT)

- **Auth helpers throw, never return null**: `requireAuth()` and `requireAdmin()` throw `AuthError`. NEVER add `if (!user)` / `if (!admin)` null checks after calling them — that's dead code.
- **Transactions**: ALL multi-write DB operations MUST use `prisma.$transaction()`. Network I/O (S3, downloads) goes OUTSIDE the transaction; only DB writes go INSIDE.
- **Audit trail**: Use shared helpers from `src/lib/audit.ts` — `recordStatusChange()`, `recordFieldChange()`, `appendInternalNote()`. Do NOT create inline `aedStatusChange.create()` or `aedFieldChange.create()` calls.
- **Status changes**: Always validate with `validateStatusTransition()` from `src/lib/aed-status.ts` before changing AED status.
- **Org permissions**: Use `requireAdminOrAedPermission()` for admin DEA routes that org members with specific flags (can_edit, can_verify) should access.
- **Field allowlists**: Admin DEA PATCH uses `TRACKABLE_AED_FIELDS` + `UNTRACKED_AED_FIELDS` = `ALLOWED_AED_FIELDS` constants. Do NOT duplicate field lists.

## Architecture

### Tech Stack

- **Framework**: Next.js 15 (App Router)
- **ORM**: Prisma with PostgreSQL + PostGIS
- **Auth**: JWT tokens via `jose` library, bcrypt for passwords
- **Maps**: Leaflet with MarkerCluster
- **Testing**: Vitest (unit/integration), Playwright (e2e)

### Directory Structure

```
src/
├── app/              # Next.js App Router (pages + API routes)
├── components/       # React components
├── lib/              # Shared utilities (db, jwt, auth, etc.)
│   ├── auth.ts       # Auth: requireAuth, requireAdmin, requireAdminOrAedPermission
│   ├── audit.ts      # Audit trail: recordStatusChange, recordFieldChange, appendInternalNote
│   ├── aed-status.ts # Status state machine: validateStatusTransition
│   └── organization-permissions.ts # Org permissions: getUserPermissionsForAed
├── import/           # DDD module for CSV import
│   ├── domain/       # Entities, Value Objects, Repository interfaces
│   ├── application/  # Use Cases
│   └── infrastructure/ # Prisma implementations
├── batch/            # Batch processing system
└── types/            # TypeScript type definitions

prisma/
├── schema.prisma     # Database schema
├── migrations/       # Prisma migrations (NEVER modify existing ones)
└── seed-dummy.ts     # Dummy data seeder for branch databases

scripts/
├── migrate.js        # Migration runner with branch database support
└── branch-database.js # Branch-specific database management
```

### Key Domain Concepts (Import Module)

- **CsvPreview**: Value Object — `create(headers: string[], sampleRows: string[][], totalRows: number)`
- **ValidationResult**: Value Object — `create(errors, warnings, stats)`, `withIssues()`, `success()`, `empty()`
- **ValidationError**: Value Object — `create({row, field, value, errorType, message, severity})`
- **ImportSession**: Entity — State machine: PREVIEW → MAPPING → VALIDATING → READY → IMPORTING → COMPLETED
- **ColumnMapping**: Value Object — Maps CSV columns to database fields

### Branch Database System

- Feature branches on Vercel get isolated PostgreSQL databases
- Managed by `scripts/branch-database.js` and `scripts/migrate.js`
- New branch databases are seeded with 500 dummy DEAs and test users
- Test credentials: `admin@deamap.es` / `123456`

## Commands

```bash
npm run dev              # Start development server
npm run build            # Production build
npm run type-check       # TypeScript check
npm run lint             # ESLint
npm run format:check     # Prettier check
npm run test:unit        # Unit tests (Vitest)
npm run test:integration # Integration tests (Vitest)
npm run test:e2e         # E2E tests (Playwright)
```
