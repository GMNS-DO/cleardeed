# Insight Engine Mapping

> **Source of truth:** `agents/consumer-report-writer/src/insights/registry/`.
> **Generated:** 2026-06-18. To regenerate: see Task 29 in `docs/superpowers/plans/2026-06-18-unified-insight-engine.md`.

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

## Rule registry

| ID | Panel | Lens | Evidence | Default severity |
|---|---|---|---|---|
| ROR-INS-010 | plot | revenue_record | selected_plot_anchor | positive |
| ROR-INS-011 | plot | stub | stub | stub |
| ROR-INS-012 | plot | stub | stub | stub |
| ROR-INS-013 | plot | stub | stub | stub |
| ROR-INS-014 | plot | stub | stub | stub |
| ROR-INS-015 | plot | stub | stub | stub |
| ROR-INS-016 | plot | stub | stub | stub |
| ROR-INS-020 | owner | title_chain | document_anchor | redFlag |
| ROR-INS-021 | owner | stub | stub | stub |
| ROR-INS-022 | owner | stub | stub | stub |
| ROR-INS-023 | owner | title_chain | source_observation | watchout |
| ROR-INS-024 | owner | stub | stub | stub |
| ROR-INS-025 | owner | stub | stub | stub |
| ROR-INS-030 | land | stub | stub | stub |
| ROR-INS-031 | land | stub | stub | stub |
| ROR-INS-032 | land | stub | stub | stub |
| ROR-INS-033 | land | stub | stub | stub |
| ROR-INS-034 | land | parser_source_quality | parser_uncertain | watchout |
| ROR-INS-040 | plotTable | stub | stub | stub |
| ROR-INS-041 | plotTable | parser_source_quality | parser_uncertain | watchout |
| ROR-INS-042 | plotTable | stub | stub | stub |
| ROR-INS-043 | plotTable | stub | stub | stub |
| ROR-INS-044 | plotTable | stub | stub | stub |
| ROR-INS-050 | dues | stub | stub | stub |
| ROR-INS-051 | dues | stub | stub | stub |
| ROR-INS-052 | dues | parser_source_quality | missing_source | watchout |
| ROR-INS-060 | backPage | stub | stub | stub |
| ROR-INS-061 | backPage | stub | stub | stub |
| ROR-INS-062 | backPage | stub | stub | stub |
| ROR-INS-063 | backPage | stub | stub | stub |
| ROR-INS-064 | backPage | stub | stub | stub |
| ROR-INS-065 | backPage | stub | stub | stub |
| ROR-INS-070 | plot | stub | stub | stub |
| ROR-INS-071 | plot | stub | stub | stub |
| ROR-INS-072 | plot | stub | stub | stub |
| ROR-INS-073 | plot | stub | stub | stub |
| ROR-INS-080 | roadAccess | land_use_permission | source_observation | redFlag |
| ROR-INS-081 | roadAccess | stub | stub | stub |
| ROR-INS-082 | roadAccess | stub | stub | stub |
| ROR-INS-090 | neighbours | stub | stub | stub |
| ROR-INS-091 | neighbours | stub | stub | stub |
| ROR-INS-092 | neighbours | stub | stub | stub |
| ROR-INS-093 | neighbours | parser_source_quality | missing_source | watchout |
| ROR-INS-100 | encumbrance | registry_ec | parser_uncertain | watchout |
| ROR-INS-101 | encumbrance | registry_ec | parser_uncertain | watchout |
| ROR-INS-102 | encumbrance | registry_ec | parser_uncertain | watchout |
| ROR-INS-103 | encumbrance | stub | stub | stub |
| ROR-INS-104 | encumbrance | registry_ec | parser_uncertain | watchout |
| ROR-INS-110 | deeds | title_chain | parser_uncertain | watchout |
| ROR-INS-111 | deeds | title_chain | parser_uncertain | watchout |
| ROR-INS-112 | deeds | registry_ec | parser_uncertain | watchout |
| ROR-INS-113 | deeds | title_chain | parser_uncertain | watchout |
| ROR-INS-114 | deeds | title_chain | parser_uncertain | watchout |
| ROR-INS-120 | court | title_chain | parser_uncertain | watchout |
| ROR-INS-121 | court | title_chain | parser_uncertain | watchout |
| ROR-INS-122 | court | title_chain | parser_uncertain | watchout |
| ROR-INS-130 | financial | registry_ec | parser_uncertain | watchout |
| ROR-INS-131 | financial | registry_ec | parser_uncertain | watchout |
| ROR-INS-132 | financial | registry_ec | parser_uncertain | watchout |
| ROR-INS-140 | completeness | stub | stub | stub |
| ROR-INS-141 | completeness | stub | stub | stub |
| ROR-INS-142 | completeness | stub | stub | stub |
| ROR-INS-143 | completeness | stub | stub | stub |
| ROR-INS-150 | chain | title_chain | parser_uncertain | watchout |
| ROR-INS-151 | neighbours | land_use_permission | parser_uncertain | watchout |
| ROR-INS-152 | land | land_use_permission | parser_uncertain | watchout |
| ROR-INS-153 | land | land_use_permission | parser_uncertain | watchout |
