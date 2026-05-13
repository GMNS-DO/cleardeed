# ClearDeed Source Roadmap

Last updated: 2026-04-30
Status: assessed roadmap, not implementation proof

This document organizes candidate data sources by report feature. It deliberately separates sources we have live-validated from sources that are plausible, official, or high-value but still need a probe. A source does not become "integrated" until it has a fetcher, raw-response capture, parser tests, and at least one live golden-path run.

## Current Integration Status

| Source | Feature area | Current status | Notes |
|---|---|---|---|
| Nominatim | GPS reverse geocoding | Integrated | Useful for district/village hints, but rural village coverage is incomplete. |
| ORSAC GeoServer WFS via `mapserver.odisha4kgeo.in` | GPS to plot polygon | Integrated | Working mitigation for blocked KYL/Bhunaksha ArcGIS path. Needs adjacent-plot and road-layer expansion. |
| Bhulekh RoR | RoR owner, plot rows, kisam/class, dues fields, RoR case/reference anchors | Integrated | Playwright bootstrap plus ASP.NET AJAX HTTP replay works. Parser surfaces owner, khata, plot rows, land class, raw area components, dues, publication dates, and mutation/case-reference anchors found in special/plot remarks. Success and failure states retain artifact hashes/refs; ownership-chain claims still require mutation-status and IGR cross-checks. |
| eCourts | Subordinate court party search | Partial | Form submission and OCR path exist. Zero-result confidence remains unresolved until captcha solve rate and name-variant strategy are measured. |
| RCCMS | Revenue court cases | Placeholder | Parser test exists, but live fetcher currently returns `partial/manual_required`. This must not be represented as verified coverage. |
| IGR | Registry / EC | Manual only | Current product generates instructions/deep-link style guidance. No automated IGR search, EC purchase, payment flow, or parser exists. |
| A5/A6/A7/A8/A10/A11 agents | Interpretation and report writing | Implemented with gaps | Ownership, land classification, encumbrance instructions, regulatory placeholder, report writer, and output auditor exist. Regulatory and encumbrance intelligence are not yet verified data fetches. |

## Feature A: Ownership Chain and Mutation History

Buyer-facing feature: "This plot was last mutated on [date], from [previous owner] to [current owner], case #[X]. Before that, it was held by [Y] for about [Z] years."

| Candidate source | Confidence | Access | Build stance |
|---|---|---|---|
| Bhulekh RoR mutation/case fields | High if field is in raw RoR | First extraction integrated | Parser now extracts case/reference anchors from saved/live RoR remarks when observed, with artifact hashes and raw field provenance. Report rendering is source-scoped; mutation-status lookup and IGR cross-checks remain pending. |
| Bhulekh/Tahasil mutation case status | Medium-high | Browser-session-required | Probe via the current Bhulekh/Tahasil/RCCMS public flow. Search result snippets and public guidance indicate mutation status can be searched by case number or sale deed number, but the exact current endpoint and form contract need live verification. |
| IGR Odisha Index-II / certified-copy search | High value, unproven automation | Likely login/fee for deeper records; some metadata may be public | Treat as paid passthrough after probe. This is the strongest source for registered transaction history, but do not assume stable no-login scraping. |
| NGDRS document search | Medium | Varies by SRO migration | Probe SRO-by-SRO. Use only where Odisha SROs expose a working public search. Prefer it over bespoke IGR parsing where available because schema may be more uniform. |

Validation rules:

- Mutation date should be on or after the corresponding registered deed date.
- Bhulekh current owner should match the transferee on the most recent registered deed after transliteration/name normalization.
- Previous owner in mutation case should match transferor in the deed where that deed is available.
- If IGR shows a newer sale deed than Bhulekh mutation date, report "registered transfer appears newer than revenue record update" as a banner-level finding, not a minor note.

## Feature B: Verified Encumbrance

Current product state: A7 only provides manual EC instructions. It must not claim verified encumbrance coverage.

| Candidate source | Confidence | Access | Build stance |
|---|---|---|---|
| IGR Odisha online EC | High value | Paid government flow | Build as concierge/manual paid add-on first. Automate only after legal/payment review and ToS/access review. Recommended customer SKU: "verified EC review" rather than "guaranteed no encumbrance." |
| CERSAI asset search | Very high fraud value | Public paid search | Prioritize early. It catches equitable mortgages that may not appear in SRO EC. Must handle fee payment, search terms, and active/closed charge interpretation carefully. |
| MCA-21 charges | High for company/LLP sellers only | Public | Conditional source. Trigger only when seller is a company/LLP or director/corporate entity is detected. |
| IBBI public notices | Medium-high for corporate sellers | Public | Conditional source. Search seller/company/promoter names for insolvency proceedings. |

Validation rules:

- CERSAI active charge plus seller non-disclosure is a hard flag.
- EC entries should reconcile against IGR registered transactions for the same period where both are available.
- For company-owned plots, MCA charge records and IGR/CERSAI encumbrance records should not contradict each other.

## Feature C: Court Cases and Disputes

Current product state: eCourts is partial; RCCMS is placeholder. A "0 cases" result is not high-confidence until captcha and name variants are handled.

| Candidate source | Confidence | Access | Build stance |
|---|---|---|---|
| eCourts | High | Browser + captcha | Finish T-016 first: repeated captcha measurement, retry strategy, name variants, and explicit negative-result confidence. |
| RCCMS | High for revenue disputes | Public browser flow | Replace placeholder fetcher with live probe and parser. Revenue litigation is directly relevant to title. |
| Orissa High Court | High value | Public | Add after eCourts/RCCMS. High Court writs and appeals are material and not covered by subordinate-court search alone. |
| NJDG | Medium | Public | Use as sanity-check/fallback when eCourts fails; lower detail than direct case portals. |
| DRT | High encumbrance/dispute value | Public | Prioritize with High Court. DRT proceedings against seller can precede SARFAESI enforcement. |
| Supreme Court | Low frequency, cheap signal | Public | Add as low-cost completeness check after core sources. |
| NCLT | Conditional | Public | Trigger only for company/LLP sellers or promoters. |
| Lok Adalat / Consumer Commission | Low-medium | Public/varies | Defer unless concierge reports show recurring buyer need. |

Escalation rule: title-related causes of action such as specific performance, declaration of title, partition, injunction, possession, cancellation of sale deed, SARFAESI, or DRT recovery involving the same owner plus village/khata/plot should become a banner-level finding.

## Feature D: Land Classification and Buildability

Current product state: Bhulekh kisam/class is parsed, but kisam is not zoning. The report must say this plainly.

| Candidate source | Confidence | Access | Build stance |
|---|---|---|---|
| Bhulekh RoR kisam/class | Integrated | Public | Continue using as revenue classification only. Do not treat as building permission. |
| BDA CDP zoning / plan search | High for Bhubaneswar fringe | PDFs/web map varies | Probe for a usable map/service. In the short term, deep-link/manual review may be more reliable than automation. |
| BMC jurisdiction/ward boundaries | High | Public maps/PDFs | Add GPS-in-polygon once boundaries are available. Affects approval authority, holding tax, and stamp duty context. |
| Unauthorized layout/colony lists | Medium-high | Government PDFs | One-time ingestion plus quarterly refresh. Requires PDF provenance and versioning. |
| Master/regional plan layers | Medium | PDF/KML/shapefile varies | Ingest static layers where downloadable; otherwise cite manual follow-up. |
| Bhuvan flood/soil/slope layers | High for buyer value | WMS/WFS likely available | Probe WMS/WFS layer names and licensing. Flood overlay is especially important around Khordha/Daya river tracts. |
| CGWB groundwater status | Medium | Public reports/data | Block-level signal only. Useful for borewell expectation, not title. |

## Feature E: Regulatory Overlays

Current product state: A8 is a placeholder with no real overlay ingestion. Empty flags are not proof of absence.

Prioritized overlays:

| Source/layer | Priority | Build stance |
|---|---|---|
| Forest/deemed forest layers via PARIVESH/FSI/Bhuvan | P0 | Probe WMS/shapefile availability; forest adjacency is material. |
| Chandaka-Dampara wildlife sanctuary/buffer | P0 for Khordha | Static boundary ingestion if official map/shapefile is available; otherwise manual-review layer. |
| Bhubaneswar airport height/zoning buffers | P1 | Create distance bands first; replace with official AAI zoning once obtained. |
| ASI and State Archaeology protected monuments | P1 | Build district list plus 100m/200m buffers from geocoded monument points; mark geocoding uncertainty. |
| CRZ | P2 for Khordha | Cheap negative check, but mostly inland. Use Bhuvan/NCCR layers if accessible. |
| PESA/Schedule V | P2 for Khordha | Likely low exposure, still maintain district/block lookup table. |
| Highway/railway widening and acquisition corridors | P2 | High buyer value but notification ingestion is messy. Start with NHAI/PWD road proximity and manual notification check. |
| Mining leases, defence land, cantonment | P3 | Rare in Khordha but useful for completeness later. |

## Feature F: Tax and Civic Dues

| Source | Trigger | Build stance |
|---|---|---|
| BMC property/holding tax | Plot within BMC | Add after BMC boundary check. Usually requires holding number; otherwise report as seller-document request. |
| TPCODL electricity dues | Seller provides consumer number | Optional buyer-assisted check. Do not attempt identity-invasive lookup. |
| PHED/water dues | Seller provides consumer number | Optional buyer-assisted check. |
| Land revenue/cess dues | Bhulekh/Tahsildar | Surface fields already in RoR where present; otherwise manual Tahasildar verification. |

## Feature G: RERA

Trigger this only when the plot is marketed as part of a layout/project, the seller is a promoter/builder, or the buyer provides a project/layout name.

| Source | Confidence | Build stance |
|---|---|---|
| Odisha RERA public search | High | Add project-name, registration-number, and promoter-name lookup after core court/encumbrance work. Verify project status, expiry, complaints/orders, promoter history, and whether the marketed plot appears inside approved layout documents where available. |

Critical rule: if a marketed project/layout appears to require RERA registration but no registration is found, report as a banner-level "project registration not verified" finding, with legal review recommended. Do not declare the layout illegal automatically without lawyer review.

## Feature H: Identity and Seller Verification

| Source | Build stance |
|---|---|
| PAN verification | Optional buyer-assisted flow only. Confirm PAN/name plausibility, not identity ownership. Requires consent and DPDP review. |
| Aadhaar | Do not build for V1/V1.5. Regulatory/privacy risk is disproportionate. |
| MCA DIN/director master data | Conditional for company/LLP sellers and promoters. |
| Power of Attorney registration check | High-value manual/paid add-on. If sale is via PoA, verify registered PoA through IGR before treating seller authority as plausible. |
| Death/legal-heir certificate | Manual checklist. If RoR owner is deceased and seller claims inheritance, require legal-heir certificate and mutation status; current online coverage is not enough. |

## Feature I: Geospatial and Boundary Intelligence

| Feature | Source | Build stance |
|---|---|---|
| Adjacent plot ownership | GeoServer WFS + Bhulekh | High-leverage extension: query neighboring polygons and fetch owners where possible. Useful for boundary dispute detection. |
| Subdivision pattern detection | GeoServer WFS | Detect uniform small plots carved out of agricultural parent land. Flag as possible unauthorized layout risk, not proof. |
| Road access/class | ORSAC roads layer or OSM | Start with OSM and polygon-road touch/proximity. Replace with official cadastral roads if layer exists. |
| Civic proximity | OpenStreetMap | Easy buyer-context feature. Keep separate from legal verification. |
| Satellite imagery diff | Sentinel-2/Landsat | High buyer delight; medium verification value. Add after core legal sources. |
| Soil/elevation/slope | Bhuvan/SRTM | Useful for construction cost context, not title. |

## Feature J: Market Signal

Use IGR registered transaction values only in aggregate and only after legal/product review. Do not show per-plot price advice or "fair value" recommendations in V1 consumer reports. Acceptable framing: "registered transactions in this village during [period] are available as a paid market-context add-on" once data access is verified.

## Source Priority

Maximum buyer-perceived value per engineering hour:

1. Surface Bhulekh mutation/reference fields already present in RoR, if confirmed in raw HTML.
2. Replace RCCMS placeholder with a real live fetcher.
3. Finish eCourts negative-result confidence: captcha retries, name variants, double-fetch.
4. Add Orissa High Court and DRT party-name searches.
5. Probe IGR Index-II and EC flows; launch as concierge paid add-on before full automation.
6. Add CERSAI public paid search as a separate encumbrance add-on.
7. Add Bhuvan/forest/flood and Chandaka/airport/ASI overlays.
8. Add RERA lookup for project/layout/promoter cases.
9. Add adjacent-plot/subdivision/road-access intelligence from existing WFS.
10. Add BMC dues, CGWB groundwater, and satellite imagery as V1.5 buyer-context enhancements.

## Validation Patterns

These rules distinguish ClearDeed from a portal aggregator:

1. Cross-source equality: Bhulekh current owner, IGR transferee, CERSAI borrower/chargor, and civic taxpayer names should reconcile where those records exist.
2. Temporal monotonicity: registration date should not be after corresponding mutation date unless the report flags revenue-record lag. Mutation before registration is a hard anomaly unless explained by a non-sale mutation.
3. Area reconciliation: Bhulekh RoR area, Bhunaksha polygon area, sale deed area, and seller-claimed area should agree within 5% unless the difference is explained.
4. Schema-version pinning: each fetcher stores a structural hash of the response template and fails loudly on template drift.
5. Provenance: every report claim links to source name, fetch timestamp, raw artifact ID, and parser version.
6. Double-fetch critical negatives: court and encumbrance "no result" findings require repeat fetch or explicit low-confidence language.
7. Negative-result confidence: "0 cases" depends on captcha success, name variants, transliteration, and portal status.
8. Polygon-RoR-registry checksum: GPS polygon, RoR plot/khata, IGR plot/khata, and seller claim must reconcile or generate a finding.

## Definition of Done for a New Source

- `docs/sources/<source>.md` documents URL, access, auth, fees, schema, parser assumptions, and failure modes.
- Fetcher stores raw response/artifact and parsed result.
- Parser has fixtures from real anonymized responses.
- Live golden-path run succeeds for at least one Khordha plot.
- Negative-result behavior is defined.
- Source status appears in the report; failures are visible to the buyer.
- Validation rules are added before the source can create a clean or reassuring report sentence.

## Definition of Done for a Report Data Point

A source can be integrated while a report data point remains unsafe. Each data point must graduate separately through [`docs/validation/data-point-reliability.md`](../validation/data-point-reliability.md).

- The data point has an ID and owner task in the reliability matrix.
- The report claim has a readiness state: not covered, fetched, validated, cross-checked, or reviewed.
- The primary source and all fallback sources are documented.
- Required provenance is available: source, fetchedAt, inputUsed, statusReason, artifact hash/ref, parser version, and template hash where applicable.
- Field-level validators pass, and cross-source validators exist for owner, plot identity, area, mutation dates, court negatives, encumbrance negatives, and regulatory negatives where relevant.
- Worst-case behavior is explicit: timeout, source down, captcha failure, empty result, parser drift, partial data, duplicate rows, stale record, and mismatched sources.
- A10/A11 enforce allowed copy for that state. Partial or placeholder data cannot render reassuring language.
- Golden fixtures or domain-review examples cover clean, mismatch, unavailable, and ambiguous cases.
