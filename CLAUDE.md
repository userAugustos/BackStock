# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) and other AI agents when working in this repository.

## Project Overview

BackStock is a Turborepo monorepo using Bun as the runtime and package manager. The web SPA talks to a Bun + Elysia API through a fully-typed Eden Treaty bridge. Validation uses **Zod** (not Elysia TypeBox). Persistence is **SQLite** via `bun:sqlite` + Drizzle ORM. Background work runs on **RabbitMQ** (via `rabbitmq-client`), launched from Docker.

## Mandatory Rules

> **These rules are MANDATORY.** They exist so that agents **at minimum do not produce bugs**. They are not suggestions. You MUST follow them exactly; when a rule conflicts with convenience or speed, the rule wins. Violating any rule below means the work is not done.

### Frontend — React (MANDATORY)

**Guiding philosophy: AVOID COMPLEXITY. AVOID REACT. USE THE BROWSER / HTML / WEB-API. Use _everything_ a library gives you natively — everything — so you avoid doing the work yourself and avoid writing bugs.**

- **State machines (UI) are for FLOW CONTROL ONLY.** A UI state machine MUST only express two things: (1) which screen/view is active right now, and (2) which events fire on user interaction. State machines MUST NEVER derived data, or server state. If a machien it's needed, it's needed to have a state, a context, events and determine transition.
- **Forms: React Hook Form + Zod, ALWAYS.** Every form MUST use `react-hook-form` with a Zod schema via `@hookform/resolvers/zod`. You MUST create the schema and USE everything the library provides — validation, error display, error **reset/clearing**, `reset()`, dirty/touched state. NEVER hand-roll form state, validation, or error handling.
- **AVOID use `useEffect`.** Not for data, not for derivations, not for syncing state. (Fetching → TanStack Query; derived values → compute during render.)
- **Shared state → Zustand.** If state is shared across components, it MUST live in a Zustand store. Do not prop-drill or lift state ad hoc.
- **More than 2 related states → `useReducer`.** If a component needs more than two related pieces of state, you MUST use a reducer — never a pile of `useState`.
- **NO open/closed `useState`.** You almost never need it — native web-API / shadcn (Radix) components manage open/closed themselves. Use the component's built-in state.
- **NO hand-built loading states.** You never need them — TanStack Query gives you `isPending` / `isLoading` / `isFetching` consistently. Use those.
- **`data-testid` is MANDATORY** on every element a test selects (Playwright).
- **`npx react-doctor@latest` is MANDATORY after UI work.** When UI development is finished you MUST run `npx react-doctor@latest`, then read and resolve every issue it reports. UI work is NOT done until react-doctor is clean.

### API & Testing (MANDATORY — TDD)

- **The API MUST be deterministic.** Same inputs → same outputs, every time.
- **NEVER fake a test.** Never write a test that asserts nothing, mocks away the thing under test, or is rigged to pass. If you cannot make a test pass honestly, you MUST report the failing test to the user. **Reporting a failing test is always better than faking a passing one.**
- **Analyze failing e2e test without bias towards the code.** When an e2e test fails, check if the test path is right and if the **the code implementation is wrong**. If the test is right and makes sense for the feature. Fix the code; do not weaken the test to make it green.
- **Work in TDD mode.** Before writing implementation code you MUST establish, in order:
  - **a.** This is the **feature** we want.
  - **b.** These are the **possible paths** for this feature (happy + edge + failure).
  - **c.** These are the **tests** needed to cover those paths.
  - Once you have a + b + c, you have everything you need to code: write the tests first, then the implementation.
- **Test everything.** Every feature gets **e2e tests** (if possible, Eden Treaty, real server). Every utility with real logic gets a **unit test**. No path ships untested.

### Pull Requests & Delivery (MANDATORY)

- **One PR per build-sequence step** (`PLAN.md` §16 — Build sequence). One sequence = one PR.
- **Stack the PRs.** Each PR MUST point to (target) the **previous step's branch**, not `main` directly. The sequence is a stack of branches.
- **Green before review.** A PR is ready only when **CI checks pass AND all tests pass** (`bun check`, `bun api:test:e2e`, `bun ui:test:e2e` as applicable). NEVER request review on a red PR. Alert the user if CI/CD needs to be fixed
- **Review split.** The user reviews the **UI** and tests the **API with cURL**. Every PR description MUST include what path to test, no sweet talk, just what is done and how to test it.

## Commands

```bash
# Development
bun dev                              # Full stack (API + web + SDK watcher)
bun --filter web dev                 # Web app only
bun --filter @back-stock/api dev    # API only

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
bun --filter @back-stock/api db:generate   # Generate migrations from src/db/schema.ts
bun --filter @back-stock/api db:migrate     # Apply migrations
bun --filter @back-stock/api db:studio      # Drizzle Studio

# Docker / Queue (RabbitMQ)
bun docker:up                        # Start RabbitMQ (waits for healthy); UI at :15672
bun docker:down                      # Stop services
bun docker:rm-all                    # Nuclear: wipe all back-stock- containers + volumes

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
- **Migrations** — Generated into `src/db/migrations/`, applied with `bun --filter @back-stock/api db:migrate` (also run on API startup via `setupApi`).
- **Validation** — Zod schemas; never Elysia TypeBox `t.*`.
- **Queues** — RabbitMQ via `@api/modules/queue` (`publish()` / `consume()`); trace context propagates across queue boundaries. Register consumers in `src/workers.ts` (`bun dev` runs the worker alongside the server). Connections are lazy, so `bun dev` works without the broker until a queue is actually used.
- **Testing** — Eden Treaty for E2E; preload `./src/test/setup.ts`. Avoid awaiting `Bun.sleep` inside `beforeAll` (breaks bun:test hook completion in 1.3.x).

## Web App (apps/web)

Feature modules in `src/modules/`, file-based routing in `src/routes/`.

Key conventions:

- **Data fetching** — Eden Treaty client (`backStockApi.module.endpoint.get()`), never `useEffect` for fetching long-term. Use `apiCall<T>(...)` to extract typed data and propagate errors. Optional Zod parse via the second arg.
- **Types** — Import API types from `@back-stock/api/client` (and feature subpaths as they're added).
- **Testing** — `data-testid` attributes for Playwright selectors.

## Shared UI (packages/ui)

- `shadcn/` — Radix UI primitives styled with Tailwind v4 tokens. Internal imports use **relative paths** (e.g. `../lib/utils`), not `@/`, so consumers' `tsc` resolves them.
- `components/` — Business components (added as project grows)
- `hooks/` — Custom React hooks
- `lib/utils.ts` — `cn()` for class merging
- `styles/index.css` — Tailwind v4 `@theme` tokens (no `tailwind.config.ts`)

## API SDK Exports

The API package exports typed subpath modules (`@back-stock/api/client`, `@back-stock/api/core`, etc.) built by tsup. The web app consumes these for type-safe API integration.

**Critical**: when adding a new API module, follow the three-step recipe — add the file to `src/sdk/<name>.ts`, the entry to `tsup.config.ts`, and the entry to `packages/api/package.json` `exports`. The `apps/web/src/__sdk-smoke.ts` file is permanent and enforces this contract at typecheck time. Don't delete it.

## Path Aliases

```
@/*           → apps/web/src/                       (web app)
@repo/ui      → packages/ui                         (UI components, via exports)
@back-stock/api/* → packages/api/dist/* (built)    (API SDK subpaths)
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
