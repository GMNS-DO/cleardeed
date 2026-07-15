# ClearDeed — Unified Consumer-Report Insight Engine

**Date:** 2026-06-18
**Author:** ClearDeed founder + Claude (Opus 4.7)
**Status:** Draft for user review
**Scope:** Replace the current two-engine pattern (`buildRiskInsights` + `buildRoRInsightGroups`) with a single insight engine that emits legally bounded insights across every consumer-report panel, grounded in the Bhulekh master reference doc and the cross-source pipeline doc.

**Depends on:** ADR-019 (rule-based, no live LLM in consumer output), ADR-020 (5 issue lenses, 7 evidence strengths, source-anchored body language).

---

## 1. Reframed objective

ADR-020 scoped the insight engine to the **RoR Back Page only**. The mapping pass over the two reference docs (`bhulekh insights master.md` and `odisha property app pipeline.md`) revealed that buyer-relevant facts exist in **16 insight panels across 3 source layers** (ROR, Bhunaksha/Plot Report, and the IGR/CERSAI/eCourts/court pipeline). All 16 panels need the same lens+evidence discipline.

> **Note on panel count:** the earlier draft said "28 panels" — that mixed rendered report sections (28) with insight panels (16). The `InsightPanel` enum in §4.1 lists 16 codes. A separate `ReportSection` enum (in A10, not the insight engine) maps each `InsightPanel` to one or more rendered sections.

The current state is:

| Layer | Engine | Panels covered | Limitations |
|---|---|---|---|
| RoR (Back Page) | `buildRoRInsightGroups` (post-ADR-020) | 1 (backPage) | Single-panel; no per-insight disclosure |
| RoR + Bhunaksha | `buildRiskInsights` (pre-ADR-020) | 6 (plot, owner, land, plotTable, dues, neighbours) | Pre-ADR-020 language; no lens+evidence taxonomy |
| IGR / CERSAI / eCourts | none | 0 | No rules defined; engine would silently skip these panels |

**The reframed objective:**

> Every consumer-report panel — current and future — should emit insights through a single engine that maps source facts to legally bounded issues with explicit lens and evidence-strength tags, so a buyer (or a buyer's advocate) can read the report and know exactly what each insight is anchored to and what it does not claim.

Concretely: collapse the two engines into one `Insight[]` stream, define **72 rules across 14 panel files** (38 sourced from the Bhulekh/Bhunaksha mapping pass + 17 IGR/court/registry stubs that auto-activate as their fetchers ship + 17 cross-source/boundary rules), add a per-insight closed disclosure, and let the A11 auditor enforce the prohibited-phrase and lens+evidence invariants.

> **Note on rule count:** an earlier draft said "38 rules" — that number referred to the initial mapping pass. The full registry (which includes every IGR/CERSAI/eCourts stub plus a chain-recursion placeholder) is 72 rules. The Phase 10 stubs (ROR-INS-090/091/092) sit in the same registry but ship as `parser_uncertain` until their upstream fetchers come online.

---

## 2. Three principles

1. **One insight type, one registry, one engine.** `buildRiskInsights` and `buildRoRInsightGroups` are deleted; every section calls `buildPanelInsights(input)`. This is the unification ADR-020 pointed at without naming.

2. **The taxonomy is closed; the registry is open.** The 5 issue lenses and 7 evidence strengths are fixed (ADR-020). The registry of rules is open — new rules can be added without changing the engine signature, the A11 auditor, or the disclosure UI.

3. **Stubs auto-activate.** Rules for IGR, CERSAI, eCourts, DRT, High Court, and RERA return `parser_uncertain` text today. The moment the corresponding fetcher starts returning live data, the rule detects the change in its input shape and switches to its real body — no config flag, no engine change.

---

## 3. Source-of-truth mapping (the heart of the design)

A separate workflow pass produced two fact-mapping tables covering 73 source facts across the two reference docs. Every fact is tagged with: `panel`, `issueLens` ∈ {title_chain, registry_ec, revenue_record, land_use_permission, parser_source_quality}, `evidenceStrength` ∈ {document_anchor, case_or_order_anchor, selected_plot_anchor, row_count_signal, source_observation, parser_uncertain, missing_source}, `severity` ∈ {positive, watchout, redFlag}, `prohibited[]` (a per-fact list of phrases that must never appear in the body).

### 3.1 Coverage audit

| Dimension | Status | Notes |
|---|---|---|
| 5 issue lenses | ✓ all exercised | title_chain (6 rules), registry_ec (4), revenue_record (9), land_use_permission (10), parser_source_quality (10) |
| 7 evidence strengths | ✓ all exercised | document_anchor (2), case_or_order_anchor (2), selected_plot_anchor (3), row_count_signal (4), source_observation (5), parser_uncertain (5), missing_source (3) |
| 9 pipeline sources | ✓ all covered | Bhulekh (22), Bhunaksha (4), IGR EC (2), IGR Deed (3), IGR Benchmark (2), CERSAI (2), Revenue Dues (2), eCourts (2), Adjacent plots (2) |
| 6 master Section 7 red flags | ✓ all covered | lease-deed → tenure_govt_notified; EOW-attached → igr_deed_chain_anchor + ecourt_active_case; impersonation → single_token_ambiguous + family_anchor_present; industrial-zone → land_class_unknown + kisam_conversion_sensitive; subdivided-plot → sub_plot_indicator_present; mortgage → cersai_active_charge |
| 7+ pipeline auto-flags | ✓ all covered | MUTATION_WITHOUT_DEED, ACTIVE_MORTGAGE_IN_EC, ACTIVE_BANK_LOAN_CERSAI, SELLER_NAME_MISMATCH_DEED_VS_ROR, AREA_MISMATCH_DEED_VS_ROR, PENDING_LITIGATION, OUTSTANDING_REVENUE_DUES, NO_CONFIRMED_ROAD_ACCESS, DEED_VALUE_SIGNIFICANTLY_BELOW_BENCHMARK |

### 3.2 Sample of the mapping (full table in `docs/insights/insights-engine.md`)

| Fact (source) | Panel | Lens | Evidence | Severity | Prohibited phrases to avoid |
|---|---|---|---|---|---|
| Page 2 = "ଏହି ଖାତାରେ ପ୍ଲଟ ଉପଲବ୍ଧ ନାହିଁ" | plot | revenue_record | document_anchor | redFlag | "verified clear", "ownership verified" |
| Owner is ST + Mouza may be Scheduled Area | owner | land_use_permission | document_anchor | redFlag | "verified clear", "safe to buy" |
| Multiple co-owners (O: pattern count > 1) | owner | title_chain | document_anchor | redFlag | "verified clear", "ownership verified" |
| Kisam = Jungle / Forest | land | land_use_permission | source_observation | watchout | "buildable", "no restriction" |
| Bhunaksha = ---NO DATA--- (triple compound) | plot | parser_source_quality | missing_source | watchout | "verified clear", "safe to buy" |
| ROR Section 6 mutation count > 5 in 24 mo | backPage | title_chain | row_count_signal | watchout | "verified clear" |
| Govt Khatiyan (no personal name) | owner | revenue_record | document_anchor | redFlag | "verified clear", "ownership verified", "safe to buy" |
| Owner address ≠ plot district (no PoA) | owner | title_chain | document_anchor | redFlag | "ownership verified" |
| Compound plot, sibling portion remains | plot | title_chain | document_anchor | watchout | "verified clear", "ownership verified" |
| Fresh mutation = same year as purchase | backPage | title_chain | case_or_order_anchor | watchout | "verified clear" |
| Active mortgage in EC (stubs) | encumbrance | registry_ec | document_anchor | redFlag | "no encumbrance", "verified clear" |
| eCourts pending case (stubs) | court | title_chain | case_or_order_anchor | redFlag | "no litigation", "clear title", "safe to buy" |

### 3.3 Three new panels the original ADR-020 missed

1. **`ownershipChain`** — deed-seller ↔ ROR-owner comparison (pipeline doc, "What Each Source Returns"). It is a *separate* panel from "owner" because it requires deeds data, not just ROR. Stub now; real rule when IGR ships.

2. **`neighbours`** (canonical) — Section 8.4 neighbourhood method. The master doc's prescription is precise enough to encode as deterministic rules now.

3. **`decoderSection`** — the legend at the bottom of every ROR (data is from ROR, not validated; map is indicative). This is meta-info the engine should surface as a low-severity positive insight at the top of the report so buyers do not over-read the report.

---

## 4. Design

### 4.1 Types (`agents/consumer-report-writer/src/insights/schema.ts`)

```ts
export const ISSUE_LENS = [
  'title_chain',
  'registry_ec',
  'revenue_record',
  'land_use_permission',
  'parser_source_quality',
] as const;
export type IssueLens = typeof ISSUE_LENS[number];

export const EVIDENCE_STRENGTH = [
  'document_anchor',
  'case_or_order_anchor',
  'selected_plot_anchor',
  'row_count_signal',
  'source_observation',
  'parser_uncertain',
  'missing_source',
] as const;
export type EvidenceStrength = typeof EVIDENCE_STRENGTH[number];

export const INSIGHT_PANEL = [
  'plot', 'owner', 'land', 'plotTable', 'dues', 'backPage',
  'chain', 'encumbrance', 'deeds', 'court', 'financial',
  'ownershipChain', 'neighbours', 'roadAccess',
  'khaAdjacent', 'completeness',
] as const;
export type InsightPanel = typeof INSIGHT_PANEL[number];

export const SEVERITY = ['positive', 'watchout', 'redFlag'] as const;
export type Severity = typeof SEVERITY[number];

export interface Insight {
  id: string;                  // stable, e.g. 'plot.missing_rows'
  panel: InsightPanel;
  issueLens: IssueLens;
  evidenceStrength: EvidenceStrength;
  severity: Severity;
  tone: 'signal' | 'watchout' | 'redFlag';
  label: string;               // English, short
  body: string;                // English insight, 1-2 sentences
  source: string;              // 'bhulekh' | 'bhunaksha' | 'igr_ec' | ...
  sourceRef?: string;          // e.g. 'Section 6 / ROR S.6 mutations'
  actionItem: string;          // concrete manual follow-up
  displayMeta: {
    disclosureClosed: boolean; // always true initially
    showSource: boolean;       // always true
  };
}
```

### 4.2 Registry layout (one file per panel, per user decision)

```
agents/consumer-report-writer/src/insights/
  schema.ts                       # types above
  display-labels.ts               # code → English strings (single allowlist)
  engine.ts                       # buildInsights, groupByPanel
  helpers.ts                      # hasParserUncertainty, summarizeByLens, ...
  registry/
    bhulekh/
      plot.ts                     # 7 rules
      owner.ts                    # 6 rules
      land.ts                     # 11 rules
      plot-table.ts               # 4 rules
      dues.ts                     # 6 rules
      back-page.ts                # 7 rules
      chain.ts                    # 2 rules + recursive stub
    bhunaksha/
      neighbours.ts               # 4 rules
      road.ts                     # 4 rules
      kha.ts                      # 4 rules
    igr/
      encumbrance.ts              # 4 rules (auto-activate when live)
      deeds.ts                    # 4 rules (auto-activate when live)
      financial.ts                # 4 rules (auto-activate when live)
    court/
      cases.ts                    # 5 rules (auto-activate when live)
    registry/
      index.ts                    # 4 rules (CERSAI/RERA)
    index.ts                      # export-all registry
```

38 rule files total. The `index.ts` re-exports every rule as a `Rule[]` and the engine iterates it.

### 4.3 Rule shape

```ts
export type Rule = {
  id: string;
  panel: InsightPanel;
  issueLens: IssueLens;
  evidenceStrength: EvidenceStrength;
  evaluate: (input: ConsumerReportInput) => Insight[]; // 0..n
};
```

A rule returns an array (0 or more) so that a single rule can fire on multiple instances of the same fact pattern (e.g. multiple co-owners, multiple Section 6 mutation years).

### 4.4 Engine

```ts
export function buildInsights(input: ConsumerReportInput): Insight[] {
  return REGISTRY.flatMap(r => r.evaluate(input));
}

export function groupByPanel(insights: Insight[]): Map<InsightPanel, Insight[]> {
  // Order within panel: watchouts first, then by severity desc, then by id.
  // Cap at MAX_INSIGHTS_PER_PANEL (default 4).
}
```

### 4.5 Disclosure (per-insight, per user decision)

Each rendered insight carries a closed `<details>` block listing its lens, evidence, source, sourceRef, and actionItem. The disclosure uses the same English strings as `display-labels.ts` — single allowlist, single prohibited-phrase list.

```html
<div class="insight insight--watchout">
  <div class="insight__label">Watch-out</div>
  <div class="insight__body">
    The recorded owner's address is in a different district from the plot,
    with no registered power-of-attorney at the local Sub-Registrar.
  </div>
  <details class="insight__disclosure" open>
    <summary>About this insight</summary>
    <dl>
      <dt>Issue lens</dt><dd>Title chain observation</dd>
      <dt>Evidence</dt><dd>Document anchor (ROR Section 2)</dd>
      <dt>Source</dt><dd>Bhulekh ROR · fetched 2026-06-18 14:23</dd>
      <dt>Source observation</dt><dd>Owner address = Cuttack; plot village = Mendhasala, Khordha</dd>
      <dt>Manual follow-up</dt><dd>Verify seller's identity in person with Aadhaar; check for a registered PoA at the Bhubaneswar SRO before any payment.</dd>
    </dl>
  </details>
</div>
```

Closed by default in V1.1 (`open={false}`) per ADR-020 boundary text. Open in admin review for the A11 audit run.

### 4.6 Stubs auto-activate

Each IGR/CERSAI/eCourts rule evaluates its input shape:

```ts
// Before live fetcher ships:
export const cersaiActiveChargeRule: Rule = {
  id: 'registry.cersai_active_charge',
  panel: 'encumbrance',
  issueLens: 'registry_ec',
  evidenceStrength: 'parser_uncertain',
  evaluate: (input) => {
    if (!isCersaiResultLive(input)) {
      return [stubInsight({
        id: 'registry.cersai_active_charge',
        body: 'CERSAI active-charge check has not run. Ask the seller for a CERSAI "no active charges" certificate or commission a paid search.',
        actionItem: 'Pull a paid CERSAI search (₹10) and attach the certificate to the file.',
        severity: 'watchout',
      })];
    }
    if (input.cersai?.activeCharges?.length) {
      return [liveInsight({ /* ... */ })];
    }
    return []; // clean live result → no insight (the source already says so)
  },
};
```

`isCersaiResultLive()` checks the fetcher's source-level provenance: `meta.fetchedAt` present, `meta.statusReason` not `not_implemented`, `payload.charges` is the real shape. When the V1.5 fetcher ships, the same rule detects the shape change and switches. No config flag, no engine change.

---

## 5. Engine tasks (35 total, 10 phases)

### Phase 1 — Schema and types (P0, 3 tasks)

- **ROR-INS-001** Add `IssueLens`, `EvidenceStrength`, `InsightPanel`, `Severity`, `Insight`, `Rule` types. `insights/schema.ts`. Zod enum + literal unions.
- **ROR-INS-002** Wire `display-labels.ts` (codes → English). `insights/display-labels.ts`. Single allowlist for prohibited phrases.
- **ROR-INS-003** Delete `buildRiskInsights` and `buildRoRInsightGroups` types from `agents/consumer-report-writer/src/index.ts`. Replace with `buildPanelInsights()` consumer.

### Phase 2 — Bhulekh ROR registry (P0, 31 rules across 7 files)

- **ROR-INS-010** `registry/bhulekh/plot.ts` — 7 rules: plotFound, plotMissing, plotArea, areaFormat, areaMismatch, governmentTenure, subDivision.
- **ROR-INS-011** `registry/bhulekh/owner.ts` — 6 rules: multipleOwners, singleOwner, coOwnership, siblingRemains, ownerFamilyAnchor, ownerResidenceAnchor.
- **ROR-INS-012** `registry/bhulekh/land.ts` — 11 rules: kisamAgricultural, kisamBuildable, kisamProhibited, kisamConversionRequired, kisamUnknown, swatwa, khewat, khatiyan, noData, subRecord, decoderSection.
- **ROR-INS-013** `registry/bhulekh/plot-table.ts` — 4 rules: rowCount, boundaries, occupier, remark.
- **ROR-INS-014** `registry/bhulekh/dues.ts` — 6 rules: khajanaNonZero, rentNonZero, cessNonZero, jalkarNonZero, duesBlank, duesTotal.
- **ROR-INS-015** `registry/bhulekh/back-page.ts` — 7 rules: mutationCount, mutationFresh, mutationStale, encumbranceEntry, remarkCaseAnchor, backPageMissing, backPageFailed.
- **ROR-INS-016** `registry/bhulekh/chain.ts` — 2 real rules + 1 recursive-lookup stub (ROR-INS-090).

### Phase 3 — Bhunaksha + neighbours (P0, 12 rules across 3 files)

- **ROR-INS-020** `registry/bhunaksha/neighbours.ts` — 4 rules: neighboursFound, neighboursMissing, neighboursMixedKisam, neighboursGovtLand.
- **ROR-INS-021** `registry/bhunaksha/road.ts` — 4 rules: roadAccessPresent, roadAccessMissing, roadWidth, pendingMutation.
- **ROR-INS-022** `registry/bhunaksha/kha.ts` — 4 rules: khaAdjacentConsistent, khaAdjacentInconsistent, areaFormatAcres, areaFormatHectare.

### Phase 4 — IGR + cross-source stubs (P1, 17 stub rules across 5 files)

- **ROR-INS-030** `registry/igr/encumbrance.ts` — 4 rules: ecMortgage, ecLien, ecCharge, ecClear. Stubs return `parser_uncertain` until IGR EC ships.
- **ROR-INS-031** `registry/igr/deeds.ts` — 4 rules: lastDeedSale, lastDeedGift, lastDeedInheritance, lastDeedMissing.
- **ROR-INS-032** `registry/igr/financial.ts` — 4 rules: mortgageExposure, attachmentExposure, overpayment, exposureSummary.
- **ROR-INS-033** `registry/court/cases.ts` — 5 rules: ecourtsCase, highCourtCase, drtCase, rccmsCase, noCases.
- **ROR-INS-034** `registry/registry/index.ts` — 4 rules: cersaiActiveCharge, cersaiClosedCharge, reraProject, reraMissing.

### Phase 5 — Engine (P0, 3 tasks)

- **ROR-INS-040** `engine.ts` — `buildInsights()`, `runRegistry()`. Dedupe by id.
- **ROR-INS-041** `engine.ts` — `groupByPanel()` with watch-out-first ordering, severity desc, id asc, max 4 per panel.
- **ROR-INS-042** `helpers.ts` — `hasParserUncertainty()`, `hasMissingSource()`, `summarizeByLens()`, `filterByPanel()`.

### Phase 6 — Render integration (P0, 3 tasks)

- **ROR-INS-050** Replace call sites in `agents/consumer-report-writer/src/index.ts` — remove `buildRiskInsights`, `buildRoRInsightGroups`. Add `buildPanelInsights(input) → Map<panel, Insight[]>`.
- **ROR-INS-051** Add closed-by-default disclosure renderer. Reuse `display-labels.ts`.
- **ROR-INS-052** Wire display-labels into existing sections. Grep src/ for prohibited phrases; must return zero matches.

### Phase 7 — A11 audit (P0, 3 tasks)

- **ROR-INS-060** `agents/output-auditor/src/index.ts` — new rule `insightHasLensAndEvidence`. Throw if missing either.
- **ROR-INS-061** — new rule `backPageInsightBodySourceBacked`. Assert body contains "source observation" or anchored phrasing.
- **ROR-INS-062** — extend `noProhibitedPhrases` with: "clear title", "ownership verified", "safe to buy", "no encumbrance", "fully verified", "guaranteed", "no risk". Reuse `display-labels.ts` allowlist.

### Phase 8 — Tests (P0, 4 tasks)

- **ROR-INS-070** `insights/registry/**/*.test.ts` — 50+ per-rule tests, positive + negative + edge case.
- **ROR-INS-071** `insights/engine.test.ts` — 8+ tests covering ordering, dedup, cap, lens/evidence distribution.
- **ROR-INS-072** `agents/consumer-report-writer/src/index.test.ts` — golden-path input produces `Insight[]` with all panels populated, no prohibited phrases, disclosures present.
- **ROR-INS-073** `agents/output-auditor/src/index.test.ts` — 3 new violation cases (missing lens, missing evidence, prohibited phrase).

### Phase 9 — Documentation (P1, 3 tasks)

- **ROR-INS-080** Update `CLAUDE.md` Section 5 (Decision Log) — add ADR-028 (unified engine). Mark ADR-019 + ADR-020 as integrated.
- **ROR-INS-081** Update `docs/sources/bhulekh.md`, `docs/sources/bhunaksha.md` — add "Insight rules" subsection. Cross-link to engine doc.
- **ROR-INS-082** New `docs/insights/insights-engine.md` — 1-page spec: lens/evidence taxonomies, registry layout, engine flow, A11 enforcement, ADR-020 boundary. Includes the full 73-fact mapping table.

### Phase 10 — Future-source stubs (P2, 3 tasks)

- **ROR-INS-090** `insights/registry/bhulekh/chain-recursive.ts` — `walkChain(depth, input)` scaffold. Returns `parser_uncertain` until IGR live.
- **ROR-INS-091** `insights/registry/bhunaksha/neighbours-recursive.ts` — `walkAdjacent(radius, input)` placeholder.
- **ROR-INS-092** `insights/registry/regulatory/zoning.ts` — `reraZoneRule`, `bdaZoneRule`. Both return `parser_uncertain` until T-052/T-065 ship.

---

## 6. Upstream execution tasks (from founder analysis)

The insight engine consumes data produced by the upstream layer. Phases 1–10 above define the engine; this section defines the **10 upstream tasks** the founder analysis called out, which feed the engine. **Insight engine work blocks on these tasks; not the other way around.**

### Source plumbing

- **UP-001** Align `generateReportV11`, orchestrator comments, source IDs, and fire gate status mapping. Fix the `bhunaksha-plot-report` vs `bhunaksha_plot_report` naming mismatch. Map legacy `success/partial/failed` statuses through contract adapters before fire-rate reporting. *(Phase 6 / ROR-INS-050 cannot evaluate per-source provenance correctly until this is fixed.)*
- **UP-002** Bhulekh RoR extraction completeness — verify and add structured parsing for: Khewat no, khatiyan no, owner/co-owner blocks, caste, address, Swatwa, revenue dues, final publication date, revenue fixation date. Parse Page 2 plot rows fully: plot no, compound level, kisam, boundaries/chauhaddi, acres/decimal/hectare, aggregate row, and Bhunaksha href per plot. Add dead-account detection. Normalize ROR area using the 4-digit decimal rule: decimal column / 10000.
- **UP-003** Section 6 mutation parsing — parse each mutation entry into case no, year, plot no, area, direction `in/out`, old khatiyan, new khatiyan, raw text. Detect Dakhal Kharaj, Dakha Case, Puratana Khata, Nutan Khata. Flag missing linked khatiyans, very recent mutations, repeated rapid transfers, high-suffix khatiyans.

### Title-chain recursion

- **UP-004** Title-chain recursion — enqueue all old/new khatiyans found in Section 6. Stop on root/original khatiyan, government khatiyan, inactive/dead account, or already-visited khatiyan. Output a simple title-chain table with active/inactive status, source plot, destination plot, case no/year, and unresolved gaps. *(ROR-INS-090 stub auto-activates when this lands.)*

### Bhunaksha plot report + area normalization

- **UP-005** Strengthen Bhunaksha Plot Report checks — prefer Bhunaksha href from Bhulekh plot row; use GIS-code lookup as fallback. Parse and store plot no, khatiyan no, owner, location, area, map image, scale, source URL. Detect `NO DATA`; for compound plots retry parent plot by dropping the last `/suffix`. Normalize Bhunaksha area using the 3-digit/variable decimal rule: decimal field / 1000. Cross-check ROR vs Bhunaksha for plot no, owner, mouza/district, area, and khatiyan when present.

### Road and neighbour intelligence

- **UP-006** Road and neighbour intelligence — extract adjacent plot numbers from Bhunaksha map where feasible; use Chauhaddi as fallback. Recursively look up adjacent plots in Bhulekh. Identify roads by government owner + `Danga/Rasta`; identify KHA/government land. Output a compact neighbour table: direction, adjacent plot, owner type/name, kisam, road yes/no. *(ROR-INS-091 stub auto-activates when this lands.)*

### IGR sale-deed bridge

- **UP-007** IGR sale-deed bridge — use district + tehsil/village to resolve exact SRO; extend SRO mapping beyond current seed where needed. Derive EC date range from mutation years: earliest mutation year minus 1 through today; also preserve a 13/30-year manual due-diligence note. Feed IGR EC with SRO, village, plot/khata, owner/party name. Parse EC entries into doc type, reg no, reg year/date, executant, claimant, value, SRO. Match mutation cases to sale/gift/partition/mortgage entries by year, parties, plot, and khata. For sale deed/certified copy, produce exact fetch/manual request instructions using reg no + year + SRO until authenticated deed download is reliable. *(ROR-INS-030/031/032 stubs auto-activate as live data arrives; full activation requires DPR-ENC-001 + T-033.)*

### Buyer-facing risk flags

- **UP-008** Buyer-facing risk flags — flags listed (non-private/government khatiyan, co-ownership, ST/scheduled-area check needed, non-Gharabari/CLU needed, ROR-Bhunaksha area mismatch, GIS unavailable, no confirmed road access, fresh mutation, missing title-chain link, active EC/CERSAI mortgage, pending court/revenue case, revenue dues, deed value below benchmark). These map 1:1 to rules already listed in Phases 2–4 of the engine. Keep output simple: green checks, watch-outs, and "manual verification required" items.

### Report/UI output

- **UP-009** Report/UI output — organize report into five sections: Revenue record, Spatial/map check, Registration/deed trail, Financial/legal checks, Final watch-outs. Show original government source links/artifact hashes where available. Avoid claiming "clear title"; phrase as "matched", "not found", "manual check required", or "source unavailable". *(The A10 section structure is unchanged; this task only adds the per-insight disclosure from ROR-INS-051.)*

### QA and acceptance

- **UP-010** QA and acceptance — add fixtures/tests for: active khatiyan, dead account, multiple plots, compound/triple-compound plot, Bhunaksha `NO DATA`, government road khatiyan, co-owners, area mismatch, missing title-chain link, and IGR manual fallback. Run focused tests for Bhulekh, Bhunaksha plot report, IGR EC/SRO, contracts/fire gate, and report rendering. Re-run live smoke for at least Mendhashala/Kasunhia samples before marking done.

### Founder assumptions (confirmed)

- V1 stays Khordha/Bhubaneswar first; no bulk Odisha scraping yet.
- ROR is authoritative when Bhunaksha is blank or mismatched.
- Automated IGR deed download is not required for the next milestone; exact EC/certified-copy instructions are acceptable until login/captcha flow is stable.
- Do not overbuild PID or pattern mining for this task; this is about a clean property-verification workflow from Bhulekh, Bhunaksha, IGR, and core risk sources.

### Execution ordering

The engine cannot fully fire until UP-002, UP-003, UP-005, and (for any insight that mentions deeds) UP-007 land. Recommended sequencing:

```
UP-001  (1 day, prerequisite)
UP-002  (3-4 days, blocks Phase 2 rules plot/land/owner/plotTable)
UP-005  (2 days, blocks Phase 3 rules)
UP-003  (2 days, blocks Phase 2 rule back-page mutation count)
UP-008  (1 day, runs in parallel with engine Phase 1)
Phase 1 + Phase 5 (engine types and core, 2 days)
Phase 2 + Phase 3 (Bhulekh/Bhunaksha registry, 5 days, parallel with UP-002/005)
UP-006  (3 days, blocks ROR-INS-091 activation)
Phase 4 stubs land at any time — they degrade gracefully
UP-004  (3 days, blocks ROR-INS-090 activation)
UP-007  (5+ days, blocks ROR-INS-030/031/032 activation)
Phase 6 + Phase 7 + Phase 8 (render, audit, tests, 3 days)
UP-009 + UP-010 (UI integration, QA, 2 days)
Phase 9 (docs, 1 day)
```

**Total: ~28–35 working days, single founder + one Claude session per day, no new team required.**

---

## 7. What this design does not change

- **ADR-019** — Rule-based only, no live LLM in consumer output. AI-assisted drafting remains admin-only.
- **ADR-020** — 5-lens / 7-evidence taxonomy is closed; the mapping pass confirms it covers all 73 source facts.
- **Prohibited phrase set** — drawn from master doc Section 7 + pipeline doc; enforced through `display-labels.ts` allowlist.
- **A10 layered section structure** — sections unchanged; only the engine that feeds them is unified.
- **A11 audit as the language gate** — the auditor consumes the same `Insight[]` the renderer does, so every insight is language-checked.

---

## 8. Verification

After all phases ship, the following must hold:

1. `npm test -- --run` — all suites green, including new 50+ per-rule tests and A11 violation tests.
2. `npm run typecheck` — clean.
3. `npm run build` — clean.
4. Golden-path report (Mendhasala Plot 415) — every section emits `Insight[]` with non-empty `issueLens`, `evidenceStrength`, `source`, `actionItem`. No prohibited phrases in any body. Disclosure blocks render closed by default.
5. Live `/api/report/create` for Mendhasala Plot 415 — positive signal, watch-out, and red-flag insights all visible, each with closed disclosure.
6. A11 audit run on the same golden-path output — no violations.
7. **Auto-activation smoke test** — a stub rule (e.g. CERSAI active charge) is fed a synthetic live result; the rule must produce the live insight body, not the stub body. Tests cover both shapes.

---

## 9. Open dependencies

- **T-038** (live validation of High Court + DRT fetchers) — unblocks ROR-INS-033 going from stub to live.
- **T-033** (IGR + CERSAI paid-source probes) — unblocks ROR-INS-030, ROR-INS-031, ROR-INS-034.
- **T-016** (eCourts live validation) — unblocks the eCourts half of ROR-INS-033.
- **DPR-ENC-001** (current IGR EC flow probe) — unblocks ROR-INS-031's `lastDeedMissing` rule from being permanently stub.

These tasks can ship in any order; the engine gracefully degrades to stub text until they land.

---

## 10. What is pending after this ships

- V1.2 plan: switch stubs to live rules as IGR/CERSAI/eCourts fetchers return real data.
- V1.2 plan: extend `insights/insights-engine.md` mapping table with the 8th, 9th, 10th source as they come online.
- V1.5 plan: title-chain recursive lookup (ROR-INS-090 stub) becomes real once IGR deed-fetch lands.
- V1.5 plan: adjacent-plot recursive lookup (ROR-INS-091 stub) becomes real once Bhulekh batched query lands.
