# ClearDeed — Repository Docs

> Pre-purchase property intelligence for Tier-2 India. Starting in Odisha.
> Solo founder + Claude Code. Bootstrapped. Implementation PIs 1–3 are engineering-only.
> **Commercial activities (customer dev, sales, B2B, fundraising) are in `COMMERCIAL_TRACK.md` and activate only after PI 3.**

---

## How to read these files

These are the only canonical markdown files in the repo. Each has a single job. Cross-references between them are deliberate. If a piece of information feels like it doesn't belong anywhere, it probably doesn't belong in any markdown file — it belongs in code.

| File | Job | Updated |
|---|---|---|
| **`CLAUDE.md`** | Engineering constitution. Rules for working in this repo. Stable. | Only when strategy changes |
| **`CURRENT_FOCUS.md`** | One page. This week's execution tasks, remaining work, blockers. | Daily |
| **`STRATEGY.md`** | The approved strategy. Why we're building what we're building. | At PI boundaries only |
| **`PRODUCT_SPEC.md`** | Tiers, report sections, data sources, delivery. The product, in detail. | At sprint boundaries |
| **`ROADMAP.md`** | 3 PIs, 15 sprints. Execution milestones at each sprint exit. Engineering-only. | At sprint boundaries |
| **`DECISIONS.md`** | One paragraph per decision. Dated. So decisions don't get re-litigated. | Whenever a decision is made |
| **`FRAUD_PATTERNS.md`** | The 5 documented Odisha fraud patterns + detection rules. | When new patterns are documented |
| **`COMMERCIAL_TRACK.md`** | Customer dev, social proof, B2B pipeline, investor outreach. Activates after PI 3. | After PI 3 closes |

---

## The two disciplines (from `CLAUDE.md`, repeated because they matter most)

1. **Define done by user behavior, not code completion.** Every sprint goal is a sentence about a buyer doing something with the product.
2. **Implementation first, commercial later.** PIs 1–3 are engineering-only. All commercial activities are in `COMMERCIAL_TRACK.md` and begin only after PI 3 is complete.

These are not the most important rules. They are the only rules that matter. Everything else is downstream.

---

## What's deliberately not here

- **Session logs.** History does not need a home. If it mattered, it's in `DECISIONS.md`.
- **Architecture documents, ADRs, design docs.** Decisions go in `DECISIONS.md` as paragraphs. That is enough.
- **Long narrative roadmaps describing every feature in 6 months.** `ROADMAP.md` describes 3 PIs in concrete sprint exits. Beyond that is speculation.
- **"Future vision" documents.** Vision is in `STRATEGY.md` §10 in one paragraph. That is enough.
- **Status reports.** `CURRENT_FOCUS.md` is the status. There is no second status surface.
- **Commercial activities in sprint planning.** Customer dev, sales, social proof, B2B, fundraising — all in `COMMERCIAL_TRACK.md`. Not in `ROADMAP.md`, not in `CURRENT_FOCUS.md`.

---

*Last revised: 2026-05-15. Commercial activities moved to `COMMERCIAL_TRACK.md`. Implementation PIs 1–3 are engineering-only.*