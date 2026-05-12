# ClearDeed — V1.1 Sprint Active

> **V1.1 Launch Mode** (2026-05-12 to 2026-05-21): Bhulekh-only, Khordha, ₹999/report, founder-reviewed WhatsApp delivery. See [CLEARDEED_HANDOFF_V1.1.md](CLEARDEED_HANDOFF_V1.1.md) for the full operating brief.

---

# ClearDeed — Production-Grade Test Suite

This directory contains the assets for the end-to-end production-grade test suite. The goal is to validate the entire `generateReport` pipeline against a set of realistic scenarios with known-correct "golden" outputs.

## Purpose

This suite answers the question: "Is the product working correctly for real-world inputs?" It tests the integration of all fetchers, interpreters (agents), and the final report writer.

- It catches regressions in the full pipeline.
- It validates the correctness of agent logic (e.g., `OwnershipReasoner`, `LandClassifier`).
- It provides a clear report of what is working, what is broken, and what needs enhancement.

This is distinct from unit tests, which test components in isolation.

## Structure

- `/testing/README.md`: This file.
- `/testing/cases/`: Contains individual test case definition files in JSON format.
- `/scripts/run-test-suite.ts`: The test runner script that executes the pipeline for each case and compares the output to the golden fixture.

## Test Cases

Each file in `/testing/cases/` represents a single end-to-end test.

- **TC001_urban_clear.json**: The "happy path". A simple plot in urban Bhubaneswar with a single, clear owner.
- **TC002_rural_multi_owner.json**: A rural plot with multiple owners listed in the Bhulekh record. Tests the `OwnershipReasoner`'s co-owner detection and the `LandClassifier` for agricultural land.
- **TC003_regulatory_zone.json**: A plot located within the approximate boundaries of the Chandaka Forest. Tests the `RegulatoryScreener` agent.
- **(Future) TC004_court_case.json**: A plot associated with an owner who has known court cases in eCourts or RCCMS.
- **(Future) TC005_data_mismatch.json**: A plot where Bhunaksha and Bhulekh records have a known, slight discrepancy in area or village name, testing the `CrossSourceValidator`.

## How to Run

From the project root, run:

```bash
npm test
npm run typecheck
npm run build
```

These commands run the unit/integration suite, the web-app TypeScript check, and the production Next.js build.

For production launch verification after deployment, run:

```bash
npm run verify:prod
```

See [`docs/ops/production-launch.md`](docs/ops/production-launch.md) for the Vercel/Supabase environment checklist and smoke-test expectations.

## Adding a New Test Case

1.  Create a new file, e.g., `TCXXX_description.json`, in the `/testing/cases/` directory.
2.  Define the `input` (GPS coordinates, claimed owner name).
3.  Define the `goldenOutput` with the expected key values for the final report. You may need to run the pipeline once, manually verify the output, and then save it as the golden standard.
4.  The test suite will automatically pick up and run the new test case.
