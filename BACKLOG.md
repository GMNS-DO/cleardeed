# BACKLOG.md — Parked Items

> **Purpose:** Things deliberately deferred. Not "future features we're definitely building," but "ideas that came up and didn't make the cut for this sprint or PI."
> **Rule:** anything added here gets a one-line justification for why it's parked. If you can't justify why it's parked, decide now — either build it next sprint or kill it.
> **Review cadence:** end of each PI (Sprint 5, 10, 15). Pull items into the next PI's planning, kill items that have aged out, or write a one-line update.

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

### Additional data sources (cherry-pick into PI 3+)

- **BMC property tax outstanding (T-053).** Real value. Scheduled S11.
- **TPCODL connection history (T-054).** Strong occupancy signal. Scheduled S11.
- **Newspaper public notice archives (T-055).** *Parked because:* OCR + paper archive pipeline is a 4–6 week effort. Revisit S12.
- **IGR seller's other-properties cross-reference (T-057).** Strong signal for land-aggregator detection. Scheduled S11.
- **TPCODL → seller-name match.** *Parked because:* TPCODL search-by-name is patchy. Address-based match (S11) is the simpler version.

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
