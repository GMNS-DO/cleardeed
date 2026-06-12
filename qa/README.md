# qa/ — Sprint V1: Input Taxonomy & Ground-Truth Corpus

> **Status:** Sprint V1 scaffolding. **P001–P005** pre-filled (founder-verified); **P006–P050** are empty scaffolds awaiting manual verification.

## Structure

```
qa/
├── README.md                    # this file
├── khordha_inputs.json          # 4,389+ valid Khordha input combinations
├── invalid_inputs.json          # 24 corpus-scope negative tests + 17 pre-existing fetcher tests
├── scripts/
│   ├── enumerate_inputs.mjs     # regenerates khordha_inputs.json (deterministic LCG)
│   ├── build_pre_filled.mjs     # regenerates P001-P050 directories (5 verified + 45 scaffolds)
│   └── coverage_matrix.mjs      # regenerates _corpus_coverage.md
├── ground_truth/
│   ├── _schema.ts               # TypeScript interface for manifest.json
│   ├── _corpus_coverage.md      # generated matrix: tahasil × pattern × BDA × kisam
│   ├── P001/                    # pre-filled, verified
│   │   ├── manifest.json
│   │   ├── transcript.md
│   │   └── README.md
│   ├── P002/, P003/, P004/, P005/   # pre-filled, verified
│   └── P006/ ... P050/          # empty scaffolds (fetchers: { ...all null })
├── fetcher_tests/               # Sprint V2 — pre-existing contract test suite
├── section_validators/          # Sprint V3 — pre-existing section test suite
├── degradation_matrix.json      # Sprint V3 — pre-existing typed-degradation matrix
└── known_issues.md              # pre-existing known-issues register
```

## Naming convention: P001–P050

Plot directories use the **`P\d{3}`** convention (no underscores, no suffixes) because
the existing V2 contract-test helper at `qa/fetcher_tests/_helper.ts` looks them up
by exact id (`GOLDEN_PATHS = ["P001", "P002", ..., "P050"]`). Using a different
naming scheme (e.g. `plot_001_mendhasala_415`) would cause the V2 tests to silently
SKIP all 50 plots.

## How to add a new ground-truth plot

1. Create a directory: `qa/ground_truth/P051/` (or whatever the next id is).
2. Copy the schema shape from `qa/ground_truth/_schema.ts` into `manifest.json`. Required top-level fields: `plot_id`, `description`, `added_at`, `verified_by`, `location`, `coverage`, `fetchers`.
3. For each fetcher slice (`fetchers.bhulekh`, `fetchers.bhunaksha`, etc.), fill the **data** fields directly (no envelope wrapping — the V2 tests look at `slice.plotNo`, `slice.village`, etc. as direct properties). See `_schema.ts` for the per-fetcher data shapes.
4. Add a `__contract` sub-object to each slice for audit: `{ source, status: "ok", fetchedAt, sourceUrl, latencyMs }`.
5. Write a `transcript.md` with the exact manual steps: go to bhulekh.ori.nic.in, select district/tahasil/village, search by your identifier, screenshot, transcribe values.
6. Write a `README.md` with one paragraph of context: why this plot, what edge case it tests.
7. Set `verified_by: "founder"` and re-run `node qa/scripts/coverage_matrix.mjs` to refresh `_corpus_coverage.md`.

For V1 scaffolds (`P006-P050`), each fetcher slice is `null`. The founder replaces
each `null` with the verified data object when they fill in the plot.

## How to regenerate the corpus

```bash
# Regenerate inputs (deterministic — same output every run)
node qa/scripts/enumerate_inputs.mjs

# Regenerate P001-P050 directories (will overwrite existing)
node qa/scripts/build_pre_filled.mjs

# Regenerate coverage matrix
node qa/scripts/coverage_matrix.mjs
```

The V2 contract tests (`npx vitest run qa/fetcher_tests/`) and the V3 section
validators (`npx vitest run qa/section_validators/`) consume the manifests and
report files directly — no glue code needed.

## Field-name compatibility

Manifest field names match the V2 contract data schemas in
`apps/web/src/lib/pipeline/contracts/`:

- `bhulekh.tenants[].tenantName`, `landClass`, `area`, `unit` — matches `BhulekhDataSchema.tenants[]`
- `bhulekh.tenants[].surveyNo`, `share`, `fatherHusbandName` — matches `BhulekhDataSchema.tenants[]`
- `bhulekh.khataNo` — matches `BhulekhDataSchema.khataNo`
- `igr-ec.entries[].docType`, `docNo`, `regDate`, `party1`, `party2` — matches `EncumbranceEntry`
- `ecourts.cases[].caseNo`, `caseType`, `court`, `status` — matches `CourtCaseResult.data.cases`
- `circle-rate.rows[]` — matches `CircleRateDataSchema.rows[]`
- `bda-zoning.rows[].zone.id` — matches `BdaZoneDataSchema.rows[].zone.id`
- `nominatim.displayName`, `village`, `tahasil`, `district` — matches `NominatimDataSchema`

The `__contract` sub-object on each slice is ignored by the V2 contract tests
(it uses a Zod `.passthrough()` so unknown keys are allowed).

## Determinism

The plot pattern sampler in `enumerate_inputs.mjs` uses a fixed-seed LCG
(seed 12345, multiplier 48271). Re-running produces byte-identical output.
This is required so V4 shadow-runner diffs are meaningful.

## What V1 does NOT include

- V2: fetcher contract tests — **already present** in `qa/fetcher_tests/` (pre-existing, not built in this sprint)
- V3: section-level validators — **already present** in `qa/section_validators/` (pre-existing)
- V4: shadow runner that exercises the ground-truth plots through the full pipeline

V1 deliverables are scaffolding, not finished data. The 50-plot ground-truth
corpus is the most expensive thing in this plan — realistically 15–20 hours
of manual portal work — so the scaffold is what we ship now.
