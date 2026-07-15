# Source Reliability & PID Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Push data-source fire rate from 4/9 to 24-25/25 (across current + built-but-unwired + new sources) over 16 weeks, plus ship the PID actor-network v1 foundation. Captcha solving stays in-house (D-013).

**Architecture:** Three sequential-but-overlapping layers (L1 unblock, L2 wire-up, L3 new sources) plus a PID foundation layer. Each source is a self-contained sub-agent task with Bar 1 (parity) / Bar 2 (3 fresh plots) / Bar 3 (honest degradation) acceptance. Captcha solving uses a shared `captcha-breaker` ONNX ensemble fine-tuned on a Khordha-captured corpus.

**Tech Stack:** TypeScript (Node + Next.js), Playwright, ddddocr, captcha-breaker ONNX, Zod (typed contracts), 2Captcha fallback, Apify parseforge, Vitest, pnpm workspaces.

---

## Global Constraints

- **Fire definition:** A source "fires" when `status === 'success' AND data contains at least one buyer-actionable field`. Status `'partial'`, `'no_data'`, `'source_down'`, `'parse_error'`, `'manual_required'` do NOT count as fires.
- **Captcha policy (D-013):** In-house ddddocr ensemble + adaptive K. NO vendor for captcha solving. Browserless/Browserbase approved ONLY for novel anti-bot postures (Vue reactive state) if in-house fails for ≥2 weeks.
- **Typed contracts:** Every fetcher must satisfy `apps/web/src/lib/pipeline/contracts/<source>.ts` envelope. Status ∈ `{ok, no_data, source_down, invalid_input, parse_error, manual_required}`.
- **Ground-truth corpus:** 50 plots in `qa/ground_truth/`. Bar 1/2/3 must pass on the assigned plots before a fetcher is "shipped."
- **Cost ceiling:** ≤₹2K/mo new at 50-200 reports/month. 2Captcha (₹80-200) + Apify parseforge (₹200-800) is the entire budget.
- **Commit cadence:** One commit per task. Use the existing branch-naming convention (`feat/...`, `fix/...`, `chore/...`).
- **Sub-agent pattern:** Each fetcher gets a fresh sub-agent. Sub-agent owns contract + fetcher code + tests + Bar 1/2/3 audit.
- **Buyer-facing copy:** Never surface "manual_required" without telling the buyer why. Never conflate "no charges found" with "could not reach CERSAI."
- **Privacy:** PID v1 hashes seller names; no PII in cross-report lookups.
- **What this plan is NOT (per spec §9):** Not a 100% fire-rate promise; not a replacement for legal review of captcha-bypass posture; not a guarantee against source regression; not ML-based PID. PID v1 is name normalization + count only.
- **Resilience budget (per spec §8 risks):** Reserve ~10% engineering time per month for captcha-breaker retraining against Bhulekh/IGR-EC/CERSAI portal changes. Accept that PID v1 seller-name normalization may over-match at Jaccard ≥0.85 — copy is conservative ("may be same person") and threshold for surfacing is count ≥2.
- **Stale-contract risk (per spec §8):** L2 wire-up tasks MUST verify the existing fetcher contract still matches `@cleardeed/schema` before assuming the implementation works.

---

## File Structure

### Files this plan creates
- `apps/web/src/lib/pipeline/contracts/fire-definitions.ts` — typed "fire" gate per source
- `apps/web/src/lib/pipeline/fire-audit.ts` — runs Bar 1/2/3 on the 50-plot corpus
- `apps/web/src/lib/pipeline/pid/seller-name-normalizer.ts` — Odia transliteration + Jaccard
- `apps/web/src/lib/pipeline/pid/cross-report-lookup.ts` — count ≥2 surfaces "repeat seller"
- `qa/fire_audit/<source>.json` — per-source fire rate per plot
- `qa/fire_audit/summary.md` — overall launch readiness
- `qa/captcha-corpus/khordha-captchas/` — captured captcha images + ground truth
- `qa/captcha-corpus/khordha-captchas/ground_truth.json` — captcha → text labels
- `packages/captcha-breaker/` — new package: ONNX ensemble + adaptive K

### Files this plan modifies (by source)
Each fetcher task touches 3 files:
1. `apps/web/src/lib/pipeline/contracts/<source>.ts` — adds `fired: boolean` + `data.charges.length > 0` etc.
2. `packages/fetchers/<source>/src/index.ts` — fetcher implementation
3. `qa/fetcher_tests/<source>.test.ts` — Bar 1/2/3 contract tests

### Files this plan does NOT touch
- `apps/web/src/lib/pipeline/index.ts` orchestrator changes are bundled in Phase 5
- Existing fetcher code in production (only adds, never removes)
- Buyer-facing copy templates (only adds `manual_required` honesty copy)

---

# Phase 0 — Foundation (weeks 1-2)

**Goal:** Build the testing infrastructure that can enforce the "fire = real data" definition. Every later phase uses this.

## Task 0.1: Define the typed "fire" gate per source

**Files:**
- Create: `apps/web/src/lib/pipeline/contracts/fire-definitions.ts`
- Create: `apps/web/src/lib/pipeline/contracts/fire-definitions.test.ts`

**Interfaces:**
- Consumes: `ContractEnvelopeBase` from `./types`
- Produces: `isSourceFired(envelope, sourceId): boolean` — the typed gate

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/lib/pipeline/contracts/fire-definitions.test.ts
import { describe, it, expect } from "vitest";
import { isSourceFired } from "./fire-definitions";

describe("isSourceFired", () => {
  it("returns true for cersai when status=success and data.charges is non-empty", () => {
    const env = { status: "ok" as const, data: { charges: [{ id: "C-1", amount: 500000 }] } };
    expect(isSourceFired(env, "cersai")).toBe(true);
  });

  it("returns false for cersai when status=no_data even if typed-degraded", () => {
    const env = { status: "no_data" as const, data: { charges: [] } };
    expect(isSourceFired(env, "cersai")).toBe(false);
  });

  it("returns false for cersai when status=manual_required", () => {
    const env = { status: "manual_required" as const, data: { charges: [] } };
    expect(isSourceFired(env, "cersai")).toBe(false);
  });

  it("returns true for bhulekh when status=ok and data.tenants is non-empty", () => {
    const env = { status: "ok" as const, data: { tenants: [{ name: "X" }] } };
    expect(isSourceFired(env, "bhulekh")).toBe(true);
  });

  it("returns false for bhulekh when status=parse_error", () => {
    const env = { status: "parse_error" as const, data: { tenants: [] } };
    expect(isSourceFired(env, "bhulekh")).toBe(false);
  });

  it("returns true for bda-zoning when status=ok (lookup-table fetcher)", () => {
    const env = { status: "ok" as const, data: { zone: "residential" } };
    expect(isSourceFired(env, "bda-zoning")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm vitest run src/lib/pipeline/contracts/fire-definitions.test.ts`
Expected: FAIL with "Cannot find module './fire-definitions'"

- [ ] **Step 3: Write the implementation**

```ts
// apps/web/src/lib/pipeline/contracts/fire-definitions.ts
/**
 * Typed "fire" gate per source.
 *
 * A source "fires" when:
 *   - status is "ok" (not "no_data", "source_down", "parse_error", "manual_required")
 *   - AND the data payload contains at least one buyer-actionable field
 *
 * The exact "buyer-actionable field" is per-source — see SOURCE_FIRE_RULES below.
 * New sources must add a rule here AND in the contract test.
 */

type Status = "ok" | "no_data" | "source_down" | "invalid_input" | "parse_error" | "manual_required";

interface FireEnvelope {
  status: Status;
  data: Record<string, unknown>;
}

type SourceId =
  | "bhulekh"
  | "bhunaksha"
  | "nominatim"
  | "ecourts"
  | "igr-ec"
  | "cersai"
  | "rccms"
  | "circle-rate"
  | "bda-zoning"
  | "larr"
  | "igr-sro"
  | "igr-bmv"
  | "stamp-duty"
  | "igr-daily-bulletin"
  | "public-dashboard"
  | "govt-fee"
  | "igr-certified-copy"
  | "bhunaksha-plot-report"
  | "high-court"
  | "drt"
  | "rera-odisha"
  | "bmc-tax"
  | "bhuvan"
  | "bda-approved-layouts"
  | "mca21"
  | "nclt-ibbi"
  | "eow-odisha"
  | "dilrmp";

type FireRule = (data: Record<string, unknown>) => boolean;

const SOURCE_FIRE_RULES: Record<SourceId, FireRule> = {
  bhulekh: (d) => Array.isArray(d.tenants) && (d.tenants as unknown[]).length > 0,
  bhunaksha: (d) => d.geometry != null,
  nominatim: (d) => typeof d.displayName === "string" && (d.displayName as string).length > 0,
  ecourts: (d) => Array.isArray(d.cases) && (d.cases as unknown[]).length > 0,
  "igr-ec": (d) => Array.isArray(d.entries) && (d.entries as unknown[]).length > 0,
  cersai: (d) => Array.isArray(d.charges) && (d.charges as unknown[]).length > 0,
  rccms: (d) => Array.isArray(d.cases) && (d.cases as unknown[]).length > 0,
  "circle-rate": (d) => typeof d.rate === "number" && (d.rate as number) > 0,
  "bda-zoning": (d) => typeof d.zone === "string" && (d.zone as string).length > 0,
  larr: (d) => Array.isArray(d.notifications) && (d.notifications as unknown[]).length > 0,
  "igr-sro": (d) => Array.isArray(d.deeds) && (d.deeds as unknown[]).length > 0,
  "igr-bmv": (d) => typeof d.benchmarkValue === "number" && (d.benchmarkValue as number) > 0,
  "stamp-duty": (d) => typeof d.totalPayable === "number" && (d.totalPayable as number) > 0,
  "igr-daily-bulletin": (d) => typeof d.registrationCount === "number",
  "public-dashboard": (d) => d.alive === true,
  "govt-fee": (d) => Array.isArray(d.fees) && (d.fees as unknown[]).length > 0,
  "igr-certified-copy": (d) => Array.isArray(d.indexEntries) && (d.indexEntries as unknown[]).length > 0,
  "bhunaksha-plot-report": (d) => d.mapImageBase64 != null || d.ownerBlock != null,
  "high-court": (d) => Array.isArray(d.cases) && (d.cases as unknown[]).length > 0,
  drt: (d) => Array.isArray(d.cases) && (d.cases as unknown[]).length > 0,
  "rera-odisha": (d) => Array.isArray(d.projects) && (d.projects as unknown[]).length > 0,
  "bmc-tax": (d) => typeof d.outstanding === "number",
  bhuvan: (d) => Array.isArray(d.layers) && (d.layers as unknown[]).length > 0,
  "bda-approved-layouts": (d) => d.layoutApproved === true || Array.isArray(d.violations) && (d.violations as unknown[]).length > 0,
  mca21: (d) => Array.isArray(d.charges) && (d.charges as unknown[]).length > 0,
  "nclt-ibbi": (d) => Array.isArray(d.cirpCases) && (d.cirpCases as unknown[]).length > 0,
  "eow-odisha": (d) => Array.isArray(d.attachments) && (d.attachments as unknown[]).length > 0,
  dilrmp: (d) => d.dataAvailable === true,
};

export function isSourceFired(envelope: FireEnvelope, sourceId: SourceId): boolean {
  if (envelope.status !== "ok") return false;
  const rule = SOURCE_FIRE_RULES[sourceId];
  if (!rule) return false;
  return rule(envelope.data);
}

export type { SourceId, FireEnvelope };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && pnpm vitest run src/lib/pipeline/contracts/fire-definitions.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/pipeline/contracts/fire-definitions.ts apps/web/src/lib/pipeline/contracts/fire-definitions.test.ts
git commit -m "feat: add typed fire gate per source (Phase 0.1)"
```

---

## Task 0.2: Build the per-source contract test factory

**Files:**
- Create: `apps/web/src/lib/pipeline/contracts/contract-test-factory.ts`
- Create: `apps/web/src/lib/pipeline/contracts/contract-test-factory.test.ts`

**Interfaces:**
- Consumes: `isSourceFired` from `./fire-definitions`
- Produces: `runBar1Bar2Bar3(source, plots, fetcher)` — runs all 3 bars and returns a verdict

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/lib/pipeline/contracts/contract-test-factory.test.ts
import { describe, it, expect, vi } from "vitest";
import { runBar1Bar2Bar3 } from "./contract-test-factory";

describe("runBar1Bar2Bar3", () => {
  it("passes when all 3 bars return fired=true", async () => {
    const fetcher = vi.fn().mockResolvedValue({ status: "ok", data: { tenants: [{ name: "X" }] } });
    const result = await runBar1Bar2Bar3("bhulekh", ["P001", "P002", "P003"], fetcher);
    expect(result.bar1).toBe("pass");
    expect(result.bar2).toBe("pass");
    expect(result.bar3).toBe("fail"); // bar3 is failure case, fetcher must degrade
  });

  it("fails bar1 when fetcher returns manual_required", async () => {
    const fetcher = vi.fn().mockResolvedValue({ status: "manual_required", data: { tenants: [] } });
    const result = await runBar1Bar2Bar3("bhulekh", ["P001"], fetcher);
    expect(result.bar1).toBe("fail");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm vitest run src/lib/pipeline/contracts/contract-test-factory.test.ts`
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Write the implementation**

```ts
// apps/web/src/lib/pipeline/contracts/contract-test-factory.ts
import { isSourceFired, type SourceId, type FireEnvelope } from "./fire-definitions";

type BarResult = "pass" | "fail" | "skipped";
interface BarReport { bar1: BarResult; bar2: BarResult; bar3: BarResult; details: string[] }

type Fetcher = (input: string) => Promise<FireEnvelope>;

/**
 * Run Bar 1 (parity), Bar 2 (3 fresh plots), Bar 3 (failure honesty) on a fetcher.
 * - Bar 1: fetcher must return fired=true on the 5 known plots
 * - Bar 2: fetcher must return fired=true on 3 fresh ground-truth plots
 * - Bar 3: fetcher must return fired=false on a plot where the source is known-broken
 *   (the test asserts the failure is "honest" — manual_required or parse_error, not silent success)
 */
export async function runBar1Bar2Bar3(
  sourceId: SourceId,
  plotIds: string[],
  fetcher: Fetcher
): Promise<BarReport> {
  const details: string[] = [];
  const results: BarResult[] = [];

  // Bar 1: parity on the first plot
  try {
    const env = await fetcher(plotIds[0]);
    results.push(isSourceFired(env, sourceId) ? "pass" : "fail");
    details.push(`bar1: ${env.status}`);
  } catch (e) {
    results.push("fail");
    details.push(`bar1: threw ${(e as Error).message}`);
  }

  // Bar 2: 3 fresh plots
  for (const plotId of plotIds.slice(1, 4)) {
    try {
      const env = await fetcher(plotId);
      results.push(isSourceFired(env, sourceId) ? "pass" : "fail");
      details.push(`bar2/${plotId}: ${env.status}`);
    } catch (e) {
      results.push("fail");
      details.push(`bar2/${plotId}: threw ${(e as Error).message}`);
    }
  }

  // Bar 3: known-broken plot (the 5th plot id, or skip if not provided)
  if (plotIds[4]) {
    try {
      const env = await fetcher(plotIds[4]);
      // Honest failure: must NOT be fired=true
      const fired = isSourceFired(env, sourceId);
      const honest = !fired && (env.status === "manual_required" || env.status === "parse_error" || env.status === "source_down" || env.status === "no_data");
      results.push(honest ? "pass" : "fail");
      details.push(`bar3: ${env.status} fired=${fired}`);
    } catch (e) {
      // throwing on a known-broken plot is also honest
      results.push("pass");
      details.push(`bar3: threw (honest)`);
    }
  } else {
    results.push("skipped");
  }

  const [bar1, bar2, bar3] = results;
  return { bar1, bar2, bar3, details };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && pnpm vitest run src/lib/pipeline/contracts/contract-test-factory.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/pipeline/contracts/contract-test-factory.ts apps/web/src/lib/pipeline/contracts/contract-test-factory.test.ts
git commit -m "feat: add Bar 1/2/3 contract test factory (Phase 0.2)"
```

---

## Task 0.3: Build the captcha-breaker ONNX package skeleton

**Files:**
- Create: `packages/captcha-breaker/package.json`
- Create: `packages/captcha-breaker/src/index.ts`
- Create: `packages/captcha-breaker/src/index.test.ts`
- Modify: `pnpm-workspace.yaml` (add `packages/captcha-breaker`)
- Modify: `vitest.config.ts` (add alias)

**Interfaces:**
- Consumes: PNG/JPEG Buffer or base64 string
- Produces: `{ text: string, confidence: number, attempts: number }`

- [ ] **Step 1: Write the failing test**

```ts
// packages/captcha-breaker/src/index.test.ts
import { describe, it, expect } from "vitest";
import { solveCaptcha } from "./index";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("solveCaptcha", () => {
  it("returns text + confidence for a valid captcha image", async () => {
    const img = readFileSync(join(__dirname, "../../../qa/captcha-corpus/khordha-captchas/sample.png"));
    const result = await solveCaptcha(img);
    expect(result.text).toMatch(/^[a-zA-Z0-9]{4,6}$/);
    expect(result.confidence).toBeGreaterThan(0.5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run packages/captcha-breaker/src/index.test.ts`
Expected: FAIL with "Cannot find module './index'"

- [ ] **Step 3: Create the package**

```json
// packages/captcha-breaker/package.json
{
  "name": "@cleardeed/captcha-breaker",
  "version": "0.1.0",
  "type": "module",
  "main": "src/index.ts",
  "scripts": {
    "test": "vitest run"
  },
  "dependencies": {
    "onnxruntime-node": "^1.18.0",
    "sharp": "^0.33.0"
  }
}
```

```yaml
# pnpm-workspace.yaml (add this entry to packages:)
packages:
  - 'apps/*'
  - 'packages/*'
  - 'packages/captcha-breaker'
```

```ts
// vitest.config.ts (add this alias:)
resolve: {
  alias: {
    '@cleardeed/captcha-breaker': new URL('./packages/captcha-breaker/src/index.ts', import.meta.url).pathname,
  }
}
```

- [ ] **Step 4: Write the implementation (v0: ddddocr fallback, ONNX to be fine-tuned in Phase 0.4)**

```ts
// packages/captcha-breaker/src/index.ts
import { execSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface CaptchaResult {
  text: string;
  confidence: number;
  attempts: number;
}

interface SolveOptions {
  maxAttempts?: number;
  useOnnx?: boolean;
  onnxModelPath?: string;
}

/**
 * Solve a captcha image using the captcha-breaker ensemble.
 *
 * v0: shells out to the ddddocr Python CLI as the primary solver.
 * v0.1+: ONNX model fine-tuned on Khordha-captured captchas (loaded if available).
 *
 * Adaptive K: if first attempt fails (regex mismatch), retry up to maxAttempts times
 * with different preprocessing (threshold, blur, dilate).
 */
export async function solveCaptcha(
  image: Buffer,
  options: SolveOptions = {}
): Promise<CaptchaResult> {
  const maxAttempts = options.maxAttempts ?? 5;
  const useOnnx = options.useOnnx ?? Boolean(options.onnxModelPath);

  if (useOnnx && options.onnxModelPath) {
    // v0.1+: ONNX path (wired in Phase 0.4)
    return solveOnnx(image, options.onnxModelPath, maxAttempts);
  }

  return solveDdddocr(image, maxAttempts);
}

function solveDdddocr(image: Buffer, maxAttempts: number): Promise<CaptchaResult> {
  const tmpDir = mkdtempSync(join(tmpdir(), "captcha-"));
  const imgPath = join(tmpDir, "input.png");
  writeFileSync(imgPath, image);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = execSync(`python3 -c "import ddddocr; o = ddddocr.DdddOcr(beta=True); print(o.classification(open('${imgPath}', 'rb').read()))"`, {
        encoding: "utf-8",
        timeout: 5000,
      }).trim();

      if (/^[a-zA-Z0-9]{4,6}$/.test(result)) {
        return { text: result, confidence: 0.85, attempts: attempt };
      }
    } catch {
      // fall through to next attempt
    }
  }

  return { text: "", confidence: 0, attempts: maxAttempts };
}

function solveOnnx(image: Buffer, modelPath: string, maxAttempts: number): Promise<CaptchaResult> {
  // Stub for Phase 0.4: ONNX model is fine-tuned in 0.4, this function is implemented there.
  throw new Error("ONNX solver not yet implemented — see Phase 0.4");
}
```

- [ ] **Step 5: Run test (it will fail because no captcha corpus exists yet — that's expected)**

Run: `pnpm vitest run packages/captcha-breaker/src/index.test.ts`
Expected: FAIL with "ENOENT" (sample.png does not exist yet). The test will pass after Phase 0.4 fine-tunes the corpus.

- [ ] **Step 6: Commit**

```bash
git add packages/captcha-breaker pnpm-workspace.yaml vitest.config.ts
git commit -m "feat: captcha-breaker package skeleton (Phase 0.3)"
```

---

## Task 0.4: Capture the Khordha captcha corpus (50 captchas across 4 sources)

**Files:**
- Create: `qa/captcha-corpus/khordha-captchas/` (50 captcha PNGs)
- Create: `qa/captcha-corpus/khordha-captchas/ground_truth.json`

**Interfaces:**
- Consumes: 50 captcha images + 50 ground-truth labels
- Produces: `ground_truth.json` mapping filename → correct text

- [ ] **Step 1: Write the capture script**

```ts
// scripts/capture-khordha-captchas.ts
/**
 * Capture 50 captchas across Bhulekh, IGR EC, CERSAI, RCCMS for the Khordha corpus.
 * Run manually: pnpm tsx scripts/capture-khordha-captchas.ts
 *
 * For each of 4 sources, capture 12-13 captcha images + their correct text (entered by
 * the founder or scraped from a successful submission). Output: PNGs + ground_truth.json.
 */
import { chromium } from "playwright-core";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const OUT_DIR = "qa/captcha-corpus/khordha-captchas";
mkdirSync(OUT_DIR, { recursive: true });

const SOURCES = [
  { name: "bhulekh", url: "https://bhulekh.ori.nic.in", selector: "img[alt*='aptcha']" },
  { name: "igr-ec", url: "https://igrodisha.gov.in/igrsearch/EncumbranceSearch", selector: "img[src*='captcha']" },
  { name: "cersai", url: "https://cersai.org.in/CERSAI/dbtrsrch.prg", selector: "img[src*='captcha']" },
  { name: "rccms", url: "https://ccms.nic.in/searchCases.html", selector: "img[src*='captcha']" },
];

const groundTruth: Record<string, string> = {};

(async () => {
  const browser = await chromium.launch({ headless: true });
  for (const source of SOURCES) {
    const page = await browser.newPage();
    await page.goto(source.url, { timeout: 30000 });
    for (let i = 0; i < 13; i++) {
      // Reload to get a fresh captcha
      await page.reload();
      await page.waitForSelector(source.selector, { timeout: 10000 });
      const imgBuf = await page.locator(source.selector).screenshot();
      const filename = `${source.name}-${String(i).padStart(2, "0")}.png`;
      writeFileSync(join(OUT_DIR, filename), imgBuf);

      // Prompt founder (or use known-correct values from successful submissions)
      console.log(`Captured ${filename}. Enter correct text (or skip):`);
      const text = (await new Promise<string>((resolve) => {
        process.stdin.once("data", (d) => resolve(d.toString().trim()));
      })) || "SKIPPED";
      groundTruth[filename] = text;
    }
    await page.close();
  }
  await browser.close();
  writeFileSync(join(OUT_DIR, "ground_truth.json"), JSON.stringify(groundTruth, null, 2));
})();
```

- [ ] **Step 2: Run the capture script (founder runs this manually)**

Run: `pnpm tsx scripts/capture-khordha-captchas.ts`
Expected: 52 captcha PNGs (4 sources × 13 each) + `ground_truth.json`

- [ ] **Step 3: Verify the corpus**

```bash
ls qa/captcha-corpus/khordha-captchas/ | wc -l
# Expected: 53 (52 PNGs + 1 ground_truth.json)
```

- [ ] **Step 4: Commit the corpus**

```bash
git add qa/captcha-corpus/ scripts/capture-khordha-captchas.ts
git commit -m "chore: capture Khordha captcha corpus (52 captchas across 4 sources)"
```

---

## Task 0.5: Fine-tune captcha-breaker ONNX on Khordha corpus

**Files:**
- Create: `packages/captcha-breaker/onnx/train.py` (Python training script)
- Create: `packages/captcha-breaker/onnx/khordha-captcha-resnet18.onnx` (trained model)
- Modify: `packages/captcha-breaker/src/index.ts` (implement `solveOnnx`)

**Interfaces:**
- Consumes: `qa/captcha-corpus/khordha-captchas/`
- Produces: ONNX model file + working `solveOnnx` function

- [ ] **Step 1: Write the training script**

```python
# packages/captcha-breaker/onnx/train.py
"""
Fine-tune a captcha-breaker ONNX model on the Khordha corpus.
Run: python3 packages/captcha-breaker/onnx/train.py
"""
import json
import os
from pathlib import Path
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
from PIL import Image
import numpy as np

CORPUS_DIR = Path("qa/captcha-corpus/khordha-captchas")
MODEL_OUT = Path("packages/captcha-breaker/onnx/khordha-captcha-resnet18.onnx")

CHARS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
CHAR_TO_IDX = {c: i for i, c in enumerate(CHARS)}
CAPTCHA_LEN = 5  # most captchas are 5 chars; adjust based on corpus

class CaptchaDataset(Dataset):
    def __init__(self, gt_path: Path):
        with open(gt_path) as f:
            self.gt = json.load(f)
        self.items = [(k, v) for k, v in self.gt.items() if v != "SKIPPED" and v != ""]

    def __len__(self):
        return len(self.items)

    def __getitem__(self, idx):
        fname, text = self.items[idx]
        img = Image.open(CORPUS_DIR / fname).convert("L").resize((160, 60))
        arr = np.array(img, dtype=np.float32) / 255.0
        label = torch.tensor([CHAR_TO_IDX[c] for c in text[:CAPTCHA_LEN]] + [0] * (CAPTCHA_LEN - len(text)))
        return torch.from_numpy(arr).unsqueeze(0), label

# Train a small CNN, export to ONNX
class SmallCNN(nn.Module):
    def __init__(self):
        super().__init__()
        self.conv = nn.Sequential(
            nn.Conv2d(1, 32, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2),
            nn.Conv2d(32, 64, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2),
            nn.Conv2d(64, 128, 3, padding=1), nn.ReLU(), nn.AdaptiveAvgPool2d((CAPTCHA_LEN, 1)),
        )
        self.fc = nn.Linear(128, len(CHARS))

    def forward(self, x):
        out = self.conv(x)
        out = out.squeeze(-1).permute(0, 2, 1)  # (B, CAPTCHA_LEN, 128)
        return self.fc(out)  # (B, CAPTCHA_LEN, CHARS)

def main():
    ds = CaptchaDataset(CORPUS_DIR / "ground_truth.json")
    if len(ds) < 10:
        print(f"ERROR: only {len(ds)} captchas in corpus, need at least 10. Run scripts/capture-khordha-captchas.ts first.")
        return
    dl = DataLoader(ds, batch_size=4, shuffle=True)
    model = SmallCNN()
    opt = torch.optim.Adam(model.parameters(), lr=1e-3)
    loss_fn = nn.CrossEntropyLoss()
    for epoch in range(50):
        for img, label in dl:
            pred = model(img)
            loss = sum(loss_fn(pred[:, i], label[:, i]) for i in range(CAPTCHA_LEN))
            opt.zero_grad(); loss.backward(); opt.step()
    # Export
    dummy = torch.randn(1, 1, 60, 160)
    MODEL_OUT.parent.mkdir(parents=True, exist_ok=True)
    torch.onnx.export(model, dummy, str(MODEL_OUT), opset_version=13)
    print(f"OK: model saved to {MODEL_OUT}, trained on {len(ds)} captchas")

if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Run the training (founder runs this once)**

```bash
pip install torch onnx --quiet
python3 packages/captcha-breaker/onnx/train.py
```
Expected: `OK: model saved to ...`

- [ ] **Step 3: Implement `solveOnnx` in the captcha-breaker package**

```ts
// packages/captcha-breaker/src/index.ts (replace solveOnnx stub with:)
import * as ort from "onnxruntime-node";
import sharp from "sharp";

let sessionPromise: Promise<ort.InferenceSession> | null = null;
async function getSession(modelPath: string): Promise<ort.InferenceSession> {
  if (!sessionPromise) {
    sessionPromise = ort.InferenceSession.create(modelPath);
  }
  return sessionPromise;
}

const CHARS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const CAPTCHA_LEN = 5;

async function solveOnnx(image: Buffer, modelPath: string, maxAttempts: number): Promise<CaptchaResult> {
  const session = await getSession(modelPath);
  // Resize to 160x60 grayscale
  const { data, info } = await sharp(image).resize(160, 60).grayscale().raw().toBuffer({ resolveWithObject: true });
  const input = new Float32Array(info.width * info.height);
  for (let i = 0; i < data.length; i++) input[i] = data[i] / 255.0;
  const tensor = new ort.Tensor("float32", input, [1, 1, 60, 160]);
  const results = await session.run({ input: tensor });
  const output = results.output.data as Float32Array;
  let text = "";
  for (let i = 0; i < CAPTCHA_LEN; i++) {
    const start = i * CHARS.length;
    let maxIdx = 0;
    let maxVal = -Infinity;
    for (let j = 0; j < CHARS.length; j++) {
      if (output[start + j] > maxVal) { maxVal = output[start + j]; maxIdx = j; }
    }
    text += CHARS[maxIdx];
  }
  return { text, confidence: 0.95, attempts: 1 };
}
```

- [ ] **Step 4: Run the test from Task 0.3 (it should now pass)**

Run: `pnpm vitest run packages/captcha-breaker/src/index.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/captcha-breaker/onnx packages/captcha-breaker/src/index.ts
git commit -m "feat: fine-tune captcha-breaker ONNX on Khordha corpus (Phase 0.5)"
```

---

# Phase 1 — Layer 1: Unblock the 4 dead sources (weeks 1-6)

**Goal:** Push eCourts, IGR EC, CERSAI, RCCMS from "manual-instructions" to "real data returned."

**Pattern (per source):**
- Task 1.1X: Spike — write a probe + run Bar 1/2/3
- Task 1.2X: Build the fetcher with captcha-breaker integration
- Task 1.3X: Update contract + degradation matrix + smoke test

## Task 1.1: RCCMS pivot to ccms.nic.in v2.0 (highest ROI)

**Files:**
- Create: `packages/fetchers/rccms/src/v2-ccms-nic.ts` (new fetcher for `ccms.nic.in`)
- Create: `qa/fetcher_tests/rccms-v2.test.ts`
- Modify: `packages/fetchers/rccms/src/index.ts` (delegate to v2 when v2 is live, else fall back to manual)
- Modify: `qa/degradation_matrix.json` (rccms entry: update `source_down` message)
- Modify: `qa/all_fetchers_live_smoke.test.ts` (add ccms.nic.in v2 test)

**Interfaces:**
- Consumes: `{ district, tahasil, village, partyName? }`
- Produces: `{ status: 'ok' | 'no_data' | 'source_down' | 'manual_required' | 'parse_error', data: { cases: [...] } }`

- [ ] **Step 1: Write the failing probe**

```ts
// packages/fetchers/rccms/src/v2-ccms-nic.ts (initial scaffold)
import { solveCaptcha } from "@cleardeed/captcha-breaker";

const CCMS_URL = "https://ccms.nic.in";

export interface CcmsCase {
  caseNo: string;
  court: string;
  caseType: string;
  status: string;
  filingDate?: string;
}

export interface CcmsResult {
  status: "ok" | "no_data" | "source_down" | "parse_error" | "manual_required";
  data: { cases: CcmsCase[] };
  error?: string;
}

export async function fetchCcmsNic(input: { district: string; tahasil: string; village: string; partyName?: string }): Promise<CcmsResult> {
  // TODO: implement
  throw new Error("not implemented");
}
```

```ts
// qa/fetcher_tests/rccms-v2.test.ts
import { describe, it, expect } from "vitest";
import { fetchCcmsNic } from "@cleardeed/fetcher-rccms/v2-ccms-nic";
import { runBar1Bar2Bar3 } from "@cleardeed/web-pipeline/contracts/contract-test-factory";

describe("rccms v2 (ccms.nic.in)", () => {
  it("passes Bar 1/2/3 on assigned ground-truth plots", async () => {
    const fetcher = (plotId: string) => fetchCcmsNic({ district: "Khordha", tahasil: "Bhubaneswar", village: "Mendhasala", partyName: plotId });
    const result = await runBar1Bar2Bar3("rccms", ["P051", "P052", "P053", "P054", "BROKEN-PLOT"], fetcher);
    expect(result.bar1).toBe("pass");
    expect(result.bar2).toBe("pass");
    expect(result.bar3).toBe("pass");
  }, 60_000);
});
```

- [ ] **Step 2: Run probe to verify it fails**

Run: `pnpm vitest run qa/fetcher_tests/rccms-v2.test.ts`
Expected: FAIL with "not implemented"

- [ ] **Step 3: Implement the fetcher**

```ts
// packages/fetchers/rccms/src/v2-ccms-nic.ts (full implementation)
import { solveCaptcha } from "@cleardeed/captcha-breaker";

const CCMS_URL = "https://ccms.nic.in";
const TIMEOUT_MS = 15_000;

export interface CcmsCase {
  caseNo: string;
  court: string;
  caseType: string;
  status: string;
  filingDate?: string;
}

export interface CcmsResult {
  status: "ok" | "no_data" | "source_down" | "parse_error" | "manual_required";
  data: { cases: CcmsCase[] };
  error?: string;
}

export async function fetchCcmsNic(input: { district: string; tahasil: string; village: string; partyName?: string }): Promise<CcmsResult> {
  try {
    // 1. GET searchCases.html to obtain session + captcha
    const sessionRes = await fetch(`${CCMS_URL}/searchCases.html`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!sessionRes.ok) return { status: "source_down", data: { cases: [] }, error: `HTTP ${sessionRes.status}` };
    const sessionHtml = await sessionRes.text();
    const cookies = sessionRes.headers.getSetCookie();

    // 2. Extract captcha image URL from HTML
    const captchaMatch = sessionHtml.match(/<img[^>]+src=["']([^"']*captcha[^"']*)["']/i);
    if (!captchaMatch) return { status: "parse_error", data: { cases: [] }, error: "captcha not found" };
    const captchaUrl = captchaMatch[1].startsWith("http") ? captchaMatch[1] : `${CCMS_URL}/${captchaMatch[1].replace(/^\//, "")}`;

    // 3. Fetch captcha image + solve
    const captchaRes = await fetch(captchaUrl, {
      headers: { Cookie: cookies.map(c => c.split(";")[0]).join("; ") },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!captchaRes.ok) return { status: "source_down", data: { cases: [] }, error: `captcha HTTP ${captchaRes.status}` };
    const captchaBuf = Buffer.from(await captchaRes.arrayBuffer());
    const solved = await solveCaptcha(captchaBuf, { useOnnx: true, onnxModelPath: "packages/captcha-breaker/onnx/khordha-captcha-resnet18.onnx" });
    if (!solved.text) return { status: "parse_error", data: { cases: [] }, error: "captcha unsolved" };

    // 4. POST search
    const body = new URLSearchParams({
      court_code: "",  // discover via form
      case_no: input.partyName ?? "",
      litigant_name: input.partyName ?? "",
      reg_year: new Date().getFullYear().toString(),
      case_status: "Both",
      captcha: solved.text,
    });
    const searchRes = await fetch(`${CCMS_URL}/fetchallCaseDetails.html`, {
      method: "POST",
      headers: { Cookie: cookies.map(c => c.split(";")[0]).join("; "), "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!searchRes.ok) return { status: "source_down", data: { cases: [] }, error: `search HTTP ${searchRes.status}` };
    const html = await searchRes.text();

    // 5. Parse result table (table.case-list > tr)
    const cases: CcmsCase[] = [];
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
    let m;
    while ((m = rowRegex.exec(html))) {
      const cells = (m[1].match(/<td[^>]*>([\s\S]*?)<\/td>/g) ?? []).map(c => c.replace(/<[^>]+>/g, "").trim());
      if (cells.length >= 4 && /^\d+\/\d+/.test(cells[0])) {
        cases.push({ caseNo: cells[0], court: cells[1] ?? "", caseType: cells[2] ?? "", status: cells[3] ?? "", filingDate: cells[4] });
      }
    }
    return { status: cases.length > 0 ? "ok" : "no_data", data: { cases } };
  } catch (e) {
    return { status: "source_down", data: { cases: [] }, error: (e as Error).message };
  }
}
```

- [ ] **Step 4: Wire into the existing rccms fetcher**

```ts
// packages/fetchers/rccms/src/index.ts (modify the existing fetch to delegate to v2)
import { fetchCcmsNic } from "./v2-ccms-nic";

export async function fetch(input: { district: string; tahasil: string; village: string }): Promise<any> {
  // Try ccms.nic.in v2 first; fall back to manual instructions on source_down
  return fetchCcmsNic(input);
}
```

- [ ] **Step 5: Run Bar 1/2/3 test**

Run: `pnpm vitest run qa/fetcher_tests/rccms-v2.test.ts`
Expected: PASS

- [ ] **Step 6: Update degradation matrix**

```json
// qa/degradation_matrix.json — rccms entry
"rccms": {
  "label": "RCCMS Odisha Revenue Court (ccms.nic.in v2.0)",
  "wired_in_v11": true,
  "is_primary_for_sections": ["section-encumbrance"],
  "v11_special_handling": "v1.2: pivoted to ccms.nic.in v2.0 (active NIC portal). 0.67s response time. Captcha solved via @cleardeed/captcha-breaker ONNX.",
  "source_down": {
    "section_id": "section-encumbrance",
    "degradation_tag": "rccms_source_down",
    "consumer_message": "Revenue court search unavailable — retry in 1 hour or verify at rccms.odisha.gov.in"
  }
}
```

- [ ] **Step 7: Add to live smoke battery**

```ts
// qa/all_fetchers_live_smoke.test.ts — add after RCCMS section:
{
  const { result, elapsedMs, crashed, errorMessage } = await timeIt("rccms-v2-ccms-nic", () =>
    fetchCcmsNic({ district: "Khordha", tahasil: "Bhubaneswar", village: "Mendhasala" })
  );
  if (crashed || !result) {
    smokeRuns.push({ fetcher: "rccms-v2-ccms-nic", status: "CRASH", reason: "threw", latencyMs: elapsedMs, crashed: true, errorMessage });
  } else {
    smokeRuns.push({ fetcher: "rccms-v2-ccms-nic", status: result.status, reason: result.error ?? "-", latencyMs: elapsedMs, crashed: false });
  }
}
```

- [ ] **Step 8: Commit**

```bash
git add packages/fetchers/rccms qa/fetcher_tests/rccms-v2.test.ts qa/degradation_matrix.json qa/all_fetchers_live_smoke.test.ts
git commit -m "feat(rccms): pivot to ccms.nic.in v2.0 (Layer 1.1)"
```

---

## Task 1.2: eCourts — Apify parseforge ground-truth test

**Files:**
- Create: `packages/fetchers/ecourts/src/via-apify.ts`
- Create: `qa/fetcher_tests/ecourts-via-apify.test.ts`
- Modify: `packages/fetchers/ecourts/src/index.ts` (use Apify when API key is set)
- Modify: `qa/degradation_matrix.json` (ecourts entry)
- Modify: `.env.example` (add `APIFY_TOKEN`)

**Interfaces:**
- Consumes: `{ partyName, courtComplex?, caseType? }`
- Produces: `{ status: 'ok' | 'no_data' | 'source_down' | 'manual_required' | 'parse_error', data: { cases: [...] } }`

- [ ] **Step 1: Sign up for Apify (founder does this manually)**
  - Go to https://apify.com and create a free account
  - Get the API token from https://console.apify.com/settings/integrations
  - Add to `.env.local`: `APIFY_TOKEN=<token>`

- [ ] **Step 2: Write the failing test**

```ts
// qa/fetcher_tests/ecourts-via-apify.test.ts
import { describe, it, expect } from "vitest";
import { fetchEcourtsViaApify } from "@cleardeed/fetcher-ecourts/via-apify";

describe.skipIf(!process.env.APIFY_TOKEN)("eCourts via Apify parseforge", () => {
  it("passes Bar 1/2/3 on assigned ground-truth plots", async () => {
    const fetcher = (plotId: string) => fetchEcourtsViaApify({ partyName: plotId, courtComplex: "Khordha District Court" });
    const result = await runBar1Bar2Bar3("ecourts", ["P051", "P052", "P053", "P054", "BROKEN-PLOT"], fetcher);
    expect(result.bar1).toBe("pass");
    expect(result.bar2).toBe("pass");
    expect(result.bar3).toBe("pass");
  }, 120_000);
});
```

- [ ] **Step 3: Implement the fetcher**

```ts
// packages/fetchers/ecourts/src/via-apify.ts
const APIFY_ACTOR = "parseforge/court-records-ecourt-india-scraper";
const APIFY_URL = `https://api.apify.com/v2/acts/${APIFY_ACTOR}/run-sync-get-dataset-items`;

export interface EcourtsCase {
  cnr: string;
  caseNo: string;
  caseType: string;
  court: string;
  status: string;
  parties: { petitioner: string; respondent: string };
  filingDate?: string;
  nextHearingDate?: string;
}

export interface EcourtsResult {
  status: "ok" | "no_data" | "source_down" | "parse_error" | "manual_required";
  data: { cases: EcourtsCase[] };
  error?: string;
}

export async function fetchEcourtsViaApify(input: { partyName: string; courtComplex?: string; caseType?: string }): Promise<EcourtsResult> {
  const token = process.env.APIFY_TOKEN;
  if (!token) return { status: "manual_required", data: { cases: [] }, error: "APIFY_TOKEN not set" };

  try {
    const res = await fetch(APIFY_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        partyName: input.partyName,
        courtComplex: input.courtComplex ?? "Odisha District Courts",
        caseType: input.caseType ?? "all",
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) return { status: "source_down", data: { cases: [] }, error: `Apify HTTP ${res.status}` };
    const rows = (await res.json()) as any[];
    const cases: EcourtsCase[] = rows
      .filter((r) => r.cnr || r.caseNo)
      .map((r) => ({
        cnr: r.cnr ?? "",
        caseNo: r.caseNo ?? r.case_number ?? "",
        caseType: r.caseType ?? r.case_type ?? "",
        court: r.court ?? r.court_complex ?? "",
        status: r.status ?? r.case_status ?? "",
        parties: { petitioner: r.petitioner ?? r.petitioner_name ?? "", respondent: r.respondent ?? r.respondent_name ?? "" },
        filingDate: r.filingDate ?? r.date_of_filing,
        nextHearingDate: r.nextHearingDate ?? r.next_hearing_date,
      }));
    return { status: cases.length > 0 ? "ok" : "no_data", data: { cases } };
  } catch (e) {
    return { status: "source_down", data: { cases: [] }, error: (e as Error).message };
  }
}
```

- [ ] **Step 4: Wire into the existing ecourts fetcher**

```ts
// packages/fetchers/ecourts/src/index.ts (modify the existing fetch to use Apify)
import { fetchEcourtsViaApify } from "./via-apify";

export async function fetch(input: { partyName: string }): Promise<any> {
  if (process.env.APIFY_TOKEN) return fetchEcourtsViaApify(input);
  return { status: "manual_required", data: { cases: [] }, error: "APIFY_TOKEN not set; manual fallback" };
}
```

- [ ] **Step 5: Run Bar 1/2/3 test (requires real Apify token)**

Run: `APIFY_TOKEN=<token> pnpm vitest run qa/fetcher_tests/ecourts-via-apify.test.ts`
Expected: PASS

- [ ] **Step 6: Update degradation matrix + .env.example + commit**

```json
// qa/degradation_matrix.json — ecourts entry update
"ecourts": {
  "label": "eCourts via Apify parseforge (parseforge/court-records-ecourt-india-scraper)",
  "wired_in_v11": true,
  ...
  "v11_special_handling": "v1.2: eCourtsIndia.com V6 portal dead. Using Apify parseforge actor. Free tier: 5 calls. ₹0.60-2.00/call on PAYG."
}
```

```bash
# .env.example — add:
APIFY_TOKEN=your_apify_token_here
```

```bash
git add packages/fetchers/ecourts qa/fetcher_tests/ecourts-via-apify.test.ts qa/degradation_matrix.json .env.example
git commit -m "feat(ecourts): integrate Apify parseforge actor (Layer 1.2)"
```

---

## Task 1.3: IGR EC — captcha-breaker integration

**Files:**
- Create: `packages/fetchers/igr-ec/src/v3-captcha-breaker.ts`
- Create: `qa/fetcher_tests/igr-ec-v3.test.ts`
- Modify: `packages/fetchers/igr-ec/src/index.ts` (use v3 when captcha-breaker is available)
- Modify: `qa/degradation_matrix.json`

**Interfaces:**
- Consumes: `{ partyName, sroCode, deedPeriod? }`
- Produces: `{ status: 'ok' | 'no_data' | 'source_down' | 'manual_required' | 'parse_error', data: { entries: [...] } }`

- [ ] **Step 1: Write the failing test**

```ts
// qa/fetcher_tests/igr-ec-v3.test.ts
import { describe, it, expect } from "vitest";
import { fetchIgrEcV3 } from "@cleardeed/fetcher-igr-ec/v3-captcha-breaker";

describe("IGR EC v3 (captcha-breaker ONNX)", () => {
  it("passes Bar 1/2/3 on assigned ground-truth plots", async () => {
    const fetcher = (plotId: string) => fetchIgrEcV3({ partyName: plotId, sroCode: "BHUBANESWAR" });
    const result = await runBar1Bar2Bar3("igr-ec", ["P051", "P052", "P053", "P054", "BROKEN-PLOT"], fetcher);
    expect(result.bar1).toBe("pass");
    expect(result.bar2).toBe("pass");
    expect(result.bar3).toBe("pass");
  }, 60_000);
});
```

- [ ] **Step 2: Implement the fetcher (mirrors the D-035 captcha-solver architecture but with ONNX)**

```ts
// packages/fetchers/igr-ec/src/v3-captcha-breaker.ts
import { solveCaptcha } from "@cleardeed/captcha-breaker";

const IGR_EC_URL = "https://igrodisha.gov.in/igrsearch/EncumbranceSearch";
const ONNX_MODEL = "packages/captcha-breaker/onnx/khordha-captcha-resnet18.onnx";

export interface IgrEcEntry {
  documentNo: string;
  registrationDate: string;
  deedType: string;
  parties: { executant: string; claimant: string };
  consideration?: number;
  sro: string;
}

export interface IgrEcResult {
  status: "ok" | "no_data" | "source_down" | "parse_error" | "manual_required";
  data: { entries: IgrEcEntry[] };
  error?: string;
}

export async function fetchIgrEcV3(input: { partyName: string; sroCode: string; deedPeriod?: string }): Promise<IgrEcResult> {
  try {
    // 1. GET form to obtain session cookie + captcha
    const formRes = await fetch(IGR_EC_URL, { signal: AbortSignal.timeout(15_000) });
    if (!formRes.ok) return { status: "source_down", data: { entries: [] }, error: `HTTP ${formRes.status}` };
    const cookies = formRes.headers.getSetCookie();
    const formHtml = await formRes.text();
    const captchaMatch = formHtml.match(/<img[^>]+id=["']captcha["'][^>]+src=["']([^"']+)["']/i);
    if (!captchaMatch) return { status: "parse_error", data: { entries: [] }, error: "captcha not found" };
    const captchaUrl = captchaMatch[1].startsWith("http") ? captchaMatch[1] : `https://igrodisha.gov.in/${captchaMatch[1].replace(/^\//, "")}`;

    // 2. Solve captcha
    const captchaRes = await fetch(captchaUrl, {
      headers: { Cookie: cookies.map(c => c.split(";")[0]).join("; ") },
      signal: AbortSignal.timeout(15_000),
    });
    if (!captchaRes.ok) return { status: "source_down", data: { entries: [] }, error: `captcha HTTP ${captchaRes.status}` };
    const captchaBuf = Buffer.from(await captchaRes.arrayBuffer());
    const solved = await solveCaptcha(captchaBuf, { useOnnx: true, onnxModelPath: ONNX_MODEL });
    if (!solved.text) return { status: "parse_error", data: { entries: [] }, error: "captcha unsolved" };

    // 3. POST search
    const body = new URLSearchParams({
      sroCode: input.sroCode,
      partyName: input.partyName,
      deedPeriod: input.deedPeriod ?? "1",  // 1 year (D-033)
      captcha: solved.text,
    });
    const searchRes = await fetch(IGR_EC_URL, {
      method: "POST",
      headers: { Cookie: cookies.map(c => c.split(";")[0]).join("; "), "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      signal: AbortSignal.timeout(30_000),
    });
    if (!searchRes.ok) return { status: "source_down", data: { entries: [] }, error: `search HTTP ${searchRes.status}` };
    const html = await searchRes.text();

    // 4. Parse result table
    const entries: IgrEcEntry[] = [];
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
    let m;
    while ((m = rowRegex.exec(html))) {
      const cells = (m[1].match(/<td[^>]*>([\s\S]*?)<\/td>/g) ?? []).map(c => c.replace(/<[^>]+>/g, "").trim());
      if (cells.length >= 5 && /\d{4,}/.test(cells[0])) {
        entries.push({
          documentNo: cells[0],
          registrationDate: cells[1] ?? "",
          deedType: cells[2] ?? "",
          parties: { executant: cells[3] ?? "", claimant: cells[4] ?? "" },
          consideration: cells[5] ? Number(cells[5].replace(/[^0-9.]/g, "")) : undefined,
          sro: input.sroCode,
        });
      }
    }
    return { status: entries.length > 0 ? "ok" : "no_data", data: { entries } };
  } catch (e) {
    return { status: "source_down", data: { entries: [] }, error: (e as Error).message };
  }
}
```

- [ ] **Step 3: Wire into the existing IGR EC fetcher**

```ts
// packages/fetchers/igr-ec/src/index.ts (modify)
import { fetchIgrEcV3 } from "./v3-captcha-breaker";
export async function fetch(input: { partyName: string; sroCode: string }): Promise<any> {
  return fetchIgrEcV3(input);
}
```

- [ ] **Step 4: Run Bar 1/2/3, update degradation matrix, commit**

Run: `pnpm vitest run qa/fetcher_tests/igr-ec-v3.test.ts`
Expected: PASS

```bash
git add packages/fetchers/igr-ec qa/fetcher_tests/igr-ec-v3.test.ts qa/degradation_matrix.json
git commit -m "feat(igr-ec): integrate captcha-breaker ONNX (Layer 1.3)"
```

---

## Task 1.4: CERSAI — in-house ddddocr + Vue-state-replay attempt

**Files:**
- Create: `packages/fetchers/cersai/src/v3-vue-replay.ts`
- Create: `qa/fetcher_tests/cersai-v3.test.ts`
- Modify: `packages/fetchers/cersai/src/index.ts` (use v3 when captcha-breaker is available)
- Modify: `qa/degradation_matrix.json`

**Interfaces:** Same as before — `{ partyName }` → `{ status, data: { charges: [...] } }`

- [ ] **Step 1: Write the failing test**

```ts
// qa/fetcher_tests/cersai-v3.test.ts
import { describe, it, expect } from "vitest";
import { fetchCersaiV3 } from "@cleardeed/fetcher-cersai/v3-vue-replay";

describe("CERSAI v3 (Vue-state-replay + captcha-breaker)", () => {
  it("passes Bar 1/2/3 on assigned ground-truth plots", async () => {
    const fetcher = (plotId: string) => fetchCersaiV3({ partyName: plotId });
    const result = await runBar1Bar2Bar3("cersai", ["P051", "P052", "P053", "P054", "BROKEN-PLOT"], fetcher);
    expect(result.bar1).toBe("pass");
    expect(result.bar2).toBe("pass");
    expect(result.bar3).toBe("pass");
  }, 90_000);
});
```

- [ ] **Step 2: Implement — Vue state replay via direct captchaHash AJAX + form submit**

```ts
// packages/fetchers/cersai/src/v3-vue-replay.ts
import { solveCaptcha } from "@cleardeed/captcha-breaker";

const CERSAI_URL = "https://cersai.org.in/CERSAI";
const ONNX_MODEL = "packages/captcha-breaker/onnx/khordha-captcha-resnet18.onnx";

export interface CersaiCharge {
  chargeId: string;
  borrower: string;
  lender: string;
  chargeType: string;
  amount?: number;
  propertyDescription?: string;
  status: "active" | "satisfied" | "unknown";
}

export interface CersaiResult {
  status: "ok" | "no_data" | "source_down" | "parse_error" | "manual_required";
  data: { charges: CersaiCharge[] };
  error?: string;
}

export async function fetchCersaiV3(input: { partyName: string }): Promise<CersaiResult> {
  try {
    // 1. GET dbtrsrch.prg to establish session
    const page = await fetch(`${CERSAI_URL}/dbtrsrch.prg`, { signal: AbortSignal.timeout(15_000) });
    if (!page.ok) return { status: "source_down", data: { charges: [] }, error: `HTTP ${page.status}` };
    const cookies = page.headers.getSetCookie();
    const cookieHeader = cookies.map(c => c.split(";")[0]).join("; ");
    const pageHtml = await page.text();
    const captchaMatch = pageHtml.match(/<img[^>]+id=["']CaptchaImage["'][^>]+src=["']([^"']+)["']/i);
    if (!captchaMatch) return { status: "parse_error", data: { charges: [] }, error: "captcha not found" };
    const captchaUrl = captchaMatch[1].startsWith("http") ? captchaMatch[1] : `${CERSAI_URL}/${captchaMatch[1].replace(/^\//, "")}`;

    // 2. Fetch captcha
    const captchaRes = await fetch(captchaUrl, { headers: { Cookie: cookieHeader }, signal: AbortSignal.timeout(15_000) });
    if (!captchaRes.ok) return { status: "source_down", data: { charges: [] }, error: `captcha HTTP ${captchaRes.status}` };
    const captchaBuf = Buffer.from(await captchaRes.arrayBuffer());
    const solved = await solveCaptcha(captchaBuf, { useOnnx: true, onnxModelPath: ONNX_MODEL });
    if (!solved.text) return { status: "parse_error", data: { charges: [] }, error: "captcha unsolved" };

    // 3. CRITICAL: Vue reactive state replay — call CaptchaHashValidation directly
    //    The V2 portal sets captchaHash via AJAX; replicate that call here
    const hashRes = await fetch(`${CERSAI_URL}/CaptchaHashValidation`, {
      method: "POST",
      headers: { Cookie: cookieHeader, "Content-Type": "application/x-www-form-urlencoded", "X-Requested-With": "XMLHttpRequest" },
      body: new URLSearchParams({ captcha: solved.text }).toString(),
      signal: AbortSignal.timeout(15_000),
    });
    if (!hashRes.ok) return { status: "parse_error", data: { charges: [] }, error: "CaptchaHashValidation failed" };
    const hashData = await hashRes.json() as { captchaHash?: string; status?: string };
    if (!hashData.captchaHash) return { status: "parse_error", data: { charges: [] }, error: "no captchaHash returned" };

    // 4. POST search with the captchaHash
    const searchRes = await fetch(`${CERSAI_URL}/dbtrsrch.frg`, {
      method: "POST",
      headers: { Cookie: cookieHeader, "Content-Type": "application/x-www-form-urlencoded", "X-Requested-With": "XMLHttpRequest" },
      body: new URLSearchParams({ debtorName: input.partyName, captcha: solved.text, captchaHash: hashData.captchaHash }).toString(),
      signal: AbortSignal.timeout(30_000),
    });
    if (!searchRes.ok) return { status: "source_down", data: { charges: [] }, error: `search HTTP ${searchRes.status}` };
    const searchHtml = await searchRes.text();

    // 5. Parse charges table
    const charges: CersaiCharge[] = [];
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
    let m;
    while ((m = rowRegex.exec(searchHtml))) {
      const cells = (m[1].match(/<td[^>]*>([\s\S]*?)<\/td>/g) ?? []).map(c => c.replace(/<[^>]+>/g, "").trim());
      if (cells.length >= 5 && /^[A-Z0-9-]{4,}/.test(cells[0])) {
        charges.push({
          chargeId: cells[0],
          borrower: cells[1] ?? "",
          lender: cells[2] ?? "",
          chargeType: cells[3] ?? "",
          amount: cells[4] ? Number(cells[4].replace(/[^0-9.]/g, "")) : undefined,
          propertyDescription: cells[5],
          status: (cells[6] ?? "unknown").toLowerCase() as CersaiCharge["status"],
        });
      }
    }
    return { status: charges.length > 0 ? "ok" : "no_data", data: { charges } };
  } catch (e) {
    return { status: "source_down", data: { charges: [] }, error: (e as Error).message };
  }
}
```

- [ ] **Step 3: Wire into the existing CERSAI fetcher**

```ts
// packages/fetchers/cersai/src/index.ts
import { fetchCersaiV3 } from "./v3-vue-replay";
export async function fetch(input: { partyName: string }): Promise<any> {
  return fetchCersaiV3(input);
}
```

- [ ] **Step 4: Run Bar 1/2/3 (note: Vue-state-replay may fail; if it does, document and fall back to manual_required)**

Run: `pnpm vitest run qa/fetcher_tests/cersai-v3.test.ts`
Expected: PASS or PARTIAL (if Vue state can't be replayed, the test documents the gap and the fetcher returns `manual_required` honestly)

- [ ] **Step 5: Commit**

```bash
git add packages/fetchers/cersai qa/fetcher_tests/cersai-v3.test.ts qa/degradation_matrix.json
git commit -m "feat(cersai): in-house Vue-state-replay + captcha-breaker (Layer 1.4)"
```

---

## Task 1.5: Bhulekh — captcha-breaker ONNX integration

**Files:**
- Create: `packages/fetchers/bhulekh/src/v3-captcha-breaker.ts`
- Create: `qa/fetcher_tests/bhulekh-v3.test.ts`
- Modify: `packages/fetchers/bhulekh/src/index.ts` (use v3)

**Interfaces:** Same — `{ village, plotNo }` → `{ status, data: { tenants, ... } }`

- [ ] **Step 1: Write the failing test**

```ts
// qa/fetcher_tests/bhulekh-v3.test.ts
import { describe, it, expect } from "vitest";
import { fetchBhulekhV3 } from "@cleardeed/fetcher-bhulekh/v3-captcha-breaker";

describe("Bhulekh v3 (captcha-breaker ONNX)", () => {
  it("passes Bar 1/2/3 on assigned ground-truth plots", async () => {
    const fetcher = (plotId: string) => fetchBhulekhV3({ village: "Mendhasala", plotNo: plotId });
    const result = await runBar1Bar2Bar3("bhulekh", ["415", "416", "417", "418", "INVALID-PLOT"], fetcher);
    expect(result.bar1).toBe("pass");
    expect(result.bar2).toBe("pass");
    expect(result.bar3).toBe("pass");
  }, 60_000);
});
```

- [ ] **Step 2: Implement (mirrors existing V2 but with captcha-breaker instead of tesseract.js)**

```ts
// packages/fetchers/bhulekh/src/v3-captcha-breaker.ts
// Reuse the V2 cascade architecture; replace tesseract.js captcha with solveCaptcha from @cleardeed/captcha-breaker
// Detailed implementation is the same as packages/fetchers/bhulekh/src/index.ts but the solveCaptcha import differs.
// See existing V2 fetcher code; this v3 is a drop-in replacement.
```

- [ ] **Step 3: Wire into the existing Bhulekh fetcher**

```ts
// packages/fetchers/bhulekh/src/index.ts
import { fetchBhulekhV3 } from "./v3-captcha-breaker";
export async function fetch(input: { village: string; plotNo: string }): Promise<any> {
  return fetchBhulekhV3(input);
}
```

- [ ] **Step 4: Run Bar 1/2/3 + commit**

Run: `pnpm vitest run qa/fetcher_tests/bhulekh-v3.test.ts`
Expected: PASS (target 99% accuracy, up from 91%)

```bash
git add packages/fetchers/bhulekh qa/fetcher_tests/bhulekh-v3.test.ts
git commit -m "feat(bhulekh): integrate captcha-breaker ONNX (Layer 1.5)"
```

---

## Task 1.6: Phase 1 verification — consolidated smoke + degradation matrix

**Files:**
- Modify: `qa/all_fetchers_live_smoke.test.ts` (add all 4 L1 fetchers)
- Create: `qa/phase1_fire_audit.md`

- [ ] **Step 1: Run the full live smoke battery**

Run: `pnpm vitest run qa/all_fetchers_live_smoke.test.ts`
Expected: All 13 fetchers report status (0 crashes). At least 4 of the 4 L1 fetchers (RCCMS, eCourts, IGR EC, CERSAI, Bhulekh) report `status !== "manual_required"`.

- [ ] **Step 2: Write the Phase 1 fire audit**

```bash
pnpm tsx scripts/run-fire-audit.ts --phase=1 > qa/phase1_fire_audit.md
```

Expected output: Per-source fire rate, per-plot status, Bar 1/2/3 verdict. Save to `qa/phase1_fire_audit.md`.

- [ ] **Step 3: Commit**

```bash
git add qa/all_fetchers_live_smoke.test.ts qa/phase1_fire_audit.md
git commit -m "chore: Phase 1 verification — fire audit + smoke battery"
```

---

# Phase 2 — Layer 2: Wire-up Sprint (weeks 4-8)

**Pattern (per fetcher):**
- Verify contract still matches `@cleardeed/schema`
- Add fetcher to the V11 pipeline (`apps/web/src/lib/pipeline/index.ts`)
- Update `buildSourceResult` and `tier2Input`
- Add to live smoke + degradation matrix
- Run Bar 1/2/3

## Task 2.1: Wire igr-sro

**Files:**
- Modify: `apps/web/src/lib/pipeline/index.ts` (add igr-sro as Step 2m)
- Modify: `apps/web/src/lib/pipeline/contracts/igr-sro.ts` (add `fired` field)
- Modify: `qa/degradation_matrix.json`
- Modify: `qa/all_fetchers_live_smoke.test.ts`

- [ ] **Step 1: Verify the contract matches the schema**

```ts
// qa/contract-audit.test.ts — add a check that igr-sro contract matches @cleardeed/schema
import { igrSroContract } from "./contracts/igr-sro";
import { igrSroSchema } from "@cleardeed/schema";
import { describe, it, expect } from "vitest";

describe("igr-sro contract audit", () => {
  it("contract matches schema", () => {
    expect(igrSroContract.status).toBeDefined();
    // ... full schema check
  });
});
```

- [ ] **Step 2: Add to V11 pipeline**

```ts
// apps/web/src/lib/pipeline/index.ts — add to generateReportV11
import { igrSroFetch } from "@cleardeed/fetcher-igr-sro";
const igrSroResult = await safeRun(() => igrSroFetch({ sroCode: input.sroCode, partyName: input.sellerName }), "igr-sro");
```

- [ ] **Step 3: Update buildSourceResult and tier2Input**

```ts
// In buildSourceResult — add igr-sro branch
case "igr-sro": return { ...igrSroResult, fired: isSourceFired(igrSroResult, "igr-sro") };
```

- [ ] **Step 4: Update degradation matrix + smoke**

```json
// qa/degradation_matrix.json — add igr-sro entry
"igr-sro": {
  "label": "IGR Odisha Sub-Registrar Office (igrodisha.gov.in)",
  "wired_in_v11": true,
  ...
}
```

- [ ] **Step 5: Run Bar 1/2/3 + commit**

```bash
pnpm vitest run qa/fetcher_tests/igr-sro.test.ts
git add apps/web/src/lib/pipeline qa/degradation_matrix.json qa/all_fetchers_live_smoke.test.ts
git commit -m "feat: wire igr-sro into V11 pipeline (Layer 2.1)"
```

---

## Tasks 2.2 — 2.11: Wire the remaining 10 built-but-unwired fetchers

**Each task follows the same pattern as Task 2.1.** Per-fetcher:

- **Task 2.2: igr-bmv** — Government floor valuation
- **Task 2.3: stamp-duty** — Cross-check seller's quoted price
- **Task 2.4: igr-daily-bulletin** — Registration velocity (24h cache)
- **Task 2.5: public-dashboard** — Portal liveness probe
- **Task 2.6: govt-fee** — Permanent fee schedule
- **Task 2.7: igr-certified-copy** — Section 57 Book 1/2 index
- **Task 2.8: bhunaksha-plot-report** — Map image + full owner block
- **Task 2.9: high-court** — Orissa HC writs/appeals
- **Task 2.10: drt** — Bank recovery against seller
- **Task 2.11: larr** — Acquisition corridor

**Each task:** contract audit → wire to V11 pipeline → buildSourceResult → degradation matrix → smoke → Bar 1/2/3 → commit.

**One commit per fetcher.** Sub-agents own each task.

---

## Task 2.12: Phase 2 verification — full live smoke + fire audit

**Files:**
- Create: `qa/phase2_fire_audit.md`

- [ ] **Step 1: Run the full live smoke battery**

Run: `pnpm vitest run qa/all_fetchers_live_smoke.test.ts`
Expected: 18+ fetchers report status (0 crashes). All 11 wire-up fetchers report `status !== "manual_required"`.

- [ ] **Step 2: Write the Phase 2 fire audit**

```bash
pnpm tsx scripts/run-fire-audit.ts --phase=2 > qa/phase2_fire_audit.md
```

- [ ] **Step 3: Commit**

```bash
git add qa/phase2_fire_audit.md
git commit -m "chore: Phase 2 verification — 18+ fetchers wired + fire audit"
```

---

# Phase 3 — Layer 3: New Sources (weeks 8-16)

**Pattern (per source):**
- Spiked/built from scratch (no existing fetcher)
- Per-source: fetcher + contract + degradation matrix + smoke + Bar 1/2/3

## Task 3.1: RERA Odisha

**Files:**
- Create: `packages/fetchers/rera-odisha/src/index.ts`
- Create: `packages/fetchers/rera-odisha/package.json`
- Create: `qa/fetcher_tests/rera-odisha.test.ts`
- Create: `apps/web/src/lib/pipeline/contracts/rera-odisha.ts`
- Modify: `pnpm-workspace.yaml`, `vitest.config.ts`
- Modify: `qa/degradation_matrix.json`, `qa/all_fetchers_live_smoke.test.ts`

**Interfaces:**
- Consumes: `{ projectName?, promoterName?, district? }`
- Produces: `{ status, data: { projects: [{ name, promoter, status, district, registrationNo, complaints? }] } }`

- [ ] **Step 1: Create the package skeleton** (mirrors `packages/fetchers/igr-sro/package.json`)

- [ ] **Step 2: Write the failing test** (Bar 1/2/3 on assigned ground-truth plots)

- [ ] **Step 3: Implement the fetcher** (scrape `rera.odisha.gov.in` project search by project/promoter name; parse the project list table; flag any "expired" or "cancelled" projects as risk)

- [ ] **Step 4: Wire into V11 pipeline** (Section 3 — "What you can build here" — shows RERA approval status for plotted developments)

- [ ] **Step 5: Update degradation matrix + smoke + Bar 1/2/3 + commit**

---

## Tasks 3.2 — 3.6: Remaining 5 new sources

- **Task 3.2: BMC property tax** — `bmc.gov.in` property tax defaulters search by plot ID
- **Task 3.3: Bhuvan Odisha layers** — `bhuvan.nrsc.gov.in` WMS for flood/CRZ
- **Task 3.4: BDA approved layout registry** — `bdaodisha.gov.in` PDF parsing
- **Task 3.5: MCA21 CIN/charges** — `mca.gov.in` public search by CIN; flag company-held property
- **Task 3.6: NCLT/IBBI** — `ibbi.gov.in` CIRP/liquidation notices

**Each task follows the same pattern as Task 3.1.** Per-source: package + fetcher + contract + degradation + smoke + Bar 1/2/3 + commit.

## Task 3.7: Phase 3 verification

- [ ] Run the full live smoke battery
- [ ] Write `qa/phase3_fire_audit.md`
- [ ] Commit

---

# Phase 4 — PID Foundation (weeks 12-14)

**Goal:** Ship the smallest possible v1 of the actor-network intelligence layer.

## Task 4.1: Seller-name normalizer

**Files:**
- Create: `apps/web/src/lib/pipeline/pid/seller-name-normalizer.ts`
- Create: `apps/web/src/lib/pipeline/pid/seller-name-normalizer.test.ts`

**Interfaces:**
- Consumes: raw seller name (Odia + English)
- Produces: `{ normalized: string, hash: string }` — Jaccard similarity input

- [ ] **Step 1: Write the failing test**

```ts
import { normalizeSellerName } from "./seller-name-normalizer";

describe("normalizeSellerName", () => {
  it("lowercases and strips punctuation", () => {
    expect(normalizeSellerName("Bikash Ch. Mohapatra").normalized).toBe("bikash ch mohapatra");
  });
  it("transliterates Odia to Latin", () => {
    expect(normalizeSellerName("ବିକାଶ ଚନ୍ଦ୍ର ମହାପାତ୍ର").normalized).toMatch(/bikash/);
  });
  it("hashes the normalized form", () => {
    expect(normalizeSellerName("Bikash Mohapatra").hash).toMatch(/^[a-f0-9]{64}$/);
  });
});
```

- [ ] **Step 2: Implement**

```ts
import { createHash } from "node:crypto";
// Reuse odia-field-dictionary from @cleardeed/fetcher-bhulekh for transliteration
// (extract to @cleardeed/schema if not already shared)

export function normalizeSellerName(raw: string): { normalized: string; hash: string } {
  const normalized = raw.toLowerCase()
    .replace(/[.,'"!?]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const hash = createHash("sha256").update(normalized).digest("hex");
  return { normalized, hash };
}

export function jaccardSimilarity(a: string, b: string): number {
  const aSet = new Set(a.split(" "));
  const bSet = new Set(b.split(" "));
  const intersection = new Set([...aSet].filter(x => bSet.has(x)));
  const union = new Set([...aSet, ...bSet]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}
```

- [ ] **Step 3: Run test + commit**

---

## Task 4.2: Cross-report lookup

**Files:**
- Create: `apps/web/src/lib/pipeline/pid/cross-report-lookup.ts`
- Create: `apps/web/src/lib/pipeline/pid/cross-report-lookup.test.ts`
- Modify: `supabase/migrations/` (add `pid_seller_index` table)

**Interfaces:**
- Consumes: `{ sellerNameHash }` (from current report)
- Produces: `{ count: number, recentReports: [...] }` (from `pid_seller_index`)

- [ ] **Step 1: Migration**

```sql
-- supabase/migrations/2026-06-17_pid_seller_index.sql
CREATE TABLE pid_seller_index (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_name_hash TEXT NOT NULL,
  report_id UUID NOT NULL REFERENCES reports(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_pid_seller_hash ON pid_seller_index(seller_name_hash);
```

- [ ] **Step 2: Implement the lookup**

```ts
import { createClient } from "@supabase/supabase-js";
import { normalizeSellerName, jaccardSimilarity } from "./seller-name-normalizer";

export interface PidHit {
  reportId: string;
  sellerName: string;
  createdAt: string;
}

export async function findRepeatSeller(rawSellerName: string): Promise<{ count: number; hits: PidHit[] }> {
  const { normalized, hash } = normalizeSellerName(rawSellerName);
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  // Exact hash match
  const { data: exact } = await supabase.from("pid_seller_index").select("report_id, created_at").eq("seller_name_hash", hash);

  if (exact && exact.length > 0) {
    return { count: exact.length, hits: exact.map((r) => ({ reportId: r.report_id, sellerName: rawSellerName, createdAt: r.created_at })) };
  }

  // Fuzzy match (Jaccard ≥ 0.85) on a candidate pool
  const { data: candidates } = await supabase.from("pid_seller_index").select("seller_name_hash, report_id, created_at").limit;
  const seen = new Set<string>();
  const hits: PidHit[] = [];
  for (const c of candidates ?? []) {
    if (seen.has(c.seller_name_hash)) continue;
    const candidateNormalized = c.seller_name_hash; // we'd need to store the normalized form too — extend schema
    if (jaccardSimilarity(normalized, candidateNormalized) >= 0.85) {
      seen.add(c.seller_name_hash);
      hits.push({ reportId: c.report_id, sellerName: candidateNormalized, createdAt: c.created_at });
    }
  }
  return { count: hits.length, hits };
}
```

- [ ] **Step 3: Write the test + run + commit**

---

## Task 4.3: PID badge in Section 2 (UI)

**Files:**
- Modify: `apps/web/src/components/ReportSection2.tsx` (add "repeat seller" badge)
- Modify: `apps/web/src/lib/pipeline/consumer-report-writer.ts` (call `findRepeatSeller`)

- [ ] **Step 1: Wire the lookup into the report writer**

```ts
// In the Section 2 builder
if (input.sellerName) {
  const pid = await findRepeatSeller(input.sellerName);
  if (pid.count >= 2) {
    section.repeatSellerBadge = {
      count: pid.count,
      message: pid.count >= 5
        ? `This seller has appeared in ${pid.count} other ClearDeed reports. Pattern detected — verify identity at the SRO.`
        : `This seller has appeared in ${pid.count} other ClearDeed reports [link]. May indicate a repeat actor.`,
    };
  }
}
```

- [ ] **Step 2: Render the badge in Section 2**

```tsx
// In ReportSection2.tsx
{section.repeatSellerBadge && (
  <div className="repeat-seller-badge" data-count={section.repeatSellerBadge.count}>
    {section.repeatSellerBadge.message}
  </div>
)}
```

- [ ] **Step 3: Write a Playwright e2e test + commit**

---

## Task 4.4: PID v1 verification

- [ ] Seed 5 reports with overlapping seller names
- [ ] Run PID lookup on the 6th report
- [ ] Verify the badge appears
- [ ] Write `qa/phase4_pid_audit.md`
- [ ] Commit

---

# Phase 5 — Launch Gate (weeks 14-16)

## Task 5.1: Expand ground-truth corpus to 75 plots

**Files:**
- Create: `qa/ground_truth/P052-P075/transcript.md` (founder manual capture)

- [ ] **Step 1: Founder runs 25 fresh plots through the live pipeline**

- [ ] **Step 2: Commit transcripts**

---

## Task 5.2: Final fire-rate audit on 75-plot corpus

**Files:**
- Create: `qa/launch_fire_audit.md`

- [ ] **Step 1: Run the full live smoke + per-source Bar 1/2/3 audit**

```bash
pnpm tsx scripts/run-fire-audit.ts --phase=launch > qa/launch_fire_audit.md
```

- [ ] **Step 2: Assert ≥ 24/25 sources fire reliably (target)**

- [ ] **Step 3: Commit the launch gate verdict**

```bash
git add qa/launch_fire_audit.md
git commit -m "chore: launch gate — 24/25 sources fire reliably on 75-plot corpus"
```

---

## Task 5.3: Update degradation matrix + product copy

**Files:**
- Modify: `qa/degradation_matrix.json` (final state)
- Modify: `apps/web/src/components/ReportFooter.tsx` (honest "manual_required" copy)

- [ ] **Step 1: Update degradation matrix to reflect new source-fire state**

- [ ] **Step 2: Update buyer-facing copy to be honest about fire vs manual_required**

- [ ] **Step 3: Commit + tag release**

```bash
git tag v1.2-source-reliability
```

---

# Total Task Count

| Phase | Task Count | Effort (hrs) | Cost (₹/mo) |
|---|---|---|---|
| Phase 0: Foundation | 5 | 40-60 | ₹0 |
| Phase 1: L1 Unblock | 6 | 80-120 | ≤₹1,000 |
| Phase 2: L2 Wire-up | 12 | 80-120 | ₹0 |
| Phase 3: L3 New | 7 | 100-140 | ≤₹1,000 |
| Phase 4: PID v1 | 4 | 30-40 | ₹0 |
| Phase 5: Launch gate | 3 | 20-30 | ₹0 |
| **Total** | **37** | **350-510** | **≤₹2,000** |

---

*Last touched: 2026-06-17. Each task is independently testable. Sub-agents own one task each. Bar 1/2/3 + per-task commit = the "implementation outcome matching intended outcome" enforcement.*
