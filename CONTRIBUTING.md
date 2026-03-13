# Contributing to DeaMap

Thanks for your interest in contributing to DeaMap! This platform helps emergency services locate defibrillators and is actively used by SAMUR-Protección Civil Madrid and Civil Protection teams across Andalusia.

## Quick start (< 5 minutes)

### Prerequisites

- **Node.js 18+**
- **PostgreSQL** with the **PostGIS** extension
- **npm**

### Setup

```bash
# 1. Fork and clone
git clone https://github.com/<your-username>/DeaMap.git
cd DeaMap

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env with your DATABASE_URL (PostgreSQL + PostGIS)

# 4. Run migrations and seed
npx prisma migrate deploy
npm run db:seed:dummy    # Seeds 500 test DEAs + test users

# 5. Start dev server
npm run dev
```

Test credentials: `admin@deamap.es` / `123456`

## Finding something to work on

- **[`good first issue`](https://github.com/GlobalEmergency/DeaMap/labels/good%20first%20issue)** — Scoped tasks ideal for your first contribution
- **[`help wanted`](https://github.com/GlobalEmergency/DeaMap/labels/help%20wanted)** — Broader tasks where we need community help

Comment on the issue to let us know you're working on it. We'll assign it to you and help if you get stuck.

## Architecture

DeaMap uses **Domain-Driven Design (DDD)** with a layered architecture:

```
src/
├── app/              → Next.js App Router (pages + API routes)
├── components/       → React components
├── lib/              → Shared utilities (auth, audit, db)
├── import/           → DDD module (domain / application / infrastructure)
├── batch/            → Batch processing system
└── types/            → TypeScript type definitions

mobile/src/
├── domain/           → Models + Port interfaces (pure TypeScript)
├── application/      → Use Cases + DTOs
├── infrastructure/   → HTTP clients, repositories, storage adapters
└── presentation/     → Pages, components, hooks

tests/
├── unit/             → Vitest unit tests
├── integration/      → Vitest integration tests
└── e2e/              → Playwright end-to-end tests
```

### Key principles

- **SOLID** — Single responsibility, dependency inversion, interface segregation
- **Clean Code** — Small functions, descriptive names, no dead code
- **DDD layers** — Domain has zero external dependencies. Infrastructure implements domain interfaces. Presentation never imports infrastructure directly.
- **Outside-In development** — Define the interface → write the test → implement use case → implement domain → implement infrastructure

## Code conventions

### TypeScript

- Strict mode enabled — no `any` (use `unknown` + type guards)
- Prefer `interface` for objects, `type` for unions/intersections
- Use `import type { ... }` for type-only imports
- `const` over `let`, never `var`

### Commits (Conventional Commits)

```
feat(scope): add new feature
fix(scope): correct a bug
refactor(scope): restructure without changing behavior
test(scope): add or update tests
docs(scope): documentation changes
chore(scope): maintenance tasks

Scopes: mobile, api, auth, import, batch, db, ci, deps
```

### Branches

```
feat/descriptive-name
fix/descriptive-name
refactor/descriptive-name
```

## Testing

All PRs must pass the test suite. We use the **AAA pattern** (Arrange → Act → Assert) and mock all external dependencies.

```bash
npm run test:unit          # Unit tests
npm run test:integration   # Integration tests
npm run test:e2e           # End-to-end (Playwright)
```

Test naming: `should[ExpectedBehavior]When[Condition]`

## Pull request workflow

1. **Create a branch** from `main` following the naming convention above
2. **Make your changes** following the architecture and code conventions
3. **Run the validation suite** before pushing:

```bash
npm run lint:fix           # ESLint auto-fix
npm run build              # Must complete without errors
```

For mobile changes, also run:

```bash
cd mobile
npm run lint
npm run type-check
npm run build
```

4. **Open a PR** with a clear description of what you changed and why
5. **Link the issue** you're addressing (e.g., "Closes #42")

We review PRs promptly and will provide constructive feedback. Don't worry about getting everything perfect on the first try — that's what reviews are for.

## Database migrations

If your PR includes schema changes:

- **Never** modify an existing migration (Prisma verifies checksums)
- **Never** use destructive operations (`DROP`, `TRUNCATE`, `DELETE FROM`) without explicit approval
- Use `IF NOT EXISTS` / `IF EXISTS` guards where possible
- New columns must include sensible `DEFAULT` values

The CI pipeline has a `migration-safety` job that automatically flags destructive operations.

## Project structure at a glance

| Component | Tech | Description |
|-----------|------|-------------|
| Web app | Next.js 15, React 19, Tailwind | Main platform — map, admin panel, import |
| Mobile app | Ionic React, Capacitor | iOS/Android app with offline support |
| Database | PostgreSQL + PostGIS, Prisma | Geospatial AED data, users, organizations |
| Maps | Leaflet + MarkerCluster | Interactive AED visualization |
| CI/CD | GitHub Actions, Vercel | Automated testing, building, deployment |

## Questions?

Open a [Discussion](https://github.com/GlobalEmergency/DeaMap/discussions) or comment on any issue. We're happy to help you get started.

---

**Every contribution helps save lives.** 💚
