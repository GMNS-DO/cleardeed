# Sub-plan B: PID Pattern Detector Writes (2026-06-25)

**Parent plan:** `2026-06-17-source-reliability-and-pid-foundation.md`
**Sibling plan:** `2026-06-25-pid-schema-wireup.md` (Sub-plan A — SHIPPED)
**Owner:** controller
**Mode:** execution (this plan is approved for execution; the pre-flight review below is the gate)

## What This Plan Delivers

Sub-plan A created the PID write layer (artifact, fact, event, property). Sub-plan B closes the loop on the **5 fraud patterns** documented in CLAUDE.md Section 3 "On fraud pattern detection": when a detector fires, the fired insight and its supporting facts persist to the corpus. Future reports on the same plot/owner/pattern can then be enriched by prior firings.

After Sub-plan B:
- 4 of 5 detectors (ROR-INS-180, ROR-INS-210, ROR-INS-211, ROR-INS-026, ROR-INS-040) write one `pid_pattern_candidates` row per candidate, one `pattern_detected` `pid_event`, and 1..N `pid_fact_assertions` per firing.
- A deterministic `candidate_key` (e.g. `ROR-INS-180:<plot_hash>`) gives idempotency — repeat firings bump `evidence_count` on the same row.
- Pattern 4 (ROR-INS-153) is **explicitly out of scope** — its detector is a documented stub awaiting T-065 (BDA Master Plan fetcher). Sub-plan B wires the persistence path for it, so when T-065 ships the detector, writes happen automatically.

## Architectural Decisions

### AD-1: Capture via consumer-report-writer return value, not callbacks

The agent `agents/consumer-report-writer/src/index.ts` currently calls `runInsights()` and consumes the result locally for rendering. Two options were considered:

- **A. Callback injection** — pass `onInsight` to `generateConsumerReport`. Tight coupling between agent and PID layer; harder to test.
- **B. Return `insights` from `generateConsumerReport`** — agent exposes `Insight[]` on its output. Pipeline captures them after the call. Cleaner contract, easier to test.

**Decision: B.** The agent's existing return type `{ html, title }` is extended to `{ html, title, insights: Insight[] }`. The pipeline reads `insights` and passes to a new `recordPatternFires()` function. The agent remains pure (no I/O, no PID imports).

### AD-2: candidate_key convention is `ruleId:<subject_hash>`

Two options for idempotency:
- **A. Composite hash** — `ROR-INS-180:` + first 3 chars of `plotNo` + first 2 chars of `khataNo`. Bumps evidence_count across plots. May over-correlate.
- **B. Per-subject hash** — `ROR-INS-180:` + sha256 of `plotNo|khataNo|tahasil|village|ownerName[0]` truncated to 16 chars. One row per unique subject. Doesn't over-correlate. Deterministic.

**Decision: B.** Per-subject hash gives clean "this same plot keeps triggering Pattern 1" semantics, which is what a corpus wants. Hash inputs come from canonical sources: `pid_properties.canonical_key` is already deterministic; we extend the convention to patterns.

### AD-3: Don't add columns to pid_fact_assertions

The discovery report flagged that `pid_fact_assertions` has no `candidate_id` column. Two options:
- **A. Migration 020** — add `candidate_id uuid fk pid_pattern_candidates(id)` to pid_fact_assertions. Clean join.
- **B. Convention via value_json** — store `ruleId` and `candidateKey` inside `value_json`. No migration. Facts stand alone; correlation happens in read paths.

**Decision: B.** Avoids another migration. The `value_json` is already indexed via GIN. Read paths already filter by `value_json->>ruleId`. Migration cost (downtime, deploy coordination) is not justified for a correlation that can be expressed in JSON.

### AD-4: New client functions, not extensions to existing

Two new functions in `apps/web/src/lib/pipeline/pid/client.ts`:
- `pidInsertPatternCandidate(input: PatternCandidateInput): Promise<string | null>` — INSERT (no conflict). Always creates a new row. The orchestrator uses `candidate_key` lookup to decide whether to upsert or insert.
- `pidUpsertPatternCandidateByKey(input): Promise<string | null>` — UPSERT on `candidate_key`. Bumps `evidence_count`, updates `updated_at`, appends to `supporting_event_ids[]`.

Caller (`recordPatternFires`) decides: first time → insert; subsequent → upsert + bump.

This mirrors how Sub-plan A handles `pidUpsertProperty` (insert) vs `pidUpsertArtifact` (upsert). Same pattern, same kill switch, same safeParse-first contract.

### AD-5: Skip ROR-INS-153 in B (no data)

The stub detector for Pattern 4 (ROR-INS-153) returns a `parser_uncertain` insight. We do NOT persist stub insights. The wire-up will work as soon as T-065 ships, but for now Pattern 4 fires the stub, the pipeline filters stubs out, and nothing is written. This is documented in the persistence function's comment.

## Task Breakdown

The plan is 6 tasks. Each is independently testable. Tasks 1-3 are pure; tasks 4-6 integrate.

### Task B.1: `pid/types.ts` — add `PatternCandidateInputSchema` + `PatternFactInputSchema` (pure)

Extend `apps/web/src/lib/pipeline/pid/types.ts`:
- New `PatternCandidateInputSchema` (Zod): `{ candidateKey, patternFamily, candidateName?, logicDescription?, ruleVersion, evidenceCount, supportingEventIds, supportingArtifactIds, metadata }`.
- New `PatternFactInputSchema` (Zod): the existing `FactAssertionInputSchema` is sufficient; we just standardize `predicate = "pattern_fired:<ruleId>"` and `value_json = { ruleId, severity, panel, headline, disclosure, candidateKey }`. Add a constant `PATTERN_FACT_PREDICATE_PREFIX = "pattern_fired:"` in the same file.
- New constant `PATTERN_EVENT_TYPE = "pattern_detected"`.
- New TypeScript types inferred from Zod.

Unit tests in `types.test.ts`:
- PatternCandidateInputSchema accepts a valid row.
- Rejects negative evidenceCount.
- Rejects missing candidateKey.
- PatternFactInputSchema's predicate convention is enforced (validates `predicate` starts with `pattern_fired:`).

**No DB changes. No new imports.**

### Task B.2: `pid/client.ts` — add `pidInsertPatternCandidate` + `pidUpsertPatternCandidateByKey` (pure-ish)

Extend `apps/web/src/lib/pipeline/pid/client.ts` with two new functions. Both follow the existing pattern:
- `safeParse` the input against the new Zod schema.
- On validation failure: `console.warn` + return null.
- Wrap the Supabase call in try/catch, log warnings, never throw.
- Use `camelToSnake()` transform (added in Sub-plan A Task A.7) for all keys.

`pidInsertPatternCandidate`: `supabase.from("pid_pattern_candidates").insert(payload).select("id").single()`.
`pidUpsertPatternCandidateByKey`: `.upsert(payload, { onConflict: "candidate_key" }).select("id").single()`.

Unit tests in `client.test.ts`:
- Both functions called with a valid input return the new id.
- Validation failure returns null.
- Supabase error returns null.
- Insert + upsert use the correct table name and onConflict key.

**Read existing pid_pattern_candidates to fetch evidence_count before upsert? NO.** Use the SQL-side `evidence_count = pid_pattern_candidates.evidence_count + 1` expression in the upsert payload. One round-trip, no read-modify-write race.

### Task B.3: `pid/record-pattern-fires.ts` — pure mapper from `Insight[]` to `PidWritePayload` (pure)

New file: `apps/web/src/lib/pipeline/pid/record-pattern-fires.ts`. Exports one function:

```ts
export function buildPatternPayload(
  insights: readonly Insight[],
  ctx: { reportId, propertyId?, candidateKeysExisting?: Set<string> }
): {
  candidates: PatternCandidateInput[],
  events: EventInput[],
  facts: FactAssertionInput[],
}
```

This is a **pure function** — no I/O, deterministic. The caller (B.4) sequences the Supabase calls.

Logic:
- For each fired insight:
  - Skip if `severity === "positive"` (not a fraud pattern).
  - Skip if `disclosure.evidenceStrength === "parser_uncertain"` (any stub detector — not only ROR-INS-153).
  - **Hash inputs are extracted from a normalized subset of `RuleInput`, NOT from what each detector happened to inspect.** ROR-INS-026 does not read plotNo; ROR-INS-040 does not read khataNo. The mapper must read them independently:
    - `plotNo = input.ror?.page2?.selectedPlotNumber ?? null`
    - `khataNo = input.ror?.page1?.khatiyan ?? null`
    - `ownerName = input.ror?.page1?.tenant?.name ?? input.claimedOwnerName ?? null`
    - `subjectGPS = input.plotGPS ?? input.ownerResidenceGPS ?? null`
    - `tahasil = input.ror?.page1?.tahasil ?? input.tehsil ?? null`
    - `village = input.ror?.page1?.village ?? input.village ?? null`
  - Canonicalize each non-null input (lowercase, trim, collapse separators) BEFORE hashing.
  - Compute `candidateKey = ruleId + ":" + sha256(canonicalized_inputs_joined_by_|).slice(0, 16)`.
  - Build one `PatternCandidateInput` with `evidenceCount: 1`, `status: "RAW_SIGNAL"`, `ruleVersion: ruleVersionFromRuleId(ruleId)`.
  - Build one `EventInput` with `eventType: "pattern_detected"`, `reviewStatus: "unreviewed"` (not the default `lead_only` — pattern events deserve the lawyer review queue), `metadata: { ruleId, candidateKey, severity, source, reportId }`.
  - Build one `FactAssertionInput` with `predicate: "pattern_fired:" + ruleId`, `value_json: { ... }`, `subjectPropertyId: ctx.propertyId ?? null`.
- **Do NOT collapse ROR-INS-210 and ROR-INS-211 even if they fire on the same EOW hit.** They have different `ruleId`s → different `candidateKey`s. Each is its own candidate. The action items differ.
- Group by `candidateKey` — if the same candidateKey appears multiple times in `insights[]` (same rule firing twice due to a re-evaluation within the same report), emit one candidate row with `evidenceCount: N`.

The `candidateKeysExisting` arg is a hint for tests. In production it's undefined; the function just emits with `evidenceCount: 1`. The caller (B.4) does the upsert-or-insert dance using Supabase's onConflict.

Unit tests in `record-pattern-fires.test.ts`:
- Empty input → empty output.
- One fired ROR-INS-180 with all ctx fields → 1 candidate, 1 event, 1 fact.
- Two fired insights on the same candidateKey → 1 candidate (evidenceCount: 2), 2 events, 2 facts.
- Skip positive severity.
- Skip `parser_uncertain` evidenceStrength (any stub detector).
- ROR-INS-026 firing without plotNo in its detector scope: candidateKey still has plotNo from `input.ror?.page2?.selectedPlotNumber` (threaded by mapper).
- ROR-INS-040 firing without khataNo in its detector scope: candidateKey still has khataNo from `input.ror?.page1?.khatiyan` (threaded by mapper).
- ROR-INS-210 + ROR-INS-211 firing on the same EOW hit → 2 distinct candidates (different ruleIds → different candidateKeys). NO collapse.
- candidateKey is deterministic (same input → same key).
- candidateKey differs across distinct subjects.
- Hash inputs are canonicalized (lowercase, trim, separators collapsed).

### Task B.4: `pid/record-pattern-fires.ts` — write side (orchestrator, not pure)

In the SAME file as B.3, add a write function:

```ts
export async function recordPatternFires(
  insights: readonly Insight[],
  ctx: { reportId, input, propertyId? }
): Promise<{ candidateIds: string[]; eventIds: string[]; factIds: string[] } | null>
```

Logic:
1. Call `buildPatternPayload(insights, ctx)`.
2. If no candidates/events/facts, return null (short-circuit).
3. For each candidate: do a `select id from pid_pattern_candidates where candidate_key = $1` first (pre-read). The unique index on `candidate_key` is created in migration 006 (`pid_pattern_candidates.candidate_key text unique` per `006_pid_core.sql:392`). If exists → upsert via `pidUpsertPatternCandidateByKey`. If not → insert via `pidInsertPatternCandidate`.
4. For each event: `pidInsertEvent`. (No dedup — events are append-only by design.)
5. For each fact: `pidInsertFactAssertion`.
6. Catch any unexpected throw from a single insert; log warn, continue with others. Never throw out.
7. Return the IDs.

Kill switch: `if (process.env.PID_RECORDING_ENABLED !== "true") return null;` — same env var as Sub-plan A's `recordFetchResult`. No new env var. Same OFF-default in production.

Unit tests in `record-pattern-fires.test.ts`:
- Kill switch OFF → returns null.
- Empty insights → returns null.
- One insight, first time → insert path; returns 1 candidate id.
- One insight, second time (candidate_key exists) → upsert path; returns same candidate id.
- All Supabase errors → returns null, never throws.

### Task B.5: `pipeline/index.ts` — capture insights + call recorder (integration)

In `generateReportV11` (and `generateReport` if needed for symmetry):
- Read `runInsights` output — but `runInsights` is called INSIDE `consumer-report-writer`, not in the pipeline. So this task is: **add `insights: Insight[]` to `generateConsumerReport()` return value**.

Two implementation sites (both must be wired — silent skip risk if only one is touched):
1. `agents/consumer-report-writer/src/index.ts:213` and `:1146` — both `runInsights` calls. Expose the local `insights` array on the function's return.
2. `agents/consumer-report-writer/src/index.ts` `generateConsumerReport` return type → add `insights: Insight[]`. Verify both call sites populate it (the local variable is already in scope; just add to the return object).

3. `apps/web/src/lib/pipeline/index.ts` — after the Sub-plan A recording block, call `recordPatternFires(reportInput.insights, { reportId, input, propertyId })`. Confirm this is reached in BOTH `generateReport` (V1.0) and `generateReportV11` (V1.1) — the existing recording block in V11 may need to be mirrored in V10.

4. The `insights` is in scope after the call to `generateConsumerReport` (the local `insights` array from the agent's internals becomes `result.insights`).

Tests:
- `agents/consumer-report-writer/src/index.test.ts`: existing tests should still pass; add one that asserts `generateConsumerReport().insights.length > 0` for a sample input.
- `apps/web/src/lib/pipeline/index.ts` unit tests: assert `recordPatternFires` is called when `PID_RECORDING_ENABLED=true` and `insights.length > 0`. Mock `recordPatternFires` to assert the call.

### Task B.6: `qa/pid_smoke/pattern-fires.test.ts` — live smoke (operator-gated)

Mirror the Sub-plan A smoke test pattern. Gated on `RUN_PID_SMOKE=1` AND `RUN_PID_PATTERN_SMOKE=1` (so it's independently toggleable).

Generate a real report on the demo plot (Mendhasala 309). After `generateReportV11()` returns, query `pid_pattern_candidates`, `pid_events`, `pid_fact_assertions` for that reportId. Assert:
- `pid_pattern_candidates` count >= 1 (ROR-INS-180 OR ROR-INS-040 should fire on a real Khordha plot; both have tests).
- `pid_events` count >= (number of fired insights) — append-only.
- `pid_fact_assertions` count >= 1.
- All rows have valid `ruleId` in their metadata/value_json.

Output JSON to `qa/pid_smoke/pattern-fires-1.json` for ops review.

Run gate:
```bash
set -a && source .env.local && set +a
RUN_PID_SMOKE=1 RUN_PID_PATTERN_SMOKE=1 PID_RECORDING_ENABLED=true pnpm vitest run qa/pid_smoke/pattern-fires.test.ts
```

## Out of Scope

- **Pattern 4 (ROR-INS-153) actual detector** — T-065 (BDA Master Plan fetcher) is upstream. The persistence path is wired in this plan; the detector will Just Work once T-065 ships.
- **Read paths in the buyer report** — showing the corpus to buyers ("X other reports on this plot triggered Pattern 1") is Sub-plan C. Sub-plan B writes only.
- **Review status lifecycle** — promoting `RAW_SIGNAL` → `CANDIDATE` → `VALIDATED` requires a human-in-the-loop review tool. Out of scope for this plan.
- **Migration 020** — no DB changes. The schema from 006 is sufficient.
- **PID similarity search** — already exists (line 1108 of pipeline/index.ts), pre-dates this plan. Not touched.

## Risks

- **R1: `generateConsumerReport` is called from many call sites.** Changing its return type is a wide blast radius. Mitigation: the new field is additive (just adds `insights: Insight[]` to the object). Existing callers that destructure `{ html, title }` won't break.
- **R2: `runInsights` is called twice (lines 213 and 1146).** Both must expose insights. Mitigation: both call sites use the same local `const insights: Insight[] = runInsights(...)` — the variable is in scope, just needs to be added to the return.
- **R3: Stub detectors (parser_uncertain) may pollute the corpus.** Not just ROR-INS-153 (BDA) — any detector with `evidenceStrength === "parser_uncertain"` in its returned insight must be filtered. Mitigation: B.3 mapper has an explicit filter that drops ALL `parser_uncertain` insights, regardless of ruleId. Tested in B.3 unit tests.
- **R4: Hash inputs may be missing for some detectors.** ROR-INS-026 doesn't read plotNo; ROR-INS-040 doesn't read khataNo. Mitigation: B.3 mapper extracts hash inputs from a normalized subset of `RuleInput` (`plotNo = input.ror?.page2?.selectedPlotNumber`, etc.) — NOT from what each detector inspected. Hash inputs are independent of detector reads.
- **R5: ROR-INS-210 + ROR-INS-211 same-EOW collapse risk.** Both fire on the same EOW hit but are different rules with different action items. Mitigation: B.3 does NOT collapse them — different `ruleId`s → different `candidateKey`s. Each is its own candidate.
- **R6: Kill switch env var name.** Match Sub-plan A's `PID_RECORDING_ENABLED`. Do NOT introduce a new env var. Same OFF-default in production.
- **R7: reviewStatus default.** `EventInputSchema` defaults to `lead_only`; pattern events should be `unreviewed` so the lawyer-review queue picks them up. B.4 explicitly sets `reviewStatus: "unreviewed"` on every pattern_detected event.
- **R8: T-051b dependency for ROR-INS-026.** ROR-INS-026 (Malipada) requires `ownerResidenceGPS` plumbing. T-051b closed that gap (CLAUDE.md Session 064). Verify the deployment that ran the smoke test has T-051b live before relying on ROR-INS-026 firing on real customer input. For the live smoke test (B.6), the demo plot's owner residence may not geocode successfully — ROR-INS-026 firing is best-effort.

## Definition of Done

- [ ] All 6 tasks shipped as individual commits
- [ ] `pnpm vitest run apps/web/src/lib/pipeline/pid/ qa/pid_smoke/pattern-fires.test.ts` — 100% pass
- [ ] Smoke test output JSON shows real Supabase rows with non-empty `value_json` containing `ruleId` + `candidateKey`
- [ ] All 4 of 5 patterns that have implemented detectors write at least one row per real report (Pattern 4 stub explicitly excluded)
- [ ] Pre-flight review confirms: AD-1 (return value) is feasible at the 2 `runInsights` call sites; AD-2 (per-subject hash) covers all 4 detectors; AD-4 (insert+upsert split) is consistent with Sub-plan A conventions
- [ ] Ledger entry written to `.git/sdd/progress.md`

## Pre-flight Plan Review (gate)

Before executing B.1, the controller runs a pre-flight review. The reviewer agent checks:

1. **AD-1 feasibility** — can `generateConsumerReport()` be extended to return `insights` without breaking the agent's purity? The agent must not gain DB imports. (Expect: yes, the agent stays pure; only the return type changes.)
2. **AD-2 hash inputs** — does each of the 4 implemented detectors have stable, canonical inputs for the hash? (e.g. ROR-INS-180 reads `plotNo` from ROR — does ROR always have a plotNo? ROR-INS-040 has a `plotNo` from the plots array. ROR-INS-026 has `plotGPS` + `ownerResidenceGPS`. ROR-INS-210/211 use `plotNo + khataNo` from EOW. All have stable inputs.)
3. **AD-4 client function shape** — does the `singleInsert` error return in Sub-plan A's `client.ts` distinguish unique-violation from other errors? If not, B.4's "insert first, then upsert on conflict" path needs a pre-read instead. (Read `client.ts` to confirm; if `singleInsert` swallows the error code, B.4 will do a `select * from pid_pattern_candidates where candidate_key = $1` first.)
4. **No double-write of events** — Sub-plan A's `recordFetchResult` already writes a `fetch_completed` event per fetcher. Does B.4 also write events for the same report? Yes — but they're different `eventType` values (`fetch_completed` vs `pattern_detected`). No collision.
5. **Insight[] is small** — typical Khordha report has 0-3 fired insights. B.4's loop is bounded. No perf concern.

If any of these fail, the plan returns to drafting. Otherwise: execute B.1 → B.6 in order.

## Commits Expected

1. `feat(pid): add PatternCandidateInputSchema + pattern_fired predicate constant (Task B.1)`
2. `feat(pid): add pidInsertPatternCandidate + pidUpsertPatternCandidateByKey (Task B.2)`
3. `feat(pid): buildPatternPayload pure mapper (Task B.3)`
4. `feat(pid): recordPatternFires orchestrator with kill switch (Task B.4)`
5. `feat(pipeline): expose insights from consumer-report-writer + call recordPatternFires (Task B.5)`
6. `test(pid): pattern-fires live smoke test (Task B.6)`
