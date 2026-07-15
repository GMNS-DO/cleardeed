# ClearDeed Report — Premium Redesign Spec

**Status:** PROPOSAL
**Created:** 2026-06-26
**Supersedes:** [REPORT_DESIGN_SPEC.md](../../agents/consumer-report-writer/REPORT_DESIGN_SPEC.md) for visual/structural layer only. Insight registry, fraud-pattern logic, and source-trust strip remain canonical.
**Goal:** Transform the buyer-facing report into a premium, investment-grade artifact worthy of being screenshot and shared before any property is purchased.

---

## 1. North Star

> A buyer should be able to send the ClearDeed report link to their spouse, and within 30 seconds of opening it, that spouse should be able to explain to a third person:
> 1. What this property is
> 2. Why it's risky or safe
> 3. What to do next
>
> The report should feel like a Bloomberg Terminal meets a luxury real-estate brochure. Data-dense but readable. Honest but confident.

---

## 2. Aesthetic Direction — "Quiet Luxury Data"

**Visual lineage:** Stripe Press × Bloomberg Graphics × Christie's International × Linear × Apple Health reports.

### Color Palette (dark-mode-first)

```
--ink-900:   #0A0E14   /* near-black, primary background */
--ink-800:   #11161F   /* card background */
--ink-700:   #1A2230   /* elevated card / hover */
--ink-600:   #2A3343   /* borders, dividers */
--ink-100:   #E8ECF1   /* primary text */
--ink-050:   #F4F6F9   /* high-emphasis text */
--ink-040:   #B8C0CC   /* secondary text */

--gold-500:  #C9A961   /* signature accent — only for hero, primary actions */
--gold-400:  #D4B978   /* hover */
--gold-200:  #8A7548   /* muted accent / borders */

--verdict-red:    #E5484D   /* CRITICAL */
--verdict-amber:  #F5A524   /* WATCH-OUT */
--verdict-green:  #30A46C   /* VERIFIED */
--verdict-blue:   #4DABF7   /* INFO / GAP */

--source-ok:      #30A46C
--source-warn:    #F5A524
--source-missing: #6B7280
```

**Why dark-first:** legal/financial buyers screenshot, share on WhatsApp, view at night. Dark = premium signal in 2026. Light mode is a fallback (system preference), not primary.

### Typography

```
--font-display:  'GT Sectra', 'Playfair Display', serif   /* headlines, plot ID, verdict */
--font-sans:     'Inter', 'Söhne', system-ui             /* body, labels, data */
--font-mono:     'JetBrains Mono', 'Berkeley Mono', monospace  /* plot IDs, hashes, coordinates, source timestamps */

--text-xs:    11px / 1.4   /* source meta, hashes */
--text-sm:    13px / 1.5   /* body, table cells */
--text-base:  15px / 1.6   /* primary reading */
--text-lg:    18px / 1.5   /* panel headers */
--text-xl:    24px / 1.3   /* section headers */
--text-2xl:   36px / 1.2   /* hero title */
--text-3xl:   56px / 1.1   /* verdict headline (only place this size appears) */
```

### Spacing & Layout

- **8px base grid.** Generous whitespace. Each section breathes.
- **Max content width:** 1280px on web. Mobile collapses to single column with sticky bottom nav.
- **Cards:** 16px padding, 12px radius, 1px border at `--ink-600`, optional 1px inner glow on hover.
- **No drop shadows.** Depth via layering (slightly lighter card on darker bg).

---

## 3. The Plot Map — Centerpiece

**This is the most important new addition.** Today the report has a static SVG plot diagram. We're replacing it with a live, interactive, full-bleed map that anchors the entire report.

### Map Library: **react-map-gl/maplibre + deck.gl**

**Why this stack:**
- **MapLibre GL JS** — open-source, free vector tiles (no Mapbox token cost). Renders fast, works offline.
- **deck.gl** overlays — GPU-accelerated layers for polygon outlines, neighbor plots, risk heatmaps, 3D extrusion.
- **react-map-gl** — React bindings for MapLibre/deck.gl.

### Map Layers (bottom → top)

| Layer | Source | Visual |
|-------|--------|--------|
| 1. Satellite | Esri World Imagery (free, no key) | Color satellite tiles |
| 2. Cadastral overlay | Bhunaksha WFS polygons | Translucent teal fill + 0.5px white outline |
| 3. **Target plot** | WFS GeoJSON, single feature | Solid gold (#C9A961) fill at 60% opacity + 2px gold outline + glow |
| 4. **Neighbour plots** | WFS GeoJSON, 4 cardinal neighbours | Owner name label + thin outline (dim if no risk, red if EOW-flagged, amber if pending mutation) |
| 5. **Chauhaddi arrows** | Computed from neighbour centroids | 4 animated SVG arrows pointing from plot center to each neighbour center, 200ms ease-out fade-in on load |
| 6. **Risk overlay** | Future: flood zone, BDA zoning | Translucent polygon overlay keyed to risk severity |
| 7. **POIs** | Nominatim reverse-geocode cache | Hospital, school, police station icons with distance labels |
| 8. **Road access** | OSM Overpass | Highlighted nearest road with distance |

### Map Interaction

- **Pan/zoom** — standard, clamped to Khordha district bounds (85.0–86.0°E, 19.8–20.5°N)
- **Click any neighbour plot** — opens side panel with: owner name (raw Odia + transliteration), area, khata, ROR status, risk tier. Slides in from right.
- **Toggle layers** — top-right floating control: Satellite / Cadastral / Both. Stays in localStorage.
- **"Verify on Bhulekh" button** — bottom-right of map card — opens Bhulekh RoR URL in new tab with plot ID prefilled where possible.

### Map States (data-driven)

| State | Trigger | Visual treatment |
|-------|---------|------------------|
| `verified` | Bhunaksha + Bhulekh both confirm | Solid gold glow pulse (1.5s on load) |
| `partial` | Only one source confirms | Static gold outline, no glow, "Verified by one source" badge |
| `unverified` | Neither confirms | Dashed gold outline, grey fill, "Location approximate" caption |
| `disputed` | Multiple polygons, ambiguous | Pulsing amber outline, "Boundary dispute — verify manually" |

### Static Fallback

For PDF export and slow connections, a static SVG snapshot is generated server-side from the same GeoJSON. Same colour treatment, no interactivity. Snapshot includes all labels, the chauhaddi arrows baked in.

---

## 4. Report Section Redesign

### Section Order (above the fold → below)

#### FOLD 1 — The Hero (no scroll, ~700px)

```
┌─────────────────────────────────────────────────────────────┐
│ [ClearDeed wordmark]    Plot ID CLD-2026-A4F2    ⚙ [share] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   Mendhasala, Plot 309                                      │
│   Khatiyan 830 · 10.5 acres · Patia, Khordha                │
│   20.2727° N, 85.7013° E                                    │
│                                                             │
│   ┌──────────────────────────────────────────────┐          │
│   │           LIVE INTERACTIVE MAP               │          │
│   │   [satellite + cadastral + neighbours]        │          │
│   │   [target plot glowing gold]                 │          │
│   └──────────────────────────────────────────────┘          │
│                                                             │
│   ┌─Owner──────────────┐  ┌─Land───────────────┐            │
│   │ Krushnachandra     │  │ Agricultural       │            │
│   │ Barajena           │  │ (ଦଣ୍ଡା — irrigated)  │            │
│   │ S/o Pratima · SC   │  │ BDA: Residential   │            │
│   │ ⚠ Name mismatch    │  │ Conversion needed  │            │
│   └────────────────────┘  └────────────────────┘            │
│                                                             │
│   ┌────────────────────────────────────────────────────┐    │
│   │  VERDICT                                           │    │
│   │  ⚠ Critical Concern — name mismatch + impersonation │    │
│   │  1 critical · 2 watch-outs · 2 source gaps          │    │
│   │  1 of 5 fraud patterns triggered (Pattern 3)         │    │
│   └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

**Key changes from current:**
- Map is **above the fold**, not buried below Q-grid
- Owner + Land cards are the same height, side-by-side, no hero "card" abstraction
- Verdict is a full-width band, not a tiny chip
- Plot coordinates in mono font, not inline with title

#### FOLD 2 — The 5 Fraud Patterns (scroll once)

A horizontal scrolling row of 5 cards, one per pattern. Each card:
- Icon (✅ / 🛑 / ⏳)
- Pattern name (one line)
- One-sentence verdict
- "Why" — collapsible, default closed
- Source link

Visual: horizontal scroll-snap on mobile, 5-across grid on desktop. Pattern cards have a thin colored top border (green/amber/red/grey) matching verdict.

#### FOLD 3 — The 6 Buyer Questions (Q-grid)

Same as current Q-grid but redesigned:
- Tile height: 140px (up from 100px) for breathing room
- Each tile: severity badge top-right, leading headline (serif), count "3 concerns · 1 verified · 1 gap" in mono
- Hover: tile lifts (1px translate, border gold) + preview tooltip with first 2 insight headlines
- Click → scrolls to Q-detail panel

#### FOLD 4+ — Q-Detail Panels

Each Q gets a full-width section. Layout:
```
[Q1: Does the seller own this?]
─────────────────────────────────
  [narrative paragraph — 2-3 sentences, serif body]
  ─────────────────────────────────────────────
  [Insight row: severity icon | headline | 1-line detail | expand]
  [Insight row: severity icon | headline | 1-line detail | expand]
  [Insight row: severity icon | headline | 1-line detail | expand]
  ─────────────────────────────────────────────
  [Source provenance strip — same as before]
```

Each insight row, when expanded, shows:
- Raw Odia (collapsible, behind "Show original" toggle)
- Source provenance card
- Action item ("Verify with X")
- Confidence badge

#### FOLD FINAL — Mutation Timeline + Footer

Vertical timeline (unchanged structurally) but redesigned:
- Timeline rail: 1px gold vertical line down the center
- Entries: cards alternating left/right (desktop), all right (mobile)
- Each entry: date, type, plot, action item
- Gap markers: visual "—" with "No mutations in N years" caption in mono

Footer:
- Disclaimer (compact, not the giant block today)
- "This report is informational. Consult a property lawyer before transacting." (single line, prominent)
- Source list with verification links
- Report hash + generation timestamp

---

## 5. PDF Report — "The Dossier"

The PDF is not a print of the web page. It's a **separate artifact**, designed for the buyer's lawyer to read and annotate. Two paths:

### Path A (recommended): Server-rendered Puppeteer with custom print stylesheet

**Stack:** Puppeteer (already available via Next.js) + a dedicated `/report/[id]/print` route + a print-only CSS file.

**Why Puppeteer over @react-pdf/renderer:**
- Full CSS support (gradients, custom fonts, exact spacing)
- Can render the live map as a screenshot via deck.gl canvas
- Identical visual language to the web report
- No code duplication — write once, render twice

**Why not just `window.print()`:**
- Headless, deterministic output
- Works on iOS Safari (which often breaks `window.print()`)
- Generates a downloadable file, not a print dialog

**Architecture:**
```
/report/[id]/print       → Server component renders report with print stylesheet
                          → Returns full HTML
                          → Puppeteer navigates to it (or fetches HTML directly)
                          → Renders to PDF with @page rules
                          → Streams PDF response
```

**@page rules:**
```
@page {
  size: A4;
  margin: 18mm 14mm 20mm 14mm;
}
@page :first {
  margin: 0;
  /* cover page: full-bleed, no header/footer */
}
@page title {
  /* pattern verdict page: distinct layout */
}
```

**Page structure (target 8-12 pages):**
1. **Cover** — full-bleed map snapshot, plot ID, owner, verdict, ClearDeed wordmark, generation hash, date
2. **Executive Summary** — verdict, 5 patterns grid, financial exposure summary
3. **Plot & Neighbours** — static map snapshot with annotations, owner details, land class details
4-9. **One page per Buyer Question** — narrative + insight rows + provenance
10. **Mutation Timeline** — full visual timeline
11. **Source Provenance** — table of every fact in the report with source URL, timestamp, parser version
12. **Disclaimer & Verification Checklist** — what the lawyer should manually verify

**Cover page mockup:**
```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  [gold accent line]                                         │
│                                                              │
│  CLEARDEED                                                  │
│  Property Due Diligence Report                              │
│                                                              │
│  ──                                                         │
│                                                              │
│  Mendhasala, Plot 309                                        │
│  Khatiyan 830                                               │
│                                                              │
│  ⚠ Critical Concern                                         │
│  Generated 2026-06-26 · 14:23 IST                           │
│  Report ID: CLD-2026-A4F2                                   │
│  Integrity: sha256:7a3f9b2c...                              │
│                                                              │
│  ──                                                         │
│                                                              │
│  [Full-bleed map snapshot — satellite + plot outline]        │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Path B (fallback, simpler): `@react-pdf/renderer`

Use only if Puppeteer proves unreliable in production. Less polished output but no browser dependency. Trade-off: would lose the map snapshot and accept a simpler cover.

**Recommendation:** Start with Puppeteer. Profile in staging. Fall back to @react-pdf/renderer only if cold-start cost is unmanageable.

---

## 6. Components to Build / Refactor

| Component | Status | Notes |
|-----------|--------|-------|
| `ReportShell` | NEW | Wraps all report pages, applies dark theme + global styles |
| `MapCard` | NEW | Interactive maplibre + deck.gl, pan/zoom/toggle, emits click events |
| `MapSnapshot` | NEW | Server-rendered static SVG/PNG fallback |
| `HeroSection` | REWRITE | Plot ID, owner card, land card, verdict band, full-bleed map |
| `FraudPatternRow` | REWRITE | Horizontal scroll-snap row, not a vertical stack |
| `QuestionGrid` | REWRITE | Bigger tiles, hover preview, gold lift on hover |
| `InsightRow` | REFINE | Cleaner expansion, better raw-Odia disclosure |
| `MutationTimeline` | REFINE | Gold rail, alternating cards, gap markers |
| `SourceProvenanceStrip` | KEEP | Already in spec, refine only |
| `PrintLayout` | NEW | Print-only stylesheet + `@page` rules |
| `CoverPage` | NEW | PDF-only, server-rendered |
| `DisclaimerPanel` | SIMPLIFY | One line + link to full disclaimer |

---

## 7. Animation & Motion

Light, purposeful, premium. Never decorative.

- **Page load:** hero map fades in over 400ms, gold target glow pulses once (1.5s)
- **Q-grid tile hover:** 120ms ease-out, 1px translate-y, border color shift to gold
- **Insight row expand:** 200ms ease-in-out height
- **Pattern row scroll-snap:** native CSS scroll-snap
- **Verdict band:** subtle gradient shift over 8s (very slow, almost imperceptible)
- **No parallax.** No scroll-jacking. No bouncy easings.

**Respect `prefers-reduced-motion`** — disable all but opacity transitions.

---

## 8. Data Layer — What Already Exists

| Data point | Source today | Used in redesign? |
|------------|--------------|-------------------|
| Plot GeoJSON | Bhunaksha WFS | ✅ Map layer 2 |
| Owner name (en + Odia) | Bhulekh RoR | ✅ Hero owner card |
| Khatiyan, plot, area | Bhulekh RoR | ✅ Hero subtitle |
| Land class (kisam) | Bhulekh RoR | ✅ Hero land card |
| BDA zone | regulatory-screener | ✅ Hero land card |
| Owner match status | owner-matcher | ✅ Hero mismatch badge |
| 5 fraud patterns | consumer-report-writer | ✅ Fold 2 row |
| 6 Q insights | consumer-report-writer | ✅ Fold 3 + 4 |
| Mutation timeline | Bhulekh special remarks | ✅ Fold final |
| Source provenance | every fetcher | ✅ Footer + throughout |

**No new fetcher work required.** This is purely UI/UX + map rendering.

---

## 9. Implementation Phases

### Phase 1 — Aesthetic Foundation (2-3 sessions)
- Set up Tailwind config with the colour/typography tokens above
- Build `ReportShell` with dark theme
- Migrate existing report page to the new shell, keep current layout
- Verify on mobile

### Phase 2 — Hero Map (2-3 sessions)
- Add MapLibre + deck.gl dependencies
- Build `MapCard` with layers 1-4 from spec (satellite, cadastral, target, neighbours)
- Wire to existing Bhunaksha GeoJSON output (already produced by fetcher)
- Build `MapSnapshot` server-rendered fallback
- Integrate into hero

### Phase 3 — Restructure Sections (2-3 sessions)
- Rewrite hero, fraud patterns row, Q-grid, Q-detail per spec
- Add animations per Section 7
- Mobile responsive pass

### Phase 4 — PDF Dossier (2-3 sessions)
- Build `/report/[id]/print` route
- Implement Puppeteer pipeline (or @react-pdf fallback)
- Cover page + 8-12 page structure
- Verify on iOS Safari, Chrome, Firefox

### Phase 5 — Polish & Ship (1-2 sessions)
- Accessibility audit (contrast, screen reader, reduced motion)
- Performance pass (map lazy load, font subset)
- Real-report QA across 5 ground-truth reports

**Total: 9-14 sessions.** Roughly 5-7 weeks at 2-3 sessions/week.

---

## 10. Open Questions

1. **Map tile provider:** Esri World Imagery (free, no key) is the default. Should we offer Mapbox satellite (paid, higher quality) as an upgrade? Likely no for V1.
2. **Cover page name:** "ClearDeed Dossier" vs "ClearDeed Property Report" vs just "ClearDeed"? My recommendation: drop the product name into the report, keep simple — "Property Due Diligence Report."
3. **Share-to-WA button:** Should the report have a built-in "Share to WhatsApp" CTA that captures a screenshot? WhatsApp is the primary sharing channel in India. Could be a V1.2 add.
4. **Spouse explanation test:** Run the report by 3 non-technical users (your spouse, a friend's spouse, etc.) before shipping. If they can't explain it in 30 seconds, redesign again.
5. **Map data availability:** confirm Bhunaksha WFS returns GeoJSON with full attribute set (owner name, khata, plot). If not, we'll need to merge Bhulekh data into the GeoJSON server-side.

---

## 11. Success Metrics

After shipping:
- **Time on report** (median): target 2+ minutes (vs current ~45s)
- **Spouse explanation test:** 3/3 non-technical users can summarize in <30s
- **Screenshot rate:** 20%+ of buyers screenshot at least one section
- **Share rate:** 10%+ of buyers click share button or copy link
- **Conversion (preview → paid):** 5%+ (vs current 2%)

---

## 12. Out of Scope (V1)

- 3D map extrusion / 3D buildings
- VR / AR walkthrough
- Live property video / drone footage (not in fetcher scope)
- Multi-language (Odia) report — V2
- Interactive verification (let user upload their own EC PDF and we cross-check) — V2
- Lawyer co-sign in-app (PDF stamp) — V2
