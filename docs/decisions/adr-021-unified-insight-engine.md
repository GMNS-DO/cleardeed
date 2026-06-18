# ADR-021: Unified Insight Engine

## Status
Accepted 2026-06-18.

## Context
As of Session 056, the consumer report writer ran two parallel insight engines
(`buildRoRInsightGroups` and `buildRiskInsights`) plus several scattered
`buildXxxSection` helpers. The two engines duplicated lens/evidence vocabulary,
used different severity scales, and made it impossible to enforce a single
language gate (A11).

## Decision
We will replace both engines with a single `Insight[]` stream produced by
`runInsights(ALL_RULES, input)` from
`agents/consumer-report-writer/src/insights/engine.ts`.

The schema (`schema.ts`) fixes:
- 5 issue lenses
- 7 evidence strengths
- 16 insight panels
- 3 severities (positive / watchout / redFlag)
- 8 prohibited phrases

The registry (`registry/`) holds 67 deterministic rules across 14 panels.
Stubs use `parser_uncertain` and auto-activate as upstream fetchers return
live data.

Every insight carries a closed `<details>` disclosure. A11 (the auditor) flags
both prohibited phrases inside insight blocks and any open disclosure.

## Consequences
- A11 is the single language gate. There is no parallel "I also have my own
  prohibited-phrase list" code path.
- Adding a new insight is a one-rule change. The render and audit paths do
  not change.
- Switching a stub to a live rule is a one-function change inside the panel
  file. The engine does not change.
- Prohibited phrases apply to A10 and A11 in the same way. Both consume the
  same `display-labels.ts` allowlist.

## Supersedes
- The "two engines" structure introduced in Session 056.
