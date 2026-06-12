# CERSAI OCR accuracy scaffold

CERSAI is the captcha-gated Central Registry of Securitisation Asset
Reconstruction. The fetcher (`packages/fetchers/cersai/src/index.ts`) solves
the captcha via Tesseract.js before submitting a search.

Captcha OCR accuracy is the silent killer for this fetcher. A 95% OCR accuracy
looks fine in tests but breaks 1-in-20 search submissions in production, and
CERSAI rate-limits aggressively on failed captcha attempts. We need a
dedicated accuracy benchmark, tracked separately from the fetcher contract.

## What goes here

- **`captcha_001.png` … `captcha_030.png`** — 30 captcha images harvested from
  the live CERSAI portal. Use `scripts/probe/cersai-captcha-harvest.ts` (to be
  added) to grab fresh images. Re-harvest weekly — the captcha generator may
  rotate fonts/distortion.
- **`ground_truth_captchas.json`** — a JSON object mapping each filename to the
  expected OCR result (the case-sensitive alphanumeric string the captcha
  image actually decodes to). Format:
  ```json
  {
    "captcha_001.png": "X7Q4P2",
    "captcha_002.png": "M3K9ZB",
    …
  }
  ```
- The accuracy benchmark itself (a Vitest suite that runs the 30 captchas
  through Tesseract with the production config and asserts ≥80% match) will
  live in `qa/fetcher_tests/cersai.test.ts` (the contract test) as a separate
  `describe` block — but it is NOT wired up in V2. Wire-up is in V4 (CI
  integration).

## When to add this

V2 is scaffolding only. The contract tests pass without this directory being
populated. The accuracy benchmark becomes a CI gate in V4. Before that:

1. Founder manually captures 30 captchas (or runs the harvest script).
2. Founder types out the expected answer for each.
3. The directory lands in git so the test can re-run deterministically.

## How the benchmark should work (V4)

```ts
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createWorker } from "tesseract.js";

const DIR = "qa/fetcher_tests/cersai_ocr";
const groundTruth = JSON.parse(
  readFileSync(join(DIR, "ground_truth_captchas.json"), "utf8")
);

describe("CERSAI captcha OCR accuracy", () => {
  it("achieves ≥80% match across 30 captchas", async () => {
    const worker = await createWorker("eng");
    let correct = 0;
    for (const [file, expected] of Object.entries(groundTruth)) {
      const { data } = await worker.recognize(join(DIR, file));
      if (data.text.trim().toUpperCase() === expected.toUpperCase()) {
        correct += 1;
      }
    }
    await worker.terminate();
    const accuracy = correct / Object.keys(groundTruth).length;
    expect(accuracy).toBeGreaterThanOrEqual(0.8);
  });
});
```

Until the 30 captchas are added, this test is skipped.

## Files in this directory

For V2 this directory contains only this README. The captchas and ground-truth
JSON are added by the founder before V4.
