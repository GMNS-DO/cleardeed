# Section Data-Point Inventories — Sprint V3

> **Spec of record for the per-section validators.**
> The validators in this directory (`section-*.test.ts`) check every report
> against this spec. If a data point here is missing or wrong in the HTML, the
> validator fails (or, if the ground-truth manifest/fetcher_results are not yet
> available, the test skips).

> **Source of truth:** the audit agent's mapping of HTML variables to
> `agents/consumer-report-writer/src/index.ts` and `agents/consumer-report-writer/src/mapper.ts`.
> If you change a section's HTML, update the inventory and the validator
> together — they are a single contract.

> **Coverage discipline:** each inventory below lists every consumer-visible
> data point the section must contain. The right-hand column gives the
> fetcher/interpreter that produces the value. The `degradation_tag` column
> is the typed tag the validator must accept as a substitute when the
> underlying fetcher is missing, failed, or unparseable.

---

## Section 1 — The Plot (`#section-plot`)

**HTML location:** `index.ts` lines 491-526.
**Produces:** the buyer's "what is this land, where is it, what does the
revenue map say" answer. This is the most data-dense section.

| # | Data point (consumer-visible) | HTML source | Underlying fetcher / interpreter | Degradation tag (when value is absent) |
|---|---|---|---|---|
| 1.1 | GPS coordinates (lat/lon formatted as "X.XXXXXX°N, Y.YYYYYY°E") | `${gpsDisplay}` row | `gpsCoordinates` (pipeline input) | `gps_error: "GPS not captured"` banner shown if `gpsWarning` validation finding present |
| 1.2 | Village name (preferring revenue map > Nominatim) | `${safeVillage}` row | `bhunaksha.data.village` ?? `nominatim.data.village` | `bhunaksha_down` / `bhulekh_no_data` (see matrix) |
| 1.3 | Tahasil (tehsil) | `${safeTahasil}` row | `bhunaksha.data.tahasil` ?? `nominatim.data.tahasil` | `nominatim_down` (no fetcher returns a usable value) |
| 1.4 | District | `${safeDistrict}` row | `nominatim.data.district` | `nominatim_down` |
| 1.5 | Khatiyan number (RoR ID) | `${safeKhataNo}` row | `bhulekh.data.khataNo` | `bhulekh_no_data` — field shown as "—" if absent |
| 1.6 | Plot number (survey number) | `${safePlotNo}` row | `bhunaksha.data.plotNo` → `bhulekh.tenants[].surveyNo` fallback chain | `bhunaksha_no_data` / `bhulekh_no_data` — shown as "—" |
| 1.7 | RI Circle (optional, hidden if absent) | conditional row | `revenueRecords.riCircle` (rarely populated) | row is **omitted** from the table — absence is the degradation |
| 1.8 | RoR completeness panel (publication date, mutation history, etc.) | `${rorCompletenessPanel}` | A5 OwnershipReasoner + Bhulekh raw document | `ror_completeness_partial` notice inside the panel |
| 1.9 | RoR plot table (all plots in the Khatiyan, with selected highlighted) | `${rorPlotTablePanel}` | `bhulekh.plotTable.rows` from raw document | `bhulekh_no_data` — table omitted |
| 1.10 | Source line: Bhunaksha status + Bhulekh status | `source-line` | `sourceStatus.bhunaksha`, `sourceStatus.bhulekh` | status text reflects fetcher status directly |
| 1.11 | Verify-yourself link: Bhunaksha GeoServer WFS | `buildVerifyLink("https://mapserver.odisha4kgeo.in/geoserver/ows", "Bhunaksha")` | rendered if `bhunakshaUsable` | link omitted if `bhunakshaUsable === false` |
| 1.12 | Verify-yourself link: Bhulekh RoR portal | `buildVerifyLink("https://bhulekh.ori.nic.in/", "Bhulekh")` | rendered if `bhulekhUsable` | link omitted if `bhulekhUsable === false` |
| 1.13 | Village-name mismatch warning (if Bhunaksha village differs from Bhulekh village) | `${villageWarning}` | `validationFindings[].dimension === "village"` | only rendered if mismatch is flagged |

**Validates "section complete"** when: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6 are either
populated correctly OR carry an explicit degradation tag. 1.7-1.13 are
optional-quality checks; the validator **does not fail** on their absence
because they are correctly hidden when data is missing.

---

## Section 2 — The Owner (`#section-owner`)

**HTML location:** `index.ts` lines 540-575.
**Produces:** the buyer's "does the seller actually own it" answer.

| # | Data point | HTML source | Fetcher / interpreter | Degradation tag |
|---|---|---|---|---|
| 2.1 | Owner-match status badge (matched / partial / mismatch / unknown) | `${ownerBadge(nameMatch.state).label}` | `OwnershipReasoner.nameMatch` | badge renders "Unknown" when `nameMatch.state === "unknown"` |
| 2.2 | Insight highlights (top title + positive signals) | `${buildInsightHighlights([...rorInsights.owner, ...topInsights(title, 2)])}` | A5 + risk insight engine | empty array renders nothing — graceful |
| 2.3 | Owner detail block (English reading of RoR name, father/guardian name, classification) | `${ownerDetailsSection}` | `buildOwnerDetailsSection({ ownerRecords, bhulekhUsable, bhulekhStatus })` | warning box "RoR owner details are unavailable" if `!bhulekhUsable` |
| 2.4 | Co-owner caution note (when multiple RoR owners) | `${coOwnerNote}` | `coOwners.length > 0` | section is silent when only one owner |
| 2.5 | Tenant/plot row table (English-only, per RoR row) | `${tenantRows}` | `bhulekh.tenants[]` + `findTargetPlotRow` | renders `<tr><td colspan="6">No tenant records returned from Bhulekh.</td></tr>` if `tenants.length === 0` |
| 2.6 | Bhulekh "last published" date | `${revenueRecords?.lastUpdated ?? '—'}` | `bhulekh.data.lastUpdated` | shown as "—" if absent |
| 2.7 | Source line: Bhulekh | `source-line` | `sourceStatus.bhulekh` | always present, reflects status |
| 2.8 | Verify-yourself link: Bhulekh | `buildVerifyLink("https://bhulekh.ori.nic.in/", "Bhulekh")` | rendered if `bhulekhUsable` | link omitted if `!bhulekhUsable` |

**Validates "section complete"** when: 2.1 badge is non-empty AND 2.3 owner
block is either populated OR carries the "RoR owner details are unavailable"
warning. 2.4-2.8 are optional-quality.

---

## Section 3 — Land Classification (`#section-land`)

**HTML location:** `index.ts` lines 589-642.
**Produces:** the buyer's "can I build what I want here" answer.

| # | Data point | HTML source | Fetcher / interpreter | Degradation tag |
|---|---|---|---|---|
| 3.1 | Primary classification heading (e.g., "Irrigated", "Homestead", "Unknown") | `${safeClassification}` | `formatLandClassDisplay(landClassEnglish, landClassOdia, primaryTenant.landClass)` | "Not verified" when `!bhulekhUsable` |
| 3.2 | Classification basis text (raw Odia kisam + "Based on Bhulekh RoR") | `${classificationBasisText}` | derived from `landClassOdia` + `bhulekhUsable` | "Not verified from Bhulekh in this run" when `!bhulekhUsable` |
| 3.3 | Insight highlights (land-class risks) | `${buildInsightHighlights(rorInsights.land)}` | A6 LandClassifier | empty array renders nothing |
| 3.4 | Land classification details card (raw + standardized + conversion flag) | `${buildLandClassificationDetails(...)}` | `landClassifier` + `primaryTenant` | "Classification not verified" warning if `!bhulekhUsable` |
| 3.5 | BDA Master Plan zone card (Sprint 4) | `${bdaZoneCard}` | `bdaZoneData` from `bdaZoningFetch` | card is **omitted** when no data — degraded to section info-box only |
| 3.6 | Conversion-required caution box (when land is agricultural) | conditional `<div class="caution-box">` | `conversionRequired === true` | box rendered only when true — silent otherwise |
| 3.7 | Conversion-status-unknown warning (when Bhulekh worked but classifier didn't decide) | conditional `<div class="warning-box">` | `conversionUnknown === true` | "Conversion requirement not verified" warning |
| 3.8 | Red flag caution boxes (one per flag in `landClassifier.redFlags[]`) | `${redFlags.map(flag => ...).join('')}` | A6 LandClassifier red flags | section is silent when `redFlags.length === 0` |
| 3.9 | Area discrepancy warning | `${areaWarningHtml}` | `validationFindings[].dimension === "area"` | only rendered if `areaWarning` present |
| 3.10 | Bhulekh-down warning (last-resort when fetcher failed) | conditional `<div class="warning-box">` | `!bhulekhUsable` | "Classification not verified" warning + `bhulekhUnavailableReason` |
| 3.11 | Source line: Bhulekh land-class status | `source-line` | `sourceStatus.bhulekh` | always present |
| 3.12 | Verify-yourself link: Bhulekh | `buildVerifyLink` | rendered if `bhulekhUsable` | omitted if `!bhulekhUsable` |

**Validates "section complete"** when: 3.1 is non-empty AND (3.2 OR 3.10) is
non-empty. 3.3-3.12 are optional-quality.

---

## Section 4 — Court Cases & Encumbrances (`#section-encumbrance`)

**HTML location:** `index.ts` lines 658-680.
**Produces:** the buyer's "can I lose it after paying" answer.

| # | Data point | HTML source | Fetcher / interpreter | Degradation tag |
|---|---|---|---|---|
| 4.1 | Court-case panel (cases found / not-found / partial) | `${courtSection}` | `buildCourtSection(totalCases, caseList, courtSourceStatuses, district, searchMetadata)` | error-notice or warning-notice when both eCourts and RCCMS failed |
| 4.2 | RoR back-page panel (mutation history / encumbrance entries from Bhulekh) | `${rorBackPagePanel}` | `bhulekh.backPage` raw document | panel **omitted** if `revenueRecords?.backPage` is null — graceful |
| 4.3 | Mutation reference panel (case/order anchors from Bhulekh RoR remarks) | `${mutationReferencePanel}` | `revenueRecords.mutationReferences[]` | panel **omitted** when no references — silent |
| 4.4 | Encumbrance Certificate instructions (IGR Odisha + CERSAI) | `${ecSection}` | `buildEcSection(encumbranceReasoner, ...)` from A7 EncumbranceReasoner | always renders — falls back to default step list if `encumbranceReasoner.instructions` is null |
| 4.5 | Source line: court + EC sources | `source-line` | hard-coded text | always present |
| 4.6 | Verify-yourself link: eCourts (if eCourts succeeded) | conditional `buildVerifyLink` | `courtSourceStatuses.ecourts === "success"` | omitted when source failed |
| 4.7 | Verify-yourself link: RCCMS (if RCCMS succeeded) | conditional `buildVerifyLink` | `courtSourceStatuses.rccms === "success"` | omitted when source failed (RCCMS is `manual_required` in V1.1) |
| 4.8 | Verify-yourself link: IGR Odisha EC | `buildVerifyLink(safeRegUrl, "IGR Odisha")` | always rendered | always present (link is canonical) |

**Validates "section complete"** when: 4.1 is non-empty AND 4.4 is non-empty.
4.2-4.8 are optional-quality.

---

## Section 5 — Regulatory Flags (`#section-regulatory`)

**HTML location:** `index.ts` lines 694-715.
**Produces:** the buyer's "are there protected-zone restrictions" answer.

| # | Data point | HTML source | Fetcher / interpreter | Degradation tag |
|---|---|---|---|---|
| 5.1 | Regulatory flag cards (one per flag in `regFlagList`) | `${regSection}` | `buildRegSection(regFlagList, regulatoryVerified)` | warning-notice or success-notice when `flags` is empty — never silent |
| 5.2 | "About regulatory screening" info box | `<div class="info-box">` | hard-coded text | always rendered |
| 5.3 | Source line: overlay screening status | `source-line` | `${regulatoryVerified ? ... : ...}` | always rendered |

**Validates "section complete"** when: 5.1 is non-empty (the section always
renders — even when no flags are found, the buildRegSection produces a
warning-notice or success-notice).

---

## Section 6 — Land Acquisition Risk / LARR (`#section-larr`)

**HTML location:** `index.ts` lines 729-743.
**Produces:** the buyer's "is the government planning to acquire this land" answer.

| # | Data point | HTML source | Fetcher / interpreter | Degradation tag |
|---|---|---|---|---|
| 6.1 | Risk level badge (HIGH / ELEVATED / LOW / UNKNOWN) | `${riskDisplay}` inside `caution-box` | `larrRiskAssessment.riskLevel` | "UNKNOWN" + flag-low class when `larr === null` |
| 6.2 | SIA notification summary | conditional `<p>` | `larr.siaNotification` | "No known Social Impact Assessment (SIA) notifications detected automatically." when absent |
| 6.3 | eCourts-verified text | `${verifiedText}` | `larr.verifiedInEcourts` | "Manual verification recommended" when not verified |
| 6.4 | RTI recommendation + RTI question | `<p><strong>What to do:</strong>...</p>` | hard-coded fallback | always rendered — uses fallback RTI question even when `larr` is null |

**Validates "section complete"** when: 6.1 is non-empty AND 6.4 is non-empty.

**Important V1.1 caveat:** see `qa/larr_honesty.md`. The LARR fetcher is
built but is NOT called in the V1.1 pipeline (it relies on `screenRegulations`
which is wired; LARR is a separate call). For Sprint V3 the current report
shows the "UNKNOWN" + RTI-recommended state. The validator in
`section-larr.test.ts` accepts this state as a known-degraded outcome
(typed tag: `larr_not_wired`) rather than failing.

---

## Section 7 — Market Benchmark (`#section-benchmark`)

**HTML location:** `index.ts` lines 757-771.
**Produces:** the buyer's "what should I pay" answer.

| # | Data point | HTML source | Fetcher / interpreter | Degradation tag |
|---|---|---|---|---|
| 7.1 | Floor band — circle rate display ("₹X per acre" or "₹Y per sqft") | `${rateDisplay}` in `buildBenchmarkSection` | `circleRateData.data[]` matched by `selectBestRateRow` | "Not in our dataset for {village}, {tahasil}" + verify link when `row === null` |
| 7.2 | Floor band — scaled floor value for the plot | conditional `<div class="bm-band-scaled">` | `acres * ratePerAcre` | row omitted when `acres` is null or `ratePerAcre === 0` |
| 7.3 | Floor band — last updated date | `${sourceDate}` | `row.lastUpdated` | shown as "—" if absent |
| 7.4 | Floor band — verify-yourself link to IGR BMV | conditional `<a>` | `row.sourceUrl` or default IGR BMV URL | always rendered — defaults to IGR BMV |
| 7.5 | Directional band — recent transactions | hard-coded `<div class="bm-dir">` | static text | always renders "Not fetched in this run" — known V1.1 limitation |
| 7.6 | Ceiling band — market comparables | hard-coded `<div class="bm-ceil">` | static text | always renders "Verify with local broker" — known V1.1 limitation |
| 7.7 | Source line: IGR Odisha Benchmark Valuation Portal | `source-line` | hard-coded text | always rendered |

**Validates "section complete"** when: 7.1 is non-empty (band always renders
— either with rate data or with the "Not in our dataset" message) AND
7.5-7.6 directional and ceiling bands are present.

---

## Cross-section data points (not owned by a single section)

These show up in multiple sections. The validators do not re-check them per
section, but the **cross_source_validator.test.ts** covers them.

| Data point | Sections | Fetcher |
|---|---|---|
| District name | 1, 2, 3, 4, 7, summary, financial | `nominatim.data.district` |
| Village name | 1, 2, 3, 4, 7 | `bhunaksha.data.village` ?? `bhulekh.data.village` ?? `nominatim.data.village` |
| Tahasil | 1, 7 | `bhunaksha.data.tahasil` |
| Plot number | 1, 2, 4, action, 6 questions | `bhunaksha.data.plotNo` → Bhulekh tenant surveyNo → registry link params |
| Owner name | 2, summary, action | Bhulekh tenant → A5 OwnershipReasoner |

---

## Degradation tag taxonomy (typed tags the validators accept)

The validators use these typed tags to recognize "this value is absent on
purpose and the report degrades correctly" vs "this value is missing and the
section is broken". The list is short and stable.

| Tag | Meaning | Used in |
|---|---|---|
| `bhulekh_no_data` | Bhulekh returned no RoR rows for the search | 1.5, 1.6, 1.9, 2.5, 2.6 |
| `bhulekh_down` | Bhulekh fetcher errored (network / parser) | 1.5, 1.6, 1.9, 2.3, 2.5, 2.6, 3.1, 3.4, 3.10 |
| `bhunaksha_no_data` | Bhunaksha returned no polygon / feature for the plot | 1.2, 1.6, 1.11 |
| `bhunaksha_down` | Bhunaksha WFS errored | 1.2, 1.6, 1.11 |
| `nominatim_down` | Nominatim geocoder errored | 1.3, 1.4 |
| `gps_error` | GPS coordinates were zero/NaN or out of range | 1.1 |
| `rccms_manual_required` | RCCMS portal unreachable → marked `manual_required` in V1.1 (Sprint 5 hotfix) | 4.1, 4.7 |
| `ecourts_no_captcha` | eCourts ran but didn't get accepted-captcha metadata | 4.1 |
| `ecourts_down` | eCourts fetcher errored | 4.1, 4.6 |
| `igr_ec_unavailable` | IGR EC fetcher errored — section falls back to default step list | 4.4 |
| `cersai_unavailable` | CERSAI OCR failed — section falls back to default step list | 4.4 |
| `regulatory_unverified` | No overlay layer completed; "About regulatory screening" info box shown | 5.1, 5.3 |
| `regulatory_no_flags` | Overlay ran clean — success-notice shown | 5.1 |
| `larr_not_wired` | LARR fetcher built but not called in V1.1 pipeline — UNKNOWN risk + RTI fallback shown | 6.1, 6.2, 6.3 |
| `circle_rate_outside_dataset` | Village not in circle-rate JSON — "Not in our dataset" message + IGR BMV link | 7.1, 7.4 |
| `directional_not_fetched` | Known V1.1 limitation — IGR transaction prices not yet wired | 7.5 |
| `ceiling_local_broker` | Known V1.1 limitation — MagicBricks/99acres scraping not done | 7.6 |

A section validator passes if, for every data point in its inventory, the
value is either (a) populated correctly OR (b) the validator can find one of
the typed degradation tags for that point in the report HTML.
