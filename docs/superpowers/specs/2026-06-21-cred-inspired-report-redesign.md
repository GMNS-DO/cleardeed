# ClearDeed Report — CRED-Inspired Redesign

**Date**: 2026-06-21
**Owner**: Founder
**Status**: Draft → awaiting user spec review
**Scope**: Buyer-facing report UI + landing page visual language. The Next.js shell, mapper, schema, fetchers, insight engine, PDF renderer, and lawyer layer are all unchanged. The HTML output of `generateBuyerLayerReport` is the single source of truth for the report surface.

**Related**:
- `2026-06-21-report-dossier-redesign.md` (the editorial Dossier v2 that just shipped — this spec supersedes its visual direction but not its content model)
- `PRODUCT.md` Section 3 (Six Buyer Questions, Liability Boundary)
- `CLAUDE.md` "On the buyer question framework" and "On the three-layer report"

---

## 1. The brief, in one paragraph

Redesign the ClearDeed property report so the **buyer sees the answer to "Should I be worried?" in 5 seconds and can drill into any of the six buyer questions in one click**, while preserving **all existing content** (no information loss from the editorial v2). Adopt a **CRED-inspired visual language**: hybrid light canvas (warm off-white `#FAF7F0` retained) with CRED-style elevated glass cards, deep purple `#6B4EFF` as the primary accent, sticky right-side question navigator, and motion that animates once on entry. Stop using pills/toggles to gate content — show everything by default, anchored to a sticky in-page navigator. Reposition the lawyer drill-down as a **share-with-lawyer** action from the hero block, not as a tab on the buyer page.

---

## 2. Design decisions (locked in via brainstorming Q&A)

| # | Decision | Why |
|---|---|---|
| 1 | **Hybrid theme**: light canvas, CRED-style card design | CRED's premium feel comes from cards, not background. A legal/due-diligence product needs more gravitas than a fintech app — black canvas reads as entertainment. |
| 2 | **Six Questions as hero cards in a 2×3 grid** (1-col mobile) | The 6 Buyer Questions are the product's IP (CLAUDE.md "On the buyer question framework"). They must be the visible structure. |
| 3 | **Everything visible by default** with sticky in-page nav | Matches CRED's bill-detail page (one URL, all data, scroll to navigate). No progressive disclosure gating. |
| 4 | **Sticky right-side question chips** (IntersectionObserver active state) | CRED doesn't use pills. Right-side anchor nav is the established pattern (Stripe, Linear, Apple). |
| 5 | **Lawyer layer = source-by-source audit log** at `/report/[id]?layer=lawyer`, accessed via "Share with lawyer" button | Lawyer layer is a separate document, not a tab. The buyer gives the lawyer the same URL with a different query param. |

---

## 3. Information architecture

### 3.1 Page order (top to bottom)

```
┌─ HERO VERDICT BLOCK ────────────────────────────────────────────┐
│  • status dot row (5 sources, color-coded)                      │
│  • eyebrow: "CLEARDEED VERDICT"                                 │
│  • headline: <most severe insight as 64px serif>                │
│  • subhead: <1-sentence plain-English summary>                  │
│  • exposure strip: ₹0 quantified at risk · N items to verify    │
│  • actions: [Share with lawyer] [Download PDF] [Send to phone]  │
└────────────────────────────────────────────────────────────────┘
┌─ SOURCE STATUS STRIP ───────────────────────────────────────────┐
│  Bhulekh 14:32 ✓ | Bhunaksha 14:32 ✓ | eCourts ...             │
│  (one row of small chips, all 5+ sources at a glance)           │
└────────────────────────────────────────────────────────────────┘
┌─ Q-GRID: 6 HERO CARDS (2×3) ───────────────────────────────────┐
│  Q1  Does the seller own this?          [✓ ₹0]                  │
│  Q2  Can you build a house here?        [⚠ ₹0]                  │
│  Q3  Could you lose it after paying?    [✓ ₹0]                  │
│  Q4  Are you overpaying?                [✓ ₹0]                  │
│  Q5  Is the area developing or decaying? [⚠ ₹0]                 │
│  Q6  What happens after you buy?        [○ 3 items]              │
└────────────────────────────────────────────────────────────────┘
┌─ Q1-DETAIL (anchored #q1-detail) ──────────────────────────────┐
│  Title: Q1. Does the seller actually own this?                  │
│  1-line answer (24px ink)                                       │
│  3-col data card grid (key facts, CRED-style)                   │
│  Sub-finding chips (clickable to expand inline)                 │
│  Provenance strip (source + timestamp + verify-yourself link)   │
│  [Show lawyer's audit data for this question]                   │
└────────────────────────────────────────────────────────────────┘
... (Q2-detail through Q6-detail)
┌─ FOOTER ────────────────────────────────────────────────────────┐
│  Provenance strip (all 5 sources)                               │
│  Disclaimer: "This report is information, not legal advice"     │
│  [Share with lawyer] [Survey: How did this help?]               │
└────────────────────────────────────────────────────────────────┘
```

### 3.2 Above-the-fold principle

On a 1366×768 viewport, the buyer sees:
1. The **one-sentence verdict** (answer to "Should I be worried?")
2. **One quantified exposure number** (₹ amount at risk) and **one count** (items to verify manually)
3. The **six question tiles** with status chips

Nothing else. No audit data, no raw tables, no provenance. The detail is one scroll away.

### 3.3 What each hero card answers in 3 seconds

A buyer lands on a Q-tile and reads three things:
- The question (what is this about?)
- The status (✓ Verified / ⚠ Watch / ✕ Risk / ○ Manual / — N/A)
- The exposure (₹0 at risk / ₹X at risk / N items to verify)

If those three are enough, the buyer moves to the next tile. If not, they click → smooth scroll → the full Q-detail.

---

## 4. Visual system

### 4.1 Color tokens (CRED-palette feel, not exact)

```css
:root {
  /* Surface */
  --paper:        #FAF7F0;   /* page background (warm off-white) */
  --card:         #FFFFFF;   /* card surface */
  --card-elev:    rgba(255, 255, 255, 0.85);  /* glass card */

  /* Ink (text) */
  --ink:          #0B1220;   /* near-black headlines */
  --ink-2:        #1F2937;   /* primary body */
  --ink-3:        #4B5563;   /* secondary */
  --ink-4:        #9CA3AF;   /* meta / disabled */

  /* Lines */
  --border:       rgba(11, 18, 32, 0.08);
  --border-bold:  rgba(11, 18, 32, 0.16);

  /* Accents (CRED-style) */
  --accent:       #6B4EFF;   /* CRED purple, primary */
  --accent-2:     #FF6B35;   /* secondary orange */
  --accent-glow:  rgba(107, 78, 255, 0.12);

  /* Status semantics (preserved from editorial v2) */
  --good:         #0E9F6E;
  --good-soft:    rgba(14, 159, 110, 0.08);
  --watch:        #C77700;
  --watch-soft:   rgba(199, 119, 0, 0.08);
  --bad:          #DC2626;
  --bad-soft:     rgba(220, 38, 38, 0.08);
  --info:         #1D4ED8;
  --info-soft:    rgba(29, 78, 216, 0.08);
}
```

**Why this palette**: CRED uses near-black + saturated accent. We use a *less extreme* version: warm off-white page, near-black ink, deep purple (CRED's tell) as primary, status semantics preserved.

### 4.2 Typography

```css
--font-display: "Source Serif 4", "Source Serif Pro", Georgia, serif;
--font-sans:    "Inter", -apple-system, BlinkMacSystemFont, sans-serif;
--font-mono:    "JetBrains Mono", ui-monospace, "SF Mono", monospace;

/* Type scale (CRED-style: 4× ratio between hero and body) */
--text-hero:    64px / 1.05 / -0.03em / serif;
--text-h1:      40px / 1.15 / -0.02em / serif;
--text-h2:      28px / 1.2  / -0.01em / serif;
--text-card-h:  20px / 1.3  / -0.01em / sans;
--text-body:    16px / 1.55 / sans;
--text-meta:    13px / 1.4  / sans;
--text-eyebrow: 11px / 1.2  / 0.12em tracking / sans / uppercase;
--text-mono:    14px / 1.5  / mono;
```

**Why 3 typefaces**: CRED's NeoPOP uses 2 (display sans + body sans). We use 3: serif for headlines (legal/serious), sans for body (modern), mono for numerics (data). The serif+mono pair is a *deliberate* departure from CRED — it tells the buyer "this is a document, not an app".

### 4.3 Card system

All cards share:
```css
.card {
  background: var(--card-elev);
  backdrop-filter: blur(8px);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
  transition: border-color 150ms ease-out, transform 150ms ease-out;
}
.card:hover {
  border-color: var(--border-bold);
  transform: translateY(-2px);
}
```

**CRED's "tagged card" pattern**: the hero verdict block has a 4px gradient line on the left edge (`linear-gradient(180deg, #6B4EFF, #FF6B35)`) as a visual accent. No full-bleed gradients, no glow orbs.

### 4.4 Spacing

```css
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 24px;
--space-6: 32px;
--space-7: 48px;
--space-8: 64px;
--space-9: 96px;

/* Layout */
--max-w: 1120px;     /* page max width */
--grid-gap: 24px;    /* 2-col Q-tile grid */
--section-gap: 96px; /* between Q-detail sections */
```

---

## 5. Component specs

### 5.1 Hero verdict block (top)

```
┌────────────────────────────────────────────────────────────────┐
│ ●●●● ●● ●   ← status dot row (one per source, color-coded)     │
│                                                                │
│ CLEARDEED VERDICT                                              │
│                                                                │
│ Manual verification recommended                                │
│                                                                │
│ Structural checks pass. Three items need your local           │
│ Sub-Registrar office before you pay token money.               │
│                                                                │
│ ┌──────────────────────────┐  ┌──────────────────────────────┐ │
│ │ ₹0                       │  │ 3                            │ │
│ │ quantified at risk       │  │ items to verify manually     │ │
│ └──────────────────────────┘  └──────────────────────────────┘ │
│                                                                │
│ [ Share with lawyer ]  [ Download PDF ]  [ Send to my phone ]  │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

- **Background**: `var(--card-elev)` with backdrop-blur
- **Left edge**: 4px gradient bar (`#6B4EFF` → `#FF6B35`, vertical)
- **Border-radius**: 16px
- **Padding**: 48px horizontal, 40px vertical
- **Status dot row**: one dot per source (today: 6 sources — Bhulekh, Bhunaksha, eCourts, RCCMS, BDA, IGR EC; dormant sources are rendered with `--info`/blue at 0.4 opacity), 8px diameter, 8px gap, color = status, opacity 0.6
- **Eyebrow**: 11px tracked uppercase, `--ink-4`
- **Headline**: 64px serif, `--ink`, line-height 1.05, max 2 lines
- **Subhead**: 17px sans, `--ink-2`, line-height 1.55, max 2 lines
- **Exposure strip**: 2-col grid, 24px gap, each cell = `var(--card)` with 1px border, 16px padding
  - Left cell: 56px mono, `--ink` (₹ amount) + 11px meta, `--ink-4` ("quantified at risk")
  - Right cell: 56px sans, `--ink` (count) + 11px meta, `--ink-4` ("items to verify manually")
- **Actions**: 3 buttons in a row, 12px gap
  - Primary: filled `--accent`, white text, 14px sans semibold
  - Secondary: outlined `--ink`, 1px border, 14px sans semibold
  - Tertiary: text link, `--ink-3`, 14px sans, underline on hover

### 5.2 Q-tile (hero card in 2×3 grid)

```
┌──────────────────────────────────────┐
│ Q1 of 6                              │ ← eyebrow, ink-4
│                                      │
│ Does the seller                      │ ← 24px serif, ink
│ actually own this?                   │
│                                      │
│ ✓   Verified                         │ ← 14px sans, green chip
│     RoR owner matches                │   1-line answer, ink-2
│                                      │
│ ┌──────────────────────────────────┐ │
│ │ ₹0                               │ │ ← 32px mono, ink
│ │ at risk exposure                 │ │   11px meta, ink-4
│ └──────────────────────────────────┘ │
│                                      │
│ 3 details  →                          │ ← 12px ink-4, arrow on hover
└──────────────────────────────────────┘
   width: 100% on mobile, calc((100% - 24px) / 2) on 768px+
```

- **Background**: `var(--card)`, 1px border
- **Hover**: lift 2px, border darkens
- **Click**: `html { scroll-behavior: smooth }` + JS to set `scroll-margin-top: 80px` on each Q-detail
- **Status chip**: small inline element, 8px gap from text, icon + 1 word
  - `✓ Verified` (green) / `⚠ Watch` (amber) / `✕ Risk` (red) / `○ Manual` (blue) / `— N/A` (gray)
- **Exposure card**: nested card with `--card-elev` background, 1px border, 16px padding
- **Width**: 1-col on mobile, 2-col on ≥768px, 3-col on ≥1200px (then 6 tiles in 2 rows of 3)

### 5.3 Source status strip (between hero and Q-grid)

```
┌────────────────────────────────────────────────────────────────┐
│ Bhulekh RoR  14:32 ✓  |  Bhunaksha  14:32 ✓  |  eCourts  ...   │
└────────────────────────────────────────────────────────────────┘
```

- One horizontal row, wrap on mobile
- Each source = 13px sans name + 12px mono timestamp + 8px status dot
- Status dot: 8px diameter, color = status
- Dividers: 1px vertical `var(--border)`, 16px horizontal padding
- Whole strip: `var(--card-elev)`, 1px border, 12px radius, 16px padding

### 5.4 Q-detail section (full-width, anchored)

```
Q1. Does the seller actually own this?
─────────────────────────────────────
1-line answer in 24px ink: "Yes — RoR owner matches the seller name
                             exactly; one prior mutation since 2014."

Key facts (3-col grid, CRED-style "data cards"):
┌────────────────┐  ┌────────────────┐  ┌────────────────┐
│ RoR OWNER      │  │ MATCH          │  │ LAST MUTATION  │
│ Krushna...     │  │ Exact          │  │ 2018-09-12     │
│ Verified ✓     │  │ ✓              │  │ ✓              │
└────────────────┘  └────────────────┘  └────────────────┘

Sub-finding chips (auto-generated, clickable to expand):
  ✓ Single owner recorded
  ✓ Father's name matches RoR
  ⚠ No encumbrance certificate (manual fetch needed)

Provenance strip:
  Source: Bhulekh RoR (Plot 415, Chandaka)
  Fetched: 2026-04-12 14:32 IST
  ↗ Verify yourself on Bhulekh (opens in new tab)
```

- **Section spacing**: 96px between Q-detail sections, 32px within
- **Title**: 40px serif, `--ink`, with anchor `id="q1-detail"`
- **1-line answer**: 24px serif, `--ink-2`, italic
- **Key facts grid**: 3-col on ≥768px, 1-col on mobile, 16px gap
  - Each fact card: `var(--card)`, 1px border, 16px padding
  - Label: 11px eyebrow, `--ink-4`
  - Value: 18px mono, `--ink`
  - Status icon: 14px, top-right
- **Sub-finding chips**: pill-shaped, 13px sans, soft-tone background, 8px gap between
  - `var(--good-soft)` / `--good` (green) for verified
  - `var(--watch-soft)` / `--watch` (amber) for watch
  - `var(--bad-soft)` / `--bad` (red) for risk
  - `var(--info-soft)` / `--info` (blue) for manual
  - Click: expands a 2-3 line detail panel inline, 250ms ease-out

### 5.5 Sticky right-side question navigator

```
                                          ┌──────┐
                                          │  Q1  │  ← 11px, ink-4
                                          │  Q2  │
                                          │  Q3  │
                                          │  Q4  │
                                          │  Q5  │
                                          │  Q6  │
                                          └──────┘
                                          
                                          position: fixed, right: 24px, top: 50%
                                          transform: translateY(-50%)
                                          width: 36px
```

- **Position**: `fixed`, `right: 24px`, `top: 50%`, `transform: translateY(-50%)`
- **Mobile**: `left: 16px`, smaller chips
- **Active state**: when a Q-detail is in viewport (`IntersectionObserver` with `rootMargin: -30% 0px -60% 0px`), the active chip is `--ink` with a 2px left border; otherwise `--ink-4`
- **Click**: smooth scroll to `#q{1-6}-detail`
- **Z-index**: 50 (above Q-grid, below modals)
- **Hidden on**: <768px (replaced with a top sticky tab bar; see §5.6)

### 5.6 Mobile sticky tab bar (replaces right-side nav on <768px)

- Sticky horizontal pills at top, just below the hero
- Same Q1–Q6 labels, same active state
- Tap → scroll to Q-detail with `scroll-margin-top: 64px` (height of bar + breathing room)
- Background: `var(--card-elev)` with backdrop-blur
- Bottom border: 1px `var(--border)`

### 5.7 Footer (below all Q-details)

- **Provenance strip**: list all 5+ sources with last-fetched timestamps, copy-on-tap
- **Disclaimer**: "This report is information, not a legal opinion. Before transacting, share with a qualified property lawyer, request original title documents going back 30 years, obtain an Encumbrance Certificate, verify boundaries on the ground, confirm land classification permits your use, confirm no conversion of land use is required."
- **Share-with-lawyer button**: primary accent
- **Survey**: "How did this help?" 1-click feedback form (preserved from editorial v2)

---

## 6. Motion (CRED's signature)

| Element | Trigger | Animation | Duration |
|---|---|---|---|
| Body | Page load | Fade-in opacity 0→1 | 200ms |
| Hero | Page load | Translate Y 16px→0 + fade | 350ms, ease-out |
| Status strip | Page load | Fade-in (after hero) | 250ms, 100ms delay |
| Q-tile | Page load | Staggered translate Y 12px→0 + fade | 250ms, 60ms × index, ease-out |
| Q-tile | Hover | Translate Y -2px + border darkens | 150ms |
| Q-tile | Click | Scroll smooth to Q-detail | 400ms |
| Status chip | Intersection | Color from transparent→full | 250ms |
| Number counter | Intersection (first viewport entry) | Count up 0→target | 800ms, ease-out |
| Sub-finding chip click | Click | Inline expand 0→max-height | 250ms, ease-out |

**Reduced motion**: `@media (prefers-reduced-motion: reduce)` disables all transforms and the number counter. Smooth scroll becomes instant.

---

## 7. Implementation plan

This section is for the writer-of-the-plan (writing-plans skill). High-level steps:

1. **Update `buildBuyerPage`** in `agents/consumer-report-writer/src/index.ts` to use the new component structure:
   - Replace `buildTogglePillBar` with `buildQGrid` (6 hero cards in a 2×3 grid)
   - Replace the toggle-driven detail rendering with 6 separate `buildQDetail` sections, all rendered by default
   - Add `buildSourceStatusStrip` between hero and Q-grid
   - Add `buildStickyNav` (right-side chips + mobile top bar) as a separate element
   - Update `buildPropertyHeader` to be the hero verdict block (incorporate status dot row, exposure strip, action buttons)
2. **Replace `REPORTER_CSS` (or `CSS` constant)** with the new visual system tokens
3. **Add IntersectionObserver-driven JS** for:
   - Active state on sticky nav chips
   - Number count-up on first viewport entry
4. **Update landing page** (`/`) to match the new visual language (CRED-style input card)
5. **Keep lawyer layer unchanged** — `generateLawyerLayerReport` is untouched
6. **Keep the two existing audit tests** (`buyer-page-audit.test.ts`) and add:
   - Visual-budget: no more than 1.5 viewports above the fold (hero + status strip + 2 rows of Q-tiles)
   - Repetition: same as v2 (no 3-word phrase in 2+ panels) — now applied to 6 Q-tiles + 6 Q-details
   - All 6 Q-tiles present and clickable
   - All 6 Q-details present and visible by default
   - Sticky nav present with 6 active states
   - Hero exposure strip has exactly 2 cells
7. **Manual smoke test**: open `/report/CLD-DEMO` in browser, verify the 5-second test (can a new buyer see the verdict + 6 question tiles above the fold?)

---

## 8. Out of scope

- **No PDF redesign in this pass** — the rendered HTML is what gets printed. PDF styling is a downstream concern.
- **No new data sources** — we use the existing buyer-layer content from `consumer-report-writer`. We're restructuring, not enriching.
- **No dark-mode toggle** — the design is light-only. CRED's main app is dark, but a legal document is more credible in light. We get the CRED *feel* through cards and motion, not background.
- **No new branding/marketing site** — just the report and landing.
- **No changes to the lawyer layer** — `generateLawyerLayerReport` is the source-by-source audit log, unchanged.

---

## 9. Risks & mitigations

| Risk | Mitigation |
|---|---|
| "Everything visible" makes the page long and feels overwhelming on first scroll | Hero block + 2 rows of Q-tiles fit above the fold. The Q-tile summaries are the 3-second-answers. Q-details are clearly delineated sections. Sticky nav provides orientation. |
| Serif + sans + mono adds load time | 3 system-stack fonts (no external requests). Source Serif 4 → Source Serif Pro → Georgia (graceful degradation). Same for Inter and JetBrains Mono. |
| CRED's signature dark canvas is what makes it feel premium — without it, do we lose the feel? | The premium feel comes from the cards (elevated glass, gradient accent line, glow on numbers) and motion (count-up, scroll-snap). The CRED feel survives on light. |
| Sticky nav on mobile takes screen space | Top tab bar is 48px tall — small enough. Buyer only needs it while scrolling. |
| Buyers who prefer the old "all 6 pills at the top" pattern may be confused | The Q-grid is the new pattern. Q-tiles are the primary navigation. The pills/toggle is gone. Communicate via the hero block and the sticky nav. |

---

## 10. Success criteria

- [ ] Above the fold (1366×768), the buyer sees the verdict, one ₹ amount, one count, and all 6 Q-tiles (or at least 4 in the first viewport with the rest requiring a half-screen scroll).
- [ ] The 6 Q-tiles each have: a question, a status chip, and a ₹ exposure (or "N items" for Q6).
- [ ] Clicking any Q-tile smooth-scrolls to its Q-detail section.
- [ ] All 6 Q-details are visible by default (no clicks needed to expand).
- [ ] Sticky right-side nav highlights the current Q-detail as the buyer scrolls.
- [ ] Hero block has a "Share with lawyer" button that copies the lawyer-layer URL to clipboard.
- [ ] Reduced-motion users see no transforms or counter animation.
- [ ] All 36 existing buyer-page tests still pass; 6+ new tests added for the new structure.
- [ ] Page loads in <1.5s on 3G throttled, <500ms on broadband.
- [ ] The buyer can answer "Should I be worried?" in 5 seconds.
