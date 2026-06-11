# PID_PHASE0_SOURCE_FEASIBILITY_PLAN.md
# Phase 0 — Source Feasibility and Seed Corpus Plan

> Purpose: operational checklist for validating PID data sources before schema
> finalization or scraper implementation.

---

## 1. Phase 0 Goal

Build a seed corpus of 25-50 evidence records that show real plot-purchase failure
modes. Each record should preserve the source artifact, parsed facts, theme labels, and
review notes.

Phase 0 answers:

- What sources can we actually access?
- What fields do those sources reliably provide?
- Which issue themes can each source support?
- Which sources need manual/operator workflows?
- What schema is needed for real evidence, not hypothetical scraper output?

---

## 2. Required Seed Mix

| Bucket | Target Count | Evidence Type | Purpose |
|---|---:|---|---|
| Bhulekh RoR examples | 5 | RoR pages/artifacts with ownership, kisam, area, remarks, mutation/case anchors | Land-record and classification themes |
| District eCourts examples | 5 | Case status/order artifacts involving title, partition, boundary, sale, possession, or fraud | Court dispute theme extraction |
| Orissa High Court examples | 3 | Case/order artifacts involving land, title, acquisition, SARFAESI, revenue writs | Statewide litigation themes |
| DRT/DRAT examples | 3 | Bank recovery/SARFAESI/security-interest cases | Financial distress and encumbrance themes |
| CERSAI examples | 3 | Active, satisfied, and no-result public search examples | Charge-status evidence model |
| IGR/EC/deed examples | 3 | EC, deed, PoA, mortgage, partition, gift, or sale artifacts | Registered transaction model |
| Regulatory/acquisition examples | 3 | LARR/SIA/Gazette/zoning/forest/flood/project notices | Planning and public-purpose themes |
| Manual reviewed cases | 5 | Lawyer/operator/broker known-case notes with source references | High-quality labels and edge cases |

Minimum pass: 25 reviewed examples across at least 6 buckets.

Preferred pass: 50 reviewed examples across all buckets.

---

## 3. Per-Example Capture Template

Use this for every seed example:

```yaml
example_id:
source_bucket:
source_name:
source_url_or_origin:
access_mode: public | captcha | login | paid | manual | uploaded
artifact_type: html | pdf | screenshot | text_note | json | csv | map_layer
artifact_ref:
artifact_hash:
collected_at:
input_used:
input_variants_tried:
raw_fields_observed:
parsed_fields:
entities_mentioned:
property_identifiers:
event_date:
case_or_document_id:
theme_labels:
warning_signals:
what_this_source_can_prove:
what_this_source_cannot_prove:
linkage_confidence: low | medium | high
extraction_confidence: low | medium | high
review_status: pending | approved | rejected | needs_followup
reviewer:
review_notes:
```

---

## 4. Source Feasibility Questions

For each source, record:

- Is access public, captcha-gated, login-gated, paid, or manual?
- Can it be searched by party/entity, plot/khata, case/document number, village, or GPS?
- Does it return structured data, HTML, PDF, image, table, map layer, or only narrative text?
- Can we obtain raw artifacts legally and repeatably?
- What fields are reliable enough to parse?
- What are the false-negative risks?
- What are the false-positive risks?
- What is the manual fallback?
- Does the source support bulk discovery, targeted lookup, or only known-ID lookup?
- What theme labels can this source support by itself?
- What labels require another source or reviewer?

---

## 5. Source-Specific Phase 0 Tasks

### Bhulekh

Collect:

- 5 RoR artifacts from Khordha.
- Include at least 2 with special/plot remarks.
- Include at least 1 government/anabadi/jungle/sarkari classification example if available.
- Include at least 1 multi-owner/co-owner example if available.

Fields to confirm:

- owner/tenant names
- khata and plot numbers
- kisam/class/status
- area components
- last publication/current date
- dues/tax fields
- mutation/case-reference remarks

### Bhunaksha / WFS

Collect:

- matching WFS artifacts for at least 3 Bhulekh examples.
- one area discrepancy or near-boundary example if available.

Fields to confirm:

- polygon geometry
- plot number
- village/layer metadata
- computed area
- adjacent plot candidates

### eCourts District

Collect:

- 5 property-related cases from Khurda/Khordha.
- Include partition/title, possession/injunction, boundary, fraud/cancellation, and acquisition if possible.

Fields to confirm:

- CNR/case number
- court complex/name
- case type
- parties and roles
- filing/status/disposal dates
- order PDF availability
- captcha/search attempt metadata

### Orissa High Court

Collect:

- 3 land/title/acquisition/revenue/SARFAESI examples.

Fields to confirm:

- search fields available
- case metadata
- order/judgment access
- party-name search behavior

### DRT/DRAT

Collect:

- 3 Odisha/Cuttack DRT examples involving immovable property, SARFAESI, recovery, or secured debt.

Fields to confirm:

- party-name search behavior
- case type/status
- borrower/lender parties
- order/property detail availability

### CERSAI

Collect:

- 1 active charge example.
- 1 satisfied charge example.
- 1 confirmed no-result example.

Fields to confirm:

- asset-based vs borrower/debtor-based search fields
- charge type
- borrower/chargor
- secured creditor
- property description
- amount/date/status
- report/download artifact availability

### IGR / EC / Deeds

Collect:

- 3 manually obtained or sample artifacts: EC, sale deed, mortgage deed, PoA, partition deed, gift deed, or certified copy.

Fields to confirm:

- document number
- registration date
- SRO
- parties
- property description
- consideration/value
- document type
- encumbrance status

### Regulatory / Acquisition / Zoning

Collect:

- 3 examples from LARR/SIA/Gazette/BDA/master plan/forest/flood/RERA.

Fields to confirm:

- notification/project/reference number
- affected village/area/project
- date
- source URL/PDF
- legal section or authority
- whether plot-level linkage is possible

### Manual Reviewed Cases

Collect:

- 5 known plot-purchase issue narratives with source references.

Required separation:

- source facts
- reviewer inference
- allegation/unverified claim
- final theme label

---

## 6. Phase 0 Pass Criteria

Phase 0 passes when:

- At least 25 examples are collected.
- At least 15 examples have raw artifacts.
- At least 15 examples have approved reviewer labels.
- At least 6 source buckets are represented.
- At least 8 theme labels have at least one approved example.
- Every source bucket has a feasibility status:
  - `bulk_candidate`
  - `targeted_lookup`
  - `manual_artifact_only`
  - `defer`
  - `blocked`
- Corpus schema requirements are updated from observed fields.

Phase 0 fails if:

- source artifacts cannot be retained
- examples cannot be linked to themes without excessive speculation
- public-source negatives cannot be distinguished from source failure
- schema design still assumes fields that no source actually provides

---

## 7. Phase 0 Output Artifacts

Create before implementation:

- `pid/research/source_feasibility.json`
- `pid/research/seed_examples.json`
- `pid/research/theme_label_guide.md`
- revised schema proposal for:
  - artifacts
  - events
  - entities
  - properties
  - event-entity links
  - event-property links
  - theme evidence
  - reviews
  - insights

Do not run production migrations until these outputs exist and are reviewed.

