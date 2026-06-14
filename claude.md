# CLAUDE.md — ClearDeed Engineering Constitution

> **This file is the engineering constitution. It is short on purpose.**
> Strategy lives in `STRATEGY.md`. Current sprint state lives in `CURRENT_FOCUS.md`. Product spec lives in `PRODUCT_SPEC.md`. Decisions log lives in `DECISIONS.md`. Sprint plan lives in `ROADMAP.md`.
> If you find yourself wanting to put session logs, completed work, or long narrative history here, you are using this file wrong. Use `DECISIONS.md` for things that survive, `CURRENT_FOCUS.md` for what's active, and delete the rest.

---

## 1. What ClearDeed is (one paragraph, do not reframe)

ClearDeed is the pre-purchase property intelligence tool for Tier-2 India, starting with Odisha. A buyer about to spend ₹40 lakh to ₹2 crore on a plot gets a structured, plain-English report in minutes for ₹1 that answers three questions: *Does the seller actually own it? Can I lose it after I pay? Can I build what I want here?* — supplemented by market context. The product does **not** replace a lawyer; it makes the lawyer's later work cheaper and more targeted.

The buyer is in a transactional moment, not a discovery moment. They found a plot, the broker is pushing, they have a deadline, and they Googled "how to verify land ownership Odisha" at 10pm on a Tuesday. Every product decision is evaluated against that buyer at that moment.

## 2. The one discipline that governs everything

**Define done by user behavior, not code completion.**
Every sprint goal is a behavior — *"a buyer can pay ₹1, view the report in the browser, download it, and receive an email copy within 10 minutes"* — not a feature list. Anything that doesn't contribute to that behavior is rejected this sprint. Including refactoring. Including ADRs. Including "while we're in this file" improvements. Park them in `BACKLOG.md` and come back when the behavior ships.

**Customer development and social proof are post-implementation.** All commercial activities are in `COMMERCIAL_TRACK.md` and activate only after PI 3. Product completeness comes first; validation after.

## 3. Rules for working with Claude Code on this project

These are the rules the model (Claude Code) must follow when working in this repo. They exist because the failure mode of Claude Code is confident execution on the wrong problem.

1. **Before any non-trivial work, read `CURRENT_FOCUS.md`.** If the proposed work is not in service of the user behavior currently listed there, stop and ask. Do not assume the founder wants the adjacent improvement.
2. **Use Claude Code for breadth, not depth.** Scrapers, integrations, payment flows, email plumbing, PDF generation — these are well-scoped tasks where Claude Code excels. Insight engines, scoring algorithms, copy decisions, pricing — these need founder judgment. Do not write generalized "smart" systems where a hardcoded heuristic is sufficient.
3. **No refactoring unless explicitly requested.** If the existing code works, leave it. Suggest refactors in a PR description; do not perform them.
4. **No new abstractions on first pass.** Write the obvious code that solves today's problem. Extract abstractions only when the second or third use case appears.
5. **Every PR ships behind a user-visible behavior.** If a PR does not change what a buyer can do or see, it is infrastructure work, and it must be justified as unblocking a specific user behavior in the next 7 days.
6. **No ADRs, no architecture documents, no "future-proofing" sections.** Decisions go in `DECISIONS.md` as one-paragraph entries. That is enough.
7. **Automate everything. No concierge model.** If a free or paid API, scraping pathway, or workaround exists for a data source, we build it before shipping. No manual fulfillment as a permanent fallback.
8. **Price is ₹1 for launch, not ₹999.** This is a launch testing price. Change it when conversion is proven.

## 4. The product, in one screen

| Layer | What | When |
|---|---|---|
| **Standard ₹1** | Full report: ROR, IGR/EC, eCourts, RCCMS, CERSAI, map + satellite + boundary, market context, financial exposure summary; shown in browser, downloadable, and emailed | Sprint 1–3 |
| **B2B custom** | Per-contract deliverables for first law-firm customer | Sprint 8+ |

**No Guaranteed tier. No District Pass. No four-tier ladder.** Those decisions are recorded in `DECISIONS.md` so they don't get re-litigated.

The report has six sections in this order: *The plot. The owner. What you might lose after paying. What you can build here. What it's worth. What to do before you pay.* Every fact links to its source. Positive signals first within each section, watch-outs second. Three depths in one report: summary at top, buyer's 5–7 screen read in middle, full data drill-down at bottom.

## 5. Geography sequencing

Khordha to product completion first. Then all 5 districts (Khordha, Cuttack, Puri, Ganjam, Sambalpur) in a single coordinated launch at PI 2. Do not interleave. The instinct to "do statewide because Bhulekh is statewide" is wrong as a launch strategy and correct as an end state.

## 6. The moat is the outcome dataset

Every feature in this product can be replicated by a well-funded competitor in 6–9 months. The one thing they cannot replicate is the dataset of *which buyers proceeded with which risk profiles, which flags turned out to matter, which 'verified clear' claims later proved wrong.* That dataset only exists if the feedback loop is built from day one. Therefore:

- In-report panel feedback (thumbs up/down per section, optional text) — **Sprint 1.**
- One post-purchase survey at 60 days, two questions: *Did you proceed? Anything important we missed?* — **Sprint 5.**

The feedback infrastructure ships before the polish. This is the part most likely to be underbuilt because it produces no visible buyer value in the short term. Build it anyway.

## 7. Trust and delivery

- **No free preview gate.** The launch funnel is one paid decision: enter plot details, click `Get report`, pay ₹1, view the generated HTML report in-browser, download it, and receive an email copy.
- **Visual professionalism** of the report itself. A buyer's confidence is set in the first 30 seconds by plausibility, not by accuracy.
- **DPDP Act compliance** is launch-blocking, not future work. Privacy policy, data deletion, retention period, designated DPO (the founder, formally). Sprint 1.

## 8. What we are deliberately NOT building

These have been considered and rejected. Do not propose them again without changing the strategy doc first.

- **Guaranteed tier (₹4,999 with 18-month claim guarantee).** Uncapped liability for a pre-revenue startup. Revisit after 500 paid reports and PI insurance.
- **District Pass annual subscription.** No evidence of broker/lawyer reuse demand yet. Wait for pull.
- **Self-serve B2B API/dashboard.** B2B in proptech is sold, not productized. First B2B customer is a signed contract, not a signup form.
- **Composite "development potential score."** Structured facts only — *"Plot is 800m from project X announced 2024-03"* — never a number we own legally.
- **WhatsApp delivery infrastructure.** Email + shareable URL only.
- **Multi-step pricing tiers at launch.** Standard ₹1 only. One paid decision.
- **Generic "insight engine" over hardcoded rules.** The rule catalog in the Playbook is the engine. Do not generalize prematurely.
- **Customer development and social proof in implementation PIs.** These are in `COMMERCIAL_TRACK.md` — activate only after PI 3. Product completeness comes first.
- **PID Pattern scoring without case validation.** Patterns below PROBABLE tier are internal-only; they do not appear in buyer-facing reports. Geographic blacklisting by place name is explicitly prohibited.
- **Bhulekh Mirror touching /app code.** The mirror is a separate `/crawl` directory (off-limits to main app work). Only integration point is the `high_priority_recheck` INSERT after paid report generation.
- **Generic multi-district before Khordha is validated.** Mirror and PID expand to 4 more districts only after Phase 1 produces ≥15 validated cases and ≥3 VALIDATED patterns.
- **Bhunaksha Plot Report fetcher as a Bhulekh replacement.** The plot-report fetcher (D-036) is a captcha-free cross-check, not a substitute for the Bhulekh ROR. Pipeline wraps it in typed degradation; the ROR remains the primary source. If the two disagree, the ROR wins, and the buyer should verify at the Tehsil.
- **Generic GIS-code table for all 1,477 Khordha villages up front.** The lookup table at `packages/fetchers/bhunaksha-plot-report/src/gis-codes.ts` is bootstrapped from a subset. Villages outside the table return `invalid_input` (typed degradation), not a crash. Full coverage batches with the Cuttack launch in PI 2.
- **Bhunaksha Plot Report map image embedded in the PDF / web report today.** The fetcher returns `mapImageBase64` (588 KB SVG), but the consumer-report renderer does not yet embed it. Section 1 (The plot) is already covered by polygon + satellite. Embedding is a small trust lift, parked in `BACKLOG.md`.

## 9. Tech baseline (assumed, change in DECISIONS.md if you deviate)

- **Stack:** Whatever exists in the repo today. Do not migrate stacks during the launch sprints.
- **Payments:** Razorpay. ~2% fee. Single checkout, not multi-step.
- **Email:** Resend or equivalent transactional provider. Email is a copy/backup, not the only delivery surface.
- **PDF:** Server-rendered from the same HTML as the web report. Print-optimized CSS.
- **Storage:** Persistent token-scoped URLs. 60-day report validity, pay-to-refresh option.
- **Data sources:** Bhulekh ROR (existing fetcher), IGR Odisha EC, eCourts, RCCMS, CERSAI, Bhunaksha (polygon WFS + per-plot report). Concierge first, automation second. The Bhunaksha Plot Report fetcher (`plotreportOR.jsp`) is the only captcha-free live path to a ground-truth-bound owner block for a specific plot — see `DECISIONS.md` D-036.
- **LLM use:** Translation and copy-shaping only. Never authoritative outputs. Fully automated — no founder review gate.

## 10. The fundable narrative (for context, not for chest-thumping in code)

"ClearDeed is the data infrastructure that makes property transactions in Tier-2 India faster, cheaper, and more transparent — starting in Odisha, where we own the consumer market, expanding to institutional clients who currently spend ₹10–50K per title check on manual diligence."

Three claims, each gated by a milestone:
- Product is complete → all data sources integrated, delivery pipeline working (PI 3 complete)
- The product is genuinely better → report quality, NPS > 40 (post first 50 buyers)
- B2B scales → one signed contract at ₹50K+/month MRR (commercial track)

Pre-seed conversations open only after PI 3 is complete. See `COMMERCIAL_TRACK.md`.

## 11. Where to find things

| If you want to know | Read this |
|---|---|
| What we're building this week | `CURRENT_FOCUS.md` |
| Why we made this decision | `DECISIONS.md`* |
| The full sprint plan | `ROADMAP.md` |
| Product details (tiers, report sections, data sources) | `PRODUCT_SPEC.md` |
| The strategy this is all downstream of | `STRATEGY.md` |
| Insight rules and fraud patterns | `FRAUD_PATTERNS.md` |
| Commercial activities (B2B, sales, fundraising) | `COMMERCIAL_TRACK.md` |
| Things we'll build later, parked | `BACKLOG.md` |
| Bhulekh ROR data mirror (build spec + handoff) | `BHULEKH_MIRROR_TRACK.md` |
| Pattern Intelligence Database (build spec + handoff) | `PID_CLAUDE_CODE_INSTRUCTIONS.md` + `PID_TRACK.md` |
| Buyer conversation log (3/week non-negotiable) | `CUSTOMER_DEVELOPMENT.md` |

*DECISIONS.md also contains D-024 (Bhulekh Mirror), D-025 (PID), and D-036 (Bhunaksha Plot Report fetcher) — read them before working on either track.

Anything not in one of those files probably does not belong in the repo as a markdown file. Code goes in code. Decisions go in `DECISIONS.md`. History does not need a home.

---

*Last revised: 2026-06-14. Bhunaksha Plot Report fetcher (V2) shipped (D-036): sibling to the existing Bhunaksha polygon fetcher, returns the rendered per-plot report from `plotreportOR.jsp` (text fields + owner block + cadastral map image), covered by 59 V2 contract tests against a live-verified P051 ground-truth manifest. IGR EC captcha accuracy also solved with 3-way ddddocr ensemble + adaptive K (D-035). Bhulekh Mirror and PID remain integrated into strategy (D-024, D-025). Commercial activities isolated to `COMMERCIAL_TRACK.md`. Implementation PIs 1–3 are engineering-only.*
