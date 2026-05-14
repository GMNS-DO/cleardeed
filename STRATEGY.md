# STRATEGY.md — ClearDeed Approved Strategy

> **Status:** Approved 2026-05-14. Updated 2026-05-15 with price=₹1 and no-review-queue decisions.
> This is the strategy ClearDeed is executing against. Any deviation requires explicit change to this file, dated and reasoned.
> **Companion files:** `CLAUDE.md` (engineering constitution), `PRODUCT_SPEC.md` (product details), `ROADMAP.md` (sprint plan), `DECISIONS.md` (decisions log).

---

## 1. Positioning

ClearDeed is the **pre-purchase property intelligence tool for Tier-2 India**, starting with Odisha.

It produces a structured, plain-English report that answers the three core questions any land buyer has — *does the seller own it, can I lose it after I pay, can I build what I want here* — supplemented by market context (what's it worth, what's happening around it).

The product reduces the time and cost of pre-decision diligence from weeks and ₹15,000+ (lawyer route) to minutes and ₹999 (ClearDeed route).

**It does not replace a lawyer.** It makes the lawyer's later work cheaper and more targeted.

The buyer is in a transactional moment, not a discovery moment. They found a plot, the broker is pushing, they have a deadline, and they Googled at 10pm. Every product decision is evaluated against that buyer at that moment.

## 2. What ClearDeed is NOT

These framings are wrong and must be actively resisted because they invite over-promising and unbounded liability:

- **Not a fraud prevention tool.** Reduces information asymmetry; does not eliminate fraud.
- **Not a lawyer replacement.** Pricing tiers, copy, and report tone must never imply this. Every adverse outcome becomes ClearDeed's fault if positioning drifts.
- **Not a venture-scale business in consumer form alone.** Consumer maxes around ₹10–14 crore ARR for full Odisha. B2B is the path to a fundable narrative.

## 3. The single largest risk

**Product completeness.** A buyer who finds the report surface-level, incomplete, or easy to dismiss as "not useful enough for ₹999" won't come back. Every sprint must ship a product that a buyer who has paid describes as worth the money — in the report sections they actually look at.

## 4. Geography sequencing

- **Now:** Khordha district. Production-quality first paid revenue.
- **PI 1 (weeks 1–10):** Khordha product complete and integrated — all data sources, all report sections, delivery pipeline, feedback infrastructure.
- **PI 2 (weeks 11–20):** All 5 major districts live (Khordha, Cuttack, Puri, Ganjam, Sambalpur). B2B pipeline ready.
- **PI 3+ (months 7+):** Deepen Odisha to all 30 districts OR begin adjacent-state expansion, depending on PI 3 outcome.

Multi-district *before* Khordha works well is the trap. Multi-district *at launch* is the correct end state.

## 5. Pricing architecture

**At launch, two consumer tiers only:**

| Tier | Price | Contents |
|---|---|---|
| **Free preview** | ₹0 | Plot found, owner first name + last initial, Kisam, map pin |
| **Standard** | ₹1 | Full report: ROR, IGR/EC, eCourts, RCCMS, CERSAI, map + satellite + boundary, market context, financial exposure summary |

**B2B is custom contracts only.** First target: a mid-size Bhubaneswar law firm doing 20–50 title checks/month, signed by Sprint 8–9. API and dashboard productization emerge from that customer's actual requirements, not anticipated ones.

**Deliberately not at launch:**
- **No Guaranteed tier** (₹4,999 with claim guarantee). Liability for a pre-revenue startup with no actuarial data is unacceptable.
- **No District Pass** annual subscription. Wait for organic broker/lawyer reuse demand.
- **No four-tier consumer ladder.** One paid decision, one paid checkout.
- **Price is ₹1 for launch.** Testing price to remove friction. Changes to ₹999 when conversion is proven.

## 6. Report architecture

Six sections, ordered for buyer cognition not data taxonomy:

1. **The plot** — map + satellite as visual lead, ROR data below.
2. **The owner** — name match if seller name provided, all listed tenants, share fractions, seller's other properties.
3. **What you might lose after paying** — encumbrances, court cases, attachments, CERSAI. Single "total potential exposure" headline.
4. **What you can build here** — Kisam, zoning, flood zone, CRZ, restrictions.
5. **What it's worth** — circle rate (floor), recent IGR sales (directional), broker listings (ceiling). All framed honestly, no composite scores.
6. **What to do before you pay** — gap-driven checklist, lawyer reminder, optional book-a-call CTA.

**Three depths, one report:**
- Top: one-screen summary
- Middle: 5–7 screen buyer's read
- Bottom: full data drill-down (for the lawyer the buyer shares it with)

Every fact links to its source. Positive signals first within each section, watch-outs second. Honest framing on market data: floor / directional / ceiling.

## 7. The moat

Three layers of defensibility, ordered by durability:

1. **The outcome dataset (durable).** Which buyers proceeded with which risk profiles, which flags mattered, which "verified clear" claims later proved wrong. Built only by operating at scale over years. Must be instrumented from day one.
2. **District-specific knowledge (medium-term).** Fraud patterns, local development authority quirks, lawyer network. Decays as competitors invest in regional teams.
3. **Brand and buyer trust (long-term).** The trusted brand for Tier-2 India property diligence. Five years out, this is the real moat.

Every other feature can be replicated in 6–9 months by a well-funded competitor (Landeed, AdvaRisk, LegiScore, NoBroker-adjacent). Build accordingly: do not over-invest in technical sophistication; do invest in feedback loops.

## 8. B2B sequence (post-implementation)

B2B is **sold, not productized.** Build for the first signed customer, not the imagined customer. B2B activities are in `COMMERCIAL_TRACK.md`. Implementation sprint 8 builds the infrastructure for whatever customer #1's contract requires.

---

## 9. Trust infrastructure

Trust is earned through product completeness and clarity:

- **Free preview** that works on the buyer's actual plot. Single highest-leverage trust mechanism.
- **Visual professionalism of the report.** Buyer confidence in the first 30 seconds is set by plausibility, not accuracy.
- **DPDP Act compliance.** Privacy policy, data deletion, retention period, designated DPO. Launch-blocking.
- **Disclaimer block** on every report, district-specific where relevant.

## 10. The feedback loop is the moat — build it first

- **In-report panel feedback** (thumbs up/down per section, optional text) — Sprint 1.
- **One post-purchase survey at 60 days,** two questions only: *"Did you proceed? Y/N/Still deciding"* and *"Anything important we missed?"* — Sprint 5.

No founder review queue. Reports auto-deliver on generation. Fully automated pipeline.

## 11. Capital and resourcing

Bootstrap through PI 3. Product is buildable solo with Claude Code at the pace `ROADMAP.md` describes. Revenue funds incremental hiring. Pre-seed and investor conversations are in `COMMERCIAL_TRACK.md` — they begin only after PI 3 is complete.

## 12. Discipline

These two disciplines are the strategy. Everything else is downstream.

**Discipline 1 — Define done by user behavior, not code completion.**
Sprint goals are sentences about buyers, not feature lists. Anything that doesn't contribute to that behavior is parked. Refactoring, ADRs, and "while we're here" improvements are all parked until the behavior ships.

**Discipline 2 — Ship product completeness before selling.**
The instinct to start customer conversations before the product is complete is a trap. Build the complete product first. All buyer validation, social proof, and sales motions happen in PI 2, after the product has no execution gaps as an excuse for failure.

---

*Last revised: 2026-05-15. Commercial activities moved to `COMMERCIAL_TRACK.md`. Implementation PIs 1–3 are product/engineering only. Next mandatory review: end of PI 3.*