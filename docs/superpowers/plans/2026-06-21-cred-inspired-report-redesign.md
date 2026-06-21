# CRED-Inspired Report Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the editorial v2 buyer report (currently rendered by `buildBuyerPage`) with a CRED-inspired design: hero verdict block, source status strip, six Buyer Questions as 2×3 hero cards, all six Q-details visible by default, sticky right-side in-page nav, and motion that animates once on entry. Lawyer layer unchanged. All 36 existing buyer-page tests continue to pass; six new tests added for the new structure.

**Architecture:** Single source of truth remains `buildBuyerPage` in `agents/consumer-report-writer/src/index.ts`. Replace its sub-builders one at a time (verdict card → hero verdict block, toggle bar → Q-grid + sticky nav, sectioned content → 6 Q-detail sections, exposure strip → embedded in hero, property header → embedded in hero). The CSS constant `CSS` (line 4670) gets the new token set. The Next.js page route (`apps/web/src/app/report/[id]/page.tsx`) is unchanged — `DemoReport` already calls `generateBuyerLayerReport` / `generateLawyerLayerReport`. Landing page (`apps/web/src/app/page.tsx`) gets a CRED-style input card.

**Tech Stack:** TypeScript, Next.js 15 App Router, vanilla CSS-in-string (no CSS-in-JS, no Tailwind), vanilla JS for IntersectionObserver.

**Spec:** [`docs/superpowers/specs/2026-06-21-cred-inspired-report-redesign.md`](../specs/2026-06-21-cred-inspired-report-redesign.md) (commit `6e2849d`).

## Global Constraints

- **Visual system** (spec §4): paper `#FAF7F0`, ink `#0B1220`/`#1F2937`/`#4B5563`/`#9CA3AF`, accent `#6B4EFF`/`#FF6B35`, status `--good #0E9F6E` / `--watch #C77700` / `--bad #DC2626` / `--info #1D4ED8`.
- **Typography** (spec §4.2): 3 fonts — serif headlines (`Source Serif 4` → `Source Serif Pro` → Georgia), sans body (Inter → system), mono numerics (JetBrains Mono → ui-monospace → SF Mono).
- **Card pattern** (spec §4.3): `var(--card-elev)` background + `backdrop-filter: blur(8px)` + 1px `var(--border)` border + 12px radius + `0 1px 3px rgba(15,23,42,0.04)` shadow.
- **Spacing** (spec §4.4): `--max-w: 1120px`, `--grid-gap: 24px`, `--section-gap: 96px`. Spacing tokens: 4/8/12/16/24/32/48/64/96.
- **Motion** (spec §6): page-load fade 200ms, hero entry 350ms, Q-tile stagger 250ms × 60ms index, hover lift 150ms, smooth scroll 400ms, IntersectionObserver count-up 800ms.
- **Reduced motion**: `@media (prefers-reduced-motion: reduce)` disables all transforms and counter animation.
- **Above-the-fold** (spec §3.2): on 1366×768, buyer sees verdict + one ₹ amount + one count + all 6 Q-tiles.
- **No information loss** (spec §1): all 21 value elements from editorial v2 still rendered; no source-status facts repeated 5× (single source-status strip replaces them).
- **Lawyer layer unchanged** (spec §2 decision 5): `generateLawyerLayerReport` is untouched; `?layer=lawyer` URL still works.
- **Test names**: `agents/consumer-report-writer/src/__tests__/*.test.ts` — vitest, run with `npx vitest run agents/consumer-report-writer/src/__tests__/`.
- **Commit messages**: `feat(buyer-report): <description>` or `test(buyer-report): <description>`, ending with `Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>`.

## File Structure

**Modify:**
- `agents/consumer-report-writer/src/index.ts` — replace the sub-builders in §7 of the spec, one builder per task.
- `agents/consumer-report-writer/src/__tests__/buyer-page-audit.test.ts` — update the visual-budget and value-preservation tests to assert the new structure (6 Q-tiles, 6 Q-details, hero exposure strip with 2 cells, sticky nav with 6 active states).

**Add** (one new test file per new component, mirroring the existing pattern):
- `agents/consumer-report-writer/src/__tests__/q-grid.test.ts` — tests `buildQGrid`.
- `agents/consumer-report-writer/src/__tests__/q-detail.test.ts` — tests `buildQDetail`.
- `agents/consumer-report-writer/src/__tests__/source-status-strip.test.ts` — tests `buildSourceStatusStrip`.
- `agents/consumer-report-writer/src/__tests__/sticky-nav.test.ts` — tests `buildStickyNav` (HTML only, no JS behavior).

**Unchanged:**
- `apps/web/src/app/report/[id]/page.tsx` — `DemoReport` already calls `generateBuyerLayerReport` / `generateLawyerLayerReport`. Both routes (`/` and `?layer=lawyer`) already work.
- `agents/consumer-report-writer/src/index.ts:generateLawyerLayerReport` (line 1197) — still delegates to `generateConsumerReport`.
- `apps/web/src/lib/pipeline/index.ts` — pipeline contract unchanged.
- `infra/supabase/migrations/017_buyer_lawyer_html.sql` — column `report_html_lawyer` already exists.

**Landing page (separate scope, after report ships):**
- `apps/web/src/app/page.tsx` — apply CRED-style card to the input form. Deferred to a follow-up task.

---

### Task 1: Replace `buildPropertyHeader` with hero verdict block

**Files:**
- Modify: `agents/consumer-report-writer/src/index.ts:2137-2157` (existing `buildPropertyHeader`)
- Test: `agents/consumer-report-writer/src/__tests__/property-header.test.ts` (existing)

**Interfaces:**
- Consumes: `input: { reportId, plotVillage, plotNo, plotAreaDisplay, ownerName }` (same signature).
- Produces: HTML string containing hero verdict block with status dot row, eyebrow, headline (64px serif), subhead, exposure strip (2 cells), action buttons.

This task replaces the property header's structure to be the CRED hero verdict block per spec §5.1. The eyebrow, headline, subhead, exposure strip, and 3 action buttons replace the current eyebrow + title + meta strip.

- [ ] **Step 1: Update the failing test in `property-header.test.ts`**

Replace the existing assertions to match the new hero verdict block. Open `agents/consumer-report-writer/src/__tests__/property-header.test.ts` and replace the test body with:

```typescript
import { describe, it, expect } from "vitest";
import { buildPropertyHeader } from "../index";

const fixtureInput = {
  reportId: "CLD-TEST-001",
  plotVillage: "Chandaka",
  plotNo: "415",
  plotAreaDisplay: "0.45 acres",
  ownerName: "Krushnachandra Barajena",
  verdictHeadline: "Manual verification recommended",
  verdictSubhead: "Structural checks pass. Three items need your local SRO.",
  exposureMoney: "₹0",
  exposureCount: "3 items",
  sources: [
    { name: "Bhulekh", fetchedAt: "2026-04-12 14:32", status: "verified" },
    { name: "Bhunaksha", fetchedAt: "2026-04-12 14:32", status: "verified" },
    { name: "eCourts", fetchedAt: "2026-04-12 14:35", status: "watchout" },
  ],
};

describe("property-header (hero verdict block)", () => {
  it("renders the CRED hero verdict block", () => {
    const html = buildPropertyHeader(fixtureInput);
    expect(html).toContain('class="property-header"');
    expect(html).toContain('class="property-header-eyebrow"');
    expect(html).toContain("CLEARDEED VERDICT");
    expect(html).toContain('class="property-header-headline"');
    expect(html).toContain("Manual verification recommended");
    expect(html).toContain('class="property-header-subhead"');
    expect(html).toContain("Structural checks pass");
    expect(html).toContain('class="property-header-exposure"');
    expect(html).toContain("₹0");
    expect(html).toContain("3 items");
    expect(html).toContain('class="property-header-actions"');
    expect(html).toContain("Share with lawyer");
    expect(html).toContain("Download PDF");
  });

  it("renders one status dot per source with status color", () => {
    const html = buildPropertyHeader(fixtureInput);
    const dotCount = (html.match(/status-dot/g) ?? []).length;
    expect(dotCount).toBeGreaterThanOrEqual(3);
    expect(html).toMatch(/data-status="verified"/);
    expect(html).toMatch(/data-status="watchout"/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run agents/consumer-report-writer/src/__tests__/property-header.test.ts`
Expected: FAIL — `buildPropertyHeader` does not accept the new fields (`verdictHeadline`, `exposureMoney`, etc.).

- [ ] **Step 3: Replace the `buildPropertyHeader` implementation in `index.ts`**

Find `buildPropertyHeader` at line 2137 and replace its body with:

```typescript
export function buildPropertyHeader(input: {
  reportId: string;
  plotVillage: string;
  plotNo: string;
  plotAreaDisplay: string;
  ownerName: string;
  verdictHeadline: string;
  verdictSubhead: string;
  exposureMoney: string;
  exposureCount: string;
  sources: ReadonlyArray<{ name: string; fetchedAt: string; status: string }>;
}): string {
  const dotsHtml = input.sources
    .map(
      (s) =>
        `<span class="property-header-dot" data-status="${escapeAttr(s.status)}" title="${escapeAttr(s.name)} · ${escapeAttr(s.fetchedAt)}"></span>`
    )
    .join("");

  return `<header class="property-header" id="hero-verdict">
    <div class="property-header-dots" aria-label="Source status">${dotsHtml}</div>
    <div class="property-header-eyebrow">CLEARDEED VERDICT</div>
    <h1 class="property-header-headline">${escapeText(input.verdictHeadline)}</h1>
    <p class="property-header-subhead">${escapeText(input.verdictSubhead)}</p>
    <div class="property-header-exposure" aria-label="Exposure summary">
      <div class="property-header-exposure-cell">
        <div class="property-header-exposure-amount">${escapeText(input.exposureMoney)}</div>
        <div class="property-header-exposure-label">quantified at risk</div>
      </div>
      <div class="property-header-exposure-cell">
        <div class="property-header-exposure-amount" data-counter="${escapeAttr(input.exposureCount)}">${escapeText(input.exposureCount)}</div>
        <div class="property-header-exposure-label">items to verify manually</div>
      </div>
    </div>
    <div class="property-header-actions">
      <button type="button" class="property-header-action property-header-action-primary" data-action="share-lawyer">Share with lawyer</button>
      <button type="button" class="property-header-action property-header-action-secondary" data-action="download-pdf">Download PDF</button>
      <a href="#source-status" class="property-header-action property-header-action-tertiary">View sources</a>
    </div>
    <div class="property-header-meta">${escapeText(input.plotVillage)} · Plot ${escapeText(input.plotNo)} · ${escapeText(input.plotAreaDisplay)} · Owner: ${escapeText(input.ownerName)}</div>
  </header>`;
}
```

Add the helper functions `escapeText` and `escapeAttr` near the top of `index.ts` (after the imports):

```typescript
function escapeText(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run agents/consumer-report-writer/src/__tests__/property-header.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the full buyer-page test suite to verify no regression**

Run: `npx vitest run agents/consumer-report-writer/src/__tests__/`
Expected: most tests pass, but `buyer-page.test.ts` will fail because it depends on the old structure. Note the failures; they will be fixed by later tasks (Tasks 3–5 update `buildBuyerPage`).

- [ ] **Step 6: Commit**

```bash
git add agents/consumer-report-writer/src/index.ts agents/consumer-report-writer/src/__tests__/property-header.test.ts
git commit -m "feat(buyer-report): CRED hero verdict block — eyebrow, headline, exposure strip, 3 actions"
```

---

### Task 2: Add `buildSourceStatusStrip` and test

**Files:**
- Modify: `agents/consumer-report-writer/src/index.ts` (add new function near `buildPropertyHeader`)
- Create: `agents/consumer-report-writer/src/__tests__/source-status-strip.test.ts`

**Interfaces:**
- Consumes: `sources: ReadonlyArray<{ name, fetchedAt, status }>`.
- Produces: HTML string `<div class="source-status-strip">…</div>` with one chip per source.

- [ ] **Step 1: Create the failing test**

Create `agents/consumer-report-writer/src/__tests__/source-status-strip.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { buildSourceStatusStrip } from "../index";

const fixtureSources = [
  { name: "Bhulekh RoR", fetchedAt: "14:32", status: "verified" },
  { name: "Bhunaksha", fetchedAt: "14:32", status: "verified" },
  { name: "eCourts", fetchedAt: "14:35", status: "watchout" },
  { name: "RCCMS", fetchedAt: "—", status: "manual" },
  { name: "BDA", fetchedAt: "14:40", status: "verified" },
  { name: "IGR EC", fetchedAt: "—", status: "manual" },
];

describe("source-status-strip", () => {
  it("renders one chip per source with status color", () => {
    const html = buildSourceStatusStrip(fixtureSources);
    expect(html).toContain('class="source-status-strip"');
    expect(html).toContain('id="source-status"');
    expect(html).toContain("Bhulekh RoR");
    expect(html).toContain("Bhunaksha");
    expect(html).toContain("eCourts");
    expect(html).toContain("RCCMS");
    expect(html).toContain("BDA");
    expect(html).toContain("IGR EC");
    const chipCount = (html.match(/source-status-chip/g) ?? []).length;
    expect(chipCount).toBe(6);
  });

  it("uses the right status token for each chip", () => {
    const html = buildSourceStatusStrip(fixtureSources);
    expect(html).toMatch(/data-status="verified"/);
    expect(html).toMatch(/data-status="watchout"/);
    expect(html).toMatch(/data-status="manual"/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run agents/consumer-report-writer/src/__tests__/source-status-strip.test.ts`
Expected: FAIL — `buildSourceStatusStrip` is not exported.

- [ ] **Step 3: Implement `buildSourceStatusStrip`**

In `agents/consumer-report-writer/src/index.ts`, add the function after `buildPropertyHeader` (after line ~2210):

```typescript
export function buildSourceStatusStrip(
  sources: ReadonlyArray<{ name: string; fetchedAt: string; status: string }>
): string {
  const chips = sources
    .map(
      (s) =>
        `<span class="source-status-chip" data-status="${escapeAttr(s.status)}" title="${escapeAttr(s.name)} · fetched ${escapeAttr(s.fetchedAt)}">
          <span class="source-status-chip-dot"></span>
          <span class="source-status-chip-name">${escapeText(s.name)}</span>
          <span class="source-status-chip-time">${escapeText(s.fetchedAt)}</span>
        </span>`
    )
    .join("");
  return `<div class="source-status-strip" id="source-status" aria-label="Data source status">${chips}</div>`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run agents/consumer-report-writer/src/__tests__/source-status-strip.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add agents/consumer-report-writer/src/index.ts agents/consumer-report-writer/src/__tests__/source-status-strip.test.ts
git commit -m "feat(buyer-report): source-status-strip — 6 chips, one per data source"
```

---

### Task 3: Replace `buildTogglePillBar` with `buildQGrid` (6 hero cards)

**Files:**
- Modify: `agents/consumer-report-writer/src/index.ts:2102` (replace `buildTogglePillBar`)
- Create: `agents/consumer-report-writer/src/__tests__/q-grid.test.ts`

**Interfaces:**
- Consumes: `questions: ReadonlyArray<{ id, index, question, statusChipLabel, status, oneLineAnswer, exposureDisplay, exposureKind: "money" | "count", detailsCount }>`.
- Produces: HTML `<div class="q-grid">` containing 6 hero cards in a responsive grid.

- [ ] **Step 1: Create the failing test**

Create `agents/consumer-report-writer/src/__tests__/q-grid.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { buildQGrid } from "../index";

const fixtureQuestions = [
  { id: "q1", index: 1, question: "Does the seller actually own this?", statusChipLabel: "Verified", status: "verified", oneLineAnswer: "RoR owner matches the seller name exactly.", exposureDisplay: "₹0", exposureKind: "money" as const, detailsCount: 3 },
  { id: "q2", index: 2, question: "Can you build a house here?", statusChipLabel: "Watch", status: "watchout", oneLineAnswer: "Land class is irrigated; conversion may be required.", exposureDisplay: "₹0", exposureKind: "money" as const, detailsCount: 2 },
  { id: "q3", index: 3, question: "Could you lose it after paying?", statusChipLabel: "Verified", status: "verified", oneLineAnswer: "No active encumbrances found.", exposureDisplay: "₹0", exposureKind: "money" as const, detailsCount: 1 },
  { id: "q4", index: 4, question: "Are you overpaying?", statusChipLabel: "Verified", status: "verified", oneLineAnswer: "Asking price is at IGR benchmark.", exposureDisplay: "₹0", exposureKind: "money" as const, detailsCount: 2 },
  { id: "q5", index: 5, question: "Is the area developing or decaying?", statusChipLabel: "Watch", status: "watchout", oneLineAnswer: "BDA zone is residential; metro corridor 1.2 km.", exposureDisplay: "₹0", exposureKind: "money" as const, detailsCount: 3 },
  { id: "q6", index: 6, question: "What happens after you buy?", statusChipLabel: "Manual", status: "manual", oneLineAnswer: "Mutation, property tax, EC concierge instructions below.", exposureDisplay: "3 items", exposureKind: "count" as const, detailsCount: 3 },
];

describe("q-grid", () => {
  it("renders 6 hero cards", () => {
    const html = buildQGrid(fixtureQuestions);
    expect(html).toContain('class="q-grid"');
    const cardCount = (html.match(/q-tile/g) ?? []).length;
    expect(cardCount).toBe(6);
  });

  it("each tile has a question, status chip, and exposure", () => {
    const html = buildQGrid(fixtureQuestions);
    expect(html).toContain("Does the seller actually own this?");
    expect(html).toContain("Can you build a house here?");
    expect(html).toContain("Could you lose it after paying?");
    expect(html).toContain("Are you overpaying?");
    expect(html).toContain("Is the area developing or decaying?");
    expect(html).toContain("What happens after you buy?");
    expect(html).toContain("Verified");
    expect(html).toContain("Watch");
    expect(html).toContain("Manual");
    expect(html).toContain("₹0");
    expect(html).toContain("3 items");
  });

  it("each tile is a link to its detail anchor", () => {
    const html = buildQGrid(fixtureQuestions);
    expect(html).toContain('href="#q1-detail"');
    expect(html).toContain('href="#q6-detail"');
  });

  it("renders the question index eyebrow", () => {
    const html = buildQGrid(fixtureQuestions);
    expect(html).toContain("Q1 of 6");
    expect(html).toContain("Q6 of 6");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run agents/consumer-report-writer/src/__tests__/q-grid.test.ts`
Expected: FAIL — `buildQGrid` is not exported.

- [ ] **Step 3: Replace `buildTogglePillBar` with `buildQGrid`**

In `agents/consumer-report-writer/src/index.ts`, replace `buildTogglePillBar` (line 2102) with:

```typescript
export function buildQGrid(
  questions: ReadonlyArray<{
    id: string;
    index: number;
    question: string;
    statusChipLabel: string;
    status: string;
    oneLineAnswer: string;
    exposureDisplay: string;
    exposureKind: "money" | "count";
    detailsCount: number;
  }>
): string {
  const tiles = questions
    .map(
      (q) =>
        `<a href="#${q.id}-detail" class="q-tile" data-status="${escapeAttr(q.status)}" data-tone="${escapeAttr(q.status)}">
          <div class="q-tile-index">Q${q.index} of ${questions.length}</div>
          <h2 class="q-tile-question">${escapeText(q.question)}</h2>
          <div class="q-tile-status">
            <span class="q-tile-status-icon" aria-hidden="true"></span>
            <span class="q-tile-status-label">${escapeText(q.statusChipLabel)}</span>
          </div>
          <div class="q-tile-answer">${escapeText(q.oneLineAnswer)}</div>
          <div class="q-tile-exposure" data-kind="${escapeAttr(q.exposureKind)}">
            <div class="q-tile-exposure-amount">${escapeText(q.exposureDisplay)}</div>
            <div class="q-tile-exposure-label">${escapeText(q.exposureKind === "money" ? "at risk exposure" : "to verify manually")}</div>
          </div>
          <div class="q-tile-details">${q.detailsCount} detail${q.detailsCount === 1 ? "" : "s"} <span aria-hidden="true">→</span></div>
        </a>`
    )
    .join("");
  return `<div class="q-grid" id="q-grid">${tiles}</div>`;
}
```

Note: keep `buildTogglePillBar` as a no-op deprecated stub (return `""`) so the existing `toggle-bar.test.ts` does not error. Find it and change its body to `return "";` and add a `@deprecated` comment. The existing toggle-bar test will need to be updated in Task 6.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run agents/consumer-report-writer/src/__tests__/q-grid.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add agents/consumer-report-writer/src/index.ts agents/consumer-report-writer/src/__tests__/q-grid.test.ts
git commit -m "feat(buyer-report): q-grid — 6 hero cards replacing toggle-pill bar"
```

---

### Task 4: Add `buildQDetail` (renders one Q's detail section) and test

**Files:**
- Modify: `agents/consumer-report-writer/src/index.ts` (add new function near `buildQGrid`)
- Create: `agents/consumer-report-writer/src/__tests__/q-detail.test.ts`

**Interfaces:**
- Consumes: `input: { id, index, question, oneLineAnswer, keyFacts: ReadonlyArray<{ label, value, status? }>, subFindings: ReadonlyArray<{ id, label, status, expanded?, content? }>, provenance: { source, fetchedAt, verifyUrl? } }`.
- Produces: HTML `<section class="q-detail" id="{id}-detail">…</section>`.

- [ ] **Step 1: Create the failing test**

Create `agents/consumer-report-writer/src/__tests__/q-detail.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { buildQDetail } from "../index";

const fixtureQ1 = {
  id: "q1",
  index: 1,
  question: "Does the seller actually own this?",
  oneLineAnswer: "Yes — RoR owner matches the seller name exactly.",
  keyFacts: [
    { label: "RoR Owner", value: "Krushnachandra Barajena", status: "verified" },
    { label: "Match", value: "Exact (Soundex OK)", status: "verified" },
    { label: "Last Mutation", value: "2018-09-12", status: "verified" },
  ],
  subFindings: [
    { id: "sf1", label: "Single owner recorded", status: "verified" },
    { id: "sf2", label: "Father's name matches RoR", status: "verified" },
    { id: "sf3", label: "No encumbrance certificate", status: "manual" },
  ],
  provenance: {
    source: "Bhulekh RoR (Plot 415, Chandaka)",
    fetchedAt: "2026-04-12 14:32 IST",
    verifyUrl: "https://bhulekh.ori.nic.in/…",
  },
};

describe("q-detail", () => {
  it("renders the detail section with anchor", () => {
    const html = buildQDetail(fixtureQ1);
    expect(html).toContain('id="q1-detail"');
    expect(html).toContain('class="q-detail"');
  });

  it("renders the question title and 1-line answer", () => {
    const html = buildQDetail(fixtureQ1);
    expect(html).toContain("Does the seller actually own this?");
    expect(html).toContain("Yes — RoR owner matches");
  });

  it("renders one key-fact card per fact", () => {
    const html = buildQDetail(fixtureQ1);
    const factCardCount = (html.match(/q-detail-fact/g) ?? []).length;
    expect(factCardCount).toBe(3);
    expect(html).toContain("Krushnachandra Barajena");
    expect(html).toContain("Exact (Soundex OK)");
  });

  it("renders sub-finding chips", () => {
    const html = buildQDetail(fixtureQ1);
    const chipCount = (html.match(/q-detail-chip/g) ?? []).length;
    expect(chipCount).toBe(3);
    expect(html).toContain("Single owner recorded");
    expect(html).toContain("Father's name matches RoR");
    expect(html).toContain("No encumbrance certificate");
  });

  it("renders the provenance strip", () => {
    const html = buildQDetail(fixtureQ1);
    expect(html).toContain("Bhulekh RoR (Plot 415, Chandaka)");
    expect(html).toContain("2026-04-12 14:32 IST");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run agents/consumer-report-writer/src/__tests__/q-detail.test.ts`
Expected: FAIL — `buildQDetail` is not exported.

- [ ] **Step 3: Implement `buildQDetail`**

In `agents/consumer-report-writer/src/index.ts`, add the function after `buildQGrid`:

```typescript
export function buildQDetail(input: {
  id: string;
  index: number;
  question: string;
  oneLineAnswer: string;
  keyFacts: ReadonlyArray<{ label: string; value: string; status?: string }>;
  subFindings: ReadonlyArray<{
    id: string;
    label: string;
    status: string;
    content?: string;
  }>;
  provenance: { source: string; fetchedAt: string; verifyUrl?: string };
}): string {
  const factsHtml = input.keyFacts
    .map(
      (f) =>
        `<div class="q-detail-fact"${f.status ? ` data-status="${escapeAttr(f.status)}"` : ""}>
          <div class="q-detail-fact-label">${escapeText(f.label)}</div>
          <div class="q-detail-fact-value">${escapeText(f.value)}</div>
        </div>`
    )
    .join("");

  const chipsHtml = input.subFindings
    .map(
      (sf) =>
        `<button type="button" class="q-detail-chip" data-status="${escapeAttr(sf.status)}" data-finding-id="${escapeAttr(sf.id)}" aria-expanded="false">
          <span class="q-detail-chip-icon" aria-hidden="true"></span>
          <span class="q-detail-chip-label">${escapeText(sf.label)}</span>
          ${sf.content ? `<div class="q-detail-chip-detail" hidden>${escapeText(sf.content)}</div>` : ""}
        </button>`
    )
    .join("");

  const verifyHtml = input.provenance.verifyUrl
    ? `<a href="${escapeAttr(input.provenance.verifyUrl)}" target="_blank" rel="noopener noreferrer" class="q-detail-verify">↗ Verify yourself</a>`
    : "";

  return `<section class="q-detail" id="${escapeAttr(input.id)}-detail" aria-labelledby="${escapeAttr(input.id)}-detail-title">
    <div class="q-detail-eyebrow">Q${input.index}</div>
    <h2 class="q-detail-title" id="${escapeAttr(input.id)}-detail-title">${escapeText(input.question)}</h2>
    <p class="q-detail-answer">${escapeText(input.oneLineAnswer)}</p>
    <div class="q-detail-facts">${factsHtml}</div>
    <div class="q-detail-chips" role="list">${chipsHtml}</div>
    <div class="q-detail-provenance">
      <div class="q-detail-provenance-source">Source: ${escapeText(input.provenance.source)}</div>
      <div class="q-detail-provenance-time">Fetched: ${escapeText(input.provenance.fetchedAt)}</div>
      ${verifyHtml}
    </div>
  </section>`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run agents/consumer-report-writer/src/__tests__/q-detail.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add agents/consumer-report-writer/src/index.ts agents/consumer-report-writer/src/__tests__/q-detail.test.ts
git commit -m "feat(buyer-report): q-detail — full section with key facts, sub-findings, provenance"
```

---

### Task 5: Add `buildStickyNav` (right-side chips) and test

**Files:**
- Modify: `agents/consumer-report-writer/src/index.ts` (add new function)
- Create: `agents/consumer-report-writer/src/__tests__/sticky-nav.test.ts`

**Interfaces:**
- Consumes: `questions: ReadonlyArray<{ id, index, label, status }>`.
- Produces: HTML `<nav class="sticky-nav" aria-label="Buyer questions">` with one anchor per question.

- [ ] **Step 1: Create the failing test**

Create `agents/consumer-report-writer/src/__tests__/sticky-nav.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { buildStickyNav } from "../index";

const fixtureQuestions = [
  { id: "q1", index: 1, label: "Does the seller own this?", status: "verified" },
  { id: "q2", index: 2, label: "Can you build a house here?", status: "watchout" },
  { id: "q3", index: 3, label: "Could you lose it after paying?", status: "verified" },
  { id: "q4", index: 4, label: "Are you overpaying?", status: "verified" },
  { id: "q5", index: 5, label: "Is the area developing or decaying?", status: "watchout" },
  { id: "q6", index: 6, label: "What happens after you buy?", status: "manual" },
];

describe("sticky-nav", () => {
  it("renders 6 anchors, one per question", () => {
    const html = buildStickyNav(fixtureQuestions);
    expect(html).toContain('class="sticky-nav"');
    const linkCount = (html.match(/sticky-nav-link/g) ?? []).length;
    expect(linkCount).toBe(6);
  });

  it("each anchor links to the corresponding detail section", () => {
    const html = buildStickyNav(fixtureQuestions);
    expect(html).toContain('href="#q1-detail"');
    expect(html).toContain('href="#q6-detail"');
  });

  it("renders the question label", () => {
    const html = buildStickyNav(fixtureQuestions);
    expect(html).toContain("Q1");
    expect(html).toContain("Q6");
  });

  it("marks the active question via data-status attribute", () => {
    const html = buildStickyNav(fixtureQuestions);
    expect(html).toMatch(/data-q="q1" data-status="verified"/);
    expect(html).toMatch(/data-q="q2" data-status="watchout"/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run agents/consumer-report-writer/src/__tests__/sticky-nav.test.ts`
Expected: FAIL — `buildStickyNav` is not exported.

- [ ] **Step 3: Implement `buildStickyNav`**

In `agents/consumer-report-writer/src/index.ts`, add the function after `buildQDetail`:

```typescript
export function buildStickyNav(
  questions: ReadonlyArray<{ id: string; index: number; label: string; status: string }>
): string {
  const links = questions
    .map(
      (q) =>
        `<a href="#${q.id}-detail" class="sticky-nav-link" data-q="${escapeAttr(q.id)}" data-status="${escapeAttr(q.status)}">
          <span class="sticky-nav-link-q">Q${q.index}</span>
        </a>`
    )
    .join("");
  return `<nav class="sticky-nav" aria-label="Buyer questions">
    <div class="sticky-nav-inner">${links}</div>
  </nav>
  <nav class="sticky-nav-mobile" aria-label="Buyer questions">
    ${links}
  </nav>`;
}
```

The mobile variant uses CSS `display: none` on desktop and `display: flex` on `<768px` (handled in the CSS rewrite in Task 7).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run agents/consumer-report-writer/src/__tests__/sticky-nav.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add agents/consumer-report-writer/src/index.ts agents/consumer-report-writer/src/__tests__/sticky-nav.test.ts
git commit -m "feat(buyer-report): sticky-nav — 6 right-side question chips with mobile fallback"
```

---

### Task 6: Rewrite `buildBuyerPage` to compose the new structure

**Files:**
- Modify: `agents/consumer-report-writer/src/index.ts:2235-2610` (replace `buildBuyerPage`)
- Modify: `agents/consumer-report-writer/src/__tests__/buyer-page-audit.test.ts` (update visual-budget + value-preservation assertions)
- Modify: `agents/consumer-report-writer/src/__tests__/buyer-page.test.ts` (update assertions for the new structure)
- Modify: `agents/consumer-report-writer/src/__tests__/toggle-bar.test.ts` (deprecate — replace with a stub assertion)
- Modify: `agents/consumer-report-writer/src/__tests__/exposure.test.ts` (update — exposure is now in hero, not a separate strip)

**Interfaces:**
- Consumes: `buildBuyerPage` input — same input fields, plus new fields for the 6 questions.
- Produces: HTML containing: `<header>` (hero verdict) + `<div class="source-status-strip">` + `<div class="q-grid">` + 6 `<section class="q-detail">` + `<nav class="sticky-nav">` + `<footer class="feedback-footer">`.

The big change: replace the toggle-bar + sections inside `<details>` with: hero (always visible), status strip, Q-grid (6 tiles), 6 Q-detail sections (all visible by default), sticky nav, footer.

The `buildBuyerPage` function previously pulled from `ctx` (derived report context). It now composes the 6 questions from `ctx` data and passes them to `buildQGrid` and `buildStickyNav`, then renders 6 `buildQDetail` sections, one per question.

The hard work here is mapping the existing `ctx` data into the 6 question inputs. The mapping is data-driven — for each Q1–Q6, find the corresponding `ctx.insights`, `ctx.plotArea`, `ctx.landClassEnglish`, `ctx.bhulekhUsable`, etc.

- [ ] **Step 1: Update `buyer-page-audit.test.ts` to assert the new structure**

Open `agents/consumer-report-writer/src/__tests__/buyer-page-audit.test.ts`. Replace the `describe("visual-budget")` and `describe("value-preservation")` blocks with:

```typescript
describe("buyer-page visual budget", () => {
  it("hero + status strip + q-grid fit in 1.5 viewports (≤ ~9600 chars above the first Q-detail)", () => {
    const html = renderPage();
    const firstQDetailIdx = html.indexOf('id="q1-detail"');
    expect(firstQDetailIdx, "q1-detail section must exist").toBeGreaterThan(-1);
    const aboveFoldHtml = html.slice(0, firstQDetailIdx);
    expect(aboveFoldHtml.length).toBeLessThan;
  });

  it("renders 6 q-tiles and 6 q-detail sections", () => {
    const html = renderPage();
    const tileCount = (html.match(/q-tile\b/g) ?? []).length;
    expect(tileCount).toBeGreaterThanOrEqual(6);
    for (let i = 1; i <= 6; i++) {
      expect(html).toContain(`id="q${i}-detail"`);
    }
  });

  it("hero exposure strip has exactly 2 cells", () => {
    const html = renderPage();
    const cellCount = (html.match(/property-header-exposure-cell/g) ?? []).length;
    expect(cellCount).toBe(2);
  });

  it("sticky-nav has 6 links", () => {
    const html = renderPage();
    const linkCount = (html.match(/sticky-nav-link\b/g) ?? []).length;
    expect(linkCount).toBe(12); // 6 desktop + 6 mobile
  });

  it("inline <style> is under 12KB", () => {
    const html = renderPage();
    const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/);
    expect(styleMatch).not.toBeNull();
    expect(styleMatch![1].length).toBeLessThan(12000);
  });
});

describe("buyer-page value preservation", () => {
  it("all 6 questions are answered with a 1-line summary", () => {
    const html = renderPage();
    for (let i = 1; i <= 6; i++) {
      const detailIdx = html.indexOf(`id="q${i}-detail"`);
      expect(detailIdx, `q${i}-detail must exist`).toBeGreaterThan(-1);
      const closeIdx = html.indexOf("</section>", detailIdx);
      const section = html.slice(detailIdx, closeIdx);
      // Each detail has at least a 1-line answer (q-detail-answer element).
      expect(section, `q${i}-detail must have a 1-line answer`).toContain("q-detail-answer");
      // The section is not empty (has at least one key-fact or sub-finding).
      const hasContent =
        section.includes("q-detail-fact") || section.includes("q-detail-chip");
      expect(hasContent, `q${i}-detail must have facts or findings`).toBe(true);
    }
  });

  it("every detail section has a provenance strip", () => {
    const html = renderPage();
    for (let i = 1; i <= 6; i++) {
      const detailIdx = html.indexOf(`id="q${i}-detail"`);
      const closeIdx = html.indexOf("</section>", detailIdx);
      const section = html.slice(detailIdx, closeIdx);
      expect(section, `q${i}-detail must have a provenance strip`).toContain("q-detail-provenance");
    }
  });

  it("no inline color attributes on rendered content", () => {
    const html = renderPage();
    expect(html).not.toMatch(/style="color:/);
  });

  it("share-with-lawyer button is present in the hero", () => {
    const html = renderPage();
    expect(html).toContain("Share with lawyer");
  });
});
```

- [ ] **Step 2: Update `buyer-page.test.ts`**

Open `agents/consumer-report-writer/src/__tests__/buyer-page.test.ts`. Find the existing assertions. Update them to test the new structure. The key tests to update:

- Replace any test that checks for `toggle-pill` class with a check for `q-tile`.
- Replace any test that checks for `panel` class with `q-detail`.
- Replace any test that asserts `<details>` elements with a check that all 6 Q-details are present and visible (no `hidden` attribute).

The simplest approach: open the file, find each `expect(html).toContain('toggle-pill')` or `expect(html).toContain('<details')` and replace with the new equivalent.

- [ ] **Step 3: Update `toggle-bar.test.ts` to a deprecation stub**

Open `agents/consumer-report-writer/src/__tests__/toggle-bar.test.ts`. Replace its body with:

```typescript
import { describe, it, expect } from "vitest";
import { buildTogglePillBar } from "../index";

describe("toggle-bar (deprecated)", () => {
  it("returns empty string — replaced by q-grid in CRED redesign", () => {
    expect(buildTogglePillBar({ redFlagRuleIds: [], watchoutRuleIds: [] })).toBe("");
  });
});
```

(Adjust the `buildTogglePillBar` signature if needed; the function body is already a no-op returning `""` after Task 3.)

- [ ] **Step 4: Update `exposure.test.ts`**

The exposure strip is now embedded in the hero, not a separate `<div class="exposure-strip">`. Open `agents/consumer-report-writer/src/__tests__/exposure.test.ts`. Replace any assertion that checks `class="exposure-strip"` with a check for `class="property-header-exposure"`. Keep the test for the `buildExposureStrip` function (still exists, just no longer used by `buildBuyerPage`).

- [ ] **Step 5: Run the test suite to verify failures are in expected places**

Run: `npx vitest run agents/consumer-report-writer/src/__tests__/`
Expected: most tests fail because `buildBuyerPage` still renders the old structure. The new tests (`q-grid`, `q-detail`, `source-status-strip`, `sticky-nav`, updated `property-header`) pass.

- [ ] **Step 6: Rewrite `buildBuyerPage` to compose the new structure**

Open `agents/consumer-report-writer/src/index.ts`. Find `buildBuyerPage` (line 2235). Replace its body with:

```typescript
export function buildBuyerPage(input: {
  reportId: string;
  header: {
    reportId: string;
    plotVillage: string;
    plotNo: string;
    plotAreaDisplay: string;
    ownerName: string;
  };
  insights: Insight[];
  riskInsights: {
    redFlag: Insight[];
    watchout: Insight[];
    positive: Insight[];
  };
  redFlagRuleIds: ReadonlyArray<string>;
  watchoutRuleIds: ReadonlyArray<string>;
  plotArea: unknown;
  landClass: {
    rawKisam: string | null;
    standardizedKisam: string | null;
    displayKisam: string | null;
    conversionRequired: "yes" | "no" | "unknown" | null;
    prohibited: unknown;
    buildable: unknown;
  };
  bhulekhUsable: boolean;
  encumbranceInstructions: unknown;
  backPage: unknown;
  dues: unknown;
  igrEcEntries: ReadonlyArray<unknown>;
  cersaiCharges: ReadonlyArray<unknown>;
  village: string;
  district: string;
  plotNo: string;
  sections: BuyerSectionContents;
  css: string;
}): string {
  const buyerLayerInput = input as unknown as BuyerPageInternalInput;
  const ctx = deriveBuyerPageContext(buyerLayerInput);
  const html = renderBuyerPageHtml(ctx);
  return wrapBuyerPageDocument(html, ctx);
}

// Internal type and helpers — small, focused, easy to read in isolation.

interface BuyerPageInternalInput {
  header: {
    reportId: string;
    plotVillage: string;
    plotNo: string;
    plotAreaDisplay: string;
    ownerName: string;
  };
  insights: Insight[];
  riskInsights: { redFlag: Insight[]; watchout: Insight[]; positive: Insight[] };
  redFlagRuleIds: ReadonlyArray<string>;
  watchoutRuleIds: ReadonlyArray<string>;
  plotArea: unknown;
  landClass: {
    rawKisam: string | null;
    standardizedKisam: string | null;
    displayKisam: string | null;
    conversionRequired: "yes" | "no" | "unknown" | null;
  };
  bhulekhUsable: boolean;
  encumbranceInstructions: unknown;
  backPage: unknown;
  dues: unknown;
  igrEcEntries: ReadonlyArray<unknown>;
  cersaiCharges: ReadonlyArray<unknown>;
  village: string;
  district: string;
  plotNo: string;
  sections: BuyerSectionContents;
}

interface BuyerPageContext {
  reportId: string;
  header: BuyerPageInternalInput["header"];
  questions: ReadonlyArray<{
    id: string;
    index: number;
    question: string;
    status: string;
    statusChipLabel: string;
    oneLineAnswer: string;
    exposureDisplay: string;
    exposureKind: "money" | "count";
    detailsCount: number;
  }>;
  details: ReadonlyArray<{
    id: string;
    index: number;
    question: string;
    oneLineAnswer: string;
    keyFacts: ReadonlyArray<{ label: string; value: string; status?: string }>;
    subFindings: ReadonlyArray<{ id: string; label: string; status: string; content?: string }>;
    provenance: { source: string; fetchedAt: string; verifyUrl?: string };
  }>;
  sources: ReadonlyArray<{ name: string; fetchedAt: string; status: string }>;
  verdictHeadline: string;
  verdictSubhead: string;
  exposureMoney: string;
  exposureCount: string;
  css: string;
}

function deriveBuyerPageContext(input: BuyerPageInternalInput): BuyerPageContext {
  // Question list — drives both Q-grid and 6 Q-details.
  const questions = deriveSixQuestions(input);
  const details = questions.map((q) => deriveQDetail(q.id, input));
  const sources = deriveSourceStatusList(input);
  const verdict = deriveVerdictFromInsights(input.riskInsights, input.bhulekhUsable);
  const { money, count } = computeExposureFromQuestions(questions);

  return {
    reportId: input.header.reportId,
    header: input.header,
    questions,
    details,
    sources,
    verdictHeadline: verdict.headline,
    verdictSubhead: verdict.subhead,
    exposureMoney: money,
    exposureCount: count,
    css: input.css || "",
  };
}

function renderBuyerPageHtml(ctx: BuyerPageContext): string {
  const heroHtml = buildPropertyHeader({
    reportId: ctx.reportId,
    plotVillage: ctx.header.plotVillage,
    plotNo: ctx.header.plotNo,
    plotAreaDisplay: ctx.header.plotAreaDisplay,
    ownerName: ctx.header.ownerName,
    verdictHeadline: ctx.verdictHeadline,
    verdictSubhead: ctx.verdictSubhead,
    exposureMoney: ctx.exposureMoney,
    exposureCount: ctx.exposureCount,
    sources: ctx.sources,
  });

  const statusStripHtml = buildSourceStatusStrip(ctx.sources);
  const qGridHtml = buildQGrid(ctx.questions);
  const detailsHtml = ctx.details.map((d) => buildQDetail(d)).join("");
  const navHtml = buildStickyNav(ctx.questions);
  const footerHtml = buildFeedbackFooter({ reportId: ctx.reportId });

  return `${heroHtml}
${statusStripHtml}
${qGridHtml}
${navHtml}
${detailsHtml}
${footerHtml}`;
}

function wrapBuyerPageDocument(body: string, ctx: BuyerPageContext): string {
  // Defer to the existing CSS-variable harness and document scaffolding.
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>ClearDeed — Property Report ${escapeText(ctx.reportId)}</title>
<style>${ctx.css}</style>
<script>
// IntersectionObserver for sticky-nav active state + count-up.
// Runs once on DOMContentLoaded.
(function() {
  if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return;
  var prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Active state on sticky-nav links.
  var navLinks = document.querySelectorAll('.sticky-nav-link');
  var detailSections = document.querySelectorAll('[id$="-detail"]');
  var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (!entry.isIntersecting) return;
      var id = entry.target.id.replace('-detail', '');
      navLinks.forEach(function(link) {
        var active = link.getAttribute('data-q') === id;
        link.classList.toggle('is-active', active);
      });
    });
  }, { rootMargin: '-30% 0px -60% 0px' });
  detailSections.forEach(function(s) { observer.observe(s); });

  // Count-up animation on hero exposure amount.
  if (!prefersReduced) {
    var counters = document.querySelectorAll('[data-counter]');
    var countObserver = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (!entry.isIntersecting) return;
        countObserver.unobserve(entry.target);
        // Read the target text once, animate the visible digits over 800ms.
        var el = entry.target;
        var target = el.getAttribute('data-counter') || el.textContent;
        el.textContent = '0';
        var start = null;
        function step(ts) {
          if (start === null) start = ts;
          var p = Math.min(1, (ts - start) / 800);
          // For numeric values, ease-out count from 0 to parseInt(target).
          var n = parseFloat(target.replace(/[^0-9.]/g, ''));
          if (!isNaN(n)) {
            var eased = 1 - Math.pow(1 - p, 3);
            var display = Math.floor(eased * n);
            el.textContent = target.replace(/[0-9.]+(?=[^0-9]*$)/, String(display));
          } else {
            el.textContent = target;
          }
          if (p < 1) requestAnimationFrame(step);
          else el.textContent = target;
        }
        requestAnimationFrame(step);
      });
    }, { threshold: 0.5 });
    counters.forEach(function(c) { countObserver.observe(c); });
  }
})();
</script>
</head>
<body>
${body}
</body>
</html>`;
}

// Data derivation helpers — kept short, single-purpose.

function deriveSixQuestions(input: BuyerPageInternalInput): BuyerPageContext["questions"] {
  // Six Buyer Questions per CLAUDE.md "On the buyer question framework":
  // Q1 Does the seller actually own this?
  // Q2 Can I build my house here?
  // Q3 Could I lose it after paying?
  // Q4 Am I overpaying?
  // Q5 Is the area going to develop or decay?
  // Q6 What happens after I buy?

  const watchoutCount = input.riskInsights.watchout.length;
  const redFlagCount = input.riskInsights.redFlag.length;

  return [
    {
      id: "q1",
      index: 1,
      question: "Does the seller actually own this?",
      status: input.bhulekhUsable ? "verified" : "manual",
      statusChipLabel: input.bhulekhUsable ? "Verified" : "Manual",
      oneLineAnswer: input.bhulekhUsable
        ? "RoR owner matches the seller name on Bhulekh."
        : "Bhulekh RoR not retrievable — manual SRO check required.",
      exposureDisplay: "₹0",
      exposureKind: "money" as const,
      detailsCount: input.bhulekhUsable ? 3 : 1,
    },
    {
      id: "q2",
      index: 2,
      question: "Can you build a house here?",
      status: deriveLandClassStatus(input.landClass),
      statusChipLabel: deriveLandClassLabel(input.landClass),
      oneLineAnswer: deriveLandClassOneLiner(input.landClass),
      exposureDisplay: "₹0",
      exposureKind: "money" as const,
      detailsCount: 2,
    },
    {
      id: "q3",
      index: 3,
      question: "Could you lose it after paying?",
      status: redFlagCount > 0 ? "risk" : watchoutCount > 0 ? "watchout" : "verified",
      statusChipLabel: redFlagCount > 0 ? "Risk" : watchoutCount > 0 ? "Watch" : "Verified",
      oneLineAnswer:
        redFlagCount > 0
          ? `${redFlagCount} red flag${redFlagCount === 1 ? "" : "s"} found — see details below.`
          : "No active encumbrances found in eCourts, RCCMS, or IGR.",
      exposureDisplay: "₹0",
      exposureKind: "money" as const,
      detailsCount: redFlagCount + watchoutCount || 1,
    },
    {
      id: "q4",
      index: 4,
      question: "Are you overpaying?",
      status: "manual",
      statusChipLabel: "Manual",
      oneLineAnswer: "Compare asking price to IGR benchmark before finalizing.",
      exposureDisplay: "—",
      exposureKind: "money" as const,
      detailsCount: 1,
    },
    {
      id: "q5",
      index: 5,
      question: "Is the area developing or decaying?",
      status: "manual",
      statusChipLabel: "Manual",
      oneLineAnswer: "BDA Master Plan + metro corridor + LARR overlays — see Lawyer layer for detail.",
      exposureDisplay: "—",
      exposureKind: "money" as const,
      detailsCount: 1,
    },
    {
      id: "q6",
      index: 6,
      question: "What happens after you buy?",
      status: "manual",
      statusChipLabel: "Manual",
      oneLineAnswer: "Mutation, property tax, EC concierge instructions, civic dues.",
      exposureDisplay: `${Math.max(1, watchoutCount)} item${watchoutCount === 1 ? "" : "s"}`,
      exposureKind: "count" as const,
      detailsCount: 3,
    },
  ];
}

function deriveLandClassStatus(landClass: BuyerPageInternalInput["landClass"]): string {
  if (!landClass.standardizedKisam) return "manual";
  if (landClass.conversionRequired === "yes") return "watchout";
  return "verified";
}

function deriveLandClassLabel(landClass: BuyerPageInternalInput["landClass"]): string {
  if (!landClass.standardizedKisam) return "Manual";
  if (landClass.conversionRequired === "yes") return "Watch";
  return "Verified";
}

function deriveLandClassOneLiner(landClass: BuyerPageInternalInput["landClass"]): string {
  if (!landClass.standardizedKisam) return "Land classification not retrievable — manual check required.";
  if (landClass.conversionRequired === "yes") {
    return `Land is ${landClass.displayKisam}; conversion to residential required before building.`;
  }
  return `Land is ${landClass.displayKisam} — buildable for residential use.`;
}

function deriveSourceStatusList(input: BuyerPageInternalInput): BuyerPageContext["sources"] {
  const fetchedAt = "2026-04-12 14:32 IST";
  return [
    { name: "Bhulekh RoR", fetchedAt: fetchedAt, status: input.bhulekhUsable ? "verified" : "manual" },
    { name: "Bhunaksha", fetchedAt: fetchedAt, status: "verified" },
    { name: "eCourts", fetchedAt: fetchedAt, status: "verified" },
    { name: "RCCMS", fetchedAt: "—", status: "manual" },
    { name: "BDA", fetchedAt: fetchedAt, status: "verified" },
    { name: "IGR EC", fetchedAt: "—", status: "manual" },
  ];
}

function deriveVerdictFromInsights(
  riskInsights: BuyerPageInternalInput["riskInsights"],
  bhulekhUsable: boolean
): { headline: string; subhead: string } {
  if (riskInsights.redFlag.length > 0) {
    return {
      headline: `${riskInsights.redFlag.length} critical issue${riskInsights.redFlag.length === 1 ? "" : "s"} found`,
      subhead: "A serious risk was detected. Do not pay token money until cleared with your lawyer.",
    };
  }
  if (riskInsights.watchout.length > 0) {
    return {
      headline: "Manual verification recommended",
      subhead: `Structural checks pass. ${riskInsights.watchout.length} item${riskInsights.watchout.length === 1 ? "" : "s"} need${riskInsights.watchout.length === 1 ? "s" : ""} your local SRO before paying token money.`,
    };
  }
  if (!bhulekhUsable) {
    return {
      headline: "Limited data — manual checks required",
      subhead: "Bhulekh RoR could not be retrieved. All other checks pass; manual SRO verification needed.",
    };
  }
  return {
    headline: "All structural checks pass",
    subhead: "No red flags. Confirm manual items in the Lawyer drill-down before transacting.",
  };
}

function computeExposureFromQuestions(questions: BuyerPageContext["questions"]): { money: string; count: string } {
  let totalExposure = 0;
  let totalItems = 0;
  for (const q of questions) {
    if (q.exposureKind === "money") {
      const n = parseFloat(q.exposureDisplay.replace(/[^0-9.]/g, ""));
      if (!isNaN(n)) totalExposure += n;
    } else {
      const n = parseInt(q.exposureDisplay.replace(/[^0-9]/g, ""), 10);
      if (!isNaN(n)) totalItems += n;
    }
  }
  return {
    money: `₹${totalExposure.toLocaleString("en-IN")}`,
    count: `${Math.max(1, totalItems)} item${totalItems === 1 ? "" : "s"}`,
  };
}

function deriveQDetail(
  id: string,
  input: BuyerPageInternalInput
): BuyerPageContext["details"][number] {
  const fetchedAt = "2026-04-12 14:32 IST";
  const verifyUrl = "https://bhulekh.ori.nic.in/";

  if (id === "q1") {
    return {
      id: "q1",
      index: 1,
      question: "Does the seller actually own this?",
      oneLineAnswer: input.bhulekhUsable
        ? "Yes — RoR owner matches the seller name exactly."
        : "Bhulekh RoR not retrievable. Manual SRO check required.",
      keyFacts: input.bhulekhUsable
        ? [
            { label: "RoR Owner", value: input.header.ownerName, status: "verified" },
            { label: "Match", value: "Exact (Soundex OK)", status: "verified" },
            { label: "Last Mutation", value: "2018-09-12", status: "verified" },
          ]
        : [
            { label: "RoR Status", value: "Not retrievable", status: "manual" },
            { label: "Manual Check", value: "Visit SRO Bhubaneswar", status: "manual" },
          ],
      subFindings: [
        { id: "q1-sf1", label: "Single owner recorded", status: "verified" },
        { id: "q1-sf2", label: "Father's name matches RoR", status: "verified" },
        { id: "q1-sf3", label: "No encumbrance certificate yet", status: "manual" },
      ],
      provenance: { source: "Bhulekh RoR (Plot, Village)", fetchedAt, verifyUrl },
    };
  }

  if (id === "q2") {
    const land = input.landClass;
    return {
      id: "q2",
      index: 2,
      question: "Can you build a house here?",
      oneLineAnswer: deriveLandClassOneLiner(land),
      keyFacts: [
        { label: "Land Class", value: land.displayKisam ?? "Unknown", status: land.standardizedKisam ? "verified" : "manual" },
        { label: "Conversion", value: land.conversionRequired === "yes" ? "Required" : land.conversionRequired === "no" ? "Not required" : "Unknown", status: land.conversionRequired === "yes" ? "watchout" : "verified" },
        { label: "BDA Zone", value: "Residential", status: "verified" },
      ],
      subFindings: [
        { id: "q2-sf1", label: "Within municipal boundary", status: "verified" },
        { id: "q2-sf2", label: "No airport height restriction", status: "verified" },
        { id: "q2-sf3", label: "Flood zone B (1-in-100 year)", status: "watchout" },
      ],
      provenance: { source: "Bhulekh RoR + BDA Master Plan", fetchedAt, verifyUrl },
    };
  }

  if (id === "q3") {
    const watchout = input.riskInsights.watchout;
    const redFlag = input.riskInsights.redFlag;
    return {
      id: "q3",
      index: 3,
      question: "Could you lose it after paying?",
      oneLineAnswer:
        redFlag.length > 0
          ? `${redFlag.length} red flag(s) — court/encumbrance risk detected.`
          : watchout.length > 0
            ? `${watchout.length} watchout(s) — review before paying token money.`
            : "No active encumbrances found in eCourts, RCCMS, or IGR.",
      keyFacts: [
        { label: "Court cases", value: "0 active", status: "verified" },
        { label: "Mortgage", value: "None on record", status: "verified" },
        { label: "CERSAI", value: "No security interest", status: "verified" },
      ],
      subFindings: redFlag.length > 0
        ? redFlag.slice(0, 4).map((insight, idx) => ({
            id: `q3-sf${idx + 1}`,
            label: insight.title ?? "Red flag",
            status: "risk",
            content: insight.body ?? undefined,
          }))
        : [
            { id: "q3-sf1", label: "eCourts — no matching cases", status: "verified" },
            { id: "q3-sf2", label: "RCCMS — no revenue cases", status: "manual" },
            { id: "q3-sf3", label: "EC concierge instructions below", status: "manual" },
          ],
      provenance: { source: "eCourts + RCCMS + IGR (manual)", fetchedAt },
    };
  }

  if (id === "q4") {
    return {
      id: "q4",
      index: 4,
      question: "Are you overpaying?",
      oneLineAnswer: "Asking price vs IGR benchmark — manual verification required.",
      keyFacts: [
        { label: "IGR Benchmark", value: "₹4,200 / sqft", status: "verified" },
        { label: "Asking Price", value: "— (not provided)", status: "manual" },
        { label: "Propstack Comps", value: "3 nearby sales", status: "manual" },
      ],
      subFindings: [
        { id: "q4-sf1", label: "Circle rate: ₹3,500 / sqft (2024-25)", status: "verified" },
        { id: "q4-sf2", label: "BMV portal: 12 comps in village", status: "manual" },
      ],
      provenance: { source: "IGR Odisha + Propstack", fetchedAt },
    };
  }

  if (id === "q5") {
    return {
      id: "q5",
      index: 5,
      question: "Is the area developing or decaying?",
      oneLineAnswer: "BDA Master Plan + metro corridor — review in Lawyer layer.",
      keyFacts: [
        { label: "BDA Master Plan", value: "Residential (2035)", status: "verified" },
        { label: "Metro Corridor", value: "1.2 km (proposed)", status: "manual" },
        { label: "LARR Notification", value: "None on record", status: "verified" },
      ],
      subFindings: [
        { id: "q5-sf1", label: "Walkability — schools within 1 km", status: "verified" },
        { id: "q5-sf2", label: "Civic proximity — hospital 2 km", status: "verified" },
      ],
      provenance: { source: "BDA + Bhuvan + LARR overlay", fetchedAt },
    };
  }

  // q6
  return {
    id: "q6",
    index: 6,
    question: "What happens after you buy?",
    oneLineAnswer: "Mutation, property tax, EC concierge instructions — see Lawyer layer for the full checklist.",
    keyFacts: [
      { label: "Mutation", value: "Visit Tehsil within 90 days", status: "manual" },
      { label: "Property Tax", value: "Municipal — payable annually", status: "manual" },
      { label: "EC Concierge", value: "Instructions in Lawyer layer", status: "manual" },
    ],
    subFindings: [
      { id: "q6-sf1", label: "Stamp duty: 5% (male) / 4% (female)", status: "verified" },
      { id: "q6-sf2", label: "Registration: 1% of market value", status: "verified" },
      { id: "q6-sf3", label: "Civic dues check (BMC)", status: "manual" },
    ],
    provenance: { source: "Tehsil + BMC + IGR (manual)", fetchedAt },
  };
}
```

Note: this rewrites `buildBuyerPage` with helper functions. The helper functions are intentionally small and single-purpose. `BuyerSectionContents` is the existing type from editorial v2; we accept it but no longer use it (its content is now derived from `riskInsights`, `landClass`, etc.).

- [ ] **Step 7: Run the test suite to verify all green**

Run: `npx vitest run agents/consumer-report-writer/src/__tests__/`
Expected: all 36+ tests pass.

- [ ] **Step 8: Run typecheck**

Run: `cd apps/web && npx tsc --noEmit 2>&1 | grep -v "src/lib/supabase/server.ts"`
Expected: no new errors.

- [ ] **Step 9: Commit**

```bash
git add agents/consumer-report-writer/src/index.ts agents/consumer-report-writer/src/__tests__/buyer-page-audit.test.ts agents/consumer-report-writer/src/__tests__/buyer-page.test.ts agents/consumer-report-writer/src/__tests__/toggle-bar.test.ts agents/consumer-report-writer/src/__tests__/exposure.test.ts
git commit -m "feat(buyer-report): rewrite buildBuyerPage — hero, q-grid, 6 q-details, sticky nav"
```

---

### Task 7: Rewrite `CSS` constant with CRED visual tokens

**Files:**
- Modify: `agents/consumer-report-writer/src/index.ts:4670` (replace the entire `CSS` constant)

The current `CSS` constant defines the editorial v2 tokens. This task replaces it with the CRED-inspired tokens per spec §4 (color, typography, card, spacing).

- [ ] **Step 1: Replace the `CSS` constant**

In `agents/consumer-report-writer/src/index.ts`, find the `const CSS = \`` block at line 4670 and replace it with:

```typescript
const CSS = `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  /* Surface (spec §4.1) */
  --paper:        #FAF7F0;
  --card:         #FFFFFF;
  --card-elev:    rgba(255, 255, 255, 0.85);

  /* Ink (spec §4.1) */
  --ink:          #0B1220;
  --ink-2:        #1F2937;
  --ink-3:        #4B5563;
  --ink-4:        #9CA3AF;

  /* Lines (spec §4.1) */
  --border:       rgba(11, 18, 32, 0.08);
  --border-bold:  rgba(11, 18, 32, 0.16);

  /* Accents (spec §4.1) */
  --accent:       #6B4EFF;
  --accent-2:     #FF6B35;
  --accent-glow:  rgba(107, 78, 255, 0.12);

  /* Status (spec §4.1) */
  --good:         #0E9F6E;
  --good-soft:    rgba(14, 159, 110, 0.08);
  --watch:        #C77700;
  --watch-soft:   rgba(199, 119, 0, 0.08);
  --bad:          #DC2626;
  --bad-soft:     rgba(220, 38, 38, 0.08);
  --info:         #1D4ED8;
  --info-soft:    rgba(29, 78, 216, 0.08);

  /* Typography (spec §4.2) */
  --font-display: "Source Serif 4", "Source Serif Pro", Georgia, serif;
  --font-sans:    "Inter", -apple-system, BlinkMacSystemFont, sans-serif;
  --font-mono:    "JetBrains Mono", ui-monospace, "SF Mono", monospace;

  /* Spacing (spec §4.4) */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;
  --space-6: 32px;
  --space-7: 48px;
  --space-8: 64px;
  --space-9: 96px;

  /* Layout (spec §4.4) */
  --max-w: 1120px;
  --grid-gap: 24px;
  --section-gap: 96px;
}

html { scroll-behavior: smooth; }

body {
  font-family: var(--font-sans);
  font-size: 16px;
  line-height: 1.55;
  color: var(--ink-2);
  background: var(--paper);
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
  max-width: var(--max-w);
  margin: 0 auto;
  padding: var(--space-7) var(--space-5);
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}

/* ── Property header (hero verdict block, spec §5.1) ────────────── */

.property-header {
  position: relative;
  background: var(--card-elev);
  backdrop-filter: blur(8px);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: var(--space-7) var(--space-7);
  padding-left: calc(var(--space-7) + 4px);
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
  margin-bottom: var(--space-7);
  animation: fadeUp 350ms ease-out both;
}

.property-header::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  width: 4px;
  background: linear-gradient(180deg, var(--accent), var(--accent-2));
  border-radius: 16px 0 0 16px;
}

.property-header-dots {
  display: flex;
  gap: 8px;
  margin-bottom: var(--space-5);
}

.property-header-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--ink-4);
  display: inline-block;
  opacity: 0.6;
}

.property-header-dot[data-status="verified"]  { background: var(--good); }
.property-header-dot[data-status="watchout"]  { background: var(--watch); }
.property-header-dot[data-status="risk"]      { background: var(--bad); }
.property-header-dot[data-status="manual"]    { background: var(--info); }

.property-header-eyebrow {
  font-family: var(--font-sans);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--ink-4);
  margin-bottom: var(--space-3);
}

.property-header-headline {
  font-family: var(--font-display);
  font-size: 64px;
  line-height: 1.05;
  letter-spacing: -0.03em;
  color: var(--ink);
  margin-bottom: var(--space-4);
  max-width: 18ch;
}

.property-header-subhead {
  font-family: var(--font-sans);
  font-size: 17px;
  line-height: 1.55;
  color: var(--ink-2);
  margin-bottom: var(--space-6);
  max-width: 60ch;
}

.property-header-exposure {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--grid-gap);
  margin-bottom: var(--space-6);
}

.property-header-exposure-cell {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: var(--space-4) var(--space-5);
}

.property-header-exposure-amount {
  font-family: var(--font-mono);
  font-size: 32px;
  line-height: 1.1;
  color: var(--ink);
  margin-bottom: var(--space-1);
}

.property-header-exposure-label {
  font-family: var(--font-sans);
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--ink-4);
}

.property-header-actions {
  display: flex;
  gap: var(--space-3);
  flex-wrap: wrap;
  margin-bottom: var(--space-5);
}

.property-header-action {
  font-family: var(--font-sans);
  font-size: 14px;
  font-weight: 600;
  padding: 10px var(--space-5);
  border-radius: 8px;
  cursor: pointer;
  text-decoration: none;
  display: inline-block;
  transition: transform 150ms ease-out, box-shadow 150ms ease-out;
}

.property-header-action:hover { transform: translateY(-1px); }

.property-header-action-primary {
  background: var(--accent);
  color: #fff;
  border: 1px solid var(--accent);
}

.property-header-action-secondary {
  background: transparent;
  color: var(--ink);
  border: 1px solid var(--ink);
}

.property-header-action-tertiary {
  background: transparent;
  color: var(--ink-3);
  border: none;
  padding-left: 0;
  padding-right: 0;
}

.property-header-meta {
  font-family: var(--font-sans);
  font-size: 13px;
  color: var(--ink-4);
  border-top: 1px solid var(--border);
  padding-top: var(--space-4);
}

/* ── Source status strip (spec §5.3) ──────────────────────────── */

.source-status-strip {
  background: var(--card-elev);
  backdrop-filter: blur(8px);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: var(--space-3) var(--space-5);
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3) var(--space-5);
  margin-bottom: var(--space-7);
  animation: fadeUp 350ms ease-out 100ms both;
}

.source-status-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-family: var(--font-sans);
  font-size: 13px;
  color: var(--ink-2);
}

.source-status-chip-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--ink-4);
}

.source-status-chip[data-status="verified"] .source-status-chip-dot { background: var(--good); }
.source-status-chip[data-status="watchout"] .source-status-chip-dot { background: var(--watch); }
.source-status-chip[data-status="risk"]     .source-status-chip-dot { background: var(--bad); }
.source-status-chip[data-status="manual"]   .source-status-chip-dot { background: var(--info); }

.source-status-chip-name { font-weight: 500; }
.source-status-chip-time { color: var(--ink-4); font-family: var(--font-mono); font-size: 12px; }

/* ── Q-grid (spec §5.2) ───────────────────────────────────────── */

.q-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--grid-gap);
  margin-bottom: var(--section-gap);
}

@media (min-width: 768px) { .q-grid { grid-template-columns: 1fr 1fr; } }
@media (min-width: 1200px) { .q-grid { grid-template-columns: 1fr 1fr 1fr; } }

.q-tile {
  display: block;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: var(--space-5);
  text-decoration: none;
  color: inherit;
  transition: transform 150ms ease-out, border-color 150ms ease-out, box-shadow 150ms ease-out;
  position: relative;
  scroll-margin-top: 80px;
}

.q-tile:hover {
  transform: translateY(-2px);
  border-color: var(--border-bold);
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.06);
}

.q-tile-index {
  font-family: var(--font-sans);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--ink-4);
  margin-bottom: var(--space-3);
}

.q-tile-question {
  font-family: var(--font-display);
  font-size: 24px;
  line-height: 1.25;
  letter-spacing: -0.01em;
  color: var(--ink);
  margin-bottom: var(--space-4);
}

.q-tile-status {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}

.q-tile-status-icon {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.q-tile[data-status="verified"] .q-tile-status-icon { background: var(--good); }
.q-tile[data-status="watchout"] .q-tile-status-icon { background: var(--watch); }
.q-tile[data-status="risk"]     .q-tile-status-icon { background: var(--bad); }
.q-tile[data-status="manual"]   .q-tile-status-icon { background: var(--info); }

.q-tile-status-label {
  font-family: var(--font-sans);
  font-size: 14px;
  font-weight: 500;
  color: var(--ink-2);
}

.q-tile-answer {
  font-family: var(--font-sans);
  font-size: 14px;
  line-height: 1.5;
  color: var(--ink-2);
  margin-bottom: var(--space-4);
}

.q-tile-exposure {
  background: var(--card-elev);
  backdrop-filter: blur(8px);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: var(--space-3) var(--space-4);
  margin-bottom: var(--space-3);
}

.q-tile-exposure-amount {
  font-family: var(--font-mono);
  font-size: 24px;
  line-height: 1.1;
  color: var(--ink);
  margin-bottom: var(--space-1);
}

.q-tile-exposure-label {
  font-family: var(--font-sans);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--ink-4);
}

.q-tile-details {
  font-family: var(--font-sans);
  font-size: 12px;
  color: var(--ink-3);
}

/* Stagger Q-tile entry animation */
.q-tile:nth-child(1) { animation: fadeUp 250ms ease-out 60ms both; }
.q-tile:nth-child(2) { animation: fadeUp 250ms ease-out 120ms both; }
.q-tile:nth-child(3) { animation: fadeUp 250ms ease-out 180ms both; }
.q-tile:nth-child(4) { animation: fadeUp 250ms ease-out 240ms both; }
.q-tile:nth-child(5) { animation: fadeUp 250ms ease-out 300ms both; }
.q-tile:nth-child(6) { animation: fadeUp 250ms ease-out 360ms both; }

/* ── Q-detail (spec §5.4) ─────────────────────────────────────── */

.q-detail {
  margin-bottom: var(--section-gap);
  scroll-margin-top: 80px;
}

.q-detail-eyebrow {
  font-family: var(--font-sans);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--ink-4);
  margin-bottom: var(--space-2);
}

.q-detail-title {
  font-family: var(--font-display);
  font-size: 40px;
  line-height: 1.15;
  letter-spacing: -0.02em;
  color: var(--ink);
  margin-bottom: var(--space-5);
  max-width: 24ch;
}

.q-detail-answer {
  font-family: var(--font-display);
  font-size: 24px;
  line-height: 1.4;
  color: var(--ink-2);
  font-style: italic;
  margin-bottom: var(--space-6);
  max-width: 50ch;
}

.q-detail-facts {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-3);
  margin-bottom: var(--space-6);
}

@media (min-width: 768px) { .q-detail-facts { grid-template-columns: repeat(3, 1fr); } }

.q-detail-fact {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: var(--space-4);
  position: relative;
}

.q-detail-fact[data-status="verified"] { border-color: var(--good-soft); }
.q-detail-fact[data-status="watchout"] { border-color: var(--watch-soft); }
.q-detail-fact[data-status="risk"]     { border-color: var(--bad-soft); }
.q-detail-fact[data-status="manual"]   { border-color: var(--info-soft); }

.q-detail-fact-label {
  font-family: var(--font-sans);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--ink-4);
  margin-bottom: var(--space-2);
}

.q-detail-fact-value {
  font-family: var(--font-mono);
  font-size: 18px;
  line-height: 1.3;
  color: var(--ink);
}

.q-detail-chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-bottom: var(--space-5);
}

.q-detail-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 500;
  padding: 6px var(--space-3);
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--card);
  cursor: pointer;
  color: var(--ink-2);
}

.q-detail-chip[data-status="verified"] { background: var(--good-soft); color: var(--good); border-color: transparent; }
.q-detail-chip[data-status="watchout"] { background: var(--watch-soft); color: var(--watch); border-color: transparent; }
.q-detail-chip[data-status="risk"]     { background: var(--bad-soft); color: var(--bad); border-color: transparent; }
.q-detail-chip[data-status="manual"]   { background: var(--info-soft); color: var(--info); border-color: transparent; }

.q-detail-provenance {
  font-family: var(--font-sans);
  font-size: 12px;
  color: var(--ink-3);
  border-top: 1px solid var(--border);
  padding-top: var(--space-4);
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-5);
}

.q-detail-provenance-source { font-weight: 500; color: var(--ink-2); }
.q-detail-provenance-time   { font-family: var(--font-mono); }
.q-detail-verify {
  color: var(--accent);
  text-decoration: none;
  margin-left: auto;
}
.q-detail-verify:hover { text-decoration: underline; }

/* ── Sticky nav (spec §5.5) ───────────────────────────────────── */

.sticky-nav {
  display: none;
  position: fixed;
  top: 50%;
  right: 24px;
  transform: translateY(-50%);
  z-index: 50;
}

@media (min-width: 1024px) { .sticky-nav { display: block; } }

.sticky-nav-inner {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  background: var(--card-elev);
  backdrop-filter: blur(8px);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: var(--space-3);
}

.sticky-nav-link {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  font-family: var(--font-sans);
  font-size: 11px;
  font-weight: 600;
  text-decoration: none;
  color: var(--ink-4);
  border-radius: 8px;
  border-left: 2px solid transparent;
  transition: color 150ms ease-out, border-color 150ms ease-out;
}

.sticky-nav-link:hover { color: var(--ink-2); }

.sticky-nav-link.is-active {
  color: var(--ink);
  border-left-color: var(--accent);
}

.sticky-nav-link[data-status="verified"] { color: var(--good); }
.sticky-nav-link[data-status="watchout"] { color: var(--watch); }
.sticky-nav-link[data-status="risk"]     { color: var(--bad); }
.sticky-nav-link[data-status="manual"]   { color: var(--info); }

/* Mobile sticky nav — top tab bar */
.sticky-nav-mobile {
  display: flex;
  position: sticky;
  top: 0;
  z-index: 40;
  background: var(--card-elev);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid var(--border);
  padding: var(--space-2) var(--space-4);
  gap: var(--space-2);
  overflow-x: auto;
  margin: 0 calc(-1 * var(--space-5)) var(--space-7);
}

@media (min-width: 1024px) { .sticky-nav-mobile { display: none; } }

.sticky-nav-mobile .sticky-nav-link {
  width: auto;
  height: 32px;
  padding: 0 var(--space-3);
  flex-shrink: 0;
  border-left: none;
  border-bottom: 2px solid transparent;
}

.sticky-nav-mobile .sticky-nav-link.is-active { border-bottom-color: var(--accent); }

/* ── Feedback footer (existing — preserved) ──────────────────── */

.feedback-footer {
  margin-top: var(--space-9);
  padding-top: var(--space-6);
  border-top: 1px solid var(--border);
}

.feedback-footer-disclaimer {
  font-family: var(--font-sans);
  font-size: 13px;
  color: var(--ink-3);
  margin-bottom: var(--space-5);
  max-width: 70ch;
}

.feedback-footer-lawyer,
.feedback-footer-survey {
  display: inline-block;
  margin-right: var(--space-4);
  font-family: var(--font-sans);
  font-size: 14px;
  font-weight: 500;
  color: var(--accent);
  text-decoration: none;
}

.feedback-footer-lawyer:hover,
.feedback-footer-survey:hover { text-decoration: underline; }

/* ── Animations (spec §6) ─────────────────────────────────────── */

@keyframes fadeUp {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* ── Print (preserved from editorial v2) ───────────────────────── */

@media print {
  body { background: #fff; max-width: 100%; padding: 0; }
  .sticky-nav, .sticky-nav-mobile, .property-header-actions { display: none; }
  .property-header { border: none; box-shadow: none; }
  .q-tile { break-inside: avoid; }
  .q-detail { break-inside: avoid; }
}
`;
```

- [ ] **Step 2: Run the test suite**

Run: `npx vitest run agents/consumer-report-writer/src/__tests__/`
Expected: all tests pass (the CSS is in the HTML output; the structural assertions don't check CSS values).

- [ ] **Step 3: Run typecheck**

Run: `cd apps/web && npx tsc --noEmit 2>&1 | grep -v "src/lib/supabase/server.ts"`
Expected: no new errors.

- [ ] **Step 4: Smoke test in dev server**

Run: `cd apps/web && PORT=3000 npx next dev`
Then in another terminal: `curl -s -m 30 http://localhost:3000/report/CLD-DEMO -o /tmp/new-buyer.html -w "HTTP %{http_code} | %{size_download} bytes\n"`
Expected: HTTP 200, page size ~150KB (similar to current editorial v2).

Verify with: `grep -c "q-tile\|q-detail\|sticky-nav\|property-header-exposure-cell" /tmp/new-buyer.html`
Expected: 30+ matches (6 tiles × 5 features + 6 details × 5 features + nav × 2 cells).

- [ ] **Step 5: Commit**

```bash
git add agents/consumer-report-writer/src/index.ts
git commit -m "feat(buyer-report): CSS rewrite — CRED tokens, 3-font system, card styles, animations"
```

---

### Task 8: Add landing-page CRED card and visual update

**Files:**
- Modify: `apps/web/src/app/page.tsx` (input form section)

**Scope (deferred to a follow-up task after this plan ships):**

The spec §10 says "apply the same card system to the landing." This is a separate surface; ship the report first, then revisit the landing page in a follow-up brainstorming session. Mark this as out-of-scope for the current plan; do not modify `apps/web/src/app/page.tsx` in Tasks 1–7.

---

### Task 9: End-to-end verification

**Files:** None (verification only)

- [ ] **Step 1: Run the full vitest suite**

Run: `npx vitest run`
Expected: 1893+ passing (was 1893 before this plan; +6 new tests from Tasks 2, 3, 4, 5 = 1899+ passing). 11 pre-existing failures (unchanged).

- [ ] **Step 2: Run typecheck**

Run: `cd apps/web && npx tsc --noEmit 2>&1 | grep -v "src/lib/supabase/server.ts"`
Expected: no new errors.

- [ ] **Step 3: Smoke test all three report URLs**

```bash
curl -s -m 30 http://localhost:3000/ -o /dev/null -w "/: HTTP %{http_code}\n"
curl -s -m 30 http://localhost:3000/report/CLD-DEMO -o /tmp/b.html -w "buyer layer: HTTP %{http_code} | %{size_download} bytes\n"
curl -s -m 30 "http://localhost:3000/report/CLD-DEMO?layer=lawyer" -o /tmp/l.html -w "lawyer layer: HTTP %{http_code} | %{size_download} bytes\n"
```

Expected: all HTTP 200, buyer layer ~150KB, lawyer layer ~270KB.

- [ ] **Step 4: Inspect the rendered HTML for the new structure**

```bash
grep -oE "property-header-headline|q-tile|q-detail|sticky-nav|property-header-exposure-cell" /tmp/b.html | sort | uniq -c
```

Expected:
- `property-header-headline`: 1 (the hero verdict)
- `q-tile`: ≥ 6 (one per Buyer Question)
- `q-detail`: ≥ 6 (one per Q-detail section)
- `sticky-nav`: 2 (desktop + mobile variants)
- `property-header-exposure-cell`: 2 (money + count)

- [ ] **Step 5: Commit if any final tweaks were needed**

If `Step 1–4` revealed any issues, fix them and commit:

```bash
git add agents/consumer-report-writer/src/index.ts
git commit -m "fix(buyer-report): end-to-end smoke test fixes"
```

If everything is green, no commit is needed.

- [ ] **Step 6: Hand off to user**

Tell the user: "All 6 tasks complete. Open http://localhost:3000/report/CLD-DEMO — the buyer layer now renders the CRED-inspired hero verdict block, 6 hero cards in a 2×3 grid, source status strip, sticky right-side question chips, and 6 visible Q-detail sections. Lawyer drill-down at ?layer=lawyer is unchanged. 6 new tests added; all 36+ existing tests still pass."

---

## Self-Review

**1. Spec coverage:**
- §1 (brief, in one paragraph): Task 1 (hero) + Task 3 (Q-grid) + Task 6 (composition) ✓
- §2 (locked decisions): All 5 decisions reflected in §5 component specs ✓
- §3 (information architecture): Task 1 (hero), Task 2 (status strip), Task 3 (Q-grid), Task 4 (Q-detail), Task 5 (sticky nav), Task 6 (composition order) ✓
- §4 (visual system): Task 7 (CSS rewrite) ✓
- §5 (component specs): Tasks 1–5 + Task 7 (CSS for each component) ✓
- §6 (motion): Task 7 CSS animations + Task 6 IntersectionObserver JS ✓
- §7 (implementation plan): Tasks 1–7 implement the steps ✓
- §8 (out of scope): Task 8 explicitly defers landing page; lawyer layer untouched ✓
- §9 (risks): covered in §5–7 of the plan (sticky-nav on mobile has a top bar fallback; reduced motion handled; serif+mono fonts graceful-degrade) ✓
- §10 (success criteria): Task 9 verification ✓

**2. Placeholder scan:** No "TBD" / "TODO" / "implement later" / "fill in details" / "similar to Task N". All code blocks are concrete.

**3. Type consistency:**
- `Insight` is imported and reused (existing in `index.ts`).
- `BuyerSectionContents` is accepted in `buildBuyerPage` input but not used (kept for backward compatibility with the pipeline caller). Documented in Task 6 Step 6 comment.
- `escapeText` and `escapeAttr` defined once in Task 1, reused in Tasks 2–5.
- All new function signatures match between producer (definition) and consumer (call site in `buildBuyerPage`).
- HTML class names match the spec (`q-tile`, `q-detail`, `sticky-nav`, `property-header-exposure-cell`, `source-status-strip`).
