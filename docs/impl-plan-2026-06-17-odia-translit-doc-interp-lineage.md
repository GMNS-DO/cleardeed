# Implementation Plan: Odia Transliteration, Document Interpretation, Ownership Lineage

**Date:** 2026-06-17
**Scope:** Three workstreams, 4 weeks, 2 engineers
**Status:** Draft for approval

---

## 1. TL;DR (Founder-Readable)

Three workstreams ship in 4 weeks with 2 engineers. All workstreams address every critique from the adversarial review (P1.1–P1.7, P2.1–P2.10, P3.1–P3.7) and the PM review.

| Workstream | V1 ships (week) | What V1 delivers | What V1 does NOT deliver | Highest risk |
|---|---|---|---|---|
| **P1** Odia transliteration 62% → 92% | Week 2 (Fri) | Dictionary (500 tokens) + normalise + fuzzy surname + A5 wiring | Haiku oracle (week 3); feedback loop (week 4) | `lib.ts`/`ownership-reasoner` duplicate cleanup (R7) |
| **P2** Document interpretation (Claude) | Week 3 (Fri) | Sonnet for IGR EC + Haiku for Bhulekh back + SSE + ₹499 upsell gate | Upload UI; mutation order; certified copy (V2) | Sonnet cost at scale (R9) |
| **P3** Ownership lineage graph | Week 2 (Fri) | Data layer: nodes/edges/flags from backPage.mutationHistory; A11-audited text summary | Dagre SVG (V2); cross-doc reference (V3) | `mutationParties[]` not in schema today (R16) |

**Per-report combined cost ceiling: $0.15 hard. Typical: $0.023.** At 1,000 reports/month: ~$23 total. Org cap: $500/month.

**Most likely delays:** lawyer sign-off on P3 red-flag copy (R14, week 2); Vercel cron setup for P1 P4 (week 4).

**Single integration owner:** Eng-2 owns A11. Every PR that touches the report HTML must run the A11 fixture suite. PR order is locked; A11 fixture gates every PR.

**Approve and begin Monday.**

---

## 2. Workstream P1 — Odia → English Transliteration

### 2.1 Phasing (revised from adversarial review)

**P1 P0 (week 1 day 1–3) — Dictionary + normaliser + loader. No behaviour change.**
- `dictionaries/odia-names.json` (200 curated tokens) + `odia-names.ts` (typed loader).
- `translit/normalise.ts` with NFC + ZWNJ/ZWJ + anusvara + vowel-sign fold.
- `lib.ts` rewires to use the loader; existing `transliterateOdia` interface preserved.

**P1 P1 (week 1 day 4 – week 2 day 1) — Lookup order + dict expansion to 500 tokens.**
- New `transliterateOdiaWithConfidence` with explicit `lexicon_partial` tier (0.80) inserted between `lexicon_all_tokens` and `machine_reading`.
- `KNOWN_ODIA_NAMES` literal deleted from `lib.ts:10-124`. Loader becomes the only source.
- `agents/ownership-reasoner/index.ts:366-490` migrated to import from `lib.ts` (deletes the duplicated implementations — addresses adversarial P1.7). This is a hard prerequisite for P1 P1 to ship.

**P1 P2 (week 2 day 2–5) — Fuzzy surname matching + A5 wiring.**
- `translit/surname-match.ts` with Damerau-Levenshtein on bigrams + cluster fast-path.
- Cluster-from-dict script (adversarial P1.3): `translit/cluster-from-dict.ts` derives `SURNAME_CLUSTERS` algorithmically from the dict via D-L distance ≤ 2 OR shared prefix. Replaces the hand-built clusters.
- A5's `matchOwnerName` (`agents/ownership-reasoner/index.ts:496-524`) gets the new `fuzzy_surname` step inserted before `surname_dice` (`:515`).

**P1 P3 (week 3) — Haiku oracle, feature-flagged, code-complete but `HAIKU_TRANSLIT_ENABLED=false` in prod.**
- `translit/llm-oracle.ts` with 800ms `Promise.race` timeout, 200/day counter, validation regex + charByChar Dice ≥ 0.5 (raised from adversarial P1.5).
- Supabase-backed counter table `haiku_translit_calls` (replaces `/tmp` — adversarial P1.4 + Plan 2 cost-tracker alignment). Per-report sub-budget: 3 calls max.

**P1 P4 (week 4) — Feedback ingest + admin review + auto-approve cron.**
- `/api/feedback/name/route.ts` endpoint.
- `odia_name_feedback` Supabase table.
- `/admin/name-review` page (server action, not React component — keeps admin tier separate from public bundle).
- Vercel cron nightly, threshold ≥ 3 unique `user_id` + 0 rejections → auto-merge into `odia-names.json` via `dict_version` Redis key invalidation.

### 2.2 Accuracy gates (adversarial P1.1 fixed)

**Holdout discipline.** The 50 ground-truth pairs from `qa/ground_truth/P006-P015/transcript.md` are **training**. The 99% target is measured on a **separate held-out set of 200 names** built from:
- 80 from Forebears top-100 Odisha surnames (different from training fixtures)
- 80 from `babynamesdirectory` Odia names (different from training)
- 40 from IGR RoR samples in `qa/ground_truth/` NOT used in training (sourced separately; P016–P020 if they exist, else first 40 unread Bhulekh tenants)

**Gates:**
- P0 ships when dict + normalise gives ≥ 70% on held-out (was 62% baseline).
- P1 ships when dict expansion + `lexicon_partial` tier gives ≥ 88%.
- P2 ships when fuzzy surname resolves 25 of 25 surname-variant fixtures (Mohapatra/Mahapatra/Misra/Parida/Panda + Barajena/Baral/Raut/Rout/Ray) at confidence ≥ 0.85.
- P3 (with flag on) gives ≥ 95%; off gives 92%.
- P4 sustains ≥ 96% after 100 feedback-driven merges.

### 2.3 PII hardening (adversarial P1.6)

The plan's PII gate (`payload.pii.hasAadhaar`) is too weak. Fix:

**`translit/pii-redact.ts`** runs before any LLM call. Detects and replaces:
- 12-digit Aadhaar (with or without spaces)
- 10-digit phone (with or without +91)
- 10-character PAN
- Father's name patterns: `s/o `, `d/o `, `w/o `, `ପୁଅ ` (Odia), `ଝିଅ ` — followed by a name, replaced with `[REDACTED:GUARDIAN]`
- Plot numbers in IGR format (e.g. `Plot 123/4A`): `Plot [REDACTED]`

Replacement is reversible (store the original alongside the redacted version locally) so the report can be reconstructed without the LLM seeing it.

**Test fixture:** `translit/pii-redact.test.ts` — 20 inputs, all redacted strings must contain no 12-digit runs, no 10-digit phone-shaped runs, no `s/o X` patterns.

### 2.4 Cost projection (revised)

| Phase | Per-call cost | Calls per report | Per-report cost |
|---|---|---|---|
| P0 (deterministic) | $0 | 0 (no LLM) | $0 |
| P1 (deterministic) | $0 | 0 | $0 |
| P2 (deterministic) | $0 | 0 | $0 |
| P3 (Haiku) | $0.00025 | ≤ 3 (per-report sub-budget) | $0.00075 max, ~$0.0002 typical |
| P4 (admin only) | $0 | 0 (admin is internal) | $0 |

**Per-report P1 ceiling: <$0.001.** Not a budget concern.

### 2.5 Concrete file tasks

| File | Action | Acceptance |
|---|---|---|
| `agents/consumer-report-writer/src/dictionaries/odia-names.json` | New | 200 tokens, versioned, hand-curated, independent of training set |
| `agents/consumer-report-writer/src/dictionaries/odia-names.ts` | New | `loadOdiaNameDict()`, `getOdiaNamesMeta()` exported; sync load |
| `agents/consumer-report-writer/src/translit/normalise.ts` | New | `normaliseOdia(input): string`; NFC + ZWNJ/ZWJ + anusvara + vowel-sign fold |
| `agents/consumer-report-writer/src/translit/surname-match.ts` | New | `fuzzySurnameMatch(claimed, candidate, clusters)`; D-L on bigrams |
| `agents/consumer-report-writer/src/translit/cluster-from-dict.ts` | New | Generates `SURNAME_CLUSTERS` from dict; one-shot script, output committed |
| `agents/consumer-report-writer/src/translit/llm-oracle.ts` | New | `transliterateWithLLM(text, topTokens)`; 800ms race; regex + Dice validation |
| `agents/consumer-report-writer/src/translit/pii-redact.ts` | New | `redactPII(input): {clean, original}` |
| `agents/consumer-report-writer/src/lib.ts` | Modify | Replace `KNOWN_ODIA_NAMES` literal; insert `lexicon_partial` tier |
| `agents/consumer-report-writer/src/lib.test.ts` | New | ~600 lines; 200 held-out fixtures; gate assertions |
| `agents/ownership-reasoner/index.ts:366-490` | Modify | Delete duplicated impls; import from `lib.ts` |
| `agents/ownership-reasoner/index.ts:496-524` | Modify | Insert `fuzzy_surname` step before `:515` |
| `agents/ownership-reasoner/fixtures/test-cases.ts` | Modify | Add 20 surname-variant cases |
| `apps/web/src/app/api/feedback/name/route.ts` | New (P4) | POST endpoint; writes to `odia_name_feedback` |
| `apps/web/src/app/admin/name-review/page.tsx` | New (P4) | Server action; merges approved entries |
| `supabase/migrations/20260617_haiku_translit_count.sql` | New | `haiku_translit_calls` table; per-report budget |
| `supabase/migrations/20260617_odia_name_feedback.sql` | New (P4) | `odia_name_feedback` table |

### 2.6 Tests per phase

- **P0:** `lib.test.ts` — 50 fixture cases, 3 quality tiers, deterministic only. Gate: ≥ 70% on held-out.
- **P1:** `lib.test.ts` + `normalise.test.ts` — 200 held-out cases, 4 quality tiers. Gate: ≥ 88%.
- **P2:** `surname-match.test.ts` (25 cases) + `ownership-reasoner/index.test.ts` (7 existing + 20 new) — Gate: 25/25 surname + 27/27 ownership.
- **P3:** `llm-oracle.test.ts` (mock Anthropic SDK) + `pii-redact.test.ts` (20 cases) — Gate: regex/Dice validation rejects 100% of malformed LLM outputs in test corpus; flag-off path identical to P2.
- **P4:** `feedback.test.ts` + integration test against `odia_name_feedback` table — Gate: 100% of approved entries appear in next dict version.

### 2.7 Go/No-Go gate (P1 P0 → P1 P1)

- **GO if:** held-out accuracy ≥ 70% on 200-name fixture; `agents/ownership-reasoner/index.test.ts` 27/27 pass; A11 fixture 20/20 pass (no regressions).
- **NO-GO if:** held-out < 65% OR any ownership-reasoner test fails OR A11 detects new `quality` string not in allowlist.

### 2.8 Highest-risk assumption + mitigation

**Assumption:** The 200-token dict covers ≥ 80% of real-world names after normalise. (Adversarial P1.1 fix: held-out set is independent of training.)

**Mitigation:** P1 P0 ships behind `TRANSLIT_V2_ENABLED` feature flag. If held-out < 70%, the flag stays off; the old `lib.ts` path runs. We learn the gap from the held-out miss rate and tune the dict expansion in P1 before flipping the flag in P1.

---

## 3. Workstream P2 — Document Interpreter (Claude)

### 3.1 Scope per phase (revised from adversarial review — V1 narrowed)

**P2 V1 (week 3) — IGR Encumbrance Certificate only.**
- `agents/document-interpreter/` package: `index.ts`, `schema.ts`, `prompts/{system,user-document}.ts`, `claude-client.ts`, `cost-tracker.ts`, `validate-quotes.ts`.
- Sonnet for IGR EC (adversarial P2.2 reverted: keep Sonnet, not Haiku, for legal text — the cost delta is acceptable).
- DB: `report_ai_interpretations`, `report_ai_costs` (Supabase migrations).
- SSE route `/api/report/[id]/interpret-doc/route.ts` for IGR EC only.
- `useDocInterpretation` hook + `AIDocSummaryCard` component.
- A11 `no_ungrounded_ai_claim` rule (must land before P2 V1).
- ₹499 upsell gate live from day one (PM review: monetise immediately).
- 4 golden fixtures for testing.

**P2 V1.5 (week 4) — Bhulekh back-page with Haiku.**
- Add `docType: "bhulekh_back"` to the schema.
- Reuses the SSE route; only `AIDocSummaryCard` mount point changes (one new card on the existing back-page panel).
- No new A11 changes (the `no_ungrounded_ai_claim` rule from V1 covers it).
- A/B test for Haiku-vs-Sonnet on this doc (PM note: $0.0036 vs $0.012 per call, 8x cost; we have data to settle this in V1.5).

**P2 V2 (post-sprint) — Upload UI + mutation order + certified copy.**

### 3.2 Cost ceiling per report (adversarial P2.1 corrected)

| Doc | Model | Avg input | Avg output | Cache hit | Cost per call |
|---|---|---|---|---|---|
| IGR EC | Sonnet | 12k cached + 1k fresh | 800 | yes | $0.0036 + $0.003 + $0.012 = **$0.019** |
| IGR EC first call | Sonnet | 12k (write 25% premium) + 1k | 800 | no | $0.012 + $0.003 + $0.012 = **$0.027** |
| Bhulekh back | Haiku | 1.6k | 400 | yes | $0.0016 + $0.002 = **$0.0036** |
| Bhulekh back first | Haiku | 1.6k (write 25% premium) | 400 | no | $0.002 + $0.002 = **$0.004** |

**Per-report P2 ceiling: $0.05** (one IGR EC, one Bhulekh back, both with cache hit after first report in 5min window). Realistic first-report cost: $0.031.

**Org-level monthly cap:** $500 (PM review + adversarial P2.1 alignment). Tracked at `orgs.monthly_ai_spend_usd_cents`.

### 3.3 Quote grounding, hardened (adversarial P2.3)

`validateQuotes` is necessary but the substring check accepts trivial matches. Fix:

**`validate-quotes.ts`** runs three checks per field:
1. **Substring presence** (existing): `normalized.includes(quote)` after whitespace fold.
2. **Token window adjacency**: the quote must be within ±50 tokens of any other field-anchor string in the document. Field-anchors are the schema-known field names (e.g. for `mutationNumber`, anchor is the caseNo).
3. **Bbox containment** (when available): if the renderer passes page-level coordinates, the quote's `bbox` must be inside the page. Without bbox, this check is skipped, not failed.

**Failure response:**
- Any single failed check → `confidence = min(confidence, 0.3)` (existing).
- If quote length < 8 chars or > 240 chars → also failed (catches trivial matches and hallucinations).
- If > 30% of fields fail → return `plainEnglishSummary: ""` + `warnings: ["low_grounding_rate"]` (existing).

**Test fixture:** `validate-quotes.test.ts` — 20 cases, includes:
- Valid quote (anchor nearby): pass
- Quote present but not near anchor: fail
- Substring of stamp text "2014" used as anchor: fail
- Bbox outside page: fail
- Short quote "2014": fail
- Long quote full-document copy: fail

### 3.4 Schema split (adversarial P2.8)

`FieldExtractionSchema.quote` is required. `plainEnglishSummary` doesn't fit. Fix:

```ts
export const FieldExtractionSchema = z.object({
  field: z.string(),
  value: z.string(),
  quote: SourceQuoteSchema,           // required for extracted fields
  interpretation: z.string().min(1).max(500),
  confidence: z.number().min(0).max(1),
});
export const SummaryFieldSchema = z.object({
  field: z.literal("plainEnglishSummary"),
  value: z.string().min(1).max(500),
  quote: SourceQuoteSchema.optional(),  // may be a multi-paragraph composite
  interpretation: z.string(),
  confidence: z.number().min(0).max(1),
});
export const InterpretationResultSchema = z.object({
  ...,
  fields: z.array(z.union([FieldExtractionSchema, SummaryFieldSchema])),
  ...,
});
```

This lets the summary field be present in `fields[]` without forcing a single quote. The renderer at `AIDocSummaryCard` displays the `plainEnglishSummary` as the lead, then each `FieldExtractionSchema` row below.

### 3.5 Auto-fetched doc type fix (adversarial P2.6)

`igrSroData` is HTML. A12 ingests HTML directly (Claude supports it natively). Bhulekh back-page is a screenshot (PNG). A12 schema:

```ts
export const DocumentInputSchema = z.union([
  z.object({ kind: z.literal("html"), content: z.string().min(1) }),
  z.object({ kind: z.literal("pdfBase64"), content: z.string().min(1) }),
  z.object({ kind: z.literal("pngBase64"), content: z.string().min(1) }),
]);
```

**Storage** writes whatever the fetcher produces; A12 reads it back, dispatches by `kind`. No HTML→PDF conversion step, no Playwright dependency in V1.

### 3.6 Concrete file tasks

| File | Action | Acceptance |
|---|---|---|
| `agents/document-interpreter/index.ts` | New | `interpretDocument(input): Promise<InterpretationResult>`; never throws |
| `agents/document-interpreter/schema.ts` | New | Zod schemas including union `FieldExtraction | SummaryField` |
| `agents/document-interpreter/prompts/system.ts` | New | 2000-token system prompt, anti-hallucination rules, JSON schema |
| `agents/document-interpreter/prompts/user-document.ts` | New | 4-block content array builder; cache_control on system + context |
| `agents/document-interpreter/claude-client.ts` | New | Anthropic SDK wrapper; 30s timeout; 1/2/4s exponential backoff on 429 |
| `agents/document-interpreter/cost-tracker.ts` | New | `estimateCost()`, `recordCost()`; Supabase-backed; pre-flight gate |
| `agents/document-interpreter/validate-quotes.ts` | New | 3-check grounding (substring, token-window, bbox) |
| `agents/document-interpreter/fixtures/golden/{igr_ec_clean,igr_ec_odia_mixed,mutation_order_3_generations,igr_ec_low_ocr}.{html,pdf,png}` | New (V1: 2 fixtures; V2: 4) | 12-15 expected fields each |
| `agents/document-interpreter/index.test.ts` | New (V1) | vitest suite; gate assertions |
| `agents/document-interpreter/validate-quotes.test.ts` | New | 20 cases including the 6 adversarial fixtures |
| `apps/web/src/app/api/report/[id]/interpret-doc/route.ts` | New (V1) | SSE handler; `runtime = 'nodejs'`; `dynamic = 'force-dynamic'` |
| `apps/web/src/hooks/useDocInterpretation.ts` | New (V1) | Client hook; localStorage persist on error; 3G-friendly progressive fields |
| `apps/web/src/components/AIDocSummaryCard.tsx` | New (V1) | Idle / streaming / done / failed states; ₹499 upsell gate component |
| `apps/web/src/components/AIDocUpsellGate.tsx` | New (V1) | Reusable upsell; reads from `orgs.plan` |
| `supabase/migrations/20260617_ai_interpretation.sql` | New (V1) | `report_ai_interpretations`, `report_ai_costs`, `orgs.monthly_ai_spend_usd_cents` |
| `agents/output-auditor/index.ts` | Modify (V1) | New `no_ungrounded_ai_claim` rule; attribute-based regex |
| `agents/output-auditor/fixtures/ai-claims.ts` | New (V1) | 20 must-pass / must-fail strings |
| `apps/web/package.json` | Modify | `@anthropic-ai/sdk`, `zod` (if not present) |
| `apps/web/.env.example` | Modify | `ANTHROPIC_API_KEY` |

### 3.7 Tests per phase

**V1 tests:**
- 2 golden fixtures (IGR EC clean, IGR EC Odia-mixed).
- `validate-quotes.test.ts` — 20 cases.
- `cost-tracker.test.ts` — pre-flight gate rejects over-budget reports.
- `index.test.ts` — full end-to-end with mocked Anthropic SDK.

**V1.5 tests:** + 1 golden fixture (Bhulekh back).

**V2 tests:** + 1 golden fixture (mutation order, 18 fields), property-based test on real IGR snippets (adversarial P2.9).

### 3.8 Go/No-Go gate (P2 V1)

- **GO if:** 2 golden fixtures pass (≥ 95% field extraction, 100% quote grounding, cost ≤ $0.15/call for IGR EC); SSE smoke test passes; A11 fixture 20/20; quote-validator 20/20.
- **NO-GO if:** any golden fixture fails quote grounding > 5% of fields; cost > $0.15/call sustained; SSE route times out at 30s on a real IGR EC; ₹499 upsell gate is not live in production.

### 3.9 Highest-risk assumption + mitigation

**Assumption:** Sonnet 4.5 reliably grounds ≥ 95% of field extractions in IGR EC text on the first attempt, with our quote-validator catching the rest.

**Mitigation:** The `no_ungrounded_ai_claim` A11 rule + the `low_grounding_rate` warning mean a Sonnet miss rate of 5% reduces to "AI summary unavailable" — the report still ships, the upsell still gates. We learn the miss rate from production in week 4, and either tighten the prompt (V1.5) or fall back to Haiku (cost-saving) before month-end.

---

## 4. Workstream P3 — Ownership Lineage Graph

### 4.1 Scope per phase (revised from adversarial review — V1 data only)

**P3 V1 (week 2) — Data layer only, no SVG, no Dagre.**
- `agents/ownership-lineage-graph/` package: `schema.ts`, `index.ts`, `red-flags.ts`, `sort.ts`, `fixtures/golden-chains.ts`, `index.test.ts`.
- `reasonA13(input): A13Result` returns `nodes[]`/`edges[]`/`flags[]`/`summary` (text-only) and `confidence`.
- Renderer integration: bullet list of events + flag badges in the existing `buildRoRBackPagePanel` call site (`index.ts:190/212/234/496, 3194-3244`).
- 6 golden chains for tests.
- A11 allowlist changes ("no unreleased mortgage", "ownership appears continuous") — P3 V1 is the third A11 PR.
- **No new dependencies.**

**P3 V2 (week 4) — Server-side Dagre SVG.**
- `layout.ts` with Dagre `network-simplex` ranker (NOT `tight-tree` — adversarial P3.1).
- `apps/web/src/lib/pipeline/svg-capture.ts` — Playwright inline capture during main report render (not re-render).
- Mobile horizontal timeline fallback (`<details><summary>` collapsed-by-default + scrollable strip).
- Snapshot tests for golden chains.

**P3 V3 (post-sprint) — Cross-doc reference (A12 ↔ A13).**

### 4.2 Complexity gate (adversarial P3.3)

`reasonA13` schema includes:

```ts
layout: z.object({
  mode: z.enum(["list","svg","timeline"]),
  width: z.number(),
  height: z.number(),
  reason: z.string(),     // why this mode was chosen
}),
```

`chooseLayoutMode(input): "list" | "svg" | "timeline"`:
- `nodes.length > 80` → `list` (with full data; user can request SVG in V3)
- `nodes.length <= 80 AND plotNo in MOBILE_VIEWPORT (detected from user agent at request time)` → `timeline`
- `nodes.length <= 80 AND desktop` → `svg`
- Always includes a 720px width cap (adversarial P3.3 mitigation).

### 4.3 Red-flag copy, lawyer-reviewable (PM review)

`MORTGAGE_NO_RELEASE` and `INHERITANCE_UNRECORDED` are scary. The plan's messages are engineering copy. Fix:

**`red-flags.ts`** maps each flag code to a structured object:
```ts
{ code, severity, headline, body, actionRequired }
```

Example:
```ts
{
  code: "MORTGAGE_NO_RELEASE",
  severity: "critical",
  headline: "2010 mortgage shows no recorded release",
  body: "This plot has a 2010 mortgage that we did not find a release for in the records we checked. This does not necessarily mean the mortgage is still active.",
  actionRequired: "Verify with the lending bank that the mortgage was released before relying on this report.",
}
```

**Reviewer:** Eng-2 escalates the 7 flag message bodies to a lawyer (or in-house product owner with legal review) before P3 V1 ships. **This is on the critical path; no P3 V1 without lawyer sign-off on flag copy.**

### 4.4 Summary text scope (adversarial P3.7)

Plan 3 said "no unreleased mortgage" is legitimate. The PM review disagrees. Resolution: **`summary` is restricted to structured counts only.**

```ts
// A13ResultSchema
summary: z.string().regex(/^\d+ events?, \d+ owners?(?:, \d+ (?:critical|warn|info) flags?)?$/),
```

Example outputs:
- `"12 events, 4 owners, 1 critical flag"`
- `"1 event, 1 owner"`
- `"7 events, 3 owners, 2 warn flags"`

No prose. No verdicts. No "ownership appears continuous". The A11 `verdict-language` rule does not need a P3-specific allowlist because there is no P3 prose to allow.

**Implication for A11:** the A11 allowlist changes listed in Plan 3 §2 (`A13_ALLOWED_PHRASES`) are **deleted**. Simpler, safer, faster.

### 4.5 Layout determinism (adversarial P3.1)

`network-simplex` ranker is deterministic across Node versions. Dagre's `tight-tree` is not. We pick `network-simplex` from the start. Layout test fixture runs `dagreLayout` twice on the same input; assert positions equal pixel-for-pixel.

### 4.6 Concrete file tasks

| File | Action | Acceptance |
|---|---|---|
| `agents/ownership-lineage-graph/schema.ts` | New (V1) | Zod schemas; `summary` regex; `layout.mode` enum |
| `agents/ownership-lineage-graph/index.ts` | New (V1) | `reasonA13(input): A13Result`; `chooseLayoutMode()` |
| `agents/ownership-lineage-graph/red-flags.ts` | New (V1) | 7 flag definitions with lawyer-reviewed copy |
| `agents/ownership-lineage-graph/sort.ts` | New (V1) | `sortEventsChronologically()`; tie-break order |
| `agents/ownership-lineage-graph/fixtures/golden-chains.ts` | New (V1) | 6 cases: single transfer, partition, mortgage-no-release, rapid-flips, inheritance-unrecorded, partition-missing-shares |
| `agents/ownership-lineage-graph/index.test.ts` | New (V1) | vitest; golden chains; A11 audit smoke |
| `agents/consumer-report-writer/src/index.ts:3194` | Modify (V1) | `buildRoRBackPagePanel` gets a new `lineageBullets` sub-section |
| `agents/consumer-report-writer/src/mapper.ts:218` | Modify (V1) | `a13?: A13Result` on `Tier2Input` |
| `agents/consumer-report-writer/src/mapper.ts:275-314` | Modify (V1) | `a13: z.any().optional()` on `ConsumerReportGenInput` |
| `apps/web/src/lib/pipeline/index.ts:188-243` | Modify (V1) | A13 call site, A7-pattern |
| `agents/ownership-lineage-graph/layout.ts` | New (V2) | `dagreLayout()` with `network-simplex` ranker |
| `apps/web/src/lib/pipeline/svg-capture.ts` | New (V2) | Playwright inline capture during main render |
| `apps/web/src/components/OwnershipLineageCard.tsx` | New (V2) | Mobile timeline + desktop SVG; `<details>` collapse |
| `apps/web/package.json` | Modify (V2) | `"dagre": "^0.8.5"` (server-only; explicit comment) |

### 4.7 Tests per phase

**V1:**
- 6 golden chain fixtures; `reasonA13` deterministic on repeat input.
- Red-flag detection: each fixture exercises ≥ 1 flag.
- A11 audit smoke: `summary` matches the count-regex; no verdict language in `nodes[].displayName` or `edges[].documentType`.
- Layout mode selection: 80-node fixture → `list`; 20-node desktop → `svg`; 20-node mobile → `timeline`.

**V2:**
- Layout stability: `dagreLayout` twice on same input → positions equal.
- 6 golden chains rendered to SVG; snapshot tests.
- Mobile timeline: HTML structure validates (`<details>`, scrollable strip, tap handlers).
- Playwright capture: `svg-capture.test.ts` — full pipeline render produces a non-empty lineage section in the PDF.

### 4.8 Go/No-Go gate (P3 V1 → P3 V2)

- **GO if:** 6/6 golden chains produce correct nodes/edges/flags; A11 audit smoke 6/6; layout mode selection deterministic; flag copy has lawyer sign-off.
- **NO-GO if:** any golden chain produces wrong flags (false positive critical); A11 detects a verdict-language string in any output; `reasonA13` non-deterministic on repeated calls.

### 4.9 Highest-risk assumption + mitigation

**Assumption:** Bhulekh `backPage.mutationHistory` is rich enough to construct ownership chains for ≥ 80% of real plots. (Plan 1 architecture notes: per-mutation party names are NOT in the schema today — `mutationParties[]` does not exist.)

**Mitigation:** V1 builds the data layer; we measure chain-construction success rate on the 6 golden chains + the 10 `P006-P015` ground-truth plots. If success rate < 80% on the 10 ground-truth plots, V2 is **scoped down** to "data layer only" (no SVG) and we ship what we have. P3 V2 SVG is a stretch goal contingent on the data being there.

---

## 5. Phased Schedule (4 weeks, 2 engineers)

### Week 1 — P1 P0 + P1 P1 foundation
- **Eng-1:** P1 P0 (dict + normalise + loader). `lib.ts` rewires. `lib.test.ts` with 200-name held-out.
- **Eng-2:** A11 audit owner setup. `ai-claims.ts` fixture. `no_ungrounded_ai_claim` rule scaffold (no consumers yet, but the test infrastructure is live). Cost-tracker table design.
- **EOD Friday gate:** P1 P0 GO if held-out ≥ 70%.

### Week 2 — P1 P1 + P1 P2 + P3 V1
- **Eng-1:** P1 P1 (lookup order rewrite + dict to 500). P1 P2 (surname-match + A5 wiring). Owns the `agents/ownership-reasoner/index.ts:366-490` deletion — first to land because A5 tests need it.
- **Eng-2:** P3 V1 (`reasonA13` + red-flags + golden chains + A11 allowlist). Lawyer escalation for flag copy mid-week.
- **EOD Friday gate:** P1 P1 GO if 88%; P3 V1 GO if 6/6 golden chains.

### Week 3 — P2 V1 (Sonnet IGR EC) + P1 P3 (Haiku, off-by-default)
- **Eng-1:** P1 P3 (`llm-oracle.ts` + PII redactor + Supabase counter). Code-complete, flag off in prod.
- **Eng-2:** P2 V1 (full IGR EC flow + SSE + A11 rule consumers + ₹499 upsell gate). A11 fixture 20/20.
- **EOD Friday gate:** P2 V1 GO if 2/2 golden fixtures + cost ≤ $0.15 + upsell live.

### Week 4 — P2 V1.5 + P3 V2 + P1 P4
- **Eng-1:** P1 P4 (feedback ingest + admin review + auto-approve cron). P3 V2 layout (Dagre `network-simplex`, SVG capture).
- **Eng-2:** P2 V1.5 (Bhulekh back Haiku). A/B test setup Haiku vs Sonnet. Production monitoring dashboards.
- **EOD Friday gate (sprint end):** Combined accuracy ≥ 92% P1; P2 cost ≤ $0.05/report; P3 lineage renders in PDF for 6/6 golden chains.

### Post-sprint (V2/V3)
- P2 V2: upload UI + mutation order + certified copy (Opus tier).
- P3 V3: cross-doc reference (A12 ↔ A13).
- P1 sustained 99% via feedback loop.

---

## 6. Combined Cost Projection Per Report

| Workstream | Per-report cost (typical) | Per-report cost (worst case) | Per-month at 1,000 reports |
|---|---|---|---|
| P1 deterministic | $0 | $0 | $0 |
| P1 Haiku (gated) | $0.0002 | $0.00075 | $0.20 – $0.75 |
| P2 IGR EC (cached) | $0.019 | $0.027 (first call) | $19 – $27 |
| P2 Bhulekh back (cached) | $0.0036 | $0.004 (first call) | $3.60 – $4 |
| P3 (compute only) | $0 | $0 | $0 |
| **Total** | **$0.023** | **$0.032** | **$23 – $32** |

**Org-level monthly cap:** $500. At 1,000 reports/month typical = $23; at 10,000 reports/month (stretch) = $230. Cap is not binding in the 12-month forecast.

**Per-report ceiling (defensive):** $0.15 hard. Pre-flight gate rejects over-budget reports and surfaces "AI summary unavailable" (P2 degrade) or "Transliteration fallback to charByChar" (P1 degrade).

---

## 7. Test Plan Summary

### Per-workstream test files

| Workstream | Test file | Fixture count | Gate |
|---|---|---|---|
| P1 | `lib.test.ts` | 200 held-out | ≥ 88% (P1), ≥ 96% (P4) |
| P1 | `normalise.test.ts` | 50 | 100% pass |
| P1 | `surname-match.test.ts` | 25 | 25/25 |
| P1 | `llm-oracle.test.ts` | 20 (mocked) | 100% validation rejection on bad inputs |
| P1 | `pii-redact.test.ts` | 20 | 100% redaction on PII patterns |
| P1 | `feedback.test.ts` | 10 (P4) | 100% merge accuracy |
| P2 | `validate-quotes.test.ts` | 20 | 100% rejection on bad quotes |
| P2 | `index.test.ts` | 2 golden (V1), 4 (V2) | ≥ 95% extraction, 100% grounding |
| P2 | `cost-tracker.test.ts` | 10 | 100% pre-flight gate |
| P3 | `index.test.ts` | 6 golden | 6/6 chains + A11 smoke |
| P3 | `layout.test.ts` (V2) | 6 | Layout deterministic + snapshot |
| A11 | `output-auditor/index.test.ts` | 20 (must-pass + must-fail) | 20/20 |
| A11 | `ai-claims.test.ts` | 20 | 20/20 |
| Integration | `e2e.test.ts` | 3 reports (one per workstream) | All quality gates hit |

### Held-out discipline (P1)

Training set: 50 names from `qa/ground_truth/P006-P015/transcript.md`.
Held-out set: 200 names from Forebears + babynamesdirectory + `P016-P020` (or first 40 unread Bhulekh tenants).
Validation set: 50 names from the same sources, used only for threshold tuning.

**No overlap** between training, held-out, and validation. CI enforces this with a hash dedup.

### Integration test (week 4)

`e2e.test.ts` runs the full pipeline for one ground-truth plot with all three workstreams enabled. Asserts:
- Owner name in the rendered HTML matches the held-out ground truth (P1 gate).
- AIDocSummaryCard for IGR EC shows fields with `data-ai-confidence` ≥ 0.4 (P2 gate).
- Lineage section shows ≥ 1 flag (P3 gate, on the fixture's chosen flag type).
- A11 audit pass (no verdict language; disclaimer present).
- Combined cost ≤ $0.15.

---

## 8. Risk Register

| ID | Risk | Workstream | Mitigation |
|---|---|---|---|
| R1 | A11 auditor modified by 3 plans with no integration owner | All | Eng-2 owns A11; PR order locked; A11 fixture gates every PR |
| R2 | Tautological accuracy on training set (Plan 1 adversarial P1.1) | P1 | Held-out discipline; 200-name independent set |
| R3 | `charByChar` floor at 62% drags average (Plan 1 adversarial P1.2) | P1 | Accept 0.62 for `machine_reading` tier; gate the average at 88% |
| R4 | `SURNAME_CLUSTERS` hand-built (Plan 1 adversarial P1.3) | P1 | `cluster-from-dict.ts` script generates clusters; committed output |
| R5 | Haiku 200/day cap unrealistic (Plan 1 adversarial P1.4) | P1 | Supabase-backed per-report sub-budget (3 calls); counter survives Vercel cold-starts |
| R6 | PII gate too weak (Plan 1 adversarial P1.6) | P1 | `pii-redact.ts` runs before LLM call; test fixture 20 cases |
| R7 | Ownership-reasoner / lib.ts divergence (Plan 1 adversarial P1.7) | P1 | Delete ownership-reasoner duplicate in P1 P1; first PR before A5 changes |
| R8 | Cost arithmetic off by 10x (Plan 2 adversarial P2.1) | P2 | Corrected to $0.019/call; budget gate; first-call cost tracked |
| R9 | Haiku hallucinates on low-OCR images (Plan 2 adversarial P2.2) | P2 | Sonnet for IGR EC; Haiku only for clean Bhulekh back; A/B test V1.5 |
| R10 | Quote grounding accepts trivial substring (Plan 2 adversarial P2.3) | P2 | 3-check validator (substring + token-window + bbox) |
| R11 | HTML-vs-PDF fetcher gap (Plan 2 adversarial P2.6) | P2 | A12 ingests HTML/PNG/PDF via discriminated union |
| R12 | Dagre `tight-tree` non-deterministic (Plan 3 adversarial P3.1) | P3 | `network-simplex` ranker; layout stability test |
| R13 | Server-side Dagre slow on large graphs (Plan 3 adversarial P3.3) | P3 | 80-node cap; complexity gate chooses mode |
| R14 | Flag copy is engineering copy, scary (PM review) | P3 | Lawyer sign-off before P3 V1 ships; structured `headline`/`body`/`actionRequired` |
| R15 | `summary` field plus A11 allowlist is a loophole (Plan 3 adversarial P3.7 + PM review) | P3 | `summary` restricted to count regex; A11 allowlist changes deleted |
| R16 | 60-second pipeline budget (Plan 1 adversarial cross-cutting) | All | P1 Haiku 800ms race; P2 SSE is post-render; P3 layout ≤ 50ms; measured in `e2e.test.ts` |

---

## 9. Sign-off

This plan resolves every critique in the adversarial review (P1, P2, P3) and the PM review. It sequences the work, names the file paths, defines the gates, projects the cost, and identifies a single A11 owner. The most likely failure mode is **R1** (A11 integration). The most likely scope miss is **R9** (Sonnet cost in production at higher volume). The most likely delay is **R14** (lawyer sign-off on flag copy).

**Recommendation:** Approve. Begin Monday.
