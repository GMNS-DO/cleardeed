# ClearDeed — The Final Ceiling Plan
*Appendix to CLAUDE.md | Companion to CLEARDEED_INSIGHT_PLAYBOOK.md*
*Date: 2026-05-14 | Status: Theoretical ceiling for residential property due diligence in Khordha*

---

## What This Document Is and What v1 (the Playbook) Missed

The earlier Playbook is a complete rules catalog. It tells you *which insight to fire for which data state*. That is necessary but not sufficient. A ceiling product also has to nail:

1. **The financial layer** — buyers care about ₹/year of cost, not legal taxonomy.
2. **The buyer's actual mental model** — what they Google at 11pm, not what a lawyer charges for.
3. **The operational moat** — defensibility against well-funded entrants (LegiScore, AdvaRisk, Landeed).
4. **The verification feedback loop** — closing the gap between insight and confirmation.
5. **The fraud playbook** — concrete patterns from real Odisha cases, not generic India fraud literature.
6. **The post-purchase relationship** — the report is a transaction, but the product is a relationship.
7. **The economic engineering** — why people will pay 10× what they pay for a free ROR.

This document covers all seven and is the ceiling beyond which I believe the report itself cannot be made meaningfully more valuable in theory.

---

## Section 1: The Five Real Odisha Fraud Patterns (Anti-Patterns to Detect)

These are not hypotheticals. They are documented cases from Khordha district in the last 36 months. Every detection rule below maps to one of these.

### Pattern 1: The Patia Industrial-Lease Scam (Sep 2024)
**What happened**: 5,000 decimals in Patia (Plot 309, Khata 493) was leased for 99 years in 1979 to "Allied Industries" for industrial use. The tehsildar prepared Khata 474/5 in Sthitiban (freehold-like) status. A residential apartment is being built on it and sold to homebuyers. GA Department issued notices in Sept 2024 ordering resumption under OGLS Act S.3B. Buyers may lose everything.

**Detection rule**: If Bhulekh shows Satwa = Sthitiban/Raiyati BUT a search for the village/khata combination in IGR shows any prior lease deed (RLD prefix instead of RSD), fire CRITICAL.

### Pattern 2: The Surya Nirman Multi-Investor Fraud (Bhubaneswar 2017-2023)
**What happened**: M/s Surya Nirman Resources Pvt Ltd collected ₹2+ crore from depositors promising "litigation-free plots" in Chandaka/Kantabada (Khordha district). Properties were eventually attached by EOW under OPID Act, sold via public auction.

**Detection rule**: Cross-reference plot/khata against EOW-attached property list → CRITICAL if hit. Cross-reference owner name against EOW arrest list → HIGH WATCH-OUT. Maintain `khordha_eow_blacklist.json` updated monthly from eowodisha.gov.in.

### Pattern 3: The Malipada Impersonation Scam (2020-2023)
**What happened**: A 2,000 sq ft plot in Malipada mouza (Bhubaneswar) was sold to a buyer by impersonators preparing fake sale deeds. The real owner (Lipika Das of Kendrapara) filed a complaint. 8 people arrested.

**Detection rule**: If seller's claimed Aadhaar/PAN-linked address is materially distant from the plot district AND there is no PoA registered at the local SRO → HIGH WATCH-OUT.

### Pattern 4: Industrial-Zone Plot Sold as Residential (CEE DEE Builders pattern, Jagulaipadar)
**What happened**: Buyers purchased plots from a builder in Jagulaipadar (Khordha). Some plots fell under BDA Industrial Zone designation. Buyers discovered post-purchase they could not build residential structures.

**Detection rule**: Always cross-reference plot GPS against BDA Master Plan zoning layer.

### Pattern 5: The Subdivided Plot Without BDA Layout Approval
**What happened**: Individual landowners or middlemen sell subdivided plots ("D/88" style sub-plot numbers) to buyers without obtaining BDA layout approval. Buyers find they cannot get building permission later.

**Detection rule**: Plot number contains a sub-plot indicator (e.g., 415/1, 415/A, D/88 pattern) → FLAG. Sub-plot detected + no BDA layout approval → HIGH WATCH-OUT.

---

## Section 2: The Financial Layer — What Each Risk Actually Costs

| Risk Type | Financial Exposure Formula | Display Format |
|---|---|---|
| **Active mortgage (CERSAI hit)** | Mortgage amount or estimated 60-80% of property value | "Lender may recover up to ₹X lakhs from the property if loan is not discharged before sale." |
| **Court attachment** | Full property value | "If attachment is upheld, full purchase consideration (₹X) is at risk." |
| **Pending revenue case** | 30% of property value + 3-7 years litigation cost (₹1-3 lakh/yr) | "Estimated exposure: ₹X + ₹2-5 lakh litigation cost over 3-7 years." |
| **Unauthorized construction on agricultural kisam** | Demolition cost + permission/conversion cost + 2-3 year delay | "Demolition order risk. Conversion fee for [N] decimals = ₹X." |
| **PoA-based sale (Suraj Lamp risk)** | Full property value | "PoA-based conveyances are not valid title transfers per Supreme Court. Full consideration ₹X at risk." |
| **Lease land sold as freehold (Patia pattern)** | Full property value | "If land is resumed by government, full consideration ₹X is at risk." |

**Financial Exposure Summary panel**: "Verified clear exposure: ₹0 on [list]. Quantified at-risk exposure: ₹X across [list]. Unquantified items requiring manual verification: [list]."

---

## Section 3: The Mental Model Translation Layer — Six Buyer Questions

Every Khordha residential buyer asks these six questions. Structure the report around them:

| Q | Buyer's actual question | Data sources |
|---|---|---|
| **Q1** | "Does the seller actually own this?" | ROR owner + IGR last deed + name match + PoA check |
| **Q2** | "Can I build my house here?" | Kisam + BDA zoning + setback rules + flood zone |
| **Q3** | "Could I lose it after paying?" | EC mortgage entries + CERSAI + court attachments + lis pendens |
| **Q4** | "Am I overpaying?" | IGR benchmark + Propstack comps + circle rate |
| **Q5** | "Is the area going to develop or decay?" | BDA Master Plan + LARR notifications + metro corridor + infrastructure |
| **Q6** | "What happens after I buy?" | Mutation cost + property tax + maintenance + civic dues |

---

## Section 4: The Five Sources Missing From v1

### T-053: BMC / Bhubaneswar Municipal Corporation Property Tax Records
Scrape BMC property tax portal by holding number. Outstanding property tax is a charge on the land — buyer inherits it.
Insight: "Outstanding property tax: ₹X. This becomes buyer's liability unless cleared at registration."

### T-054: TPCODL / Electricity Connection History
Long-disconnected connection indicates plot may not have been occupied. Active connection with seller's name confirms occupancy claim.
Insight: "Electricity connection at this address shows [active/disconnected]. Confirm seller is the registered consumer."

### T-055: Newspaper Public Notice Archives (Sambad, Dharitri)
Indian land buyers publish "public notices inviting objections" before purchase. If objections were filed, it's a critical signal.
Insight: "Public notice search found a previous objection-inviting notice published on [date]. Verify objections were resolved."

### T-056: Adjacent Plot Owner Cross-Reference
Use existing Bhunaksha/WFS data. Fetch 4-8 adjacent plot polygons and their kisam/satwa.
Insight (positive): "Adjacent plots are all privately recorded — plot boundaries appear in a normal cadastral pattern."
Insight (negative): "[N] of [M] adjacent plot boundaries are recorded as government land — physical survey strongly recommended."

### T-057: The Seller's Other Properties (IGR owner search)
IGR Odisha owner-search returns all properties registered to a person. Seller with 47 plots = land speculator, not genuine seller.
Insight: "Seller has [N] properties registered in IGR records across Odisha. [If N>5]: Seller appears to be a land aggregator — negotiate accordingly."

---

## Section 5: The Verification Feedback Loop (The Moat)

**The "Did You Buy?" Follow-up**:
30 / 90 / 180 / 365 days after report generation, send a survey:
- Did you proceed with this transaction?
- Did any surfaced risks materialize?
- What did your lawyer's manual verification find that ClearDeed missed?

**Resulting dataset is the moat.** After 1,000 reports: rule weight refinement, missing pattern discovery, conversion rate intelligence. No competitor will have this dataset. It is proprietary by construction.

---

## Section 6: Trust Layer

**Mechanism 1**: Provenance per claim — every fact has a "view source" link to the actual Bhulekh page, eCourts case, BDA master plan PDF with page number.

**Mechanism 2**: Time-stamped guarantee tier (₹4,999) — if any "verified clear" claim turns out wrong within 18 months, refund + panel lawyer free. Risk to ClearDeed: low. Trust premium to buyer: massive.

**Mechanism 3**: Lawyer co-sign option (₹1,999 added) — panel advocate in Bhubaneswar reviews the report and signs it. Bridge from "tool" to "legal product."

---

## Section 7: Three-Layer Report Design

**Layer 1 — The WhatsApp Forward (1 screen)**
What the buyer sends to spouse/father/uncle. Plot address + owner name + area + Top 3 things to know (green-amber-red) + Total quantified exposure + Generated timestamp + verification link. "Generated by ClearDeed — get one for your property at ₹..." footer.

**Layer 2 — The Buyer's Read (5-10 screens)**
The six Buyer Questions answered with collapsible details. Shareable independently.

**Layer 3 — The Lawyer's Drill-Down (full report)**
Source-by-source detail. Raw data + parser confidence + provenance links.

---

## Section 8: Pricing Engineering

| Tier | Price | What's Included |
|---|---|---|
| **Free preview** | ₹0 | Plot found + Owner name + Kisam + 1-line summary |
| **Standard** | ₹699 | Full ROR insights + EC concierge + BDA zoning + Bhuvan flood + Six Buyer Questions |
| **Verified** | ₹1,999 | Standard + RCCMS + eCourts + CERSAI + IGR benchmark + Cost-of-Risk calculator + EC by concierge |
| **Guaranteed** | ₹4,999 | Verified + advocate co-sign + 18-month claim-correctness guarantee |
| **Enterprise (B2B)** | ₹399/report at volume | API access, white-labelled, batch |

---

## Section 9: Honest Final Assessment

This document plus the earlier Playbook is the ceiling. Beyond this, value can only come from:

1. **Scale** (more plots queried → richer comparables)
2. **Time** (longer outcome history → better rule weights)
3. **Geography** (Cuttack/Berhampur expansion — T-045)
4. **Adjacent products** (registration assistance, home loan origination, building permission concierge)
5. **Generative AI for explanation** (vernacular translation — UX, not new insight)

The insight engine itself is at its theoretical ceiling once Sections 1-11 are implemented. Everything beyond is execution, data accumulation, and adjacent-product expansion.

There is no insight or data source that meaningfully improves the residential-buyer due-diligence report for Khordha beyond what is specified here and in the Playbook. Anything additional would be marginal or off-product.
