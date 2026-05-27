# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) and other AI agents when working in this repository.

## Project Overview

StorePilot is a Turborepo monorepo using Bun as the runtime and package manager. The web SPA talks to a Bun + Elysia API through a fully-typed Eden Treaty bridge. Validation uses **Zod** (not Elysia TypeBox). Persistence is **SQLite** via `bun:sqlite` + Drizzle ORM. Background work runs on **RabbitMQ** (via `rabbitmq-client`), launched from Docker.

## Commands

```bash
# Development
bun dev                              # Full stack (API + web + SDK watcher)
bun --filter web dev                 # Web app only
bun --filter @store-pilot/api dev    # API only

# Quality checks
bun check                            # Format check + oxlint + typecheck (run before committing)
bun lint                             # Oxlint + typecheck
bun typecheck                        # TypeScript only
bun format                           # Prettier write
bun fmt                              # format + lint --fix + typecheck

# Testing
bun api:test:e2e                     # API integration tests (Eden Treaty)
bun ui:test:e2e                      # UI E2E tests (Playwright)

# Database (SQLite / Drizzle)
bun --filter @store-pilot/api db:generate   # Generate migrations from src/db/schema.ts
bun --filter @store-pilot/api db:migrate     # Apply migrations
bun --filter @store-pilot/api db:studio      # Drizzle Studio

# Docker / Queue (RabbitMQ)
bun docker:up                        # Start RabbitMQ (waits for healthy); UI at :15672
bun docker:down                      # Stop services
bun docker:rm-all                    # Nuclear: wipe all store-pilot- containers + volumes

# SDK
bun build:sdk                        # Rebuild API SDK exports (auto-runs on postinstall)
```

## Architecture

```
apps/
  web/              # React 19 SPA (Vite, TanStack Router)
packages/
  api/              # Bun + Elysia HTTP API (SQLite + Drizzle)
  ui/               # Shared component library (@repo/ui) - shadcn/ui + Tailwind v4
  tsconfig/         # Shared TS configs
```

## API (packages/api)

Organized by domain modules in `src/modules/`. Each module follows a layered pattern:

- `*.routes.ts` — Elysia route plugins with **Zod (`z`) validation** (OpenAPI via `mapJsonSchema: { zod }`)
- `*.service.ts` — Business logic
- `*.repository.ts` — Data access (Drizzle queries)

Key conventions:

- **Errors** — Throw `AppError` via helpers: `badRequest()`, `notFound()`, `conflict()`, etc. The error plugin in `@core/errors` translates to JSON envelopes — no manual try/catch for response mapping.
- **Config/Logging** — Use `@core/env` and `@core/logger`. Never `Bun.env` or `console.*` in feature modules.
- **Telemetry** — `record()` for spans, `emitMetric()` for metrics, `withTraceContext()` for distributed tracing.
- **API payloads** — snake_case to match clients.
- **Database** — SQLite via Drizzle ORM. Import `db` from `@api/db/client`; define tables in `src/db/schema.ts`.
- **Migrations** — Generated into `src/db/migrations/`, applied with `bun --filter @store-pilot/api db:migrate` (also run on API startup via `setupApi`).
- **Validation** — Zod schemas; never Elysia TypeBox `t.*`.
- **Queues** — RabbitMQ via `@api/modules/queue` (`publish()` / `consume()`); trace context propagates across queue boundaries. Register consumers in `src/workers.ts` (`bun dev` runs the worker alongside the server). Connections are lazy, so `bun dev` works without the broker until a queue is actually used.
- **Testing** — Eden Treaty for E2E; preload `./src/test/setup.ts`. Avoid awaiting `Bun.sleep` inside `beforeAll` (breaks bun:test hook completion in 1.3.x).

## Web App (apps/web)

Feature modules in `src/modules/`, file-based routing in `src/routes/`.

Key conventions:

- **Data fetching** — Eden Treaty client (`storePilotApi.module.endpoint.get()`), never `useEffect` for fetching long-term. Use `apiCall<T>(...)` to extract typed data and propagate errors. Optional Zod parse via the second arg.
- **Types** — Import API types from `@store-pilot/api/client` (and feature subpaths as they're added).
- **Testing** — `data-testid` attributes for Playwright selectors.

## Shared UI (packages/ui)

- `shadcn/` — Radix UI primitives styled with Tailwind v4 tokens. Internal imports use **relative paths** (e.g. `../lib/utils`), not `@/`, so consumers' `tsc` resolves them.
- `components/` — Business components (added as project grows)
- `hooks/` — Custom React hooks
- `lib/utils.ts` — `cn()` for class merging
- `styles/index.css` — Tailwind v4 `@theme` tokens (no `tailwind.config.ts`)

## API SDK Exports

The API package exports typed subpath modules (`@store-pilot/api/client`, `@store-pilot/api/core`, etc.) built by tsup. The web app consumes these for type-safe API integration.

**Critical**: when adding a new API module, follow the three-step recipe — add the file to `src/sdk/<name>.ts`, the entry to `tsup.config.ts`, and the entry to `packages/api/package.json` `exports`. The `apps/web/src/__sdk-smoke.ts` file is permanent and enforces this contract at typecheck time. Don't delete it.

## Path Aliases

```
@/*           → apps/web/src/                       (web app)
@repo/ui      → packages/ui                         (UI components, via exports)
@store-pilot/api/* → packages/api/dist/* (built)    (API SDK subpaths)
@api/*        → packages/api/src/                   (within api package)
@core/*       → packages/api/src/modules/core/      (API core utilities)
```

> Note: package tsconfigs use `paths` **without** `baseUrl` (the oxlint type-aware engine / tsgo has removed `baseUrl` support).

## Code Style

- **Linter**: Oxlint (not ESLint) — config in `.oxlintrc.json`
- **Formatter**: Prettier with import sorting and Tailwind class ordering
- **TypeScript**: Use `import type` for type-only imports (enforced by oxlint)

## Environment & Conventions

- **Dev vs prod conditionals**: always via `config.isProduction` / `isDevelopment` / `isTest` from `@core/env` in the API, and `webEnv.app.isProduction` in the web. Never read `process.env.NODE_ENV` directly in feature modules.
- **Dev-only routes**: gate at the route-registration level with `if (!config.isProduction)`, not inside the handler.
- **OpenAPI docs**: served at `/docs` in non-production only.

```

```
