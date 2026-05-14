# DECISIONS.md — ClearDeed Decisions Log

> **Format:** one paragraph per decision. Dated. With the reasoning. So decisions don't get re-litigated three sprints later.
> **Rule:** add a new decision when you make one. Do not edit old ones — supersede them with a new dated entry.
> **Not in scope:** sprint task choices. This is for decisions that shape the product or strategy at the 3–6 month horizon.

---

## 2026-05-14 — Strategy reset, approved direction

After reviewing the full strategy memo against the prior plan, approved the following changes from earlier direction. Each is a deliberate departure and should not be reversed without changing `STRATEGY.md` first.

### D-001: Two consumer tiers only. Free preview + Standard ₹1.
The five-tier ladder (Free / Standard / Verified / Guaranteed / Enterprise) optimized for recurring spend that does not exist in this category — a buyer transacts once. Every additional tier reduces checkout conversion. Standard at ₹1 for launch testing; changes to ₹999 when conversion is proven. All features in one SKU.

### D-002: No Guaranteed tier at launch.
The ₹4,999 tier with 18-month claim-correctness guarantee is uncapped liability for a pre-revenue startup with no actuarial data and no PI insurance. One bad outcome on an ₹80 lakh property wipes out years of revenue. Revisit only when: 500+ reports of accuracy data exist, PI insurance is in place, an empanelled legal network exists across districts, and a claim rate is actuarially understood. Earliest revisit: month 18.

### D-003: No District Pass annual subscription at launch.
Brokers and lawyers are unreliable subscription buyers — they will share credentials, run reports for the whole office on one seat, and pressure for bulk discounts. There is no evidence yet of organic reuse pull from these segments. Add the tier only when pull is visible. Earliest revisit: PI 3.

### D-004: ₹1 launch price, changes to ₹999 after conversion proof.
₹1 removes payment friction for launch testing. Once conversion is proven (50+ paid reports, week-over-week growth), price moves to ₹999. ₹699 reads cheap-and-suspect; ₹999 reads serious-but-affordable.

### D-005: Khordha to revenue first, then 5 districts in one sprint.
Multi-district at launch is the correct end state. Multi-district before any district works well is the trap that produced 57 sessions of revenue-free progress. Khordha proves unit economics on 50–100 paid reports (PI 1). All 5 districts launch together as a focused PI 2 sprint with the playbook validated. Do not interleave.

### D-006: No self-serve B2B product at launch.
B2B in proptech is sold, not productized. The first HFC contract will be a 30-page custom agreement with bespoke deliverables, not a self-serve signup. Building B2B infrastructure before B2B customer #1 is a documented solo-founder waste pattern. First B2B target is a Bhubaneswar law firm (faster procurement than HFC), signed by Sprint 8–9. API and dashboard productize after customer #2 wants the same shape.

### D-007: No composite "development potential score."
Composite scores carry legal exposure ClearDeed cannot defend. Government plans change, projects delay, infrastructure overpromises. The report surfaces *structured facts* — *"Plot is 800m from project X announced 2024-03"* — with sources and lets the buyer draw the conclusion. This is more honest and less liable.

### D-008: Market data framed as floor / directional / ceiling.
Three signals presented together: circle rate (government floor), recent IGR sales (directional, with explicit framing that registered values are 50–80% of market), broker listings (aspirational ceiling). No single "fair value" estimate ClearDeed owns. Honest framing > clever scoring.

### D-009: Feedback infrastructure ships in Sprint 1.
The outcome dataset is the only durable moat — every feature can be replicated by a well-funded competitor in 6–9 months. Therefore: in-report panel feedback (thumbs up/down per section) ships Sprint 1; founder review queue ships Sprint 1; 60-day post-purchase survey (2 questions only) ships Sprint 2. This is launch infrastructure, not future work.

### D-010: One post-purchase survey at 60 days, two questions.
The multi-step 30/90/180/365-day survey is over-engineered. Response rates collapse on multi-step surveys. One email, two questions: *"Did you proceed?"* and *"Anything important we missed?"* That's it. Replaces prior plan in the earlier Ceiling Plan §5.

### D-011: No WhatsApp delivery infrastructure.
WhatsApp is a sharing channel, not a delivery channel. The report URL gets shared; the report content does not arrive over WhatsApp. WhatsApp Business API integration is significant infrastructure work that adds nothing the buyer cannot already do by tapping "share" on the URL. Email + persistent URL is the delivery surface.

### D-012: No founder review queue. Fully automated pipeline.
Every report auto-delivers on generation. No eyeball gate, no concierge. This is a deliberate choice to maximize throughput and eliminate founder bottleneck. Error monitoring and buyer feedback are the quality controls.

### D-013: Automate every data source. No concierge as permanent fallback.
If a free or paid API, scraping pathway, or workaround exists for a data source, we build it before shipping. No manual fulfillment as a permanent fallback. If the source is truly unavailable, it ships with an explicit "manual verification required" label — not a concierge delay.

### D-014: DPDP Act compliance is launch-blocking.
Privacy policy, data deletion, retention period, designated DPO (founder, formally). Ships Sprint 1.

### D-015: CURRENT_FOCUS.md replaces the 4,000-line CLAUDE.md as the daily guide.
The earlier CLAUDE.md became an archive of session logs rather than a guide. The new CLAUDE.md is short and stable (the engineering constitution). CURRENT_FOCUS.md is the one-page daily file — current sprint goal, remaining tasks, blockers. Completed items get deleted, not strikethroughed. The point is to keep focus surface area small.

### D-016: Friday retrospective is one question: did the product ship?
Not "what did we ship," not "how did we feel," not "what's blocked." Did the product infrastructure complete this week? If yes, continue Monday with the next sprint task. If no, Monday is product work. This is the discipline that prevents scope creep during PI 1.

### D-017: Customer development and social proof are post-implementation.
Moved to `COMMERCIAL_TRACK.md`. Implementation PIs are engineering-only. Customer development, social proof, B2B pipeline, and investor outreach are activated only after PI 3 is complete.

### D-018: Homepage social proof from post-implementation, not PI 1.
Moved to `COMMERCIAL_TRACK.md` §2.2. Live report counter, three real testimonials, anonymized report excerpt — all collected from real buyers, not fabricated. Homepage uses honest placeholder language until real social proof exists.

### D-019: One empanelled advocate at launch, not a network.
Building a 10-advocate network across 5 districts pre-launch is over-investment. One advocate in Bhubaneswar willing to co-sign for ₹500/signature is launch-able state. Scale the network only when paid demand pulls (which it may not, given the no-Guaranteed-tier decision).

### D-020: No new abstractions on first pass; no refactors during launch sprints.
Write the obvious code that solves today's problem. Extract abstractions when the second or third use case appears, not before. Do not migrate stacks during launch sprints. The existing data fetchers and infrastructure stay; the consumer-facing product wraps around them. Suggest refactors in PR descriptions; do not perform them.

---

*To add a decision: add a new entry below dated and numbered. Do not edit older entries. To reverse a decision, add a new entry that supersedes the prior one and update the prior entry with `**Superseded by D-NNN on YYYY-MM-DD.**` at the end.*

*Last revised: 2026-05-15. Commercial activities isolated to `COMMERCIAL_TRACK.md`. Implementation PIs 1–3 are product/engineering only.*
