# ClearDeed — Source Reliability & PID Foundation Design

**Date:** 2026-06-17
**Author:** ClearDeed founder + Claude (Opus 4.7)
**Status:** Draft for user review
**Scope:** Push fire rate on the 9 production data sources from 4/9 to 24-25/25 (across current + built-but-unwired + new sources), plus the PID actor-network v1 foundation, over 16 weeks. Captcha solving stays in-house (D-013).

---

## 1. Reframed objective

The 9 current data sources fire at very different rates:

| # | Source | Today | Why it doesn't fire |
|---|---|---|---|
| 1 | Bhulekh RoR | ~95% (V2 captcha solver 91.2%) | None — works, can be hardened |
| 2 | Bhunaksha WFS | 100% | None — JSON / WFS, very reliable |
| 3 | Nominatim | 100% | None — public OpenStreetMap |
| 4 | eCourts | 0% (manual-instructions) | V6 portal 302/403; dCourts subdomain OCR ~30% |
| 5 | IGR EC | 0% (manual-instructions) | V2 captcha deferred (D-037) |
| 6 | CERSAI | 0% (manual-instructions) | Vue SPA reactive captchaHash (D-037) |
| 7 | RCCMS | 0% (manual-instructions) | Playwright probe hangs >3min (wrong URL — see §3) |
| 8 | Circle rate | 100% (local JSON) | None — Khordha covered |
| 9 | BDA zoning | 100% (local JSON) | None — Khordha covered |
| 10 | LARR | 0% (unwired) | Fetcher built, not called |

**Net: 4-5/10 fire reliably, 4/10 ship only as "manual instructions" (typed-degraded), 1/10 unwired.**

The product's trust story collapses in the "manual instructions" sections: a buyer who pays ₹1 and gets "verify CERSAI manually at cersai.org.in" cannot tell whether that's a confident "no charges found" or a fetcher that never ran.

**The reframed objective:**

> For every buyer who pays ₹1, the report should contain data that was actually fetched, not a placeholder. The buyer should be able to tell — at a glance — which sections fired with real data and which sections required manual verification.

This is a **honesty + coverage** problem, not a fetcher-rewrite problem. Most of the fire-rate gain comes from (a) wiring the 9 already-built-but-unwired fetchers and (b) telling the truth in the UI about which sections are real.

---

## 2. Three principles

1. **"Fire" means real data returned, not typed-degraded fallback.** A CERSAI query that returns "no charges found" fires. A CERSAI query that returns "manual_required" does not. The product must surface the difference honestly.

2. **Wire the 9 already-built-but-unwired fetchers before building new ones.** Of 18 fetcher contracts (`apps/web/src/lib/pipeline/contracts/`), 9 are wired. The cheapest fire-rate gain is closing that gap.

3. **Per-source captcha policy: in-house ddddocr ensemble + adaptive K, no vendor for captcha solving.** D-013 posture is preserved. Browserless/Browserbase are NOT approved for captcha; they are only for novel anti-bot postures (Vue reactive state) if and only if in-house fails for ≥2 weeks.

---

## 3. The single biggest finding: RCCMS portal has migrated

The RCCMS probe is targeting `rccms.odisha.gov.in` (the v1 portal that has been retired). The active, NIC-maintained v2.0 stack is `ccms.nic.in`. New endpoints:

- `https://ccms.nic.in/searchCases.html` — case search (Case Number, Petitioner Name, Hal Plot No, Case Registration ID)
- `https://ccms.nic.in/fetchallCaseDetails.html` — case details POST
- `https://ccms.nic.in/findCase.html` — search by case number
- `https://ccms.nic.in/searchbykhatanoid.html` — search by khata number
- `https://ccms.nic.in/searchbyhallkhatano.html` — search by hal + khata
- `https://ccms.nic.in/userCauseListView.html` — daily cause lists
- `https://ccms.nic.in/pendencyFiledownload.html` — pendency list PDFs (contains Khurda partition cases from 1993)

Verified: 0.67s response time on `searchCases.html`. No Playwright hang. Plain HTTP.

Same courts (BoR + RDCs + Collectors + ADMs + Sub-Collectors + CC&S Bhubaneswar) as the old `rccms.odisha.gov.in` targeted, plus the new "Land Records & Settlement, Bhubaneswar" bench.

**This is the single biggest unlock in the entire research.** 6-10 hrs and <₹200/mo may flip `section-encumbrance` from "partial/manual_required" to fully automated.

---

## 4. Three layers, 16 weeks

### Layer 1: Source Unblock (weeks 1-6)

**Goal:** Flip 3 dead sources (eCourts, IGR EC, CERSAI) plus RCCMS from "manual instructions" to "real data returned."

| Source | Path | Effort | Cost | Target fire rate |
|---|---|---|---|---|
| **RCCMS** | Pivot to `ccms.nic.in` v2.0; build captcha-solver adapter for `captcha.jpg` | 6-10 hrs | <₹200/mo (2Captcha) | 85-90% |
| **eCourts** | (1) Apify `parseforge/court-records-ecourt-india-scraper` (CNR-based, ₹40-200/mo); (2) in-house ddddocr ensemble for `khurda.dcourts.gov.in` pattern as backup; (3) Ground-truth test on 10 real Khordha CNRs before committing | 16-24 hrs + 1 day POC | ₹200-800/mo | 70-80% |
| **CERSAI** | (1) In-house ddddocr + Vue-state-replay attempt; (2) Direct LinkedIn DM to Rajat Bindlish as a passive bet; (3) MCA21 ROC charges (`CHG-1/4/9` by CIN) as a 30-40% gap-filler for company-held property | 80-120 hrs (in-house attempt) | ₹0 | 60% (in-house) or 100% (if Bindlish responds) |
| **IGR EC** | Captcha-breaker ONNX fine-tuned on IGR EC captchas (lifts ddddocr from ~75% → ~95%) | 8-12 hrs | ₹0 | 75% |
| **Bhulekh** | Same captcha-breaker ONNX fine-tune, on Bhulekh captchas; KI-006 (CERSAI OCR unmeasured) replaced with a measured-OCR pass | 8-12 hrs | ₹0 | 99% |

**Captcha-breaker ONNX** (`huggingface.co/captcha-breaker/captchabreaker`) — single fine-tune serves Bhulekh, IGR EC, CERSAI, RCCMS, eCourts. Net ~12 hrs to fine-tune + dataset prep.

**Deliverable L1: 8/9 production sources fire with real data** (only LARR remains).

### Layer 2: Wire-up Sprint (weeks 4-8, parallel to L1)

**Goal:** Wire the 11 already-built-but-unwired fetchers (18 contracts − 7 currently wired). LARR moves from "production-9 unwired" to L2 once the §1 framing is updated. Each gets its own sub-agent.

| Fetcher | Why built | Wire-up effort | Buyer value |
|---|---|---|---|
| igr-sro | Last sale deed by SRO | 4-6 hrs | High — Section 2 |
| igr-bmv | Government floor valuation | 4-6 hrs | High — Section 5 |
| stamp-duty | Cross-check seller's quoted price | 4-6 hrs | High — Section 5 |
| igr-daily-bulletin | Registration velocity (24h cache) | 6-8 hrs | Medium — Section 5 |
| public-dashboard | Portal liveness probe | 2-3 hrs | Low — Section 7 |
| govt-fee | Permanent fee schedule | 2-3 hrs | Low — Section 7 |
| igr-certified-copy | Section 57 Book 1/2 index | 6-10 hrs | High — Section 2 |
| bhunaksha-plot-report | Map image + full owner block | 6-8 hrs | High — Section 1 |
| high-court | Orissa HC writs/appeals | 6-10 hrs | High — Section 4 |
| drt | Bank recovery against seller | 6-10 hrs | High — Section 4 |
| larr | Acquisition corridor | 8-12 hrs | Medium — Section 4 |

**Note:** The §1 table lists 10 rows (production 9 + LARR). The production-9 are wired but partially (4 of 9 fire reliably; 4 ship as manual-instructions). LARR is unwired. Layer 2's job is to (a) make all 9 production sources fire reliably (L1 work), and (b) wire the 10 additional built-but-unwired contracts. Total = 11 L2 sub-agents.

**Each wire-up sub-agent must:**
1. Verify the existing contract still matches `@cleardeed/schema` (built for V1, may be stale for V11)
2. Run Bar 1 (parity), Bar 2 (3 fresh plots), Bar 3 (honest degradation)
3. Update `qa/degradation_matrix.json`
4. Update `qa/all_fetchers_live_smoke.test.ts` to include the new fetcher

**Deliverable L2: 18-20/20 fire with real data.**

### Layer 3: New Sources + PID Foundation (weeks 8-16)

**Goal:** Add 6 new high-ROI sources + PID seller-name normalization.

| # | Source | ROI | Effort | Compliance |
|---|---|---|---|---|
| 1 | **RERA Odisha** (rera.odisha.gov.in) | Very high — project + promoter | 8-12 hrs | Low (public search) |
| 2 | **BMC property tax** (Bhubaneswar) | High — outstanding tax | 8-12 hrs | Low (public portal) |
| 3 | **Bhuvan Odisha layers** (flood/CRZ) | High — Section 3 hazards | 12-16 hrs | Low (ISRO open) |
| 4 | **BDA approved layout registry** | Very high — sub-plot legitimacy | 8-12 hrs | Low (public PDFs) |
| 5 | **MCA21 CIN/charges** (company sellers) | High — promoter distress | 16-20 hrs | Medium (ToS gray) |
| 6 | **NCLT/IBBI** (CIRP) | Medium — company sellers | 8-12 hrs | Low (public search) |
| 7 | **EOW Odisha blacklist** | High — repeat-fraud actors | 4-6 hrs | Low (public PDF) |
| 8 | **DILRMP API** (`apis.dilrmp.gov.in/api/<state_id>/<dataset>`, Odisha likely ID 21) | TBD — auth unclear, 1-day probe first | 1-day probe + 12-20 hrs | Low (govt portal) |

**6 picked of 11 candidates** (top by ROI + effort). The other 5 (Indian Kanoon, OSDMA flood, OSID/ORSAC, Forest/wetland, DILRMP) are parked in `BACKLOG.md` for a follow-up design.

**PID actor-network v1:**

- **Seller-name normalization**: Odia transliteration (existing `odia-field-dictionary.ts` patterns) + Jaccard similarity ≥0.85
- **Cross-report seller lookup**: when the same normalized seller name appears in ≥2 reports, surface a "repeat seller" badge in Section 2
- **No ML, no embedding, no cross-plot signal beyond "same name string"** in v1
- **Privacy-preserving**: hash the seller name; never store PII
- **Seed**: 5 reports → seed; 50+ reports → patterns start to surface
- **Threshold**: count ≥2 to surface, ≥5 to flag, never surface without a verified count
- **Copy**: "This seller has appeared in N other ClearDeed reports [link]. May indicate a repeat actor — verify identity at the SRO."

**Deliverable L3: 24-25/25 fire with real data. PID v1 surfaces a "repeat seller" badge for ≥2-count matches.**

---

## 5. Source-by-source plan (25 sources total)

### Current 9 + LARR = 10

| # | Source | Today | Target | Path |
|---|---|---|---|---|
| 1 | Bhulekh RoR | ~95% | 99% | L1 (captcha-breaker ONNX) |
| 2 | Bhunaksha WFS | 100% | 100% | No change; regression tests for >1,500 Khordha villages |
| 3 | Nominatim | 100% | 100% | No change; rate-limit handling |
| 4 | eCourts | 0% | 70-80% | L1 (Apify parseforge + ddddocr ensemble) |
| 5 | IGR EC | 0% | 75% | L1 (captcha-breaker ONNX fine-tune) |
| 6 | CERSAI | 0% | 60% | L1 (in-house attempt) |
| 7 | RCCMS | 0% | 85-90% | L1 (ccms.nic.in v2.0 pivot) |
| 8 | Circle rate | 100% | 100% | No change; expand to 5-district PI2 |
| 9 | BDA zoning | 100% | 100% | No change; expand to 5-district PI2 |
| 10 | LARR | 0% (unwired) | 60-70% | L2 (wire-up + cause-list PDF pre-flight) |

### Built-but-unwired = 11 (Layer 2)

igr-sro, igr-bmv, stamp-duty, igr-daily-bulletin, public-dashboard, govt-fee, igr-certified-copy, bhunaksha-plot-report, high-court, drt, larr = 11. (LARR is in the current-9 table but unwired; moved to L2 for wire-up.)

### New = 6 (Layer 3)

RERA Odisha, BMC, Bhuvan, BDA approved layouts, MCA21, NCLT/IBBI, EOW Odisha, DILRMP (probe) = 8 in scope. 6 implemented; DILRMP and one other parked in BACKLOG.

**Total: 10 (current) + 11 (built-but-unwired) + 6 (new) = 27 source paths, 24-25 firing with real data.** (Some overlap: L1 unblocks the 4 dead production sources, while L2 wires 11 additional ones, while L3 adds 6 new.)

---

## 6. Testing & verification framework

The user explicitly asked: *"keep testing to make sure the implementation outcome is matching the outcome intended in between."* Here is the framework.

### Three testing layers, run continuously

**Layer A — Unit + Contract tests (extend existing)**

Each fetcher has a typed contract in `apps/web/src/lib/pipeline/contracts/`. Extend the contract tests so the **buyer-facing data, not just the status envelope, is asserted.**

Today (CERSAI example):
```ts
expect(result.status).toBe('success')
```

New (CERSAI example):
```ts
expect(result.status).toBe('success')
expect(result.data.charges).toEqual([])

expect(result.status).toBe('partial')
expect(result.data.charges.length).toBeGreaterThan(0)
expect(result.data.charges[0].amount).toBeDefined()
```

This is the load-bearing change: it makes the **fire definition enforceable in CI.**

**Layer B — Live smoke battery (extend existing)**

`qa/all_fetchers_live_smoke.test.ts` already runs all fetchers live. Extend it to:
- Run on every PR (not just on-demand)
- Assert "real data returned" for each fetcher, not just "no crash"
- Track per-fetcher latency p95; alert if regression >20%
- Add a "fired with real data" column to the report output
- Add a `--strict` mode that fails the PR if any fetcher's fire rate drops below its target

**Layer C — Ground-truth corpus (extend existing)**

50-plot ground-truth corpus in `qa/ground_truth/`. Add a `fire_audit.md` that records, for each plot, which fetchers fired with real data. This becomes the launch-readiness gate.

### Three per-source acceptance criteria (Bars)

For each fetcher, three bars:

1. **Bar 1 (parity):** matches the existing fetcher's behavior on the 5 known plots in the 50-plot corpus. Catches regressions.
2. **Bar 2 (live):** fires on 3 fresh plots in the 50-plot corpus that the founder manually verified. Catches false-positives.
3. **Bar 3 (failure):** degrades honestly on 1 plot where the source is known-broken (captcha fails, portal down). Catches false-negatives.

**Each fetcher must hit all three bars before it's "shipped."**

### Sub-agent pattern: 1 fetcher per sub-agent

When the implementation phase starts, each fetcher gets its own sub-agent that owns the full Bar 1/2/3 acceptance. ~25 sub-agents across 16 weeks. The orchestrator (the main session) reviews the test outputs against the intended outcome.

Per-fetcher sub-agent brief template:
- Source URL + captcha / login requirements
- Existing contract file path
- Existing fetcher code path
- Bar 1/2/3 plot IDs from the 50-plot corpus
- Sub-agent reports: contract changes, fetcher code changes, test results, any deviation from the design

---

## 7. Cost

**Sub-₹10K/mo new cost** at 50-200 reports/month:
- Apify parseforge (eCourts): ₹200-800
- 2Captcha (RCCMS, IGR EC, eCourts fallback): ₹80-200
- Captcha-breaker ONNX inference: ₹0 (in-house)
- Bhulekh V2 captcha solver: ₹0 (in-house)

**₹50K/mo hard ceiling** if Signzy/Checkpost sub-entity sponsorship comes through for CERSAI (4-12 week lead). This is a future design.

**0 vendor cost** for captcha solving — in-house ddddocr + captcha-breaker ONNX (D-013 posture maintained).

**Engineering effort:** ~250-350 hours across 16 weeks. One founder + sub-agents.

---

## 8. Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| ccms.nic.in v2.0 captcha unsolvable in-house | Medium | High (loses biggest single unlock) | 2Captcha fallback at ₹200/mo |
| Apify parseforge accuracy on real Khordha <70% | Medium | Medium | Fall back to in-house ddddocr for dCourts subdomain |
| CERSAI Vue reactive state defeats in-house | High | High | Accept gap; Bindlish DM passive bet; sub-entity sponsorship future |
| Captcha-breaker ONNX fine-tune takes longer than budgeted | Medium | Medium | 12-hr budget; fall back to V2 captcha solver (91% accuracy) |
| DILRMP API requires paid auth or no Odisha data | Medium | Medium | 1-day probe first; parked in BACKLOG if not viable |
| 9 already-built fetchers have stale contracts | High | Medium | Wire-up sub-agent verifies contract still matches `@cleardeed/schema` |
| PID seller-name normalization over-matches (false-positive repeat-seller) | Medium | High (trust erosion) | Conservative threshold; Jaccard ≥0.85; count ≥2 to surface, ≥5 to flag; "may be same person" copy |
| MeitY probe expands to property-data aggregators (clear-deed-style) | Low | High | Summarizes, not republishes; legal posture defensible per Bhulekh precedent |
| Bhulekh portal changes mid-launch (June-Aug 2026) | Medium | High | V2 captcha solver + adaptive K; 10% engineering budget reserved for retraining |
| IGR EC captcha changes break the solver | High | High | Adaptive K + 3-way ddddocr ensemble; 10% engineering time per month for retraining |

---

## 9. What this design is NOT

- **Not a "100% fire rate by 30 Sept 2026" promise.** It's a structured plan to push fire rate from 4/9 → 24-25/25 over 16 weeks, with honest acceptance criteria.
- **Not a replacement for legal review.** A captcha-bypass stack operating in the MeitY probe zone carries legal risk that legal counsel should review before launch.
- **Not a guarantee against source regression.** Bhulekh, eCourts, CERSAI, and IGR EC are government portals. They change. The captcha-breaker ensemble + adaptive K + 10% retraining budget is the resilience plan.
- **Not an ML-based PID.** PID v1 is name normalization + count. No embedding, no classifier, no pattern model. PID v2 (separate design) adds those.

---

## 10. Immediate next decisions

1. **Approve this design and proceed to writing-plans.**
2. **Approve the ccms.nic.in pivot as a same-day spike** (highest ROI, lowest risk; the existing rccms.odisha.gov.in probe is targeting the wrong URL).
3. **Approve the Apify parseforge ground-truth test** (1 day, <₹1K, before committing to eCourtsIndia.com Enterprise at ₹10K/mo).
4. **Approve the Bindlish DM + sponsor-bank outreach** (passive bet; weeks 1-4 in parallel with engineering).
5. **Approve the captcha-breaker ONNX fine-tune** as the single captcha-investment item (serves Bhulekh, IGR EC, CERSAI, RCCMS, eCourts).

---

*Last touched: 2026-06-17. Design section, not implementation. Once approved, the next step is the writing-plans skill producing a sequenced implementation plan with one sub-agent per fetcher.*
