# ClearDeed Report — End-User Value & Showcase Strategy

**Date:** 2026-06-22
**Status:** Brainstorming — no implementation yet
**Goal:** Map every data point we extract to its end-user value, then design the showcase. Think from a Khordha buyer's perspective: what do they need to see, in what form, to make a decision in 2 minutes?

---

## Part 1: The Buyer — Real Humans, Real Decisions

### Primary persona: "First-time land buyer in Khordha"

- **Age:** 28–45
- **Background:** Salaried professional or small-business owner. Middle class. Has ₹30L–₹1Cr to spend.
- **Tech comfort:** WhatsApp-native, Google-search-comfortable, not app-literate, doesn't read long forms
- **Legal literacy:** Near zero. Doesn't know "mutation", "encumbrance", "kisam", "khata", "EC"
- **Time pressure:** 1–7 days before paying. Broker is pushing. Family is asking.
- **Trust anchors:** Government seals, official documents, anything that "looks like a website"

### The decision

This person is asking: **"Should I pay ₹50L for this plot tomorrow?"** The report has 2 minutes to help them decide, or it's noise.

### What they need to walk away with

1. **Trust signal** — "These people know what they're doing. I trust this report."
2. **Critical signal** — "There's something wrong. Walk away."
3. **Action signal** — "Here's what to ask the seller / lawyer / tehsildar."
4. **Coverage signal** — "Here's what we couldn't check. Go verify manually."

### What they don't need

- A 30-page legal document
- Legal jargon without translation
- A "safe to buy" score (they don't trust a number for this)
- A wall of "Manual verification required" 20 times
- Hidden technical details that look authoritative but they can't read

---

## Part 2: Every Data Point → End-User Value → Display Treatment

I'm going to walk through every data point we extract, grouped by what the buyer is trying to learn.

### Group 1: "Is this the right plot?" (Identity)

| Data | What it is | What it means to buyer | Display |
|---|---|---|---|
| **Plot number** (Bhulekh) | Survey number | Confirms the GPS we found = the right plot | Hero: "Plot 309" |
| **Plot number** (Bhunaksha) | Cadastral number | Cross-check — same plot? | Hero badge: "✓ Bhunaksha confirms" or "⚠️ Bhunaksha shows #" |
| **Village** (Bhulekh) | Revenue village | Local identity | Hero sub: "Mendhasala, Bhubaneswar" |
| **Tahasil + District** | Administrative hierarchy | Confirms Khordha | Hero sub: "Bhubaneswar, Khordha" |
| **Area (acres/decimals)** | Plot size | Sanity check on broker's claim | Hero: "10.5 acres" + ⚠️ if Bhulekh ≠ broker claim |
| **Khata number** | Revenue account # | Not meaningful to buyer but referenced everywhere | Hero footnote: "Khata 830" |
| **Last updated** (Bhulekh) | When RoR was generated | Old = needs re-verification | Hero: "RoR generated 12-Mar-2024" |
| **GPS source** (Nominatim) | How location was found | Provenance | Footnote: "📍 Reverse-geocoded from your GPS" |
| **Bunaksha area vs Bhulekh area** | Two sources, one truth | If different, ask the seller why | Hero: "📐 Areas match" or "📐 ⚠️ 10% mismatch" |
| **Bunaksha polygon** | The actual shape | Visual — let buyer see the plot | Hero: 🗺️ Map thumbnail (click to expand) |

**Display principle for identity:** Show the plot "card" in the hero with 3 lines max:
- Line 1: Plot number + size + village (the "what")
- Line 2: Last updated + last touched by (the "freshness")
- Line 3: Map thumbnail (the "where")

### Group 2: "Does the seller actually own this?" (Ownership)

| Data | What it is | What it means to buyer | Display |
|---|---|---|---|
| **Owner name on RoR** | The recorded owner | The ground truth | Hero tile: "👤 Owner: Krushna Barajena" + 🔴 if mismatch with seller claim |
| **Owner name transliterated** | Odia → Latin | Helps buyer read | Same line, smaller: "(Krushnachandra Barajena)" |
| **Father's name** | Guardian | Distinguishes same-name people | Hero tile footnote: "Father: Pratima" |
| **Co-owners** | Other people on the record | All must consent to sell | Hero tile: "👥 5 co-owners" + 🔴 if >1, click to expand list |
| **Name match** | Seller vs RoR | **The most important signal** | Hero verdict: "✓ Match" / "⚠️ Mismatch" / "⏳ Not provided" |
| **Match confidence** | 0-100% | How sure we are | Confidence badge: "85% match" — show in 4 buckets: ≥90 green, 70-89 yellow, 50-69 amber, <50 red |
| **Match basis** | Why we matched | Shows our reasoning | Detail panel: "Matched on surname + 2 letter overlap. Father name not provided." |
| **Residence of owner** | Where owner lives | If far from plot → impersonation risk | Q1 detail: "Owner lives in Cuttack, plot is in Khordha. 25 km. ⚠️ Verify with local SRO." |
| **Caste** (sensitive) | Reserved category flag | Transferability check, not identity | Detail: "Owner: SC category. Reserved land transfer rules apply per Odisha Land Reforms Act §22. Verify with tehsildar." |
| **EOW blacklist match** | Plot or owner on EOW list | **CRITICAL** — fraud pattern | Hero with red border: "🛑 STOP — Plot on EOW blacklist (Surya Nirman pattern)" |

**Display principle for ownership:** The most important question in the report. Lead with it. Show:
- Owner name (or "Source not retrieved" if missing)
- Match status (icon + text)
- Co-owner count
- If anything red: stop the line, take the page

### Group 3: "Can I build my house here?" (Land use)

| Data | What it is | What it means to buyer | Display |
|---|---|---|---|
| **Kisam** (land class) | Agricultural / homestead / forest | Determines if you can build | Hero: "🌾 Agricultural" / "🏠 Homestead" / "🌲 Forest (cannot build)" |
| **Conversion required** | Must get Revenue Dept approval? | If yes, 6-18 months delay + ₹1-3L | Hero badge: "Conversion required 🟡" with timeline |
| **Conversion fee estimate** | ₹1-3L typically | Hidden cost | Detail panel: "Conversion cost: ~₹1-3L, timeline 6-18 months" |
| **BDA zone** | Residential / commercial / industrial | **Critical** — industrial ≠ residential | Hero: "Zone: Residential ✅" / "Zone: Industrial 🔴" |
| **Permitted uses** (BDA) | What's allowed | Sets future value | Detail: "Permitted: residential, commercial. Not permitted: industrial." |
| **Restrictions** | Forest / CRZ / PESA / sub-plot | **Dealbreakers** | Each as a row: "🔴 Forest zone — cannot build" |
| **Flood zone** | Bhuvan frequency | Insurance + construction cost | Hero badge: "Flood: Low / Medium / High" with color |
| **Airport height** | Height restriction | Only matters for tall buildings | Detail: "Height limit: 30m" |
| **ASI buffer** | Heritage zone | Special rules | Detail: "100m from monument X" |
| **Chandaka-Dampara buffer** | Forest | No construction | Hero 🔴: "🛑 Inside Chandaka-Dampara buffer" |

**Display principle for land use:** Show 3 lines in the hero:
- Line 1: Kisam + BDA zone (the "what type")
- Line 2: Conversion status + fee (the "what it costs to change")
- Line 3: Restrictions (any 🔴) + flood zone

If restrictions fire, show them prominently — they're often dealbreakers.

### Group 4: "Could I lose it after paying?" (Title security)

This is the highest-anxiety group. The buyer has just paid money; can they still lose the plot?

| Data | What it is | What it means to buyer | Display |
|---|---|---|---|
| **EC available** | Did we get the Encumbrance Certificate? | If no, we don't know about mortgages | Q3 hero: "✅ EC retrieved, 30 years clean" or "⏳ EC not retrieved" |
| **EC clean period** | Years with no encumbrances | Trust signal | Q3: "30 years clear (1994-2024)" |
| **Active mortgage** | Bank has a lien on the plot | Must be cleared before sale | Q3: "🔴 SBI mortgage: ₹12L outstanding. Get NOC before paying." |
| **Court case** | Pending case against the owner | Title dispute | Q3: "🔴 1 case pending in Bhubaneswar Civil Court" |
| **Court case type** | Civil / criminal / revenue | Severity varies | Detail: "Civil suit (2023) — title dispute. Pending." |
| **Court case parties** | Who's involved | If owner is party → risk | Detail: "Petitioner: Mohanty. Respondent: Barajena (owner)." |
| **Court hearing date** | Next hearing | Shows case is alive | Detail: "Next hearing: 15-Aug-2026" |
| **CERSAI charge** | Secured asset on plot | Same as mortgage | Q3: "🔴 ICICI charge: ₹8L" |
| **RCCMS revenue case** | Tax / land revenue dispute | Specific to Khordha | Q3: "⏳ RCCMS not retrieved (structurally unavailable)" |
| **Back page encumbrances** | Bank names / case refs on RoR page 2 | High-value signal | Q3: "📋 RoR page 2 lists SBI reference. Verify discharge." |
| **Back page mutation refs** | History of case numbers | Shows chain of disputes | Detail: "Mutations: CASE-2020-1234 (sale), CASE-2023-5678 (gift deed)" |
| **Lis pendens** | Property is subject of pending case | Cannot transfer | Q3: "🔴 Lis pendens registered" |
| **ST/SC restrictions** | Scheduled tribe/tribal land | Cannot buy if you're non-tribal | Hero 🔴: "🛑 ST land — non-tribal buyers prohibited" |
| **EOW attachment** | Attached by Economic Offences Wing | Cannot transact | Hero 🔴: "🛑 EOW-attached property" |

**Display principle for title security:** This is where the buyer is most afraid. The display must:
- Lead with the verdict ("✅ Title clean" or "🔴 3 risks")
- Show the worst case first
- Explain the action: "Get NOC from SBI before token"
- If unknown: "We couldn't check this — here's how to check manually"

### Group 5: "Am I overpaying?" (Price validation)

| Data | What it is | What it means to buyer | Display |
|---|---|---|---|
| **IGR benchmark** | Govt circle rate for the area | Floor — anything below is suspicious | Q4: "IGR benchmark: ₹6L/acre" |
| **Asking price** | What seller wants | If buyer provides it | Q4: "Asking: ₹50L (8× benchmark)" |
| **Premium %** | Asking vs benchmark | How much over the floor | Q4: "⚠️ 8× IGR benchmark — typical premium 1.5-2×" |
| **Recent IGR daily bulletin** | Sales in last 7 days | Most trustworthy comp | Q4: "5 sales in last 7 days, avg ₹12L/acre" |
| **Stamp duty + registration** | Govt fees | Hidden closing cost | Detail: "Stamp duty: 5% (₹2.5L) + Reg: 1% (₹50K)" |
| **Last sale price** | What this plot sold for last | True comparable | Detail: "Last sold in 2019 for ₹8L (₹0.76L/acre)" |
| **Property tax** | Annual tax | Recurring cost | Q6: "Annual tax: ~₹2K" |

**Display principle for price:** Show the math.
- IGR benchmark (floor)
- Asking (if provided)
- Recent sales (real comparables)
- Stamp duty (closing cost)
- The "premium" calculation only as a sanity check, never a number to act on

### Group 6: "Is the area going to develop or decay?" (Future value)

| Data | What it is | What it means to buyer | Display |
|---|---|---|---|
| **BDA Master Plan 2030** | Zoning plan | What's planned here | Q5: "Master Plan: Residential" |
| **Metro corridor** | Distance to planned station | Price impact | Q5: "Metro (proposed): 1.2 km" |
| **LARR notifications** | Land acquisition pending | Govt may take it | Q5: "No acquisition notification" |
| **Walkability** | Schools/hospitals within 1km | Quality of life | Q5: "Schools: 3 within 1km, Hospital: 1 within 2km" |
| **Civic proximity** | Hospital, fire station, police | Safety | Detail: "Police station: 0.8 km" |
| **Industrial nearby** | Factory / plant within 1km | Pollution, value impact | Q5: "⚠️ Industrial zone 500m north" |

**Display principle for trajectory:** Soft signals. Don't lead with these. Show only the ones that materially change the picture.

### Group 7: "What happens after I buy?" (Post-purchase)

| Data | What it is | What it means to buyer | Display |
|---|---|---|---|
| **Mutation process** | How to update the RoR | Mandatory | Q6: "Mutation: file at tehsil, ~3-6 months, ~₹2K" |
| **Property tax** | Annual to BMC | Recurring | Q6: "Annual tax: ~₹2K" |
| **EC concierge** | Service to get EC | We offer it | Q6: "Need an EC? Get one for ₹499" |
| **Civic dues** | Water, electricity transfer | Often forgotten | Q6: "⚠️ Verify PHED + TPCODL dues" |
| **Holding cost** | EMI / opportunity cost | Mental model | Detail: "Holding cost at 8% for 6 months: ₹2L" |

**Display principle for post-purchase:** Don't lead with these. The buyer wants to know "do I buy?" first; "what after?" comes second. But make them findable.

---

## Part 3: Trust & Provenance — How to Make "We Did the Work" Visible

The biggest trust unlock is showing our work. Every fact should have a fingerprint.

| Data | What it is | What it means to buyer | Display |
|---|---|---|---|
| **Source URL** | Where the data came from | Buyer can verify | "Source: bhulekh.ori.nic.in" + click-through |
| **Fetched at** | When we retrieved | Freshness | "Retrieved 2 hours ago" |
| **Raw artifact hash** | SHA256 of the page we saw | Immutable proof | "🔒 Hash: 7a3f9b2c... (immutable)" + copy button |
| **Parser version** | Code that extracted the data | We maintain our parsers | "🔧 Bhulekh v3.2" |
| **Captcha attempts** | How many tries it took | AI has limits | "🔁 2/3 captcha attempts accepted" |
| **OCR confidence** | For image-based data | Honest about uncertainty | "🤖 OCR confidence: 78%" |
| **Template hash** | Did the source change? | Detects drift | "📐 Page layout matched (2026-05-13)" |
| **Inputs tried** | What we searched | We're thorough | "🔍 Searched Plot 309 → then Khata 94" |
| **Cache served at** | Was it cached? | Freshness | "💾 Cached 2 days ago" |
| **Raw Odia** | The actual original text | Ground truth | "📜 କୃଷ୍ଣଚନ୍ଦ୍ର ବଡ଼ଯେନା" (paired with English) |
| **Screenshot of source page** | The actual page we saw | Visual proof | "📷 View Bhulekh page" button → modal/lightbox |
| **Warnings from parser** | "Page 2 truncated", "OCR confidence low" | We tell you what's uncertain | "⚠️ Warnings: 1 (page 2 OCR low confidence)" |
| **Map image** | Cadastral map | Visual | Embedded inline |

**The universal trust strip:** Every fact in the report should have a small expandable block:
```
📍 bhulekh.ori.nic.in · ⏱ 2h ago · 🔒 hash 7a3f9b · 🔧 v3.2 · 🔁 1/1 · 📐 2026-05-13
   [tap to expand: full URL, all attempts, warnings, view page]
```

This is the **Trust Mechanism 1** from CLAUDE.md. Not a single "Verify yourself" button — every fact has provenance.

---

## Part 4: Fraud Pattern Intelligence — The Buyer-Recognizable Tests

Buyers in Khordha know about Surya Nirman. They want to know: "Did you check for Surya Nirman?" The answer should be visible.

### The 5 Khordha patterns (from CLAUDE.md)

| # | Pattern | What it means to buyer | Display |
|---|---|---|---|
| 1 | **Patia Industrial-Lease** | Lease land resold as freehold | Hero band: "🛑 Tested Patia lease scam — ✅ not triggered" or "🛑 TRIGGERED — see ROR-INS-180" |
| 2 | **Surya Nirman Multi-Investor** | EOW-attached property | Hero band: "🛑 Tested EOW blacklist — ✅ clear" or "🛑 TRIGGERED — Surya Nirman pattern" |
| 3 | **Malipada Impersonation** | Absentee owner impersonated | Hero band: "🛑 Tested impersonation — ✅ seller matches owner" or "🛑 TRIGGERED — seller ≠ owner" |
| 4 | **Industrial Zone Sold as Residential** | Industrial land sold for houses | Hero band: "🛑 Tested industrial-zone fraud — ✅ Residential zone" or "🛑 TRIGGERED — plot in industrial zone" |
| 5 | **Sub-plot without BDA approval** | Subdivided without permission | Hero band: "🛑 Tested BDA layout approval — ✅ clean" or "🛑 TRIGGERED — sub-plot indicator on RoR" |

### The "Tested Fraud Patterns" panel

Even when all 5 pass, the panel itself is a trust signal:

```
┌────────────────────────────────────────────────────────────────────────┐
│ TESTED FRAUD PATTERNS (Khordha 2024–2026)                              │
├────────────────────────────────────────────────────────────────────────┤
│ 1. Patia Industrial-Lease Scam     ✅ Not triggered                     │
│    Check: IGR RLD prefix on a Sthitiban/Raiyati khata                  │
│    Result: No lease indicator, RoR shows private ownership             │
│    Source: bhulekh.ori.nic.in                                          │
│    Tested: 2026-05-13 14:23                                           │
│                                                                        │
│ 2. Surya Nirman Multi-Investor     ⚠️ TRIGGERED                        │
│    Check: EOW blacklist cross-reference                                │
│    Result: Plot 309 is on the EOW-attached list                        │
│    → Action: Walk away. Get a lawyer. See ROR-INS-210.                │
│    Source: khordha_eow_blacklist.json (refreshed 2026-05-01)          │
│    Tested: 2026-05-13 14:23                                           │
│                                                                        │
│ 3. Malipada Impersonation          ✅ Not triggered                    │
│    Check: Seller address vs plot district + PoA on record              │
│    Result: Owner and seller both in Mendhasala, no PoA needed          │
│    Source: bhulekh.ori.nic.in + IGR                                    │
│    Tested: 2026-05-13 14:23                                           │
│                                                                        │
│ 4. Industrial-Zone Sold as Resi    ✅ Not triggered                    │
│    Check: BDA Master Plan zone                                         │
│    Result: Residential zone verified                                   │
│    Source: bda.gov.in (BDA Master Plan 2030)                           │
│    Tested: 2026-05-13 14:23                                           │
│                                                                        │
│ 5. Subdivided Plot w/o BDA Layout  ✅ Not triggered                    │
│    Check: Sub-plot indicator + BDA approval                            │
│    Result: Plot 309, no sub-plot indicator, BDA approval on file       │
│    Source: bhulekh.ori.nic.in + BDA                                    │
│    Tested: 2026-05-13 14:23                                           │
└────────────────────────────────────────────────────────────────────────┘
```

**This panel alone is huge for trust.** It says: "We know the local scams. We tested this plot against each one. Here's what we found."

---

## Part 5: Report Structure — Putting It All Together

### Mobile-first flow (the buyer's path)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ HERO STRIP                                                              │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ Plot 309 · 10.5 acres · Mendhasala                                  │ │
│ │ 👤 Owner: Krushna Barajena  + 4 co-owners                           │ │
│ │ ⚠️ Name mismatch: seller ≠ owner (3-letter overlap only)            │ │
│ │ 🌾 Agricultural · Zone: Residential · BDA ✅                        │ │
│ │ 🛑 Patia lease scam: ✅ EOW blacklist: ✅ ... 5 of 5 tested         │ │
│ │ [Share with lawyer] [Download PDF] [View sources]                    │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│ TESTED FRAUD PATTERNS — 5 panels, expandable                           │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ 1. Patia Lease            ✅ Not triggered       [tap to expand]     │ │
│ │ 2. Surya Nirman EOW       ⚠️ TRIGGERED (CRITICAL)  [tap to expand]  │ │
│ │ 3. Malipada Impersonation ⚠️ Watch-out           [tap to expand]    │ │
│ │ 4. Industrial-Zone        ✅ Not triggered       [tap to expand]     │ │
│ │ 5. Sub-plot w/o BDA       ✅ Not triggered       [tap to expand]     │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│ 6 Q-TILES (2x3 grid on mobile)                                          │
│ ┌────────────────┬────────────────┬────────────────┐                   │
│ │ Q1             │ Q2             │ Q3             │                   │
│ │ Does seller    │ Can I build    │ Could I lose   │                   │
│ │ own this?      │ here?          │ it after pay?  │                   │
│ │ 🔴 RISK        │ 🟡 WATCHOUT    │ ⏳ GAP         │                   │
│ │ 1 red flag     │ 1 watchout     │ EC not         │                   │
│ │                │                │ retrieved      │                   │
│ │ Name mismatch  │ Conversion     │ Visit IGR for  │                   │
│ │                │ required       │ 30-year EC     │                   │
│ ├────────────────┼────────────────┼────────────────┤                   │
│ │ Q4             │ Q5             │ Q6             │                   │
│ │ Am I           │ Will the area  │ What after     │                   │
│ │ overpaying?    │ develop?       │ I buy?         │                   │
│ │ ...            │ ...            │ ...            │                   │
│ └────────────────┴────────────────┴────────────────┘                   │
│                                                                         │
│ Q-DETAIL SECTIONS (6 sections, one per Q)                              │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ Q1: Does the seller actually own this?                              │ │
│ │ ❌ MISMATCH — see ROR-INS-024                                       │ │
│ │                                                                      │ │
│ │ ┌──────────────────────────────────────────────────────────────────┐ │ │
│ │ │ 📋 Owner block (Bhulekh RoR)                                     │ │ │
│ │ │   👤 Krushnachandra Barajena (S/o Pratima)                      │ │ │
│ │ │   👥 Co-owners: Pratima, Subhra, Gaur, Sunita                   │ │ │
│ │ │   📜 Original Odia: କୃଷ୍ଣଚନ୍ଦ୍ର ବଡ଼ଯେନା ସ୍ୱାର୍ଥୀ ପ୍ରତିମା       │ │ │
│ │ │   ⚖️ Transferability: SC category (Odisha §22 rules)            │ │ │
│ │ │   📍 bhulekh.ori.nic.in · ⏱ 2h ago · 🔒 7a3f9b2c · 🔧 v3.2     │ │ │
│ │ │   [View source page] [Show full Odia]                            │ │ │
│ │ └──────────────────────────────────────────────────────────────────┘ │ │
│ │                                                                      │ │
│ │ 🔴 Sub-findings:                                                    │ │
│ │   • Seller ≠ RoR owner (ROR-INS-024)                                │ │
│ │   • 5 co-owners — all must sign (ROR-INS-022)                       │ │
│ │   • Owner residence in Cuttack, 25 km from plot (ROR-INS-026)      │ │
│ │   • Matches Malipada impersonation pattern (PAT-3)                   │ │
│ │                                                                      │ │
│ │ → What to do:                                                       │ │
│ │   1. Ask seller to produce a registered sale deed or PoA            │ │
│ │   2. Video KYC the seller and contact RoR owner directly            │ │
│ │   3. Get a lawyer to verify chain of title                          │ │
│ │   4. ⏳ Do not pay until chain is verified                          │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│ (5 more Q-detail sections, expandable, each with:                       │
│  - Source-trust strip                                                  │
│  - Raw Odia paired with English                                        │
│  - All sub-findings with rule IDs                                      │
│  - Pattern attribution                                                │
│  - Action items)                                                       │
│                                                                         │
│ FOOTER: Public records only. Verify with a lawyer before transacting. │
└─────────────────────────────────────────────────────────────────────────┘
```

### Pattern attribution (linking insights → scams)

Every insight that maps to a known fraud pattern gets a chip:

```
🔴 Name mismatch
   Matches Pattern 3: Malipada Impersonation Scam (2020-2023)
   See tested-patterns panel #3 for the test that fired this.
```

This is the bridge between technical insights and buyer-recognizable scams. The buyer reads "Malipada" and knows exactly what's at risk.

### What NOT to show

Some data points, despite being extractable, are NOT useful to the buyer:

| Data | Why hide |
|---|---|
| **Caste** (as identity) | Sensitive, irrelevant to purchase decision. **Show as transferability flag** instead. |
| **Raw HTML** | Internal parser input |
| **`pageHash` per attempt** | Internal |
| **`captchaImageHash`** | Internal — has no meaning to buyer |
| **`matchedTenantIndex`** | Internal confidence tier |
| **`claimState`, `readiness (L0–L4)`** | Internal — show as severity instead |
| **`matchReasons[]`** | Internal — show as "85% match" badge instead |
| **`ownerBlockRawOdia`** | Provenance only — show `rawOdia` as paired field instead |
| **Internal codes (ROR-INS-XXX)** | Keep visible in sub-finding rows so the lawyer can reference. Hide from the hero. |

---

## Part 6: The "Two Minutes" Test

A buyer with 2 minutes will scroll the report in this order:

**Second 1-5: HERO**
Reads: "Plot 309, 10.5 acres, Mendhasala. Owner Krushna Barajena. ⚠️ Mismatch with seller. 4 co-owners. BDA Residential. 5 fraud patterns tested, 1 triggered."
Decision: "Oh, there's a problem. Let me look more."

**Second 5-20: TESTED FRAUD PATTERNS**
Sees: "1. Patia ✅, 2. Surya Nirman EOW ⚠️ TRIGGERED, 3. Malipada ⚠️, 4. Industrial ✅, 5. Sub-plot ✅"
Decision: "Pattern 2 and 3 are scary. This might be the Malipada case I read about."

**Second 20-60: 6 Q-TILES**
Clicks Q1 (Does seller own this? — Risk). Sees: "1 red flag — name mismatch. Get sale deed."
Decision: "I need a sale deed. Let me ask the seller."

**Second 60-90: Q1 DETAIL**
Reads: "Owner Krushna Barajena (S/o Pratima), 4 co-owners, all in Mendhasala. Seller claims 'Prakash Mohapatra' — only 3-letter overlap. Owner lives in Cuttack 25km away. Original Bhulekh shows Odia: କୃଷ୍ଣଚନ୍ଦ୍ର ବଡ଼ଯେନା. Trust strip: retrieved 2h ago, hash 7a3f9b2c, parser v3.2."
Decision: "This is the Malipada pattern. I'm not paying until I see the sale deed."

**Second 90-120: ACTION ITEMS**
Reads: "1. Ask seller for registered sale deed 2. Video KYC 3. Get a lawyer 4. Do not pay until chain verified."
Decision: "I'm calling the seller tomorrow. If they can't produce a sale deed, I'm walking away."

That's the 2-minute path. The buyer walks away with **clarity, not a score.**

---

## Part 7: Implementation Priority

What I'd build, in order:

| # | What | Why | Effort |
|---|---|---|---|
| 1 | **Tested Fraud Patterns panel** (already exists in `components/tested-patterns.ts` — wire into Q-grid page above the Q-grid) | Single biggest trust unlock. Buyers recognize local scams. | 1 hour (wiring) |
| 2 | **Universal trust strip on every fact** (renderer work; mapper already plumbed via T13) | CLAUDE.md Trust Mechanism 1. Every fact has provenance. | 3-4 hours |
| 3 | **Source-by-source detail cards** (Bhulekh card, eCourts card, etc.) | One place to see what came from where, with confidence and hash | 4-5 hours |
| 4 | **Pattern attribution chips on insights** (link ROR-INS-024 → "Malipada impersonation") | Make the bridge between technical rules and recognizable scams | 2 hours |
| 5 | **Q-tile enrichment** (red/watch/pos tally + leading headline) | Each Q-tile becomes a one-glance summary | 2 hours |
| 6 | **Insight detail rows** (icon + headline + body + action + "How we checked" disclosure) | Inside each Q-detail, show one row per insight with full transparency | 3-4 hours |
| 7 | **Action items section** at the bottom (3-5 most important things to do) | The "what to do tomorrow" | 2 hours |

**Total: ~16 hours of design + code.** I estimate 1.5-2 days of focused work.

### What I would NOT build (out of scope for this round)

- A source-by-source drill-down panel (lawyer layer exists)
- An overall score ("safe to buy" or "confidence 87%")
- A "purchase recommendation"
- A money exposure panel (user explicitly said no ₹)
- A money exposure model (we have IGR data, but the user said no ₹)
- New fetcher work (T-041, T-042, T-044, T-045, T-046) — already on the roadmap

---

## Part 8: Open Questions for You

Before I code, I want your call on:

1. **Hero placement** — fraud patterns panel ABOVE the 6 Q-tiles, or BELOW them, or in a separate tab?
   My recommendation: ABOVE Q-tiles. The patterns ARE the buyer's question. Q1 is "does the seller own this?" which is exactly what Malipada tests.

2. **Pattern attribution** — show the pattern name on every insight chip, or only when it fires?
   My recommendation: Only when it fires. If a buyer is reading an insight that matches "Malipada impersonation", that's high-value. If every insight had a pattern name, it'd be noise.

3. **Caste display** — show as transferability flag (recommended) or hide entirely?
   My recommendation: Transferability flag with the legal basis cited. Buyers should know if reserved-land rules apply — it's a real legal constraint, not a bias.

4. **Sensitive data** — which other "internal" fields should we surface? (I propose: hash, parser version, raw Odia, captcha attempts, OCR confidence, source URL.)
   My recommendation: All of those. They build trust through transparency.

5. **What to call the report's "buyer"** — the user reading it on /report/[id]? The family member? The lawyer?
   My recommendation: The buyer themselves. Lawyers have the lawyer layer. Family members see the same report.

---

## What I want from you

One of three:

**A. Green light** — "Build all 7 items in priority order"
**B. Pick a subset** — "Do items 1-3, skip 4-7"
**C. Reorder** — "Do 5, 1, 4, 2, 3, 6, 7"

I'll wait for your call. No implementation in this turn.
