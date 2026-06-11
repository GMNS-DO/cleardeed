# Phase 0 Source Samples and Theme Mapping

Date: 2026-05-25

Purpose: make the corpus direction inspectable before implementation. This is a sample evidence pack showing what each source can contribute, what themes it may support, and what proof is still needed before a sample becomes approved PID evidence.

Important: these are not final pattern claims. They are source samples and candidate mappings for review.

## How To Read This

Evidence maturity:
- E0 raw artifact captured, not parsed
- E1 parsed source fact
- E2 linked evidence across source fields/artifacts
- E3 human reviewed and approved

Mapping rule:
- A source sample can suggest a theme.
- A theme is not approved until the source fact is parsed, property/entity linkage is clear, and the reviewer separates fact, allegation, and inference.

## Sample Theme Families

| Family | Theme examples | What it means in plot purchase |
|---|---|---|
| A Title/ownership | A-01 co-owner, A-02 partition/lis pendens, A-03 succession, A-04 impersonation, A-05 double sale, A-06 PoA defect | Seller may not have clean authority to sell |
| B Government/classification | B-01 government/anabadi, B-02 forest, B-03 ceiling/vesting, B-04 conversion/land-use | Land may not be legally saleable/useable as claimed |
| C Encumbrance/financial | C-01 CERSAI active charge, C-02 registered mortgage/EC encumbrance, C-03 private lender, C-04 DRT/SARFAESI distress | Property or seller may carry financial/legal burden |
| D Boundary/possession | D-01 boundary/area mismatch, D-02 possession/injunction, D-03 subdivision, D-04 access/adjoining plot | Physical possession or plot identity may not match records |
| E Regulatory/acquisition | E-01 zoning, E-02 acquisition/SIA/LARR, E-03 RERA/project, E-04 forest/flood/environment | External regulatory process may affect purchase/use |
| F Actor/network | F-01 repeat seller/deed writer, F-02 recurring litigant, F-03 distressed entity/promoter/lender network | Same people/entities recur across risky transactions |

## Samples By Source

### 1. Bhulekh RoR / Land Records

Available samples:

| Sample | Current artifact | Evidence maturity | Fields we expect/get | Candidate mapping |
|---|---|---|---|---|
| SEED-BHULEKH-001 to 005 | Local Bhulekh PDFs in repo root | E0, pending OCR/PDF extraction | owner/tenant rows, khata, plot, kisam, area, remarks, special case references | A-01, A-03, B-01, B-03, B-04, D-01 depending on parsed rows |
| SEED-BHULEKH-006 | `TC002_rural_multi_owner.json` fixture | E1 fixture, pending official RoR link | claimed owner Krushnachandra Barajena, coowners count 4, land classification Danda | A-01 co-owner signal; possible B-04 if intended use conflicts with classification |

Sample mapping:
- If RoR lists 4 co-owners but the seller claims sole ownership, map to A-01.
- If RoR kisam/status says anabadi/sarkari/jungle, map to B-01 or B-02.
- If RoR plot area differs materially from cadastral geometry/deed area, map to D-01.

What must be proven before approval:
- Parse actual RoR text, not only fixture data.
- Preserve owner rows, plot rows, remarks, publication date, and artifact hash.
- Do not infer previous owner or mutation basis unless explicitly present.

### 2. Bhunaksha / WFS Cadastral Geometry

Available samples:

| Sample | Current artifact | Evidence maturity | Fields we get | Candidate mapping |
|---|---|---|---|---|
| WFS fixture plot 784 | `packages/fetchers/bhunaksha/fixtures/wfs-response.json` | E1 fixture | polygon geometry, plot number, Haripur village, tehsil Bhubaneswar, district Khordha, shape area/length | D-01 area/boundary check, D-03 subdivision, D-04 adjacency |
| WFS fixture plot 785 | same fixture | E1 fixture | polygon geometry, plot number, Mendhasala village, neighboring geometry | D-01 and D-04 when paired with RoR/deed/neighbor case |

Sample mapping:
- Compare WFS computed area against RoR/deed area: possible D-01.
- Check if buyer's GPS falls outside target polygon: target-plot identity issue under D-01/D-04.
- Adjacent plot disputes only become meaningful when linked to court/revenue case text.

What must be proven before approval:
- Pull live WFS artifact for the same village/plot as the RoR sample.
- Store geometry hash and computed area method.
- Avoid labeling a boundary dispute from geometry alone.

### 3. District eCourts

Available sample:

| Sample | Current artifact | Evidence maturity | Fields observed | Candidate mapping |
|---|---|---|---|---|
| SEED-ECOURTS-FEAS-001 | `docs/metrics/ecourts-captcha-measurement-2026-04-30.json` | E1 source-feasibility sample | party name Mohapatra, direct HTTP 403, manual search required | Not a dispute theme; source reliability/negative-result confidence sample |

Target dispute samples to collect:

| Desired sample | Fields needed | Candidate mapping |
|---|---|---|
| Partition/title suit involving seller/co-owner | CNR, case type, parties, filing date, current status, order text | A-02 partition/lis pendens, A-01 co-owner |
| Sale-deed cancellation/specific performance | CNR, deed references, parties, property schedule in order | A-05 double sale, A-06 PoA if authority challenged |
| Injunction/possession/boundary case | CNR, order text, property description | D-02 possession/injunction, D-01 boundary |

What must be proven before approval:
- A party-name hit alone is not enough.
- Need order/case text linking the party and property issue.
- Failed/captcha-blocked search must never be described as "no active cases."

### 4. Orissa High Court

Available samples:

| Sample | Current artifact | Evidence maturity | Observed candidate signal | Candidate mapping |
|---|---|---|---|---|
| SEED-HC-PARTITION-001 | High Court ILR PDF, downloaded | E0 raw PDF; search-result context only | registered partition deed allegedly obtained by fraud/misrepresentation while plaintiff believed she executed PoA | A-02 partition, A-04 impersonation/misrepresentation, A-06 PoA defect |
| SEED-HC-PARTITION-002 | CMP 1292/2023 PDF, downloaded | E0 raw PDF; search-result context only | partition under OLR Act, registered sale deed Nos. 2202/2203/2586, injunction against construction | A-02 partition, A-05 multiple sale/sale-deed conflict, D-02 injunction |
| SEED-HC-REGISTRATION-001 | High Court ILR PDF, downloaded | E0 raw PDF; search-result context only | co-owner transfer/share and sale deed registration/refusal | A-01 co-owner, A-05 title-chain/registration conflict |
| SEED-HC-LA-001 to 004 | High Court PDFs, downloaded | E0 raw PDF; candidate context only | land acquisition officer/NHAI/acquired homestead land references | E-02 acquisition/litigation |

What must be proven before approval:
- Extract body text from PDF or OCR it.
- Capture case number, party names, property facts, issue, order outcome, and whether the text is allegation or finding.
- Avoid approving from search-result snippets alone.

### 5. DRT / DRAT

Available parsed samples:

| Sample | Current artifact | Evidence maturity | Parsed case rows | Candidate mapping |
|---|---|---|---|---|
| SEED-DRT-001 | DRT Cuttack cause list, 2025-08-29 | E1 parsed source fact | OA/423/2025 Indian Bank vs M/S Lazziz Tower; OA/424/2025 UCO Bank vs Smt Kundalata Malik; OA/425/2025 ICICI Bank vs Sourav Mohanty; SA/239/2023 Umakanta Rout vs Canara Bank | C-04 DRT/recovery distress, F-03 lender/borrower actor check |
| SEED-DRT-002 | DRT Cuttack cause list, 2025-08-04 | E1 parsed source fact | OA/367/2025 Union Bank vs M/S Singheshwar Traders; OA/369/2025 Bank of India vs Bijay Kumar Singh; OA/13/2023 Bank of Baroda vs Manoj Ranjan Pattanaik; OA/141/2021 DCB Bank vs Sambandh Finserve; SA/29/2017 Ramakrushna Sahoo vs Bank of India | C-04, F-03 |
| SEED-DRT-003 | DRT/DRAT mortgage-release order PDF | E0 raw PDF | search context references settlement, release of charge/mortgage, original documents | C-01 active/satisfied charge context, C-04 recovery |

Sample mapping:
- DRT case against seller/entity maps to C-04 as a candidate distress signal.
- It maps to C-01 only if the order/CERSAI/deed text identifies an actual property charge.

What must be proven before approval:
- Link party to target seller/entity.
- Link case to property/security interest.
- Extract order text before calling it a property encumbrance.

### 6. CERSAI Public Search

Available sample:

| Sample | Current artifact | Evidence maturity | Fields described | Candidate mapping |
|---|---|---|---|---|
| SEED-CERSAI-FEAS-001 | `docs/sub-agent-briefs/igr-cersai-probe-result.md` and `docs/sources/cersai.md` | E1 source-feasibility note | borrower/chargor name, secured creditor, charge type, property description, creation date, amount, active/satisfied status | C-01 active charge, F-03 lender/borrower actor |

Target examples to collect:

| Desired sample | Fields needed | Candidate mapping |
|---|---|---|
| Active charge | borrower/chargor, creditor, property description, amount, creation date, active status | C-01 high-confidence encumbrance candidate |
| Satisfied charge | same fields plus satisfaction status/date | historical financial context, not necessarily active risk |
| No-result search | name variants tried, timestamp, screenshot/artifact | negative source result only; not a clean-title claim |

What must be proven before approval:
- Property description or seller/entity linkage.
- Name variants searched.
- Status active versus satisfied.

### 7. IGR Odisha EC / Registered Deeds

Available sample:

| Sample | Current artifact | Evidence maturity | Fields described | Candidate mapping |
|---|---|---|---|---|
| SEED-IGR/EC needed | `docs/sub-agent-briefs/igr-cersai-probe-result.md` and `docs/sources/igr-ec.md` | E1 source-feasibility note, no actual EC/deed artifact yet | document type, document number/date, parties, property description, consideration, SRO, search period | A-05 double sale, A-06 PoA defect, C-02 registered mortgage/encumbrance, F-01 actor pattern |

Target examples to collect:

| Desired sample | Fields needed | Candidate mapping |
|---|---|---|
| EC with sale chain | sale deeds, vendors/vendees, dates, property schedule | title chain, possible A-05 if conflict/repeated sale |
| EC with mortgage/lease/attachment | document type, status, property description | C-02 registered encumbrance |
| Deed with PoA execution | executant, attorney, PoA reference, validity facts | A-06 if authority is challenged or defective |

What must be proven before approval:
- Actual EC/deed artifact or certified copy.
- Property description matching khata/plot/village.
- Search period sufficient for the claim being made.

### 8. Revenue Payment / e-Pauti

Available samples:

| Sample | Current artifact | Evidence maturity | Expected fields | Candidate mapping |
|---|---|---|---|---|
| SEED-REVENUE-001 | `e-Pauti.pdf` | E0 raw PDF pending extraction | payer/name, khata, plot or holding reference, tax/dues, receipt date | Source-field context; not a dispute by itself |
| SEED-REVENUE-002 | `odishalandrevenue.nic.in_ViewDetails.aspx.pdf` | E0 raw PDF pending extraction | land revenue details, dues/payment references | Source-field context; possible B-04 only if linked to land-use/conversion issue |

Sample mapping:
- A paid revenue receipt does not prove clear title.
- Revenue-payment mismatch can become a lead only when linked to owner/khata/plot facts.

What must be proven before approval:
- Extract text/OCR.
- Link receipt/details to the same khata/plot.
- Do not label as a dispute unless a record shows non-payment, wrong payer, conversion issue, or official objection.

### 9. Regulatory Acquisition / LARR / SIA / Gazette

Available parsed samples:

| Sample | Current artifact | Evidence maturity | Parsed source facts | Candidate mapping |
|---|---|---|---|---|
| SEED-REG-002 | Odisha Revenue land acquisition page | E1 parsed source fact | LARRMS/Bhuarjan compensation workflow, IDCO acquisition for industries, compensation/GST row, return of unutilized acquired land | E-02 acquisition/compensation process |
| SEED-REG-003 | Odisha Revenue SIA 4(1) notification page | E1 parsed source fact | Khordha/Khurda SIA rows for Rajua diversion wire/ware project, including Medini, Kurumapada, Sadheigada, Saradhapur, Dhabalpur, Sadheigad | E-02 acquisition/SIA risk |

Example mapping:
- 05/02/2026, letter 5419, Ac. 4.306 in Medini, Khordha for Rajua diversion wire project maps to E-02.
- 22/01/2026, letter 3424, Ac. 3.892 in Saradhapur, Khurda for Rajua diversion wire maps to E-02.

What must be proven before approval:
- Download individual notice PDF.
- Extract land schedule, village, area, plot/khata if present.
- Link any target property by plot/village/owner, not just district proximity.

### 10. RERA / ORERA

Available sample:

| Sample | Current artifact | Evidence maturity | Parsed entry points | Candidate mapping |
|---|---|---|---|---|
| SEED-RERA-001 | ORERA home HTML | E1 source-feasibility sample | registered projects, real estate agents, project registration, agent registration, complaint filing, public information services | E-03 project/regulatory, F-03 promoter/agent actor |

Target examples to collect:

| Desired sample | Fields needed | Candidate mapping |
|---|---|---|
| Registered project page | project name, registration number, promoter, land details, validity, approvals | E-03 |
| Complaint/order against promoter | complaint number, parties, issue, order outcome | E-03, F-03 |
| Agent/promoter lookup | name, registration status, past projects/complaints | F-03 |

What must be proven before approval:
- Actual project/promoter/complaint artifact.
- Link to the relevant plot/project/entity.
- Distinguish project risk from individual plot title risk.

### 11. RCCMS / Revenue Case Follow-Up

Available sample:

| Sample | Current artifact | Evidence maturity | Fields expected | Candidate mapping |
|---|---|---|---|---|
| RCCMS needed | `docs/sources/rccms.md` source documentation | E1 source-feasibility note, no usable case sample yet | case number, district/tahasil, parties, mutation/revenue case type, order/status | A-03 succession/mutation, B-03 ceiling/vesting, B-01 government classification, D-01 boundary/revenue correction |

Use rule:
- RCCMS should be follow-up when Bhulekh/court/deed gives a case reference.
- It is not currently the primary discovery source.

What must be proven before approval:
- Known case number or reliable lookup path.
- Order/status text.
- Link between revenue case and plot/khata/person.

### 12. Manual Reviewed Cases

Available sample shape:

| Sample | Current artifact | Evidence maturity | Fields to capture | Candidate mapping |
|---|---|---|---|---|
| Manual case note needed | lawyer/operator/broker note plus supporting artifact | E2/E3 after review | source facts, allegation, reviewer inference, documents seen, parties, property identifiers, outcome | Any A-F theme if evidence supports it |

Example manual case shape:
- Source fact: EC shows sale deed in 2018 and mortgage deed in 2021 for same plot.
- Allegation: seller did not disclose the mortgage.
- Reviewer inference: possible C-02 registered encumbrance; possible A-05 only if later sale conflicts with earlier chain.
- Needed artifact: EC PDF, sale deed/mortgage deed pages, reviewer sign-off.

What must be proven before approval:
- Manual note cannot stand alone for theme promotion.
- It must be linked to a source artifact, or explicitly marked as expert anecdote only.

## Sample End-To-End Mappings

| Situation | Sources involved | Evidence chain | Candidate theme(s) | Approval gate |
|---|---|---|---|---|
| Seller claims sole ownership, RoR lists multiple co-owners | Bhulekh RoR, optional deed/EC | owner rows + seller claim + share/authority facts | A-01 | actual RoR parsed and reviewed |
| Family partition litigation references sale deeds and injunction | High Court/eCourts, deed/EC | case text + deed numbers + property schedule | A-02, A-05, D-02 | order text and property linkage |
| Bank recovery case against seller entity | DRT, CERSAI, EC/deed | DRT case row + charge or mortgage document | C-04, C-01/C-02 | property/security text linked |
| Village appears in SIA/acquisition notice | Revenue/SIA, Gazette/notice PDF, Bhulekh | notice row + land schedule + target plot/village/area | E-02 | individual notice PDF and schedule match |
| Registered project/promoter has complaint/order | ORERA, company/promoter records | project record + complaint/order + entity match | E-03, F-03 | actual project/complaint artifact |
| RoR area and WFS polygon area materially disagree | Bhulekh, Bhunaksha/WFS, deed | RoR plot area + computed polygon area + deed schedule | D-01 | measurement method and same-plot linkage |

## What I Would Show In A Review Screen

For each sample:
- source name and artifact link/hash
- evidence maturity E0-E3
- parsed fields
- candidate themes
- mapping explanation in one sentence
- proof still needed
- reviewer decision: approve, reject, needs more evidence

