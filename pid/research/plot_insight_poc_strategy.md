# Plot Insight POC Strategy

Date: 2026-05-26

Purpose: define the first proof of concept for turning the current raw corpus into evidence-backed plot-purchase risk candidates that can later be matched against a buyer's specific plot/RoR/details.

This is not legal advice, not a buyer-facing report, and not final synthesis. It is the bridge between raw corpus collection and a future pattern matching engine.

## Objective

Given a buyer's plot details, the POC should answer:

> Which known evidence patterns in the corpus resemble this plot's facts, what source artifacts support the match, and what still needs human/OCR review before the signal can become a stronger insight?

The system must match on features, not places. Village, tahasil, and district are retrieval/matching fields, not risk reasons by themselves.

## Current Corpus Available For POC

| Source | Current Sample | POC Use |
|---|---:|---|
| ORERA project records | 1,170 projects | project/promoter lookup and registration context |
| ORERA agents | 370 agents | agent registration checks where buyer has broker/agent name |
| ORERA detail sample | 50 projects, 215 land/plot rows | plot, khata, mouza, title flow, land facts, owner/share facts |
| ORERA documents | 199 PDFs collected from 200 prioritized attempts | EC/RoR/POA/share/sale/certificate evidence queue |
| Revenue land acquisition | 40 parsed rows, 4 PDFs | acquisition/government-notice candidate matching |
| Revenue SIA 4(1) | 40 parsed rows, 4 PDFs | early acquisition/social-impact candidate matching |
| DRT Cuttack | 139 parsed case rows | seller/promoter/entity debt-dispute candidate matching |
| Bhunaksha WFS | 41 spatial features | plot/area/boundary candidate matching |

## POC Data Flow

1. **Raw artifact**
   Store every source response or PDF with hash, source URL, run date, and manifest row.

2. **Parsed source fact**
   Extract stable fields without making risk claims. Examples: plot number, khata, mouza, owner rows, POA flag, sale deed flag, project name, promoter name, DRT party names.

3. **Candidate signal**
   Convert a source fact into a reviewable warning candidate. Example: "POA exists but sale deed is not declared" is a candidate signal, not proof of fraud.

4. **Pattern family**
   Map related signals to a recurring issue theme. Example: POA chain + sale deed gap + owner share mismatch maps to title-authority/title-chain review.

5. **Buyer match**
   Match buyer-provided plot/RoR/deed facts against the candidate corpus using exact identifiers first, then entity/name similarity, then supporting spatial/context fields.

6. **Risk card**
   Produce an evidence-backed card with matched facts, source artifacts, confidence, and next verification step.

## Buyer Input Fields For Matching

Minimum useful input:

| Field | Why It Matters |
|---|---|
| district, tahasil, mouza/village | narrows official-record retrieval; not a risk reason |
| khata number | strongest RoR/land-record anchor |
| plot number | strongest parcel anchor |
| buyer-provided RoR owner rows | owner/share consistency |
| seller name | seller-vs-owner and litigation/entity checks |
| project name or RERA registration number | ORERA project/detail join |
| promoter/developer name | ORERA/DRT/entity matching |
| POA registration number/date, if sale is through POA | authority-chain matching |
| sale deed number/date, if available | transaction-chain matching |
| EC period and party names, if available | repeated sale, charge, and transfer-chain checks |

## First Candidate Signal Families

### 1. Title Authority / POA Chain

Current ORERA metadata can detect:

- POA present in project land row.
- POA present but sale deed not declared.
- POA registration number/date/place.
- title flow mentions development agreement, derived plot, gifting/road, or subdivision.

Mapped seed patterns:

- `A-06` PoA Authority Defect, but only as a candidate until the POA/deed text is reviewed.
- `A-03` Succession / unrecorded heirs where owner chain suggests inherited or representative authority.
- `A-05` Multiple sale / double registration only after EC/deed text shows conflicting transfers.

POC output should say:

> "POA-dependent chain; verify authority scope and sale deed linkage."

It should not say:

> "Fraudulent POA."

### 2. Ownership Share / Co-Owner Review

Current ORERA metadata can detect:

- owner rows and declared owner shares.
- owner share total below full ownership.
- owner/share facts that need comparison with buyer RoR and sale deed.

Mapped seed patterns:

- `A-01` Undisclosed Co-Owner / Partial Title Sale.
- `A-03` Succession / unrecorded heirs, if future OCR/manual review shows missing heir chain.

POC output should say:

> "Declared owner shares do not add up to full ownership in this ORERA land row; verify all co-owners/shareholders joined the transaction."

### 3. Document Completeness / Evidence Gap

Current ORERA metadata can detect:

- EC file ID declared.
- RoR file ID declared.
- POA file ID declared.
- sale deed missing/not declared.
- PDF collected vs declared but not fetched in the capped run.

Mapped seed patterns:

- This is a review-priority signal, not a fraud pattern by itself.
- It decides what evidence must be requested from buyer/seller before stronger pattern matching.

POC output should say:

> "EC/RoR file exists but content review is pending" or "RoR file ID declared but PDF not yet collected."

### 4. Acquisition / Regulatory Notice Overlay

Current Revenue/SIA data can detect:

- public acquisition/SIA notice title/date/letter number.
- PDF artifact existence.
- village/tahasil/district text after PDF OCR.

Mapped seed patterns:

- `B-04` LARR corridor / acquisition risk.
- regulatory notice proximity, only after plot or village text is parsed and matched.

POC output should say:

> "Revenue/SIA notice candidate in same administrative context; needs PDF text extraction and plot/village linkage."

### 5. Financial Distress / DRT Entity Match

Current DRT data can detect:

- case rows and party strings from seed cause lists.
- forum/case date/source artifact.

Mapped seed patterns:

- `C-04` DRT / SARFAESI Distress.
- `C-01`/`C-02` only after CERSAI or EC mortgage evidence is added.

POC output should say:

> "Promoter/seller name resembles DRT party; needs borrower/entity confirmation."

### 6. Boundary / Area Consistency

Current Bhunaksha sample can detect:

- WFS feature geometry.
- plot-like spatial feature rows in a bounding box.

Mapped seed patterns:

- `D-01` Boundary Encroachment / area mismatch, only after buyer plot geometry or Bhunaksha plot IDs align.

POC output should say:

> "Plot/area geometry comparison pending; not enough for a dispute signal yet."

## Matching Logic For First POC

Use a staged score, with exact parcel matches outranking fuzzy entity matches.

| Stage | Match Type | Examples | Strength |
|---|---|---|---|
| 1 | Exact parcel | mouza + khata + plot | strongest |
| 2 | Official project | RERA registration number, project ID, project name + promoter | strong |
| 3 | Document reference | POA registration number, sale deed number, EC file/party names | strong after OCR/manual review |
| 4 | Entity | seller/promoter/owner/agent names | medium; fuzzy matching allowed but review required |
| 5 | Context | tahasil/district/date range/source theme | weak; cannot be used alone |

First POC scoring:

```text
exact_plot_match          +50
khata_mouza_match         +35
rera_registration_match   +35
project_promoter_match    +25
poa_registration_match    +25
owner_name_match          +20
seller_promoter_match     +15
same_tahasil_context       +5
same_district_context      +2
```

No card should be produced from context-only matching. A card needs at least one exact parcel, document, project, or entity match.

## Generated POC Output

Script:

```bash
node pid/analysis/orera-insight-poc.mjs
```

Generated files:

```text
pid/research/generated/orera_50_pattern_candidates.json
pid/research/generated/orera_50_pattern_candidates.md
```

Current output summary:

| Metric | Count |
|---|---:|
| Projects | 50 |
| ORERA land/plot rows | 215 |
| Candidate cards | 215 |
| Candidate signals | 945 |
| EC PDFs collected | 128 |
| RoR PDFs collected | 40 |
| EC file IDs declared but not collected | 87 |
| RoR file IDs declared but not collected | 175 |
| POA without declared sale deed signals | 153 |
| partial owner-share review signals | 162 |
| complex title-flow signals | 14 |

These are metadata-level candidates. They are good enough to design matching and review queues, but not enough for final fraud/dispute claims until OCR/manual review confirms document contents.

## Example Risk Card Shape

```json
{
  "pattern_family": "title_authority",
  "signal_id": "ORERA_POA_WITHOUT_DECLARED_SALE_DEED",
  "matched_buyer_fields": ["mouza", "khata_no", "plot_no", "poa_regn_no"],
  "buyer_impact": "review",
  "confidence": "metadata_high_review_required",
  "evidence_refs": [
    "pid/data/raw/orera/2026-05-26-orera-50/artifacts/project-1878-doc-250157-poaid.pdf",
    "pid/data/raw/orera/2026-05-26-orera-50/extracted/project-1878-land-details_decoded.json"
  ],
  "explanation": "ORERA land metadata shows this plot/project chain depends on POA, while sale deed is not declared in the land row. Verify POA authority, executant/holder, revocation/death risk, and sale deed linkage."
}
```

## What Must Be Added Before Stronger Insight Generation

1. PDF OCR/text extraction for ORERA EC, RoR, POA, sale deed, Revenue/SIA notices.
2. A normalized `property_identity` model: district, tahasil, mouza, khata, plot, old plot, derived plot.
3. A normalized `entity_identity` model: owner, seller, promoter, POA executant, POA holder, borrower, lender.
4. Evidence-level promotion rules: metadata candidate -> OCR-confirmed fact -> human-reviewed pattern.
5. A test buyer-input JSON with 5-10 known plots to verify matching behavior.
6. No buyer-facing wording until the cards pass human review and evidence-level gates.

## OCR POC Follow-Up

The first PDF text/OCR POC is documented in `pid/research/pdf_text_ocr_poc_2026-05-26.md`.

Key finding: ORERA evidence PDFs are mostly image-based. `tesseract.js` can recover useful text from at least some RoR PDFs, but EC/POA/deed extraction needs page-image extraction, orientation handling, Odia language support, and field-level review.

Until that pipeline is stronger, the candidate cards generated here should remain metadata-level review prompts, not final fraud/dispute conclusions.
