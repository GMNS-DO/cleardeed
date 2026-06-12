# Fetcher known issues register

This file tracks known-bad fetcher behaviors the audit agent identified
before Sprint V2. The issue IDs (KI-001 … KI-006) are referenced by V2
contract tests, V3 contract-to-pipeline mappers, and V4 CI gates.

Each issue has:
- `id` — stable identifier (`KI-NNN`)
- `description` — what is broken, with a one-sentence "why it matters"
- `fetcher` — which fetcher is affected
- `severity` — `blocker` (report is wrong) | `warn` (data gap) | `info` (cosmetic)
- `status` — `open` | `in_progress` | `fixed`
- `discovered_date` — `YYYY-MM-DD`

Per CLAUDE.md: the issue register is the *source of truth* for what V2/V3/V4
must catch. Do not remove entries when they are fixed — flip the status and
add a `fixed_in` note.

---

## KI-001 — RCCMS fetcher is hard-stubbed in V1.1 pipeline

- **Fetcher:** rccms
- **Severity:** blocker
- **Status:** open
- **Discovered:** 2026-06-12

The V1.1 pipeline (`apps/web/src/lib/pipeline/index.ts` `generateReportV11`)
hard-codes an `rccmsResult` literal of `status: "failed"` with
`statusReason: "rccms_probe_skipped_sprint6_todo"`. The actual
`rccmsFetch` is never called. The buyer report therefore reports "0 revenue
court cases found" with no visible "fetch failed" indicator — buyers are
left thinking there are no cases when the fetcher simply never ran.

**Why it matters:** revenue court cases are a primary Title check signal
(disputes over possession, mutation, or boundary). A silent stub is worse
than a visible failure.

**Fix candidate (V3 or Sprint 7+):** call `rccmsFetch` with a 5s budget; on
timeout return `status: "source_down"` with `error: "rccms_timeout"` so the
report surfaces the gap explicitly.

---

## KI-002 — RCCMS schema divergence (fetcher vs `@cleardeed/schema`)

- **Fetcher:** rccms
- **Severity:** blocker
- **Status:** open
- **Discovered:** 2026-06-12

The local fetcher schema (`packages/fetchers/rccms/src/schema.ts`) defines
`RCCMSCaseSchema` with fields `caseId, petitioner, respondent, status, filingDate,
nextHearingDate`. The shared `@cleardeed/schema` `RCCMSResult.data.cases[]`
uses `caseNo, plotNo, caseType, status, court` — no party split, no
`nextHearingDate`. The fetcher output is **silently coerced** into the
shared schema, dropping party names and renaming fields.

**Why it matters:** the buyer report renders "Land dispute — pending" with
no party names. If the case is contested by a specific individual, that
information is lost before the reasoner sees it.

**Fix candidate (V3):** align `RCCMSCaseSchema` to the shared schema. Add
`parties: [{ name, role }]` to the shared schema if the fetcher genuinely
has them. The V2 contract (`apps/web/src/lib/pipeline/contracts/rccms.ts`)
already uses the shared schema's field names — V2 will not regress this.

---

## KI-003 — V1.1 orchestrator only calls Bhulekh

- **Fetcher:** orchestrator (not a fetcher per se, but blocks all other fetchers)
- **Severity:** blocker
- **Status:** open
- **Discovered:** 2026-06-12

`packages/orchestrator/src/index.ts` `runAllFetchers` only invokes
`bhulekhFetch` when V1.1 dropdown input is provided. The other 7 sources
(eCourts, IGR EC, CERSAI, Bhunaksha, circle-rate, bda-zoning, Nominatim)
are fetched *only* in the downstream pipeline layer
(`apps/web/src/lib/pipeline/index.ts` `generateReportV11`), not in the
orchestrator. This means the orchestrator's `sources` array is
Bhulekh-only, and `mapToReportInput` has to manually merge in the rest via
`buildSourceResult` (which builds bare-minimum `SourceResult` objects from
the fetcher returns).

**Why it matters:** the contract between orchestrator and pipeline is
implicit and ad-hoc. If the pipeline forgets to call a new fetcher, the
report silently omits it.

**Fix candidate (V3):** the orchestrator should own the fetcher call list
and the pipeline should consume `orchestratorOutput.sources` directly. The
V2 contracts in `apps/web/src/lib/pipeline/contracts/` make this refactor
mechanical — each fetcher's contract is the typed payload the orchestrator
guarantees.

---

## KI-004 — IGR EC + CERSAI entries not passed to financial exposure section

- **Fetcher:** igr-ec, cersai
- **Severity:** warn
- **Status:** open
- **Discovered:** 2026-06-12

`generateReportV11` calls `igrEcFetch` and `cersaiFetch`, surfaces their
*status* in the `sourceSummary`, and builds `encumbranceReasoner` with the
`instructions` text. It does NOT pass the actual `entries[]` (IGR EC) or
`charges[]` (CERSAI) data into the EncumbranceReasoner — only the
instructions. The "What you might lose after paying" report section
therefore shows the *manual follow-up text* but never the actual entries
or charges the fetcher returned.

**Why it matters:** if the fetcher DID return data (some sessions, some
network conditions), the buyer never sees it. The instructions are
displayed instead, which is conservative but discards real signal.

**Fix candidate (V3):** extend `EncumbranceReasoner` input shape to accept
`igrEcData.entries` and `cersaiData.charges`; render them as a list with
"Active charge" / "Satisfied charge" badges. The V2 contract schemas for
IGR EC and CERSAI (`igr-ec.ts`, `cersai.ts`) include the `entries` and
`charges` fields ready for this.

---

## KI-005 — LARR fetcher is built but not wired

- **Fetcher:** larr
- **Severity:** warn
- **Status:** open
- **Discovered:** 2026-06-12

`packages/fetchers/larr/` exists with a fetcher implementation, but is
NOT called from the orchestrator or the V1.1 pipeline. LARR (Land
Acquisition, Rehabilitation & Resettlement) cases are relevant for plots
near government-acquired land, but a buyer-relevant "LARR check" requires
matching GPS proximity to acquisition notifications — not currently
implemented.

**Why it matters:** this is "in scope" for the Tier-1 buyer decision
(plots acquired for highways, industrial corridors, etc. are a real risk
in Odisha), so the missing wire-up is a data gap rather than a bug.

**Fix candidate (Sprint 8+):** wire `larrFetch` into the orchestrator with
a GPS proximity check (within 500m of a notified acquisition). Out of V2
scope; tracked here for the next sprint planning cycle.

---

## KI-006 — CERSAI OCR accuracy is unmeasured

- **Fetcher:** cersai
- **Severity:** warn
- **Status:** open
- **Discovered:** 2026-06-12

The CERSAI fetcher uses Tesseract.js to solve the captcha before
submitting a search. There is no benchmark for OCR accuracy against the
live CERSAI captcha. A 95% accuracy in unit tests with synthetic captchas
may be 70% in production (CERSAI rotates fonts and distortion monthly).

**Why it matters:** below ~80% captcha accuracy, the fetcher hits
CERSAI's rate limiter and effectively goes into source_down for hours.
A silent regression here is the silent killer of the CERSAI signal.

**Fix candidate (V4):** the `qa/fetcher_tests/cersai_ocr/` scaffold is
in place (V2). Founder populates 30 captchas + `ground_truth_captchas.json`
in V3; the CI gate is added in V4. The 30-image benchmark lives in
`qa/fetcher_tests/cersai.test.ts` (skipped until populated).

---

## How to use this register

- When a V2 contract test fails on a fetcher that is in the "open" list
  here, mark the test as a known failure with a reference to the KI id.
- When V2 contract tests pass, the register is the only place the known
  issues are recorded. Don't duplicate them in the code.
- Fixing an issue: flip the status to `fixed`, add a `fixed_in:` line
  with the commit hash, and reference the issue from the PR description.
  Leave the entry in place.
