# Data Integrity Sprint — 2026-07-13

## Goal

Fix every TypeScript error, unify all fetcher return shapes, validate live data against real production servers, and complete all stub insight rules — in that order. End state: zero TypeScript errors, all tests passing green, all 34 insight rules returning real data from real fetchers.

## Sprint Constraints

- **No security work.** Authentication, authorization, payment security, and credential management are out of scope. Do not touch auth helpers, Supabase RLS, webhook signatures, or any file in `apps/web/src/lib/auth*` or `apps/web/src/lib/pricing*`.
- **No new features.** No new fetchers, no new report sections, no new insight rules beyond completing existing stubs.
- **No schema migrations.** PID tables are live; do not add new migrations.
- **One commit per task.** Branch discipline holds throughout.

---

## Phase 1: Foundation (Days 1–3) — TypeScript Errors to Zero

### F1.1: Fix natural_hazard type in shared schema

The `natural_hazard` source type in `packages/schema/src/index.ts` has a wrong type annotation — it references a type that doesn't exist or is misnamed.

**Files:** `packages/schema/src/index.ts`
**Success:** `pnpm typecheck` clean for the schema package
**Verification:** `cd packages/schema && pnpm typecheck` exits 0

### F1.2: Unify fetcher return shapes

Two incompatible patterns exist across fetchers:

| Pattern A | Pattern B |
|-----------|-----------|
| `ok / no_data / source_down` | `success / partial / failed` |
| Used by: Bhulekh, Bhunaksha | Used by: Nominatim, BDA-Zoning, Circle-Rate |

Pick Pattern B (`success / partial / failed`) as the canonical shape. Migrate Bhulekh and Bhunaksha to use it. Ensure `status: "success" | "partial" | "failed"` and `statusReason: string` are on all `SourceResultBase` extensions.

**Files:** `packages/fetchers/bhulekh/src/index.ts`, `packages/fetchers/bhunaksha/src/index.ts`, `packages/schema/src/index.ts`
**Success:** All fetchers return consistent `status` enum values
**Verification:** `pnpm typecheck` on each fetcher package exits 0

### F1.3: Export missing fetcher result types

`BdaZoneResult`, `CircleRateResult`, and other fetcher result types are defined but not exported from their packages or from `packages/schema/src/index.ts`.

**Files:** `packages/fetchers/bda-zoning/src/index.ts`, `packages/fetchers/circle-rate/src/index.ts`, `packages/schema/src/index.ts`
**Success:** `import { BdaZoneResult, CircleRateResult } from "@cleardeed/schema"` compiles
**Verification:** TypeScript import resolves in `agents/consumer-report-writer/src/mapper.ts`

### F1.4: Fix mapper type mismatches

The consumer-report-writer mapper (`agents/consumer-report-writer/src/mapper.ts`) has TypeScript errors where it tries to read fields from fetcher results that don't exist or are named differently.

**Files:** `agents/consumer-report-writer/src/mapper.ts`, `agents/consumer-report-writer/src/types.ts`
**Success:** `pnpm typecheck` in the agent package exits 0
**Verification:** `cd agents/consumer-report-writer && pnpm typecheck` exits 0

### F1.5: Fix next.config.ts

`apps/web/next.config.ts` has TypeScript errors that block `pnpm typecheck` in the web app.

**Files:** `apps/web/next.config.ts`
**Success:** `cd apps/web && pnpm typecheck` exits 0

### F1.6: Fix module-not-found errors in routes

Run `pnpm typecheck` across the web app to find all `Cannot find module` errors in route files and API handlers. Survey the full error list, then fix them in dependency order (leaf modules first).

**Files:** `apps/web/src/app/api/**/route.ts`, `apps/web/src/app/report/**/page.tsx`
**Success:** `cd apps/web && pnpm typecheck` exits 0

### F1.7: Fire the full test suite

Run the full test suite to get a clean baseline. Count failures before fixing — use the failure count as the sprint progress meter.

**Command:** `pnpm test` in repo root
**Success:** Known baseline — all pre-existing failures documented, new failures introduced by Phase 1 fixes are zero
**Verification:** Suite runs to completion, output shows `X passing, Y failing`

---

## Phase 2: Data Integrity — Days 4–7

### F2.1: Validate Bhulekh output against real Bhordha data

Live-probe Bhulekh with real Khordha coordinates (test village Mendhasala, plot 415 from the golden path) and confirm:

- `plot_number`, `khatiyan_number`, `area_acres`, `owner_names[]`, `kisam`, `rightsOdia` all parse correctly
- `landTypeOdia` matches the plot-row value (not first-row fallback)
- Area calculation uses matching plot row only (confirmed in T-029)
- `mutationReferences` extracts anchors from remarks correctly
- Owner name Odia→English transliteration is consistent

**Files:** `packages/fetchers/bhulekh/src/index.ts`, `packages/fetchers/bhulekh/fixtures/`
**Success:** Golden path Bhulekh fixture matches live probe output
**Verification:** Write fixture to `packages/fetchers/bhulekh/fixtures/golden-path-2026-07.json`, compare against live probe

### F2.2: Validate eCourts output against real Khurda data

Run 5 eCourts probes with confirmed-real party names (from Bhulekh owner names) against Khurda district. Measure captcha solve rate. Confirm case number and court name fields populate correctly.

**Files:** `packages/fetchers/ecourts/src/index.ts`, `packages/fetchers/ecourts/fixtures/`
**Success:** Real cases returned with correct `caseNo` and `court` fields, OR confirmed zero cases with valid captcha
**Verification:** `qa/ecourts_probe_2026-07.json` captures results

### F2.3: Validate Bhunaksha output against real Mendhasala data

Confirm plot polygon, area (acres), and village name parse correctly from the WFS response for the golden path coordinates.

**Files:** `packages/fetchers/bhunaksha/src/index.ts`, `packages/fetchers/bhunaksha/fixtures/`
**Success:** Bhunaksha fixture matches live WFS probe output
**Verification:** Write fixture to `packages/fetchers/bhunaksha/fixtures/golden-path-2026-07.json`

### F2.4: Add fixtures for untested fetchers

Create anonymized fixtures for fetchers that have code but no fixture:
- `bda-zoning/fixtures/seed.json`
- `circle-rate/fixtures/khordha-2026-07.json`
- `bhuvan-flood/fixtures/placeholder.json`
- `cersai/fixtures/placeholder.json`

**Files:** `packages/fetchers/*/fixtures/`
**Success:** Each fetcher package has at least one fixture file
**Verification:** `pnpm test` in each fetcher package with fixture-based tests exits 0

### F2.5: Fix any fetcher parser shape mismatches found in Phase 2

Fix any fetcher that returns a different shape than its contract declares.

**Files:** Per fetcher, as discovered
**Success:** All fetcher contracts match their live output shapes

---

## Phase 3: Insight Rules — Days 8–12

### F3.1: Group 1 — Bhulekh-derived rules

| Rule ID | Name | Status | Notes |
|---------|------|--------|-------|
| ROR-INS-153 | BDA Industrial Zone | stub | Reads `bdaZoneData.data[].zone.id`; needs BDA fetcher wired |
| ROR-INS-180 | Lease-to-Freehold (Patia) | stub | Fires on `rightsOdia` + `rawKisamOdia` signals |
| ROR-INS-152 | Subdivided Plot Without BDA Layout | stub | Sub-plot indicator + no BDA approval |
| ROR-INS-155 | Title Chain Gaps | stub | Bhulekh back-page transaction history |
| ROR-INS-156 | Back-Page Remarks Red Flags | stub | Special remarks / plot remarks from Bhulekh page 2 |

**Success:** All 5 rules return non-null insight objects with correct `severity` and `financialExposure`

### F3.2: Group 2 — Court-derived rules

| Rule ID | Name | Status | Notes |
|---------|------|--------|-------|
| ROR-INS-160 | CERSAI Encumbrance | stub | CERSAI fetcher wired; rule reads mortgage data |
| ROR-INS-161 | eCourts Active Cases | stub | eCourts result wired; rule fires on case count > 0 |
| ROR-INS-162 | High Court Cases | stub | High court fetcher wired; rule fires on case count > 0 |
| ROR-INS-163 | Court Financial Risk | stub | Cross-refs eCourts + high court + DRT financial exposure |
| ROR-INS-026 | Malipada Impersonation | partial | Owner residence GPS wired in T-051b; needs distance check |

**Success:** All 5 rules return non-null insight objects with correct `severity` and `financialExposure`

### F3.3: Group 3 — Geospatial-derived rules

| Rule ID | Name | Status | Notes |
|---------|------|--------|-------|
| ROR-INS-170 | BDA Zoning Check | stub | BDA fetcher wired; rule fires on non-residential zone |
| ROR-INS-171 | Bhuvan Flood Zone | stub | Bhuvan fetcher wired; rule fires on Zone B/C |
| ROR-INS-172 | Neighbouring Owner Risk | stub | Bhunaksha adjacent plot check |
| ROR-INS-173 | Area Cross-Anomaly | stub | Bhulekh vs Bhunaksha area reconciliation |

**Success:** All 4 rules return non-null insight objects with correct `severity` and `financialExposure`

### F3.4: Group 4 — Registry-derived rules

| Rule ID | Name | Status | Notes |
|---------|------|--------|-------|
| ROR-INS-181 | IGR Completeness | stub | IGR concierge wired; rule checks IGR response |
| ROR-INS-182 | Deed Type Risk | stub | IGR deed type cross-check |
| ROR-INS-183 | Plot Diagram Mismatch | stub | Bhulekh plot number vs Bhunaksha polygon |

**Success:** All 3 rules return non-null insight objects with correct `severity` and `financialExposure`

### F3.5: Verify all 34 insight rules fire on golden path

Run the consumer-report-writer on the golden path fixture and confirm the expected rules fire with correct severity.

**Command:** `cd agents/consumer-report-writer && pnpm test -- --grep "golden"`
**Success:** All expected rules appear in output with correct `severity` and `financialExposure`

---

## Phase 4: Test Suite — Days 13–14

### F4.1: Zero test failures

Fix all remaining test failures introduced by Phase 1–3 changes.

**Command:** `pnpm test`
**Success:** `X passing, 0 failing` — all tests green

### F4.2: Run full typecheck across all packages

```bash
cd packages/schema && pnpm typecheck
cd packages/fetchers/bhulekh && pnpm typecheck
cd packages/fetchers/bhunaksha && pnpm typecheck
cd packages/fetchers/nominatim && pnpm typecheck
cd packages/fetchers/ecourts && pnpm typecheck
cd agents/consumer-report-writer && pnpm typecheck
cd apps/web && pnpm typecheck
```

**Success:** All packages exit 0

### F4.3: Smoke test the pipeline end-to-end

Run the pipeline against the golden path coordinates and confirm a report generates without errors.

**Command:** `node scripts/golden-path.ts`
**Success:** Report ID returned, all sources fired, no TypeScript errors in pipeline output

---

## Success Criteria

| Metric | Before | After |
|--------|--------|-------|
| TypeScript errors (web app) | ~50+ | 0 |
| TypeScript errors (fetchers) | ~20+ | 0 |
| Test failures | ~13 pre-existing | 0 |
| Insight rules with stub | 34 | 0 |
| Fetchers with live fixture | 4 | all active |
| `pnpm typecheck` web app | fails | passes |
| `pnpm test` | ~1,782 passing, ~13 failing | all passing |

---

## Out of Scope

- Security / auth / billing changes
- New fetcher development
- New report sections
- Schema migrations
- Production deployment (this is a local/branch sprint)
- PID write-path completion (Sub-plan A in progress separately)
- Captcha-breaker work (Sub-plan B in progress separately)

---

## Files Created by This Sprint

```
docs/superpowers/plans/2026-07-13-data-integrity-sprint.md  ← this file
qa/ecourts_probe_2026-07.json                              ← F2.2 probe results
qa/golden-path-2026-07.json                                 ← F2.1 probe results
packages/fetchers/*/fixtures/*.json                         ← F2.4 fixture files
```

## Dependencies

- Phase 1 must complete before Phase 2 (types must be clean before validating live data)
- Phase 2 must complete before Phase 3 (rules read fetcher output — output shape must be stable)
- Phase 3 must complete before Phase 4 (rules must not be stub before final test run)
