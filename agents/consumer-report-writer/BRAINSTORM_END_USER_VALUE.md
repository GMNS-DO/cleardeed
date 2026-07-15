# ClearDeed Report Design: End-User Value & Display Treatments

**Date:** 2026-06-22
**Context:** Full audit of all extracted data (58 insight rules, 15 fetchers, 4 interpreters). Now translating each data point into maximum value for the buyer + designing how to show it.

---

## Part 1: The Buyer — Who Is This For?

### Persona: "First-time land buyer in Khordha, anxious about fraud"

**Demographics:**
- Age 28–45, middle-class, salaried or small-business
- Technology: WhatsApp-native, Google-search-comfortable, not app-literate
- Legal literacy: near zero — doesn't know "mutation", "encumbrance", "kisam"
- Timeline: 1–7 days before decision — already visited the plot, broker is pressing

**Psychology at purchase moment:**
- **Fear:** "What if I pay and it's not theirs?" / "What if there's a court case I don't know about?" / "What if the government takes it back?"
- **Hope:** "I just want to build my house here." / "Is this a good area? Will it develop?" / "Am I paying too much?"
- **Confusion:** "What does 'kisam' mean?" / "Why does the name look different?" / "What's an encumbrance certificate?"

**Decision framework (not a score, but information):**
They want to answer 6 questions before they pay:
1. Does the seller actually own this?
2. Can I build my house here?
3. Could I lose it after paying?
4. Am I overpaying?
5. Is this area going to develop or decay?
6. What happens after I buy?

**What they don't want:**
- Legal jargon (kisam, mutation, encumbrance) without explanation
- A number telling them what to do (they don't trust a number for this decision)
- Pages of raw government data (they can't read Odia or parse legal forms)
- A false sense of safety — they know land is complex, they want clarity, not a green checkmark

---

## Part 2: Every Data Point We Extract → Its Value → How to Show

### Tier 1: Core Identity (What is this land?)

| Data Point | What It Is | Buyer Question | Value to Buyer | Display Treatment |
|---|---|---|---|---|
| **plotNo** (Bhulekh/Bhunaksha) | Plot survey number | "Is this the plot I saw?" | Confirms they're looking at the right land | Top of hero, bold: "Mendhasala 309" |
| **village, tahasil, district** (Nominatim/Bhulekh/Bhunaksha) | Location hierarchy | "Where exactly is this?" | Helps them ground the plot, check neighborhood | Hero subhead, linked to Google Maps |
| **area (acres/decimals)** (Bhulekh) | Plot size | "How big is it?" | Confirms broker's claim, basis for price negotiation | Hero: "10.5 acres" with badge if area mismatch >5% |
| **khataNo** (Bhulekh) | Revenue account number | "What's the revenue record?" | Not meaningful to buyer — show as reference only | Small label in hero: "Khata: 830" |
| **lastUpdated** (Bhulekh) | When RoR was last updated | "How recent is the record?" | Old records may mean transactions not reflected | Hero: "Record updated: 01-01-2018" with watchout if >5 years |
| **gpsSource** (Nominatim) | How location was found | "How did you find it?" | Provenance — shows reverse-geocode is approximate | Tiny label: "GPS reverse-geocoded (coarse)" |

---

### Tier 2: Ownership (Who owns this?)

| Data Point | What It Is | Buyer Question | Value to Buyer | Display Treatment |
|---|---|---|---|---|
| **officialOwnerName** (A5) | Name on Bhulekh RoR | Q1: Does the seller own this? | The ground truth — if seller name ≠ this, we have a problem | Hero: "Official owner: Krushnachandra Barajena" with 🔴 if mismatch |
| **transliteratedOwnerName** (A5) | Odia → Latin script | Q1 | Helps them read the Odia name | Same line, smaller: "(Krushnachandra Barajena)" |
| **nameMatch** (A5: exact/partial/mismatch) | Seller vs RoR comparison | Q1 | **The single most important signal** — if mismatch, deal is risky | Hero tile: "Name match: ❌ MISMATCH" (red) or "✅ Match" (green) |
| **nameMatchConfidence.score** (A5) | 0–1 confidence in match | Q1 | Shows how confident we are — low confidence means double-check | Small badge: "Confidence: 30%" if <70 |
| **discrepancyExplanation** (A5) | Why names differ | Q1 | Tells them what to ask the seller | Expandable: "Seller says 'Mohapatra' but RoR says 'Barajena' — ask seller to explain" |
| **coOwners[]** (A5) | Other owners on RoR | Q1 | **Transferability risk** — all must sign, any can block | Hero: "5 co-owners" with orange if >1; on click: list all names |
| **fatherNameOnRecord** (A5) | Father/guardian on RoR | Q1 | Helps distinguish same-name people | Small label: "Father: Pratima Chandra Barajena" |
| **matchedTenantIndex** (A5) | Which RoR row matched | Q1 | Not meaningful to buyer — internal only | Hide |
| **claimState** (A5) | Matched/partial/mismatch/... | Q1 | Internal — mapped to severity | Hide, show severity instead |
| **readiness (L0–L4)** (A5) | Data quality tier | Q1 | Internal confidence | Hide |
| **matchReasons[]** (A5) | Why we matched | Q1 | Not meaningful to buyer | Hide |
| **blockingWarnings[]** (A5) | Critical blockers | Q1 | Show in hero if present | Hero: "⚠️ Government khatiyan — cannot buy" |
| **ownerBlockRawOdia** (Bhulekh) | Raw Odia owner block | Q1 | Provenance for lawyers only | Layer 2 (lawyer view) |
| **guardianRelationOdia** (Bhulekh) | "ସ୍ୱ/ଜା" (son/daughter) | Q1 | Not meaningful to buyer | Hide |
| **casteOdia** (Bhulekh) | Caste | Q1 | Irrelevant and sensitive | **Never show** |
| **residenceOdia** (Bhulekh) | Owner's residence | Q1 | Helpful for PoA risk | Show in Q1 detail if address is in different district |

---

### Tier 3: Land Classification & Permissions (Can I build here?)

| Data Point | What It Is | Buyer Question | Value to Buyer | Display Treatment |
|---|---|---|---|---|
| **landClass / landClassOdia** (Bhulekh) | Kisam (agricultural/homestead) | Q2: Can I build my house here? | **Critical** — agricultural land needs conversion | Hero: "Kisam: Agricultural (ଦଣ୍ଡା)" with 🟡 if conversion required |
| **landClassEnglish** (Bhulekh) | English translation | Q2 | Helps them understand Odia term | Same line, smaller: "(Irrigated)" |
| **primaryKisam** (A6) | Normalized classification | Q2 | Gives consistent category across sources | Hero tile, clickable to detail |
| **primaryCategory** (A6) | safe/conversion-required/prohibited | Q2 | **The verdict on buildability** | Hero badge: "✅ Buildable" / "🟡 Conversion required" / "🔴 Prohibited" |
| **conversionRequired** (A6) | Whether conversion needed | Q2 | Shows next step | If true: "Conversion required — visit tehsil" |
| **cluFeeEstimate** (A6) | Conversion fee ₹ estimate | Q2 | **Financial impact** — they need to know cost | Hero or exposure panel: "Conversion fee: ~₹1–3L" |
| **conversionNote** (A6) | Conversion explanation | Q2 | Tells them timeline | Detail panel: "Takes 12–24 months via Revenue Department" |
| **restrictions[]** (A6) | PESA/CRZ/Forest/sub-plot/BDA/etc. | Q2 | Shows specific legal barriers | Each restriction gets a row: "🔴 Forest zone — cannot build" |
| **bdaZone** (A6) | BDA zoning (residential/industrial) | Q2 | **Major value** — industrial ≠ residential in price | Hero badge: "Zone: Residential" with icon |
| **bdaZoneNote** (A6) | Zone explanation | Q2 | Gives context | Detail: "Permitted: residential, commercial. Restricted: industrial." |
| **classificationExplanation** (A6) | How we classified | Q2 | Provenance | Detail, expandable: "How we checked" |
| **plotClassifications[]** (A6) | Per-plot classification | Q2 | For multi-plot reports | Detail table |
| **overallRestrictionCount** (A6) | How many restrictions | Q2 | Summary stat | Hero chip: "3 restrictions" if >0 |
| **hasCriticalRestriction** (A6) | Any red-level restrictions | Q2 | **Dealbreaker flag** | Hero 🔴 if true |
| **prohibitedPlotCount** (A6) | How many plots prohibited | Q2 | For multi-plot | Detail |

---

### Tier 4: Mutation History & Ownership Chain (How solid is the title?)

| Data Point | What It Is | Buyer Question | Value to Buyer | Display Treatment |
|---|---|---|---|---|
| **mutationReferences[]** (Bhulekh back page) | Mutation case refs on RoR | Q1: How solid is the title? | Shows history of transfers — frequent recent mutations = churn risk | Hero chip: "3 mutation refs" or detail: "Mutation cases: [case-no, date]" |
| **mutationHistory[]** (A6 if wired) | Full mutation chain | Q1 | **Trust signal** — continuous chain = stronger title | Detail timeline: "2018: Sale to Barajena → 2022: Mutation recorded" |
| **mutationCountRecent** (insight) | Recent mutations | Q1 | High churn = risk | Hero 🟡 if >2 in last 12 months |
| **mutationRefDakhalKharaj** (insight) | Dakhal Kharaj reference | Q1 | **Red flag** — possession dispute | Hero 🔴: "⚠️ Dakhal Kharaj reference — possession dispute" |
| **encumbranceStyleEntry** (insight) | Encumbrance on RoR page 2 | Q3: Could I lose it? | **Red flag** — court order or mortgage recorded | Hero 🔴: "⚠️ Encumbrance-style entry — may indicate court order" |
| **backPageRemarks[]** (Bhulekh) | Free text remarks | Q1/Q3 | May contain court case numbers, bank names | Detail: parse and surface court refs, mortgage refs |
| **encumbranceEntries[]** (Bhulekh) | Encumbrance rows from back page | Q3 | **High-value signal** — if non-empty, urgent | Hero 🔴 with count; detail with list |

---

### Tier 5: Court Cases & Litigation (Could I lose it?)

| Data Point | What It Is | Buyer Question | Value to Buyer | Display Treatment |
|---|---|---|---|---|
| **courtCases.total** (eCourts) | Number of cases found | Q3: Could I lose it? | **Zero = positive signal** — show green | Hero ✅: "No court cases found" |
| **courtCases.cases[]** (eCourts) | Case details | Q3 | If present, critical — show each case | Hero 🔴 with case count; detail: list each case with type/date |
| **caseNo, caseType, court** (eCourts) | Case identifiers | Q3 | Helps lawyer retrieve documents | Detail table |
| **filingDate, status** (eCourts) | When case filed, current status | Q3 | Old/pending = higher risk | Detail: "Pending since 2019" in amber |
| **parties** (eCourts) | Petitioner/respondent | Q3 | Helps assess if owner is party | Detail: mask names, show "Owner is party" if match |
| **lastHearingDate, nextHearingDate** (eCourts) | Hearing dates | Q3 | Shows activity | Detail: "Next hearing: 15-Aug-2026" |
| **RCCMS cases** (RCCMS) | Revenue court cases | Q3 | Revenue disputes can affect title | Hero 🔴 if any; detail with list |
| **EoW blacklist match** (EoW) | Plot/owner on EoW list | Q3 | **CRITICAL** — fraud pattern | Hero 🔴: "⚠️ Plot on EoW blacklist — Surya Nirman fraud pattern" |

---

### Tier 6: Encumbrance & Mortgages (Could I lose it?)

| Data Point | What It Is | Buyer Question | Value to Buyer | Display Treatment |
|---|---|---|---|---|
| **igrEcEntries[]** (IGR EC) | EC entries from IGR | Q3: Could I lose it? | **The single most important source** — shows mortgages, court attachments | Hero ✅: "No encumbrances (last 15 years)" or 🔴 with count |
| **ecAvailable** (IGR EC) | Whether EC retrieved | Q3 | Shows data gap if false | Hero ⏳: "EC not retrieved — manual verification required" |
| **docType, docNo** (IGR EC) | Document type/number | Q3 | Helps retrieve full deed | Detail: "Sale deed #1234/2019" |
| **regDate** (IGR EC) | Registration date | Q3 | Shows recency | Detail: "15-Mar-2019" |
| **party1, party2** (IGR EC) | Buyer/seller | Q3 | Confirms ownership chain | Detail: mask names, show "Current owner in party2" |
| **consideration, marketValue** (IGR EC) | Sale amounts | Q4: Am I overpaying? | **Price benchmark** — shows market | Detail: "Sold for ₹8L in 2019" |
| **modeOfTransfer** (IGR EC) | How transferred | Q3 | **Suraj Lamp PoA risk** — "gpa_sale" = red flag | Hero 🔴: "⚠️ Sale by Power of Attorney — fraud risk" |
| **poaOnRecord** (IGR EC) | PoA flag | Q3 | PoA sales need extra verification | Hero 🟡: "Power of Attorney on record — verify authenticity" |
| **cersaiCharges[]** (CERSAI) | Secured charges | Q3 | Bank mortgages | Hero 🔴 with count; detail: "₹12L mortgage from SBI" |
| **chargeType, borrowerName** (CERSAI) | Charge details | Q3 | Shows liability | Detail |
| **securedCreditor, chargeAmount** (CERSAI) | Bank and amount | Q3 | **Financial exposure** — lender may recover from property | Exposure panel: "Mortgage exposure: ₹12L" |
| **chargeStatus** (CERSAI) | Active/satisfied | Q3 | Shows if discharged | Detail: "Active" in red, "Satisfied" in green |
| **encumbranceReasoner.status** (A7) | clear/encumbered/manual_required | Q3 | **The verdict** | Hero badge: "✅ No encumbrances" / "🔴 Encumbered" |
| **clearPeriod** (A7) | Clear period from EC | Q3 | Shows clean years | Hero: "Clear for 15 years (2009–2024)" |
| **encumbranceReasoner.instructions** (A7) | Manual steps | Q3 | Actionable | Detail: "Visit igrodisha.gov.in to get EC" |

---

### Tier 7: Neighbors, Boundaries & Access (What's around this plot?)

| Data Point | What It Is | Buyer Question | Value to Buyer | Display Treatment |
|---|---|---|---|---|
| **chauhaddi{N,S,E,W}** (Bhulekh) | Boundary coordinates | Q2 | Helps verify on ground | Detail table: "North: 123°, South: 124°, ..." |
| **chakNameOdia** (Bhulekh) | Chak (sub-area) | Q2 | Local reference | Small label |
| **remarksOdia** (Bhulekh) | Plot remarks | Q2 | May contain restrictions | Detail, parsed |
| **polygon** (Bhunaksha) | Plot geometry (GeoJSON) | Q2 | **Visual** — map thumbnail | Hero thumbnail: cadastral map image |
| **areaSqKm** (Bhunaksha) | Area from polygon | Q2 | Cross-checks Bhulekh area | Hero badge if mismatch >10% |
| **neighbours[]** (Bhunaksha) | Adjacent plots | Q2 | **Major value** — shows if surrounded by govt land | Hero 🟡: "Bounded by government (KHA) land on 2 sides" |
| **adjacentPlotMismatch** (insight) | Neighbors don't match | Q2 | Data quality flag | Detail |
| **roadAccess** (insight) | Road on any side | Q2 | **Access risk** — no road = no approach | Hero 🔴: "No road on any side — verify access" |
| **surroundedByKha** (insight) | Bounded by govt land | Q2 | **Acquisition risk** | Hero 🔴: "Surrounded by government land — acquisition risk" |

---

### Tier 8: Revenue Dues & Financial Exposure (What else do I need to pay?)

| Data Point | What It Is | Buyer Question | Value to Buyer | Display Treatment |
|---|---|---|---|---|
| **revenueDuesOverdue** (insight) | Outstanding ₹ amount | Q6: What happens after I buy? | **Direct financial hit** — buyer may inherit | Hero 🔴: "⚠️ Outstanding dues: ₹5,000 (2023)" |
| **revenueDuesYear** (insight) | Year of dues | Q6 | Shows how old | Detail: "Dues from 2023" |
| **duesFieldMissing** (insight) | Dues unreadable | Q6 | Data gap | Hero ⏳: "Dues field not readable — verify at tehsil" |
| **stampDuty, registrationFee, cess, total** (Stamp Duty) | Transaction costs | Q6 | Helps estimate closing costs | Calculator (interactive): "If you pay ₹50L, stamp duty = ₹2.5L" |
| **bmv** (Stamp Duty) | Benchmark market value | Q4: Am I overpaying? | **Price sanity check** | Detail: "Govt circle rate: ₹6L/acre — your asking ₹15L = 2.5×" |
| **circleRate** (cached) | Govt rate per acre/sqft | Q4 | Benchmark | Detail table |
| **IGR Daily Bulletin** (IGR) | Recent sales in area | Q4 | **Comparable transactions** — the most valuable pricing signal | Detail: "5 sales in last 7 days, avg ₹12L/acre" |

---

### Tier 9: Zoning, Floods & Environmental Risks (Is this safe to build on?)

| Data Point | What It Is | Buyer Question | Value to Buyer | Display Treatment |
|---|---|---|---|---|
| **bdaZone** (cached) | BDA zoning | Q2 | **Critical** — industrial ≠ residential | Hero badge: "Residential" ✅ or "Industrial" 🔴 |
| **permittedUses, restrictions** (BDA) | What you can/cannot do | Q2 | Shows constraints | Detail |
| **floodFrequency** (Bhuvan) | Flood risk | Q2 | **Insurance + construction cost** | Hero badge: "Flood risk: Medium" with color |
| **layersProbed[]** (Bhuvan) | Which flood layers checked | Q2 | Provenance | Detail |
| **getFeatureInfoBlocked** (Bhuvan) | Server blocked | Q2 | Data gap | Detail: "Flood check blocked — manual verification required" |
| **PESA/CRZ/Forest** (RegulatoryScreener) | Zone restrictions | Q2 | **Dealbreakers** | Hero 🔴 each: "PESA zone — tribal land restrictions" |

---

### Tier 10: Validation & Cross-Checks (How confident are we?)

| Data Point | What It Is | Buyer Question | Value to Buyer | Display Treatment |
|---|---|---|---|---|
| **validationFindings[]** (orchestrator) | Cross-source mismatches | General | **Trust signal** — shows we checked multiple sources | Hero chip if any error; detail: "Village mismatch: Nominatim says Chandaka, Bhulekh says Mendhasala" |
| **confidence** (each interpreter) | 0–1 score | General | Shows how much to trust the finding | Small badge: "Confidence: 85%" (green if >70, amber if 40-70, red if <40) |
| **confidenceBasis** (each interpreter) | Why this confidence | General | Provenance | Detail, expandable |
| **sourceStatus** (each source) | success/manual_required/error | General | **The source health bar** | Source strip: show each source with status icon |
| **warnings[]** (each fetcher) | Parser warnings | General | Data quality flags | Detail: "Bhunaksha area truncated — may be incomplete" |
| **cacheServedAt** (fetchers) | Whether cached | General | Freshness | Tiny label: "(cached 2 days ago)" |

---

## Part 3: Display Treatment Patterns

### Pattern 1: The Hero Strip (top 400px, what they see in 3 seconds)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Mendhasala 309 • 10.5 acres • Khordha                     Record: 2018   │
├──────────────────────────────────────────────────────────────────────────┤
│ OWNER (from Bhulekh RoR)          │ LAND (from Bhulekh + BDA)            │
│───────────────────────────────────│──────────────────────────────────────│
│ Official: Krushnachandra Barajena │ Kisam: Agricultural (ଦଣ୍ଡା)          │
│ + 4 co-owners                     │ Zone: Residential ✅                 │
│                                    │ Conversion: Required 🟡 (₹1–3L)      │
├───────────────────────────────────│──────────────────────────────────────┤
│ VERDICT                            │ FINANCIAL EXPOSURE                  │
│───────────────────────────────────│──────────────────────────────────────│
│ 🔴 NAME MISMATCH (30% confidence)  │ Name dispute: ~₹5–10L (consideration)│
│    Barajena ≠ Mohapatra            │ Conversion fee: ~₹1–3L               │
│                                    │ EC gap: unknown (mortgages may exist)│
│ 🟡 5 CO-OWNERS                     │                                      │
│    All must sign to transfer       │ Total at-risk: ~₹8–13L              │
│                                    │ Verified-clear: ₹0                   │
│ ⏳ EC NOT RETRIEVED                │                                      │
│    Visit igrodisha.gov.in           │                                      │
└───────────────────────────────────│──────────────────────────────────────┘
```

### Pattern 2: Source Status Strip (below hero, 1 row)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ SOURCE STATUS   ✅ Bhulekh 85%  │ ✅ Bhunaksha 60%  │ ✅ eCourts 70%  │ ⏳ IGR 0% │
└──────────────────────────────────────────────────────────────────────────┘
```

### Pattern 3: The 6-Q Grid (above the fold, interactive tiles)

```
┌─────────────┬─────────────┬─────────────┬─────────────┬─────────────┬─────────────┐
│ Q1          │ Q2          │ Q3          │ Q4          │ Q5          │ Q6          │
│ Does seller │ Can I build?│ Could I     │ Am I        │ Will this   │ What after  │
│ own this?   │             │ lose it?    │ overpaying? │ develop?    │ I buy?      │
│─────────────│─────────────│─────────────│─────────────│─────────────│─────────────│
│ 🔴 RISK     │ 🟡 WATCHOUT │ ⏳ GAP      │ ⏳ GAP      │ ⏳ GAP      │ ⏳ GAP      │
│ 2 red flags │ 1 watchout  │ EC not      │ Manual      │ Manual      │ Manual      │
│             │             │ retrieved   │ verification│ verification│ verification│
│─────────────│─────────────│─────────────│─────────────│─────────────│─────────────│
│ Name        │ Conversion  │ Get EC from │ Check       │ BDA Master  │ Pay stamp   │
│ mismatch    │ required    │ IGR portal  │ circle rate │ Plan 2030   │ duty, file  │
│             │             │             │             │             │ mutation    │
└─────────────┴─────────────┴─────────────┴─────────────┴─────────────┴─────────────┘
```

On mobile: 2×3 grid, tap to expand detail.

### Pattern 4: Insight Rows (inside each Q detail panel)

For each insight that maps to that Q, render:

```
┌──────────────────────────────────────────────────────────────────────────┐
│ 🔴 NAME MISMATCH — ROR-INS-024                                           │
│ The official Bhulekh RoR shows the owner as "Krushnachandra Barajena",  │
│ but your seller claimed "Mohapatra". This is a significant discrepancy.  │
│                                                                          │
│ What to ask the seller:                                                  │
│ "Why does your name differ from the Bhulekh record? Can you produce a    │
│  power of attorney or sale deed linking you to this plot?"              │
│                                                                          │
│ ▶ How we checked this (tap to expand)                                   │
│   • What we checked: Bhulekh RoR page 1, owner field (ସ୍ୱାର୍ଥୀ)          │
│   • How to verify: Visit bhulekh.odisha.gov.in, search by plot 309      │
│   • Limits: Name matching uses phonetic similarity — may miss variants   │
│   • Evidence strength: selected_plot_anchor (high)                       │
│   • Parser confidence: 85% (field parsed cleanly)                        │
│   • Source: https://bhulekh.odisha.gov.in/RecordOfRights...              │
└──────────────────────────────────────────────────────────────────────────┘
```

### Pattern 5: Exposure Summary (new panel, between verdict and Q-grid)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ FINANCIAL EXPOSURE SUMMARY                                                │
├──────────────────────────────────────────────────────────────────────────┤
│ Verified-clear exposure: ₹0                                               │
│   No encumbrances, no court cases, no dues                               │
│                                                                          │
│ At-risk exposure: ~₹8–13L                                                │
│   • Name dispute risk: ₹5–10L (full consideration at risk if title     │
│     contested)                                                            │
│   • Conversion fee: ₹1–3L (agricultural → residential, 12–24 months)    │
│   • Multi-party consent risk: Deal stalls if any co-owner dissents       │
│                                                                          │
│ Unquantified exposure:                                                   │
│   • EC gap: Mortgages or court entries may exist — manual verification  │
│     required (visit igrodisha.gov.in, cost ~₹30–50)                      │
└──────────────────────────────────────────────────────────────────────────┘
```

### Pattern 6: Narrative Stitching (derived from multiple data points)

**Narrative 1: "The ownership story"**
- Combine: `officialOwnerName` + `nameMatch` + `coOwners[]` + `mutationHistory[]`
- Text: "This plot is owned by Krushnachandra Barajena and 4 co-owners (Pratima, Subhra, Gaur, Sunita). The last recorded mutation was in 2018. However, your seller claims the name 'Mohapatra', which doesn't match the Bhulekh record. Ask the seller to explain this difference."

**Narrative 2: "The buildability story"**
- Combine: `primaryKisam` + `primaryCategory` + `conversionRequired` + `cluFeeEstimate` + `bdaZone`
- Text: "This land is classified as agricultural irrigated (ଦଣ୍ଡା). To build a house, you'll need to convert it to residential use via the Revenue Department. Estimated cost: ₹1–3L, timeline: 12–24 months. The BDA zone is residential, so once converted, you can build."

**Narrative 3: "The risk story"**
- Combine: `courtCases.total` + `igrEcEntries` + `cersaiCharges[]` + `encumbranceReasoner.status`
- Text: "No court cases were found against the owner or plot. However, the encumbrance certificate was not retrieved — there may be mortgages or court attachments we don't know about. Visit igrodisha.gov.in to get the EC before paying."

**Narrative 4: "The pricing story"**
- Combine: `consideration` (from IGR EC) + `bmv` (circle rate) + `IGR Daily Bulletin` (recent sales)
- Text: "The last sale on this plot was in 2019 for ₹8L (₹0.76L/acre). The government circle rate is ₹6L/acre. Recent sales in this area (last 7 days) averaged ₹12L/acre. If you're paying ₹50L, you're at a 4–6× premium to recent comps."

---

## Part 4: What NOT to Show

| Data Point | Why Not to Show |
|---|---|
| `casteOdia` | Sensitive, irrelevant to purchase decision |
| `rawArtifactHash`, `parserVersion`, `templateHash` | Internal provenance, lawyer-only |
| `inputsTried[]`, `attempts[]`, `retryAttempts[]` | Debug info, not buyer-facing |
| `geometryHash`, `featureId`, full `polygon` GeoJSON | Internal coordinates, not meaningful |
| `mapImageBase64` (large base64) | Bandwidth, Layer 2 only |
| `backPageScreenshot`, `frontPageScreenshot` | Provenance for lawyers, not buyers |
| `ocrText`, `captchaImageHash`, `captchaAttempts` | Internal debugging |
| `pageHash` per CERSAI attempt | Internal |
| `matchedTenantIndex`, `claimState`, `readiness (L0–L4)` | Internal confidence tiers |
| `matchReasons[]`, `blockingWarnings[]` | Internal, surfaced as severity instead |
| `ownerBlockRawOdia`, `tenantBlockRawOdia` | Raw Odia, provenance only |

---

## Part 5: Implementation Priority

1. **Hero strip** — property identity + verdict + exposure (3 columns)
2. **Source status strip** — confidence % per source
3. **6-Q grid** — with red/watch/pos counts and leading headline
4. **Exposure summary panel** — verified-clear vs at-risk vs unquantified
5. **Insight rows** — with "How we checked" disclosure (schema already has it)
6. **Narrative stitching** — 4 narratives derived from combined data points

All within 1–2 pages, mobile-first, no scores, no "safe to buy" language.
