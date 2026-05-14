# COMMERCIAL_TRACK.md — ClearDeed Commercial Activities

> **Status:** This document is activated only after implementation PI 3 is complete (end of Sprint 15).
> **Purpose:** Isolates all revenue-adjacent, buyer-facing, and sales activities from the implementation roadmap.
> **Rule:** Nothing in this document affects sprint planning or code delivery timelines. These are post-implementation activities.
> **Why this file exists:** Implementation and commercial activities have different cadences, different metrics, and different failure modes. Mixing them in one roadmap produces the 57-session failure mode — building indefinitely without revenue. This file keeps them separate.

---

## What this file contains

- Customer development (buyer conversations, interviews, NPS)
- Social proof (testimonials, live report counter, testimonials)
- B2B pipeline (law firm targeting, HFC conversations, contract negotiation)
- Consumer marketing (launch announcement, channel strategy, referral programs)
- Investor outreach (pre-seed conversations, pitch deck, term sheets)
- Post-implementation surveys and follow-up

---

## When this document is activated

This document is a **future state**. It is written now to:
1. Be clear about what is NOT in the implementation roadmap
2. Give a forward-looking view of what happens after the product is complete
3. Prevent scope creep into the implementation PIs

**Do not start any work in this document until Sprint 15 is complete and the implementation PI 3 retrospective is done.**

---

## 1. Customer Development

**Goal:** Understand the buyer well enough to validate or kill the product narrative.

### 1.1 Buyer conversation cadence

**Rule:** 3 conversations per week, every week. Non-negotiable once started. Skipped weeks get flagged in the next review.

| Sprint | Week | Target | Actual | Notes |
|---|---|---|---|---|
| S16 | W31 | 3 | | |
| S16 | W32 | 3 | | |
| S17 | W33 | 3 | | |
| S17 | W34 | 3 | | |

### 1.2 Buyer interview template

See `CUSTOMER_DEVELOPMENT.md` for the conversation log template and pattern-watching notes.

### 1.3 NPS survey (60-day post-purchase)

Two questions, one email, one response page:
1. *Did you proceed with this purchase?* Yes / No / Still deciding
2. *Anything important we missed?* (free text)

Target: NPS > 40. Below 30 = product gap, not a sales gap.

---

## 2. Social Proof

Social proof is collected from real buyers, not fabricated. It ships when there are real buyers to collect from.

### 2.1 Live elements (activate when first buyers exist)

- **Live report counter:** Total reports generated. Activate when count > 10.
- **Three real testimonials:** Photo + locality + consent required. Collect from first 10 buyers who say yes to NPS question 2.
- **Anonymized report excerpt:** One real report section shown with buyer and seller names masked. Consent required.

### 2.2 Where social proof appears

- Homepage: testimonials panel + live counter
- Report share page: "verified by ClearDeed" badge
- LinkedIn: founder posts citing real buyer outcomes (with consent)

### 2.3 Before social proof exists

Homepage uses honest placeholder language:
- *"Be among the first buyers in Khordha to get a ClearDeed report."*
- No fabricated counter, no fake testimonials, no placeholder quotes.

---

## 3. B2B Pipeline

B2B in proptech is **sold, not productized**. First B2B customer is a signed contract, not a signup form.

### 3.1 B2B sequence

| Sprint | Activity | Target |
|---|---|---|
| S16 | First law firm outreach | 3 Bhubaneswar law firms contacted |
| S17 | First demo meeting | 1 firm agrees to demo |
| S18 | Pilot proposal | Custom contract drafted |
| S19 | First signed B2B customer | Signed, first batch delivered |
| S20–24 | Second B2B segment | HFC or CA firm signed |

### 3.2 First B2B target: Bhubaneswar law firm

Criteria:
- Doing 20–50 title checks/month (enough volume to care)
- Solo partner or small team (faster procurement than large firm)
- Already paying ₹10–30K per check manually (willing to pay for better)

Likely contract elements:
- Batch input (CSV or upload)
- Lawyer-facing drill-down emphasized
- Optional white-label
- Volume pricing: ₹399–₹499/report at 20+ reports/month
- Monthly invoice, NET-15

### 3.3 What to build for B2B customer #1

Build only what the signed contract requires. Nothing more. Productize only after customer #2 wants the same shape.

---

## 4. Consumer Marketing

Consumer marketing starts after:
- PI 3 implementation is complete
- NPS from first 20 buyers is ≥ 30
- At least 1 testimonial with consent is available

### 4.1 Launch sequence

1. **Soft launch (S16):** Founder LinkedIn post. No press, no paid ads. Share the actual product, not the concept.
2. **Organic channels (S16–18):** Broker WhatsApp networks. Property Facebook groups. Bhubaneswar locality groups.
3. **NPS-driven iteration (S17):** Fix what NPS respondents say is missing before spending on paid acquisition.
4. **Paid acquisition (S18+):** Google Ads for "verify land ownership Odisha" and similar terms. Facebook / Instagram for the aspirational buyer. Only if CAC < LTV/3.

### 4.2 Referral program

Parked until 50 paid reports exist. Requires identity verification that DPDP makes complex. Revisit at 100 reports.

---

## 5. Pricing decisions (post-implementation)

| Decision | Trigger | Action |
|---|---|---|
| Raise to ₹999 | 50+ paid reports, week-over-week growth, NPS ≥ 40 | Update pricing, communicate to existing buyers |
| Launch Guaranteed tier | 500+ reports, PI insurance in place, claim rate understood | New tier in DECISIONS.md |
| Launch District Pass | Visible broker/lawyer reuse demand | New tier in DECISIONS.md |

---

## 6. Investor Outreach

Pre-seed conversations open only after:
- PI 3 implementation complete
- NPS > 40 from real buyers
- 1 B2B customer signed at ₹50K+/month MRR

### 6.1 Pre-seed narrative

"ClearDeed is the data infrastructure that makes property transactions in Tier-2 India faster, cheaper, and more transparent — starting in Odisha, where we own the consumer market, expanding to institutional clients who currently spend ₹10–50K per title check on manual diligence."

Three claims, each gated by a milestone:
1. Product is complete → all data sources integrated, delivery pipeline working (PI 3 complete)
2. Product is genuinely better → report quality, NPS > 40 (post first 50 buyers)
3. B2B scales → one signed contract at ₹50K+/month MRR (S19+)

### 6.2 Pre-seed target

₹1–2 crore from angels and one seed-stage investor focused on Tier-2 India infrastructure. Funds a team of 3: full-stack engineer, customer ops, B2B BD.

---

## 7. Hiring (post-implementation)

Trigger: founder spending >2 hours/day on report review ops or customer support.

| Role | Timing | Priority |
|---|---|---|
| Report review contractor | When review queue >2 hrs/day | Immediate if it happens |
| Full-stack engineer | After first B2B customer signed | High |
| Customer ops | 100+ paid reports/month | Medium |
| B2B BD | 2 B2B customers, growing | Medium |

---

## 8. Sprint 16–20: Detailed commercial sprint plan

Once PI 3 is complete, this section is filled in with concrete targets based on actual product readiness.

*This section is intentionally blank until PI 3 closes. Filling it in before then is the failure mode we're avoiding.*

---

*Commercial activities begin only after implementation PI 3 is complete. Until then, this file is a reference — not a plan.*