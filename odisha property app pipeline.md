# Odisha Property App — Automated Data Pipeline

## From Initial Inputs → Sale Deeds + All Other Sources

-----

## The Core Question: Can Bhulekh Data Fetch Sale Deeds?

**Yes.** Here is why it works:

When a sale deed is registered at an Odisha Sub-Registrar Office (SRO), the system automatically transmits a mutation trigger to the Tehsil via e-Mutation software (LRMS). This means:

```
Registered Deed at IGR  ←→  Mutation Case in ROR (Bhulekh)
```

Every mutation case number in ROR Section 6 corresponds to a registered deed in IGR Odisha. The mutation year tells you when the deed was registered. The village + plot number from Bhulekh are the same property identifiers used in IGR’s EC search.

**This is the bridge.**

-----

## Starting Inputs (What Your App Takes)

```
district       → e.g. "Khordha"
tehsil         → e.g. "Bhubaneswar"
village/mouza  → e.g. "Mendhashala"
plot_no        → e.g. "181/10454"   (OR)
khatiyan_no    → e.g. "607/4545"
```

-----

## Complete Pipeline: What You Get and From Where

```
┌─────────────────────────────────────────────────────────────────┐
│  INPUT: district + tehsil + village + plot_no / khatiyan_no     │
└──────────────────────┬──────────────────────────────────────────┘
                       │
          ┌────────────▼────────────┐
          │   SOURCE 1: BHULEKH     │  bhulekh.ori.nic.in
          └────────────┬────────────┘
                       │ EXTRACTS:
                       ├─ owner_name(s), father_name, caste
                       ├─ khatiyan_no
                       ├─ kisam (land type)
                       ├─ area_decimal, area_hectare
                       ├─ khajana, cess
                       ├─ mutation_cases[]
                       │     └─ {case_no, YEAR, plot_no, area, direction, linked_khatiyan}
                       └─ old_khatiyans[], new_khatiyans[]
                       │
          ┌────────────▼────────────┐
          │  SOURCE 2: BHUNAKSHA    │  bhunakshaodisha.nic.in
          └────────────┬────────────┘
                       │ EXTRACTS:
                       ├─ area_confirmed (cross-verify)
                       ├─ owner_confirmed (cross-verify)
                       ├─ adjacent_plot_numbers[]
                       ├─ gis_code
                       └─ map_image_url
                       │
     ┌─────────────────▼─────────────────────────────┐
     │  STEP: TEHSIL → SRO MAPPING                   │
     │  igrodisha.gov.in → "Know Your SRO"           │
     │  INPUT:  tehsil                                │
     │  OUTPUT: sro_name, sro_code                   │
     │  (build once as static lookup table)          │
     └─────────────────┬─────────────────────────────┘
                       │
          ┌────────────▼────────────┐
          │  SOURCE 3: IGR EC       │  igrodisha.gov.in
          │  Encumbrance Search     │
          └────────────┬────────────┘
                       │ INPUT:
                       ├─ district        ← from user input
                       ├─ sro_code        ← from Tehsil→SRO mapping
                       ├─ village         ← from user input
                       ├─ plot_no         ← from Bhulekh
                       └─ date_range      ← derived from mutation years in ROR
                       │                     (search from earliest mutation year to now)
                       │ EXTRACTS per EC entry:
                       ├─ doc_type        (Sale Deed / Mortgage / Gift / Partition / POA...)
                       ├─ reg_no          ← KEY: used to fetch the actual deed
                       ├─ reg_year
                       ├─ executant       (seller / mortgagor)
                       ├─ claimant        (buyer / mortgagee / bank)
                       ├─ transaction_value
                       └─ sro_name
                       │
          ┌────────────▼────────────┐
          │  SOURCE 4: IGR DEED     │  igrodisha.gov.in
          │  Document Fetch         │
          └────────────┬────────────┘
                       │ INPUT:
                       ├─ reg_no          ← from EC entry above
                       ├─ reg_year        ← from EC entry above
                       └─ sro_code        ← from mapping
                       │ EXTRACTS:
                       ├─ deed_scan_pdf   ← the actual sale deed document
                       ├─ property_schedule (exact description in deed)
                       ├─ consideration_amount
                       ├─ representations by seller
                       └─ any conditions / restrictions in deed
                       │
          ┌────────────▼────────────┐
          │  SOURCE 5: BENCHMARK    │  igrodisha.gov.in
          │  Valuation              │
          └────────────┬────────────┘
                       │ INPUT:
                       ├─ district
                       ├─ sro_code        ← from mapping
                       ├─ village
                       ├─ kisam           ← from Bhulekh (Gharabari / Chashi etc.)
                       ├─ plot_no
                       ├─ area            ← from Bhulekh
                       └─ unit            (decimal / acre / hectare)
                       │ EXTRACTS:
                       ├─ circle_rate     (₹ per sq ft / per decimal)
                       └─ govt_value      = area × circle_rate
                       │
          ┌────────────▼────────────┐
          │  SOURCE 6: CERSAI       │  cersai.org.in
          │  Mortgage Check         │
          └────────────┬────────────┘
                       │ INPUT:
                       ├─ owner_name      ← from Bhulekh S.2 (debtor search)
                       └─ [property addr] ← optional asset search
                       │ EXTRACTS:
                       ├─ active_loans[]  [{lender, amount, date, status}]
                       └─ satisfied_loans[] (repaid — safe)
                       │ NOTE: ₹10 fee per search; no public API documented
                       │
          ┌────────────▼────────────┐
          │  SOURCE 7: REVENUE DUES │  bhulekh.ori.nic.in (Pay Land Revenue)
          └────────────┬────────────┘
                       │ INPUT:
                       └─ khatiyan_no     ← from Bhulekh
                       │ EXTRACTS:
                       └─ outstanding_dues (₹)
                       │
          ┌────────────▼────────────┐
          │  SOURCE 8: eCOURTS      │  ecourts.gov.in
          │  Litigation Search      │
          └────────────┬────────────┘
                       │ INPUT:
                       ├─ party_name      ← owner_name from Bhulekh
                       └─ district
                       │ EXTRACTS:
                       ├─ pending_cases[] [{case_no, court, nature, status, date}]
                       └─ disposed_cases[] (historical)
                       │
          ┌────────────▼────────────┐
          │  SOURCE 9: ADJACENT     │  bhulekh.ori.nic.in (recursive)
          │  PLOT LOOKUP            │
          └────────────┬────────────┘
                       │ INPUT:
                       └─ adjacent_plot_numbers[] ← from Bhunaksha map
                       │ FOR EACH adjacent plot:
                       │   → Bhulekh lookup (same village)
                       │   → EXTRACTS: owner, kisam, is_road (Rasta), is_govt
                       └─ OUTPUT: neighbour_map {direction: {plot, owner, type}}
```

-----

## The Mutation Year → Deed Date Mapping (Critical Insight)

This is how you avoid a full-history EC search and target directly:

```python
# From Bhulekh Section 6 mutation cases:
mutation_cases = [
    {"case_no": "8833/2026", "year": 2026, "direction": "in"},
    {"case_no": "8838/2026", "year": 2026, "direction": "in"},
]

# For EC search, set date range:
earliest_year = min(case["year"] for case in mutation_cases) - 1
search_from   = f"01/01/{earliest_year}"
search_to     = "today"

# This ensures you catch the deed that triggered each mutation
```

**Why this matters:**

- Old Khatiyans (pre-1990 mutations) may not have digitized deeds in IGR
- Recent mutations (2010+) almost certainly have digital deed scans
- The mutation year brackets the date range, avoiding irrelevant historical noise

-----

## Tehsil → SRO Mapping (One-Time Setup)

This is the only lookup table you need to build before running the pipeline.

```
IGR Odisha → "Know Your SRO" → input each Tehsil → get SRO code

Example:
  Tehsil "Bhubaneswar" → SRO "Bhubaneswar-I" (code: BBS1) or "Bhubaneswar-II" (code: BBS2)
  [A single Tehsil may map to multiple SROs — search by village to disambiguate]
```

**Build the mapping table:**

```
Scrape igrodisha.gov.in/knowyoursro endpoint once
Store: {district → {tehsil → [sro_code, sro_name]}}
Refresh: quarterly (SRO boundaries rarely change)
```

**Village → SRO disambiguation:**
When a Tehsil has multiple SROs, use the village name as a secondary lookup within the IGR “Know Your SRO” tool to get the exact SRO for a given village.

-----

## What Each Source Returns for Your Dashboard

|Source        |Dashboard field                                          |Derived from                           |
|--------------|---------------------------------------------------------|---------------------------------------|
|Bhulekh       |Owner name, Kisam, Area, Mutation history                |Direct extraction                      |
|Bhunaksha     |Plot map image, Adjacent plots, Area (verified)          |Direct extraction                      |
|IGR EC        |Transaction history table (type, parties, date, value)   |district + SRO + village + plot_no     |
|IGR Deed Fetch|Sale deed PDF, Consideration amount, Property description|reg_no from EC                         |
|IGR Benchmark |Circle rate (₹/unit), Govt estimated value               |district + SRO + village + kisam + area|
|CERSAI        |Active mortgage: yes/no, Lender name                     |owner_name from Bhulekh                |
|Revenue dues  |Outstanding amount (₹)                                   |khatiyan_no from Bhulekh               |
|eCourts       |Litigation: yes/no, Case list                            |owner_name + district                  |
|Adjacent plots|Neighbour table with road access confirmed/denied        |adjacent_plot_nos from Bhunaksha       |

-----

## Data You Get from Sale Deed (Source 4) That’s NOT in Bhulekh

This is the real value of fetching the deed:

|Data point                                    |Why it matters                                                         |
|----------------------------------------------|-----------------------------------------------------------------------|
|Actual price paid (consideration)             |Bhulekh has no price data — deed has the declared value                |
|Seller’s representations                      |Did seller warrant clear title? Any known defects disclosed?           |
|Property schedule description                 |How the property was described at registration — compare to current ROR|
|Conditions / restrictions                     |Any easements, right-of-way, restrictions on use                       |
|Whether sale is of full ownership or leasehold|Critical distinction                                                   |
|Link document reference                       |The deed references the previous deed — builds the chain               |
|Stamp duty paid                               |Verify stamp duty was paid on correct value (not undervalued)          |
|Name consistency                              |Seller in deed should match owner in ROR — any mismatch = flag         |

-----

## Full Field Mapping: Bhulekh → Other Source Inputs

```
┌─────────────────────┬──────────────────────┬──────────────────────┐
│ FIELD FROM BHULEKH  │ MAPS TO              │ SOURCE               │
├─────────────────────┼──────────────────────┼──────────────────────┤
│ district            │ district             │ IGR EC, Benchmark,   │
│                     │                      │ CERSAI, eCourts      │
├─────────────────────┼──────────────────────┼──────────────────────┤
│ tehsil              │ → SRO code (via map) │ IGR EC, Benchmark    │
├─────────────────────┼──────────────────────┼──────────────────────┤
│ mouza / village     │ village              │ IGR EC, Benchmark    │
├─────────────────────┼──────────────────────┼──────────────────────┤
│ plot_no             │ survey_no / plot_no  │ IGR EC, Benchmark    │
├─────────────────────┼──────────────────────┼──────────────────────┤
│ khatiyan_no         │ khata_no             │ IGR EC, Revenue dues │
├─────────────────────┼──────────────────────┼──────────────────────┤
│ owner_name          │ party_name           │ CERSAI, eCourts,     │
│                     │                      │ IGR deed verify      │
├─────────────────────┼──────────────────────┼──────────────────────┤
│ kisam               │ land_classification  │ IGR Benchmark        │
├─────────────────────┼──────────────────────┼──────────────────────┤
│ area_decimal        │ area                 │ IGR Benchmark        │
├─────────────────────┼──────────────────────┼──────────────────────┤
│ mutation_year       │ date_range filter    │ IGR EC search        │
├─────────────────────┼──────────────────────┼──────────────────────┤
│ mutation_case_no    │ cross-reference      │ Verify deed exists   │
│                     │                      │ in IGR for that year │
├─────────────────────┼──────────────────────┼──────────────────────┤
│ old_khatiyan_no     │ input for recursive  │ Bhulekh (chain)      │
│                     │ Bhulekh lookup       │                      │
├─────────────────────┼──────────────────────┼──────────────────────┤
│ adjacent_plot_nos   │ plot_no inputs       │ Bhulekh (neighbours) │
│ (from Bhunaksha)    │ for neighbour lookup │                      │
└─────────────────────┴──────────────────────┴──────────────────────┘
```

-----

## What IGR EC Search Cannot Return (Gaps to Note)

|Gap                                        |Explanation                                                |Workaround                          |
|-------------------------------------------|-----------------------------------------------------------|------------------------------------|
|Pre-digitization deeds (typically pre-2000)|Older registrations may not be in digital EC               |Physical SRO visit required         |
|Unregistered transactions                  |Oral agreements, possession transfers without deed         |Seller disclosure only              |
|Equitable mortgages (title deed deposit)   |May not be in EC — check CERSAI separately                 |CERSAI covers this                  |
|Revenue-only mutations (no deed)           |Some inheritance/gift mutations were done via mutation only|Certified mutation order from Tehsil|
|Property description mismatch              |Old deed may use old plot number (before sub-division)     |Match by date range + old plot no.  |

-----

## Flags Your App Can Auto-Generate

Based on aggregated data from all sources:

```python
flags = []

# From Bhulekh + IGR EC cross-check
if len(mutation_cases) > len(ec_entries_matching_mutations):
    flags.append("MUTATION_WITHOUT_DEED: Some mutations have no matching registered deed")

# From IGR EC
if any(entry["doc_type"] == "Mortgage" and entry["status"] == "active" for entry in ec):
    flags.append("ACTIVE_MORTGAGE_IN_EC")

# From CERSAI
if cersai_results["active_loans"]:
    flags.append("ACTIVE_BANK_LOAN_CERSAI")

# From deed vs ROR comparison
if deed_seller_name != ror_previous_owner:
    flags.append("SELLER_NAME_MISMATCH_DEED_VS_ROR")

if deed_area != ror_area:
    flags.append("AREA_MISMATCH_DEED_VS_ROR")

# From eCourts
if ecourts_results["pending_cases"]:
    flags.append("PENDING_LITIGATION")

# From revenue dues
if revenue_dues > 0:
    flags.append(f"OUTSTANDING_REVENUE_DUES: ₹{revenue_dues}")

# From adjacent plots
road_access = any(n["is_road"] for n in neighbours.values())
if not road_access:
    flags.append("NO_CONFIRMED_ROAD_ACCESS")

# From benchmark vs deed value
if deed_value < benchmark_value * 0.7:
    flags.append("DEED_VALUE_SIGNIFICANTLY_BELOW_BENCHMARK: possible undervaluation")
```

-----

## Technical Approach: What to Scrape vs. What to Form-POST

|Source                  |Method         |Auth needed   |Notes                             |
|------------------------|---------------|--------------|----------------------------------|
|Bhulekh ROR             |GET with params|None          |Public                            |
|Bhunaksha               |GET with params|None          |Public                            |
|IGR “Know Your SRO”     |GET / form POST|None          |Public lookup                     |
|IGR EC Search           |Form POST      |Account (free)|Register once                     |
|IGR Deed fetch          |GET by reg_no  |Account       |May require fee for certified copy|
|IGR Benchmark           |Form POST      |None          |Public                            |
|CERSAI                  |Form POST      |None (₹10 fee)|Paid search                       |
|Revenue dues            |GET / POST     |None          |Via Pay Land Revenue link         |
|eCourts                 |Form POST      |None          |Public                            |
|Adjacent plots (Bhulekh)|GET (recursive)|None          |Same as ROR fetch                 |

-----

## Recommended Implementation Order for Your App

```
PHASE 1 — Core (build this first)
  ✓ Bhulekh ROR extraction        (already working)
  ✓ Bhunaksha plot report         (already working)
  → IGR "Know Your SRO" mapping   (one-time table build)
  → IGR EC Search                 (uses fields you already have)

PHASE 2 — Sale Deeds (biggest value add)
  → IGR Deed fetch by reg_no      (from EC results)
  → IGR Benchmark valuation       (uses Bhulekh kisam + area)

PHASE 3 — Risk Flags
  → CERSAI mortgage check         (owner_name from Bhulekh)
  → eCourts litigation search     (owner_name + district)
  → Revenue dues check            (khatiyan_no)

PHASE 4 — Neighbourhood Intelligence
  → Adjacent plot recursive lookup (adjacent plot nos from Bhunaksha)
  → Road access confirmation
  → Neighbour identity mapping

PHASE 5 — Extended (situational)
  → ORERA check (if developer project suspected)
  → BDA zone lookup
  → Title chain recursive (old khatiyans from ROR)
```

-----

## Dashboard Data Model

```json
{
  "input": {
    "district": "Khordha",
    "tehsil": "Bhubaneswar",
    "village": "Mendhashala",
    "plot_no": "181/10454"
  },
  "revenue_layer": {
    "khatiyan_no": "607/4545",
    "owner": "Diksha Mahapatra",
    "kisam": "Gharabari",
    "area_sqft": 4356,
    "area_decimal": 0.1,
    "mutations": [{"case": "11515/2026", "year": 2026, "from": "607/1397"}],
    "revenue_dues": 0
  },
  "spatial_layer": {
    "area_verified": true,
    "owner_verified": true,
    "map_url": "https://...",
    "neighbours": {
      "N": {"plot": "320", "owner": "...", "is_road": false},
      "S": {"plot": "308", "owner": "Govt", "is_road": true},
      "E": {"plot": "318", "owner": "...", "is_road": false},
      "W": {"plot": "311", "owner": "...", "is_road": false}
    },
    "road_access": {"confirmed": true, "direction": "S", "plot": "308"}
  },
  "registration_layer": {
    "sro": "Bhubaneswar-I",
    "ec": [
      {
        "doc_type": "Sale Deed",
        "reg_no": "4532/2026",
        "year": 2026,
        "executant": "Maheshwar Mahapatra",
        "claimant": "Diksha Mahapatra",
        "value": 2500000,
        "deed_url": "https://igrodisha.gov.in/..."
      }
    ],
    "benchmark_value_per_sqft": 850,
    "govt_estimated_value": 3702600
  },
  "financial_layer": {
    "cersai_active_loans": [],
    "cersai_clean": true
  },
  "legal_layer": {
    "ecourts_pending": [],
    "litigation_clean": true
  },
  "flags": [],
  "risk_score": "LOW"
}
```

-----

*This pipeline enables a property verification app to go from a single plot input to a 360-degree verified dashboard, pulling from 7+ government sources in a single automated flow.*