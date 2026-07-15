# Bhulekh ROR + Bhunaksha Plot Report — Master Insight & Extraction Guide

**For use by a coding agent and as a buyer’s reference framework**

-----

## Section 1 — Coding Instructions: ROR → Plot Report Flow

```
STEP 1: Load ROR page (bhulekh.ori.nic.in)
STEP 2: Check for dead account marker — "ଏହି ଖାତାରେ ପ୍ଲଟ ଉପଲବ୍ଧ ନାହିଁ"
         → If present: mark Khatiyan as inactive, log old Khatiyan refs from Section 6, stop
STEP 3: Locate second table on page (plot listing, Page 2)
STEP 4: Find all <a> tags in table body rows
         → Each <a> = one plot number = one Bhunaksha link
         → N plots = N anchor tags = N plot reports to fetch
STEP 5: For each <a>:
         → Extract plot number text (from anchor text content)
         → Extract href (pre-constructed Bhunaksha URL)
         → Follow href → Plot Report page (app3bhunakshaodisha.nic.in)
STEP 6: From each Plot Report page, parse:
         → Plot number, Khatiyan number (flag if blank)
         → Area: Acres + Decimal + Hectare (three fields)
         → Owner name + address block
         → Cadastral map image (src URL)
         → Scale value
STEP 7: Cross-verify area: ROR column 11 (Decimal) == Plot Report Decimal
         → Mismatch = flag for manual review
STEP 8: From ROR Section 6 (Special Notes), extract:
         → All Dakhal Kharaj case numbers + years
         → All plot numbers mentioned
         → All "Puratana Khata" (old source Khatiyan) references
         → All "Nutan Khata" (new destination Khatiyan) references
         → Enqueue all referenced Khatiyans for recursive lookup
```

**Edge cases to handle:**

- Plot Report Khatiyan field may be blank — use the ROR Khatiyan as ground truth
- Sub-divided plot numbers contain `/` — treat as string, not arithmetic
- Multiple plots in one Khatiyan — loop all anchors independently
- Plot Report on a different domain — handle navigation/CORS separately
- Aggregate row in plot table (labeled “X plots”) — skip for link extraction, use only for area sum validation

-----

## Section 2 — ROR Deep Dive: Every Field, Every Insight

### 2.1 Location Header Fields

**Fields:** Mouza, Thana, Thana No., Tehsil, Tehsil No., District

**Insights:**

- Together these six form the complete administrative address — required input for EC search, court search, BDA zoning query, Sub-Registrar records search
- Tehsil No. + Mouza code = components of the Bhunaksha GIS code — enables programmatic plot report URL construction without clicking
- Thana name → identifies jurisdiction for court litigation search and police encumbrance records
- District → determines which High Court bench has jurisdiction if disputes arise

**Cross-source use:**

|Use                            |Where to go                                                                  |
|-------------------------------|-----------------------------------------------------------------------------|
|Find Sub-Registrar jurisdiction|Match Tehsil to Sub-Registrar office for EC and deed search                  |
|BDA/planning zone              |Input Mouza + District to BDA master plan lookup                             |
|Court search                   |Thana + District → Civil Court, District Court                               |
|Systematic GIS access          |Tehsil No. + Mouza code → construct Bhunaksha URLs for all plots in the Mouza|

-----

### 2.2 Khewat Number

**Field:** Odisha Govt Khewat No. (top right of ownership table)

**Common values and what they mean:**

|Value        |Meaning                                       |Buyer implication                      |
|-------------|----------------------------------------------|---------------------------------------|
|1            |Private raiyati — individual/private ownership|Standard — fully transferable          |
|Other numbers|Government, institutional, or special tenure  |May have transfer restrictions — verify|

**Insights:**

- Khewat 1 = the land is privately held and generally freely transferable
- Any other Khewat number warrants investigation before assuming free transferability
- This single field can immediately flag whether a property is even purchasable

-----

### 2.3 Khatiyan Number (Section 1)

**Format:** `PREFIX/SUFFIX` e.g. `607/4532`

**Insights:**

- Prefix (e.g. `607`) = Mouza/circle code — constant across all Khatiyans in the same Mouza
- Suffix (e.g. `4532`) = sequential account number — **higher suffix = newer account**
- Low suffix numbers (e.g. `607/466`) = old, original holdings — often the root of a title chain
- High suffix numbers = recently created, typically via mutation from a lower-numbered parent
- When a new Khatiyan has a very high suffix, always trace back to its parent(s) — the full history is in the chain, not just this account

**Cross-source use:**

- Use the Khatiyan number as the primary key for EC search at igrodisha.gov.in
- Use it to search revenue court records for any mutation disputes
- Recursive Bhulekh lookup: every old Khatiyan referenced in Section 6 should be fetched and parsed the same way

-----

### 2.4 Owner / Praja Details (Section 2)

**Fields:** Name, Father’s/Husband’s name, Caste, Residence address

**Insights:**

- Name + Father’s name together = unique identity reference. Name alone is insufficient — common names repeat
- Caste field is legally significant:
  - If owner is Scheduled Tribe (ST) → land may be protected under Odisha Scheduled Areas Transfer of Immovable Property (by Scheduled Tribes) Regulation, 1956. Non-ST buyers cannot legally purchase ST land in Scheduled Areas without government permission. Verify if the Mouza falls in a Scheduled Area.
  - Non-ST castes have no such restriction
- Residence address = where the owner was living at time of mutation. May be outdated. Do not rely on this for contacting the seller — get current contact independently
- If multiple names appear in Section 2 → co-ownership. All co-owners must sign the sale deed. Verify each person’s identity and willingness separately.

**Cross-source use:**

|Use                     |Action                                                                    |
|------------------------|--------------------------------------------------------------------------|
|Identity verification   |Match name + father’s name to Aadhaar, PAN, or registered sale deed       |
|ST land check           |Check if Mouza is in Scheduled Area — Revenue Dept / tribal affairs office|
|Co-owner risk           |If multiple names, pull EC for all of them                                |
|Address for legal notice|Use registered address from sale deed, not ROR                            |

-----

### 2.5 Ownership Status — Swatwa (Section 3)

**Field:** Nature of right / Swatwa

**Values:**

|Value                  |Meaning                             |Buyer action                                                      |
|-----------------------|------------------------------------|------------------------------------------------------------------|
|Sthitiban (ସ୍ଥିତିବାନ)       |Active current holder               |Proceed with verification                                         |
|Blank / transferred out|Account is inactive — all plots gone|Do not buy from this Khatiyan — find the active receiving Khatiyan|
|Other values           |Temporary/restricted tenure         |Investigate before proceeding                                     |

**Insight:** Sthitiban in an old Khatiyan whose plots have all been transferred simply means that was the original tenure class of the raiyat — it does not mean the account is still active. Always check Page 2 for whether any plots remain.

-----

### 2.6 Revenue / Dues (Section 4)

**Fields:** Jalkar, Khajana, Cess, Nistar cess, Other cess, Total

**Insights:**

- The amounts shown are what is **currently due per year** — not what has been paid
- Very low amounts (e.g. ₹7-9/year) = standard Gharabari residential land revenue in Odisha
- Higher-than-expected amounts could indicate: commercial classification, larger plot, or historical escalation
- Jalkar (water tax) appearing means the plot has some water body or irrigation association — flag for investigation
- This section tells you the **holding cost** of the land going forward — buyer inherits this liability

**Cross-source use:**

- Visit the Tehsil office with the Khatiyan number and ask for the Khajana receipt register — confirms whether revenue is paid up to date
- Arrears are not visible in the ROR — only the Tehsil records show this
- Unpaid Khajana = government lien — must be cleared before or at the time of purchase

-----

### 2.7 Special Notes / Bishesh Anusanga (Section 6) — Most Critical Field

This field records the entire mutation history in text form. It is the most information-dense part of the ROR.

**Entry types and what to extract:**

**Type A — Original entry (Dakha Case):**

```
Dakha Case No. XXXXX/YY  Humukha [OLD KHATIYAN]  Taru
```

→ This Khatiyan was created from [OLD KHATIYAN] via case XXXXX in year YY
→ Action: fetch the old Khatiyan, verify its status

**Type B — Transfer out (Dakhal Kharaj, land leaving this Khatiyan):**

```
Dakhal Kharaj Case No. XXXXX/YYYY  Per order
Plot No. [P]  Area [X] decimal  Nutan Khata No. [NEW] ku
```

→ Plot [P] left this Khatiyan and went to [NEW]
→ Action: fetch [NEW] Khatiyan to confirm receipt

**Type C — Transfer in (Dakhal Kharaj, land arriving in this Khatiyan):**

```
Dakhal Kharaj Case No. XXXXX/YYYY  Per order
Plot No. [P]  Area [X] decimal  Puratana Khata No. [OLD] ru
```

→ Plot [P] arrived from [OLD] Khatiyan
→ Action: fetch [OLD] Khatiyan to verify it shows the outgoing transfer

**Insights from Section 6:**

|What you extract      |What it tells you                                                |
|----------------------|-----------------------------------------------------------------|
|Case number           |Unique mutation identifier — quotable in Tehsil queries          |
|Case year             |When the transfer was processed — recency flag                   |
|Plot number in case   |Which specific plot moved                                        |
|Area in case          |How much area transferred — compare to current holding           |
|Old Khatiyan reference|Previous owner’s account — fetch for title chain                 |
|New Khatiyan reference|Receiving account — verify it’s the current active one           |
|Direction (ru/ku)     |Whether land came in or went out                                 |
|Multiple entries      |Multiple transfers = complex history = deeper verification needed|

**Red flags in Section 6:**

- Same plot transferred multiple times in quick succession → could indicate disputed ownership
- Area in Section 6 does not match area in Page 2 plot listing → data inconsistency, flag
- New Khatiyan reference points to a Khatiyan not in your possession → you’re missing a document in the chain
- Year of mutation is very recent (same year as purchase) → insufficient post-mutation history
- No Section 6 entry at all in a high-suffix Khatiyan → suspicious — how was this account created?

**Cross-source use:**

- Mutation case number → request certified copy of Tehsildar’s order from Tehsil office
- Old Khatiyan numbers → recursive Bhulekh lookup to build full title tree
- Case year → anchor your EC search — get EC from before the earliest case year

-----

### 2.8 Plot Listing Table (Page 2)

**Fields per row:** Plot No., Kisam (land use), Plot Khajana, Description/Chauhaddi, Acres, Decimal, Hectare, Remarks

**Plot number insights:**

- Simple number (e.g. `182`) = original undivided plot
- Compound number (e.g. `182/3937`) = sub-divided plot. The `/XXXX` suffix is system-generated during mutation split
- When you see a compound plot number, always ask: what does the sibling portion (the part that wasn’t transferred) look like? Who holds it? Is it adjacent?

**Kisam (land use type) insights:**

|Kisam                     |Buyer implication                                                      |
|--------------------------|-----------------------------------------------------------------------|
|Gharabari (ଘରବାରି)          |Residential homestead — best for construction, no conversion needed    |
|Chashi (ଚାଷ) / Agricultural|Needs Change of Land Use (CLU) order from BDA/Collector before building|
|Jungle / Forest           |Cannot build — requires forest clearance                               |
|Pokhari (ଡୋ) / Water body  |Cannot fill without environmental clearance                            |
|Anabadi                   |Uncultivated revenue land — verify if buildable in that zone           |
|Danga                     |Elevated dry land — usually agricultural, check                        |

**Mixed Kisam across multiple plots in same Khatiyan:**

- If a Khatiyan lists both Gharabari and agricultural plots, do not assume all are buildable
- Process each plot’s Kisam independently
- A buyer may want only the Gharabari portions — negotiate accordingly

**Area columns — cross-checks:**

```
Decimal × 435.6  = Sq Ft
Decimal × 0.004047 = Hectare
100 Decimal     = 1 Acre = 43,560 Sq Ft
```

- Verify all three columns internally against each other
- Then verify Decimal column against Bhunaksha Plot Report
- Then verify aggregate row against sum of individual plot rows

**Chauhaddi (four-side boundary description):**

- When populated, names what sits on each cardinal side (E/W/N/S)
- Can name: adjacent plot numbers, road names, water bodies, neighbour names
- Use named adjacent plots → look them up in Bhulekh to identify who your neighbours are
- “Road” on any side = confirmed access — good
- No road on any side = potential landlocked plot — investigate access

**Aggregate row:**

- Labeled “X plots” at the bottom — sums up total area
- If sum of individual rows ≠ aggregate row → data error, flag
- Use total area as the single figure for price per sq ft calculations

-----

## Section 3 — Plot Report Deep Dive: Every Field, Every Insight

### 3.1 Header Fields

**Fields:** Plot No., Khatiyan No., Mouza, Thana, Thana No., Tehsil, Tehsil No., District

**Insights:**

- These mirror the ROR header — both documents should agree on all location fields
- **Khatiyan No. field sometimes blank in Plot Report** — this is a known gap. When blank, use the ROR as source of truth. The link from ROR to this plot report is itself the association.
- Tehsil No. here is often a short code (e.g. `2`) — this is the Tehsil’s internal GIS code, different from how it appears in the ROR text

-----

### 3.2 Area Table

**Fields:** Acres (Ekara), Decimal (Disimil), Hectare

**Insights:**

- This is the **GIS system’s independent record** of the plot area — not the revenue system’s
- When this matches the ROR: strong signal both databases are in sync
- When this does not match the ROR: mutation has happened in the revenue system but GIS hasn’t been updated yet (common lag), OR there is a data entry error somewhere
- The Decimal value here is the primary cross-verification target against ROR Page 2 Column 11

-----

### 3.3 Owner Details Block

**Fields:** Name, father’s name, caste, address (paragraph below area table)

**Insights:**

- This is pulled from the revenue system into the GIS record — the two systems share owner data
- Mismatch with ROR owner = GIS database not yet updated after a recent mutation
- When buying from a recently mutated property, this mismatch is common and expected — but should be flagged and noted with a timestamp of when both records were pulled

-----

### 3.4 Cadastral Map Image

**What it shows:**

- The target plot highlighted/labeled within the Mouza’s plot network
- All surrounding plots with their plot numbers visible
- North arrow for orientation
- The approximate shape of the plot

**Insights a buyer can derive:**

|Observation                                       |Insight                                                                        |
|--------------------------------------------------|-------------------------------------------------------------------------------|
|Plot has regular rectangular shape                |Easier to build on, full use of area                                           |
|Plot is narrow or L-shaped                        |Construction constraints, may not fit standard floor plans                     |
|Plot is very small relative to neighbours         |Could be a result of multiple sub-divisions — verify full original plot history|
|Abutting a wide plot on one side                  |Check if that wide plot is a road — good for access                            |
|Surrounded entirely by other small plots          |Likely landlocked — no road access — critical risk                             |
|Plot is at the edge of the Mouza boundary         |May abut a different Mouza — boundary complications possible                   |
|Highlighted plot number visible on map matches ROR|Consistent — good                                                              |
|Plot number on map does not match                 |Data entry error or wrong plot report was linked                               |

**Cross-source use:**

- Overlay with Google Maps/Bhuvan satellite imagery — Mouza boundaries are roughly locatable using the Mouza name + District
- Compare shape with satellite to estimate which physical land on the ground corresponds
- Take plot numbers of all adjacent plots visible on map → look them up in Bhulekh to identify and research neighbours
- If a road is visible on the map → confirm with BDA/NHAI whether any road widening is planned (an approaching road widening project can eat into the plot)

-----

### 3.5 Scale Value

**Field:** Skou (ସ୍କୌ) — e.g. `500`

**Insights:**

- Scale 1:500 means 1 unit on map = 500 units on ground
- Smaller scale number = larger zoom = more detailed map = smaller area covered per page
- Scale 1:500 is typical for dense residential areas with small plots
- Can be used to roughly estimate actual plot dimensions from the map image dimensions — not survey-accurate but useful for a quick sanity check on shape

-----

### 3.6 GIS Code in URL

**Format example:** `giscode=20021110500`

**Decoded:**

```
2  00  2  11  10  500
|       |   |   |   |
State   Dist Teh  RI  Mouza
```

**Insights:**

- Once you have the GIS code for a Mouza, you can construct plot report URLs for **any plot number in that Mouza** programmatically
- Enables batch-fetching all plot reports in a Mouza without clicking through the UI
- The Mouza code (last segment) is constant — only the `plotno` parameter changes per plot

-----

## Section 4 — ROR + Plot Report Cross-Linkage

### 4.1 What the Linkage Confirms

When you have both documents for the same plot:

|Check         |ROR value        |Plot Report value    |Match?                              |
|--------------|-----------------|---------------------|------------------------------------|
|Plot number   |Page 2, Column 7 |Header: Plot No.     |Must match exactly                  |
|Mouza         |Header           |Header               |Must match                          |
|District      |Header           |Header               |Must match                          |
|Owner name    |Section 2        |Owner block          |Should match (lag if fresh mutation)|
|Area (Decimal)|Page 2, Column 11|Area table: Decimal  |Must match                          |
|Area (Hectare)|Page 2, Column 12|Area table: Hectare  |Must match                          |
|Khatiyan No.  |Section 1        |Header (if populated)|Should match                        |

**Any mismatch is an actionable finding:**

- Area mismatch → data sync lag or error → verify at Tehsil
- Owner mismatch → mutation not yet reflected in GIS → note date of pull, re-verify later
- Plot number mismatch → wrong plot report linked, or sub-division numbering issue → re-fetch
- Mouza/District mismatch → critical error → do not proceed without Tehsil verification

### 4.2 What the Combination Tells You That Neither Alone Can

|Combined insight                                                  |How derived                                                                                                                                                             |
|------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
|Land is confirmed in both revenue AND spatial government databases|ROR says who owns it; Plot Report confirms the same plot exists in GIS under the same owner                                                                             |
|Plot is genuinely sub-divided (not just a numbering artifact)     |ROR Section 6 shows the mutation case; Plot Report map shows the actual smaller shape                                                                                   |
|Neighbour identification                                          |ROR gives your plot’s Chauhaddi in text; Plot Report map shows adjacent plot numbers visually — look up those numbers in Bhulekh to know exactly who your neighbours are|
|Road access confirmation                                          |ROR Chauhaddi may say “road” on one side; Plot Report map visually confirms whether that road-adjacent boundary exists and on which side                                |
|Area sanity check across two independent systems                  |Revenue DB + GIS DB both have the area — agreement = high confidence                                                                                                    |

-----

## Section 5 — Multiple Plots Scenarios

### Scenario A: Multiple plots listed in one Khatiyan

**Example:** Khatiyan 607/4532 with plots 182 and 182/3937

**What to do:**

1. Fetch a Plot Report for **each** plot independently — do not assume one report covers all
1. Check each plot’s Kisam individually — may differ
1. Check if plots are adjacent (compare their cadastral maps — do their shapes share a boundary?)
1. If adjacent → combined area is contiguous = higher construction value
1. If not adjacent → treat as two separate land parcels despite being in one Khatiyan
1. Sum of individual decimal areas must equal the aggregate row in the ROR
1. Revenue in Section 4 covers all plots in the Khatiyan combined — not per plot

**Insight from multiple plots in one Khatiyan:**

- Could mean the owner consolidated land from multiple sources into one account
- Check Section 6 — there should be one “from old Khata X” entry per plot that was added
- If one plot’s source is clear but another’s is missing from Section 6 → flag

### Scenario B: Same owner, multiple Khatiyans

**Example:** Diksha holds 607/4532 AND 607/4545

**What to do:**

1. Process each Khatiyan fully and independently
1. Check if any plots across the two Khatiyans are adjacent (Bhunaksha maps side by side)
1. If buying all — calculate total area, total revenue, verify each mutation chain separately
1. Check EC separately for each Khatiyan number
1. Revenue arrears check at Tehsil: do both Khatiyans, not just one

**Insight:**

- Two separate Khatiyans = two separate legal parcels even if physically adjacent
- They will need to be mentioned separately in the sale deed
- A buyer could choose to buy only one Khatiyan’s plots — ensure the seller is selling both if both are needed for the intended use

### Scenario C: Sub-divided plots (e.g. 181/10454)

**What to do:**

1. Identify the parent plot number (the part before `/` = 181)
1. Search Bhulekh for the parent plot number (181) to find who holds the remaining portion
1. Fetch that Khatiyan → check area of remaining portion
1. Compare: original area = transferred portion + remaining portion (they should add up)
1. Pull Plot Reports for both the transferred portion and the sibling remaining portion
1. On Bhunaksha maps, the two sub-plots should appear as adjacent shapes together forming the original plot shape

**Insight:**

- Sub-divided plots always have a sibling — the other piece of the original plot
- The sibling’s owner becomes your immediate neighbour on one boundary
- If the sibling is also being sold to you → check it has its own separate mutation case and Khatiyan
- If not being sold → the shared boundary between sub-plots is freshly created, physically unmarked, and needs demarcation
- Original plot’s Kisam applies to both sub-plots unless changed during mutation

### Scenario D: Chain with missing link (e.g. unknown Khatiyan 607/1391)

**What to do:**

1. Note the gap — a source Khatiyan referenced in Section 6 is unavailable
1. Search Bhulekh for that Khatiyan number directly
1. If found → process normally
1. If not found or shows error → request certified record from Tehsil office
1. A missing link means you cannot verify the title chain for that plot — flag for lawyer

**Insight:**

- Even one missing link in the chain creates title risk
- The Khatiyan number is known (from Section 6 reference) so it is findable — absence on the portal usually means data not yet digitized for older records, not that the record doesn’t exist
- Older Khatiyans (very low suffix numbers like 607/466) may not be fully digitized — requires physical Tehsil records search

### Scenario E: Old Khatiyan with remaining area

**Example:** Maheshwar’s 607/1397 still shows 0.04 decimal of Plot 181 remaining after the split

**What to do:**

1. Note the remaining area and the old owner’s name
1. Pull the Plot Report for the unsplit portion of Plot 181 to see its shape
1. On Bhunaksha, the sold portion (181/10454) and the remaining portion (181) should appear as adjacent shapes
1. Understand: the old owner remains your direct neighbour on the shared newly-created boundary
1. Check if the old owner has any encumbrances, disputes, or claims that could affect the shared boundary

**Insight:**

- The shared new boundary between sub-plots has no physical marker on the ground yet
- This is the boundary most likely to be disputed after purchase
- Physical demarcation is not just recommended here — it is essential before any construction begins close to that boundary

-----

## Section 6 — Master Insight Matrix

### What you can definitively extract and verify from ROR + Plot Report alone

|Category   |Data Point                                 |Source                       |Confidence              |
|-----------|-------------------------------------------|-----------------------------|------------------------|
|Identity   |Owner name + father’s name                 |ROR S.2                      |High                    |
|Identity   |Owner caste                                |ROR S.2                      |High                    |
|Identity   |Owner recorded address                     |ROR S.2                      |Medium (may be outdated)|
|Tenure     |Land is private raiyati (Khewat 1)         |ROR header                   |High                    |
|Tenure     |Active ownership status (Sthitiban)        |ROR S.3                      |High                    |
|Account    |Current Khatiyan number                    |ROR S.1                      |High                    |
|Account    |Parent Khatiyan(s)                         |ROR S.6                      |High                    |
|Account    |Receiving Khatiyan(s) for transferred plots|ROR S.6                      |High                    |
|Mutation   |Case numbers and years                     |ROR S.6                      |High                    |
|Mutation   |Plots and areas per mutation event         |ROR S.6                      |High                    |
|Plot       |Plot numbers held                          |ROR Page 2                   |High                    |
|Plot       |Land use type (Kisam) per plot             |ROR Page 2                   |High                    |
|Plot       |Area per plot (Decimal)                    |ROR Page 2                   |High                    |
|Plot       |Total area across all plots                |ROR Page 2 aggregate         |High                    |
|Plot       |Rough boundary description                 |ROR Page 2 Chauhaddi         |Medium                  |
|Revenue    |Annual amount due                          |ROR S.4                      |High                    |
|Spatial    |Plot exists in GIS database                |Plot Report                  |High                    |
|Spatial    |Area confirmed in GIS                      |Plot Report                  |High                    |
|Spatial    |Approximate plot shape                     |Plot Report map              |Medium                  |
|Spatial    |Adjacent plot numbers                      |Plot Report map              |Medium                  |
|Consistency|Two govt databases agree on area + owner   |ROR + Plot Report cross-check|High                    |

### What requires additional sources

|What you need                      |Where to get it              |Why critical                              |
|-----------------------------------|-----------------------------|------------------------------------------|
|Mortgages, loans, bank charges     |EC — igrodisha.gov.in        |Land may be pledged to a lender           |
|Registered sale deed history       |Sub-Registrar / EC           |Verify actual transaction happened        |
|Revenue arrears (unpaid Khajana)   |Tehsil office                |Unpaid = government lien                  |
|Mutation order certified copy      |Tehsil office                |Verify Tehsildar actually passed the order|
|Court orders, attachments          |Civil court search           |Disputed title                            |
|Physical boundary demarcation      |Licensed RI / surveyor       |Legal ground-level boundary               |
|Zoning / development plan          |BDA / local authority        |Building permission feasibility           |
|Road widening proposals            |NHAI / BDA                   |Can reduce your plot area post-purchase   |
|ST land restriction (if applicable)|Revenue Dept / tribal affairs|Non-ST cannot buy in Scheduled Areas      |
|Oral/unregistered transactions     |Seller disclosure            |EC won’t show these                       |

-----

## Section 7 — Buyer Watch-Out Summary

**Immediate red flags (do not proceed without resolution):**

- Khewat number ≠ 1 (non-private tenure)
- Owner is ST caste + Mouza is in Scheduled Area
- Multiple owners in same Khatiyan (co-ownership not resolved)
- Section 6 references a Khatiyan you cannot locate
- Area mismatch between ROR and Plot Report
- Kisam is not Gharabari and CLU not obtained
- ROR shows “no plots available” but seller claims it’s active
- Plot Report shows different owner than ROR (mismatch beyond expected lag)

**High-priority verifications before signing:**

- EC for all Khatiyans — minimum 13 years
- Verify all mutation case references can be traced and closed
- Physical demarcation — especially if sub-divided plots involved
- Revenue arrears check at Tehsil
- Adjacent plot owner identification from Bhunaksha map
- BDA zoning clearance for intended use

**Moderate flags (note and monitor):**

- Mutation is very recent (same year as purchase)
- Owner address differs significantly from where land is located
- Multiple rapid transfers in the title chain
- Remaining sibling portion with old owner adjacent to sold portion
- Bhunaksha map shows irregular/narrow shape
- No road access visible on Bhunaksha map on any side

-----

*This document is a comprehensive reference for extracting and interpreting Odisha land records from Bhulekh (ROR) and Bhunaksha (Plot Report). For legal decisions, always engage a qualified property advocate. Verify all records at the relevant Tehsil and Sub-Registrar offices.*

-----

## Section 8 — New Behaviors Discovered (Kasunhia Mouza Sample Set)

*These insights come from a second property set in Mouza Kasunhia, Thana Niradhapatila (No. 4), Tehsil Bhubaneswar (No. 271), District Khordha — accessed 18/06/2026.*

-----

### 8.1 Bhunaksha Panel Interface — Full Behavior

The Bhunaksha portal has two distinct access modes that were not visible in the earlier printout-style plot reports:

**Left panel structure (visible when browsing the live Bhunaksha map):**

```
▼ Info
  District: [code]  Tehsil: [code]
  RI: [code]  Village: [code]
  Sheet No: null null
  Plot No: [number]

  Scale [slider]

▼ Select Report
  ○ Single Plot
  ○ All Plots of same owner

  [Show Report]      ← Opens HTML inline view in same page
  [Show Report PDF]  ← Generates downloadable PDF version
```

**Two report modes:**

|Mode                   |What it does                                                                                                                                                                                 |
|-----------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
|Single Plot            |Generates report for only the selected/clicked plot                                                                                                                                          |
|All Plots of same owner|Generates a combined report showing all plots in the Mouza that belong to the same owner as the selected plot — extremely useful for understanding a buyer’s complete landholding in one view|

**Coding implication:** The “All Plots of same owner” mode is a built-in aggregation feature. If your agent is checking a buyer’s full holdings, this mode can pull all plots in one call instead of fetching each separately. However, it depends on the Bhunaksha database being in sync with the latest Bhulekh mutations.

**Show Report vs Show Report PDF:**

- `Show Report` → renders the plot report inline within the browser panel (HTML)
- `Show Report PDF` → opens/downloads the same report as a PDF — this is the equivalent of the downloadable plot report seen in the earlier samples
- Both buttons may not always be visible in all states of the interface — if a plot has no GIS data, neither may render

-----

### 8.2 NO DATA Scenario — What It Means and What To Do

**Observed:** Plot 137/332/375 (Khatiyan 61/55, Kasunhia) returns `---NO DATA---` in Bhunaksha even though it has a valid ROR entry in Bhulekh.

**Why this happens:**

- Highly sub-divided plots (triple compound numbers like 137/332/375) are the most common cause — the GIS cadastral map has not been updated to reflect the second or third level of sub-division
- The original plot (137) or the first split (137/332) may exist in Bhunaksha, but the further split (137/332/375) is not yet spatially mapped
- This lag is a known systemic issue — cadastral GIS updates trail revenue mutations by months to years

**What NO DATA tells a buyer:**

- The revenue record exists (ROR is valid)
- The spatial record does not exist yet — this plot has no verifiable boundary shape in the government GIS system
- Physical demarcation on the ground is not just recommended but **essential** — there is no reference map to use even as a starting point
- The plot’s neighbors cannot be identified visually from Bhunaksha — you must rely entirely on the Chauhaddi (4-side description) in the ROR

**Coding instruction:**

```
When Bhunaksha returns NO DATA:
  → Flag the plot as "GIS not available"
  → Do NOT treat as invalid — the ROR is the authoritative document
  → Log as requiring physical survey before purchase
  → Attempt to fetch the parent plot number (drop last /XXXX suffix)
     → If parent plot has data, it at least shows the general area
```

-----

### 8.3 Government Khatiyans — How to Identify and What They Mean

**Observed:** Khatiyan 63 in Mouza Kasunhia is a government land Khatiyan holding 9 road plots totalling 1.48 acres.

**How to identify a government Khatiyan:**

|Field                      |Private Khatiyan                      |Government Khatiyan                                                                         |
|---------------------------|--------------------------------------|--------------------------------------------------------------------------------------------|
|Section 2 (Owner)          |Person name + father + caste + address|Government designation only (e.g. “ଵ ର ସ” / Sarkar) — no father’s name, no caste, no address|
|Section 4 (Revenue)        |Amount filled in                      |Often blank — government doesn’t pay land revenue to itself                                 |
|Section 6 (Special Notes)  |Mutation history                      |Often blank — government holdings rarely mutate                                             |
|Publication / fixation date|May be recent or old                  |Typically very old (1970s) — these are original survey-era government holdings              |
|Kisam of plots             |Gharabari / agricultural / mixed      |Danga (ଡ଼ଙ୍ଗ) + description “Rasta” (ରାସ୍ ତ) = Road; or “KHA” = Khas government land             |

**“KHA” on Bhunaksha maps:**
The label “KHA” appearing as a plot label or in the boundary description = **Khas land** = government/unassigned revenue land. It is not privately owned. When “KHA” borders your plot, it means one side abuts government land — which can be a positive (no private neighbor dispute) or a risk (government can claim/use it).

**Why this matters to a buyer:**

1. **Road identification:** If an adjacent plot on the Bhunaksha map belongs to a government Khatiyan with Kisam = Danga and description = Rasta, that is a confirmed road. This is how you answer “where is the road relative to this plot?”
1. **Buffer/neighbor context:** A plot adjacent to government Khas land (KHA) on one side has more flexibility on that side — no private owner to dispute. But verify it isn’t earmarked for a road widening or government project.
1. **Government plots cannot be purchased.** If any of the plots being offered for sale trace back to or include a government Khatiyan reference, that is a serious red flag.

**Coding instruction — road detection algorithm:**

```
For each adjacent plot number visible on the Bhunaksha map:
  → Look up that plot number in Bhulekh (same Mouza)
  → Check Section 2 of the returned Khatiyan:
      → If owner = Government designation → government plot
  → Check Kisam of that plot in Page 2:
      → If Kisam = Danga/Rasta → this adjacent plot is a ROAD
      → If Kisam = Danga + "KHA" description → government land buffer
  → Tag the direction of this plot relative to subject plot
     (N/S/E/W from Bhunaksha map orientation)
  → Output: "Road access confirmed on [direction] side"
```

-----

### 8.4 Identifying Road Access and Neighbors — Complete Methodology

This is the most actionable use of the ROR + Bhunaksha combination for a buyer.

**Step 1 — From Bhunaksha map, extract adjacent plot numbers**
The cadastral map shows every neighbouring plot with its number. Note all adjacent plot numbers and their approximate direction (N/S/E/W) relative to the subject plot using the north arrow.

**Step 2 — From ROR Chauhaddi (Page 2, Column 9), get textual boundary description**
When populated, the Chauhaddi names features on each of the four sides. Look for:

- Plot numbers named = specific neighbours
- “Rasta” = road on that side
- “Nadi” / “Jhara” = river/stream
- “KHA” = government land

**Step 3 — Cross-reference adjacent plot numbers with Bhulekh**
For each adjacent plot number from Step 1:

- Search Bhulekh in the same Mouza
- Note the owner, Kisam, and Section 6 notes
- If Kisam = Danga + Rasta → road
- If owner = government → government land
- If Kisam = Gharabari → private residential neighbour
- If Kisam = agricultural → private farm neighbour

**Step 4 — Reconstruct the neighbourhood picture**
Combine all the above into a directional map:

```
Example output:
  North: Plot 80 (private, agricultural — Khatiyan XX, owner YY)
  South: Plot 308 (government, Rasta = ROAD ← confirmed access)
  East:  KHA (government khas land)
  West:  Plot 19/315/378 (private, Gharabari — Khatiyan ZZ, owner WW)
```

**What this tells a buyer:**

- Road access confirmed: yes (south side, Plot 308 = road)
- Neighbours: specific owners identified, their land use known
- Any government land adjacent: yes (east = KHA)
- Risk of boundary dispute: highest with private neighbours sharing new/fresh boundaries

-----

### 8.5 How to Save and Reproduce the Bhunaksha Map

**Problem:** The Bhunaksha interface does not always show a Print or Save button, and the inline view is rendered dynamically.

**Methods to save:**

|Method                 |How                                                                                           |When to use                                     |
|-----------------------|----------------------------------------------------------------------------------------------|------------------------------------------------|
|Show Report PDF        |Click “Show Report PDF” button in the left panel                                              |When the button is visible and plot has GIS data|
|Screenshot             |Screenshot the browser with the map rendered                                                  |Universal fallback — always works               |
|Direct URL construction|Construct the plot report URL using GIS code + plot number → the PDF endpoint renders directly|When you know the GIS code and plot number      |
|Parent plot fallback   |If compound plot shows NO DATA, construct URL for parent plot number                          |When sub-divided plot has no GIS data           |

**Direct URL for PDF report:**

```
https://app3bhunakshaodisha.nic.in/bhunaksha/21/plotreportOR.jsp
  ?state=21
  &giscode=[GIS_CODE]
  &plotno=[PLOT_NUMBER]
```

This URL directly renders the printable plot report — same as clicking the link from the ROR. Bookmarkable and reproducible.

**Coding instruction — map image capture:**

```
Method 1 (preferred): Follow the Bhunaksha URL from the ROR anchor tag
  → The page that loads contains the plot report HTML
  → The cadastral map is rendered as an <img> or <canvas> element
  → Extract the img src URL → download and store the map image

Method 2 (fallback for NO DATA):
  → Fetch parent plot (drop last /XXXX from compound number)
  → If parent plot has data, download that map with a note
     that it shows the broader area before the sub-division

Method 3 (panel interface):
  → Navigate to app3bhunakshaodisha.nic.in
  → Select District → Tehsil → RI → Village → enter plot number
  → Wait for panel to render
  → Click "Show Report PDF" → intercept the PDF download
```

-----

### 8.6 Multiple Co-Owners — Identification and Implications

**Observed:** Khatiyans 61/55, 61/98, and 11 in Kasunhia all have multiple co-owners listed in Section 2.

**Format in Section 2 (co-ownership):**

```
Owner1 O: Father1, Owner2 O: Father2, Owner3 O: Father3
Ba: [shared address]
```

Where:

- Each co-owner is listed with their father’s name after “O:”
- Multiple owners separated by commas or on separate lines
- A shared address appears at the end

**What this means:**

- All co-owners hold **joint, undivided interest** in the land
- Every co-owner must sign the sale deed — one owner cannot sell on behalf of others without Power of Attorney
- If any co-owner is deceased → legal heir certificate needed from their successors
- If any co-owner is a minor → court permission needed to sell
- If any co-owner disputes the sale → the entire transaction can be challenged

**Coding instruction:**

```
When parsing Section 2:
  → Count occurrences of "O:" pattern
  → If count > 1 → co-ownership flag
  → Extract each name+father pair
  → Log total number of co-owners
  → Flag: "All [N] co-owners must be verified and must sign"
```

-----

### 8.7 Triple Compound Plot Numbers

**Observed:** Plots like 137/332/375, 87/330/374, 7/336/373 in Khatiyan 61/55.

**What this means:**

- Original plot: 137
- First split: 137 split → 137/332 created (first mutation)
- Second split: 137/332 split → 137/332/375 created (second mutation)
- Each level of `/XXXX` suffix = one mutation/sub-division event

**Implications:**

- The plot has been sub-divided at least twice from its original size
- Each split required a separate Dakhal Kharaj case
- There may be multiple sibling plots at each level (137/332 may have a sibling 137/333; 137/332/375 may have a sibling 137/332/376)
- Bhunaksha often cannot map these — NO DATA is common for triple-compound plots
- The area at each level is a fraction of the original — triple compound plots tend to be very small

**Area in this case:** 137/332/375 = only 0.013 acres = 566 sq ft — extremely small.

-----

### 8.8 Area Display Format — ROR vs Bhunaksha

**Observed discrepancy:** The same plot area is displayed differently in ROR and Bhunaksha:

- ROR decimal column: `3500` → means 0.3500 acres
- Bhunaksha decimal field: `350` → means 0.350 acres (same value, 3-digit display)
- Both cross-check: 0.3500 acres × 0.4047 = 0.14165 hectare ✓

**The rule:**

- ROR always uses a **4-digit decimal display** (e.g. 1000, 3500, 0380)
- Bhunaksha uses a **3-digit or variable display** (e.g. 100, 350, 380)
- Both represent the same underlying value — divide by 10000 (ROR) or 1000 (Bhunaksha) to get acres

**Coding instruction:**

```
Normalize area before cross-checking:
  ROR decimal value:      divide by 10000 → acres
  Bhunaksha decimal value: divide by 1000 → acres
  Cross-check: |ROR_acres - Bhunaksha_acres| < 0.001 → match
```

-----

### 8.9 Additional Kisam Types Observed

Beyond Gharabari, the Kasunhia samples reveal more land classification types:

|Kisam                 |Meaning                      |Buyer implication                           |
|----------------------|-----------------------------|--------------------------------------------|
|Bagayat Tini (ବଗାୟତ ଟିନି)|Garden/orchard land — class 3|Agricultural — needs CLU before construction|
|Bagayat Dhua (ବଗାୟତ ଦୁଆ)|Garden/orchard land — class 2|Agricultural — needs CLU                    |
|Sharad Tini (ଶାରଦ ଟିନି)  |Seasonal crop land — class 3 |Agricultural — lower productivity class     |
|Danga (ଡ଼ଙ୍ଗ) with Rasta |Road/path                    |Government — not purchasable                |
|Bisahi / Topfal       |Higher-grade agricultural    |Investigate before assuming buildable       |

-----

### 8.10 Old Khatiyans — Publication Date and Revenue Fixation Date

**Observed:** Khatiyans 11, 63, and 61/98 show:

- Final publication date: 23/11/1973
- Revenue fixation date: 01/04/1974

**What these dates mean:**

- Publication date = when this Khatiyan was officially published during the original survey/settlement
- Revenue fixation date = when the annual revenue amount was set

**Implications for a buyer:**

- A 1973 publication date means this is an original survey-era Khatiyan — it predates digitization
- The ROR on Bhulekh is a digital scan/entry of this old record
- Cross-verification with physical Tehsil records is more important for old accounts
- Any mutation case after 1973 has updated this account — those are the critical things to trace
- Section 5 (progressive revenue) may have actual escalation schedules in old Khatiyans

-----

## Section 9 — Updated Coding Instructions (Comprehensive)

```
COMPLETE FLOW:

INPUT: Khatiyan number + Mouza + Tehsil + District

STEP 1: Load ROR page (Bhulekh)
  URL: https://bhulekh.ori.nic.in/SRoRFront_Uni.aspx
  → Navigate: District → Tehsil → RI Circle → Mouza → search by Khatiyan No.

STEP 2: Parse Page 1 — extract all fields
  → Location: Mouza, Thana (+ number), Tehsil (+ number), District, Khewat No.
  → Section 1: Khatiyan number
  → Section 2: Owner(s) — detect co-ownership (count "O:" patterns), name, father, caste, address
  → Section 3: Swatwa status
  → Section 4: Revenue amounts (Khajana, Cess, total)
  → Section 6: ALL mutation entries — parse each:
       - Case number + year
       - Plot number
       - Area (4-digit decimal format — divide by 10000 for acres)
       - Direction (ru = incoming from old Khata, ku = outgoing to new Khata)
       - Old/new Khatiyan reference → enqueue for recursive lookup

STEP 3: Check for dead account
  → If Page 2 shows "ଏହି ଖାତାରେ ପ୍ଲଟ ଉପଲବ୍ଧ ନାହିଁ" → mark inactive, log, stop

STEP 4: Parse Page 2 — plot listing
  → For each data row (skip header and aggregate rows):
       - Extract plot number text
       - Detect compound number (contains "/") → flag sub-division level (count "/" separators)
       - Extract Kisam
       - Extract area: Acres column + Decimal column + Hectare column
       - Normalize decimal: value / 10000 = acres
       - Extract Chauhaddi (column 9) if populated
       - Extract anchor tag href → Bhunaksha URL
  → Extract aggregate row → total plots count, total area
  → Verify: sum of individual areas = aggregate area (flag mismatch)

STEP 5: Classify the Khatiyan type
  → Check Section 2:
       If no personal name / government designation → GOVERNMENT KHATIYAN
       If Kisam of all plots = Danga + Rasta description → ROAD KHATIYAN
  → Check Khewat No.: if ≠ 1 → non-private tenure flag

STEP 6: For each plot with a Bhunaksha anchor:
  → Follow href to Bhunaksha plot report
  → Check for "NO DATA" response:
       If NO DATA → flag as "GIS unavailable"
       If NO DATA + compound plot → retry with parent plot number
  → If data available, parse:
       - Plot number (verify matches ROR)
       - Khatiyan number (may be blank — use ROR as truth)
       - Area decimal (3-digit format — divide by 1000 for acres)
       - Cross-check: |ROR_acres - Bhunaksha_acres| < 0.001 → OK; else flag
       - Owner name (verify matches ROR Section 2)
       - Extract all adjacent plot numbers from the map
       - Download/save the cadastral map image
       - Note scale value

STEP 7: Road and neighbour analysis
  → For each adjacent plot number from the Bhunaksha map:
       → Look up in Bhulekh (same Mouza)
       → Check owner (government = road/KHA candidate)
       → Check Kisam (Danga + Rasta = road confirmed)
       → Assign direction (N/S/E/W from map orientation)
  → Output structured neighbour table:
       Direction | Plot No. | Owner type | Kisam | Road? | Owner name

STEP 8: Red flag evaluation
  → Co-owners > 1 → flag all names, require all signatures
  → Compound plot NO DATA in GIS → flag, require physical survey
  → Area mismatch ROR vs Bhunaksha → flag for Tehsil verification
  → Government/non-private Khatiyan → flag, not purchasable
  → Missing Khatiyan in title chain → flag, enqueue for manual lookup
  → Mutation year = current year → flag as very fresh
  → Old Khatiyan with no Section 6 entries but recent owner → investigate
  → Remaining area with old owner in parent Khatiyan → flag shared new boundary

STEP 9: Recursive title chain
  → All Khatiyan numbers from Section 6 → enqueue
  → Fetch each, run through same steps
  → Stop condition: Khatiyan shows no Section 6 entries (root/original account)
     OR Khatiyan is government type
     OR already visited (cycle detection)
```

-----

## Section 10 — Complete New Kisam + Bhunaksha Behavior Reference

### Kisam Master List

|Kisam                 |Category                       |Buildable?                |Notes                                      |
|----------------------|-------------------------------|--------------------------|-------------------------------------------|
|Gharabari (ଘରବାରି)      |Residential                    |Yes — no conversion needed|Best for purchase                          |
|Bagayat Tini (ବଗାୟତ ଟିନି)|Agricultural (garden, class 3) |No — CLU needed           |Common in older holdings                   |
|Bagayat Dhua (ବଗାୟତ ଦୁଆ)|Agricultural (garden, class 2) |No — CLU needed           |Slightly better soil class                 |
|Sharad Tini (ଶାରଦ ଟିନି)  |Seasonal agricultural (class 3)|No — CLU needed           |Lower productivity                         |
|Chashi (ଚାଷ)           |Cultivated agricultural        |No — CLU needed           |Standard farmland                          |
|Danga (ଡ଼ଙ୍ଗ)            |Elevated dry land              |Usually no                |Government or private, check Kisam sub-type|
|Danga + Rasta         |Road                           |No                        |Government — not purchasable               |
|Pokhari (ପୋଖରୀ)         |Water body                     |No                        |Environmental clearance required to fill   |
|Jungle (ଜଙ୍ଗଲ)          |Forest                         |No                        |Forest clearance required                  |
|Anabadi (ଅନାବାଦି)        |Waste/uncultivated             |Investigate               |Verify zoning before assuming buildable    |

### Bhunaksha Behavior Summary

|Situation                          |What you see                                        |What to do                                                           |
|-----------------------------------|----------------------------------------------------|---------------------------------------------------------------------|
|Plot has GIS data                  |Full plot report with map                           |Download PDF or screenshot, parse all fields                         |
|Plot has NO DATA                   |“—NO DATA—” text                                    |Flag GIS unavailable, retry with parent plot, require physical survey|
|Adjacent plot = KHA on map         |“KHA” label                                         |Government khas land — look up in Bhulekh to confirm                 |
|“All Plots of same owner” selected |Combined report for all plots of that owner in Mouza|Use to get complete holding picture in one step                      |
|Show Report PDF not visible        |No PDF button                                       |Use direct URL construction to fetch PDF; screenshot as fallback     |
|Plot number matches but area ≠     |Mismatch between ROR and Bhunaksha                  |Flag for Tehsil verification — data sync lag or entry error          |
|Khatiyan field blank in Plot Report|Header shows no Khatiyan number                     |Use the ROR Khatiyan number as source of truth                       |

-----

## Section 11 — Bhunaksha Portal: Full Interface Map

*Discovered from live portal screenshots (app3bhunakshaodisha.nic.in, 18/06/2026)*

### 11.1 Answer to the RI Question

Image 4 (Home panel) reveals the full navigation hierarchy with codes:

```
State:    Odisha
District: 20  — Khordha
Tehsil:   2   — Bhubaneswar
RI:       10  — Chandaka       ← RI Chandaka, code 10
Village:  76  — Chandaka
Sheet No: 18
```

**For Mouza Mendhashala: the correct RI Circle on Bhunaksha is Chandaka (code 10).** Mendhashala is a village/Mouza under RI Chandaka. On the Bhulekh portal, select Chandaka from the RI dropdown under Tehsil Bhubaneswar, then find Mendhashala in the Village list.

-----

### 11.2 Complete Bhunaksha Navigation Hierarchy

The portal uses a 6-level hierarchy before reaching a plot:

```
State (fixed: Odisha)
  └── District (dropdown — code + Odia name, e.g. "20 Khordha")
        └── Tehsil (dropdown — code + Odia name, e.g. "2 Bhubaneswar")
              └── RI (dropdown — code + Odia name, e.g. "10 Chandaka")
                    └── Village (dropdown — code + Odia name, e.g. "76 Chandaka")
                          └── Sheet No (numeric — e.g. 18)
                                └── Plot Info (text input for plot number)
```

**Sheet No** is a cadastral sheet number — within a single village, the land is divided into numbered sheets (physical map sheets). Each sheet covers a portion of the village area. This is a new navigation level not visible in

### 11.3 Themes Panel — Area-Based Visual Filtering

The Themes panel provides visual filtering of the map by plot area:

|Theme    |What it highlights                     |
|---------|---------------------------------------|
|General  |All plots displayed normally           |
|area < 1 |Small plots highlighted with red marker|
|Area > 10|Large plots highlighted differently    |

**Buyer use:** Switching to area-based theme gives immediate visual sense of plot size distribution in a neighbourhood. Sub-divided plots cluster in the “area < 1” theme.

-----

### 11.4 Layers Panel — Advanced Map Layers

|Layer                     |What it shows                                    |Buyer value                                            |
|--------------------------|-------------------------------------------------|-------------------------------------------------------|
|Vertices                  |Survey triangulation corner points               |Confirms plot corner positions used in official survey |
|Border Length             |Actual edge lengths of each plot boundary        |Lets you estimate real dimensions even without visiting|
|Border Length (Normalized)|Same, normalized for comparison                  |Useful for comparing irregular plots                   |
|PNIU                      |Plot Number Index Unit — unique parcel identifier|Alternative lookup key; PNIU field allows direct search|
|**Pending For Approval**  |Plots with pending mutation orders               |Critical for buyers — see below                        |

**“Pending For Approval” is the most important layer for buyers.** If the plot you are considering is highlighted here, a mutation has been applied for but not finalised. Someone else may have already applied to transfer this land. Do not proceed without understanding what the pending case is.

-----

### 11.5 Satellite Base Layer (Google Map / Bing Maps)

Cadastral plot boundaries can be overlaid on satellite imagery. This reveals:

|What you see on satellite            |What it tells you                                  |
|-------------------------------------|---------------------------------------------------|
|Existing construction within boundary|Land is not vacant — verify ownership of structures|
|Structures crossing plot boundaries  |Encroachment by or onto the plot                   |
|Road visible matching road plot      |Confirms road access on the ground                 |
|Water body visible                   |Confirms water classification if shown in ROR      |
|Dense neighbourhood                  |Better infrastructure, higher market value         |

-----

## Section 12 — Bulk Download and Database Building

### 12.1 The Short Answer

**No official public API or bulk download exists** for Bhunaksha or Bhulekh. The underlying data is in PostgreSQL served via GeoServer, but not publicly exposed. The portals are designed for per-plot citizen lookup, not bulk extraction.

-----

### 12.2 What IS Technically Possible

**Approach 1 — Bhulekh as index, Bhunaksha for spatial**

```
PHASE 1: Build Khatiyan index for a Mouza
  → Khatiyan numbers follow [MOUZA_CODE]/1, /2, /3...
  → Iterate from 1 upward; stop after N consecutive failures
  → Captures all Khatiyan records for the Mouza

PHASE 2: Each Khatiyan → get all plots
  → Parse Page 2 → extract plot numbers + Bhunaksha URLs

PHASE 3: Each plot → fetch Bhunaksha report
  → Follow anchor href from ROR
  → Parse area, owner, map image URL

PHASE 4: Store in database
```

**Approach 2 — Sheet-by-sheet Bhunaksha enumeration**

```
For each Village:
  → Iterate Sheet Nos (1 to max — typically under 50 per village)
  → Each sheet's map renders all plot polygons as SVG with plot numbers
  → Parse SVG → extract complete plot number list for that sheet
  → Batch-fetch plot reports for all extracted plot numbers
```

**Approach 3 — ORSAC Geospatial Portal (best for bulk GIS)**

ORSAC (Odisha Space Applications Centre) built a 1:4000 scale cadastral database for the entire state. Portal: **odisha4kgeo.in** — explicitly built for data dissemination.

- Check `https://odisha4kgeo.in/mapview/BoundaryView` for WMS/WFS endpoints
- If WFS is available: GetFeature request returns plot polygons in GML/GeoJSON for entire areas
- This is the cleanest bulk source if accessible

**Approach 4 — RTI (Right to Information) Request**

The legitimate bulk access route. File an RTI with Revenue & Disaster Management Department, Odisha, requesting shapefile/CSV data for specific Mouzas. Government is obligated to provide public data. Also check data.gov.in for published Odisha land record datasets.

-----

### 12.3 Recommended Database Schema

```sql
CREATE TABLE khatiyans (
  id             SERIAL PRIMARY KEY,
  khatiyan_no    VARCHAR(20),        -- e.g. "607/4532"
  mouza          VARCHAR(100),
  tehsil         VARCHAR(100),
  tehsil_no      VARCHAR(10),
  thana          VARCHAR(100),
  thana_no       VARCHAR(10),
  district       VARCHAR(100),
  khewat_no      VARCHAR(10),        -- "1" = private raiyati
  owner_names    TEXT[],             -- array for co-owners
  caste          VARCHAR(50),
  owner_address  TEXT,
  swatwa         VARCHAR(50),
  khajana        DECIMAL(10,2),
  cess           DECIMAL(10,2),
  total_revenue  DECIMAL(10,2),
  is_government  BOOLEAN DEFAULT FALSE,
  is_active      BOOLEAN,
  pub_date       DATE,
  rev_fix_date   DATE,
  fetched_at     TIMESTAMP,
  raw_html       TEXT
);

CREATE TABLE plots (
  id               SERIAL PRIMARY KEY,
  khatiyan_id      INTEGER REFERENCES khatiyans(id),
  plot_no          VARCHAR(30),
  parent_plot_no   VARCHAR(30),
  subdivision_lvl  INTEGER,
  kisam            VARCHAR(50),
  area_decimal     DECIMAL(10,4),
  area_sqft        DECIMAL(10,2),
  area_hectare     DECIMAL(10,4),
  chauhaddi        TEXT,
  gis_code         VARCHAR(20),
  bhunaksha_url    TEXT,
  gis_available    BOOLEAN,
  map_image_url    TEXT,
  gis_area_decimal DECIMAL(10,4),
  area_match       BOOLEAN,
  fetched_at       TIMESTAMP
);

CREATE TABLE mutations (
  id              SERIAL PRIMARY KEY,
  khatiyan_id     INTEGER REFERENCES khatiyans(id),
  case_no         VARCHAR(20),
  case_year       INTEGER,
  plot_no         VARCHAR(30),
  area_decimal    DECIMAL(10,4),
  direction       CHAR(3),           -- 'in' or 'out'
  linked_khatiyan VARCHAR(20)
);

CREATE TABLE neighbours (
  id                SERIAL PRIMARY KEY,
  plot_id           INTEGER REFERENCES plots(id),
  direction         CHAR(1),          -- N/S/E/W
  adjacent_plot_no  VARCHAR(30),
  adjacent_khatiyan VARCHAR(20),
  is_road           BOOLEAN,
  is_government     BOOLEAN,
  owner_name        VARCHAR(200),
  kisam             VARCHAR(50)
);

CREATE TABLE plot_flags (
  id          SERIAL PRIMARY KEY,
  plot_id     INTEGER REFERENCES plots(id),
  flag_type   VARCHAR(50),
  -- Types: NO_GIS, AREA_MISMATCH, CO_OWNED, FRESH_MUTATION,
  --        PENDING_MUTATION, NON_GHARABARI, SIBLING_REMAINS,
  --        GOVT_ADJACENT, ROAD_ACCESS_CONFIRMED
  flag_detail TEXT,
  created_at  TIMESTAMP DEFAULT NOW()
);
```

-----

### 12.4 Practical Scraping Notes

```
Rate limiting:    1–2 requests/second; add random jitter (0.5–2s)
Caching:          Cache all responses locally — avoid re-fetching
Timing:           Off-peak hours (early morning / late night IST)
Error handling:   503/504 are common on NIC portals — retry with backoff
Mirror servers:   app1.bhunakshaodisha.nic.in and
                  app3.bhunakshaodisha.nic.in — rotate if one is slow
Protocol:         HTTP (not HTTPS) — "Not Secure" as seen in screenshots
IP logging:       NIC logs requester IP on every ROR page footer
                  Use consistent IP; do not rotate aggressively
Legal note:       No explicit ToS prohibition; be polite to government infra
                  RTI is the legitimate route for bulk data
```

-----

### 12.5 RI Code Reference (Confirmed from Portal)

For Tehsil Bhubaneswar (Code 2), District Khordha (Code 20):

|RI Code|RI Name         |Notes                                                        |
|-------|----------------|-------------------------------------------------------------|
|10     |Chandaka        |Confirmed — covers Mendhashala, Kasunhia Mouzas              |
|Others |To be enumerated|Navigate Bhunaksha Home panel → RI dropdown for complete list|

The RI code is part of the GIS code structure:

```
GIS Code: 2  00  2  10  [VILLAGE_CODE]  [MOUZA_CODE]
                     ↑
                RI Code 10 = Chandaka
```