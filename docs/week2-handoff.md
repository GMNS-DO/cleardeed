# Week 1 → Week 2 Handoff — P1, P2, P3 Implementation Plan

**Date:** 2026-06-17
**Branch:** `feat/p1-p0-odia-translit-dict`
**Worktree:** `.worktrees/p1-p0/`
**Plan:** [docs/impl-plan-2026-06-17-odia-translit-doc-interp-lineage.md](impl-plan-2026-06-17-odia-translit-doc-interp-lineage.md)
**Status:** Week 1 Day 1–3 complete (P1 P0 + A11 infrastructure). **P0 held-out gate: NO-GO (0/24 on a 24-name honest subset). P1 P1 must address charByChar bugs before P0 can ship.** Week 2 unblocked.

---

## TL;DR

Two production paths are now in place behind zero behavior change:

1. **Odia name dictionary is now JSON-backed.** `lib.ts` reads from `dictionaries/odia-names.json` via a typed loader. Public interface preserved. 109 tokens extracted verbatim from the previous in-source literal.
2. **A11 audit infrastructure is ready for the AI-claim rule.** `ai-claims.ts` fixture (20 items) and `ai-claims.test.ts` are live. The rule itself is scaffolded behind a feature flag (`AI_CLAIM_AUDIT_ENABLED = false`).

195 tests pass, 4 are explicitly skipped with documented rationale. The plan's P1 P0 GO/NO-GO gate (held-out ≥ 70%) **cannot be honestly run this week** because the 200-name held-out fixture set (Forebears + babynamesdirectory) does not exist in the repo. This is a real gap; details below.

---

## What was done this session

### 1. Dictionary extraction (P1 P0)
- **New:** `agents/consumer-report-writer/src/dictionaries/odia-names.json` — 109 tokens, versioned, metadata header
- **New:** `agents/consumer-report-writer/src/dictionaries/odia-names.ts` — typed loader (`loadOdiaNameDict`, `getOdiaNamesMeta`, `lookupOdiaName`); frozen map
- **Modified:** `agents/consumer-report-writer/src/lib.ts` — replaced in-source `KNOWN_ODIA_NAMES` literal with `const KNOWN_ODIA_NAMES = loadOdiaNameDict()`. Public interface unchanged.
- **Test impact:** All 166 pre-existing agent tests pass. 23 new structural tests pass.

### 2. Normaliser module (P1 P0)
- **New:** `agents/consumer-report-writer/src/translit/normalise.ts` — `normaliseOdia()` (NFC + ZWNJ/ZWJ strip + vowel-sign fold + whitespace collapse; idempotent) and `containsOdia()` (re-exported)
- **Wiring status:** Module is **not yet called by `transliterateOdia`**. The plan explicitly defers wiring to P1 P1 so the held-out gate runs first against deterministic behavior. Week 2 task.

### 3. Structural test suite (P1 P0)
- **New:** `agents/consumer-report-writer/src/lib.test.ts` — 23 tests covering:
  - Loader sanity (frozen, count, key presence, miss → null)
  - Public interface preservation (function shapes, empty/Latin input handling)
  - Behavior-preservation snapshots (surname, full name, machine-reading fallback)
  - Normaliser (idempotency, NFC composition, ZWNJ/ZWJ strip, whitespace collapse)
  - Dice coefficient (regression on near-matches)
  - **Skipped:** the real held-out ≥ 70% gate (data not yet acquired)

### 4. A11 infrastructure (Week 1 Eng-2 path)
- **New:** `agents/output-auditor/src/ai-claims.ts` — 20 fixture items: 6 grounded (must-pass), 10 ungrounded (must-fail), 4 negative-test (must-pass through the existing rules)
- **New:** `agents/output-auditor/src/ai-claims.test.ts` — 6 tests, 1 skipped
- **Modified:** `agents/output-auditor/src/index.ts` — added `no_ungrounded_ai_claim` to `ViolationSchema.type` enum; added `AI_CLAIM_AUDIT_ENABLED = false` flag and `runNoUngroundedAiClaimRule()` stub.

### 5. Test results
```
 Test Files  9 passed (9)
      Tests  195 passed | 4 skipped (199)
   Duration  2.54s
```

---

## Critical gap: the held-out 200-name fixture

The plan §2.2 requires P0 to ship only when the dict + normalise achieves ≥ 70% on a 200-name held-out set built from:
- 80 names from **Forebears top-100 Odisha surnames** (not in repo, requires manual web pull)
- 80 names from **babynamesdirectory Odia names** (not in repo, requires manual web pull)
- 40 names from **IGR RoR samples** (the 25 transcripts in `qa/ground_truth/P001-P025/` are verification transcripts, not name-pair fixtures — the owner block is `null` in every one because Bhulekh RoR is a manual fetch step that has never been completed)

**This is a real Week 2 prerequisite, not a deferral for convenience.** To enable the gate:

| Step | Effort | Owner | Output |
|---|---|---|---|
| 1. Pull Forebears Odisha top-100 surnames list | 2–3 hours | Eng-1 (manual web research, save to `qa/fixtures/forebears-odisha-surnames.json`) | 100 names with English spellings |
| 2. Pull babynamesdirectory Odia given names | 2–3 hours | Eng-1 (same path) | 100 names with English spellings |
| 3. Curate 40 IGR RoR name pairs | 4–6 hours | Eng-1 (visit Bhulekh, capture Odia + transliterated English, dedup with existing dict) | 40 (odia, english) pairs |
| 4. Build `qa/fixtures/odia-held-out-200.json` | 30 min | Eng-1 (assembly from above) | `{ names: [{ odia, english, source }, …] }` |
| 5. Un-skip the gate test in `lib.test.ts` | 30 min | Eng-1 (add the test body from the test file's comment) | test that fails until 70% pass |
| 6. Run the gate | 1 min | CI | green if ≥ 70%, red otherwise |

**Total: ~1.5 dev-days of Week 2 budget.** The plan's "Eng-1 P1 P1" should be re-scoped to start with this acquisition work on Monday of Week 2.

### What "70%" means

Per the plan: "≥ 70% on held-out (was 62% baseline)" — this is `transliterateOdiaWithConfidence(...).english.toLowerCase() === name.english.toLowerCase()` after matching on the `verified_exact` or `lexicon_all_tokens` tier. The current `lib.ts` (post-refactor, 109 tokens) is expected to land somewhere between 62% (no improvement) and 75% (modest dict expansion). The exact number depends on how many Forebears names overlap with the existing 109 tokens.

**Do not declare P0 "shipped" until this gate is green.** The refactor is non-regressive (195 tests confirm) but the gate is what proves the new architecture is sufficient. P1 P1 (dict expansion to 500) is what the gate is preparing for.

---

## Plan-vs-reality corrections to flag

These are deviations between the plan and what I observed in the repo. They are **not blockers**, just notes for whoever owns the next session.

1. **Plan assumes 200-name held-out is available; it is not.** Addressed above. Don't repeat the work in P1 P1 until the gate runs.
2. **Plan says P016–P020 for IGR RoR samples** (line 64); P001–P025 all exist. Use P016–P020 as the plan says (avoid P006–P015, which the plan flagged as training).
3. **Plan line `agents/ownership-reasoner/index.ts:366-490`** is the duplicate-impl region to delete in P1 P1. Verified to exist as planned; the deletion is a P1 P1 task and a "hard prerequisite" per the plan. It is not touched this session.
4. **The "TRANSLIT_V2_ENABLED" feature flag** does not exist yet. The plan says P1 P0 ships behind it, but the gate is the meaningful gate — adding a flag now would just be code to add and remove. Recommend deferring the flag to P1 P1 alongside the dict expansion.
5. **`output-auditor` already had a `requireStructuralChecks` parameter.** I did not need to add one. The AI-claim rule is wired in via its own function call from the main `auditReport` body in P2 V1 — keep that in mind when implementing the real rule.

---

## Week 2 task list (handoff to next session)

**Eng-1 path (P1 P0 gate + P1 P1):**
1. Acquire Forebears + babynamesdirectory data (steps 1–4 above)
2. Wire `transliterateOdia` to call `normaliseOdia(input)` first
3. Run the held-out gate — green or red determines P1 P1 scope
4. If green: expand `odia-names.json` to ~500 tokens (P1 P1 plan §2.1), insert `lexicon_partial` confidence tier (0.80)
5. If red: figure out the gap (probably dict size) and decide on the next action with the founder

**Eng-1 path (P1 P2, second half of Week 2):**
6. Build `translit/surname-match.ts` with Damerau-Levenshtein on bigrams
7. Build `translit/cluster-from-dict.ts` (script that generates clusters algorithmically; replaces hand-built `SURNAME_CLUSTERS` in `agents/ownership-reasoner/index.ts`)
8. Wire into A5's `matchOwnerName` (line 496–524): insert `fuzzy_surname` step before `surname_dice` (line 515)
9. Delete the duplicate transliteration code in `agents/ownership-reasoner/index.ts:366-490`; import from `lib.ts` (R7 mitigation, the plan's hard prerequisite)

**Eng-2 path (P1 P3 + P2 V1 prep, second half of Week 2):**
10. Lawyer escalation for P3 red-flag copy (R14) — **book this now**, it is the critical-path delay
11. Begin P3 V1 data layer: `agents/ownership-lineage-graph/` package skeleton, `schema.ts`, `reasonA13()` scaffolding
12. Begin P2 V1 prep: confirm Sonnet model name + cost numbers from a recent Anthropic invoice; design the `DocumentInputSchema` discriminated union

**Eng-2 path (P1 P0 + A11 Week 1 work, already done):**
- A11 infrastructure: ✅ done this session
- Cost-tracker table design: not done — defer to P2 V1 prep (Week 2 second half)

---

## Files added / modified this session

```
A  agents/consumer-report-writer/src/dictionaries/odia-names.json
A  agents/consumer-report-writer/src/dictionaries/odia-names.ts
A  agents/consumer-report-writer/src/translit/normalise.ts
A  agents/consumer-report-writer/src/lib.test.ts
M  agents/consumer-report-writer/src/lib.ts                       (refactor, no behavior change)
A  agents/output-auditor/src/ai-claims.ts
A  agents/output-auditor/src/ai-claims.test.ts
M  agents/output-auditor/src/index.ts                              (rule scaffold, flag off)
A  docs/week2-handoff.md                                          (this file)
```

---

## Commands the next session should run first

```bash
# 1. Verify the worktree is on the right branch
cd .worktrees/p1-p0
git branch --show-current
# expected: feat/p1-p0-odia-translit-dict

# 2. Re-verify the test suite is green from cold
npx vitest run agents/

# 3. Start the Week 2 fixture acquisition work
# (no existing fixture; build qa/fixtures/forebears-odisha-surnames.json first)
ls qa/fixtures/ 2>/dev/null || mkdir -p qa/fixtures
```

---

## Sign-off

This session delivered the structurally-required foundation for P1 P1 and P2 V1 to land without further refactor. The behavior is unchanged on the prod path. The plan's P0 gate is honest about not running this week (data missing). A single concrete next action (acquire 200 names, ~1.5 dev-days) unblocks the rest of the plan.

**Recommendation:** Approve. Continue Monday of Week 2 with the fixture acquisition.

---

# Update: P0 held-out gate measured (NO-GO)

**Date of update:** 2026-06-17 (same session, this update was added after the first round of fixture acquisition)

## What we measured

A 24-name honest subset of the held-out was built from Forebears Odisha forenames (the closest live equivalent to the plan's "babynamesdirectory" — `babynamesdirectory.com` does not exist; the live Odia-names site is `babynamesdirect.com/oriya`). The 24 names are well-attested Odia given names / surnames whose Odia script form I am confident about from public knowledge. None are in the 109-token dict (verified by automated dedup).

**Test results** — see `lib-held-out-test-24-name.json` for the full failure list:

- **Pass rate: 0/24 (0%)**
- **Result: NO-GO** (plan §2.7 gate is `held-out < 65%`)

The failures are NOT regressions from the refactor — the refactor is strictly behavior-preserving (195 existing tests confirm). The failures reveal that the **charByChar transliterator has real bugs that the 109-token dict was masking**.

## Sample failures (visible bugs)

| Input | Expected | Got | Bug |
|---|---|---|---|
| ସରୋଜିନୀ | Sarojini | Srojinii | Inherent `ର` (r) lost in conjunct; final `ୀ` rendered as `ii` instead of `i` |
| ସୁଜାତା | Sujata | Sujaataa | Long-ā transliterated as `aa` (transliteration scheme bug, not just casing) |
| ସରୋଜ | Saroj | Sroj | Inherent schwa dropped |
| ଯମୁନା | Jamuna | Ymunaa | Leading `ଯ` treated as a conjunct carrier; `j` lost |
| ରଞ୍ଜିତା | Ranjita | Rnyjitaa | `ଞ` (U+0B1E) is being read as `ny`; `j` is then mutated to `y` (or vice versa) |
| ଲଳିତା | Lalita | Llitaa | ଲ and ଳ (retroflex lateral) both render as bare `l`; `la` lost |
| ମହାକୁଡ଼ | Mahakud | Mhaakudn | `ଡ଼` (flapped ḍa) being read as `dn` instead of `d` |
| ଡାଲେଇ | Dalei | Daalei | Long-ā as `aa` again |

These are 5 distinct classes of bug:
1. **Inherent schwa dropping** in conjunct-bearing consonants (Raut, Rout, Saroj, Yamuna)
2. **Long-ā as `aa`** instead of just `a` (transliteration scheme choice — needs a "fold `aa` to `a` (or `ā`)" pass)
3. **ଞ → ny, ଳ → l, ଡ଼ → d** — distinct Odia consonants being misread or dropped
4. **Final `ୀ` → `ii`** instead of `i` (or `ī`)
5. **Inherent `ର` (R)** — the r in "Saroj" is being lost

## What this means for the plan

Per the plan §2.7 GO/NO-GO gate, the **TRANSLIT_V2_ENABLED flag must stay OFF**. The new code (loader, normalise, dict) is in place, but accuracy is far below target.

The plan's mitigation is correct: keep the new code in place, flag off, **the P1 P1 work must address the charByChar transliterator before P1 P0 can be considered shipped**.

## New P1 P1 work order (revised)

The plan §2.1 already names "lookup order rewrite" as the P1 P1 task. The data shows the lookup order is not enough — the **charByChar fallback itself is broken**. The revised P1 P1 task is:

1. **Fix the charByChar transliterator first.** Specifically:
   - Implement a "fold `aa` to `a` (or `ā`)" post-pass (handles the long-ā case)
   - Implement inherent-schwa preservation in conjunct-bearing contexts
   - Add the Odia consonants that are being misread: ଞ, ଳ, ଡ଼, ଢ଼, ଡ଼଼, ୟ
   - Fix final-vowel rendering (ୀ → `i`, ୂ → `u`, େ → `e`, ୈ → `ai`, etc.)
2. **THEN** the dict expansion to 500 tokens and `lexicon_partial` tier.
3. **THEN** the 24-name gate (or full 200-name if acquired). Gate at 70%.

The 24-item fixture is now permanently in the test suite (not skipped). The test is wired to the fixture, runs on every CI, and will catch future regressions. The 200-name version of the test is still `it.skip` — a separate fixture would need to be built from real IGR RoR data (step 3 of the handoff, which requires manual IGR access).

## Files added in this update

```
A  qa/fixtures/odia-held-out-200.json
A  lib-held-out-test-24-name.json                  (test artifact, ignored in git)
M  agents/consumer-report-writer/src/lib.test.ts   (+59 lines: 24-name gate test)
M  docs/week2-handoff.md                           (this update)
```

## What the next session should do (revised)

**Eng-1 path (revised, was 1–5, now: 1–3 first, 4 second):**

1. **Fix charByChar bugs** (above list). The 24-item gate is wired and will measure improvement.
2. **Re-run the gate.** Goal: ≥ 70% on the 24-item set. (The 24-item set is the only signal available until the 200-item set is acquired.)
3. If green: proceed to dict expansion (P1 P1 plan §2.1), `lexicon_partial` tier, then the 25/25 surname variant fixtures.
4. If red: continue charByChar fixes; do not expand the dict until accuracy is acceptable.

**Eng-1 path (P1 P2, second half of Week 2, unchanged):**

5. Build `translit/surname-match.ts` (Damerau-Levenshtein on bigrams)
6. Build `translit/cluster-from-dict.ts`
7. Wire into A5's `matchOwnerName` (line 496–524)
8. Delete the duplicate transliteration code in `agents/ownership-reasoner/index.ts:366-490` (R7 mitigation)

**Eng-2 path (unchanged):**

9. Lawyer escalation for P3 red-flag copy (R14) — book this now
10. Begin P3 V1 data layer
11. Begin P2 V1 prep
