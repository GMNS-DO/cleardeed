# ClearDeed Report Redesign — "The Dossier" v2

**Date**: 2026-06-21
**Owner**: Founder
**Status**: Draft → awaiting user spec review
**Scope**: Buyer-facing report UI redesign. Single source of truth: `agents/consumer-report-writer/src/index.ts` (the HTML generator). The Next.js shell, mapper, schema, fetchers, insight engine, and PDF renderer are all unchanged.

---

## 1. The brief, in one paragraph

Redesign the ClearDeed property report so that **all 21 buyer-relevant value elements are preserved with zero loss of information**, but the buyer sees them in **one physical page (1 viewport on 1366×768)** instead of the current 14+ sections that scroll for ~5 viewports. Eliminate the **5x repetition of source-status facts** (Bhulekh status appears in 5 places today). Add the **Bhunaksha map** as a prominent visual anchor (it's already in the codebase as a base64 SVG, currently buried in Section 1). Keep the **lawyer layer** one click away. Make the report feel like a **premium editorial dossier**, not a dashboard.

---

## 2. What we're keeping — the 21 value elements (zero loss)

The audit identified 21 distinct value elements in today's report. Every one of them appears in v2.

| # | Value element | Where it lives in code | New v2 location |
|---|---|---|---|
| 1 | The verdict (most severe insight) | `insights/registry/registry/` | **Buyer §1** — verdict card, single line |
| 2 | Property identity (village, tahasil, district, GPS) | `revenueRecords`, `geoFetch` | **Buyer §2** — header strip with map |
| 3 | Bhunaksha cadastral map (base64 SVG) | `buildBhunakshaMapPanel` L3521 | **Buyer §2** — map right of property header |
| 4 | Plot polygon with up to 8 neighbours (SVG) | `buildPlotDiagramSection` L3273 | **Buyer §5 toggle "Plot details"** |
| 5 | Khatiyan + plot number | `revenueRecords.khataNo`, `plotNo` | **Buyer §2** — under map |
| 6 | Owner name (Odia + transliterated) | `revenueRecords.tenants[]` | **Buyer §5 toggle "Owner"** |
| 7 | Owner name-match verdict (matched/mismatch/ambiguous) | `ownershipReasoner.nameMatch` | **Buyer §3** — Q1 row |
| 8 | Co-owners | `ownershipReasoner.coOwners` | **Buyer §5 toggle "Owner"** |
| 9 | Land classification (kisam) + buildable | `landClassifier.currentClassification` | **Buyer §3** — Q2 row + **§5 toggle "Land & build"** |
| 10 | Conversion requirement | `landClassifier.conversionRequired` | **Buyer §5 toggle "Land & build"** |
| 11 | Adjacent plots (neighbours) | `buildAdjacentPlotsPanel` L3641 | **Buyer §5 toggle "Land & build"** |
| 12 | BDA zone | `buildBdaZoneCard` L1597 | **Buyer §3** — Q2 row + **§5 toggle "Land & build"** |
| 13 | Court cases (eCourts + RCCMS) | `buildCourtSection` L3708 | **Buyer §3** — Q3 row + **§5 toggle "Court & encumbrance"** |
| 14 | Encumbrance Certificate (IGR concierge) | `buildEcSection` L1050 | **Buyer §5 toggle "Court & encumbrance"** |
| 15 | Mutation references | `buildMutationReferencePanel` L3789 | **Lawyer layer** — "Mutation timeline" |
| 16 | Regulatory flags (red flags from classifier) | `buildRegSection` L3844 | **Buyer §3** — Q2/Q3 rows + **§5 toggle "Land & build"** |
| 17 | LARR (land acquisition) risk | `buildLarrSection` L3829 | **Buyer §3** — Q5 row + **§5 toggle "Land & build"** |
| 18 | Circle rate / IGR benchmark | `buildBenchmarkSection` L1350 | **Buyer §3** — Q4 row + **§5 toggle "Market"** |
| 19 | IGR fee schedule + certified-copy procedure | V5c sub-cards L1350–L1670 | **Buyer §5 toggle "Fees"** |
| 20 | Source freshness + parser confidence | `buildSourceAuditPanel` L2992 | **Buyer §2** — header strip + **Lawyer layer** |
| 21 | Action items ("before you pay") | `buildActionItems` L1671 | **Buyer §4** — top 3 actions + **Lawyer layer** for full list |

**Plus** the existing Six Buyer Questions (Q1–Q6) appear in **Buyer §3** as a compact 3×2 grid (was 3×2 already, but with full body text per question — preserved). The `Q1`–`Q6` shorthand stays visible.

---

## 3. What we're removing from the buyer layer (moving to lawyer layer)

| Today | Today's location | v2 buyer layer | v2 lawyer layer |
|---|---|---|---|
| Property Record Status grid + executive summary + key questions | `buildBuyerSummary` L1810 | **Merged into §1 verdict card + §3 Q-grid** | — |
| Financial Exposure Summary table | `buildFinancialExposureSummary` L2509 | **Collapsed to one line in §4** | Full table |
| Source Audit panel (collapsed `<details>`) | `buildSourceAuditPanel` L2992 | **Merged into §2 header strip** | Full per-source panel |
| Provenance Strip (verify-yourself chips) | `buildProvenanceStrip` L2836 | **Merged into §2 header strip** | — |
| Per-section feedback widgets | inline `feedback-widget` | **Replaced with one global "Was this report useful?" footer button group** | — |
| RoR raw rows (13+ Bhulekh rows) | `buildRoRPlotTablePanel` L3536 | — | Lawyer §L1 |
| RoR back-page mutations (full timeline) | `buildRoRBackPagePanel` | — | Lawyer §L2 |
| Pattern Intelligence synthesis | `buildSynthesisInsights` L3945 | — | Lawyer §L3 |
| Full action items (5–10 items) | `buildActionItems` L1671 | Top 3 in **§4** | Full list in Lawyer §L4 |
| Insights dump (all 75 rules) | `runInsights()` output | Headlines drive §1 + §3 icons | Full insight dump Lawyer §L5 |
| Bhunaksha base64 SVG (re-displayed in RoR table context) | `buildBhunakshaMapPanel` | **Map moves to §2 as the visual anchor** (already in §1) | — |
| Source-audit JSON / parser version / template hash | `sourceStatus` array | Source name + timestamp in §2 strip | Full JSON Lawyer §L6 |

**Net: every value element stays in the report. The buyer layer compresses the 5x-repeated facts. The lawyer layer carries the full raw data.**

---

## 4. The new buyer layer — six modules, one page

### 4.1 Module §1 — The Verdict (top, the only thing the buyer must read)

A single card with a 3px left border in `--accent / --caution / --prohibited`. Three lines.

```
┌──────────────────────────────────────────────────────────────┐
│  ⚠  Government-notified land                                 │
│  Construction prohibited without prior permission.            │
│  ₹X at-risk · 0 of 1 clear · EC manual · See §3              │
└──────────────────────────────────────────────────────────────┘
```

**Line 1**: verdict icon + headline (one sentence, max 12 words). Generated by new `buildVerdictHeadline(insights)`. If no CRITICAL/HIGH fires → green checkmark + "No critical risks found. Verify the remaining items below before paying." If one or more fire → the most severe one's headline.

**Line 2**: what the verdict means for the buyer (one sentence, plain English). Generated from the same insight's `body`, truncated to one sentence.

**Line 3**: ₹ exposure + clear counts + next-link. "₹X at-risk across N categories · Y verified clear · Z manual. See Q3 below."

### 4.2 Module §2 — The Property Header (with Bhunaksha map)

Two-column layout, 60/40 split. Left: property facts. Right: the map.

```
┌────────────────────────────────────┬─────────────────────────┐
│  Mendhasala · Plot 1               │   ┌───────────────────┐ │
│  Bhubaneswar Tahasil, Khordha      │   │                   │ │
│  Khatiyan 830 · 20.5 acres         │   │  [Bhunaksha SVG]   │ │
│  GPS 20.2727°N, 85.7013°E         │   │                   │ │
│  Verified 14 Apr 2026              │   │   0.2 km scale     │ │
│  Bhulekh · eCourts · Bhunaksha     │   └───────────────────┘ │
│  · EC manual · +2 more             │  ↗ Open full map        │
└────────────────────────────────────┴─────────────────────────┘
```

**Left column**:
- Line 1: `<village> · Plot <plotNo>` (24px serif headline)
- Line 2: `<tahasil> Tahasil, <district>` (14px muted)
- Line 3: `Khatiyan <khataNo> · <area> <unit>` (14px)
- Line 4: `GPS <lat>°N, <lng>°E` (mono, 12px, muted)
- Line 5: source audit bar (existing `buildProvenanceStrip` repurposed, no repetition)

**Right column**:
- The existing `buildBhunakshaMapPanel` output, sized to 280×220px max, with a "↗ Open full map" link below.
- The map is the **first visual the buyer sees** — it grounds the abstract numbers in geography. The buyer knows which plot they're buying before they read a single word of text.
- If the map image is unavailable (no `bhunakshaPlotReport.mapImageBase64`), show a neutral "Map not available for this plot" placeholder card with a link to Bhunaksha.

### 4.3 Module §3 — The Six Buyer Questions (3×2 grid, compressed)

The existing `buildSixBuyerQuestions` output. Same structure as today (Q1 ownership, Q2 buildability, Q3 loss risk, Q4 pricing, Q5 area, Q6 costs), but rendered as a **2-column grid on desktop** (was 3-column) and **tighter** (was 1-line label + multi-line body; now 1-line label + 1-line body + 1-line tally chip).

Each Q cell is a clickable anchor to its detail in the toggle sections (§5) or the lawyer layer.

### 4.4 Module §4 — The Financial Exposure Strip (one line, not a table)

```
₹1,20,000 at-risk across 1 category · 0 of 1 verified clear · EC manual
```

A single horizontal strip. Three segments separated by middle-dots, each a link:
- `₹1,20,000 at-risk across 1 category` → expands inline OR jumps to Q3
- `0 of 1 verified clear` → expands inline
- `EC manual` → jumps to the EC toggle in §5

Replaces the current Financial Exposure Summary table (which is 8–12 rows depending on category count).

### 4.5 Module §5 — Five Toggle Sections (one tap deep)

A single row of five pill-buttons under §4. Clicking a button toggles an inline `<details>` panel below. Each panel is **self-contained** — it carries its own data table, value, and "view in lawyer layer" link.

```
[Plot details] [Owner] [Land & build] [Court & encumbrance] [Market] [Fees]
  ┌────────────────────────────────────────────────────────┐
  │ ▼ Plot details (open)                                  │
  │  Khatiyan 830 · Plot 1 · Mendhasala                    │
  │  RI Circle: Mendhasala                                 │
  │  Last updated: 14 Apr 2026                             │
  │  ┌────────────────────────────────────────────────┐   │
  │  │  [Polygon SVG with up to 8 neighbours]          │   │
  │  └────────────────────────────────────────────────┘   │
  │  Adjacent plots: 1 (North: 1.2 acres), 2 (East) ...  │
  │  Verify yourself: ↗ Bhulekh  ↗ Bhunaksha               │
  │  [View in lawyer layer →]                              │
  └────────────────────────────────────────────────────────┘
```

**Why five pills, not six or seven**: the audit surfaced six buyer-question groups. Five pills map to: Plot details (Q1 identity + RoR rows), Owner (Q1 name + co-owners), Land & build (Q2 + Q5 + Q6 land portion), Court & encumbrance (Q3), Market (Q4), Fees (Q6 fees portion). The five-pill design carries **all 21 value elements** without omission.

**Pill ordering follows the buyer's decision flow**: who owns → can I build → could I lose it → am I overpaying → what are the costs. Same logical order as the Six Questions.

**Default state**: all five closed. The buyer sees the pills, the cards above (§1–§4), and the lawyer-layer link. They tap a pill only if they want the underlying data.

### 4.6 Module §6 — Footer (one line)

```
Generated 14 Apr 2026 · Report CLD-GOLDEN-001 · [Was this useful? 👍 👎] · [Download PDF] · [View lawyer layer →]
```

A single horizontal strip. The 👍/👎 replaces the per-section feedback widgets (8 inline feedback blocks today, 1 in v2). The "View lawyer layer →" is the **single button** that swaps the buyer page for the lawyer page.

---

## 5. The new lawyer layer — one page, one tap away

A single `<details>` element (or a separate page, decided in §9) with these sections, all collapsed by default except the first:

### §L1 — Raw RoR rows (the existing `buildRoRPlotTablePanel`)

The 13 Bhulekh tenant rows. Khata, plot, area, land class, owner name (Odia), mutation status. Unchanged from today.

### §L2 — Mutation timeline (the existing `buildRoRBackPagePanel` + `buildMutationReferencePanel`)

All 17 mutations + all 17 case-reference anchors. Unchanged from today.

### §L3 — Source provenance + parser confidence

For each source: source name, fetched timestamp, parser version, template hash, raw artifact reference, attempts, status reason. The current Source Audit panel's full data.

### §L4 — Full action items (5–10 items)

The complete `buildActionItems()` output (the buyer layer only showed top 3).

### §L5 — All insights (the full 75-rule dump)

Every CRITICAL/HIGH/POSITIVE insight, grouped by panel. The current "Pattern Intelligence" + insight highlights merged into one comprehensive panel for the lawyer.

### §L6 — IGR concierge + certified copy + fee schedule

The complete V5c panel: step-by-step IGR instructions, certified-copy fees, public dashboard links. Unchanged from today.

---

## 6. The page-level wireframe (desktop, 1366×768)

```
┌──────────────────────────────────────────────────────────────────────────┐
│  ClearDeed — Property Dossier                      [Download PDF]        │
├──────────────────────────────────────────────────────────────────────────┤
│  ╔══════════════════════════════════════════════════════════════════╗   │
│  ║  ⚠  Government-notified land                                    ║   │
│  ║  Construction prohibited without prior permission.                ║   │
│  ║  ₹X at-risk · 0 of 1 clear · EC manual · See Q3                 ║   │
│  ╚══════════════════════════════════════════════════════════════════╝   │
│                                                                          │
│  ┌────────────────────────────────────┬──────────────────────────┐       │
│  │  Mendhasala · Plot 1               │   ┌──────────────────┐  │       │
│  │  Bhubaneswar Tahasil, Khordha      │   │                  │  │       │
│  │  Khatiyan 830 · 20.5 acres         │   │ [Bhunaksha map]  │  │       │
│  │  GPS 20.27°N, 85.70°E              │   │                  │  │       │
│  │  Verified 14 Apr · Bhulekh·eCourts  │   └──────────────────┘  │       │
│  │  · Bhunaksha · EC manual · +2 more │   ↗ Open full map       │       │
│  └────────────────────────────────────┴──────────────────────────┘       │
│                                                                          │
│  Q1 OWNERSHIP  ✓ Match ......... Q4 PRICING  ⚠ Above benchmark          │
│  Q2 BUILD     ✕ Not buildable ... Q5 AREA      ⓘ Hold                   │
│  Q3 LOSS      ⚠ EC manual ....... Q6 COSTS     ⚠ CLU fee               │
│                                                                          │
│  ₹X at-risk across 1 · 0 of 1 clear · EC manual                         │
│                                                                          │
│  [Plot details] [Owner] [Land & build] [Court] [Market] [Fees]         │
│   ▸ (each opens an inline panel)                                         │
│                                                                          │
│  14 Apr 2026 · CLD-GOLDEN-001 · [Was this useful? 👍 👎] · [Lawyer →]  │
└──────────────────────────────────────────────────────────────────────────┘
```

**Page height estimate**: ~720px on desktop. Fits in 1366×768 with minor scroll for the toggle pills row only.

---

## 7. The new CSS design system

Replace the existing `CSS` constant in `index.ts` (L4132–L5480) with a new editorial-token system. The new tokens:

```css
:root {
  --paper:        #fbfaf6;
  --ink:          #1c1f1a;
  --ink-muted:    #5a6258;
  --rule:         #e2dfd4;
  --accent:       #2d5a3d;
  --caution:      #b8761f;
  --prohibited:   #8a2a1f;
  --serif:        'Georgia', 'Merriweather', serif;
  --sans:         'Inter', system-ui, sans-serif;
  --mono:         'JetBrains Mono', 'SF Mono', monospace;
}
```

**Module-level rules**:

- `.verdict` — 3px left border in accent/caution/prohibited, padding 24px, font 22px serif headline, 14px sans body.
- `.property-header` — 60/40 grid, gap 32px, no border (background is `--paper`).
- `.property-header .map-frame` — 280×220px max, 1px `--rule` border, no shadow.
- `.q-grid` — 2-col on desktop, 1-col on mobile. Each cell: 14px label, 16px body, 12px muted tally chip.
- `.exposure-strip` — 14px sans, single line, middle-dotted, each segment is a link.
- `.toggle-pills` — 6 pill buttons in a row, 11px sans uppercase, 1px `--rule` border, hover fills with `--paper`. Active state: 1px `--ink` border.
- `.toggle-panel` — 1px `--rule` border-top, padding 24px, no shadow.
- `.feedback-footer` — 12px sans muted, single line.

**Page width**: 760px max, 36px padding, unchanged from today.

**Print CSS**: extend the existing `@media print` block (L5282–L5480) to ensure:
- Map image prints at full width (no scale).
- Toggle panels print **open** (override `<details>` closed state).
- All five toggle panels print inline, not as a separate page.
- Lawyer layer prints on page 2 (forced `page-break-before: always`).

---

## 8. What changes in code

### 8.1 `agents/consumer-report-writer/src/index.ts` (the only file modified)

**New functions to add**:
- `buildVerdictCard(insights): string` — renders the §1 verdict card. Picks the most severe CRITICAL/HIGH insight, returns a 3-line card. If no severity → green "all clear" card.
- `buildPropertyHeader(input): string` — renders the §2 60/40 grid. Calls the existing `buildBhunakshaMapPanel` for the right column.
- `buildExposureStrip(exposure): string` — renders the §4 one-line strip. Derives the 3 segments from `insights` and `sourceDetails`.
- `buildToggleSection(id, label, body): string` — wraps an existing section's content in a `<details>` block.
- `buildTogglePillBar(sections): string` — renders the row of 5 pill buttons that drive the `<details>` open/close.
- `buildFeedbackFooter(reportId): string` — replaces the per-section feedback widgets with one global button group.
- `buildBuyerPage(input): string` — orchestrator: assembles §1–§6 in render order. Replaces the current L409–L945 template body.
- `buildLawyerLayer(input): string` — orchestrator: assembles §L1–§L6. The current "deep" content (RoR rows, mutations, full audit, full action items, full insights, V5c fees) repackaged.

**Existing functions to reuse unchanged**:
- `buildBhunakshaMapPanel` (L3521) — reused in §2.
- `buildPlotDiagramSection` (L3273) — reused in §5 Plot details toggle.
- `buildOwnerDetailsSection` (L3137) — reused in §5 Owner toggle.
- `buildLandClassificationDetails` (L3367) — reused in §5 Land & build toggle.
- `buildCourtSection` (L3708) — reused in §5 Court & encumbrance toggle.
- `buildAdjacentPlotsPanel` (L3641) — reused in §5 Land & build toggle.
- `buildRegSection` (L3844) — reused in §5 Land & build toggle.
- `buildLarrSection` (L3829) — reused in §5 Land & build toggle.
- `buildBenchmarkSection` (L1350) — reused in §5 Market toggle.
- `buildBdaZoneCard` (L1597) — reused in §5 Land & build toggle.
- `buildEcSection` (L1050) — reused in §5 Court & encumbrance toggle.
- `buildActionItems` (L1671) — reused in §4 (top 3) + lawyer layer §L4 (full).
- `buildSixBuyerQuestions` (L2655) — reused in §3.
- `buildSourceAuditPanel` (L2992) — reused in lawyer layer §L3.
- `buildMutationReferencePanel` (L3789) — reused in lawyer layer §L2.
- `buildRoRPlotTablePanel` (L3536) — reused in lawyer layer §L1.
- `buildRoRBackPagePanel` — reused in lawyer layer §L2.
- `buildProvenanceStrip` (L2836) — reused in §2 header strip.
- `buildSynthesisInsights` (L3945) — reused in lawyer layer §L5.
- V5c sub-cards (L1350–L1670) — reused in lawyer layer §L6.

**Existing functions to delete from buyer layer rendering** (still used by lawyer layer if needed):
- `buildBuyerSummary` (L1810) → merged into §1 + §3.
- `buildSummaryGridItems` (L1856) → deleted from buyer; data flows into §3 Q-grid.
- `buildFinancialExposureSummary` (L2509) → collapsed to `buildExposureStrip`.
- `buildExecutiveSummary` (L2885) → merged into §1 verdict card.
- `buildKeyQuestions` (L2890) → merged into §3 Q-grid.
- All `feedback-widget` inline blocks (L794, L820, L851) → replaced by §6 footer.

**`generateConsumerReport()` change** (L68):
- Same input schema.
- Same output shape (`{ html, title, insights }`).
- New `html` body: `<buyer-page><details lawyer-layer>...</details></buyer-page>`.
- `title` and `insights` unchanged.

**`CSS` constant change** (L4132):
- Wholesale replace with the new editorial tokens (§7).
- Preserve all `@media print` rules, augmented to expand toggle panels on print.

### 8.2 What does NOT change

- `agents/consumer-report-writer/src/mapper.ts` — unchanged. Same input/output.
- `agents/consumer-report-writer/src/buyer-questions.ts` — unchanged. `buildSixBuyerQuestions` reused as-is.
- `agents/consumer-report-writer/src/insights/` — unchanged. The 75 rules + adapters stay.
- `agents/consumer-report-writer/fixtures/golden-path.ts` — unchanged. The same fixture must produce a valid redesigned report.
- `agents/consumer-report-writer/src/types.ts`, `lib.ts` — unchanged.
- `apps/web/src/app/report/[id]/page.tsx` — unchanged. Still uses `dangerouslySetInnerHTML`. The "View lawyer layer →" button can be a small client-component addition (a `<button>` that toggles a CSS class on the `<details>` element) or kept as a vanilla JS inline `<script>` like today's feedback widget.
- `apps/web/src/app/api/report/[id]/pdf/route.ts` — unchanged. Same Playwright/Chromium path.
- `packages/pdf-renderer/index.ts` — unchanged. PDF is the HTML printed.
- `apps/web/src/lib/report-access.ts` — unchanged. Same expiry/token logic.
- All fetcher code in `packages/fetchers/`. All insight rules. All validation findings. All DB schema. All API routes.

### 8.3 Files added

- `agents/consumer-report-writer/src/__tests__/verdict.test.ts` — covers: no insights → green card, one CRITICAL → red card, one HIGH → amber card, multiple severities → most-severe wins.
- `agents/consumer-report-writer/src/__tests__/exposure-strip.test.ts` — covers: 0 risk → "0 at-risk", 1+ risk → sums correct, manual links render.
- `agents/consumer-report-writer/src/__tests__/repetition-audit.test.ts` — **the regression gate**. Asserts the buyer-page HTML contains zero occurrences of the strings: `Source Audit`, `Provenance`, `Section 1`, `Section 2`, `Section 3`, `Section 4`, `Section 5`, `Section 6`, `feedback-widget`, `Property Record Status`, `Financial Exposure Summary`, `Executive Summary`, `Key Questions`, `Pattern Intelligence`. Each appears zero times. This test prevents the redesign from regressing.
- `agents/consumer-report-writer/src/__tests__/value-preservation.test.ts` — asserts all 21 value elements (mapped to their HTML markers) appear at least once in `buyer-page + lawyer-layer` HTML combined. This test prevents silent data loss.
- `agents/consumer-report-writer/src/__tests__/visual-budget.test.ts` — asserts the buyer-page HTML is < 1,500 words / < 14,000 chars / fits within 1366×768 viewport on the golden-path fixture (counted as rendered height in a headless browser).

---

## 9. Interaction: buyer layer → lawyer layer

**Decision: Option 2 — separate page at `/report/[id]/lawyer`** (confirmed 2026-06-21).

- A second Next.js route at `apps/web/src/app/report/[id]/lawyer/page.tsx` renders `buildLawyerLayer(input)` only.
- The "View lawyer layer →" footer button is a regular `<a href="/report/[id]/lawyer">` (with `reportId` interpolated).
- The lawyer page shares the Next.js shell with the buyer page: same header, same provenance strip, same PDF button.
- A "← Back to buyer view" link at the top of the lawyer page returns to `/report/[id]`.
- **Pro**: cleaner URL semantics — buyer can share a single URL with their lawyer (`/report/[id]/lawyer`), the buyer URL stays the default, the lawyer URL is a "deep view".
- **Pro**: each page is one viewport on desktop. No `<details>` JS, no URL hash gymnastics.
- **Pro**: print/PDF routing is clean — the buyer URL prints page 1, the lawyer URL prints page 2 (or merged when printed).
- **Con**: extra route, extra DB call. The DB call is the same `report.html` fetch — no extra write. Acceptable.

**Implementation**:
- New file: `apps/web/src/app/report/[id]/lawyer/page.tsx` (~60 lines, mirrors `apps/web/src/app/report/[id]/page.tsx`).
- New function in `agents/consumer-report-writer/src/index.ts`: `generateLawyerLayerReport(input)` returns `{ html, title }` — same input schema as `generateConsumerReport`, output is the §L1–§L6 stack.
- The `lawyer-page.tsx` re-fetches the same stored report row, calls `generateLawyerLayerReport(input)`, embeds via `dangerouslySetInnerHTML`. Same expiry/access-token logic as the buyer page (reuses `addReportAccessTokensToHtml` + `injectReportExpiryIntoHtml`).
- The PDF route at `/api/report/[id]/pdf` is **extended** with a `?layer=lawyer` query param: when present, it renders the lawyer page; when absent, it renders the buyer page. Default remains buyer (backwards compatible).
- The buyer-page footer adds: `[View lawyer layer →]` linking to `/report/[id]/lawyer`.
- The lawyer-page top adds: `[← Back to buyer view]` linking to `/report/[id]`.
- A11y: both routes share `<FunnelTracker event="report_delivered">`; the lawyer route adds `event="report_lawyer_viewed"`.

---

## 10. Failure handling

- **No insights fire** (e.g., all sources failed, no Bhulekh data): §1 verdict card shows `⚠ Could not verify this plot — request manual verification`. §5 pills are still rendered but their panels show "Data unavailable" + a link to the failed source. The buyer sees "we don't know" rather than a confident blank.
- **No Bhunaksha map image** (e.g., `bhunakshaPlotReport.mapImageBase64` is empty): §2 right column shows a neutral card "Map not available for this plot" with a link to Bhunaksha. The page layout doesn't break.
- **`buildVerdictCard` throws**: defensive fallback renders the current "Property Record Status" + "Six Buyer Questions" sections. The buyer never sees a blank page. The fallback is the current v1 behavior — guarantees zero regression.
- **Toggle pill click fails** (vanilla JS error): the `<details>` element is browser-native, no JS required. Pills work without JS. The "View lawyer layer →" footer button is a plain `<a href="/report/[id]/lawyer">` — no JS needed (Option 2).
- **Lawyer route 404s on an expired report**: the lawyer page reuses the same `isReportViewAuthorized` + `injectReportExpiryIntoHtml` logic as the buyer page. If the report is expired, both pages render the expiry banner + refresh button. No special lawyer-page expiry handling needed.

---

## 11. Testing strategy

- **All 1,782 existing tests must continue to pass** (zero regressions). The fixture is the same; the rendered HTML changes.
- **Five new tests** in `__tests__/` per §8.3:
  - `verdict.test.ts` — verdict card severity selection.
  - `exposure-strip.test.ts` — exposure strip rendering.
  - `repetition-audit.test.ts` — **the regression gate** for the redesign goal.
  - `value-preservation.test.ts` — all 21 value elements present somewhere in the output.
  - `visual-budget.test.ts` — buyer page fits in 1 viewport on 1366×768.
- **Visual smoke test**: render the golden-path fixture in a headless Chromium at 1366×768, capture the screenshot, and verify:
  - Verdict card is the first content block after the header.
  - Map image renders at > 200px wide.
  - 6 Q-grid items are visible above the fold.
  - Footer is at < 800px from the top.
- **PDF smoke test**: render the golden-path report to PDF, verify both pages render (page 1 = buyer, page 2 = lawyer), map image prints, all toggle panels print open.

---

## 12. Out of scope

- New insight rules.
- New fetcher work.
- IGR concierge fetcher.
- Bhunaksha map improvements (the existing base64 SVG is reused as-is).
- Lawyer dashboard changes.
- PDF layout beyond `@media print` rules.
- Mobile native app.
- Translation to Odia.
- Dark mode.
- Print layout beyond what's already in the existing `@media print` block.

---

## 13. Risks & mitigations

- **Risk**: removing the "Financial Exposure Summary" table may surprise buyers who expect to see line items. **Mitigation**: the table data still appears in the §5 "Fees" toggle + lawyer layer §L6. The buyer page compresses to a strip; the data is one tap away.
- **Risk**: the Bhunaksha map at 280×220px is too small to read plot boundaries. **Mitigation**: the "↗ Open full map" link below the map opens a full-size modal or jumps to Bhunaksha directly. The map is a visual anchor, not a measurement tool. **Confirmed acceptable by user 2026-06-21.**
- **Risk**: 6 toggle pills is one more than the 5 from the previous spec. **Mitigation**: 6 is the right number — it maps 1:1 to the buyer's decision flow (identity → ownership → build → risk → price → costs) and carries all 21 value elements. **Confirmed acceptable by user 2026-06-21.**
- **Risk**: removing per-section feedback widgets loses granular signal. **Mitigation**: the global 👍/👎 button captures overall sentiment, which is the only metric that matters for product-market-fit. Per-section feedback was a nice-to-have, not load-bearing.
- **Risk**: separate lawyer route adds a second page render path; the buyer might get confused if they share the wrong URL. **Mitigation**: the buyer page is the canonical share URL (`/report/[id]`); the lawyer page is a sub-route (`/report/[id]/lawyer`) and includes a "← Back to buyer view" link. **Confirmed chosen by user 2026-06-21.**
- **Risk**: editorial design is subjective. **Mitigation**: the visual smoke test + the repetition-audit + value-preservation tests are the acceptance gate. Subjective polish is a founder review loop, not an automated check.

---

## 14. Acceptance criteria

The redesign is done when:

1. **Zero information loss**: all 21 value elements appear in `buyer-page + lawyer-layer` HTML combined. (Automated: `value-preservation.test.ts`.)
2. **Repetition eliminated**: buyer-page HTML contains zero occurrences of `Source Audit`, `Provenance` (as section title), `Section 1` through `Section 6`, `feedback-widget`, `Property Record Status`, `Financial Exposure Summary`, `Executive Summary`, `Key Questions`, `Pattern Intelligence`. (Automated: `repetition-audit.test.ts`.)
3. **One viewport on desktop**: golden-path buyer page renders fully in 1366×768. (Automated: `visual-budget.test.ts` + headless smoke.)
4. **Map is the visual anchor**: Bhunaksha SVG renders at > 200px wide in §2. (Automated: visual smoke.)
5. **Verdict hits first**: §1 verdict card is the first content block after the header on both desktop and mobile. (Automated: visual smoke.)
6. **Lawyer layer is one route away**: clicking the "View lawyer layer →" footer button navigates to `/report/[id]/lawyer` which renders the §L1–§L6 stack. A "← Back to buyer view" link returns to `/report/[id]`. (Manual + automated via the new route file existing.)
7. **All 1,782 existing tests pass.** (Automated: existing test suite.)
8. **PDF renders both pages**: `/api/report/[id]/pdf` produces the buyer PDF; `/api/report/[id]/pdf?layer=lawyer` produces the lawyer PDF; both have toggle panels expanded. (Automated: PDF smoke test.)
