# BACKLOG.md — Parked Items

> **Purpose:** Things deliberately deferred. Not "future features we're definitely building," but "ideas that came up and didn't make the cut for this sprint or PI."
> **Rule:** anything added here gets a one-line justification for why it's parked. If you can't justify why it's parked, decide now — either build it next sprint or kill it.
> **Review cadence:** end of each PI (Sprint 5, 10, 15). Pull items into the next PI's planning, kill items that have aged out, or write a one-line update.

---

## RCCMS Playwright probe — currently disabled (2026-06-12)

**Symptom:** `rccmsFetch` hangs indefinitely (>3 minutes) on Mendhasala/Plot 415, blocking the entire pipeline. The probe uses `chromium.launch` + `page.goto(rccms.odisha.gov.in)` and never resolves.

**Workaround in place:** Pipeline skips the probe and stamps `rccms.status = "failed"` with `statusReason = "rccms_probe_skipped_sprint6_todo"` and `verification = "manual_required"`. The report includes a note that buyers should check revenue court cases manually.

**Next step (Sprint 6):** Either (a) add a hard 30s timeout wrapper around the Playwright probe so it returns partial on slow networks, or (b) replace Playwright with HTTP fetch + a portal probe endpoint, or (c) cache successful probes for 24h so repeat searches don't re-hit the portal. Diagnose on the actual portal response — does it 200, 5xx, or never respond? *Parked because:* a portal reliability fix is a Sprint 6 engineering task, not a launch blocker — buyers can verify RCCMS manually.

---

## Map rendering — Bhunaksha polygon not rendering in report UI (2026-05-26)

**Symptom:** MapboxBoundaryMap component hangs at "Loading..." after payment success, even though `bhunakshaPolygon` is now returning valid GeoJSON (1 ring, 73 points) from the pregenerate API.

**Root cause chain:**
1. Nominatim lacks entries for small Odia villages → tehsil centroid fallback was too far → Bhunaksha BBOX returned 0 plots → polygon was always NULL → **FIXED** (CQL village filter + correct coordinate unwrapping)
2. Polygon now arrives correctly at pregenerate API response → but MapboxBoundaryMap still stuck → likely a client-side rendering issue in the report page or Mapbox component initialization

**Next step:** Instrument MapboxBoundaryMap with console logs to confirm the polygon prop arrives; check if Mapbox token is valid for the deployment domain; verify the component mounts without JS errors. Parked so we don't block the rest of the payment/email flow.

---

## Bhunaksha Plot Report fetcher — what's left (2026-06-14)

**Status:** V2 fetcher shipped and covered by 59 contract tests against a live-verified P051 ground-truth manifest. Captures khatiyan, thana, mouza, tehsil, district, area triple (acres/decimal/hectare), full owner block, and the cadastral map image (base64 SVG) in ~8s. See `DECISIONS.md` D-036.

**Open items, in priority order:**

- **Embed the captured cadastral map image in the rendered PDF report.** The fetcher returns `mapImageBase64` (588 KB SVG for Mendhasala 181/10454) but the consumer-report renderer at `agents/consumer-report-writer/` does not yet embed it. Should appear in Section 1 (The plot) above the satellite-view. *Parked because:* the fetcher is a sibling cross-check, not the primary source — Section 1 already has the polygon + satellite view. Worth ~1 buyer-trust lift.
- **Plot-report map image in the web HTML view.** Same image, served via the existing token-scoped `/report/{id}` page. The web view should show the captured SVG, not just the polygon outline. *Parked because:* same reason — polygon + satellite covers the trust job.
- **Faster screenshot path for the contract-test suite.** The fetcher's smoke test takes ~8s because Playwright launches a fresh chromium per call. The contract test suite is fast because it uses a static HTML fixture, but a per-plot live smoke at CI scale (~50 plots) would take ~7 minutes. *Parked because:* only matters when the regression suite goes fully live in CI (V4 exit). For now, one anchor case (P051) per PR is enough.
- **Cross-source consistency check: Bhunaksha Plot Report vs Bhulekh ROR vs Bhunaksha Polygon.** Three sources of truth for the same plot; the V3 section validator at `qa/section_validators/section-1.test.ts` does not yet assert that the three agree on at least 4 of 5 identifying fields (plotNo, khatiyanNo, mouza, tehsil, district). *Parked because:* requires the P051 manifest to be filled in for the other 49 ground-truth plots (founder manual work, V2 → V3 transition).
- **GIS-code table coverage for all 1,477 Khordha villages.** The lookup table at `packages/fetchers/bhunaksha-plot-report/src/gis-codes.ts` is bootstrapped from a subset (Mendhasala + a few neighbours tested live). For the fetcher to be useful at scale, every village in `KHRDHA_VILLAGES` needs its giscode. *Parked because:* villages outside the table return `invalid_input` (typed degradation), not a crash. The buyer sees a "verify plot report at the Tehsil" note. Acceptable until the fetcher goes from "anchor case" to "default Khordha coverage" in V3.
- **Multi-district GIS-code tables (Cuttack, Puri, Ganjam, Sambalpur).** Same as above, for the other 4 districts. *Parked because:* multi-district is blocked on V4 exit anyway. Will batch this with the Cuttack launch.
- **Bhulekh Plot Report ROR cross-check rule.** The ROR-vs-plot-report disagreement rule ("if Bhulekh area ≠ Bhunaksha area, surface a watch-out") is not yet encoded in `FRAUD_PATTERNS.md`. *Parked because:* a single-source mismatch is not yet a proven fraud pattern. Wait for the V3 cross-source validator to flag ≥3 such cases organically before promoting to the playbook.

---

## Parked from initial strategy review (2026-05-14)

### Visual & data overlays (PI 3+ candidates)

- **Adjacent plot kisam overlay.** Real value for buyers near government land. Deferred to S11. *Parked because:* not load-bearing for S1–S5 buyer behavior; risks slowing satellite/map view ship in S2.
- **Flood overlay (Bhuvan layer).** Already in S4 plan. Stays.
- **Project corridor pins (NHAI / metro / Smart City).** Visually compelling. Deferred to PI 3. *Parked because:* requires reliable source-of-truth scrape per district; not buyer-cited in any conversation yet.
- **CRZ boundary for non-Puri districts.** Only Puri has meaningful CRZ exposure. *Parked because:* no buyer demand outside Puri.
- **IDCO industrial zone proximity.** Specific to a narrow buyer segment. *Parked because:* better in B2B builder-package than consumer report.
- **LARR land acquisition notifications.** High-value insight for buyers in active acquisition zones. *Parked because:* notifications are buried in district-collector PDFs; OCR pipeline is a multi-week build for a low-frequency signal.

### Tiers and pricing experiments (revisit after PI 1)

- **Guaranteed tier (₹4,999 with 18-month claim guarantee).** Deferred to month 18+. See `DECISIONS.md` D-002.
- **District Pass (₹9,999/year for brokers/lawyers).** Deferred until organic reuse demand is visible. See D-003.
- **₹1,499 "Verified Plus" with lawyer co-sign.** Considered as a mid-tier. *Parked because:* adds a second consumer decision; lawyer co-sign is offered separately as an add-on rather than a tier.
- **Refresh pricing (₹299 to re-run a 60-day-expired report).** Already in S5 plan. Stays.

### Delivery & sharing (PI 2 candidates)

- **WhatsApp delivery infrastructure.** Killed. See D-011.
- **SMS report content delivery.** Killed. SMS is link-only.
- **PDF watermarking with buyer name.** Nice-to-have. *Parked because:* solves no buyer problem and adds support burden when shared copies confuse recipients.

### B2B (no work until first contract)

- **Self-serve API + dashboard.** Killed at launch. See D-006.
- **Builder due-diligence package.** Year-2 conversation. *Parked because:* builders aggregate plots and need consistent diligence across many parcels — productizable, but only after consumer + first B2B are stable.
- **HFC title diligence module.** Pursued only after second B2B customer signed.
- **CA channel as a distribution-not-product play.** Implement as referral codes / partner discounts; not a separate product surface.

### Additional data sources (Sprint 11 — Bhulekh Mirror + PID)

These are now split across two independent build tracks:

- **Bhulekh ROR data mirror.** Bulk crawl for Khordha, then 4 more districts. Enables instant preview, "seller's other properties," and change detection. See `BHULEKH_MIRROR_TRACK.md`. Scheduled Sprint 11.
- **Pattern Intelligence Database (PID).** Structured fraud pattern library with NLP extraction and matching engine. Patterns integrate into reports only at VALIDATED/PROBABLE tier. See `PID_CLAUDE_CODE_INSTRUCTIONS.md`. Scheduled Sprint 11.
- **BMC property tax outstanding (T-053).** Scheduled S11 as part of the larger data sources wave.
- **TPCODL connection history (T-054).** Strong occupancy signal. Scheduled S11.
- **IGR seller's other-properties cross-reference (T-057).** Powered by Bhulekh Mirror Stage 4 (tenant enrichment). Parked until Mirror Stage 3 is complete.
- **TPCODL → seller-name match.** *Parked because:* TPCODL search-by-name is patchy. Address-based match (S11) is the simpler version.
- **Newspaper public notice archives (T-055).** *Parked because:* OCR + paper archive pipeline is a 4–6 week effort. Revisit S12.
- **EOW blacklist cross-reference.** *Parked because:* EOW data is not publicly scrapable. Requires formal request process. Revisit S13.

### Feedback & community (PI 3+ candidates)

- **Verified-by-lawyer review system.** Buyer who has a lawyer review the report can mark it "lawyer-reviewed" with the lawyer's name. *Parked because:* requires a lawyer onboarding flow; possibly merged with the Guaranteed tier later.
- **Forum / Q&A community.** Not at our scale. *Parked indefinitely.*
- **Buyer-to-buyer referral rewards.** *Parked because:* good idea but requires identity verification that DPDP makes complex. Revisit at 500 reports.

### Operational (revisit as volume grows)

- **First contractor for report review queue.** Trigger: founder reviewing >2 hours/day. Sprint 9 likely.
- **Multi-language support (Odia / Hindi).** *Parked because:* UI is English-first; report copy already uses plain language. Revisit at 1,000 reports if non-English share is meaningful.
- **Founder-call booking system.** *Parked because:* manual Calendly is fine for the volume.
- **Refund automation.** *Parked because:* refunds at this volume are 1-off founder decisions; build automation when refund rate ≥1% of reports.

---

## How to add to this file

When something comes up mid-sprint:

1. Ask: *does this contribute to the current sprint's user behavior?*
2. If no, add it here in the relevant section with **one line of "why parked."**
3. Do not start work on it.
4. If you have started work on it, stop. Move it here. Continue with the sprint.

This file is the relief valve. Use it ruthlessly. The point is to keep `CURRENT_FOCUS.md` short.

---

*Reviewed: 2026-05-14. Next review: end of Sprint 5.*

---

## IGR EC V2 automated login — operational maturity (2026-06-14, D-037)

**Status:** V2 fetcher code is shipped and unit-tested but not loaded by V1 dispatch. The launch path is V1's manual-instructions surface. The V2 code at `packages/fetchers/igr-ec/src/index.v2.ts` is preserved for unit tests and the smoke script `scripts/smoke/igr-ec-otp-smoke.mjs`.

**Why parked:**
- IGR login is OTP-gated per session, captcha top-1 is ~50-60%, top-8 ~80% with the smart solver — single-attempt success is too low for a buyer-facing path
- Playwright session must stay alive from captcha solve through OTP submit; can't survive across CI/dev tools
- A failed automated EC fetch returning `status: "partial"` is operationally worse than the V1 "go to the SRO and ask for these documents" surface, which is what a buyer would do anyway

**Re-enable trigger (V2 → launch path):** 50+ buyer reports, captcha top-1 ≥85% (target hit), and an OTP input channel that doesn't require a live Playwright session (e.g. a tiny web UI where the founder pastes the OTP once per day; or a 2Captcha-type relay that returns an IGR-issued cookie without OTP).

**Next step:** Park the V2 dispatcher, keep the captcha solver + smoke script. Revisit at the 50-report review.
