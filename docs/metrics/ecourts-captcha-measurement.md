# eCourts Captcha Measurement

Last updated: 2026-04-30
Status: measurement harness ready; live 10-run sample blocked by portal access from this environment

## Purpose

Measure whether ClearDeed can distinguish a true eCourts zero-case result from captcha failure. A zero-case result is not usable as reassuring report copy unless the captcha was accepted and the search returned no records.

## Latest Environment Check

Recorded artifact: `docs/metrics/ecourts-captcha-measurement-2026-04-30.json`

- `healthCheck()` via Playwright returned `false`.
- Direct `curl` to the eCourts case-status page returned HTTP `403`.
- Valid 10-run captcha solve-rate measurement was not completed from this environment.
- Operational consequence: eCourts negative output remains manual-required/L1 unless a later run records accepted captcha attempts and complete negative-result metadata. The report must not render "No active cases" from this source state.

## Current Instrumentation

`packages/fetchers/ecourts/src/index.ts` now records per-attempt metadata:

- Khurda court complex searched: Bhubaneswar, Khurda, Banapur, Jatni, Tangi
- OCR text and confidence when Tesseract returns it
- result-panel outcome: `captcha_failed`, `no_records`, `cases_found`, `portal_error`, or `unknown`
- per-attempt result artifact hash
- aggregate captcha accepted/failed counts

## Live Run Command

Run from repo root. This writes only to `/tmp` and does not change tracked files.

```bash
PARTY="Mohapatra" npx tsx --eval '
import { ecourtsFetch, cleanup } from "./packages/fetchers/ecourts/src/index.ts";
(async () => {
  const out = [];
  for (let i = 1; i <= 10; i++) {
    const startedAt = new Date().toISOString();
    const r = await ecourtsFetch({ partyName: process.env.PARTY ?? "Mohapatra" });
    const metadata = r.data?.searchMetadata;
    const row = {
      i,
      startedAt,
      status: r.status,
      statusReason: r.statusReason,
      attempts: r.attempts,
      total: r.data?.total ?? null,
      captchaAcceptedCount: metadata?.captchaAcceptedCount ?? 0,
      captchaFailedCount: metadata?.captchaFailedCount ?? 0,
      complexesTried: metadata?.complexesTried ?? [],
      outcomes: metadata?.attempts?.map((attempt) => ({
        complexName: attempt.complexName,
        outcome: attempt.outcome,
        ocrText: attempt.ocrText,
        ocrConfidence: attempt.ocrConfidence,
      })) ?? [],
      error: r.error ?? null,
      hash: r.rawArtifactHash ?? null,
    };
    out.push(row);
    console.log(JSON.stringify(row));
    await new Promise((resolve) => setTimeout(resolve, 15000));
  }
  await cleanup();
  const summary = out.reduce((acc, row) => {
    acc.runs += 1;
    acc.captchaAcceptedRuns += row.captchaAcceptedCount > 0 ? 1 : 0;
    acc.captchaFailedRuns += row.captchaFailedCount > 0 && row.captchaAcceptedCount === 0 ? 1 : 0;
    acc.totalCases += row.total ?? 0;
    return acc;
  }, { runs: 0, captchaAcceptedRuns: 0, captchaFailedRuns: 0, totalCases: 0 });
  console.error("summary", JSON.stringify(summary));
})();
' | tee /tmp/ecourts-10-attempts.jsonl
```

## Copy Gate

- `captchaAcceptedCount > 0` and `total === 0`: may show a source-scoped no-record value with manual verification copy.
- captcha solve rate `<80%`: eCourts negative result remains L1/L2 and must not render as L3.
- `captchaFailedCount > 0` with no accepted attempt: report must say court search was not verified.
- RCCMS remains manual/placeholder, so eCourts alone cannot create clean court-clearance language.
