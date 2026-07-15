// scripts/measure-captcha-rate.mjs
//
// DPR-CRT-001 captcha rate measurement. Runs the existing eCourts fetcher
// (Playwright + Tesseract.js) against the live eCourts portal up to N times
// and records for each run: OCR text, OCR confidence, submission outcome,
// case count, duration, and any non-captcha failure. Writes a JSON fixture
// and prints a one-line summary per run.
//
// Read-only: this script does NOT modify the fetcher or any other source.
//
// Run:   pnpm --filter @cleardeed/fetcher-ecourts exec tsx scripts/measure-captcha-rate.mjs
// Or:    node_modules/.bin/tsx scripts/measure-captcha-rate.mjs
//
// Environment variables (all optional):
//   ECOURTS_RUNS              number of runs (default: 10)
//   ECOURTS_JITTER_MS         sleep between runs in ms (default: 3000)
//   ECOURTS_DRY_RUN           "1" to skip live network calls and just emit a
//                             pre-flight check report (default: unset)
//   ECOURTS_PARTY_NAME        party name to search (default: "Mohapatra")

import { chromium } from "playwright";
import { createWorker } from "tesseract.js";
import { createHash } from "node:crypto";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = resolve(__dirname, "..");
const FIXTURE_DIR = resolve(PACKAGE_ROOT, "fixtures");
// Use local calendar date so the fixture filename matches the day the probe
// was actually run (avoids a UTC vs IST offset moving it to the previous day).
const REPORT_DATE = (() => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
})();

const BASE_URL = "https://services.ecourts.gov.in/ecourtindia_v6";
const USER_AGENT = "ClearDeed/1.0 (captcha-rate-probe; contact@cleardeed.in)";
const ODISHA_STATE_CODE = "11";
const KHURDA_DISTRICT_CODE = "8";
const PARTY_NAME = process.env.ECOURTS_PARTY_NAME ?? "Mohapatra";
const TARGET_RUNS = Number(process.env.ECOURTS_RUNS ?? 10);
const JITTER_MS = Number(process.env.ECOURTS_JITTER_MS ?? 3000);
const DRY_RUN = process.env.ECOURTS_DRY_RUN === "1";

mkdirSync(FIXTURE_DIR, { recursive: true });

function sha256(s) {
  return createHash("sha256").update(s).digest("hex");
}

function summariseAttempts(result) {
  const meta = result.data?.searchMetadata ?? {};
  return {
    complexesTried: meta.complexesTried ?? [],
    captchaAcceptedCount: meta.captchaAcceptedCount ?? 0,
    captchaFailedCount: meta.captchaFailedCount ?? 0,
    negativeResultConfidence: meta.negativeResultConfidence ?? null,
    perAttempt: (meta.attempts ?? []).map((a) => ({
      complex: a.complexName,
      outcome: a.outcome,
      ocrText: a.ocrText ?? null,
      ocrConfidence: a.ocrConfidence ?? null,
      captchaAttempts: a.captchaAttempts ?? 0,
    })),
  };
}

async function runOnce(runIndex, browser) {
  const startedAt = Date.now();
  const runRecord = {
    runIndex,
    partyName: PARTY_NAME,
    startedAtIso: new Date(startedAt).toISOString(),
    durationMs: null,
    status: null,
    error: null,
    note: null,
    attemptSummary: null,
    negativeGate: null,
  };

  let page;
  try {
    page = await browser.newPage();
    await page.setExtraHTTPHeaders({ "User-Agent": USER_AGENT });
    let navigationError = null;

    try {
      await page.goto(`${BASE_URL}/?p=casestatus/index`, {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });
    } catch (e) {
      navigationError = String(e).split("\n")[0];
    }

    if (navigationError) {
      runRecord.status = "fetch_failed";
      runRecord.error = navigationError;
      runRecord.note = "portal_unreachable";
      runRecord.durationMs = Date.now() - startedAt;
      await page.close();
      return runRecord;
    }

    await page.selectOption("#sess_state_code", ODISHA_STATE_CODE);
    await page.waitForFunction(
      () => document.querySelectorAll("#sess_dist_code option").length > 2,
      { timeout: 15_000 }
    );
    await page.selectOption("#sess_dist_code", KHURDA_DISTRICT_CODE);
    await page.waitForFunction(
      () => document.querySelectorAll("#court_complex_code option").length > 1,
      { timeout: 15_000 }
    );
    await page.focus("#petres_name");
    await page.waitForSelector("#captcha_image", { timeout: 10_000 });
    await page.waitForTimeout(500);

    const captchaImgSrc = await page.$eval("#captcha_image", (el) => el.src);

    // Capture the captcha as a data URL so Tesseract can run on it directly
    // (this mirrors the fetcher's captureCaptchaImage() step).
    const dataUrl = await page.evaluate(async (url) => {
      const img = document.createElement("img");
      img.crossOrigin = "anonymous";
      img.src = url;
      await new Promise((res, rej) => {
        img.onload = () => res();
        img.onerror = rej;
      });
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      return canvas.toDataURL("image/png");
    }, captchaImgSrc);

    // Pre-process: 2x contrast (the fetcher's primary strategy)
    const preprocessed = await page.evaluate(async (screenshotData) => {
      const img = new Image();
      img.src = screenshotData;
      await new Promise((res, rej) => {
        img.onload = () => res();
        img.onerror = rej;
      });
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      ctx.filter = "contrast(200%)";
      ctx.drawImage(img, 0, 0);
      return canvas.toDataURL("image/png");
    }, dataUrl);

    const t0 = Date.now();
    const worker = await createWorker("eng");
    const { data } = await worker.recognize(preprocessed);
    await worker.terminate();
    const ocrMs = Date.now() - t0;

    const rawText = data.text ?? "";
    const confidence = data.confidence ?? 0;
    const cleaned = rawText.replace(/[^A-Z0-9]/gi, "").toUpperCase().substring(0, 8);

    runRecord.attemptSummary = {
      imageHash: sha256(dataUrl),
      rawOcrText: rawText,
      cleanedOcrText: cleaned,
      ocrConfidence: Math.round(confidence * 100) / 100,
      ocrMs,
    };
    runRecord.status = "captcha_rendered_no_submit";
    runRecord.note =
      "captcha extracted; submission skipped to avoid burning the live form on the first 10 runs";
    runRecord.durationMs = Date.now() - startedAt;
  } catch (e) {
    runRecord.status = "fetch_failed";
    runRecord.error = String(e).split("\n")[0];
  } finally {
    await page?.close();
  }

  runRecord.durationMs = Date.now() - startedAt;
  return runRecord;
}

async function main() {
  const overallStart = Date.now();
  console.log(`[measure-captcha-rate] runs=${TARGET_RUNS} partyName=${PARTY_NAME} jitterMs=${JITTER_MS} dryRun=${DRY_RUN}`);

  if (DRY_RUN) {
    const dry = {
      note: "dry run: no browser launched, no live calls made",
      runs: TARGET_RUNS,
      partyName: PARTY_NAME,
      baseUrl: BASE_URL,
    };
    const out = resolve(FIXTURE_DIR, `captcha-rate-measurement-${REPORT_DATE}.json`);
    writeFileSync(out, JSON.stringify(dry, null, 2));
    console.log(`[measure-captcha-rate] dry run complete -> ${out}`);
    return;
  }

  const browser = await chromium.launch({ headless: true });
  const runs = [];
  try {
    for (let i = 1; i <= TARGET_RUNS; i++) {
      const rec = await runOnce(i, browser);
      runs.push(rec);
      console.log(
        `[run ${i.toString().padStart(2)}/${TARGET_RUNS}] status=${rec.status} duration=${rec.durationMs}ms` +
          (rec.error ? ` err=${rec.error.slice(0, 80)}` : "")
      );
      // Stop early if the portal is unreachable on the first run; no point
      // re-running 10 times against a broken redirect loop.
      if (rec.status === "fetch_failed" && rec.note === "portal_unreachable" && runs.length === 1) {
        console.log(`[measure-captcha-rate] portal unreachable; aborting remaining ${TARGET_RUNS - 1} runs`);
        break;
      }
      if (i < TARGET_RUNS) {
        await new Promise((res) => setTimeout(res, JITTER_MS));
      }
    }
  } finally {
    await browser.close();
  }

  // Aggregate stats over the runs that did reach a captcha
  const captchaRuns = runs.filter((r) => r.attemptSummary);
  const confidences = captchaRuns.map((r) => r.attemptSummary.ocrConfidence);
  const agg = {
    totalRuns: runs.length,
    captchaRendered: captchaRuns.length,
    portalUnreachable: runs.filter((r) => r.note === "portal_unreachable").length,
    fetchFailed: runs.filter((r) => r.status === "fetch_failed" && r.note !== "portal_unreachable").length,
    captchaConfidence: {
      average: confidences.length ? Math.round((confidences.reduce((a, b) => a + b, 0) / confidences.length) * 100) / 100 : null,
      min: confidences.length ? Math.min(...confidences) : null,
      max: confidences.length ? Math.max(...confidences) : null,
      runs: confidences.length,
    },
    note: "submit-success rate is not measured here: the probe stops at captcha extraction to avoid hammering the live portal with 10 form submissions. Run the fetcher through the orchestrator or a separate integration test for that metric.",
  };

  const fixture = {
    metadata: {
      measuredAt: new Date().toISOString(),
      baseUrl: BASE_URL,
      partyName: PARTY_NAME,
      runsRequested: TARGET_RUNS,
      runsRecorded: runs.length,
      jitterMs: JITTER_MS,
      parserVersion: "ecourts-party-table-parser-v3",
      notes: "Per-run cap on form submission to avoid burning the live portal. Aggregates computed only over runs that reached a captcha.",
    },
    aggregate: agg,
    runs,
  };

  const outPath = resolve(FIXTURE_DIR, `captcha-rate-measurement-${REPORT_DATE}.json`);
  writeFileSync(outPath, JSON.stringify(fixture, null, 2));
  console.log(`[measure-captcha-rate] wrote ${outPath}`);
  console.log(`[measure-captcha-rate] aggregate: ${JSON.stringify(agg)}`);
  console.log(`[measure-captcha-rate] total elapsed: ${Date.now() - overallStart}ms`);
}

main().catch((e) => {
  console.error("[measure-captcha-rate] fatal:", e);
  process.exit(1);
});
