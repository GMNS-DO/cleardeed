ClearDeed — Claude Code Operating Manual
This is the document you'll paste into Claude Code as your foundation. It's designed to be the single source of truth that survives across sessions, machines, and context resets. Save it as CLAUDE.md at the repo root.

How to Use This Document
This file is read by Claude Code at the start of every session. It is the constitution of the project. Three rules:

Never delete from this file. Only append, amend with timestamps, or mark as superseded. History matters.
Every session starts by reading this top-to-bottom and ends by updating the relevant sections. No exceptions.
If a decision contradicts this file, either update the file first or don't make the decision. This is how context survives.

The file is structured in seven sections. Sections 1-3 are stable (product, architecture, principles). Sections 4-7 are living (tasks, decisions, state, session log).

Section 1: Product Definition
What: ClearDeed is a property due-diligence tool for Odisha that consolidates public land records, court cases, and registry data into a single structured report, given a plot's GPS coordinates and the claimed owner's name.
Who (V1 user): Property lawyers, registered brokers, and builders in Khordha district who currently spend 4-8 hours per plot manually pulling records from Bhulekh, Bhunaksha, IGR, and eCourts. Secondary user: end buyers who consume the lawyer-delivered report.
Why: Consolidated public-record retrieval is currently a manual, error-prone, multi-portal grind. Validated demand exists for a tool that does this in minutes and produces a defensible, brochure-style output. The wedge is time saved on grunt work, not replacing legal judgment.
Liability boundary: ClearDeed surfaces and structures public records. It does not certify ownership, guarantee absence of fraud, or recommend transactions. Every report includes a "manual verification required" section. We are an information aggregator, not a legal opinion.
V1 scope (locked):

Khordha district only
Residential and commercial plots (not agricultural-only, not forest, not tribal/PESA)
Single plot per report (batch is V2)
English output with Odia source-document references
PDF report deliverable

Out of V1 scope:

Trust score (deferred — replaced by per-dimension verified/unverified/manual checklist)
Mobile app
Other districts
Direct EC purchase (deep-link only in V1)
WhatsApp delivery


Section 2: Architecture View
┌─────────────────────────────────────────────────────────┐
│  Frontend: Next.js (App Router) + Tailwind              │
│  - Single input form (GPS + Name + claimed plot if any) │
│  - Report view (sectioned, printable, exportable PDF)   │
│  - Lawyer dashboard: report history, batch queue        │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│  API Layer: Next.js API routes (Node)                   │
│  - /api/report/create  → orchestrates pipeline          │
│  - /api/report/:id     → fetches stored report          │
│  - /api/sources/:name  → individual source endpoints    │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│  Orchestrator (Node service)                            │
│  - Runs source fetchers in parallel where safe          │
│  - Handles retries, fallbacks, partial-failure reports  │
│  - Writes structured result to Postgres                 │
└────────────────────────┬────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
┌───────▼──────┐  ┌──────▼──────┐  ┌──────▼──────────┐
│ Source       │  │ Source      │  │ Source          │
│ Fetchers     │  │ Fetchers    │  │ Fetchers        │
│ (parallel)   │  │             │  │                 │
│              │  │             │  │                 │
│ Nominatim    │  │ Bhulekh     │  │ eCourts         │
│ ORSAC KYL    │  │ Bhunaksha   │  │ RCCMS           │
│              │  │ IGR (link)  │  │                 │
└──────────────┘  └─────────────┘  └─────────────────┘
        │                │                │
┌───────▼────────────────▼────────────────▼─────────────┐
│  Storage: Postgres (Supabase)                         │
│  - reports, sources, source_results, audit_log        │
│  - Raw responses cached 24h for debugging + replay    │
└───────────────────────────────────────────────────────┘
Key architectural decisions (with rationale):

Next.js monorepo, not separate frontend/backend. Solo builder, deployment simplicity wins over architectural purity.
Postgres via Supabase, not SQLite. Need row-level security from day one because reports contain PII (owner names tied to plots).
Fetchers are independent modules with a common interface. Each exports { fetch(input) → SourceResult, healthCheck() }. This isolates the messiest code (scrapers) and allows independent testing.
Playwright in a separate worker container, not in the API process. Scrapers are slow and crash-prone. Isolate them.
All raw responses stored alongside parsed results. When a source breaks (it will), we need the raw bytes to debug.

Repo layout:
cleardeed/
├── CLAUDE.md                    ← This file
├── docs/
│   ├── decisions/               ← One markdown per ADR
│   ├── sources/                 ← One markdown per data source (auth, schema, gotchas)
│   └── sessions/                ← Session logs, archived weekly
├── apps/
│   └── web/                     ← Next.js app
│       ├── app/
│       ├── components/
│       └── lib/
├── packages/
│   ├── fetchers/                ← One module per source
│   │   ├── nominatim/
│   │   ├── orsac-kyl/
│   │   ├── bhulekh/
│   │   ├── bhunaksha/
│   │   ├── ecourts/
│   │   └── rccms/
│   ├── orchestrator/
│   ├── schema/                  ← Shared types, Zod schemas
│   └── pdf-renderer/
├── workers/
│   └── playwright-worker/       ← Isolated browser automation
├── infra/
│   ├── supabase/migrations/
│   └── docker/
└── scripts/
    ├── probe/                   ← Source-probing scripts (KYL auth, etc.)
    └── seed/

Section 3: Operating Principles
These are non-negotiable working rules. If a session is about to violate one, stop and update this section instead.
On context preservation:

Every session ends with a session log entry in Section 7.
Every meaningful decision goes in Section 5 (Decision Log) before being implemented.
Every source fetcher has a corresponding docs/sources/<name>.md documenting its auth, schema, edge cases, and last-known-working state.

On thinking vs. building:

Product/design decisions get a thinking pass first: write the question, the options considered, the chosen option, and the reasoning. Only then write code.
Code-only sessions are explicitly labeled. They start with "execution mode" and skip deliberation.

On sub-agents:

A sub-agent task brief must include: objective (one sentence), inputs (concrete), success criteria (testable), out-of-scope (explicit), and deliverable format (file path + structure).
Sub-agents do not modify CLAUDE.md, the decision log, or any file outside their declared scope.
Sub-agent outputs are reviewed before being merged into the main flow.

On code quality:

Every fetcher has a fixtures/ folder with real (anonymized) responses for testing.
No fetcher ships without a health check that runs in CI.
Scrapers fail loudly with structured errors, never silently return empty.
All external calls are wrapped with timeout + retry + structured logging.

On scope discipline:

If a task expands mid-session, stop, write the expansion as a new task in Section 4, and ask whether to continue or defer.
"While I'm here" changes are forbidden. They become separate tasks.

On the user (lawyer) experience:

Every report section answers: what does this mean, what's the source, what's the timestamp, what should the lawyer verify manually.
No score, no green checkmark, no "safe to buy" language anywhere.
Failure to fetch a source is shown explicitly, not hidden.


Section 4: Task List
Tasks have status: TODO, IN PROGRESS, BLOCKED, DONE, DEFERRED. Each has an ID for cross-reference.
Format:
[ID] [STATUS] [PRIORITY: P0/P1/P2] Title
  Owner: <session date or sub-agent name>
  Created: <date>
  Notes: <one-liner>
Active
[T-001] [DONE] [P0] Set up monorepo skeleton (Next.js + packages + Supabase local)
  Created: 2026-04-16
  Notes: Mirror Section 2 layout exactly. No fetchers yet.

[T-002] [DONE] [P0] Define shared schemas in packages/schema
  Created: 2026-04-16
  Notes: Report, SourceResult, PlotIdentifier, OwnerRecord. Zod-first.

[T-003] [TODO] [P0] Probe ORSAC KYL auth — produce working curl in scripts/probe/kyl.md
  Created: 2026-04-16
  Notes: Test coord 20.272688, 85.701271. Deliverable: working request OR a definitive blocked memo.

[T-004] [TODO] [P0] Probe Bhunaksha ArcGIS identify endpoint — produce working query
  Created: 2026-04-16
  Notes: Convert WGS84 → Web Mercator, hit identify, parse plot polygon.

[T-005] [DONE] [P0] Build Bhulekh Playwright fetcher for tenant search (Khordha only)
  Created: 2026-04-16
  Notes: Hardcode Khordha district + 5 villages first. Odia mapping in packages/fetchers/bhulekh/villages.ts.

[T-006] [DONE] [P1] Build Nominatim fetcher (simplest, do as warmup)
  Created: 2026-04-16
  Notes: Header User-Agent: ClearDeed/1.0. Cache 7 days. Renamed to nominatimFetch to avoid Node.js global fetch shadowing in Next.js.

[T-007] [TODO] [P1] Orchestrator MVP — runs fetchers in parallel, returns partial results
  Created: 2026-04-16
  Notes: Don't fail whole report if one source fails. Mark source as failed in result.

[T-008] [TODO] [P1] Report PDF renderer (lawyer-facing layout)
  Created: 2026-04-16
  Notes: Sectioned, printable, includes manual-verification checklist per source.

[T-009] [TODO] [P2] Lawyer dashboard — report history, re-run, export
  Created: 2026-04-16
  Notes: After single-report flow works end-to-end.

[T-010] [TODO] [P0] eCourts party-name search fetcher
  Created: 2026-04-16
  Notes: State Odisha, district Khordha. Inspect their network calls — there's a semi-public API.

[T-011] [TODO] [P1] RCCMS revenue court fetcher
  Created: 2026-04-16
  Notes: Plot/khata-based search.

[T-012] [TODO] [P1] IGR deep-link generator + manual EC instructions panel
  Created: 2026-04-16
  Notes: V1 does not pull EC. Generate the exact pre-filled URL + step-by-step.

[T-013] [TODO] [P2] Auth + multi-tenant scoping (Supabase Auth + RLS)
  Created: 2026-04-16
  Notes: Lawyers have isolated report history.

[T-014] [TODO] [P2] Billing + per-report metering
  Created: 2026-04-16
  Notes: Razorpay. Per-report or subscription — decide post-MVP.
Done
(empty — populated as work completes)
Deferred
[D-001] Trust score composite metric
  Reason: Misleading without fraud-detection signals. Replaced by per-dimension checklist.
  Revisit: After 100 real reports show patterns worth scoring.

[D-002] Other districts beyond Khordha
  Reason: Each district = new village dictionary + new edge cases. Validate one first.
  Revisit: When Khordha has 50 paying lawyer-users.

[D-003] Direct EC retrieval
  Reason: Requires IGR account + fees + automation of payment flow. Legal complexity.
  Revisit: After law-firm partnership conversation.

Section 5: Decision Log
Every decision that shapes the product or architecture goes here. Format:
[ADR-NNN] Title
  Date: YYYY-MM-DD
  Status: PROPOSED | ACCEPTED | SUPERSEDED by ADR-XXX
  Context: Why this came up
  Decision: What we chose
  Alternatives considered: What we didn't choose and why
  Consequences: What this commits us to
ADR-001: Target user is property lawyers, not consumers (V1)

Date: 2026-04-16
Status: ACCEPTED
Context: Validated demand exists across lawyers, brokers, builders. Need to pick a wedge.
Decision: V1 is sold to property lawyers in Khordha as a grunt-work accelerator.
Alternatives: B2C buyers (higher liability, higher support); B2B2C via banks (long sales cycle).
Consequences: UX optimized for repeat/batch use, PDF export is mandatory, audit trail required, no consumer-grade hand-holding needed. Liability sits with lawyer's certification.

ADR-002: No composite trust score in V1

Date: 2026-04-16
Status: ACCEPTED
Context: Original brief proposed 0-100 trust score with deductions/bonuses.
Decision: Replace with per-dimension checklist (verified / not verified / manual verification required).
Alternatives: Keep score as advisory; show score with disclaimer.
Consequences: No false confidence. Lawyer keeps interpretive responsibility. Cleaner liability story.

ADR-003: Next.js monorepo on Supabase

Date: 2026-04-16
Status: ACCEPTED
Context: Solo builder, need fastest path to deployable product with auth + DB + RLS.
Decision: Next.js (App Router) + Supabase (Postgres, Auth, Storage). pnpm workspaces.
Alternatives: Separate React + Express + own Postgres; Django + React.
Consequences: Locked into Vercel/Supabase ecosystem. Acceptable for V1.

ADR-004: Playwright in isolated worker container

Date: 2026-04-16
Status: ACCEPTED
Context: Bhulekh requires browser automation. Scrapers are slow, crash-prone, memory-heavy.
Decision: Playwright runs in a dedicated worker, communicates via job queue (Postgres-backed for V1).
Alternatives: Run Playwright inline in API route.
Consequences: Need Docker for local dev. Postgres job queue is enough for V1; revisit Redis/BullMQ at scale.

ADR-005: Khordha-only V1, hardcode the village dictionary

Date: 2026-04-16
Status: ACCEPTED
Context: Bhulekh dropdowns are in Odia script. Building a full Odisha mapping is weeks of work.
Decision: Hardcode all Khordha villages (Census 2011 list, ~360 villages) with English↔Odia mapping. Defer other districts.
Alternatives: Build dynamic resolver; outsource translation.
Consequences: Adding a district is a known unit of work (~2 days). Can be productized as district expansion later.


Section 6: Current State Snapshot
Updated at the end of every session. Single source of truth for "where are we right now."
Last updated: 2026-04-16 (Session 002)
Last session: Session 002 (Section 7)

Built:
  - T-001: Monorepo skeleton committed (d4f479e)
  - T-002: Shared Zod schemas committed (7594efe)
  - T-006: Nominatim fetcher committed (1a6fab2) — nominatimFetch, 7-day cache, 3 tests
  - T-005: Bhulekh Playwright fetcher committed (d9f4bfc) — 20 Khordha villages, Odia mapping, table parser
  - apps/web/: Next.js 15 skeleton with Tailwind CSS v4
  - apps/web/src/app/api/geocode/route.ts: GET/POST /api/geocode → Nominatim
  - apps/web/src/app/api/report/create/route.ts: POST /api/report/create → pipeline stub
  - apps/web/next.config.ts: webpack aliases for @cleardeed/* workspace packages
  - infra/docker/docker-compose.yml for Postgres
  - All package directories created with package.json
  - vitest installed at workspace root
  - playwright + chromium installed at workspace root

Decided:
  - ADR-001 through ADR-005 (see Section 5)

In progress:
  - None

Blocked:
  - None

Pending — ordered by next-up:
  1. T-003: KYL auth probe
  2. T-004: Bhunaksha ArcGIS probe
  3. T-010: eCourts fetcher
  4. T-007: Orchestrator MVP
  5. T-008: PDF renderer
  6. T-011: RCCMS fetcher
  7. T-012: IGR deep-link
  8. T-009: Lawyer dashboard
  9. T-013: Auth + multi-tenant
  10. T-014: Billing

Single highest-leverage next step:
  T-003 (KYL auth probe) — if it works, we get plot→khata lookup in one shot. If blocked, Bhunaksha ArcGIS is the fallback.

Risks currently tracking:
  - KYL auth may be uncrackable without mobile-app interception. Mitigation: Bhunaksha ArcGIS path is the fallback for GPS→plot.
  - Bhulekh may rate-limit Playwright. Mitigation: rotate user agents, throttle, cache aggressively.
  - eCourts party-name search has no documented API. Mitigation: scrape with Playwright if needed.

Environment / accounts needed:
  - [ ] Supabase project created
  - [ ] Vercel project created
  - [ ] GitHub repo initialized
  - [x] Local Postgres + Docker running (infra/docker/docker-compose.yml ready)
  - [ ] Test data: 5 known plots in Khordha with verified owners (for fixtures)

Section 7: Session Log
Append-only. One entry per work session. Older entries get archived to docs/sessions/YYYY-MM.md monthly.
Template for each session
### Session NNN — YYYY-MM-DD

Mode: [thinking | execution | mixed]
Duration: ~X hours
Focus: <one-line goal>

Reconstructed state from:
  - Section 6 snapshot dated <date>
  - Last session: NNN-1

Highest-leverage step identified: <task ID + why>

Tasks worked:
  - [T-XXX] <what happened, status change>

Decisions made:
  - [ADR-XXX] <title, link to Section 5>

Code changes (high-level):
  - <module/file>: <what changed and why>

Sub-agents used:
  - <name>: <task brief summary, deliverable path>

What was done:
  - <bullet>

What changed:
  - <bullet> (decisions, scope, architecture)

What is pending:
  - <bullet>

Exact next step for continuation:
  - <single concrete action with task ID>

Notes for future self:
  - <anything that won't be obvious from code or task list>
Session 001 — 2026-04-16

Mode: thinking
Duration: ~1 hour
Focus: Establish operating manual and project constitution.
Reconstructed state from: original brief + product validation context.
Highest-leverage step identified: Author this CLAUDE.md before writing any code.
Tasks worked: T-001 through T-014 created.
Decisions made: ADR-001 through ADR-005.
Code changes: None.
Sub-agents used: None.
What was done: Defined product, architecture, principles, full task backlog, decision log, state snapshot, session log template.
What changed: Project moved from "described in a brief" to "operationally defined."
What is pending: All P0 tasks (T-001, T-002, T-003, T-005).
Exact next step for continuation: Start Session 002 in execution mode. Run T-001 (monorepo skeleton). Use the layout in Section 2 verbatim. Initialize pnpm workspace, Next.js app, Supabase local, and empty package directories. Commit. Then move to T-002.
Notes for future self: Don't start fetchers (T-003, T-005) before schemas (T-002) exist. Schemas are the contract everything else fits into.

Session 002 — 2026-04-16

Mode: execution
Duration: ~1 hour
Focus: Execute T-001 (monorepo skeleton) then T-002 (shared schemas).
Reconstructed state from: Section 6 snapshot dated 2026-04-16.
Highest-leverage step identified: T-001 (skeleton) — unblocks everything else. Then T-002 (schemas) — contract everything fits into.

Tasks worked:
  - [T-001] DONE — Monorepo skeleton committed (30 files, d4f479e)
  - [T-002] DONE — Shared Zod schemas committed (231 lines, 7594efe)

Decisions made:
  - (No new ADRs — this session executed pre-decided tasks)

Code changes (high-level):
  - Root: pnpm-workspace.yaml, package.json, tsconfig.base.json, pnpm-lock.yaml
  - apps/web/: Next.js 15 App Router + Tailwind CSS v4 skeleton
  - packages/: 6 fetcher dirs, orchestrator, pdf-renderer, schema with all Zod types
  - workers/playwright-worker/: directory + package.json
  - infra/docker/: Supabase Postgres docker-compose.yml
  - infra/supabase/migrations/: 001_initial.sql placeholder

Sub-agents used:
  - None

What was done:
  - Ran pnpm install (local install via npx, sharp build skipped)
  - Created all directories per Section 2 layout verbatim
  - Wrote package.json for root + all 6 fetchers + orchestrator + pdf-renderer + web app + playwright worker
  - Wrote tsconfig files with composite project references
  - Wrote Next.js layout.tsx, page.tsx, globals.css
  - Wrote docker-compose.yml (Supabase Postgres 15 image)
  - Wrote all Zod schemas: GPSCoordinates, PlotIdentifier, OwnerRecord, SourceResult discriminated union (6 variants), Report, CreateReportRequest
  - Committed twice (skeleton, then schemas)

What changed:
  - Repo went from "nothing" to "runnable monorepo" — `pnpm --filter @cleardeed/web dev` works
  - Schemas are the contract T-003 through T-005 will build against

What is pending:
  - T-006: Nominatim fetcher (warmup, validate fetcher interface)
  - T-003: KYL auth probe (scripts/probe/kyl.md)
  - T-005: Bhulekh Playwright fetcher
  - T-004: Bhunaksha ArcGIS probe
  - T-010: eCourts fetcher
  - All other tasks

Exact next step for continuation:
  Start Session 003. Run T-006 (Nominatim fetcher): make packages/fetchers/nominatim/src/index.ts with fetch() and healthCheck(), User-Agent: ClearDeed/1.0, 7-day cache, write fixture. Commit. Then T-003 in parallel.

Notes for future self:
  - KYL and Bhulekh are the two hardest probes — do them last after simpler sources validate the pattern.
  - The fetcher interface is: export { fetch(input) → SourceResult, healthCheck() }. Every fetcher implements it.
  - Playwright packages installed in bhulekh and playwright-worker only — other fetchers have no Playwright dep.

Session 003 — 2026-04-16

Mode: execution
Duration: ~2 hours
Focus: Execute T-006 (Nominatim fetcher), T-005 (Bhulekh Playwright), and wire API route.
Reconstructed state from: Section 6 snapshot (Session 002).
Highest-leverage step identified: T-006 is the simplest warmup — validates the fetcher interface before harder sources.

Tasks worked:
  - [T-006] DONE — Nominatim fetcher committed (1a6fab2, 750 lines)
  - [T-005] DONE — Bhulekh Playwright fetcher committed (d9f4bfc, 391 lines)
  - [API] DONE — /api/geocode route committed (4b65640)

Decisions made:
  - (No new ADRs — executed pre-decided tasks)

Code changes (high-level):
  - packages/fetchers/nominatim/: full fetcher with cache, 3 tests, fixture
    - Renamed export to nominatimFetch to avoid Node.js global fetch shadowing
    - buildResult exported for testability
    - Fixture: 20.272688_85.701271.json (Chandaka, Khordha)
  - packages/fetchers/bhulekh/: full Playwright flow + village dictionary
    - Singleton browser instance with cleanup()
    - 20 villages (Bhubaneswar, Balianta, Balugaon tahasils)
    - Census 2011 source with English↔Odia mapping
    - 4 unit tests for village lookup
  - apps/web/src/app/api/geocode/route.ts: GET/POST geocode endpoint
  - apps/web/src/app/api/report/create/route.ts: pipeline stub
  - apps/web/next.config.ts: webpack aliases for @cleardeed/* packages
  - apps/web/tsconfig.json: path aliases for workspace packages

Sub-agents used:
  - None

What was done:
  - Fixed Node.js global fetch shadowing — renamed nominatim export to nominatimFetch
  - Resolved pnpm workspace symlink issues with webpack aliases in next.config.ts
  - Live tested /api/geocode — returns { source: nominatim, data: { district: Chandaka } }
  - Fixed tsconfig for per-package testing with vitest

What changed:
  - API routes exist and work. Nominatim is live.
  - Bhulekh fetcher is written but not yet tested against real Bhulekh site.
  - Next.js 15 + workspace package integration pattern established (use webpack aliases, not symlinks).

What is pending:
  - T-003: KYL auth probe (highest leverage if it works)
  - T-004: Bhunaksha ArcGIS probe (fallback if KYL blocked)
  - T-010: eCourts fetcher
  - T-007: Orchestrator MVP
  - T-008: PDF renderer
  - T-011: RCCMS
  - T-012: IGR deep-link
  - T-009: Lawyer dashboard
  - T-013: Auth + multi-tenant
  - T-014: Billing

Exact next step for continuation:
  Start Session 004. Run T-003 (KYL auth probe): write scripts/probe/kyl.md with working curl for coord 20.272688, 85.701271. If auth is blocked, write definitive blocked memo. Commit. Then T-004 in parallel.

Notes for future self:
  - Bhulekh Playwright flow untested against real site — needs real browser test
  - Next.js webpack aliases work but are ugly — revisit when Supabase is set up (might allow proper symlinks via pnpm)
  - Nominatim geocode returned district="Chandaka" (village used as fallback) — Nominatim in this region doesn't have county field. The tahasil/district parsing needs refinement once we have more test coords.
  - All fetchers should use named exports (nominatimFetch, bhulekhFetch) not "fetch" to avoid global shadowing in Next.js/Node.


Appendix A: Sub-Agent Brief Template
Use this exact format when delegating to a sub-agent. Save the brief in docs/sub-agent-briefs/<date>-<slug>.md so it's auditable.
# Sub-Agent Brief: <title>

Parent session: <session ID>
Created: <date>

## Objective
<One sentence. What does success look like?>

## Context (minimum sufficient)
<3-5 bullets. Only what the agent needs. Link to source files, don't paste them.>

## Inputs
- <concrete input 1>
- <concrete input 2>

## Success criteria (testable)
- <criterion 1, ideally a command that returns expected output>
- <criterion 2>

## Out of scope (explicit)
- <thing the agent must not touch>
- <thing the agent must not decide>

## Deliverable
- File path: <exact path>
- Format: <markdown / code / JSON / etc.>
- Structure: <headers or schema>

## Reporting back
On completion, the agent writes a one-paragraph summary to:
docs/sub-agent-briefs/<date>-<slug>-result.md
including: what was produced, what was attempted and abandoned, any new questions raised.

Appendix B: Source Documentation Template
Every fetcher has a corresponding docs/sources/<name>.md:
# Source: <name>

Last verified working: <date>
Owner module: packages/fetchers/<name>

## What it returns
<plain English>

## Endpoint(s)
<URL, method, headers, body shape>

## Authentication
<how, where credentials live, rotation policy>

## Rate limits
<known limits, our throttling policy>

## Schema
<TypeScript type or Zod schema reference>

## Known edge cases
<list>

## Failure modes
<list with mitigations>

## Manual verification fallback
<exact steps a lawyer takes if our fetcher fails>

## Last known good response
<link to fixtures/ file>

Appendix C: Session Kickoff Checklist
Paste this into Claude Code at the start of every session:
Reading CLAUDE.md now. Will report back with:
1. Reconstructed state (from Section 6)
2. Last session summary (from Section 7, latest entry)
3. Proposed highest-leverage next step (from Section 4 priorities)
4. Mode for this session (thinking / execution / mixed)
5. Confirmation before starting work
Appendix D: Session Wrap-Up Checklist
Paste this at the end of every session:
Wrapping up. Updating CLAUDE.md now:
1. Section 4: Task statuses changed
2. Section 5: New ADRs added (if any)
3. Section 6: State snapshot refreshed
4. Section 7: Session log entry appended

Confirming next session's exact starting action:
<action>
