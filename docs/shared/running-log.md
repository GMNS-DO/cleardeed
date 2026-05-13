# Shared Running Log
## Gemini Code Assist — Session 039

### Completed Tasks
- [x] **TASK 1: T-033 — IGR/EC Concierge Service**: Added IGR Odisha step-by-step instructions, fees, and requirements in `agents/encumbrance-reasoner` and `agents/consumer-report-writer`.
- [x] **TASK 2: T-043 — Circle Rate Deep-Link + Benchmark Valuation**: Created `docs/sources/circle-rate.md` and added "Market Benchmark" panel to the HTML report.
- [x] **TASK 3: A10 — Wire LARR into Consumer Report Writer**: Updated mapper and A10 to include `larrRiskAssessment` and display the LARR acquisition risk with RTI instructions in the final HTML report.
- [x] **TASK 4: T-039 — Probe RERA Portal Structure**: Wrote a probe script and documented RERA Odisha at `docs/sources/rera.md`. It has an online project list but is difficult to search by builder or location programmatically without a complex scraper. Party search is not supported.
- [x] **TASK 5: T-021 — Fetcher Resilience Audit**: Audited all fetchers. The orchestrator now implements a global circuit breaker via `runFetcher` in `packages/orchestrator/src/index.ts`. `runWithRetry` logic added where missing.
- [x] **TASK 6: T-035 — Civic Dues Stubs + MCA Check**: Built `fetchCivicDues` fetcher stub and integrated it into the orchestrator pipeline when a company/LLP seller is detected.

### Schema Notes
- Modified `CourtCaseResult` source field to be an enum including `"ecourts", "high_court", "drt", "larr", "rti", "revenue_odisha_sia"` to accommodate multiple case fetchers returning `CourtCaseResult`.
- Allowed `searchMetadata` in `CourtCaseResult` to accept `.catchall(z.unknown())` to gracefully accept extra tracking metadata (like `doubleFetchAttempt`).

### Blockers / Unblocked
- Unblocked Claude for live probe tasks by ensuring the orchestrator and schemas are tolerant to missing or partial results from new fetchers (e.g. `larr`). Types are fixed across the workspace.

## Gemini Code Assist — Session 040

### Completed Tasks
- [x] **TASK 1: A10 — LARR Fixture Wiring**: Added `larrRiskAssessment` to `agents/consumer-report-writer/fixtures/golden-path.ts` so the "Land Acquisition Risk" section correctly renders in `/report/demo`. (Mapper and HTML rendering were already completed in Session 039).
- [x] **TASK 2: T-033 — IGR/EC Concierge Service**: Expanded the EC instructions panel in `agents/consumer-report-writer/src/index.ts` to include expected fees (₹100-500), required docs, and SRO visit guidance. Created `docs/sources/igr.md` documenting the portal constraints.
- [x] **TASK 3: T-043 — Circle Rate Deep-Link**: Verified `docs/sources/circle-rate.md` and "Market Benchmark" panel in A10 are present and correct. Marked T-043 as DONE in `claude.md`.
- [x] **TASK 4: T-039 — Probe RERA Portal**: Verified `scripts/probe/rera-probe.mjs` and `docs/sources/rera.md`. Marked T-039 as DONE in `claude.md`.

### Blockers / Unblocked
- Unblocked demo rendering of LARR section.
- Closed out multiple P1 research/probe tasks (IGR, RERA, Circle Rate) by documenting their manual/concierge workflows.