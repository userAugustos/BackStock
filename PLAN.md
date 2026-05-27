# BackStock — Plan

> **Replay a grocery store day as an event stream, branch on any decision, and see how it compounds.**
> A replay & counterfactual sandbox for Vori's Inventory and Pricing agents.

_Status: design overview (first version) · Date: 2026-05-27_

This document is an **overview of each feature plus the API, LLM, and flow design**. It is intentionally
**no-code** — the JSON blocks are _illustrative data shapes_, not implementation. UI is described at a
deliberately shallow level; the API and the agent/sim flow are the serious surface.

---

## Table of contents

1. [What this is & why](#1-what-this-is--why)
2. [Guiding principles](#2-guiding-principles)
3. [Core domain model](#3-core-domain-model)
4. [The two branching axes](#4-the-two-branching-axes)
5. [Execution flow](#5-execution-flow)
6. [LLM / agent flow (Modal)](#6-llm--agent-flow-modal)
7. [Deterministic simulation](#7-deterministic-simulation-the-world)
8. [Feature overview](#8-feature-overview)
9. [API surface](#9-api-surface)
10. [Persistence (Drizzle / SQLite)](#10-persistence-drizzle--sqlite)
11. [Queue topology (RabbitMQ)](#11-queue-topology-rabbitmq)
12. [Web app / UI](#12-web-app--ui-keep-it-simple)
13. [Testing strategy](#13-testing-strategy)
14. [Environment & config](#14-environment--config)
15. [Hero scenario](#15-hero-scenario--the-milk-crisis-day)
16. [Build sequence](#16-build-sequence)
17. [Out of scope (for now)](#17-out-of-scope-for-now)

---

## 1. What this is & why

Vori is _"the self-driving OS for grocery stores"_ — it ships three AI agents (a **Pricing Agent**, an
**Inventory Agent**, and a Marketing Agent) described as _"virtual employees that never clock out."_
Those agents make real operational calls every day: when to reorder, how much, what to charge as costs move.

**BackStock** is a dev/sandbox tool that makes those decisions inspectable and testable. You take a store
day — pre-seeded, or **uploaded as a JSON payload exported from a real day two months ago** — and:

- **replay** it as an ordered event stream, pausing on any moment;
- see **what the agent knew** at that moment and **what it decided** (and why);
- **branch**: change a decision, or re-run the whole day against a **newer version of the agents**
  (new prompt, new model, new policy);
- **compare** branches and read the **business impact** — waste %, stockouts, missed revenue $.

This serves mainly one thing:

- **Engineering** — it's a genuine **agent regression / eval harness**: _"we changed the Inventory Agent's
  prompt — does it make better calls on the messy day we actually had?"_ Replay a golden historical day
  against the new version and read the delta.

Everything is **append-only**: every event is recorded, every agent decision is recorded, every rerun
creates a new branch, and any two branches of the same day can be compared.

---

## 2. Guiding principles

| #   | Principle                                                  | Why it matters                                                                                                                                                                                                                       |
| --- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| P1  | **LLM decides, simulation computes impact.**               | The only non-deterministic part (the model) is _recorded_; the world reacts with plain math. This is what makes branch comparison trustworthy.                                                                                       |
| P2  | **Event-sourced & append-only.**                           | Events + decisions are the source of truth; the per-step timeline and impact are _projections_. Nothing is mutated in place.                                                                                                         |
| P3  | **Per-day catalog, not a global enum.**                    | Valid items = the SKUs declared in a day's `seed_state`. The LLM and the sim are bounded by _that day's_ catalog. Scales from 2 SKUs to hundreds.                                                                                    |
| P4  | **Validate every LLM output with Zod.**                    | A `summary` can be free text, but `order_cases` must be a bounded non-negative integer and reference a real SKU. Hallucinations are caught, retried once, then safely defaulted — never crash, always visible.                       |
| P5  | **Ingest anything, simulate only what we model.**          | Uploaded real-world payloads are filtered to the catalog; the dropped slice is reported (`ignored: N events`), never silently swallowed.                                                                                             |
| P6  | **UI as simple as possible; API as complete as possible.** | The web app leans entirely on shadcn and stays minimal for now (polish later). The **API is the serious deliverable**: full surface, snake_case payloads, typed Eden bridge, and **broad e2e coverage**.                             |
| P7  | **Extend the existing stack along its grain.**             | New layered modules (`routes`/`service`/`repository`), Zod validation (never TypeBox), `AppError` helpers, `@core/*` logging & telemetry, RabbitMQ with the trace propagation already wired, SDK subpaths via the three-step recipe. |

---

## 3. Core domain model

Five immutable concepts; everything else is derived from them.

| Concept      | What it is                                                                                                                                                                                                                            |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Day**      | A scenario: an **opening snapshot** (`seed_state`: SKUs, vendors, inventory, prices, costs) + an **ordered list of events**. Source = `seed` or `upload`. This is the _only_ artifact you seed or upload.                             |
| **Event**    | Append-only, timestamped, typed, carries a payload. The events **are** the data — "re-triggering" just means a run replays the stored list.                                                                                           |
| **Run**      | One execution of a Day, pinned to a **Version**. Has `parent_run_id` + a fork point (null for the root run).                                                                                                                          |
| **Decision** | An agent's recorded output at a decision point: the context it knew, prompt version, model id, **raw LLM output**, the parsed & validated decision, the reasoning, and how it was sourced (`llm` / `override` / `reused`). Immutable. |
| **Impact**   | Deterministic sim metrics for a run: waste %, stockout events, missed revenue $, ending margin, ending inventory value.                                                                                                               |
| **Version**  | A named bundle the agents run under: `{ inventory_prompt_version, pricing_prompt_version, model_id, policy }`. The thing you "re-run an old day against."                                                                             |

### A Day (illustrative shape — same for seeded and uploaded)

```jsonc
{
  "name": "Tue Mar 18 — milk crisis",
  "seed_state": {
    "skus": [
      {
        "id": "milk-2pct-gal",
        "on_hand": 30,
        "price": 3.99,
        "unit_cost": 2.8,
        "shelf_life_hours": 96,
        "case_size": 6,
      },
    ],
    "vendors": [{ "id": "dairy-co", "lead_time_hours": 18, "next_delivery_at": "10:00" }],
  },
  "events": [
    {
      "seq": 0,
      "at": "08:12",
      "type": "sales_spike",
      "payload": { "sku": "milk-2pct-gal", "multiplier": 2.5 },
    },
    {
      "seq": 1,
      "at": "09:03",
      "type": "vendor_delay",
      "payload": { "vendor": "dairy-co", "delay_hours": 6 },
    },
    {
      "seq": 2,
      "at": "10:20",
      "type": "damage_report",
      "payload": { "sku": "produce-lettuce", "units": 8 },
    },
    {
      "seq": 3,
      "at": "11:45",
      "type": "invoice_cost_change",
      "payload": { "sku": "milk-2pct-gal", "new_unit_cost": 3.1 },
    },
    {
      "seq": 4,
      "at": "14:10",
      "type": "promotion",
      "payload": { "sku": "milk-2pct-gal", "demand_multiplier": 1.8 },
    },
    {
      "seq": 5,
      "at": "17:30",
      "type": "manager_override",
      "payload": { "target": "reorder", "action": "approve" },
    },
  ],
}
```

> The computed per-run timeline is a **projection** the engine writes — never uploaded, always derived.

---

## 4. The two branching axes

Both axes are the same operation: **fork a run at a step with a `change`.**

- **Counterfactual branch** — _same version, different decision_ at step X (manager rejects; agent orders 12
  not 24). Tests **decisions**.
- **Version branch / re-run** — _same day, new agent version_ (prompt v2, model v2, new policy). Forks at
  day start. Tests **features / quality**. ← the "re-run a 2-month-old day against today's agent" case.

A run row captures the fork:

```jsonc
{
  "id": "uuid", // the run/execution id
  "day_id": "uuid",
  "version_id": "uuid", // pinned agent version
  "parent_run_id": "uuid|null", // null = root run
  "fork_event_seq": "int|null", // WHERE it diverges — the event index. null/0 = from day start
  "fork_change": { "type": "decision_override | version", "...": "..." },
}
```

So **`fork_point = (parent_run_id, fork_event_seq)`** — "fork from a specific point in the event timeline."
Everything _before_ that seq is shared with the parent; from that step on, the branch re-executes with
`fork_change`. Runs of the same Day are **comparable**; the compare view aligns timelines and marks the
divergence point.

### Mental model: a git-branch graph

```
Day: "Tue Mar 18 — milk crisis"
●──●──●──◆ run#1  v1  reorder 24, manager approves   → waste 4%, no stockout      ← root
         │
         ├──◆ run#2  v1  branch@5:30 manager REJECTS  → stockout 6PM, −$420 revenue
         │
         └──◆ run#3  v1  branch@reorder agent orders 12 → no stockout, waste 1%

●──●──●──◆ run#4  v2-prompt  re-run whole day          → orders 18, waste 2%, no stockout
```

`●` = event applied · `◆` = decision / fork point. **Run tree** screen renders this graph; **Compare**
picks 2–3 nodes sharing a fork point. (Each node gets a shadcn tooltip on hover with its decision + impact.)

---

## 5. Execution flow

**Approach: a deterministic run engine, orchestrated through RabbitMQ, replayed client-side.**

```
POST /days/:id/runs { version_id }
        │
        ├─ create run (status: queued)
        └─ publish  run.requested  ──────────────►  Run-engine worker (src/workers.ts)
                                                        │  steps the day start→end, in order (a pure fold):
                                                        │    for each event (by seq):
                                                        │      1. apply event → advance sim state + order-lifecycle FSM
                                                        │      2. if decision point → resolve decision (see below)
                                                        │      3. record decision (immutable)
                                                        │      4. write run_step projection (state + order_state)
                                                        │  compute impact, status: done
                                                        └─ publish  run.completed   (+ optional run.step progress)
```

The UI's **play / pause / scrub is pure client-side time-travel over the already-computed `run_steps`** —
deterministic, fast, exact. Trace context propagates from the HTTP request into the worker (already wired in
the repo's queue layer).

### Fold vs. state machine — where each applies

The engine itself is a **deterministic fold** (`state_n = reduce(apply, events[0..n], seed_state)`), _not_ a
state machine — its core state is continuous accumulated data (inventory, margin, cash), so an FSM there would
just be a reducer in disguise. But two **bounded sub-lifecycles** genuinely are finite, constrained machines,
and are modeled as small **hand-rolled, pure** state machines (a transition table — no library) that the fold
advances:

- **Order lifecycle** — the interesting one. `manager_override` and `vendor_delay` are _guarded transitions_,
  not data mutations, so illegal moves (delivering a rejected order) are impossible by construction:

```
recommended ──(override: approve)──► placed ──► in_transit ──► delivered
     │                                             │
     ├──(override: modify q')──► placed (q')        └──(vendor_delay)──► late ──► missed
     └──(override: reject)──► rejected
```

- **Run lifecycle** — the trivial one: `queued → running → done | failed` (§11).

Both FSMs are **pure projections** — fully derivable by replaying `(seed + events + decisions)` — so they
advance under the same fold and never carry hidden state. That's what keeps the fork rule below intact:
reconstructing state at a fork point is still just "replay up to that seq," FSM nodes included.

### The one branching rule that keeps forks simple

The engine **always replays the whole day start→finish**, and the sim is a pure function. A fork changes
only **where each decision comes from**, per step:

| Step position vs. fork | Decision source                                                                                                  |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **before** the fork    | `reused` — copy the parent run's recorded decision (no LLM call; pre-fork timeline is identical by construction) |
| **at** the fork        | `override` (counterfactual) or recompute under the new version                                                   |
| **after** the fork     | recompute fresh — new context flows forward                                                                      |

No mid-run splicing, no partial-state snapshots to stitch. A version re-run is just "fork at seq 0"
(nothing to reuse → recompute everything). That is the entire branching mechanic.

---

## 6. LLM / agent flow (Modal)

Real inference, served by a **small open model (Qwen-class) on Modal** — not Claude, not mocked. Small on
purpose: this is a sandbox, not production.

```
Bun API · agents.<inventory|pricing>.service
   │  build prompt = versioned system prompt + run context + triggering event
   │       (system prompt explains: the data, what each field means, the exact response shape required)
   ▼
POST {MODAL_LLM_URL}/v1/chat/completions     // Qwen via vLLM, OpenAI-compatible
   │       auth: Modal proxy token (Modal-Key / Modal-Secret)
   ▼
raw JSON  ──►  Zod parse + validate against the day's catalog & constraints
   │            ok   → record decision { parsed, reasoning, source: llm, valid: true }
   │            fail → ONE bounded retry (feed the validation error back)
   │                   still fail → safe default (e.g. "no order"), record valid:false (visible)
   ▼
deterministic simulation applies the decision and computes impact
```

### Serving (Modal)

- A Modal app runs **vLLM in OpenAI-compatible mode** behind `@modal.web_server` (port 8000), exposing
  `/v1/chat/completions`, secured with a Modal proxy-auth token.
  ([Modal vLLM example](https://modal.com/docs/examples/vllm_inference),
  [Qwen on Modal](https://modal.com/blog/deploy-qwen-chatbot-vercel),
  [Modal web endpoints](https://modal.com/docs/guide/webhooks))
- **Modal notebooks are the dev loop**, made literal:
  `prototype/iterate a prompt or swap the model in a notebook → promote to the deployed endpoint → register
it as a new Version → re-run historical days in BackStock and read the impact delta.`
  That is the _"test features / improve quality"_ story.

### Prompts & schemas (in the API)

- **Prompt registry per agent**: `packages/api/src/modules/agents/<inventory|pricing>/prompts/` holds
  **versioned system prompts**. Each request sends instructions that describe the input data, the meaning of
  each field, and the exact response shape to produce.
- **Response schema per agent**: `*.llm.schema.ts` (Zod). The `sku` enum is built **dynamically from the
  current day's catalog**, so the model can only act on items that exist.

```jsonc
// Inventory Agent — expected (and validated) response
{ "order_cases": 24, "sku": "milk-2pct-gal", "summary": "Spike + 6h vendor delay; emergency 24 cases to cover evening." }
//   order_cases: integer ≥ 0, bounded · sku: ∈ day catalog · summary: free string

// Pricing Agent — expected (and validated) response
{ "new_price": 4.29, "sku": "milk-2pct-gal", "summary": "Unit cost rose 2.80→3.10; lift price to hold ~28% margin." }
//   new_price: > 0, within sane bounds of current price · sku: ∈ day catalog · summary: free string
```

---

## 7. Deterministic simulation (the "world")

The LLM only **decides**. The simulation calculates **what happens to the store** as a result — plain
arithmetic, no AI, no randomness. A pure function:

```
simulate(seed_state, events, executed_decisions)  →  run_steps[]  +  impact
```

Think of a running ledger per SKU through the day:

- start at opening stock → **subtract sales** as the day runs (a `sales_spike` / `promotion` sells faster)
  → **add deliveries** when they land (a `vendor_delay` lands them later) → **subtract** damaged/expired units;
- stock hits zero before the next delivery → **stockout** → lost units × price = **missed revenue $**;
- perishables past `shelf_life_hours` → **waste % / $**;
- `invoice_cost_change` raises `unit_cost`; the pricing decision sets `price` → **margin** = (price − cost) / price.

Same inputs → same numbers, every time. So when two branches differ, the **only** thing that changed is the
decision — any gap in waste/stockout/$ was **caused by that decision**, not luck.

### Catalog boundary (ingest ≠ simulate)

- The catalog = `seed_state.skus` for that day (per-day, scalable).
- On **upload**, the payload is validated and **normalized**: events referencing known SKUs / known event
  types run; the rest go to an **`ignored: N unsupported items/events`** report surfaced in the UI — accepted
  but visibly set aside, never silently dropped.

---

## 8. Feature overview

| Feature                     | Overview                                                                                                                                                                  |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Day library**             | List pre-seeded + uploaded days. Each shows its catalog and (if uploaded) its ignored-events report.                                                                      |
| **Day upload (JSON)**       | Drop in a real day payload; it's schema-validated, normalized to the catalog, stored alongside seeds.                                                                     |
| **Run a day**               | Start an execution pinned to a chosen Version. Async via the queue; UI shows queued → running → done.                                                                     |
| **Replay timeline**         | Scrub/play/pause over the recorded `run_steps`. A store-state panel tracks inventory, margin, cash through the day.                                                       |
| **Decision inspector**      | Pause on a decision event to see: the context the agent had, the prompt + version + model, the **raw LLM output**, the parsed decision, the reasoning, and impact-so-far. |
| **Counterfactual branch**   | From a decision, "Try alternative" → pick a different decision → spawns a branch run from that step.                                                                      |
| **Version branch / re-run** | Re-run the whole day under a different agent Version (prompt/model/policy) to test a change.                                                                              |
| **Compare**                 | 2–3 runs sharing a fork point, aligned side by side, with a decision diff and an **impact-delta scoreboard**.                                                             |
| **Run tree**                | The git-style branch graph of a day's runs, with hover tooltips (decision + impact per node).                                                                             |
| **Version registry**        | List/register agent Versions — the bundles you re-run old days against.                                                                                                   |
| **Agents**                  | Inventory + Pricing agents (LLM-backed, Zod-validated) invoked at decision points.                                                                                        |
| **Simulation engine**       | Deterministic impact calculator; the shared "world" all branches run against.                                                                                             |

---

## 9. API surface

Elysia + **Zod** validation, **snake_case** payloads, consumed through the typed **Eden Treaty** bridge.
New layered modules under `packages/api/src/modules/` (each `*.routes.ts` / `*.service.ts` /
`*.repository.ts`). Client types exported as SDK subpaths via the three-step recipe
(`src/sdk/<name>.ts` + `tsup.config.ts` + `package.json` exports), with `__sdk-smoke.ts` extended to keep the
contract honest.

### `days`

| Method | Path               | Purpose                                                                         |
| ------ | ------------------ | ------------------------------------------------------------------------------- |
| GET    | `/days`            | List days (seed + uploaded).                                                    |
| POST   | `/days`            | Upload a Day JSON → validate + normalize → store; returns day + ignored report. |
| GET    | `/days/:id`        | Day detail (`seed_state`, catalog, ignored report).                             |
| GET    | `/days/:id/events` | Ordered events.                                                                 |

### `runs`

| Method | Path                       | Purpose                                                                           |
| ------ | -------------------------- | --------------------------------------------------------------------------------- |
| POST   | `/days/:id/runs`           | Start a run `{ version_id }` → returns run (`queued`); publishes `run.requested`. |
| GET    | `/runs/:id`                | Run status + summary.                                                             |
| GET    | `/runs/:id/timeline`       | Ordered `run_steps` (state snapshots + decisions) — the replay data.              |
| GET    | `/runs/:id/impact`         | Impact metrics.                                                                   |
| GET    | `/runs/:id/decisions/:seq` | Decision detail: context, prompt, raw output, parsed, reasoning.                  |
| POST   | `/runs/:id/branch`         | Fork `{ at_event_seq, change }` → returns new run (`queued`).                     |

### `compare`

| Method | Path                              | Purpose                                                                    |
| ------ | --------------------------------- | -------------------------------------------------------------------------- |
| GET    | `/compare?run_a=&run_b=[&run_c=]` | Aligned timelines + impact deltas + divergence point (validates same day). |

### `versions`

| Method | Path            | Purpose                                                        |
| ------ | --------------- | -------------------------------------------------------------- |
| GET    | `/versions`     | List agent Versions.                                           |
| POST   | `/versions`     | Register a Version bundle (prompt versions, model id, policy). |
| GET    | `/versions/:id` | Version detail.                                                |

> `agents`, `simulation`, `llm`, and the upload `normalizer` are **internal services** (no public routes). A
> dev-only LLM health probe may be registered behind `if (!config.isProduction)`.

---

## 10. Persistence (Drizzle / SQLite)

Append-only tables added to `packages/api/src/db/schema.ts`; migrations generated into `src/db/migrations/`
and applied on startup (existing `setupApi` behavior). UUID PKs, matching the current `users` convention.

| Table       | Key columns                                                                                                                                                                                       | Notes                                                                                                                 |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `days`      | `id`, `name`, `source`, `seed_state` (json), `ignored_report` (json), `created_at`                                                                                                                | The uploadable/seedable artifact.                                                                                     |
| `events`    | `id`, `day_id→`, `seq`, `occurred_at`, `type`, `payload` (json)                                                                                                                                   | unique `(day_id, seq)`. Append-only.                                                                                  |
| `versions`  | `id`, `label`, `inventory_prompt_version`, `pricing_prompt_version`, `model_id`, `policy` (json), `created_at`                                                                                    | Agent bundles.                                                                                                        |
| `runs`      | `id`, `day_id→`, `version_id→`, `parent_run_id→?`, `fork_event_seq?`, `fork_change` (json?), `status`, `label`, `created_at`, `completed_at`                                                      | Fork point lives here.                                                                                                |
| `decisions` | `id`, `run_id→`, `event_seq`, `agent`, `context_snapshot` (json), `prompt_version`, `model_id`, `raw_output`, `parsed` (json), `reasoning`, `source` (llm/override/reused), `valid`, `latency_ms` | unique `(run_id, event_seq, agent)`. Immutable.                                                                       |
| `run_steps` | `id`, `run_id→`, `seq`, `state_snapshot` (json), `order_state`, `created_at`                                                                                                                      | Per-step projection for scrubbing; `order_state` = the order-lifecycle FSM node at this step. unique `(run_id, seq)`. |
| `impacts`   | `id`, `run_id→` (unique), `waste_pct`, `waste_value`, `stockout_events`, `missed_revenue`, `ending_margin_pct`, `ending_inventory_value`, `metrics` (json)                                        | Derived; one per run.                                                                                                 |

---

## 11. Queue topology (RabbitMQ)

Reuses the existing `@api/modules/queue` (`publish()` / `consume()`) and trace propagation; the consumer is
registered in `src/workers.ts` (run by `bun dev` alongside the server).

| Exchange | Routing key                    | Producer → Consumer         | Payload                |
| -------- | ------------------------------ | --------------------------- | ---------------------- |
| `runs`   | `run.requested`                | API → run-engine worker     | `{ run_id }`           |
| `runs`   | `run.step` _(optional)_        | worker → UI progress        | `{ run_id, seq, pct }` |
| `runs`   | `run.completed` / `run.failed` | worker → (UI poll / notify) | `{ run_id, status }`   |

Replay reads **completed** projections, so live streaming is optional — `run.step` is only a progress nicety.
Connections stay lazy (the repo's design), so `bun dev` works without the broker until a run is actually started.

---

## 12. Web app / UI (keep it simple)

React 19 + TanStack Router/Query, Eden Treaty client, **shadcn/ui only**, `data-testid` for Playwright.
**Deliberately minimal for now — polish comes after the features work.** Four screens:

1. **Days** (`/`) — list of seed + uploaded days; "Upload day (JSON)"; pick a Version → "Run".
2. **Replay** (`/runs/$runId`) — horizontal timeline with event markers + play/pause/scrub; store-state panel
   (inventory / margin / cash); an **order-state track** under the timeline shows the order-lifecycle FSM
   (recommended → placed → delivered / late …) at each moment; pausing on a decision opens the **Decision
   card** (context + order state → prompt/version → reasoning → parsed decision → impact-so-far) with
   **"Try alternative"** (decision or version → branch).
3. **Compare** (`/compare`) — 2–3 aligned columns sharing a fork point; decision diffs; **impact scoreboard**
   (waste / stockout / missed-revenue $) with deltas — the payoff screen.
4. **Run tree** — the git-style branch graph (Section 4) with hover tooltips per node.

---

## 13. Testing strategy

Per **P6**, the API carries the weight.

- **API e2e (Eden Treaty, real server, `bun:test`)** — the primary coverage. Days CRUD + upload + ignored
  report; run lifecycle (queued→done); branch (counterfactual + version); compare alignment & deltas;
  versions; decision inspection; and the **validation/fallback paths** (bad LLM output → retry → safe default).
- **Determinism golden tests** — same `(day, version, executed_decisions)` → byte-identical impact. This is
  the contract that makes branch comparison meaningful.
- **LLM in tests** — the Modal call is **stubbed** with a fake returning fixed JSON, so e2e stays
  deterministic; a separate opt-in integration test (behind a flag) hits the real Modal endpoint.
- **SDK contract** — `__sdk-smoke.ts` extended for each new subpath; typecheck fails if the bridge breaks.
- **UI** — minimal Playwright smoke (load a day, run it, scrub, compare renders) via `data-testid`. Kept light.

---

## 14. Environment & config

Added to `@core/env` (never read `Bun.env` in feature modules):

| Var                                                   | Purpose                                                   |
| ----------------------------------------------------- | --------------------------------------------------------- |
| `MODAL_LLM_URL`                                       | Modal web endpoint serving Qwen (`/v1/chat/completions`). |
| `MODAL_LLM_TOKEN` _(or `MODAL_KEY` / `MODAL_SECRET`)_ | Proxy auth for the endpoint.                              |
| `LLM_MODEL_ID`                                        | Default model id recorded on each decision.               |
| `LLM_TIMEOUT_MS`                                      | Inference timeout before fallback.                        |

Web continues to use `VITE_API_URL` via `webEnv`.

user should provide the variables, use only fallbacks for variables that don't exists

---

## 15. Hero scenario — the "milk crisis" day

The curated showcase day (the six events from the brief), with Inventory + Pricing as co-stars.

| Time  | Event                                  | Touches                                             |
| ----- | -------------------------------------- | --------------------------------------------------- |
| 8:12  | Milk sales spike                       | Inventory Agent (movement → reorder)                |
| 9:03  | Vendor delayed delivery                | Order management / lead time                        |
| 10:20 | Cashier reports damaged produce        | Shrink / inventory adjustment                       |
| 11:45 | Invoice cost changed                   | **Pricing Agent** (cost-change → margin protection) |
| 2:10  | Promotion → demand spike               | Demand multiplier                                   |
| 5:30  | Store manager overrides recommendation | Human-in-the-loop gate on the reorder               |

**Decision points:** D1 Inventory reorder · D2 Pricing change (after the cost event) · D3 Manager override (D3 gates D1).

**Branches that tell the story:**

```
run#1  v1  reorder 24, manager APPROVES   → 4% waste, no stockout            (the baseline)
run#2  v1  branch@5:30 manager REJECTS     → stockout at 6PM, −$420 revenue   (the cost of saying no)
run#3  v1  branch@reorder agent orders 12  → no stockout, ~1% waste           (the better call)
run#4  v2  re-run whole day, new prompt    → orders 18, 2% waste, no stockout (did the new agent improve?)
```

That last row is the whole pitch: **upload a real day, re-run it against a newer agent, read the delta.**

---

## 16. Build sequence

Each phase ends green (typecheck + lint + e2e). UI stays minimal throughout.

1. **Domain & persistence** — schema (days/events/runs/decisions/run_steps/impacts/versions); Day upload +
   normalizer; seed the hero day; `days` + `versions` APIs. e2e.
2. **Simulation + run engine** — deterministic sim; run engine with **stubbed decisions** (no LLM yet); run
   lifecycle via the queue; timeline + impact projections. e2e + determinism golden tests.
3. **LLM agents on Modal** — serve Qwen; `llm` client; inventory + pricing prompts + Zod schemas; retry +
   fallback; wire into the run engine. e2e with stubbed LLM.
4. **Branching + compare** — counterfactual + version forks; compare alignment & deltas. e2e.
5. **Web UI** — days, replay, decision inspector, branch action, compare, run tree (plain shadcn). Playwright smoke.
6. **Showcase polish** — hero scenario script, run-tree tooltips, ignored-report surfacing.

---

## 17. Out of scope (for now)

Auth / multi-tenant · real Vori data integration · multi-store · ML demand forecasting · real POS / payments ·
the Marketing Agent (Inventory + Pricing only) · live streaming inference (replay is over completed runs) ·
any UI polish beyond stock shadcn. These are deliberately deferred to keep the showcase crisp.
