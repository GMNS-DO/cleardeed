# ClearDeed — 30-Day Khordha Launch Plan
**Prepared:** 2026-06-16  
**Target:** Khordha district production launch (50-200 reports/month)  
**Pricing:** ₹1 testing price (per CLAUDE.md D-004)  
**Budget:** Bootstrap, no external funding  

---

## How This Plan Is Structured

Two parallel tracks run concurrently. They're sequenced because the manual track gates the engineering track at specific checkpoints, but most engineering work is independent of founder availability.

**Track A — Product/Engineering (AI/CI, mostly independent of founder calendar)**
**Track B — Manual/External (founder calendar-bound, gates Track A at checkpoints)**

Each track has its own timeline. The checkpoints are where they sync. Read them separately; the timeline at the bottom shows the dependency graph.

---

## TRACK A — Product & Engineering

### A.1 Foundation (Days 1-4, 4 days)

**A.1.1 — Stabilize the 1484/1506 test suite (Day 1)**
- Fix the 1 failing cersai test: "captcha solved + 0 records → status='success' with data.charges=[]"
- Re-run full suite, target 1506/1506 green
- File: `qa/fetcher_tests/cersai.test.ts:173`

**A.1.2 — Commit the uncommitted igr-ec D-040 fix (Day 1)**
- Diff already in working tree: adds `instructions` to `IGRECData` schema + assigns in both return paths
- Commit message: `fix(igr-ec): wire D-040 instructions into schema + return paths`
- This is uncommitted work that was claimed in V5a sprint exit

**A.1.3 — Resolve remaining untracked files (Day 1)**
- `apps/web/src/lib/pipeline/contracts/igr-sro.ts` — untracked, likely V5a wire
- `packages/fetchers/bda-zoning/{data,package.json}` — untracked, V4 sprint work
- `infra/supabase/migrations/006_pid_core.sql`, `007_pid_operational_layers.sql` — external PID work, do NOT touch (D-024)
- Untracked status docs (`PROJECT_STATUS_2026-06-12.md`, `VC_ASSESSMENT_2026-06-13.md`, etc.) — either commit to `docs/` subfolder or `.gitignore` (founder decision, see B.1.1)
- `claude33.md`, `bhulekh_bhunaksha_guide.md` — session artifacts, gitignore

**A.1.4 — Map UI bug fix (Days 2-3)**
- Current state: Stuck at "loading" per PROJECT_STATUS_2026-06-12
- Root cause candidate: `NEXT_PUBLIC_MAPBOX_TOKEN` missing from Vercel (already flagged in CURRENT_FOCUS.md)
- Investigation:
  1. Verify Vercel env var is set (or set it — founder does this, see B.1.2)
  2. Check `MapboxBoundaryMap.tsx` for client-side rendering issue
  3. Check mapbox-gl version, ensure it's not SSR-broken
  4. Test in dev + production
- Add smoke test: load `/report/[id]` for a known plot, assert map tiles visible in screenshot

**A.1.5 — DPDP compliance technical surface (Day 4)**
- `/api/user/delete` endpoint: DELETE request → soft-delete user's reports + feedback → return 200
- Add `deletion_requested_at` column to leads/orders tables (founder migration, see B.1.3)
- 30-day retention enforcement: cron or DB-level cleanup
- Anonymize feedback text on report soft-delete

### A.2 Data Source Hardening (Days 5-8, 4 days)

**A.2.1 — Ground-truth expansion: 5 → 15 plots (Days 5-6)**
- Founder provides manifest (see B.2.1) for 10 new Khordha plots
- For each, run `pnpm pid:queue && pnpm pid:spine` to populate corpus
- Target: 15/50 ground-truth plots with full source coverage matrix
- Outcome: regression test suite covers 15 distinct plot signatures, catches per-source breakage

**A.2.2 — CERSAI captcha-solver spike (Days 5-7, parallel)**
- Per D-043b: build headless captcha-solver adapter (D-035 IGR EC pattern)
- Reuse: `packages/fetchers/igr-ec/src/captcha/` — 3-way ddddocr ensemble + adaptive K
- New work: CERSAI V2 SPA reactive state handler (Vue.js-driven `captchaHash` field)
- Spike deliverable: 1 captcha-solver run end-to-end on a real CERSAI V2 page
- **If spike fails:** ship typed-degradation to manual instructions (same as IGR EC), don't block launch
- **If spike succeeds:** validate accuracy on 20 real captchas, target ≥85%

**A.2.3 — eCourts dCourts OCR accuracy validation (Days 5-7, parallel)**
- Per D-043a pilot: eCourtsIndia.com Enterprise Monthly pilot gate
- Engineering work: 5-call ground-truth harness comparing dCourts OCR output vs manual eCourts.gov.in queries
- Acceptance: ≥70% accuracy on real Khordha cases → commit to ₹10K/mo; <70% → typed-degrade
- **This can run in parallel with founder's vendor outreach (B.2.2)**

**A.2.4 — RCCMS reliability improvement (Day 8)**
- Current: 5s timeout sometimes hangs
- Replace: HTTP fetch with explicit AbortController + 5s timeout (no Playwright overhead)
- Add 24h Redis cache for repeated plot+date queries
- Test: 50 sequential probes, assert p99 latency <5s

**A.2.5 — Live smoke battery (Day 8)**
- Run `scripts/smoke/full-pipeline.ts` against all 15 ground-truth plots
- Capture: per-source success/failure, total time, PDF size, email delivery
- Output: `qa/launch_smoke_2026-07-XX.md` with pass/fail matrix

### A.3 Report Polish (Days 9-12, 4 days)

**A.3.1 — User copy simplification (Days 9-10)**
- Audit all 6 section titles and intros for jargon:
  - "Revenue Court Case" → "Government Debt Case"
  - "Encumbrance Certificate" → "Sale History (last 13 years)"
  - "Kisam" → "Land Type"
  - "ROR" → "Land Record"
- A/B test: simplified vs technical with 5 buyers (B.3.1)
- Per CLAUDE.md: "translation and copy-shaping only, never authoritative outputs"

**A.3.2 — Mobile optimization (Days 10-11)**
- Audit report page on mobile (iPhone SE, Pixel 5 widths):
  - Map rendering at 375px width
  - Section cards stack properly
  - PDF download button accessible
  - Shareable URL copy works
- Fix any horizontal scroll, broken layouts, tap targets <44px

**A.3.3 — Visual hierarchy in report (Day 11)**
- "Positive signals first, watch-outs second" (CLAUDE.md §4)
- Currently: flat section layout
- Target: green checkmark for "verified clear", red warning for "issue found", neutral for "manual check required"
- Tie color to data freshness, not to severity of risk (per CLAUDE.md features-not-places)

**A.3.4 — Edge case reports (Day 12)**
- "Worst case" plot: all 4 dark sources fail + 2 watch-outs found
- "Best case" plot: all green, clean title
- "Boundary case" plot: plot on village boundary, ambiguous tehsil
- "Multiple owners" plot: 5+ tenants with share fractions
- Verify each renders without layout breaks or missing sections

### A.4 Production Hardening (Days 13-16, 4 days)

**A.4.1 — Error monitoring (Day 13)**
- Sentry or equivalent: capture unhandled exceptions, API 500s, payment failures
- Source: `@sentry/nextjs` in `apps/web`
- Alert: any error rate >1% in 1h window

**A.4.2 — Rate limiting + abuse prevention (Day 13)**
- Per-IP: 10 plot queries/hour, 5 report purchases/day
- Razorpay webhook idempotency: 24h dedup window
- Bot detection: simple rate limit + UA filter (no CAPTCHA, friction kills funnel)

**A.4.3 — Database backups (Day 14)**
- Supabase: enable point-in-time recovery (already on paid tier?)
- Daily backup to S3/equivalent: `pg_dump` cron
- Test: restore from backup, verify report generation works

**A.4.4 — Staging environment (Day 14)**
- Vercel: separate `cleardeed-staging` deployment
- Razorpay test mode on staging (already configured per `8b3ca33`)
- Test: end-to-end purchase on staging with real-looking data

**A.4.5 — Performance baseline (Day 15-16)**
- Lighthouse score on report page: target ≥90 performance
- PDF generation time: target <10s p95
- Email delivery: target <2min p95
- Document baseline in `qa/perf_baseline_2026-07-XX.md`

**A.4.6 — Load test (Day 16)**
- Simulate: 100 report purchases in 1 hour
- Verify: no timeouts, no payment race conditions, all emails sent
- Use: k6 or autocannon against staging

### A.5 Pre-Launch Final Polish (Days 17-20, 4 days)

**A.5.1 — Buyer journey dry-run (Day 17)**
- Founder executes: 5 real plot queries → payment → report delivery (B.3.2)
- Engineer observes: any friction, any unclear copy, any failed step
- Fix anything that blocks a real buyer from completing the flow

**A.5.2 — Funnel event verification (Day 18)**
- Verify all 6 funnel events fire:
  1. `landing_view` — page load
  2. `preview_view` — after plot input
  3. `checkout_start` — click "Get Report"
  4. `payment_success` — Razorpay webhook OR client callback
  5. `report_delivered` — email + URL ready
  6. `feedback_received` — thumbs up/down submitted
- Test: webhook + client fallback don't double-count `payment_success`

**A.5.3 — Documentation (Day 19)**
- README: setup, deploy, monitor
- Runbook: what to do when [X] breaks
- Support FAQ: top 10 buyer questions

**A.5.4 — Launch checklist gate (Day 20)**
- [ ] 1506/1506 tests pass
- [ ] Map renders on all devices
- [ ] All 9 sources return data (or clear degradation) on 15 ground-truth plots
- [ ] PDF generation <10s p95
- [ ] Email delivery <2min p95
- [ ] Sentry captures errors
- [ ] Staging + production envs both working
- [ ] Founder has executed full buyer journey (B.3.2)

### A.6 Launch Week (Days 21-30, 10 days)

**A.6.1 — Day-of-launch monitoring (Day 21)**
- Watch Sentry for errors
- Watch payment webhook for failures
- Watch email delivery for bounces
- On-call: founder (B.4.1)

**A.6.2 — Bug triage (Days 22-25)**
- Triage incoming bugs by severity:
  - P0: blocks purchase, blocks report delivery → fix same day
  - P1: degrades UX but doesn't block → fix in 48h
  - P2: cosmetic → backlog
- Per CLAUDE.md: no refactors during this period

**A.6.3 — User feedback analysis (Days 26-28)**
- Pull in-report thumbs data
- Pull NPS from 60-day survey (will be empty until 60 days post-purchase)
- Aggregate qualitative feedback from B.3.3 interviews
- Identify top 3 issues, fix in priority order

**A.6.4 — 30-day assessment (Days 29-30)**
- Report volume: 50-200/mo target hit?
- NPS: >40?
- B2B LOI: signed (B.4.3)?
- Funnel conversion: landing → purchase at what rate?
- Decision: continue, iterate, or pivot

---

## TRACK B — Manual & External

### B.1 Foundation (Days 1-4, 4 days)

**B.1.1 — Decide untracked file disposition (Day 1)**
- Founder choice: commit `PROJECT_STATUS_2026-06-12.md` and `VC_ASSESSMENT_2026-06-13.md` to `docs/` or `.gitignore`?
- Same for: `BLOCKER3_PLAN_2026-06-12.md`, `IGR_EC_STRATEGY_2026-06-12.md`, `EC.pdf`, `ROR_sample.pdf`, `claude33.md`
- 30 min task

**B.1.2 — Vercel env var configuration (Day 2)**
- Vercel Dashboard → cleardeed → Settings → Environment Variables
- Add: `NEXT_PUBLIC_MAPBOX_TOKEN` (value: founder's Mapbox token)
- Add: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`
- Add: `RESEND_API_KEY` (email)
- Add: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- Add: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Redeploy to verify map loads

**B.1.3 — Supabase migration: data deletion (Day 4)**
- Add columns: `deletion_requested_at TIMESTAMPTZ` on `lead_requests`, `checkout_sessions`
- Add: `retention_until TIMESTAMPTZ` (default = created_at + 60 days for reports, +90 days for payment records)
- Founder runs migration manually OR via Supabase dashboard SQL editor

**B.1.4 — Manual flow verification (Days 1-2, ongoing)**
- Founder starts dev server, runs 3 real Khordha plots
- Validates: input, preview, checkout, payment, delivery, email
- Documents any friction, reports to engineer (A.1.4, A.3.x)

### B.2 Vendor + Data Acquisition (Days 5-10, 6 days)

**B.2.1 — Ground-truth plot manifests: 10 new plots (Days 5-6)**
- Founder manually queries Bhulekh, IGR, eCourts, RCCMS, CERSAI, BDA, Bhunaksha for 10 real Khordha plots
- Records in `apps/web/src/lib/pipeline/corpus.ts` format:
  - plot_id, district, tehsil, village, khata_no, plot_no
  - per-source ground truth (owner name, encumbrance status, court case status, etc.)
- 2-3 hrs/plot × 10 plots = 20-30 hrs over 2 days
- **Critical: blocks A.2.1**

**B.2.2 — eCourtsIndia.com pilot signup (Day 5)**
- Signup at ecourtsindia.com/api (no card)
- Receive ₹200 free credit
- Provide 5 real Khordha district-court case queries to engineer (A.2.3)
- Email sales@ecourtsindia.com for Enterprise plan details

**B.2.3 — Signzy/Checkpost outreach (Day 6)**
- Email partnerships@signzy.com with the template from `qa/external_data_research_2026-06-15.md`
- Email contact@checkpost.in (or api.checkpost.in/registration.php)
- Goal: get a quote for sub-entity sponsorship at 200 calls/month
- Don't block on response — run captcha-solver spike in parallel (A.2.2)

**B.2.4 — Razorpay live mode setup (Day 7)**
- Switch from test mode to live mode (currently in test per `8b3ca33`)
- Verify: ₹1 test purchase on staging with live keys
- Update webhook URL in Razorpay dashboard to production
- Founder's bank account linked for payouts

**B.2.5 — Mapbox token confirmation (Day 8)**
- Verify Vercel env var is set (B.1.2)
- Test map render on production
- If still broken: check Mapbox account quota, token validity

**B.2.6 — Resend email template review (Day 9)**
- Review: subject line, sender name, body copy, PDF attachment
- Test: deliverability to Gmail, Outlook, Yahoo
- Check: spam score (mail-tester.com)
- Add: unsubscribe link (DPDP requirement)

**B.2.7 — Privacy policy + terms legal review (Day 10)**
- Lawyer or template review: `apps/web/src/app/privacy/page.tsx`, `apps/web/src/app/terms/page.tsx`
- Verify: DPDP Act 2023 compliance (data collection, retention, deletion, grievance officer)
- Founder designated as DPO

### B.3 User Testing (Days 11-20, 10 days)

**B.3.1 — Copy test with 5 local buyers (Days 11-12)**
- Founder recruits 5 Bhubaneswar friends/colleagues who recently bought land
- Shows them report with current copy, then simplified copy (A.3.1)
- Asks: "Which version would you actually read?"
- Records preferences + suggestions

**B.3.2 — Full buyer journey dry-run (Day 17)**
- Founder executes 5 real plot queries end-to-end
- Validates: each step, each output, each email
- Reports any friction to engineer for same-day fix
- **Critical: gates A.5.4 launch checklist**

**B.3.3 — Pre-launch buyer interviews (Days 18-20)**
- 5 deep interviews (30 min each) with potential buyers
- Key questions:
  - "When you bought land, what did you check before paying?"
  - "Would you pay ₹1 for this report? ₹299?"
  - "What's missing?"
  - "Would you share this with your lawyer?"
- Records in `CUSTOMER_DEVELOPMENT.md` (per CLAUDE.md: 3/week non-negotiable, but this is pre-launch so block-batched)

### B.4 Launch + Post-Launch (Days 21-30, 10 days)

**B.4.1 — Day-of-launch on-call (Day 21)**
- Founder monitors: Sentry, Razorpay dashboard, Resend dashboard, Supabase logs
- Engineer on standby for emergency fixes
- 8am-10pm coverage

**B.4.2 — Marketing: launch announcement (Day 21)**
- Post to 10 Bhubaneswar real estate Facebook groups
- Post to Reddit r/IndiaProperty, r/Bhubaneswar
- LinkedIn post: "We just launched a tool for property buyers in Odisha"
- Personal outreach: 20 brokers, 5 lawyers, 3 HFC underwriters

**B.4.3 — B2B outreach (Days 22-26)**
- 3 Bhubaneswar law firms: in-person meetings, show product
- 2 HFC underwriters: email + LinkedIn
- Goal: 1 LOI signed by Day 30
- Records conversations in `COMMERCIAL_TRACK.md` (per CLAUDE.md: activates post-PI 3, but pre-launch B2B signal is allowed)

**B.4.4 — Buyer support (Days 22-30)**
- Founder responds to buyer questions within 4 hours
- Tracks: "Did you proceed?" outcome (60-day survey will track this, but ask at point of contact)
- Captures qualitative feedback

**B.4.5 — 30-day assessment (Days 29-30)**
- Report volume target: 50-200 reports
- NPS target: >40 (if >10 buyers)
- B2B LOI: signed?
- Decision matrix:
  - 3/5 success metrics hit → continue, plan PI 2 (Cuttack + Puri)
  - 2/5 hit → iterate on top issue, re-assess in 30 days
  - <2/5 hit → pause, consider pivot to B2B-only

---

## Dependency Graph (Critical Path)

```
Day 1:  A.1.1 (test fix) ───────────────────────┐
       A.1.2 (commit igr-ec) ───────────────────┤
       A.1.3 (untracked files) ──────────────────┤
       B.1.1 (founder decision) ─────────────┐   │
       A.1.4 (map fix) ◄── B.1.2 (Vercel env)┤   │
                                              │   │
Day 2-4: A.1.4 (map fix) ───────────────────┤   │
        A.1.5 (DPDP endpoint) ◄── B.1.3 (migration) ┤
        B.1.4 (manual verification) ─────────┘   │
                                                  │
Day 5-6: A.2.1 (corpus 5→15) ◄── B.2.1 (10 manifests) ◄── GATING
        A.2.2 (CERSAI spike) ──┐                  
        A.2.3 (eCourts pilot) ◄┤── B.2.2 (signup) │
                               │                  │
Day 7-8: A.2.4 (RCCMS) ───────┤                  │
        A.2.5 (smoke battery) │                  │
        B.2.4 (Razorpay live) │                  │
                               │                  │
Day 9-10: A.3.x (polish) ─────┤                  │
         B.2.6 (email) ───────┤                  │
         B.2.7 (privacy law) ─┘                  │
                                                │
Day 11-16: A.4.x (hardening) ──────────────────┤
          B.3.1 (copy test) ──────────────────┤
                                                │
Day 17-20: A.5.x (final polish) ◄── B.3.2 (dry-run) ◄── GATING
          B.3.3 (interviews) ──────────────────┤
                                                │
Day 21:    A.6.1 + B.4.1 + B.4.2 (LAUNCH) ─────┘
                                                │
Day 22-30: A.6.2-4 (post-launch) ─────────────┤
          B.4.3-5 (B2B + assessment) ──────────┘
```

**Two gates where Track B blocks Track A:**
1. **Day 5-6:** Founder must provide 10 ground-truth manifests before A.2.1 can populate the corpus
2. **Day 17:** Founder must complete dry-run before A.5.4 launch checklist closes

Everything else can run in parallel.

---

## What This Plan Does NOT Include

Per CLAUDE.md, explicitly out of scope for 30-day launch:
- ❌ Multi-district expansion (Cuttack, Puri, etc.) — PI 2 work
- ❌ Bhulekh Mirror / PID pattern scoring — PI 3 work
- ❌ Guaranteed tier (₹4,999), District Pass, B2B dashboard — rejected for launch
- ❌ WhatsApp delivery, broker listings scraping — parked in BACKLOG
- ❌ Customer development in PIs (except pre-launch validation, B.3.x)
- ❌ Pre-seed fundraising — activates post-PI 3 per CLAUDE.md

---

## Success Metrics (End of Day 30)

| Metric | Target | Minimum |
|---|---|---|
| Test suite | 1506/1506 green | 1500/1506 |
| Ground-truth corpus | 15/50 plots | 10/50 |
| Data sources returning data | 9/9 (or typed-degrade) | 5/9 |
| Map renders | All devices | Desktop + iOS |
| DPDP compliant | Lawyer-reviewed | Self-attested |
| Reports generated (real) | 50-200 | 10 |
| NPS | >40 | >20 |
| B2B LOI | 1 signed | 1 verbal interest |
| Funnel tracking | All 6 events | 4/6 events |
| Founder NPS interview | 5 interviews done | 3 interviews done |

3/5 minimum metrics hit → continue to PI 2. <2/5 → pause, re-assess.

---

*Last revised: 2026-06-16. Two-track plan: A (Product/Engineering) runs mostly independent of founder calendar, B (Manual/External) gates A at Day 5-6 (corpus) and Day 17 (dry-run). 30 days from 2026-06-16 = 2026-07-16 launch.*
