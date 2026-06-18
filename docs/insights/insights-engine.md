# Insight Engine Mapping

> **Source of truth:** `agents/consumer-report-writer/src/insights/registry/`.
> **Generated:** 2026-06-18. To regenerate: run `npx tsx scripts/generate-insights-table.mjs > /tmp/rules-table.txt` from the repo root, then paste the rows into the table below (see Task 29 in `docs/superpowers/plans/2026-06-18-unified-insight-engine.md`).

## Issue lenses (5)

- `title_chain` — ownership and title-related facts
- `registry_ec` — encumbrance certificate and CERSAI facts
- `revenue_record` — RoR and Bhulekh page 1/2 facts
- `land_use_permission` — kisam, zoning, conversion facts
- `parser_source_quality` — facts about the parser, not the property

## Evidence strengths (7)

- `document_anchor` — we read it directly from a government page
- `case_or_order_anchor` — case number or order reference
- `selected_plot_anchor` — the row for the queried plot
- `row_count_signal` — count of rows (e.g. mutations) is the signal
- `source_observation` — observed fact (no anchor)
- `parser_uncertain` — we could not parse the source reliably
- `missing_source` — the source did not return data

## How to read this table

- **ID** — rule id, matches `^ROR-INS-\d{3}$`. Stable across regenerations.
- **Panel** — which consumer-report panel the insight renders into.
- **Lens** — `issueLens` field emitted when the rule fires. `?` when the rule did not fire under the test inputs (still live, just not yet exercised).
- **Evidence** — `evidenceStrength` field. `?` when not exercised.
- **Severity** — `positive`, `watchout`, or `redFlag`. `stub` when the rule is registered but its conditions were not met by the test inputs.
- **Source** — the `source` string the insight emits. `—` when the rule did not fire.
- **Rule file** — relative path to the registry module that exports the rule.
- **Status** — `live` if the rule fired under at least one test input, `stub` if not yet exercised. Not a code-quality signal; some rules only fire on rare edge cases.

The test inputs are intentionally generous — a maximally populated RoR/Bhulekh/CERSAI/ECourts/RCCMS/EC/Bhunaksha payload plus an empty/minimal payload. Rules that do not fire under either shape are flagged `stub` here so an engineer reading the table knows the rule exists but its lens/evidence pair has not yet been confirmed empirically.

## Rule registry

| ID | Panel | Lens | Evidence | Default severity | Source | Rule file | Status |
|---|---|---|---|---|---|---|---|
| ROR-INS-010 | plot | revenue_record | selected_plot_anchor | positive | bhulekh:ror:page-2 | agents/consumer-report-writer/src/insights/registry/bhulekh/plot.ts | live |
| ROR-INS-011 | plot | revenue_record | selected_plot_anchor | watchout | bhulekh:ror:page-2 | agents/consumer-report-writer/src/insights/registry/bhulekh/plot.ts | live |
| ROR-INS-012 | plot | parser_source_quality | missing_source | watchout | bhulekh:ror:page-1 | agents/consumer-report-writer/src/insights/registry/bhulekh/plot.ts | live |
| ROR-INS-013 | plot | revenue_record | document_anchor | watchout | bhulekh:ror:page-1 | agents/consumer-report-writer/src/insights/registry/bhulekh/plot.ts | live |
| ROR-INS-014 | plot | ? | ? | stub | — | agents/consumer-report-writer/src/insights/registry/bhulekh/plot.ts | stub |
| ROR-INS-015 | plot | ? | ? | stub | — | agents/consumer-report-writer/src/insights/registry/bhulekh/plot.ts | stub |
| ROR-INS-016 | plot | ? | ? | stub | — | agents/consumer-report-writer/src/insights/registry/bhulekh/plot.ts | stub |
| ROR-INS-020 | owner | title_chain | document_anchor | redFlag | bhulekh:ror:page-1 | agents/consumer-report-writer/src/insights/registry/bhulekh/owner.ts | live |
| ROR-INS-021 | owner | ? | ? | stub | — | agents/consumer-report-writer/src/insights/registry/bhulekh/owner.ts | stub |
| ROR-INS-022 | owner | revenue_record | document_anchor | redFlag | bhulekh:ror:page-1 | agents/consumer-report-writer/src/insights/registry/bhulekh/owner.ts | live |
| ROR-INS-023 | owner | ? | ? | stub | — | agents/consumer-report-writer/src/insights/registry/bhulekh/owner.ts | stub |
| ROR-INS-024 | owner | ? | ? | stub | — | agents/consumer-report-writer/src/insights/registry/bhulekh/owner.ts | stub |
| ROR-INS-025 | owner | ? | ? | stub | — | agents/consumer-report-writer/src/insights/registry/bhulekh/owner.ts | stub |
| ROR-INS-030 | land | ? | ? | stub | — | agents/consumer-report-writer/src/insights/registry/bhulekh/land.ts | stub |
| ROR-INS-031 | land | ? | ? | stub | — | agents/consumer-report-writer/src/insights/registry/bhulekh/land.ts | stub |
| ROR-INS-032 | land | ? | ? | stub | — | agents/consumer-report-writer/src/insights/registry/bhulekh/land.ts | stub |
| ROR-INS-033 | land | ? | ? | stub | — | agents/consumer-report-writer/src/insights/registry/bhulekh/land.ts | stub |
| ROR-INS-034 | land | parser_source_quality | parser_uncertain | watchout | bhulekh:ror:page-1 | agents/consumer-report-writer/src/insights/registry/bhulekh/land.ts | live |
| ROR-INS-035 | land | ? | ? | stub | — | agents/consumer-report-writer/src/insights/registry/bhulekh/land.ts | stub |
| ROR-INS-040 | plotTable | ? | ? | stub | — | agents/consumer-report-writer/src/insights/registry/bhulekh/plot-table.ts | stub |
| ROR-INS-041 | plotTable | parser_source_quality | parser_uncertain | watchout | bhulekh:ror:page-2 | agents/consumer-report-writer/src/insights/registry/bhulekh/plot-table.ts | live |
| ROR-INS-042 | plotTable | ? | ? | stub | — | agents/consumer-report-writer/src/insights/registry/bhulekh/plot-table.ts | stub |
| ROR-INS-043 | plotTable | ? | ? | stub | — | agents/consumer-report-writer/src/insights/registry/bhulekh/plot-table.ts | stub |
| ROR-INS-044 | plotTable | parser_source_quality | missing_source | watchout | bhulekh:ror:page-2 | agents/consumer-report-writer/src/insights/registry/bhulekh/plot-table.ts | live |
| ROR-INS-050 | dues | ? | ? | stub | — | agents/consumer-report-writer/src/insights/registry/bhulekh/dues.ts | stub |
| ROR-INS-051 | dues | ? | ? | stub | — | agents/consumer-report-writer/src/insights/registry/bhulekh/dues.ts | stub |
| ROR-INS-052 | dues | parser_source_quality | missing_source | watchout | bhulekh:ror:page-1 | agents/consumer-report-writer/src/insights/registry/bhulekh/dues.ts | live |
| ROR-INS-060 | backPage | ? | ? | stub | — | agents/consumer-report-writer/src/insights/registry/bhulekh/back-page.ts | stub |
| ROR-INS-061 | backPage | ? | ? | stub | — | agents/consumer-report-writer/src/insights/registry/bhulekh/back-page.ts | stub |
| ROR-INS-062 | backPage | ? | ? | stub | — | agents/consumer-report-writer/src/insights/registry/bhulekh/back-page.ts | stub |
| ROR-INS-063 | backPage | ? | ? | stub | — | agents/consumer-report-writer/src/insights/registry/bhulekh/back-page.ts | stub |
| ROR-INS-064 | backPage | ? | ? | stub | — | agents/consumer-report-writer/src/insights/registry/bhulekh/back-page.ts | stub |
| ROR-INS-065 | backPage | ? | ? | stub | — | agents/consumer-report-writer/src/insights/registry/bhulekh/back-page.ts | stub |
| ROR-INS-070 | plot | ? | ? | stub | — | agents/consumer-report-writer/src/insights/registry/bhunaksha/plot.ts | stub |
| ROR-INS-071 | plot | ? | ? | stub | — | agents/consumer-report-writer/src/insights/registry/bhunaksha/plot.ts | stub |
| ROR-INS-072 | plot | ? | ? | stub | — | agents/consumer-report-writer/src/insights/registry/bhunaksha/plot.ts | stub |
| ROR-INS-073 | plot | ? | ? | stub | — | agents/consumer-report-writer/src/insights/registry/bhunaksha/plot.ts | stub |
| ROR-INS-080 | roadAccess | ? | ? | stub | — | agents/consumer-report-writer/src/insights/registry/bhunaksha/road-access.ts | stub |
| ROR-INS-081 | roadAccess | ? | ? | stub | — | agents/consumer-report-writer/src/insights/registry/bhunaksha/road-access.ts | stub |
| ROR-INS-082 | roadAccess | ? | ? | stub | — | agents/consumer-report-writer/src/insights/registry/bhunaksha/road-access.ts | stub |
| ROR-INS-083 | roadAccess | land_use_permission | parser_uncertain | watchout | ROR-INS-083:stub | agents/consumer-report-writer/src/insights/registry/bhunaksha/road-access.ts | live |
| ROR-INS-090 | neighbours | ? | ? | stub | — | agents/consumer-report-writer/src/insights/registry/bhunaksha/neighbours.ts | stub |
| ROR-INS-091 | neighbours | ? | ? | stub | — | agents/consumer-report-writer/src/insights/registry/bhunaksha/neighbours.ts | stub |
| ROR-INS-092 | neighbours | ? | ? | stub | — | agents/consumer-report-writer/src/insights/registry/bhunaksha/neighbours.ts | stub |
| ROR-INS-093 | neighbours | ? | ? | stub | — | agents/consumer-report-writer/src/insights/registry/bhunaksha/neighbours.ts | stub |
| ROR-INS-100 | encumbrance | registry_ec | parser_uncertain | watchout | ROR-INS-100:stub | agents/consumer-report-writer/src/insights/registry/registry/encumbrance.ts | live |
| ROR-INS-101 | encumbrance | registry_ec | parser_uncertain | watchout | ROR-INS-101:stub | agents/consumer-report-writer/src/insights/registry/registry/encumbrance.ts | live |
| ROR-INS-102 | encumbrance | registry_ec | parser_uncertain | watchout | ROR-INS-102:stub | agents/consumer-report-writer/src/insights/registry/registry/encumbrance.ts | live |
| ROR-INS-103 | encumbrance | registry_ec | document_anchor | redFlag | cersai:asset-search | agents/consumer-report-writer/src/insights/registry/registry/encumbrance.ts | live |
| ROR-INS-104 | encumbrance | registry_ec | parser_uncertain | watchout | ROR-INS-104:stub | agents/consumer-report-writer/src/insights/registry/registry/encumbrance.ts | live |
| ROR-INS-110 | deeds | title_chain | parser_uncertain | watchout | ROR-INS-110:stub | agents/consumer-report-writer/src/insights/registry/registry/deeds.ts | live |
| ROR-INS-111 | deeds | title_chain | parser_uncertain | watchout | ROR-INS-111:stub | agents/consumer-report-writer/src/insights/registry/registry/deeds.ts | live |
| ROR-INS-112 | deeds | registry_ec | parser_uncertain | watchout | ROR-INS-112:stub | agents/consumer-report-writer/src/insights/registry/registry/deeds.ts | live |
| ROR-INS-113 | deeds | title_chain | parser_uncertain | watchout | ROR-INS-113:stub | agents/consumer-report-writer/src/insights/registry/registry/deeds.ts | live |
| ROR-INS-114 | deeds | title_chain | parser_uncertain | watchout | ROR-INS-114:stub | agents/consumer-report-writer/src/insights/registry/registry/deeds.ts | live |
| ROR-INS-120 | court | title_chain | parser_uncertain | watchout | ROR-INS-120:stub | agents/consumer-report-writer/src/insights/registry/registry/court.ts | live |
| ROR-INS-121 | court | title_chain | parser_uncertain | watchout | ROR-INS-121:stub | agents/consumer-report-writer/src/insights/registry/registry/court.ts | live |
| ROR-INS-122 | court | title_chain | parser_uncertain | watchout | ROR-INS-122:stub | agents/consumer-report-writer/src/insights/registry/registry/court.ts | live |
| ROR-INS-130 | financial | registry_ec | parser_uncertain | watchout | ROR-INS-130:stub | agents/consumer-report-writer/src/insights/registry/registry/financial.ts | live |
| ROR-INS-131 | financial | registry_ec | parser_uncertain | watchout | ROR-INS-131:stub | agents/consumer-report-writer/src/insights/registry/registry/financial.ts | live |
| ROR-INS-132 | financial | registry_ec | parser_uncertain | watchout | ROR-INS-132:stub | agents/consumer-report-writer/src/insights/registry/registry/financial.ts | live |
| ROR-INS-140 | completeness | parser_source_quality | missing_source | redFlag | completeness:source-statuses | agents/consumer-report-writer/src/insights/registry/registry/completeness.ts | live |
| ROR-INS-141 | completeness | parser_source_quality | parser_uncertain | watchout | completeness:source-statuses | agents/consumer-report-writer/src/insights/registry/registry/completeness.ts | live |
| ROR-INS-142 | completeness | revenue_record | missing_source | redFlag | completeness:ror-key-fields | agents/consumer-report-writer/src/insights/registry/registry/completeness.ts | live |
| ROR-INS-143 | completeness | parser_source_quality | missing_source | watchout | completeness:eow-blacklist | agents/consumer-report-writer/src/insights/registry/registry/completeness.ts | live |
| ROR-INS-150 | chain | title_chain | parser_uncertain | watchout | ROR-INS-150:stub | agents/consumer-report-writer/src/insights/registry/recursive/chain-recursive.ts | live |
| ROR-INS-151 | neighbours | land_use_permission | parser_uncertain | watchout | ROR-INS-151:stub | agents/consumer-report-writer/src/insights/registry/recursive/neighbours-recursive.ts | live |
| ROR-INS-152 | land | land_use_permission | parser_uncertain | watchout | ROR-INS-152:stub | agents/consumer-report-writer/src/insights/registry/recursive/zoning.ts | live |
| ROR-INS-153 | land | land_use_permission | parser_uncertain | watchout | ROR-INS-153:stub | agents/consumer-report-writer/src/insights/registry/recursive/zoning.ts | live |

## Coverage summary

- Total rules: **69**
- Live (fired under at least one test input): **35**
- Stub (registered but not yet exercised by the harness inputs): **34**

Stub rules are not lower-priority. Many fire only on rare shapes (e.g. encumbrance against a different person, court case in a specific court complex, zero-area plot row). The harness intentionally uses two opposing shapes so coverage is broad but not exhaustive. Future work should add fixture inputs for the stub rules and regenerate.

## Regenerating

```bash
# from repo root
npx tsx scripts/generate-insights-table.mjs > /tmp/rules-table.txt
# then paste the rows into the table above
```

The script walks the registry directory, loads every rule, and tries each rule against the positive + negative harness inputs. It emits a markdown table row per rule with all 8 columns.

When you add or change a rule:

1. Update the registry module (e.g. `agents/consumer-report-writer/src/insights/registry/bhulekh/land.ts`).
2. Re-run the script.
3. Update this doc with the new rows.
4. Commit the rule change and the doc update in the same commit.

When you change a rule's `panel`, `issueLens`, or `evidenceStrength`, the change shows up here automatically because the doc reflects what the rule actually emits at runtime — not what the rule's source code declares as a comment.
