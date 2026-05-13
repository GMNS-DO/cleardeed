# ClearDeed Data-Point Reliability Matrix

Last updated: 2026-04-30
Status: authoritative task matrix for report data reliability

This document maps every consumer-facing data point currently populated by the report pipeline to its source, fallback, validator, and task owner. The goal is not just to add more sources. The goal is that every displayed data point is fetched as reliably as possible, remains correct under degraded conditions, and never becomes false reassurance when a source is partial, stale, mismapped, or unavailable.

## Claim Readiness Levels

| Level | Meaning | Allowed report language |
|---|---|---|
| L0 Not covered | No source is integrated for this data point. | "Not verified online" / manual checklist only. |
| L1 Fetched | A source returned a parseable value. | Value may be shown only with source status and timestamp. |
| L2 Validated | Source schema passed and field-level validators passed. | Value may be shown as "from [source]" but not as cross-checked. |
| L3 Cross-checked | Independent source or consistency rule confirms the value. | Value may be shown as "matched" or "reconciled." |
| L4 Reviewed | Automated checks plus golden fixture/domain-review coverage exist. | Value can support stronger buyer-action copy. Still no purchase recommendation. |

Critical negative claims have a stricter rule. "No cases found," "no encumbrance found," "no regulatory flags found," and "no mutation found" require L3 minimum plus negative-result metadata. Otherwise they must render as "not fully verified" or "manual verification required."

## Required Reliability Contract

Every report fact should eventually carry:

- `source`: source system and exact endpoint/page
- `fetchedAt`: source-specific timestamp, not just report completion time
- `inputUsed`: normalized search input, including fallbacks tried
- `status`: success, partial, failed, unavailable, not_run
- `statusReason`: why the status was assigned
- `rawArtifactRef` or `rawArtifactHash`: retained evidence
- `parserVersion`: version of parser used
- `templateHash`: structural hash of source HTML/JSON/PDF shape where applicable
- `validators`: list of validators passed/failed
- `confidenceState`: one of verified, matched, discrepancy, unavailable, manual_required, not_covered

## Task Families

| Family | Purpose |
|---|---|
| DPR-INF | Reliability infrastructure shared across data points. |
| DPR-LOC | Location, map, plot, khata, and area data. |
| DPR-OWN | Owner identity, co-owner, seller-claim, and mutation data. |
| DPR-LAND | Land classification, conversion, and buildability data. |
| DPR-CRT | Court and revenue-dispute data. |
| DPR-ENC | Encumbrance, registry, EC, and charge data. |
| DPR-REG | Regulatory overlay data. |
| DPR-ACT | Buyer action/checklist data. |
| DPR-COPY | Report-language gating and output audit. |
| DPR-QA | Fixtures, reviewer QA, and monitoring. |

## Secondary-Source Verification Strategy

Every report data point should move through this order before it can support confident consumer copy:

1. Identify the primary source of record for the fact.
2. Identify at least one independent secondary source or an explicit reason one is not currently available.
3. Compare normalized values, preserving the raw values, units, timestamps, and input parameters used for each source.
4. Classify the outcome as matched, discrepancy, unavailable, manual required, or not covered.
5. Gate A10 copy and A11 audit rules from that outcome, not from the mere presence of a parsed value.

| Fact group | Primary source today | Secondary checks required before stronger copy | Current worst-case behavior |
|---|---|---|---|
| GPS/district/village/tahasil | Bhunaksha/WFS polygon plus Nominatim hint | Official district/tahasil boundary, Bhulekh village-code match, source status/fetchedAt | Missing district/SRO stays `Not verified`; no hardcoded Khordha/Bhubaneswar fallback. |
| Plot number/khata/area | Bhunaksha/WFS target plot plus Bhulekh RoR | Bhulekh plot-row membership, raw plot table, target-row area tolerance, later IGR deed plot/khata | WFS plot is displayed as the target; mismatched Bhulekh rows warn instead of replacing the target plot. |
| Owner identity/co-owner | Bhulekh owner block and A5 matcher | Full-name quality, guardian/father name, transliteration variants, mutation/IGR transferee | Unknown/unavailable owner match creates action items and cannot render certified ownership copy. |
| Land classification/buildability | Bhulekh kisam/class plus A6 | Target plot row, conversion source, BDA/BMC/Bhuvan/zoning overlays | Missing or mismatched target plot class renders `Not verified`; kisam is not treated as zoning. |
| Courts/revenue disputes | eCourts and RCCMS | District proof, name variants, captcha success, raw artifact, High Court/DRT expansion | Placeholder/failed/manual sources block clean no-cases copy. |
| Encumbrance/registry | IGR manual EC instructions | Current IGR flow probe, EC artifact, CERSAI charge search, IGR transaction history | Product provides manual EC steps only; missing district/SRO is visible. |
| Regulatory overlays | A8 overlay results | Layer-by-layer official overlays with timestamp and buffer rules | Empty placeholder results cannot produce no-flag reassurance. |
| Buyer actions/disclaimer | Derived claim states plus approved disclaimer | A11 structural/copy audit and counsel approval | Manual actions are generated for unknown, failed, or not-covered states. |

## Current Report Data Points

### Header and Summary

| ID | Data point | Current source path | Current fallback | Reliability gap | Target validators/fallbacks | Task |
|---|---|---|---|---|---|---|
| H-001 | Report ID | `orchestratorOutput.reportId` | none | Generated per run; persistence relationship not shown. | Persisted report row exists; report ID maps to stored sources and audit log. | DPR-INF-006 |
| H-002 | Generated date | `orchestratorOutput.completedAt` | JS date formatting | Fine as report timestamp, but not source fetch timestamp. | Keep as report-generated timestamp; add per-source timestamps separately. | DPR-INF-001 |
| H-003 | "Sources fetched" date | `generatedAt` | report completion time | Renamed to report generation time; per-source details now carry individual `fetchedAt` and status metadata. | Keep report-generated timestamp; show per-source status/fetched metadata in source audit panel. | DPR-INF-001 |
| H-004 | GPS coordinate | user input `gps.lat/lon` | none | No input provenance or precision handling. | Validate bounds, numeric precision, GPS-in-polygon, and user-supplied source if available. | DPR-LOC-001 |
| H-005 | Header village/tahasil | `geoFetch.village/tahasil` | `—` | Bhulekh lookup now uses Bhunaksha/WFS village first; still needs official tahasil/SRO resolver. | Canonical location resolver chooses Bhunaksha for cadastral lookup; Nominatim only as human-readable hint. | DPR-LOC-002 |
| H-006 | Buyer action summary | derived from source statuses/findings | empty category text | P0 copy gates now block clean language from unavailable/manual sources; A11 state audit remains pending. | Claim-state-to-copy mapping; placeholder/manual-only sources cannot create "matched" or "usable" summary items. | DPR-COPY-001 |

### The Plot

| ID | Data point | Current source path | Current fallback | Reliability gap | Target validators/fallbacks | Task |
|---|---|---|---|---|---|---|
| P-001 | GPS location table row | user input `gpsCoordinates` | none | Same as H-004. | Bounds, precision, GPS-in-polygon, candidate polygon distance. | DPR-LOC-001 |
| P-002 | Village | `bhunaksha.data.village ?? nominatim.data.village` | `revenueRecords.village`, then `—` | Source precedence is now used for Bhulekh lookup; still needs Bhulekh village-code confirmation when available. | Canonical cadastral village from Bhunaksha/WFS; compare Nominatim and Bhulekh; flag mismatch. | DPR-LOC-002 |
| P-003 | Tahasil | `bhunaksha.data.tahasil ?? nominatim.data.tahasil` | `—` | Nominatim tahasil can be coarse; SRO is not the same as tahasil. | Canonical tahasil from WFS layer/metadata; validate against Bhulekh code and district map. | DPR-LOC-003 |
| P-004 | District | `nominatim.data.district` plus Khordha GPS boundary gate | `Not verified` | Hardcoded Khordha fallback is removed; Bhunaksha WFS does not provide a district field in the shared schema. | Khordha bounds/polygon, Nominatim state/district validators, no hardcoded success. | DPR-LOC-004 |
| P-005 | Khatiyan number | `bhulekh.data.khataNo` | `—` | Only available on Bhulekh success; no fallback via mutation/IGR/manual input. | Bhulekh by plot, Bhulekh by khatiyan if user supplies, mutation/IGR cross-check later. | DPR-OWN-004 |
| P-006 | Plot number | `geoFetch.plotNo`, else IGR params, else matched Bhulekh target row | `—` | WFS plot is now validated against Bhulekh tenant/raw plot rows; target plot area is still not isolated when Bhulekh only returns whole-khata totals. | Target plot resolver: WFS plot, Bhulekh selected row, khata row membership, area tolerance. | DPR-LOC-005 |
| P-007 | RI circle | `revenueRecords.riCircle` | omitted | Mapper hardcodes null, so never displays. | Parse if Bhulekh exposes RI; otherwise mark not available. | DPR-LOC-006 |
| P-008 | Area discrepancy notice | validation finding `dimension=area` | omitted | Bhunaksha/Bhulekh comparison is now target-row aware where Bhulekh returns the matching plot; whole-khata sums remain explicitly marked as sums. | Compare target plot area only where possible; preserve raw units/components; tolerance tiers. | DPR-LOC-007 |
| P-009 | GPS out-of-range notice | validation finding `dimension=gps` | omitted | Bounds are approximate, not polygon district boundary. | Use district boundary polygon when available; keep bounding box as early reject. | DPR-LOC-008 |

### The Owner

| ID | Data point | Current source path | Current fallback | Reliability gap | Target validators/fallbacks | Task |
|---|---|---|---|---|---|---|
| O-001 | Claimed owner | user input `claimedOwnerName` | none | Single-token warning only. | Normalize name; require full legal name for high-confidence search; generate variants. | DPR-OWN-001 |
| O-002 | Official owner Odia | `ownershipReasoner.officialOwnerName` from Bhulekh tenant | empty | Bhulekh parser structure may conflate tenant block and plot rows. | Parse owner block separately from plot rows; retain raw Odia owner block. | DPR-OWN-002 |
| O-003 | Official owner English/transliteration | dictionary/rule transliteration | Odia string if not recognized | A5 now stores matched owner transliteration method and raw owner/guardian source values; it still needs confidence/variant alternatives and manual-review override. | Store transliteration method, confidence, variants; allow manual reviewed transliteration. | DPR-OWN-003 |
| O-004 | Name match badge | A5 `nameMatch` if Bhulekh usable | unknown/unverified | Confidence and basis hidden; father-name context underused. | Match full name, surname, father/husband, co-owner list, variants; expose confidence basis. | DPR-OWN-001 |
| O-005 | Name discrepancy explanation | A5 `discrepancyExplanation` | omitted | Explanation not tied to exact validators. | Structured match reasons and failed checks. | DPR-OWN-001 |
| O-006 | Co-owner note | A5 `coOwners` | omitted | Repeated owner rows are deduped by normalized transliterated identity; authority/legal-heir/PoA status is still manual. | Deduplicate owners by normalized Odia/Latin name; separate co-owners from multiple plots. | DPR-OWN-005 |
| O-007 | Owner table: Odia name | `revenueRecords.tenants[].tenantName` | `—` | Table says owners but rows are plot rows in current schema. | Rename/model as owner rows plus plot rows separately. | DPR-OWN-006 |
| O-008 | Owner table: English name | transliteration of tenant name | Odia/empty | Same transliteration gap. | Same as O-003 plus per-row method/confidence. | DPR-OWN-003 |
| O-009 | Owner table: father name | `fatherName` | `—` | Currently often undefined though Bhulekh owner block may contain guardian fields. | Parse guardian relation/name from owner block and map to owner row. | DPR-OWN-007 |
| O-010 | Owner table: survey number | `tenants[].surveyNo` | `—` | This belongs to plot table, not owner table. | Split "Recorded owners" from "Plot rows under khata." | DPR-OWN-006 |
| O-011 | Last published | `bhulekh.data.lastUpdated` | `—` | Date format not normalized; may be stale. | Parse strict date, preserve raw text, stale-record warning threshold. | DPR-OWN-008 |
| O-012 | Mutation/case reference | `bhulekh.data.mutationReferences` | RoR anchor panel | RoR remarks/case anchors are parsed and rendered only as manual follow-up anchors, not ownership history. Mutation-status/IGR cross-checks are not done. | Mutation status portal and IGR cross-check before ownership-chain claims. | DPR-OWN-009 |
| O-013 | Previous owner / holding period | not currently surfaced | not covered | Requires mutation/IGR history, not RoR alone. | Mutation case + IGR Index-II timeline; temporal monotonicity. | DPR-OWN-010 |

### Land Classification and Buildability

| ID | Data point | Current source path | Current fallback | Reliability gap | Target validators/fallbacks | Task |
|---|---|---|---|---|---|---|
| L-001 | Classification type | A10 expects `landClassifier.currentClassification`, else first tenant land class translation | Not verified | A6 returns `primaryKisam/primaryCategory`, not `currentClassification`. | Align A6/A10 contract; classify target plot, not first row only. | DPR-LAND-001 |
| L-002 | Raw Bhulekh land class | first tenant `landClass` | `—` | First row may not be target plot; A10/A6 maps diverge. | Unified kisam dictionary; per-plot source row; unknown maps to manual verification, not government land by default. | DPR-LAND-002 |
| L-003 | Conversion required | A6 `conversionRequired` | false when missing | Missing classifier should not mean no conversion required. | Null/unknown state; conversion copy only from classified land. | DPR-LAND-003 |
| L-004 | Conversion steps/cost | A6 may compute but A10 does not render | omitted | Buyer loses useful but caveated info. | Render only with source/citation and manual verification copy. | DPR-LAND-004 |
| L-005 | Land red flags/restrictions | A10 expects `redFlags`; A6 returns `restrictions` | none | Critical restrictions can be dropped. | Align schema and render severity/action/citation. | DPR-LAND-005 |
| L-006 | Buildability / zoning | Bhulekh kisam only | explanatory copy | Kisam is not zoning. | Add BDA/BMC/Bhuvan source states; until then "zoning not verified." | DPR-LAND-006 |
| L-007 | Classification-not-verified warning | `!bhulekhUsable` | warning shown | Good fallback but generic. | Include exact missing source reason and manual document request. | DPR-LAND-007 |

### Court Cases and Disputes

| ID | Data point | Current source path | Current fallback | Reliability gap | Target validators/fallbacks | Task |
|---|---|---|---|---|---|---|
| C-001 | eCourts status | `courtCases.sources.ecourts` | `not_run` | Partial can count as usable. | Status reason, captcha metadata, complexes tried, variants tried. | DPR-CRT-001 |
| C-002 | RCCMS status | `courtCases.sources.rccms` | `not_run` | Placeholder returns partial zero cases. | Placeholder sources must be `not_implemented`, not usable. | DPR-CRT-002 |
| C-003 | No cases found claim | total/case list/statuses | manual instructions | Critical negative can be too reassuring. | L3 negative gate: success, raw artifact, parser hash, variants, double-fetch. | DPR-CRT-003 |
| C-004 | Case type | mapped `case.caseType` | `—` | Mostly OK. | Schema validation per source. | DPR-CRT-004 |
| C-005 | Case number | A10 expects `caseId`; eCourts returns `caseNo` | `—` | Case numbers render blank for eCourts. | Normalize case IDs in mapper. | DPR-CRT-004 |
| C-006 | Court name | A10 expects `courtName/courtComplex`; eCourts returns `court` | `—` | Court names render blank for eCourts. | Normalize court field in mapper. | DPR-CRT-004 |
| C-007 | Case status | `case.status` | `—` | OK but not source-normalized. | Normalize active/disposed/pending and retain raw status. | DPR-CRT-005 |
| C-008 | Filing date | `case.filingDate` | `—` | RCCMS lacks date; eCourts may vary. | Parse date per source, retain raw date. | DPR-CRT-005 |
| C-009 | High Court/DRT coverage | not currently populated | not covered | Major coverage gap. | Add Orissa High Court and DRT party searches; banner title-related cases. | DPR-CRT-006 |

### Encumbrance and Registry

| ID | Data point | Current source path | Current fallback | Reliability gap | Target validators/fallbacks | Task |
|---|---|---|---|---|---|---|
| E-001 | EC instruction URL | A7/IGR link | default `igrodisha.gov.in/ecsearch` | URL/flow may be wrong or stale. | Probe current IGR flow; source doc with working path. | DPR-ENC-001 |
| E-002 | EC search district/SRO/plot | Nominatim/Bhunaksha/Bhulekh-derived params | `Not verified`/`Not verified`/`—` | SRO is not tahasil; hardcoded Khordha/Bhubaneswar fallback is removed, but tahasil-to-SRO mapping still needs an official resolver. | SRO resolver by village/tahasil; require khata/plot/village. | DPR-ENC-002 |
| E-003 | EC fee/copy instructions | A7/IGR manual instructions | no exact fee claim | Exact fee may change; app copy now tells users to confirm the current government fee in the live IGR flow or at the Sub-Registrar office. | Add fee source config only after live IGR flow is probed with `lastVerified`. | DPR-ENC-003 |
| E-004 | Verified encumbrance entries | not populated | manual required | Current product cannot verify EC. | IGR EC paid/manual add-on; parse uploaded/obtained EC. | DPR-ENC-004 |
| E-005 | CERSAI charge | not populated | not covered | Major mortgage gap. | Paid public search; active/closed charge interpretation. | DPR-ENC-005 |
| E-006 | IGR transaction history | not populated | not covered | Needed for ownership chain. | IGR Index-II/NGDRS probe; deed timeline. | DPR-ENC-006 |

### Regulatory Flags

| ID | Data point | Current source path | Current fallback | Reliability gap | Target validators/fallbacks | Task |
|---|---|---|---|---|---|---|
| R-001 | Regulatory flag list | A8 `flags` | "No immediate flags" | A8 is placeholder; empty list is not a real negative. | Empty result means "not fully screened" until real overlays ingested. | DPR-REG-001 |
| R-002 | Flag name/description/action | A10 expects `regulation/message`; A8 returns `flag/description/recommendedAction` | undefined if flags exist | Shape mismatch. | Align A8/A10 contract and tests. | DPR-REG-002 |
| R-003 | Severity | A10 expects warning/info; A8 emits high/medium/low | info-ish fallback | Severity mismatch. | Normalize severity scale and banner rules. | DPR-REG-002 |
| R-004 | Overlay source line | static "Bhunaksha WFS + ORSAC KML" | always shown | Claims ORSAC KML layers that are not integrated. | Source line must list only completed overlays. | DPR-REG-003 |
| R-005 | Forest/Chandaka | not populated | not covered | High-value Khordha risk. | Official layer/static boundary; GPS-in-polygon/buffer. | DPR-REG-004 |
| R-006 | Flood/soil/slope | not populated | not covered | Buildability/cost gap. | Bhuvan/SRTM layers with source status. | DPR-REG-005 |
| R-007 | Airport/ASI/CRZ/PESA | not populated | not covered | Static copy overclaims. | Layer/table ingestion with buffers and confidence. | DPR-REG-006 |

### What To Ask Next

| ID | Data point | Current source path | Current fallback | Reliability gap | Target validators/fallbacks | Task |
|---|---|---|---|---|---|---|
| A-001 | Owner-match action | `nameMatch` | omitted if unknown | Unknown owner match needs explicit action. | Action items generated from claim states, including unknown/unavailable. | DPR-ACT-001 |
| A-002 | Co-owner action | `coOwners` | omitted | Duplicate false co-owner risk. | Depends on deduped owner rows. | DPR-ACT-002 |
| A-003 | Conversion action | `conversionRequired` | omitted | Unknown conversion state can look like no issue. | Unknown/manual action when classification is unavailable. | DPR-ACT-003 |
| A-004 | EC action | IGR URL/plot/village | default URL/plot `—` | Hardcoded fee and unverified URL. | Depends on DPR-ENC-001/003; avoid fee certainty until verified. | DPR-ACT-004 |
| A-005 | Boundary verification checklist | static plus plot/village | always shown | Useful but not tied to boundary confidence. | Make stronger when GPS near polygon boundary/area discrepancy. | DPR-ACT-005 |
| A-006 | Mutation checklist | static "confirm no pending mutations" | always shown | Should use mutation/case fields once available. | Upgrade from generic checklist to source-backed finding. | DPR-ACT-006 |
| A-007 | Disclaimer | pipeline `DEFAULT_DISCLAIMER` | schema default empty | Fine but counsel review pending. | A11 enforces non-empty counsel-approved version. | DPR-COPY-004 |

## P0 Implementation Tasks

[DPR-INF-001] [DONE] [P0] Add source-level provenance bundle
  Data point: all fetched report facts
  Blocks report language: yes
  Validation gates: `source`, `fetchedAt`, `inputUsed`, `statusReason`, `rawArtifactHash/ref`, `parserVersion`, `templateHash`, `validators`
  Notes: Extend `SourceResultBase` and mapper/report input so A10 can show source-specific timestamps and avoid rendering values without provenance.

[DPR-INF-002] [DONE] [P0] Preserve partial progress under timeouts
  Data point: all source-derived fields
  Blocks report language: yes
  Validation gates: per-source timeout, partial result collection, timeout status reason
  Notes: Replace all-or-nothing orchestrator timeout that currently returns `sources=[]`.

[DPR-INF-003] [DONE] [P0] Run independent fetchers concurrently with dependency graph
  Data point: all source-derived fields
  Blocks report language: no
  Validation gates: Nominatim and Bhunaksha parallel; dependent Bhulekh/RCCMS/eCourts branches; tests for slow source
  Notes: Worst-case fetching should not stack avoidable latency.

[DPR-INF-004] [IN PROGRESS] [P0] Shared retry/backoff wrapper
  Data point: all external-source fields
  Blocks report language: yes for critical negatives
  Validation gates: source-specific retryable errors, backoff, jitter, attempts metadata
  Notes: Shared `runWithRetry()` helper exists; Nominatim and Bhulekh use it with attempt metadata. Bhunaksha has source-specific expanded-BBOX retry and truncation warnings. eCourts records per-complex attempts/captcha outcomes. Live RCCMS still needs implementation before this can close fully.

[DPR-INF-005] [TODO] [P0] Parser template/hash drift detection
  Data point: all parsed source fields
  Blocks report language: yes
  Validation gates: structural selectors/fields present; template hash stored; drift yields partial/failed, not empty success

[DPR-INF-006] [DONE] [P0] Persist report-source linkage
  Data point: report ID, audit trail, raw artifacts
  Blocks report language: no
  Validation gates: report row, source result rows, audit log rows, artifact references
  Notes: `/api/report/create` persists every returned SourceResult into `source_results` via `upsertSourceResult`, with parsed provenance metadata and rawResponse stored separately when present.

[DPR-COPY-001] [IN PROGRESS] [P0] Enforce claim-state-to-copy mapping in A10/A11
  Data point: all consumer-facing claims
  Blocks report language: yes
  Validation gates: verified/matched/discrepancy/unavailable/manual_required/not_covered states; no clean wording from partial/placeholder sources
  Notes: A10/A11 now gate owner-match, court-negative, regulatory-negative, EC/SRO, conversion, source-line, and classification-unavailable copy. Remaining work is a complete fixture matrix across all P0 fields and legal-approved disclaimer enforcement.

[DPR-COPY-002] [DONE] [P0] Fix report contract shape mismatches
  Data point: land restrictions, regulatory flags, court case fields
  Blocks report language: yes
  Validation gates: A6/A8/A10 schema alignment; eCourts `caseNo/court` normalization; tests

[DPR-COPY-003] [DONE] [P0] Remove overclaiming static source lines
  Data point: source lines and explanatory copy
  Blocks report language: yes
  Validation gates: source line lists only integrated sources; placeholder overlays/EC/RCCMS cannot imply verification

[DPR-QA-001] [TODO] [P0] Create data-point fixture suite
  Data point: all P0 report fields
  Blocks report language: yes for launch
  Validation gates: 10 real Khordha plots, source artifacts, expected claim states, reviewer annotations

## Feature-Specific P0/P1 Tasks

[DPR-LOC-001] [IN PROGRESS] [P0] GPS reliability gate
  Data point: H-004, P-001, P-009
  Validation gates: numeric bounds, Khordha boundary, GPS-in-polygon, near-boundary warning, input precision
  Notes: API/orchestrator hard-block invalid/outside GPS before fetchers/persistence, and add near-boundary warning. Current polygon asset is traceable with Survey of India/IUDX metadata but still uses a fallback geometry artifact until the official geometry endpoint is directly reproducible.

[DPR-LOC-002] [DONE] [P0] Canonical village resolver
  Data point: H-005, P-002
  Validation gates: Bhunaksha/WFS village primary, Nominatim hint, Bhulekh code match, mismatch finding

[DPR-LOC-003] [TODO] [P1] Tahasil and SRO resolver
  Data point: P-003, E-002
  Validation gates: WFS tahasil, Bhulekh tahasil code, SRO mapping table, no tahasil-as-SRO assumption

[DPR-LOC-004] [IN PROGRESS] [P0] District reliability gate
  Data point: P-004
  Validation gates: no hardcoded success; Nominatim state/district plus WFS layer/boundary
  Notes: A10/mapper/orchestrator no longer invent Khordha or Bhubaneswar when upstream district/SRO evidence is missing, and Bhunaksha is not used as a district source unless a documented field is added later. Official district polygon/layer confirmation remains.

[DPR-LOC-005] [IN PROGRESS] [P0] Target plot resolver
  Data point: P-006
  Validation gates: WFS plot, Bhulekh selected row, khata membership, target row area, candidate polygons
  Notes: A10 now uses the Bhunaksha/WFS plot as the displayed target plot before Bhulekh rows, and land-class fallback only uses the matching Bhulekh row. Mismatched rows produce warning/manual review copy instead of showing the first Bhulekh row as the target.

[DPR-LOC-006] [TODO] [P2] RI circle extraction
  Data point: P-007
  Validation gates: parse from Bhulekh if present; otherwise explicit not-available state

[DPR-LOC-007] [IN PROGRESS] [P0] Area reconciliation v2
  Data point: P-008
  Validation gates: no rounded inputs, target plot vs whole khata distinction, tolerance tiers
  Notes: Bhunaksha area is unit-tagged as `sq_km` and computed from Turf/geodesic polygon area. Bhulekh RoR tenant rows now retain raw acre/decimal/hectare components, unit/computation metadata, source plot number, and source row hash. Remaining work is cross-source deed/IGR area reconciliation and live-regression fixture expansion.

[DPR-LOC-008] [PARTIAL] [P1] District boundary polygon validation
  Data point: P-009
  Validation gates: official/static Khordha polygon; bounding box remains early warning only
  Notes: Point-in-polygon and distance-to-boundary validation are implemented. Official SOI/IUDX item metadata is recorded; direct official geometry retrieval still needs a reproducible artifact before marking complete.

[DPR-OWN-001] [PARTIAL] [P0] Owner identity reliability gate
  Data point: O-001, O-004, O-005
  Validation gates: full-name quality, transliteration variants, father/husband context, match reasons, confidence basis
  Notes: A5 is the single owner-match authority and emits claim state, input quality, readiness, matched tenant index, score/method, reasons, blocking warnings, father/husband match state, and matched owner transliteration provenance. A10/A11 block green copy for single-token/surname-only input. Remaining gap: transliteration alternatives/confidence and manual-review override path.

[DPR-OWN-002] [DONE] [P0] Separate Bhulekh owner block from plot rows
  Data point: O-002, O-007, O-010
  Validation gates: owner rows distinct from plot rows; no repeated-plot false owner table

[DPR-OWN-003] [PARTIAL] [P1] Transliteration reliability metadata
  Data point: O-003, O-008
  Validation gates: method, score, variants, unknown state, manual review override
  Notes: A5 now exposes matched-owner provenance with raw owner/guardian values and dictionary/rule/passthrough transliteration method. Variant generation, confidence per transliteration, and manual reviewed overrides remain pending.

[DPR-OWN-004] [TODO] [P0] Khatiyan fallback lookup
  Data point: P-005
  Validation gates: plot mode, khatiyan mode, manual khatiyan override, fixture for each

[DPR-OWN-005] [PARTIAL] [P0] Co-owner deduplication and authority check
  Data point: O-006, A-002
  Validation gates: normalized owner identity, duplicate row collapse, legal-heir/PoA checklist trigger
  Notes: A5 deduplicates co-owner names by normalized transliterated identity, excludes duplicate rows for the matched owner, and has regression coverage for Odia/Latin duplicate co-owner rows. Authority, legal-heir, and PoA checks remain manual action items.

[DPR-OWN-006] [PARTIAL] [P0] Rename and remodel owner/plot table
  Data point: O-007 through O-010
  Validation gates: "Recorded owners" table only owner rows; "Plots in khata" table for survey/area/class
  Notes: A10 no longer labels the joined Bhulekh table as unique "recorded owners"; it renders "Bhulekh owner/plot rows" with a source-limited note. Full separate owner table + plot table model remains future work.

[DPR-OWN-007] [DONE] [P1] Guardian/father-name parser
  Data point: O-009
  Validation gates: guardian relation/name parsed from Bhulekh owner block, raw retained

[DPR-OWN-008] [TODO] [P1] Last publication date validator
  Data point: O-011
  Validation gates: strict date parse, raw date retained, stale-record warning

[DPR-OWN-009] [IN PROGRESS] [P0] Bhulekh mutation/case-reference surfacing
  Data point: O-012, A-006
  Validation gates: raw RoR audit, schema fields, mutation status probe, no inferred previous owner
  Notes: Bhulekh parser now extracts case/reference anchors from special remarks and plot remarks into `mutationReferences`, including caseNo/orderDate/sourceField/plotNo where observed. It also retains RoR artifact hashes/refs and failed-session artifact snapshots where available. A10 renders these as RoR remark/case anchors for manual follow-up only. Mutation-status/IGR cross-checks remain pending before any ownership-history claim.

[DPR-OWN-010] [TODO] [P0] Ownership-chain timeline
  Data point: O-013
  Validation gates: mutation case + IGR deed timeline, date monotonicity, transferor/transferee match

[DPR-LAND-001] [DONE] [P0] Align A6/A10 land classification contract
  Data point: L-001
  Validation gates: `currentClassification` or updated renderer contract; target plot classification

[DPR-LAND-002] [TODO] [P0] Unified kisam dictionary
  Data point: L-002
  Validation gates: one mapping used by parser/classifier/report; unknown remains manual, not government-land assumption

[DPR-LAND-003] [DONE] [P0] Conversion-required tri-state
  Data point: L-003, A-003
  Validation gates: yes/no/unknown; missing classifier cannot render false

[DPR-LAND-004] [TODO] [P1] Conversion steps and fee copy gate
  Data point: L-004
  Validation gates: source/citation, last verified date, manual verification label

[DPR-LAND-005] [DONE] [P0] Render land restrictions reliably
  Data point: L-005
  Validation gates: A6 restrictions mapped to report red flags with severity/action/citation

[DPR-LAND-006] [TODO] [P1] Buildability source expansion
  Data point: L-006
  Validation gates: BDA/BMC/Bhuvan statuses; "zoning not verified" until source succeeds

[DPR-LAND-007] [DONE] [P1] Classification unavailable copy
  Data point: L-007
  Validation gates: exact missing source reason and seller document request
  Notes: A10 includes the exact Bhulekh source status/reason in classification-unavailable copy and in the land-class source line, and asks for the current Bhulekh Khatiyan/manual tehsil-lawyer verification.

[DPR-CRT-001] [PARTIAL] [P0] eCourts negative-result hardening
  Data point: C-001, C-003
  Validation gates: all Khurda complexes, captcha retries/confidence, name variants, raw artifact, double-fetch
  Notes: eCourts now searches all five Khurda complexes, records OCR text/confidence when available, classifies result panels, captures per-attempt artifact hashes, and fails closed for unsupported district inputs. Remaining work: live 10-run solve-rate measurement, name variants, and double-fetch negative confirmation.

[DPR-CRT-002] [DONE] [P0] RCCMS placeholder cannot be usable
  Data point: C-002, C-003, H-006
  Validation gates: not_implemented state until live fetcher exists; summary/court copy respects it

[DPR-CRT-003] [PARTIAL] [P0] Critical no-cases gate
  Data point: C-003
  Validation gates: both eCourts and RCCMS live success, variants, raw artifacts, parser hashes; otherwise incomplete search copy
  Notes: A10/A11 no longer render clean "no active cases" copy from partial/placeholder sources. Even with accepted eCourts captcha, report copy is source-scoped and explicitly says it is not a full court-clearance finding. RCCMS live fetcher, variants, raw artifact persistence, and double-fetch remain.

[DPR-CRT-004] [DONE] [P0] Court case mapper normalization
  Data point: C-004, C-005, C-006
  Validation gates: eCourts `caseNo/court` and RCCMS fields normalize into one report schema

[DPR-CRT-005] [TODO] [P1] Court status/date normalization
  Data point: C-007, C-008
  Validation gates: raw status/date retained, normalized status/date optional

[DPR-CRT-006] [TODO] [P0] High Court and DRT dispute expansion
  Data point: C-009
  Validation gates: party search, title-related cause detection, banner escalation

[DPR-ENC-001] [TODO] [P0] Probe and document current IGR EC flow
  Data point: E-001
  Validation gates: working URL/path, access/fee/auth notes, failure modes

[DPR-ENC-002] [TODO] [P1] SRO resolver
  Data point: E-002
  Validation gates: village/tahasil to SRO map, no Nominatim tahasil fallback as SRO
  Notes: Hardcoded Khordha/Bhubaneswar fallback was removed. Until an official SRO resolver exists, missing district/SRO stays visible as `Not verified`.

[DPR-ENC-003] [PARTIAL] [P0] Fee and instruction reliability
  Data point: E-003, A-004
  Validation gates: last-verified fee metadata or no exact fee claim
  Notes: Static/demo/A7 copy no longer includes fixed Rs. 500/Rs. 1000 fee claims. Still needs a live-probed fee source config before showing exact fees.

[DPR-ENC-004] [TODO] [P0] Verified EC add-on flow
  Data point: E-004
  Validation gates: paid/manual concierge SKU, EC artifact, parser/manual-review state

[DPR-ENC-005] [TODO] [P0] CERSAI charge search
  Data point: E-005
  Validation gates: paid search, active/closed charge status, seller disclosure hard flag

[DPR-ENC-006] [TODO] [P0] IGR transaction history
  Data point: E-006, O-013
  Validation gates: Index-II/NGDRS probe, deed date/doc no/party extraction, Bhulekh mutation reconciliation

[DPR-REG-001] [DONE] [P0] No-regulatory-flags critical negative gate
  Data point: R-001
  Validation gates: empty placeholder cannot render "no immediate flags"; per-layer status required

[DPR-REG-002] [DONE] [P0] Align A8/A10 regulatory contract
  Data point: R-002, R-003
  Validation gates: field names, severity scale, tests with at least one flag

[DPR-REG-003] [DONE] [P0] Regulatory source-line truthfulness
  Data point: R-004
  Validation gates: list only integrated overlays; show not-covered overlays separately
  Notes: Static/demo and A10 copy no longer claim ORSAC/KML or clean overlay screening unless completed overlay sources are present. Empty placeholder flags render incomplete-screening manual verification copy.

[DPR-REG-004] [TODO] [P1] Forest and Chandaka overlay
  Data point: R-005
  Validation gates: official/static boundary, buffer, source timestamp

[DPR-REG-005] [TODO] [P1] Flood/soil/slope overlays
  Data point: R-006
  Validation gates: Bhuvan/SRTM source status, layer timestamp, confidence

[DPR-REG-006] [TODO] [P1] Airport/ASI/CRZ/PESA overlays
  Data point: R-007
  Validation gates: buffers/tables/layers, not-covered copy for missing layers

[DPR-ACT-001] [DONE] [P0] Action item generator from claim states
  Data point: A-001
  Validation gates: unknown/unavailable states create specific manual actions

[DPR-ACT-002] [TODO] [P1] Co-owner action reliability
  Data point: A-002
  Validation gates: depends on DPR-OWN-005

[DPR-ACT-003] [DONE] [P1] Conversion action reliability
  Data point: A-003
  Validation gates: unknown classification creates manual action
  Notes: Unknown classification and unknown conversion state create manual tehsil/lawyer actions. `conversionRequired=true` no longer claims conversion "has not been done"; it says conversion may be required and was not verified online.

[DPR-ACT-004] [PARTIAL] [P0] EC action copy reliability
  Data point: A-004
  Validation gates: depends on DPR-ENC-001 and DPR-ENC-003
  Notes: EC actions no longer include fixed fees or tahasil-as-SRO. A7/A10 require users to confirm the correct district/SRO in the live IGR flow unless an explicit SRO source supplies it. IGR flow probing and official SRO resolver remain.

[DPR-ACT-005] [TODO] [P1] Boundary action from validation findings
  Data point: A-005
  Validation gates: near-boundary and area discrepancy generate surveyor action

[DPR-ACT-006] [PARTIAL] [P1] Mutation action from source-backed fields
  Data point: A-006
  Validation gates: depends on DPR-OWN-009 and DPR-OWN-010
  Notes: RoR case/mutation anchors render as manual follow-up only with no ownership-history inference. Mutation status portal and IGR ownership-chain timeline remain manual/not implemented.

[DPR-COPY-004] [TODO] [P0] Counsel-approved disclaimer enforcement
  Data point: A-007
  Validation gates: A11 rejects empty/non-approved disclaimer
