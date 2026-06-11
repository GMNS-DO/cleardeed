# PID_SOURCE_TO_INSIGHT_MAP.md
# ClearDeed PID - Standalone Land Purchase Risk Intelligence Map

> Purpose: define PID as a standalone data-collation and insight-formulation system.
> This is not product integration work. This is the source-to-theme blueprint for
> building a corpus of plot-purchase failure modes, dispute patterns, and warning
> signals from available public, paid, and manually reviewed records.

---

## 1. Reframed Objective

PID is a standalone intelligence corpus for answering:

> What can go wrong in a plot purchase, what public or obtainable records reveal
> those failures, and what recurring warning signals appear across cases?

The system should collect records first, then formulate insights. It should not begin
from a buyer input or a ClearDeed report request. The corpus can later support plot-level
matching, but that is downstream.

Primary corpus units:

- dispute case
- revenue/mutation case reference
- court order or case status
- registered transaction event
- encumbrance or charge event
- land classification anomaly
- boundary/spatial anomaly
- acquisition/regulatory notice
- project/promoter record
- manual expert-reviewed case note
- recurring actor/entity pattern

---

## 2. Core Rule

PID studies risk themes from evidence. It must not create geographic blacklists.

Allowed insight:

- "In validated cases of active partition disputes, common signals were inherited RoR
  ownership, multiple family defendants, and unresolved civil suits."
- "Anabadi/private-sale cases often involved Kisam/classification mismatch and missing
  settlement/conversion documents."

Disallowed insight:

- "Village X is risky."
- "Tahasil Y has bad titles."
- "This area is fraudulent."

Places can be stored as factual metadata for source retrieval, jurisdiction, and record
provenance. Places must not be used as standalone risk labels.

---

## 3. Source Classes

| Class | Meaning | Examples | Corpus Use |
|---|---|---|---|
| Public automated | Searchable or fetchable with no login/payment, though captcha/browser may exist | Bhulekh, eCourts, High Court, DRT, Bhunaksha/WFS, CERSAI public search if validated | Bulk or semi-bulk corpus creation |
| Public but brittle | Public, but portal shape/captcha/session behavior is fragile | eCourts, High Court, CERSAI, Bhulekh session replay | Controlled collection with retries and provenance |
| Login/payment/manual | Official, high-value, but requires account, fee, user consent, or operator | IGR EC, certified copies, some RCCMS workflows | Concierge corpus, uploaded artifacts, manual review |
| Conditional source | Useful only for a subset of sellers/plots | RERA, MCA21, NCLT, IBBI, DRT, CERSAI company search | Triggered ingestion by entity type or theme |
| Static/periodic dataset | Downloadable or periodically refreshed official layer/list | zoning maps, forest buffers, acquisition notices, ORSAC/Bhuvan layers, circle rates | Batch ingestion and spatial/theme annotation |
| Manual research | Known cases, lawyer notes, broker interviews, buyer experiences | curated dispute examples, PDFs, notes | High-quality labels and seed validation |

---

## 4. Source-to-Insight Map

### 4.1 Bhulekh RoR / Land Records

Primary value: land record facts and mutation/reference anchors.

Data obtainable:

- district, tahasil, village, RI/mouza codes where available
- khata/khatiyan number
- plot number
- owner/tenant names
- guardian/father/husband fields if present in owner block
- co-owner rows and share/fraction cues where present
- kisam / land class / status
- area fields and raw area components
- tax/cess/dues fields where present
- last publication/current/generated dates
- special case remarks, plot remarks, mutation or case-number anchors
- raw HTML artifact hash and parser version

Issue themes supported:

- undisclosed co-owner / partial title sale
- seller not matching RoR owner
- succession or unrecorded-heir defect
- mutation lag or unresolved mutation anchor
- government/anabadi/jungle/sarkari land sale risk
- ceiling/vesting/Bhoodan remark risk
- boundary/area discrepancy when paired with WFS/Bhunaksha
- private encumbrance hints if back-page remarks exist

Limitations:

- RoR is not a sale deed and does not prove a clean title chain.
- RoR mutation references usually need follow-up in mutation/RCCMS/IGR records.
- Previous owner and transaction basis must not be inferred unless explicitly present.

Corpus priority: P0.

### 4.2 Bhunaksha / ORSAC GeoServer WFS / Cadastral Polygons

Primary value: plot geometry, area, adjacency, subdivision, and boundary signals.

Data obtainable:

- plot polygon geometry
- plot number or revenue plot property fields
- village/layer metadata
- computed geodesic area
- nearby/adjacent plot candidates
- geometry hash and raw WFS artifact

Issue themes supported:

- boundary encroachment or mismatch
- seller-claimed area mismatch
- plot subdivision pattern
- access/road adjacency issues when road layers are available
- neighbor dispute indicators when paired with court/revenue cases
- target-plot identity mismatch across Bhulekh and map records

Limitations:

- Polygon area and RoR area can use different measurement conventions.
- WFS metadata may not carry every revenue field.
- Adjacent-plot semantics need careful spatial validation before strong claims.

Corpus priority: P0 for geometry and area; P1 for adjacency/subdivision mining.

### 4.3 eCourts District Courts

Primary value: civil and criminal litigation involving parties.

Data obtainable:

- party-name search results
- CNR/case number
- case type
- court complex/court name
- filing date
- case status
- parties and roles
- next hearing/disposal fields where present
- orders/judgments where available
- captcha/search metadata, variants tried, negative-result confidence

Issue themes supported:

- active partition suit / lis pendens
- specific performance dispute
- declaration of title
- cancellation of sale deed
- injunction/possession dispute
- fraud/impersonation complaint when case type/sections indicate it
- land acquisition litigation
- boundary/neighbour dispute
- private lender or mortgage-related civil dispute

Limitations:

- Name search has false negatives due to spelling/transliteration.
- Captcha and portal behavior affect negative-result reliability.
- Party search may return unrelated people with same/similar names.
- Court result does not by itself prove plot linkage unless orders/parties/property text connect it.

Corpus priority: P0.

### 4.4 Orissa High Court

Primary value: statewide litigation, writs, appeals, SARFAESI/DRT-related matters, and higher-value title disputes.

Data obtainable:

- party-name search results
- case number/type/year
- status
- court/bench
- parties and roles
- orders/judgments where available

Issue themes supported:

- title appeals and writs
- land acquisition challenges
- government land classification disputes
- SARFAESI/financial enforcement challenge
- builder/promoter or authority disputes
- administrative/revenue appeal patterns

Limitations:

- Similar captcha/name-variant issues as eCourts.
- High Court cases may be less plot-specific unless orders are retrieved and parsed.

Corpus priority: P1, after district eCourts pipeline is stable.

### 4.5 DRT / DRAT

Primary value: bank recovery and secured-debt litigation involving seller/entity.

Data obtainable:

- party-name search results
- DRT/DRAT forum
- case number/type
- filing/status fields
- parties and roles
- bank/lender parties

Issue themes supported:

- bank recovery against seller
- SARFAESI enforcement risk
- undisclosed secured debt
- distressed seller pattern
- company/promoter financial default

Limitations:

- Party search can over-match common names.
- DRT case does not automatically mean the target property is charged unless property text/order confirms it.

Corpus priority: P1, high value for encumbrance themes.

### 4.6 RCCMS / Revenue Courts

Primary value: revenue case status when a case number is already known.

Data obtainable:

- case status by known case number/court/year
- court type/name
- case type
- parties and status if logged in and case located
- order references where available

Issue themes supported:

- mutation dispute
- OLR/OEA/OPLE/OGLS proceedings
- government land encroachment/classification issues
- ceiling/vesting disputes
- correction/settlement order disputes

Limitations:

- Existing research indicates no useful public party/plot search.
- Login/captcha/session required.
- Not suitable as primary bulk discovery source unless official credentials/API are obtained.

Corpus priority: P2 conditional. Use as follow-up from Bhulekh mutation/case anchors and manually supplied case numbers.

### 4.7 IGR Odisha / EC / Registered Documents

Primary value: official registered transaction history.

Data obtainable:

- EC application/status data where accessible
- certified EC artifact when obtained
- registered document entries: sale, mortgage, gift, lease, partition, will, PoA, agreement
- document number and registration date
- parties
- property description
- consideration/market value fields
- SRO jurisdiction
- benchmark/circle valuation where accessible

Issue themes supported:

- multiple sale / double registration
- mortgage deed or registered encumbrance
- PoA sale authority concerns
- missing mutation after registration
- title chain gaps
- partition/gift/will transaction history
- undervaluation or suspicious consideration when benchmark is known
- aggregator/flipper portfolio when owner search is available

Limitations:

- EC is often login/payment/manual.
- Online access path may change and may require applicant workflow.
- EC covers registered documents only, not private/oral/equitable arrangements.
- SRO jurisdiction must be resolved correctly.

Corpus priority: P1 manual/concierge artifact ingestion first; automation only after live legal/access probe.

### 4.8 CERSAI

Primary value: security interests and financial charges.

Data obtainable:

- asset-based search records if validated
- borrower/debtor-based search records
- charge type
- borrower/chargor name
- secured creditor/lender
- property description
- charge creation date
- principal/amount fields where shown
- satisfaction/closure status
- active versus satisfied charge indicators

Issue themes supported:

- undisclosed active mortgage
- CERSAI shadow charge
- seller financial distress
- company/entity secured borrowing
- mismatch between EC-clean and CERSAI-active state
- lender recovery precursor when paired with DRT

Limitations:

- Name variants and transliteration can create false negatives.
- Charge may relate to another property unless property description is matched.
- Public UI details and fees/access must be live validated.

Corpus priority: P0/P1 probe, because value is high.

### 4.9 Gazette / LARR / SIA / Acquisition Sources

Primary value: acquisition and public-purpose notification risk.

Data obtainable:

- SIA notifications
- LARR Section 4/11/19 style notification references where available
- village/project/area/purpose/date fields
- Gazette PDFs and notification text
- court litigation involving acquisition
- RTI/manual confirmation artifacts

Issue themes supported:

- acquisition corridor risk
- pending compensation/acquisition dispute
- sale during notified acquisition period
- value distortion due to infrastructure project

Limitations:

- GPS-to-acquisition-status is rarely directly available.
- Gazette/PDF extraction is messy.
- Village-level notice is not the same as plot-level acquisition.

Corpus priority: P1 for village/project notices; P2 for full Gazette NLP.

### 4.10 Zoning / Planning / BDA / ORSAC / Master Plans

Primary value: intended-use mismatch and approval risk.

Data obtainable:

- master-plan zone
- development authority jurisdiction
- green belt / industrial / residential / floodplain classifications
- conversion/land-use restrictions where layers are available
- unauthorized layout lists if published

Issue themes supported:

- zoning mismatch
- agricultural-to-residential conversion risk
- unauthorized plotting/layout
- green belt or no-build zone
- approval authority mismatch

Limitations:

- Maps may be PDFs, tiles, or WMS/WFS with unclear licensing.
- Zone boundaries require careful geospatial handling.
- Zoning is not the same as RoR kisam.

Corpus priority: P2 after court/revenue/encumbrance corpus is seeded.

### 4.11 Forest / Eco-Sensitive / Flood / Environmental Layers

Primary value: physical/regulatory overlays affecting buildability and transfer.

Data obtainable:

- forest/protected area boundary or buffer
- wildlife sanctuary/buffer distance
- flood/river/low-lying overlays
- slope/elevation/soil context
- satellite canopy or land-cover hints

Issue themes supported:

- forest land misrepresentation
- eco-sensitive restriction
- flood/buildability risk
- ground condition mismatch with claimed use

Limitations:

- Official layer availability varies.
- Remote-sensing indicators are not legal classification by themselves.
- Must be expressed as screening signals, not conclusive title findings.

Corpus priority: P2/P3.

### 4.12 RERA / Builder / Promoter Sources

Primary value: project and promoter legitimacy for plotted developments or builder sellers.

Data obtainable:

- project registration number
- project name
- promoter name
- status/expiry/completion
- project district/address
- complaints/orders where available
- approved layout/project docs if downloadable

Issue themes supported:

- unregistered plotted project
- expired/cancelled project registration
- promoter complaint pattern
- project promise not matching registered plan

Limitations:

- Not useful for ordinary individual resale plots.
- Public search may be project-list/PDF driven rather than simple party search.

Corpus priority: conditional P2.

### 4.13 MCA21 / NCLT / IBBI / Corporate Sources

Primary value: corporate seller/promoter financial and charge context.

Data obtainable:

- company identity and director/promoter data
- registered charges
- insolvency proceedings
- liquidation/CIRP notices
- director/entity linkage

Issue themes supported:

- corporate seller distress
- promoter insolvency
- company charge conflict with property sale
- repeated entity network behavior

Limitations:

- Trigger only when seller/promoter is a company/LLP or linked corporate actor.
- Some data may need paid/manual retrieval.

Corpus priority: conditional P2/P3.

### 4.14 Manual Case Corpus

Primary value: high-quality labeled training and validation examples.

Data obtainable:

- lawyer-reviewed dispute summaries
- uploaded order PDFs
- EC/certified-copy artifacts
- buyer complaint narratives
- broker/operator notes
- known fraud examples
- source-specific verification notes

Issue themes supported:

- every theme, especially those not directly scrapeable
- source-failure patterns
- false positive/false negative examples
- pattern promotion evidence

Limitations:

- Requires human review and provenance discipline.
- Must separate allegation, source fact, and reviewer inference.

Corpus priority: P0. Manual labels are essential for validating automated extraction.

---

## 5. Insight Theme Taxonomy

### A. Title and Ownership Defects

| Theme ID | Theme | Evidence signals |
|---|---|---|
| A-01 | Undisclosed co-owner / partial title sale | Multiple RoR owners, share fractions, seller-only claim, co-owner litigation, fractional consideration mismatch |
| A-02 | Active partition / lis pendens | Civil suit involving family/co-owners, partition case type, recent hearing, unresolved status |
| A-03 | Succession / unrecorded heirs | RoR owner deceased/ancestral, seller differs from RoR, missing succession/probate, heir dispute case |
| A-04 | Seller impersonation / identity mismatch | name variants inconsistent, absentee/NRI owner, suspicious PoA, ID/address mismatch, criminal complaint |
| A-05 | Multiple sale / double registration | multiple registered deeds for same property, mutation lag, competing purchasers, cancellation suit |
| A-06 | PoA authority defect | sale via PoA, PoA not registered/expired/revoked, principal absent/deceased, authority challenged |

### B. Government Land and Classification Problems

| Theme ID | Theme | Evidence signals |
|---|---|---|
| B-01 | Anabadi / government waste land sale | Kisam/class shows Anabadi/Sarkari/Jungle, missing settlement order, government proceedings |
| B-02 | Forest / eco-sensitive land misrepresentation | forest/protected-area overlay, canopy/satellite mismatch, no conversion/clearance |
| B-03 | Ceiling surplus / Bhoodan / vesting issue | ceiling/vesting remarks, old settlement, large family holdings, revenue proceedings |
| B-04 | Conversion defect | agricultural/revenue class incompatible with intended use, no conversion order, development authority mismatch |

### C. Encumbrance and Financial Fraud

| Theme ID | Theme | Evidence signals |
|---|---|---|
| C-01 | CERSAI active charge | active charge, no satisfaction, lender listed, property description match |
| C-02 | Registered mortgage/EC encumbrance | EC mortgage/charge entry, unresolved deed, lender party |
| C-03 | Private/informal lender dispute | civil suit by lender, possession/security claims, CERSAI clean but litigation present |
| C-04 | DRT/SARFAESI distress | DRT case, bank recovery, SARFAESI challenge, borrower/seller match |
| C-05 | PMLA/ED/attachment | ED/PMLA court or notice, attachment order, rapid distressed transaction |

### D. Physical, Boundary, and Possession Disputes

| Theme ID | Theme | Evidence signals |
|---|---|---|
| D-01 | Boundary encroachment | Bhunaksha/physical mismatch, neighbor case, survey dispute, area mismatch |
| D-02 | Possession conflict | injunction/possession suit, third-party occupant, police/civil complaint |
| D-03 | Access/right-of-way defect | no road adjacency, easement dispute, pathway litigation |
| D-04 | Subdivision/layout anomaly | many small carved plots, missing layout approval, common-road ambiguity |

### E. Regulatory, Acquisition, and Planning Issues

| Theme ID | Theme | Evidence signals |
|---|---|---|
| E-01 | Zoning / land-use mismatch | master plan zone incompatible with intended use, no conversion/approval |
| E-02 | Acquisition corridor / LARR | SIA/Gazette notice, acquisition litigation, project alignment evidence |
| E-03 | Unauthorized project/layout | no RERA where required, unapproved plotting, promoter/project mismatch |
| E-04 | Environmental/flood restriction | flood/forest/wetland/eco-sensitive overlay, official buffer |

### F. Actor and Network Patterns

| Theme ID | Theme | Evidence signals |
|---|---|---|
| F-01 | Aggregator / land flipper | many purchases/sales, short holds, repeated counterparties, multi-district spread |
| F-02 | Repeat litigant seller | high litigation count, recurring property disputes, similar case types |
| F-03 | Promoter distress network | RERA complaints, DRT/High Court cases, company insolvency/charges |
| F-04 | Name-variant entity risk | same actor appears under variants across deeds/courts/charges |

---

## 6. Corpus Data Model - Conceptual

Do not begin with only "plots." Begin with source events and evidence.

Suggested core objects:

- `pid_source_artifacts`
  - raw source, URL/page, fetched_at, input_used, artifact_hash, parser_version, access_mode
- `pid_events`
  - canonical event row: court_case, deed, charge, mutation_ref, notice, spatial_feature, manual_case
- `pid_cases`
  - dispute/case-level normalized record, including source case IDs and order text
- `pid_entities`
  - people, companies, trusts, lenders, government bodies, promoters
- `pid_properties`
  - plot/khata/village/tahasil/SRO identifiers, plus geometry links where known
- `pid_event_entities`
  - entity roles: petitioner, respondent, seller, buyer, borrower, lender, promoter, owner
- `pid_event_properties`
  - property mentions and confidence of linkage
- `pid_theme_evidence`
  - event-to-theme mapping, feature signals, confidence, reviewer state
- `pid_insights`
  - formulated insight summaries, rates, recurring signals, confidence tiers
- `pid_review_notes`
  - manual labels, corrections, reviewer, notes, source of inference

Important separation:

- Source fact: "RoR shows Kisam = Anabadi."
- Extracted signal: "government-classification signal present."
- Reviewer inference: "sale of this plot may be invalid without settlement/conversion proof."
- Insight: "Validated Anabadi fraud cases commonly include missing original settlement orders."

---

## 7. Evidence Strength Levels

| Level | Meaning | Example |
|---|---|---|
| E0 Raw artifact | Source was captured but not parsed | HTML/PDF saved |
| E1 Parsed fact | Field extracted from a source | case number, owner name, Kisam |
| E2 Linked evidence | Fact linked to entity/property/theme | seller name in suit matches normalized entity |
| E3 Reviewed evidence | Human verified source fact and linkage | reviewer confirms order discusses same plot |
| E4 Pattern evidence | Evidence contributes to validated pattern | case approved for A-02 partition theme |
| E5 Insight support | Aggregated evidence supports insight/rate | 15+ reviewed cases support warning signal |

Critical negatives require higher evidence than positives. "No case found" or "no charge found"
must store search inputs, variants, attempts, captcha/result confidence, and source availability.

---

## 8. Collection Strategy

### Phase 0 - Source Feasibility and Seed Corpus

Goal: collect 25-50 high-quality seed examples across major themes.

Inputs:

- known public cases
- Bhulekh plots with visible mutation/case/classification remarks
- eCourts/High Court/DRT party-name examples
- CERSAI sample searches
- uploaded/manual EC or deed artifacts if available
- known acquisition/zoning/regulatory notices

Output:

- source feasibility table
- source artifact samples
- preliminary schema field list
- first manually reviewed theme labels
- list of impossible/brittle sources

### Phase 1 - Public Court and Land Record Corpus

Goal: build initial automated corpus from public sources.

Priority order:

1. Bhulekh RoR and mutation/reference anchors.
2. eCourts district party-name/case-type searches.
3. High Court and DRT party-name searches.
4. Order PDF/text extraction where available.
5. NLP extraction into theme evidence.

Output:

- case library
- issue-theme labels
- entity names and variants
- first pattern counts

### Phase 2 - Registry and Charge Corpus

Goal: add transaction and encumbrance evidence.

Priority order:

1. CERSAI public search probe and artifact schema.
2. IGR EC/manual artifact ingestion.
3. registered deed/EC parsing where artifacts exist.
4. entity/property/deed timeline building.

Output:

- financial charge theme evidence
- transaction timeline examples
- double-sale/mortgage/PoA theme evidence

### Phase 3 - Regulatory and Spatial Corpus

Goal: add overlays and batch datasets.

Priority order:

1. LARR/SIA/Gazette acquisition examples.
2. master-plan/zoning layers or PDF tables.
3. forest/flood/environment layers.
4. RERA project/promoter corpus.

Output:

- regulatory issue records
- static layer provenance
- spatial screening features

### Phase 4 - Insight Formulation

Goal: turn records into defensible statements.

Insight types:

- recurring feature sets per theme
- strongest early-warning signals
- common missing documents
- source reliability/failure analysis
- false-positive patterns
- case timelines
- actor-network signals
- theme confidence tiers

---

## 9. What Information We Should Store Per Source

Every source record should preserve:

- source name
- source URL/page/portal
- access mode: public, captcha, login, paid, manual, uploaded
- fetched/collected timestamp
- input used
- normalized input variants tried
- raw artifact hash/ref
- parser version
- parsed fields
- extraction confidence
- linkage confidence to entity/property/theme
- reviewer status
- failure mode if partial/failed

Every source-derived insight should preserve:

- supporting evidence IDs
- reviewed case count
- automated-only case count
- source mix
- confidence tier
- date last recomputed
- caveats

---

## 10. Immediate Next Decisions

These are strategic, not implementation details:

1. Approve PID as a standalone corpus-first system.
2. Approve adding a Phase 0 source feasibility gate before schema finalization.
3. Approve treating RCCMS as conditional follow-up, not primary corpus discovery.
4. Approve manual/uploaded artifacts as first-class corpus inputs.
5. Approve CERSAI and court sources as higher priority than bulk registry automation.

---

## 11. Suggested Phase 0 Checklist

Before building the production PID schema, collect and label:

- 5 Bhulekh examples with mutation/classification/case-reference remarks
- 5 eCourts cases involving property/title/partition/boundary themes
- 3 High Court cases involving land/title/acquisition/SARFAESI themes
- 3 DRT or bank recovery examples involving property/security interest
- 3 CERSAI search examples showing active/satisfied/no-result outcomes
- 3 IGR/EC/deed artifacts, even if manually obtained
- 3 regulatory/acquisition/zoning examples
- 5 manual/lawyer-reviewed known dispute examples

For each example, record:

- raw artifact
- parsed fields
- theme label
- why it belongs to that theme
- what warning signal would have appeared before purchase
- what the source cannot prove
- confidence and reviewer notes

---

## 12. Build Implication

The first real build should not be "scrapers first."

The first build should be:

1. corpus schema for artifacts, events, entities, properties, theme evidence, and reviews
2. source feasibility registry
3. manual artifact loader
4. sample-case review workflow
5. only then source-specific automated collectors

This preserves the real objective: insight formulation from evidence, not scraping for its
own sake.

