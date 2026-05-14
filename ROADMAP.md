# ROADMAP.md — ClearDeed Sprint & PI Plan

> **Reading rule:** every sprint ends with something a real buyer can use and pay for. No "infrastructure sprint." No "we're internally testing." If the sprint exit criterion is not a buyer behavior, the sprint plan is wrong.
> **Sprint length:** 2 weeks. **PI length:** 5 sprints (10 weeks).
> **Companion files:** `CLAUDE.md` (engineering constitution), `COMMERCIAL_TRACK.md` (commercial activities — activates after PI 3).

---

## IMPLEMENTATION PIs — What gets built

The entire implementation is 3 PIs and 15 sprints. Every sprint ships code that a real buyer can use. No "we're getting ready to launch" sprints.

---

# PI 1 — Khordha Product and Integrations (Sprints 1–5, Weeks 1–10)

**PI exit criterion:** *Feature-complete product for Khordha. All planned data sources integrated. Report sections polished. Delivery pipeline end-to-end. Feedback infrastructure instrumented.*

---

## Sprint 1 (Weeks 1–2) — First Paid Report Infrastructure

**Sprint goal:**
> Complete the payment and delivery infrastructure so a report flows from form → payment → email delivery fully automatically. No Bhulekh fetcher work this sprint — the fetcher exists.

**Exit criteria:**
- Razorpay in test mode at ₹1 (credentials wired, checkout working)
- Email delivery working with PDF attachment to buyer email (Resend configured with RESEND_API_KEY)
- Reports auto-send on generation — no review gate
- Token-scoped persistent report URL working
- Server-rendered PDF from the same HTML as web report
- Privacy Policy and Terms of Service pages live on the site
- In-report thumbs up/down feedback captured per section

**Out of scope:** Bhulekh fetcher changes. Multi-district. Any commercial activity.

---

## Sprint 2 (Weeks 3–4) — The Plot, Visualized

**Sprint goal:**
> Add map and satellite view to the report. GPS coordinates (from Bhunaksha) pin the plot on a base map and satellite image with boundary overlay.

**Exit criteria:**
- Google Maps or Mapbox base layer integrated, plot pinned and boundary drawn
- Satellite view with boundary overlay
- Street view embed where Google has coverage; gracefully absent where it doesn't
- Sprint 1 features still work (regression check)
- Free preview endpoint: Bhulekh ROR front page lookup, masked owner name, Kisam, map pin — no payment required

**Out of scope:** Flood overlay. Project corridor pins. Any commercial activity.

---

## Sprint 3 (Weeks 5–6) — What You Might Lose After Paying

**Sprint goal:**
> Add the financial-exposure section: IGR EC, eCourts case search, RCCMS revenue court, and CERSAI mortgage check. Single "total potential exposure" headline per report. All automated — no concierge.

**Exit criteria:**
- IGR EC integration (fully automated scraping)
- eCourts scraper hits and case-search by name returns results in-report
- RCCMS scraper integrated
- CERSAI mortgage check integrated (per-query cost, triggered after payment)
- "Financial exposure summary" panel built with quantified ₹ exposure per risk type
- Encumbrance Certificate instructions panel for each tehsil

**Out of scope:** Any commercial activity.

---

## Sprint 4 (Weeks 7–8) — What It's Worth + What You Can Build

**Sprint goal:**
> Add market context (circle rate floor, IGR village sales as directional, broker listings as ceiling) and "What you can build here" (kisam → permitted use, BDA zoning lookup, Bhuvan flood flag).

**Exit criteria:**
- Circle rate lookup table for Khordha villages
- IGR village-level sale records (last 24 months)
- MagicBricks/99acres listing scraper for the locality
- BDA zoning lookup for the 50 most-queried village/locality combinations (hardcoded is fine)
- Bhuvan flood layer integration
- Every market data point has a "view source" link and floor/directional/ceiling framing
- Sub-plot detection (D/88 pattern) fires HIGH WATCH-OUT

**Out of scope:** Composite scores. Any commercial activity.

---

## Sprint 5 (Weeks 9–10) — Conversion & Polish

**Sprint goal:**
> Polish the complete product. Three-layer report (summary / buyer read / lawyer drill-down). Print-optimized CSS. 60-day report validity with pay-to-refresh option. Feedback infrastructure instrumented.

**Exit criteria:**
- Three-layer report shipped: top summary one-screen, middle buyer-read, bottom drill-down
- Print-optimized CSS for buyers taking the report to a lawyer
- 60-day report validity + pay-to-refresh option (~₹299)
- Conversion funnel instrumented (landing → preview → pay → delivered → feedback)
- Every report section has a "Verify yourself" link to the source page
- All 6 report sections complete and tested

---

# PI 2 — Multi-District (Sprints 6–10, Weeks 11–20)

**PI exit criterion:** *All 5 major Odisha districts live at production quality. Product has no execution gaps as a reason for buyer conversations to fail.*

---

## Sprint 6 (Weeks 11–12) — Cuttack & Puri

**Sprint goal:**
> Buyer in Cuttack or Puri runs the full Khordha-equivalent flow. District-specific quirks (Puri CRZ, Cuttack flood) appear in the report.

**Exit criteria:**
- Cuttack: tehsil/village/RI lookup tables, district-specific zoning module (CDA), Cuttack-flood disclaimer
- Puri: same plus CRZ boundary overlay and Puri-specific PDA zoning
- Sprint 1–5 functionality fully regression-tested for both new districts
- Fraud pattern research: 2 documented patterns per new district added to `FRAUD_PATTERNS.md`

**Out of scope:** Any commercial activity.

---

## Sprint 7 (Weeks 13–14) — Ganjam & Sambalpur

**Sprint goal:**
> All 5 major Odisha districts live with the full ClearDeed flow.

**Exit criteria:**
- Ganjam + Sambalpur lookup tables, zoning modules, district disclaimers
- All 5 districts live with regression suite green

---

## Sprint 8 (Weeks 15–16) — B2B Delivery Infrastructure

**Sprint goal:**
> Build B2B delivery infrastructure for the first signed customer. Batch input, white-label option, secure delivery, volume pricing.

**Exit criteria:**
- Batch input (CSV of plot IDs, or upload of broker/lawyer briefs)
- White-label option (firm name on report)
- Secure delivery (signed URLs, expiring access)
- Volume pricing structure (₹399–₹499/report at 20+ reports/month)
- Sample batch report demonstrating cross-plot consistency

**Note:** This is product infrastructure, not a sales sprint. Build for the first signed customer's actual requirements.

**Out of scope:** B2B sales conversations. Any commercial activity.

---

## Sprint 9 (Weeks 17–18) — Deliver B2B Pilot

**Sprint goal:**
> Whatever the first signed B2B customer requires, built and shipped.

**Exit criteria:**
- First B2B customer contract deliverables delivered
- Consumer flow continues — no regression

---

## Sprint 10 (Weeks 19–20) — PI 2 Close

**Sprint goal:**
> Clean up, document, and hand off. PI 3 plan finalized based on PI 1 + PI 2 learnings.

**Exit criteria:**
- DPDP compliance audit (self-audit using a checklist) clean
- All 5 districts at production quality
- PI 3 plan revised based on implementation learnings

---

# PI 3 — Adjacent Data & Scale (Sprints 11–15, Weeks 21–30)

**PI exit criterion:** *Product is as complete as it can be with current data sources. All 5 districts at scale. Ready for commercial track.*

---

## Sprint 11 (Weeks 21–22) — Adjacent Data Sources, Wave 2

**Sprint goal:**
> Second-wave data sources that compound the moat: BMC property tax, TPCODL connection history, adjacent plot kisam overlay, EOW blacklist cross-reference.

**Exit criteria:**
- 4 of 5 above shipped
- Insights from these sources tested in 20+ real reports

---

## Sprint 12 (Weeks 23–24) — Polish & Edge Cases

**Sprint goal:**
> Polish edge cases, error handling, and feedback-loop quality from real buyer data.

**Exit criteria:**
- Top 10 buyer-reported missing data points addressed
- Error states for all data sources improved
- NPS survey results from Sprint 1–11 cohort reviewed

---

## Sprint 13 (Weeks 25–26) — Infrastructure Hardening

**Sprint goal:**
> Performance, reliability, and cost optimization before any commercial scale push.

**Exit criteria:**
- Pipeline latency p95 < 30s for Bhulekh-only reports
- Error rate < 1% across all sources
- Cost per report documented

---

## Sprint 14 (Weeks 27–28) — Deep Dive & Completeness Check

**Sprint goal:**
> Systematic review of every report section against the fraud pattern playbook. Fill remaining gaps.

**Exit criteria:**
- All 5 documented fraud patterns have working detection rules
- Every "manual verification required" label has a clear upgrade path
- Report quality score (internal) at target

---

## Sprint 15 (Weeks 29–30) — PI 3 Close

**Sprint goal:**
> Implementation is complete. Product is as good as current data sources allow. Commercial track can begin.

**PI 3 retrospective:** *Is the product complete enough to hand off to a commercial team, or does implementation continue?*

---

## After PI 3: Implementation Complete

Product implementation is done. All remaining work is commercial — see `COMMERCIAL_TRACK.md`.

---

*Implementation PIs are engineering-only. Sprint reviews happen Friday afternoons. Sprint planning happens Monday mornings. Mid-sprint scope changes go in DECISIONS.md or they don't happen.*