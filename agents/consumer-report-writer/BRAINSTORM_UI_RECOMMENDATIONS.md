# ClearDeed Report UI — Signal Inventory & Design Brainstorm

**Date:** 2026-06-24
**Context:** Current CRED-based buyer-page design is structurally sound (hero + Q-grid + sticky-nav) but under-uses the available data signal. This document inventories *everything* the system processes and proposes a richer, more value-dense UI.

---

## Part 1: What We Process (Signal Inventory)

### Input Data (from orchestrator)

| Source | Fields | What it tells us |
|--------|--------|------------------|
| **User input** | `gpsCoordinates`, `claimedOwnerName`, `plotDescription` | Starting query — not facts yet |
| **geoFetch (Nominatim)** | `village`, `tahasil`, `district`, `state`, `postcode`, `displayName` | Reverse geocoding — coarse, often wrong in rural Odisha |
| **revenueRecords (Bhulekh RoR)** | `khataNo`, `village`, `district`, `riCircle`, `lastUpdated`, `tenants[]` | **Gold source** for ownership and land classification |
| **tenants[] (per owner)** | `tenantName`, `surveyNo`, `area`, `unit`, `landClass`, `fatherName` | Individual owner records — plot repeats for co-owners |
| **courtCases (eCourts)** | `total`, `cases[]` | Litigation risk — requires captcha, currently V1.1-dormant |
| **registryLinks (IGR)** | `url`, `params` (district, sro, plotNo, ownerName), `instructions` | Deep-link to EC portal — manual retrieval in V1 |

### Interpreted Outputs (Tier 2)

| Interpreter | Output fields | Consumer-facing meaning |
|-------------|---------------|------------------------|
| **ownershipReasoner** | `officialOwnerName`, `transliteratedOwnerName`, `nameMatch` (exact/partial/mismatch), `nameMatchConfidence`, `discrepancyExplanation`, `coOwners[]`, `fatherNameOnRecord`, `confidence` | **Is this seller actually the owner?** |
| **landClassifier** | `currentClassification`, `classificationSource`, `permittedUses[]`, `conversionRequired`, `conversionSteps`, `redFlags[]`, `confidence` | **Can I build my house here?** |
| **encumbranceReasoner** | `status` (clear/encumbered/manual_required), `encumbrances[]`, `clearPeriod`, `instructions`, `confidence` | **Could I lose it after paying?** |
| **regulatoryScreener** | `flags[]`, `plotConfirmedInRegulatedZone`, `overlaySource`, `confidence` | **Is this in a restricted zone?** |

### Validation Findings (cross-source consistency)

| Dimension | Example finding | Severity |
|-----------|------------------|----------|
| `village` | Nominatim says "Chandaka", Bhulekh says "Mendhasala" | warning |
| `area` | Bhunaksha 76 acres vs Bhulekh 52.5 acres | warning |
| `plotNo` | No match between input and Bhulekh | error |
| `ownerName` | Claimed owner not found in tenants | error |

### Insight Engine (60+ rules, 15 panels)

**Panels:** `plot`, `owner`, `land`, `plotTable`, `dues`, `backPage`, `chain`, `encumbrance`, `deeds`, `court`, `financial`, `ownershipChain`, `neighbours`, `roadAccess`, `khaAdjacent`, `completeness`

**Issue lenses:** `title_chain`, `registry_ec`, `revenue_record`, `land_use_permission`, `parser_source_quality`

**Evidence strengths:** `document_anchor` (strongest), `case_or_order_anchor`, `selected_plot_anchor`, `row_count_signal`, `source_observation`, `parser_uncertain`, `missing_source` (weakest)

**Severity buckets:** `positive` (✅ verified clear), `watchout` (🟡 investigate), `redFlag` (🔴 dealbreaker)

**Sample rules by panel:**

| Panel | Sample rule IDs | Sample findings |
|-------|-----------------|------------------|
| `owner` | ROR-INS-020 (multipleCoOwnersRedFlag), ROR-INS-030 (ownerNameMismatchRedFlag), ROR-INS-032 (governmentKhatiyanRedFlag) | "5 co-owners", "Seller name ≠ RoR owner", "Government land — cannot buy" |
| `land` | ROR-INS-050 (conversionRequiredWatchout), ROR-INS-060 (prohibitedUseRedFlag) | "Conversion required", "Not buildable as residential" |
| `plot` | ROR-INS-040 (subdivisionIndicatorWatchout), ROR-INS-072 (villageMismatchWarning) | "Sub-plot indicator (415/1) — verify BDA layout approval", "Village mismatch between sources" |
| `court` | ROR-INS-180 (activeCaseRedFlag), ROR-INS-181 (lisPendensRedFlag) | "Active civil suit on plot", "Lis pendens — stay on transfer" |
| `chain` | ROR-INS-220 (mutationGapRedFlag), ROR-INS-221 (lastSaleGapWatchout) | "Mutation not done for last sale (2022)", "No sale recorded in 15 years" |
| `neighbours` | ROR-INS-250 (adjacentPlotInquiryWatchout) | "Adjoining plot under court case — verify dispute doesn't spill over" |
| `financial` | ROR-INS-300 (encumbranceValueExposureRedFlag), ROR-INS-301 (litigationCostExposureWatchout) | "₹12L exposure if mortgage enforced", "₹3–5L litigation cost over 3–7 years" |

---

## Part 2: What Current Design Shows (Audit)

### Hero
```
ClearDeed — Property Report CLD-GOLDEN-001
Limited data — manual checks required
Mendhasala, Bhubaneswar, Khordha
```

**Problems:**
- No verdict severity (red/amber/green)
- No ₹ exposure
- No specific callout of top risks
- No positive signals

### Source Status Strip
```
✅ Bhulekh  ✅ Bhunaksha  ⏳ eCourts  ⏳ IGR  ⏳ ...
```

**Problems:**
- No confidence scores
- No "what we know" summary
- No manual vs automated distinction

### Q-Grid (6 tiles)

| Q | Title | Status |
|---|-------|--------|
| 1 | Does the seller own this? | ⏳ Limited data |
| 2 | Can I build my house here? | ⏳ Manual verification required |
| 3 | Could I lose it after paying? | ⏳ No EC retrieved |
| 4 | Am I overpaying? | ⏳ Manual verification required |
| 5 | Is this area going to develop? | ⏳ Manual verification required |
| 6 | What happens after I buy? | ⏳ Manual verification required |

**Problems:**
- Generic "manual verification" everywhere — no differentiation
- No specific insights surfaced (e.g. "Name mismatch" for Q1)
- No ₹ exposure visible
- No positive signals

---

## Part 3: Design Recommendations

### Option A: Enriched Hero (1.5x current density)

**Top hero strip:**

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Mendhasala 309 • 10.5 acres • Khordha                      2 min read   │
└──────────────────────────────────────────────────────────────────────────┘

┌─────────────────────┬─────────────────────────────────┬──────────────────┐
│ PROPERTY             │ VERDICT (red)                    │ ₹ EXPOSURE       │
│─────────────────────│─────────────────────────────────│──────────────────│
│ Plot: Mendhasala 309│ 🔴 SELLER NAME ≠ ROR OWNER       │ ~₹5–15L at risk  │
│ Area: 10.5 acres   │ Name mismatch: Barajena vs       │                  │
│ Kisam: Ag (ଦଣ୍ଡା)     │ Mohapatra                         │ Name dispute:    │
│ Zone: Residential   │ 🔴 5 CO-OWNERS — all must sign   │ ₹5–10L           │
│                     │ 🟡 CONVERSION REQUIRED           │ Conversion:      │
│                    │ Agricultural → residential needs │ ₹1–3L            │
│                    │ tehsil approval                  │                  │
│                    │ ⏳ EC NOT RETRIEVED (manual req)  │ EC gap: unknown  │
└─────────────────────┴─────────────────────────────────┴──────────────────┘

POSITIVE SIGNALS:
✅ No court cases found (eCourts)
✅ BDA zone is residential (buildable)
✅ Plot polygon confirmed in Bhunaksha
```

**Changes:**
- Hero now shows specific verdicts (name mismatch, co-owners, conversion)
- ₹ exposure breakdown (name dispute, conversion, EC gap)
- Positive signals in green

---

### Option B: Three-Panel Layout (more information-dense)

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          CLEARDEED PROPERTY REPORT                        │
│                        CLD-GOLDEN-001 • 20 Jun 2026                      │
└──────────────────────────────────────────────────────────────────────────┘

┌─────────────────────┬─────────────────────────────────┬──────────────────┐
│ WHAT: PROPERTY       │ SO WHAT: RISKS (3)              │ NOW WHAT: NEXT   │
│─────────────────────│─────────────────────────────────│──────────────────│
│ Mendhasala 309      │ 🔴 NAME MISMATCH                 │ 1. Ask seller:  │
│ 10.5 acres         │ Barajena ≠ Mohapatra             │ "Why does your   │
│ Khordha            │ → ₹5–10L dispute risk            │ name differ from │
│                    │                                   │ Bhulekh record?" │
│                    │ 🟡 5 CO-OWNERS                   │                 │
│                    │ All must sign to transfer        │ 2. Confirm:      │
│                    │ → Deal risk if any dissent       │ All co-owners   │
│                    │                                   │ consent in       │
│                    │ 🟡 CONVERSION REQUIRED            │ writing          │
│                    │ Agricultural → residential        │                 │
│                    │ → ₹1–3L + 12–24 month delay       │ 3. Visit tehsil: │
│                    │                                   │ Check conversion │
│                    │                                   │ status & fees    │
└─────────────────────┴─────────────────────────────────┴──────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│ FINANCIAL EXPOSURE SUMMARY                                                │
├──────────────────────────────────────────────────────────────────────────┤
│ Verified clear exposure: ₹0                                                │
│ At-risk exposure: ~₹8–13L (name dispute ₹5–10L + conversion ₹1–3L)         │
│ Unquantified exposure: EC gap (mortgages/courts may exist)                 │
└──────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│ SOURCE CONFIDENCE TABLE                                                   │
├─────────────────┬──────────────┬───────────────┬──────────────────────────┤
│ Source          │ Status       │ Confidence    │ What we know             │
├─────────────────┼──────────────┼───────────────┼──────────────────────────┤
│ Bhulekh (RoR)    │ ✅ Retrieved │ 85%           │ 5 owners, agricultural    │
│ Bhunaksha (map)  │ ✅ Retrieved │ 60%           │ Plot polygon confirmed   │
│ eCourts          │ ✅ No cases  │ 70%           │ Zero matches for owner  │
│ IGR (EC)         │ ⏳ Manual     │ 0%            │ Not retrieved — visit SRO│
└─────────────────┴──────────────┴───────────────┴──────────────────────────┘

[6 Q tiles below, same as before but enriched with specific insight counts]
```

**Changes:**
- Three-column layout: WHAT / SO WHAT / NOW WHAT
- Financial exposure summary (new panel)
- Source confidence table (new panel)

---

### Option C: Timeline-Based Layout (story mode)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ ClearDeed Report: Mendhasala 309 • Khordha                              │
└──────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│ AT A GLANCE                                                               │
├──────────────────────────────────────────────────────────────────────────┤
│ 🔴 HIGH RISK: Name mismatch + 5 co-owners + conversion required          │
│ ✅ VERIFIED CLEAR: No court cases, residential zone                       │
│ ⏳ DATA GAP: EC not retrieved                                              │
│ ₹ EXPOSURE: ~₹8–13L (name dispute + conversion)                            │
└──────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│ OWNERSHIP TIMELINE                                                        │
├──────────────────────────────────────────────────────────────────────────┤
│ 2018  ▶ RoR updated — Krushnachandra Barajena + 4 co-owners recorded     │
│ 2024  ▶ Seller claims "Mohapatra" — name not on RoR                       │
│ Today ▶ YOU: Verify name discrepancy before paying                        │
└──────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│ LAND USE & PERMISSIONS                                                    │
├──────────────────────────────────────────────────────────────────────────┤
│ Current: Agricultural (ଦଣ୍ଡା) — irrigated                                    │
│ Intended: Residential                                                    │
│ Gap: Conversion required → ₹1–3L + 12–24 months                            │
│ Zone: BDA Residential (buildable) ✅                                     │
└──────────────────────────────────────────────────────────────────────────┘

[Q-grid below]
```

**Changes:**
- Ownership timeline (new)
- Land use checklist (new)

---

## Part 4: Recommendations Summary

### What to add to the current design (ranked by value):

1. **Hero verdict severity** — color-code the hero strip (red/amber/green) and show top 3 risks
2. **₹ exposure summary** — new panel below hero, shows verified-clear vs at-risk vs unquantified
3. **Positive signals panel** — show what's been verified clear (no court cases, residential zone, etc.)
4. **Specific insight counts** — Q-tiles show "3 red flags" instead of generic "manual verification"
5. **Source confidence table** — new panel, shows status/confidence/what-we-know per source
6. **Ownership timeline** — visualize RoR date, last sale, mutation gaps
7. **Co-owner consent checklist** — when >1 owner, show consent status for each
8. **Conversion cost estimator** — when conversion required, show estimated ₹ and timeline
9. **Zoning chip** — show BDA zone with icon (industrial/residential/commercial)
10. **Action items per risk** — each redFlag/watchout maps to a concrete question for the seller

### What to remove (reduce redundancy):

1. Repeated "manual verification required" — replace with specific gaps
2. Generic "what we checked" — replace with finding-specific disclosures
3. Duplicate data across sections — show each fact once with clear provenance

### Visual treatments:

- **Red flag:** 🔴 icon + bold + background tint
- **Watchout:** 🟡 icon + medium weight
- **Positive:** ✅ green icon
- **Data gap:** ⏳ icon + grey
- **₹ exposure:** always show range (₹X–Y) with justification

---

## Part 5: Proposed Implementation Order

1. **Enrich hero** (add verdict severity + top 3 risks + ₹ exposure summary)
2. **Add positive signals panel** (below hero, left side)
3. **Add source confidence table** (below hero, right side)
4. **Enrich Q-tiles** (show specific insight counts instead of generic status)
5. **Add action items per Q** (expandable "what to ask seller" per question)

This preserves the 1–2 page constraint while dramatically increasing information density and value to the buyer.
