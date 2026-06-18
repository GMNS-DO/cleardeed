# ClearDeed Doc Consolidation + Status Index — Design

**Date:** 2026-06-18
**Status:** PROPOSED — awaiting user review
**Author:** Brainstorming session on 2026-06-18

## Problem

ClearDeed has accumulated ~10 top-level markdown files that overlap and contradict each other. CLAUDE.md alone is 4,265 lines and contains the engineering constitution, task list, decision log, state snapshot, session log, AND the theoretical ceiling. STRATEGY.md says PRODUCT_SPEC.md is the product source of truth; CLAUDE.md says PRODUCT.md is. Both PRODUCT.md and PRODUCT_SPEC.md exist. CURRENT_FOCUS.md duplicates state information that already lives in CLAUDE.md §6.

A new Claude session (or a new team member) cannot answer "where is the current state of the product?" without reading 6+ files. Recent additions — RoR risk intelligence, lineage, PID (Product Identity Foundation), captcha-breaker ONNX, Apify parseforge integration — are scattered across ADRs, ROADMAP.md, BACKLOG.md, PID_TRACK.md, and CLEARDEED_FINAL_CEILING.md without a single table of contents.

## Goal

Reduce time-to-orient for any reader (human or AI session) from "read 6+ files" to "read 1 pointer doc, then the 2-3 specific docs you need." Preserve all unique content. Do not break append-only history.

## Non-goals

- Restructuring code (`apps/`, `packages/`, `agents/`, `workers/`) — separate effort.
- Rewriting content. Move and redirect, don't reformat.
- Creating a "doc conflict resolution" document. CLAUDE.md authority is the resolution rule.

## Authority rule

CLAUDE.md wins on engineering discipline. PRODUCT.md wins on product decisions. Every other doc defers to one of these two when there's a conflict. STRATEGY.md currently contradicts this by naming PRODUCT_SPEC.md as canonical; STRATEGY.md gets fixed inline.

## The new structure

Three pointer docs at the root, each owning one audience:

### 1. CLAUDE.md (engineering constitution) — ~800 lines

| Section | Source | Notes |
|---|---|---|
| §1 Pointer table | NEW | One-line "if you want X, read Y" index |
| §2 Product definition | Current §1 (kept) | Engineering-level implications of product |
| §3 Architecture view | Current §2 (kept) | Diagram + repo layout |
| §4 Operating principles | Current §3 (kept) | Non-negotiable rules |
| §5 Decision Log | Current §5 (kept, all 27 ADRs) | Full append-only history |
| ~~Old §4 Task List~~ | → STATUS.md | |
| ~~Old §6 State Snapshot~~ | → STATUS.md | |
| ~~Old §7 Session Log~~ | → docs/sessions/YYYY-MM.md | |
| ~~Old §8 Theoretical Ceiling~~ | → PRODUCT.md | |

Bottom of file: pointer to git history for full pre-consolidation content + link to current month session log.

### 2. STATUS.md (operational index) — ~500 lines, NEW

| § | Section | Source |
|---|---|---|
| 1 | Header | date, sprint, next step (3 lines) |
| 2 | Sprint focus | ROADMAP.md sprint headers |
| 3 | Fetcher status table | 25 rows from `packages/fetchers/*/src/index.ts` + `docs/sources/*.md` |
| 4 | Agent status table | 6 rows from `agents/*/src/index.ts` |
| 5 | Pipeline status | orchestrator, schema, captcha-breaker, PDF renderer |
| 6 | Tasks table | T-IDs from current CLAUDE.md §4 |
| 7 | Active risks | 5-10 bullets with owner |
| 8 | Recent shipped | Last 5 PRs/deploys with deployment URL |
| 9 | Next action | One concrete task ID + reason |
| 10 | Pointer to deeper docs | ROADMAP.md, BACKLOG.md, FEATURES.md |

Refresh cadence written into header: sprint focus/risks/next action update by end of every working session; fetcher/agent tables regenerate when packages change; tasks table is append-only.

### 3. FEATURES.md (feature inventory) — ~500 lines, NEW

| § | Section | Pills used |
|---|---|---|
| 1 | Core data acquisition | LIVE / PROBED / PLACEHOLDER / DORMANT / BLOCKED |
| 2 | Pipeline & orchestration | LIVE / DORMANT |
| 3 | Report generation | LIVE / PARTIAL / PLANNED |
| 4 | Identity & ownership | LIVE / PARTIAL |
| 5 | Land classification | LIVE |
| 6 | Validation & reliability | LIVE / PARTIAL |
| 7 | Fraud detection | THEORETICAL / PLANNED |
| 8 | Pricing tiers | THEORETICAL |
| 9 | Trust mechanisms | THEORETICAL |
| 10 | Moat / compound assets | THEORETICAL |
| 11 | Platforms & infra | LIVE / PARTIAL |
| 12 | Compliance & legal | PARTIAL |
| 13 | Future cohorts (V2+) | DEFERRED |

Each row: `ID | Feature | One-line | Status | Source link`.

Status pill legend (consistent with STATUS.md): LIVE = in production code · PARTIAL = in code, not fully validated · PROBED = explored and documented · DORMANT = code exists, V1.1 dormant · PLACEHOLDER = stub returns manual_required · BLOCKED = external gate · PLANNED = scheduled · IN PROGRESS = actively worked · THEORETICAL = defined, not started · DEFERRED = V2+

## File-by-file migration plan

| Current file | Action | Destination | Notes |
|---|---|---|---|
| `CLAUDE.md` (4,265 lines) | SPLIT | stays at root, shrinks to ~800 | §4, §6, §7, §8 moved out |
| `PRODUCT.md` (427 lines) | ABSORB | stays at root, grows to ~520 | receives Theoretical Ceiling from CLAUDE.md §8 |
| `STATUS.md` | NEW | root | operational index |
| `FEATURES.md` | NEW | root | feature inventory |
| `PRODUCT_SPEC.md` (253 lines) | DELETE | — | superseded by PRODUCT.md |
| `COUNCIL.md` (289 lines) | KEEP + SCOPE-NARROW | root | add header: "V2+ multi-cohort only. V1 consumer: see PRODUCT.md" |
| `STRATEGY.md` (124 lines) | KEEP | root | one-line fix: PRODUCT_SPEC → PRODUCT.md |
| `ROADMAP.md` (355 lines) | KEEP | root | one-line fix: STATUS.md is operational truth |
| `BACKLOG.md` (209 lines) | KEEP | root | one-line fix: STATUS.md is operational truth |
| `CURRENT_FOCUS.md` (151 lines) | DELETE | — | content moves to STATUS.md §1, §2, §8, §9 |
| `DECISIONS.md` (359 lines) | SCOPE-NARROW | root | keep as "supplementary operational decisions" — clear overlap with CLAUDE.md §5 (ADRs 001-027 are canonical in CLAUDE.md) |
| `FRAUD_PATTERNS.md` | KEEP | root | referenced by FEATURES.md §7 |
| `CUSTOMER_DEVELOPMENT.md` | KEEP | root | append-only customer insight log |
| `CLEARDEED_FINAL_CEILING.md` | ABSORB | merged into PRODUCT.md | theoretical ceiling content moves to PRODUCT.md §8 |
| `COMPLYRADAR_*.md` (4 files) | KEEP | root | V2+ platform docs; each gets a header pointing to COUNCIL.md |
| `KHORDHA_30_DAY_LAUNCH_PLAN_2026-06-16.md` | KEEP | root | time-bounded; auto-archive after 30 days |
| `V5B_SHIP_SUMMARY_2026-06-15.md` | ARCHIVE | `docs/ship-logs/` | one-off ship log |
| `CLEARDEED-EXECUTIVE-BRIEF-README.md` | KEEP | root | investor-facing summary |
| `ClearDeed-Executive-Brief.docx` | KEEP | root | investor doc |
| `Build-docx.js` | KEEP | root | utility |
| `README.md` | KEEP | root | add one-line pointer to STATUS.md |
| `claude.md` (lowercase, untracked) | INVESTIGATE | — | duplicate or accidental — decide during PR 1 |
| `bhulekh insights master.md`, `odisha property app pipeline.md` (untracked) | INVESTIGATE | — | drafts — decide during PR 1 |
| `docs/sources/*.md` (11 files) | KEEP | docs/sources/ | referenced by FEATURES.md §1 |
| `docs/decisions/` | KEEP EMPTY | docs/decisions/ | ADRs canonical in CLAUDE.md §5; add `.gitkeep` with note |
| `docs/validation/` | KEEP | docs/validation/ | referenced by FEATURES.md §6 |
| `docs/superpowers/specs/`, `plans/` | KEEP | docs/superpowers/ | design + plan history |
| `docs/sessions/` | ACTIVATE | docs/sessions/ | new file per month for old CLAUDE.md §7 session log |
| `docs/ops/production-launch.md` | KEEP | docs/ops/ | |
| `legal/disclaimers/consumer.md` | KEEP | legal/ | referenced by FEATURES.md §12 |
| `qa/*`, `infra/*`, `apps/*`, `agents/*`, `packages/*`, `workers/*` | OUT OF SCOPE | — | code restructuring is a separate effort |

## Migration mechanics — three principles

1. **Move, don't reformat.** When content moves from CLAUDE.md to STATUS.md, wording stays the same. Reformatting burns review time.
2. **Add redirect headers before deleting.** Every deleted or scope-narrowed doc gets a one-paragraph header pointing to its replacement. No broken links.
3. **One PR per major move.** Six PRs in sequence:

| PR | Contents |
|---|---|
| 1 | Add `STATUS.md` and `FEATURES.md` (new files only, no edits elsewhere) |
| 2 | Add redirect headers to `PRODUCT_SPEC.md`, `CURRENT_FOCUS.md`, `STRATEGY.md`, `COUNCIL.md`, `ROADMAP.md`, `BACKLOG.md` (one-line each) |
| 3 | Move CLAUDE.md §4 → STATUS.md, §6 → STATUS.md, §7 → docs/sessions/, §8 → PRODUCT.md |
| 4 | Slim CLAUDE.md to constitution + decisions only |
| 5 | Delete `PRODUCT_SPEC.md`, `CURRENT_FOCUS.md` (after ≥24h with redirects live) |
| 6 | Audit pass — fix broken links, ensure STATUS.md reflects new reality |

## Risks

- **Content drift during moves.** When copying 4,265 lines across multiple files, omissions are likely. Mitigation: each PR is small and reviewable; PR 6 is a dedicated audit pass.
- **Broken cross-references.** Old links to `CLAUDE.md#section-4` will break when §4 moves. Mitigation: PR 4 keeps §4–§7 as anchor-compatible stubs in CLAUDE.md for exactly 30 days (just header + "see STATUS.md"). On day 31, PR 6 removes the stubs. If any external doc still links to a removed stub, the link becomes a 404 and the doc gets fixed in that PR.
- **STRATEGY.md contradicts CLAUDE.md.** STRATEGY.md currently names PRODUCT_SPEC.md as canonical. Per the authority rule, CLAUDE.md wins. STRATEGY.md gets a one-line fix in PR 2.
- **"Loss" of session log.** The append-only history of §7 was a key property. Mitigation: git history preserves it verbatim; `docs/sessions/YYYY-MM.md` continues the append-only pattern.

## Success criteria

- A new Claude session can answer "where is the current state?" by reading `STATUS.md` only.
- A new team member can answer "what does ClearDeed do?" by reading `PRODUCT.md` only.
- A new Claude session can answer "what features exist (live, planned, theoretical)?" by reading `FEATURES.md` only.
- All historical content remains recoverable from git history.
- Every existing doc either: (a) becomes one of the three canonical docs, (b) is scope-narrowed with a redirect header, or (c) is deleted with a redirect header.
- No contradicting authority claims remain.

## Out of scope

- Code restructuring (separate effort, deferred).
- Doc style/lint automation (separate effort).
- Internationalization (not a current need).
- Renaming any source file (`apps/`, `packages/`, `agents/`, `workers/`) — too risky for an in-flight sprint.

## Open questions

None at design time. The implementation plan will surface tactical questions (e.g., how to handle the untracked `claude.md` lowercase file) — those are PR-time decisions, not design-time decisions.

## Next step

User reviews this spec. If approved, the next step is to invoke the writing-plans skill to produce the PR-by-PR implementation plan.