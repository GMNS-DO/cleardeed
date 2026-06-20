# EOW Odisha Khordha Blacklist Fetcher

Implements the **Surya Nirman Multi-Investor Fraud (Bhubaneswar 2017-2023)**
detection rule from `CLAUDE.md` Section 8.1 (Fraud Pattern 2).

Task: **T-049 — Build EOW Khordha blacklist fetcher**.

## What this fetcher does

Cross-references a buyer query (plot + khata + village + owner name) against
a curated blacklist of EOW-attached properties and arrested persons in
Khordha district. Returns a structured severity decision:

- **CRITICAL** — plot / khata match against an attached property
- **HIGH WATCH-OUT** — owner name match against an arrested person

The blacklist is stored at `data/khordha_eow_blacklist.json` and is the
durable source of truth. The fetcher does not perform any network I/O at
match time — `matchBlacklist()` is synchronous and offline-safe.

## Live-site status

**As of the initial implementation (2026-06-19):** the domain
`eowodisha.gov.in` does not resolve from the build environment, and
`odishapolice.gov.in` times out on connect. The probe script
(`scripts/probe-eow.mjs`) attempts every plausible EOW endpoint and
records the failure mode in the fixture output.

When the live site is reachable, the refresh path is:

1. `scripts/probe-eow.mjs` walks the press-release listing, captures each
   release's HTML, and saves raw fixtures under `fixtures/`.
2. `fetch({ pressReleases: [...] })` parses each release via
   `parsePressRelease()` and merges the results into the blacklist.
3. `saveBlacklist()` writes the merged result back to
   `data/khordha_eow_blacklist.json`.

Until the live site is reachable, the blacklist stays empty and
`matchBlacklist()` returns `matched: false` for every query. This is the
correct safe-default behavior: a missing blacklist must not produce false
negatives because we never saw the data, only false positives because we
guessed.

## API surface

```ts
import { matchBlacklist, fetch, healthCheck } from "@cleardeed/fetcher-eow";

// Query side (orchestrator path)
const result = matchBlacklist({
  plotNo: "415",
  khataNo: "94",
  village: "Mendhasala",
  ownerName: "Krushnachandra Barajena",
});
// result.data.overallSeverity === "critical" | "high_watch_out" | undefined

// Refresh side (probe / scheduled job)
const refreshed = await fetch({ pressReleases: [...] });

// Liveness probe
const health = await healthCheck();
```

## Layout

```
packages/fetchers/eow/
├── README.md
├── PROBE-RESULT.md                 (probe findings)
├── package.json
├── tsconfig.json
├── data/
│   └── khordha_eow_blacklist.json  (curated blacklist)
├── fixtures/
│   └── press-release-sample.html   (synthetic fixture)
├── scripts/
│   └── probe-eow.mjs               (runnable probe)
└── src/
    ├── blacklist.ts                (load, save, matchPlot, matchOwner)
    ├── parse.ts                    (parsePressRelease, htmlToText, etc.)
    └── index.ts                    (fetch, matchBlacklist, healthCheck)
```

## Out of scope

- This package is **not** wired into the orchestrator's `Promise.all`. It
  exposes a query surface the orchestrator can call when it is ready.
- The live EOW site probe and captcha handling are deferred until the
  domain resolves.
- The fetcher does not modify `agents/consumer-report-writer/`,
  `packages/orchestrator/`, or `apps/web/`.
