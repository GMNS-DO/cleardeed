# CURRENT_FOCUS.md

> **One page. Updated daily. Delete completed items rather than marking them done.**
> Today is the only thing that matters. Implementation sprints only.

---

## This week's shipped items (do not redo)

**PI-V Sprint V2 — Bhunaksha Plot Report fetcher (D-036) — 2026-06-14**
- Fetcher at `packages/fetchers/bhunaksha-plot-report/` — Playwright + position-based parser
- 59/59 V2 contract tests pass; P051 ground-truth (Mendhasala 181/10454) live-verified
- Mapper integrated; `mapImageBase64` (588 KB SVG) embedded in Section 1 of report HTML
- 1307/1307 test suite pass; 2 pre-existing bhunaksha polygon failures unrelated

**Consumer report infrastructure — 2026-06-14**
- Bhunaksha Plot Report map image now renders in Section 1 (polygon + satellite + cadastral)
- In-report feedback widget (👍/👎 per section + optional text) shipped; POSTs to `/api/feedback` → `report_feedback` table
- IGR EC 1-year search range (D-033) — shipped in 3 files; no open items
- RCCMS 5s timeout wrapper — shipped in commit `ad6c66a`; pipeline re-enabled, stub removed
- CERSAI "no charges found" = `status: "success"` with `data.total = 0` — shipped `d943f59`
- BDA-zoning `out_of_scope` status — shipped `cdffdb8`
- eCourts district code fix (`8` not `561`) — shipped `23268cd`

**IGR EC V2 captcha solver (D-035) — 2026-06-14**
- 3-way ddddocr ensemble + adaptive K; 91.2% top-64, 94.1% top-128 on 205 captchas
- V2 automated login **deferred from Khordha launch (D-037, 2026-06-14)** — operationally brittle
- Buyer still gets the typed manual-instructions panel; SRO portal link is the action

**Map UI**
- **Root cause confirmed:** `NEXT_PUBLIC_MAPBOX_TOKEN` missing from Vercel — no code bug
- **Fix:** add token in Vercel Dashboard → Project Settings → Environment Variables, then redeploy
- Placeholder added to `.env.example`

---

## Remaining for Khordha launch (today's action list)

**Before buyer can pay ₹1 and get a full report:**
- [x] Add `NEXT_PUBLIC_MAPBOX_TOKEN` to Vercel (map renders; polygon already arrives correctly) — done 2026-06-14

**After launch, before PI 2 (Cuttack):**
- [ ] Populate 50 ground-truth plot manifests (founder manual portal work, ~15–20 hrs)
- [ ] Bhunaksha map image embedded in PDF (currently web only — parked in BACKLOG)
- [ ] Bhunaksha GIS-code table expanded to cover all 1,477 Khordha villages
- [ ] RCCMS portal reliability investigation (timeout works, but probe still sometimes hangs beyond 5s — replace with HTTP fetch or 24h cache)

---

## Blocked (not on critical path — map is the only remaining display bug)

- RCCMS: 5s timeout works; deeper reliability improvement is 1-day engineering task after launch
- Bhuvan flood layer: ORSAC WFS access required; Cuttack-flood disclaimer is current substitute
- Market context (broker listings): TOS risk, deferred to BACKLOG
- PID patterns: no VALIDATED patterns yet (≥5 cases gating rule); not consumer-visible

---

## PI-V validation status

- V1: corpus scaffold complete; 5/50 ground-truth plots pre-filled; rest = founder manual work
- V2: 9 fetchers contract-tested (1307 pass); CERSAI OCR ≥85% target pending live benchmark
- V3: section-level validators + degradation matrix scaffolded; blocked on ground-truth population
- V4: pre-payment input gate shipped (D-029); shadow runner scaffolded

Cuttack launch gates on V4 exit: ≥95% valid inputs produce correct/typed-degraded reports, 50-plot regression green.

---

## PI-V.5 — IGR Public-Data Integration (D-038, 2026-06-15)

Approved departure from PI-V's "no new features" hard rule. Reuses PI-V's 50-plot ground-truth corpus and shadow-runner infrastructure. 3 sprints × 2 weeks. See `/.claude/plans/piped-splashing-fog.md` for the full plan.

**Sprint V5a (Weeks 1-2) — Bug fix + consideration wire + igr-sro — SHIPPED 2026-06-15**
- [x] Fix V1 IGR-EC instructions bug: add `instructions` to `IGRECData` schema, assign in both return paths, render in `consumer-report-writer` (D-040)
- [x] Wire IGR-EC `consideration` into Section 5 directional band
- [x] Create `@cleardeed/fetcher-igr-sro` package (4 SROs: Bhubaneswar/Jatni/Balipatna/Banapur)
- [x] Wire igr-sro into V1 pipeline as Step 2c + buildSourceResult + contract barrel
- [x] Exit: 1 fetcher live, 1 bug fix shipped, 1 wire shipped, 1404 tests pass

**Sprint V5b (Weeks 3-4) — igr-bmv + stamp-duty + igr-daily-bulletin**
- [x] Create `@cleardeed/fetcher-igr-bmv` (replaces circle-rate seed when live) — package shipped 2026-06-15
- [x] Create `@cleardeed/fetcher-stamp-duty` (cross-check seller's quoted price vs government expectation) — package shipped 2026-06-15
- [x] Create `@cleardeed/fetcher-igr-daily-bulletin` (24h cache, registration velocity) — package shipped 2026-06-15
- [x] Add stamp-duty + igr-daily-bulletin contract files (`apps/web/src/lib/pipeline/contracts/{stamp-duty,igr-daily-bulletin}.ts`) + barrel exports
- [x] Add 3 fetchers to `pnpm-workspace.yaml` + vitest aliases (`@cleardeed/fetcher-igr-bmv`, `…-stamp-duty`, `…-igr-daily-bulletin`)
- [x] Wire 3 fetchers into V11 pipeline (`Step 2f`/`2g`/`2h`) + `buildSourceResult` + `tier2Input`
- [x] Extend `buildBenchmarkSection` with 3 new sub-cards (IGR BMV floor, stamp-duty total, IGR daily-bulletin velocity)
- [x] Run live smoke against `igrodisha.gov.in` for all 3 fetchers — typed-degraded, see `V5B_LIVE_SMOKE_RESULT_2026-06-15.md`
- [ ] Pre-fill P005/P010/P015 manifests (founder) — pending
- [ ] Re-run live smoke when portal is known-good (1 success path)
- [ ] PDF render verification of V5b sub-cards
- [ ] Exit: 3 fetchers live, ≥1347 tests pass, 4 ground-truth plots pass

**Sprint V5c (Weeks 5-6) — public-dashboard + govt-fee + igr-certified-copy (Phase 1) — SHIPPED 2026-06-15**
- [x] Create `@cleardeed/fetcher-public-dashboard` (page-alive probe, server-rendered; typed-degrade) — package shipped 2026-06-15
- [x] Create `@cleardeed/fetcher-govt-fee` (permanent typed cache, official fee schedule) — package shipped 2026-06-15
- [x] Create `@cleardeed/fetcher-igr-certified-copy` (Section 57 Book 1/2 index-card, Phase 1 typed-degrade) — package shipped 2026-06-15
- [x] Add 3 contract files (`apps/web/src/lib/pipeline/contracts/{public-dashboard,govt-fee,igr-certified-copy}.ts`) + barrel exports
- [x] Add 3 fetchers to `pnpm-workspace.yaml` + vitest aliases
- [x] Wire 3 fetchers into V11 pipeline (`Step 2j`/`2k`/`2l`) + `buildSourceResult` + `tier2Input`
- [x] Add Section 2 sub-card "Previous sale deed (open index entry)" with §57 transparency note
- [x] Add Section 7 "Official References & Fees" (govt-fee table + public-dashboard live link)
- [x] Run live smoke against `igrodisha.gov.in` for all 3 — see `V5C_LIVE_SMOKE_RESULT_2026-06-15.md`
- [ ] Pre-fill P020 manifest (founder) — pending
- [ ] PDF render verification of V5c sub-cards
- [ ] Exit: 7 fetchers live, ≥1367 tests pass, 5 ground-truth plots pass

**Founder work on critical path:** 5 plots × 2-3 hrs/plot = 10-15 hrs over 6 weeks. Can be parallelized with engineering.

---

## A. Audit remediation — 2026-06-15

**A.1 Stable foundation (5/5)**
- [x] A.1.1: Fix 1 failing cersai test (was a stale assertion after D-040 captcha-solver commit; 38/38 green)
- [x] A.1.2: Commit uncommitted igr-ec D-040 fix (5 new captcha paths)
- [x] A.1.3: Resolve untracked files (probe scripts + result docs)
- [x] A.1.4: Map UI bug fix (z-index + touch target)
- [x] A.1.5: DPDP technical surface (privacy policy + delete endpoint + retention)

**A.2 Fetcher accuracy (5/5)**
- [x] A.2.1: Ground-truth corpus 5→15 (10 new verified plots, PID-validated)
- [x] A.2.2: CERSAI captcha-solver spike (live portal V2, 38/38 contract tests; live captcha accuracy validation blocked by portal stability)
- [x] A.2.3: eCourts OCR validation harness (P052 P053 cases captured)
- [x] A.2.4: RCCMS reliability improvement (RCCMS now uses Bhulekh Back Page as ground-truth cross-check; 92% confidence)
- [x] A.2.5: Live smoke battery (`qa/all_fetchers_live_smoke.test.ts`, runs all 14 fetchers in sequence with status/CRASH/latency reporting)

**A.3 User experience (3/4)**
- [x] A.3.1: User copy simplification (Section 3a lead-in: EC = "loan + transfer history")
- [x] A.3.2: Mobile optimization (480px media query: 15px text, 44px tap targets, stacked cards)
- [x] A.3.3: Visual hierarchy — *no change needed* (existing summary panel + status-grid + watchout/ok card split already implements §4 of CLAUDE.md)
- [ ] A.3.4: Edge case reports — pending

**A.4 Infrastructure reliability (0/6)**
- [ ] A.4.1–6: error monitoring, rate limiting, DB backups, staging env, perf baseline, load test — all pending (all infrastructure work; flagged by audit as not blocking buyer behavior)

**A.5 Pre-launch polish (0/4)**
- [ ] A.5.1–4: pending

**A.6 Launch week (0/1)**
- [ ] A.6: launch week — pending

---

*Last touched: 2026-06-15*
