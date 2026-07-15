# PI: Report Shell Redesign
**Duration**: 10 working days
**Cadence**: V1.1 sprint convention (focused, single-builder, fail-loud on scope creep)
**Theme**: React-native report viewer · light-theme token unification · interactive plot map · document bundle
**PI Objective**: The report — not the pipeline — is the product. By end of PI, the report renders as a real React component tree styled with the same Tailwind token system as the rest of the app, ships an interactive plot map inside the Q1 panel, and exposes a document download bundle for the Layer 2 lawyer view.

---

## Context (read before starting)

The report view at `apps/web/src/app/report/[id]/page.tsx` currently renders a single `dangerouslySetInnerHTML` blob — a raw HTML string emitted by `agents/consumer-report-writer/src/index.ts`. That string carries its own inlined CSS (built in `theme.ts` + `deriveBuyerPageContext`), using a **separate** custom-property palette:
- Agent CSS: `#0A0E14` bg, `#11161F` surface, `#C9A961` gold — dark premium-legal-document feel
- Web app: `#f7f7f2` bg, `#163d33` primary, `#1d6f5b` accent — light Tailwind layer

The plot diagram SVG is uploaded to Supabase Storage by the pipeline and surfaced as a plain `<img>` inside the report HTML. The interactive `MapboxBoundaryMap` component already exists but is only wired into the form's success state — never the report page.

This PI resolves all three at once.

---

## Out of Scope (write a new task before touching these)

- Any new data source fetcher (Bhulekh-only V1.1 sprint)
- IGR deep-link / concierge work (T-046)
- Bhuvan flood WMS (T-041)
- LARR acquisition (T-042)
- Circle rate / Propstack comps
- Verification feedback loop (T-060 survey automation)
- Native mobile app
- PDF renderer changes (kept intact; bundled artifact only)

Scope creep rule (per CLAUDE.md §3): if a change expands mid-sprint, stop, write it as a new task in Section 4, and ask whether to continue or defer.

---

## Sprint 0: Prep · Day 0 (half-day)

**Objective**: Lock the component tree shape, token palette, and interface contracts before any code is written.

### Tasks

1. **Lock report component hierarchy**
   - Read current agent builders: `buildBuyerPage`, `buildQGrid`, `buildQDetail`, `buildFinancialExposureSummary`, `buildPropertyHeader`, `buildSourceAuditPanel`, `buildFeedbackFooter` in `agents/consumer-report-writer/src/index.ts`
   - Read current page shell: `apps/web/src/app/report/[id]/page.tsx`
   - Read MapboxBoundaryMap: `apps/web/src/components/MapboxBoundaryMap.tsx`
   - Read `bhunakshaPolygon` / `plotDiagram` data shape in pipeline output (`apps/web/src/lib/pipeline/contracts/bhunaksha-plot-report.ts`)
   - Draft the component tree and confirm it as the implementation target
   - **Deliverable**: documented component tree (in-memory, not committed) with file paths

2. **Lock token palette**
   - Confirm: use existing Tailwind brand tokens (`#163d33`, `#1d6f5b`, `#f7f7f2`, `#17231d`, `#8a5f1d`) for everything — backgrounds, text, borders, accents
   - Confirm: agent's `--cd-*` dark-theme tokens are migrated to the light palette (Option A from assessment)
   - Confirm: verdict-card severity colors remain (red/amber/green/blue) but with light-theme backgrounds (rose/amber/emerald/sky 50–100) instead of the current dark strips
   - **Deliverable**: palette spec in this doc (already locked above; no new decision needed)

3. **Lock interface contracts**
   - Confirm: `PipelineOutput.html` is still emitted as a fallback for the lawyer layer (Layer 2) — the buyer layer (Layer 1) becomes React-native but the old HTML path is preserved as the "Lawyer's Drill-Down" view
   - Confirm: new shape `ReportBuyerView` exported from `agents/consumer-report-writer/src/report-data.ts` (JSON-serializable, no HTML) — this is the data that Layer 1 React components consume
   - Confirm: `bhunakshaPolygon` and `plotDiagram` are already present in `PipelineOutput` — no pipeline changes needed

### Acceptance Criteria
- [ ] Component tree is documented and reviewed
- [ ] Token palette is confirmed (light theme, brand tokens)
- [ ] Data shape for Layer 1 is locked (JSON, no HTML)
- [ ] No pipeline changes are required
- [ ] Out-of-scope list is confirmed

---

## Sprint 1: Report Shell + Plot Map · Days 1–3

**Objective**: Replace the `dangerouslySetInnerHTML` shell with a real React component tree, wire the interactive plot map into the Q1 panel, and render `plotDiagram` as a proper React component.

### Day 1 — Shell + Status

1. **Create `ReportShell.tsx`** at `apps/web/src/app/report/[id]/ReportShell.tsx`
   - Server component wrapper: loads report + renders `ReportUnavailable` / `ReportExpired` / `LiveReportShell` based on state
   - Passes `report` (title, status, expiry, access token, sourceSummary) + `pipelineOutput` to the client layer
   - Replaces the current top-level switch in `page.tsx`
   - Accepts a `layer` prop: `"buyer" | "lawyer"` — toggles between the new React-native Layer 1 and the existing HTML blob Layer 2

2. **Create `ReportToolbarClient.tsx`** (enhance the existing one)
   - Layer toggle: "Buyer's Read" / "Lawyer's Drill-Down"
   - Print button (already exists; keep as-is)
   - Download PDF button (already exists; keep as-is)
   - New: "Download Documents" button — calls `/api/report/[id]/bundle` (Sprint 3 scope, wire the button now, the API is built in Sprint 3)

3. **Convert `ReportUnavailable.tsx` and `ReportExpired.tsx` to real components**
   - Currently: inline `style=` objects on `<main>` / `<section>`
   - New: Tailwind utility classes using the brand palette
   - Move from inline in `page.tsx` to separate files

### Day 2 — Section Compositors

4. **Create section components** (all in `apps/web/src/app/report/[id]/components/`):
   - `PropertyHeader.tsx` — plot/owner summary strip
   - `VerdictCard.tsx` — top verdict/eyebrow banner (severity-strip color: red/amber/green/blue from Tailwind)
   - `ExposureStrip.tsx` — "what's at risk" strip
   - `QuestionTile.tsx` — one of the six Q-tiles (collapsible, severity-aware)
   - `QuestionPanel.tsx` — the expanded detail inside a Q-tile (Q1 = owner + plot map)
   - `FinancialExposureSummary.tsx` — ₹ exposure table with severity badges
   - `ProvenanceStrip.tsx` — per-source status/provenance
   - `FeedbackFooter.tsx` — report id, disclaimer, lawyer-layer link, survey link

5. **Create `ReportBody.tsx`** (server component in `apps/web/src/app/report/[id]/`)
   - Composes the sections above in buyer's-read order
   - Reads `pipelineOutput.insights` (already present) to populate each section
   - No HTML string — pure React element tree

### Day 3 — Plot Map

6. **Create `PlotMap.tsx`** at `apps/web/src/app/report/[id]/components/PlotMap.tsx`
   - Wraps existing `MapboxBoundaryMap` with report-specific props
   - Reads `pipelineOutput.bhunakshaPolygon` and `pipelineOutput.plotDiagram` from the loaded report
   - Size: ~400px tall (collapsible on mobile at <640px)
   - Shows: highlighted plot polygon, adjacent plot number/area labels (from WFS features), seller's claimed boundary vs. Bhunaksha polygon overlay (when both are available)
   - Plot-diagram SVG rendered as a real `<img>` with `src={plotDiagram.url}` — no `dangerouslySetInnerHTML`

7. **Wire `PlotMap` into `QuestionPanel.tsx` Q1 (ownership)**
   - Q1 panel: "Does the seller actually own this?"
   - Show owner table (from RoR) above the map
   - Show plot map below the owner table, inside the same collapsible panel
   - On plot-diagram absent (Bhulekh partial failure), render a degraded-state message: "Plot boundary not available for this report — Bhulekh data incomplete"

### Day 3 End-State Check
- `page.tsx` no longer contains a `dangerouslySetInnerHTML` call for buyer layer
- Layer 1 (Buyer's Read) is a React component tree
- Layer 2 (Lawyer's Drill-Down) is the existing `pipelineOutput.html` string rendered as before
- Map is interactive inside the Q1 panel

### Sprint 1 Acceptance Criteria
- [ ] `/report/[id]?layer=buyer` renders a React component tree (inspect DOM: no `<style>` injected by `dangerouslySetInnerHTML` in the body)
- [ ] `/report/[id]?layer=lawyer` renders the existing HTML blob unchanged
- [ ] Q1 panel contains an interactive `MapboxBoundaryMap` showing the plot polygon when `bhunakshaPolygon` is present
- [ ] Adjacent plot numbers/areas are visible on the map
- [ ] Plot diagram SVG is rendered as `<img src=...>` when `plotDiagram.url` is present
- [ ] Degraded state message appears when polygon/diagram is missing
- [ ] `ReportUnavailable` and `ReportExpired` use Tailwind classes (inspect computed styles — no inline `background`, no inline `color`)
- [ ] All existing tests still pass (no test regressions from shell refactor)

---

## Sprint 2: Token Migration · Days 4–6

**Objective**: Migrate the agent's `theme.ts` CSS from the dark `#0A0E14` palette to the light brand palette, unify the report with the rest of the app.

### Day 4 — Token Architecture

1. **Create `agents/consumer-report-writer/src/report-tokens.ts`**
   - Export a `LIGHT_THEME_TOKENS` record: every `--cd-*` token gets a `#f7f7f2` / `#163d33` / `#1d6f5b` / `#17231d` / `#8a5f1d` value
   - Maintain backward-compat aliases: old `--paper / --ink / --accent` names → new values (current `theme.ts` already does this; replicate in the new file)
   - Export `VERDICT_COLORS`: red → rose-50 border + rose-100 bg + rose-700 text, amber → amber-50/100/700, green → emerald-50/100/700, blue → sky-50/100/700
   - Each color maps to three Tailwind-equivalent values: `bg`, `border`, `text`

2. **Create `agents/consumer-report-writer/src/report-theme.ts`**
   - Emit a CSS string using the new tokens — `.buyer-page { background: var(--cd-bg); ... }` etc.
   - Replace the existing inlined `ctx.css` block in `theme.ts` with a call to this new emitter
   - Old `theme.ts` is deprecated (not deleted — leave it in place during migration for rollback)

### Day 5 — Section Builders

3. **Migrate `buildPropertyHeader`** in `index.ts`
   - Replace hardcoded `#0A0E14` references with token references
   - Verify: header background = `#f7f7f2`, text = `#17231d`, border = `#d9ddd4`

4. **Migrate `buildVerdictCard` and `buildExposureStrip`**
   - Severity strip: replace dark gradient with light-theme border-left + bg tint
   - Verify verdict colors match Tailwind rose/amber/emerald/sky scale

5. **Migrate `buildQGrid` and `buildQDetail`**
   - Tile backgrounds: `#ffffff` with `border-[#d9ddd4]`
   - Collapsed state: `#f7f7f2` bg
   - Expanded state: `#ffffff` bg
   - Severity dot: use the new verdict colors

### Day 6 — Financial + Provenance + Footer

6. **Migrate `buildFinancialExposureSummary`**
   - Table rows: `border-b border-[#d9ddd4]`
   - Severity badges: rose/amber/emerald/sky 100 bg + 700 text
   - ₹ amounts: `#17231d` text, bold
   - "Verified clear" line: emerald-100 bg + emerald-800 text

7. **Migrate `buildSourceAuditPanel` and `buildFeedbackFooter`**
   - Source status badges: emerald (verified) / amber (manual_required) / rose (skipped_dormant) / stone (not_covered)
   - Footer: `#f7f7f2` bg, `#17231d` text, `border-t border-[#d9ddd4]`

8. **Run visual regression check**
   - Regenerate the golden-path report (`scripts/golden-path.ts` or via the `/report/demo` route)
   - Capture a screenshot of the new report and compare against the old one
   - Verify: no `#0A0E14` values remain in the rendered output, all text is legible on `#f7f7f2` bg
   - Verify: verdict-card colors still convey severity correctly

### Sprint 2 Acceptance Criteria
- [ ] No `#0A0E14` or `#11161F` values in the agent's emitted CSS
- [ ] Report body background = `#f7f7f2` (matches the rest of the app)
- [ ] All verdict/severity colors are visible on light background
- [ ] Text contrast ≥ 4.5:1 on all primary surfaces (use browser DevTools contrast checker)
- [ ] Existing buyer-layer tests still pass
- [ ] Demo report at `/report/demo` renders without visual regression
- [ ] `theme.ts` deprecation comment added; no immediate delete (rollback safety)

---

## Sprint 3: Document Bundle + Polish · Days 7–9

**Objective**: Wire the document download bundle API, polish the Layer 2 view, run E2E smoke test, and land minor UI polish on auth surfaces.

### Day 7 — Document Bundle API

1. **Create `apps/web/src/app/api/report/[id]/bundle/route.ts`**
   - GET handler, protected by the same access-token gating as the report view
   - Loads `reports` row + all `source_results` for that `report_id`
   - For each source: includes `raw` bytes (as a file named `<sourceId>_raw.html` or `.json` depending on content-type) + the parsed `result` as `<sourceId>_parsed.json`
   - Includes `plotDiagram` blob: download from Supabase Storage via the existing URL, include as `plot_diagram.svg`
   - Includes `report_metadata.json` (title, created_at, sources, tier, status)
   - Zips everything with `adm-zip`
   - Returns `application/zip` with `Content-Disposition: attachment; filename="cleardeed-<reportId>.zip"`

2. **Wire the "Download Documents" button** (already plumbed in Sprint 1)
   - Calls the new `/api/report/[id]/bundle` endpoint
   - Shows a spinner while the zip is being built
   - Falls back to a toast error on 401/403/500

### Day 8 — Layer 2 + Fallback Polish

3. **Layer 2 (Lawyer's Drill-Down) polish**
   - The existing `pipelineOutput.html` is preserved verbatim — it's now surfaced in the lawyer view
   - Add a header bar above the HTML blob: "Lawyer's Drill-Down — raw HTML, print-safe"
   - Add a "Switch to Buyer's Read" button at the top of Layer 2

4. **Fallback states polish**
   - `ReportExpired.tsx`: add a "Renew report" CTA (links to a new report for the same plot) — for now, just a link back to `/` with a state param
   - `ReportUnavailable.tsx`: add a retry button that re-triggers report creation for the same inputs
   - Both use Tailwind, brand palette, same typography as the rest of the app

### Day 9 — Auth/Dashboard Polish + E2E Smoke Test

5. **Login page polish** (`apps/web/src/app/login/page.tsx`)
   - Use the brand palette consistently
   - Add the brand mark + tagline
   - Keep it minimal (it's already light — just ensure colors match)

6. **Buyer dashboard polish** (`apps/web/src/app/dashboard/page.tsx`)
   - Status badges: use the same rose/amber/emerald/sky scale as the report
   - Cards: white bg, `border-[#d9ddd4]`, `rounded-lg`, `shadow-sm`
   - "Open" and "PDF" links: `#1d6f5b` color, hover to `#163d33`
   - Empty state: consistent messaging with the report's "not_covered" tone

7. **E2E smoke test**
   - Path: open `/` → enter coords + name → submit → wait for report → verify report renders with React components (not HTML blob) → click Plot Map → verify map loads → click "Buyer's Read" / "Lawyer's Drill-Down" toggle → verify both views render → click "Download PDF" → verify PDF downloads → click "Download Documents" → verify ZIP contains source artifacts → go to `/dashboard` → verify report card appears with correct status

### Sprint 3 Acceptance Criteria
- [ ] `/api/report/[id]/bundle` returns a ZIP with: report_metadata.json, one `<sourceId>_parsed.json` per source, one `<sourceId>_raw.*` per source, `plot_diagram.svg`
- [ ] ZIP is downloadable from the report toolbar
- [ ] ReportExpired and ReportUnavailable use Tailwind classes (verified by inspecting computed styles)
- [ ] Login page uses brand palette consistently
- [ ] Buyer dashboard cards use the same rose/amber/emerald/sky scale as report badges
- [ ] Full E2E smoke test passes (all 7 steps above)

---

## Buffer · Day 10

**Objective**: Absorb overruns, fix regressions, land any leftover acceptance criteria.

- If Sprints 1–3 are green early, move T-070 follow-ups (rerun UX polish) into this day
- If Sprint 1 (component shell) is the blocker, use the buffer to finish it — don't rush Sprint 2 (token migration) ahead of a working shell
- No new features; only bug fixes and acceptance criteria closure

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Agent's section builders resist data-shape extraction | Medium | High | Keep the existing `build*` functions that emit HTML — add parallel data-shape emitters that Layer 1 consumes. Don't rewrite the agent; wrap it. |
| `bhunakshaPolygon` missing on some reports | High | Medium | Degraded-state message in Q1 panel. The pipeline already returns `null` when Bhunaksha fetch fails; that's a valid state. |
| Mapbox token / quota | Low | High | Use existing `MapboxBoundaryMap` which already works in the form; just wire it. Token is env-var; no new dependency. |
| Agent CSS migration breaks rendering on some section | Medium | Medium | Keep `theme.ts` in place during migration. Switch to new emitter only after visual regression passes. Rollback = revert the one import line. |
| ZIP build is slow for reports with many sources | Low | Low | Stream the zip; add `Cache-Control: no-store`. Typical report has 3–6 sources — zip is <200 KB. |
| Buffer day eaten by unexpected blocker | Medium | Low | Buffer is the only place for scope creep. Anything that can't fit gets written as a new task, deferred. |

---

## Handoff Criteria

At the end of this PI:
- `/report/[id]` Layer 1 (Buyer's Read) is a React component tree, no `dangerouslySetInnerHTML`
- `/report/[id]` Layer 2 (Lawyer's Drill-Down) is the existing HTML blob, unchanged
- Plot map is interactive in the Q1 panel
- Report background and typography match the rest of the app
- Document bundle is downloadable from the report toolbar
- All pre-existing tests pass
- No new fetcher sources introduced
- CLAUDE.md Section 4 (Task List) is updated to reflect PI outcomes
- One session log entry in CLAUDE.md Section 7

---

## Tracking

This plan is tracked in:
- This file: `docs/plans/REPORT-SHELL-REDESIGN-PI.md`
- Todo list: `CLAUDE.md` Section 4 task list items T-XXX through T-XXX (to be assigned at Sprint 0)
- Session log: `CLAUDE.md` Section 7

Workflow: at the end of each sprint, update this file's acceptance criteria section with checkmarks, then mark the corresponding todo items as DONE or BLOCKED.
