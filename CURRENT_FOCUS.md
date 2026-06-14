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

*Last touched: 2026-06-14*
