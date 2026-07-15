# Task 0.1 — Typed "fire" gate per source

## Source plan
docs/superpowers/plans/2026-06-17-source-reliability-and-pid-foundation.md (lines 58–217)

## Goal
Add a single source-of-truth `isSourceFired` predicate (and a per-source `FireEnvelope` table) that the rest of the system can call to answer: "For this source, for this report, did it actually fire and contribute a meaningful data point?" The typed gate replaces the current status-string checks scattered across A10, A11, and the orchestrator. It must be:

- **Typed, not string-typed.** A `SourceId` literal union and a discriminated `FireEnvelope` (per `SourceId`) replace the existing `SourceResultBase.status` string checks.
- **Single source of truth.** One module, re-used by every later task. Per the plan's Global Constraints, all 25 fetcher tasks will read from this gate.
- **TDD-first.** Steps 1–3 are TDD: red test → implement → green. Step 4 is the integration wiring.

## Public surface (must match exactly)

```ts
// apps/web/src/lib/pipeline/contracts/fire.ts (or similar — choose the path)
export type SourceId =
  | "bhulekh"
  | "ecourts"
  | "rccms"
  | "igr-ec"
  | "rera"
  | "cersai"
  | "high-court"
  | "drt"
  | "bhunaksha"
  | "nominatim"
  | "bda-zoning"
  | "circle-rate"
  | "stamp-duty"
  | "igr-bmv"
  | "igr-daily-bulletin"
  | "public-dashboard"
  | "govt-fee"
  | "igr-certified-copy"
  | "igr-sro"
  | "larr"
  | "bhunaksha-plot-report";

export type FireEnvelope =
  | { source: "bhulekh"; fired: true; plotNo: string | null; khataNo: string | null }
  | { source: "ecourts"; fired: true; caseCount: number }
  | { source: "rccms"; fired: true; caseCount: number }
  | { source: "igr-ec"; fired: true; ecReference: string | null; certifiedCopyAvailable: boolean }
  | { source: "rera"; fired: true; projectName: string | null; registrationNo: string | null }
  | { source: "cersai"; fired: true; chargeCount: number }
  | { source: "high-court"; fired: true; caseCount: number }
  | { source: "drt"; fired: true; caseCount: number }
  | { source: "bhunaksha"; fired: true; plotNo: string | null; villageName: string | null }
  | { source: "nominatim"; fired: true; district: string | null; tahasil: string | null; village: string | null }
  | { source: "bda-zoning"; fired: true; zone: string | null; inIndustrialZone: boolean }
  | { source: "circle-rate"; fired: true; benchmarkPerAcre: number | null; sourceVintage: string | null }
  | { source: "stamp-duty"; fired: true; ratePct: number | null; expectedAmount: number | null }
  | { source: "igr-bmv"; fired: true; guidelineValue: number | null; villageName: string | null }
  | { source: "igr-daily-bulletin"; fired: true; bulletinDate: string | null; deedCount: number }
  | { source: "public-dashboard"; fired: true; scannedPageUrl: string | null }
  | { source: "govt-fee"; fired: true; conversionFeeEstimate: number | null }
  | { source: "igr-certified-copy"; fired: true; certifiedCopyUrl: string | null }
  | { source: "igr-sro"; fired: true; sroName: string | null; sroAddress: string | null }
  | { source: "larr"; fired: true; notificationId: string | null; notificationDate: string | null }
  | { source: "bhunaksha-plot-report"; fired: true; plotAreaSqm: number | null; perimeterM: number | null };

export type FireResult =
  | { fired: true; envelope: FireEnvelope }
  | { fired: false; reason: "no_data" | "source_down" | "invalid_input" | "parse_error" | "skipped_dormant" };

export function isSourceFired(
  source: SourceId,
  result: unknown
): FireResult;
```

`isSourceFired` is the single public function. The per-source branch must narrow the input to its own `SourceResultContract` type (the one defined in `apps/web/src/lib/pipeline/contracts/<source>.ts`) and produce a typed `FireEnvelope` for that `SourceId`.

## Step-by-step (TDD)

### Step 1 — RED: write a failing contract test
File: `apps/web/src/lib/pipeline/contracts/fire.test.ts`

Test cases (one per branch — minimum 8):
1. `bhulekh` with `status: "ok"` and parsed plot/khata → `fired: true` with `plotNo`, `khataNo`.
2. `bhulekh` with `status: "no_data"` (placeholder) → `fired: false`, `reason: "no_data"`.
3. `ecourts` with `status: "ok"` and `cases: []` → `fired: true`, `caseCount: 0` (zero is a real fire).
4. `ecourts` with `status: "no_data"` → `fired: false`, `reason: "no_data"`.
5. `cersai` with `status: "ok"` and `charges: []` → `fired: true`, `chargeCount: 0`.
6. `rera` with `status: "ok"` and `projectName: null` → `fired: true`, `projectName: null` (per envelope shape — null project is still a real probe).
7. Unknown source id → compile error (this is the test, via `// @ts-expect-error`).
8. `nominatim` with `status: "source_down"` → `fired: false`, `reason: "source_down"`.

Run tests. **They must fail with "module not found" or "isSourceFired is not a function".** That is the TDD red step.

### Step 2 — GREEN: implement the gate
File: `apps/web/src/lib/pipeline/contracts/fire.ts`

- Export `SourceId`, `FireEnvelope`, `FireResult`, `isSourceFired`.
- Per-source branch: narrow `result` to its contract shape via Zod (use the contract schema already in `apps/web/src/lib/pipeline/contracts/<source>.ts` — read them first; do not re-define them).
- Return typed `FireResult` for each source. Switch over `source` literal — TypeScript will check exhaustiveness.
- For `fired: false`, return `{ fired: false, reason: <ContractStatus> }` from the contract status enum (`"ok" | "no_data" | "source_down" | "invalid_input" | "parse_error"`) plus the additional `"skipped_dormant"` literal (used by orchestrator when a source is V1.1-DORMANT).

Run tests. **All 8 must pass.**

### Step 3 — Snapshot
For each existing per-source contract (`apps/web/src/lib/pipeline/contracts/*.ts`), the gate should now expose typed `FireEnvelope` shapes. Add one snapshot test per source that captures the *current* envelope shape as a string literal — this protects against accidental envelope drift in later fetcher tasks. Use vitest's `toMatchInlineSnapshot` (or `toMatchFileSnapshot` if you prefer a separate `__snapshots__` file).

### Step 4 — Wire into the orchestrator
File: `packages/orchestrator/src/index.ts` (or wherever the orchestrator currently maps `SourceResult` into the report input)

- After the orchestrator produces its current `SourceResult[]`, build a `Map<SourceId, FireResult>`.
- Pass the `Map` into the pipeline (extend `Tier2Input` or a new field — your call, but be consistent).
- A10 consumer report writer should use this map for "Did Bhulekh fire?" / "Did eCourts fire?" / etc. queries, replacing the current string-typed checks.
- Do NOT change A10's rendered copy in this task. Just wire the data. A10 follow-up tasks can adopt the new gate; this task is plumbing only.

## Files to read first (REQUIRED before coding)

- `docs/superpowers/specs/2026-06-17-source-reliability-and-pid-foundation-design.md` — sections 2.1 (FireEnvelope), 2.2 (SourceId), 4.1 (gate semantics)
- `apps/web/src/lib/pipeline/contracts/types.ts` — `ContractStatus`, `ContractEnvelopeBase`
- `apps/web/src/lib/pipeline/contracts/index.ts` — barrel of all contract schemas
- `apps/web/src/lib/pipeline/contracts/<source>.ts` for each of the 21 sources — your branch must narrow `result` against the actual schema
- `packages/schema/src/index.ts` — the legacy `SourceResultBase` (do NOT use it for the new gate; the new gate is the canonical source of truth)
- `agents/consumer-report-writer/src/index.ts` — find the current string-typed `source.status === "success"` checks (those are what you're replacing)
- `packages/orchestrator/src/index.ts` — find where `SourceResult[]` is built (this is where the map gets computed)

## Out of scope (do NOT do these)

- Do not modify any fetcher implementation (eCourts, Bhulekh, RCCMS, etc.). This task is *gate* only.
- Do not modify A10's rendered report copy. Just wire the gate plumbing.
- Do not change A11's audit rules. A11 follow-up task will adopt the gate.
- Do not add new sources. The 21 sources listed in the `SourceId` union are the only ones.
- Do not add status mappers between the legacy `SourceResultBase.status` and the new `ContractStatus`. The new gate reads the contract schema directly.
- Do not add documentation files (no `docs/`, no README updates). Code only.

## Plan-mandated constraints (must follow verbatim)

- Single source of truth: one module, no parallel implementations.
- Typed, not string-typed: `SourceId` is a literal union, `FireEnvelope` is a discriminated union.
- TDD: red → green → snapshot → wire.
- No fetcher changes.
- No A10 copy changes.

## Test coverage requirements

- Minimum 8 unit tests (one per branch class shown above).
- One snapshot test per existing source contract (21 snapshots total).
- One wire test: feed the orchestrator a `SourceResult[]` and assert the `Map<SourceId, FireResult>` is built correctly.

## Deliverables

1. `apps/web/src/lib/pipeline/contracts/fire.ts` — the gate
2. `apps/web/src/lib/pipeline/contracts/fire.test.ts` — the unit tests
3. `apps/web/src/lib/pipeline/contracts/fire.snapshot.test.ts` — the snapshot tests
4. Wire-up edits in `packages/orchestrator/src/index.ts` (and downstream if needed) — the plumbing
5. Report file: `docs/superpowers/plans/task-0.1-report.md` with: status, commits (base..head), one-line test summary, any concerns

## Report contract

Write the report to `docs/superpowers/plans/task-0.1-report.md` and return ONLY the following to me:
- Status: DONE | DONE_WITH_CONCERNS | NEEDS_CONTEXT | BLOCKED
- Commits: `<base7>..<head7>`
- Tests: `<N>/<N> passing in <test-file(s)>`
- One-line test summary
- Concerns (if any)

Commit frequently. Use the existing repo's commit style (look at `git log --oneline -5` for examples).
