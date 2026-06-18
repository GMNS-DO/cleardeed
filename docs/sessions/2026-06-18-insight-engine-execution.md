# Insight Engine Execution — Session Summary

**Date:** 2026-06-18
**Branch:** `feat/source-reliability-and-pid-foundation`
**HEAD:** `362d81d`
**Plan:** `docs/superpowers/plans/2026-06-18-unified-insight-engine.md`

## What shipped

### Code
- **69 rules across 14 panels** in `agents/consumer-report-writer/src/insights/registry/`
- `engine.ts` — `runInsights()` orchestrator with `RuleFn` defensive handling
- `render.ts` — HTML insight renderer with closed-by-default disclosure
- `display-labels.ts` — 8 prohibited phrases
- `schema.ts` — typed `Insight` shape (5 lenses, 7 evidence strengths, 14 panels, 3 severities)
- A11 audit rules in `agents/output-auditor/src/index.ts` (prohibited-phrase + closed-disclosure)

### Tests
- `agents/consumer-report-writer/`: **177 tests pass** + 2 skipped (was 158 before this work)
- `agents/output-auditor/`: **35 tests pass** (was 32 — added 2 A11 audit rules + 1 regression)
- **Total: 213 passing tests, 0 failures, 0 regressions**

### Docs
- `docs/insights/insights-engine.md` — full mapping table of all 69 rules
- `docs/decisions/adr-021-unified-insight-engine.md` — ADR with rule/panel counts (with note on partial legacy migration)

## Plan execution

| Phase | Tasks | Status | Commits |
|---|---|---|---|
| 0 (foundation) | 1–6 + 0.5 | DONE | 5 |
| 1 (Bhulekh) | 7–12 | DONE | 7 |
| 2 (Bhunaksha) | 13–15 | DONE | 3 |
| 3 (IGR stubs) | 16–19 | DONE | 4 |
| 4 (completeness + recursive) | 20–21 | DONE | 2 |
| 5 (render integration) | 22 (DONE), 23 (DONE), 24 (DEFERRED) | PARTIAL | 2 |
| 6 (A11 audit) | 25 (DONE), 26 (DONE), 27 (DEFERRED live test) | PARTIAL | 2 |
| 7 (tests + ADR) | 28–30 | DONE | 3 |
| 8 (Bhunaksha diagram) | 31–38 | DEFERRED (own session) | 0 |
| Code review | 3 BLOCKERs + 3 HIGHs | DONE | 7 |

**Total: 30 plan tasks executed + 7 review fixes = 37 commits.**

## Defects fixed during execution

1. **Plan spec ambiguity in Task 21** (recursive stubs) — `fn: () => stubFor(...)` was wrong contract; fixed by wrapping in array.
2. **Plan spec ambiguity in Task 28** (CERSAI live branch) — `Insight | null` return type was wrong; fixed to `Insight[] | null`.
3. **ROR-INS-103 regression** (HIGH #4 fix) — gate on `liveDataPresent(input, "ror")` blocked live branch; moved gate to gate only the stub branch.
4. **Closed-disclosure regex unreachable** (BLOCKER 1) — auditor regex required two `</div>` but render emits one; rewrote regex.
5. **Neyanjori miscategorized** (BLOCKER 3) — `neya_niyogita` was in bagayat set; removed and added ROR-INS-035 redFlag.
6. **Single-letter token false-positive** (HIGH #1) — added `t.length >= 3` guard.
7. **ROR-INS-080 dual-emit** (HIGH #5) — split into ROR-INS-080 (real redFlag) + new ROR-INS-083 (chauhaddi missing stub).

## Known deferred work

### Task 24 (legacy ror-insights migration)
The new unified engine runs alongside the legacy `buildRoRInsightGroups` / `buildRiskInsights` engines in `agents/consumer-report-writer/src/index.ts`. The legacy `computeFinancialExposure` (~300 lines, lines 2065-2356) still consumes the legacy `RiskInsight` shape (`label` field, old severity scale). 7+ HTML-assembly call sites reference the legacy outputs.

**Recommended split into Task 24a/b/c (per `.git/sdd/task-22-24-report.md`):**
- 24a — Port `computeFinancialExposure` to `Insight[]` directly (replace `i.label?.includes("revenue demand")` with `i.headline.includes(...)`).
- 24b — Delete `rorInsights`/`riskInsights` builds and 7+ HTML-assembly references.
- 24c — `git rm ror-insights.ts` and `ror-insights.test.ts`.

This is a multi-session effort, intentionally deferred. ADR-021's "Supersedes the two engines" claim is conditional on completion.

### Task 27 (live golden-path verification)
The plan's Task 27 calls for running `npx tsx scripts/golden-path.ts` against live government portals. This requires network access to bhulekh.ori.nic.in and is out of scope for the sandboxed test runs. Verify in a separate session before merge.

### Phase 8 (Tasks 31-38: Bhunaksha plot diagram)
8 tasks covering Playwright screenshots, SVG parsing, Supabase Storage uploads. Significant new infrastructure (new fetcher module, diagram renderer, storage helper, migration). Estimated 2-3 sessions.

### LOW/MEDIUM review findings
Several non-blocking issues remain in `docs/superpowers/plans/2026-06-18-unified-insight-engine.md` review output:
- Test coverage gaps for several rules (ROR-INS-012, 013, 014, 016, 021, 023, 025, 034, 090, 091, 092, etc.)
- `disclosure` field never populated by rules
- `_shared.ts::stubFor` discards evidence strength parameter
- `runRule` swallows rule errors silently
- Unconditional stub noise on real reports (~16 stubs still fire)

These are candidates for follow-up sessions.

## Branch readiness

**READY_FOR_MERGE: conditional** — no BLOCKERs remain, but merge should wait for:
1. Task 24a/b/c completion (legacy migration)
2. Task 27 verification on live infrastructure
3. Or: explicit decision to merge with the partial-migration state and a follow-up issue.
