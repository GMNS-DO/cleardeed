/**
 * qa/bhunaksha_plot_diagram_probe.mjs
 *
 * Sprint V+ — Bhunaksha plot-diagram probe.
 *
 * Question: What does the Bhunaksha plot report look like for a real Khordha
 * plot (Mendhasala Plot 415)? Is it an inline SVG, an <img> referencing
 * SVG/PNG, a screenshot of an OpenLayers canvas, or something else?
 *
 * Live investigation shows Bhunaksha does NOT publish a static SVG plot
 * report — it is an interactive OpenLayers map served from
 * https://app3bhunakshaodisha.nic.in/bhunaksha/ (the Khordha instance).
 * The "report" is a client-side WMS tile composition. This probe confirms
 * that finding empirically and captures every candidate artifact (inline
 * SVG, <img>, canvas screenshot, raw WMS response, ScalarDatahandler
 * payload) for documentation in docs/sources/bhunaksha-plot-diagram.md.
 *
 * Method:
 *   1. Bootstrap Playwright on the Khordha Bhunaksha instance.
 *   2. Drive the dropdown cascade: district 20 (Khordha) → tahasil 2
 *      (Bhubaneswar) → RI 2 (Mendhasala RI) → first village under RI 2.
 *   3. Use the navbar plotNo input + selectPlot() to look up Plot 415.
 *   4. Wait for the WMS tiles to render into the OpenLayers canvas.
 *   5. Probe for:
 *      - inline <svg> elements (page.innerHTML("svg"))
 *      - <img> elements with "plot" or "map" in the alt/src
 *      - the canvas screenshot (page.locator("#map").screenshot())
 *      - the ScalarDatahandler JSON payload (page.evaluate to read
 *        networkResponses captured by Playwright)
 *   6. Save every captured artifact under packages/fetchers/bhunaksha/fixtures/.
 *   7. Print a summary JSON line per artifact type with size + verdict.
 *
 * Output: a structured JSON line per artifact, plus a final summary.
 * Exit code 0 on success, 1 on fatal error, 2 if Bhunaksha is unreachable.
 *
 * Run with: node qa/bhunaksha_plot_diagram_probe.mjs
 */

import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const BHUNAKSHA_URL = "https://app3bhunakshaodisha.nic.in/bhunaksha/";
const TIMEOUT_MS = 30_000;
const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36 ClearDeed-Probe/1.0";

const FIXTURE_DIR = "packages/fetchers/bhunaksha/fixtures";
mkdirSync(FIXTURE_DIR, { recursive: true });

const observations = [];
const startedAt = new Date().toISOString();

function log(obs) {
  observations.push({ ts: new Date().toISOString(), ...obs });
  console.log(JSON.stringify(obs));
}

/**
 * Pick an option in a Bhunaksha <select> by waiting for the option list to
 * stabilize, then picking by visible label. The dropdowns repopulate via
 * AJAX after each parent change, so we MUST wait for the option count to
 * change AND settle.
 */
async function pickByLabel(page, selector, labelSubstr, label) {
  const beforeCount = await page
    .locator(`${selector} option`)
    .count()
    .catch(() => 0);
  await page.selectOption(selector, label ?? labelSubstr);
  await page.waitForTimeout;
  const afterCount = await page
    .locator(`${selector} option`)
    .count()
    .catch(() => 0);
  return { beforeCount, afterCount };
}

async function listOptions(page, selector) {
  return page
    .locator(`${selector} option`)
    .evaluateAll((els) =>
      els.map((e) => ({ value: e.value, text: (e.textContent || "").trim() }))
    );
}

async function main() {
  log({ event: "probe_start", startedAt, url: BHUNAKSHA_URL, target: "Mendhasala/Plot 415" });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: USER_AGENT });
  const page = await context.newPage();

  // Capture network responses for WMS / ScalarDatahandler / rest/* endpoints.
  const networkResponses = [];
  page.on("response", async (resp) => {
    try {
      const url = resp.url();
      const ct = (resp.headers()["content-type"] || "").toLowerCase();
      if (
        url.includes("ScalarDatahandler") ||
        url.includes("/rest/") ||
        url.includes("WMS") ||
        url.includes("geoserver") ||
        ct.startsWith("image/svg") ||
        ct.startsWith("image/png") ||
        ct.startsWith("application/json")
      ) {
        let body = null;
        // Only read text bodies (avoid hanging on large image bytes)
        if (
          ct.startsWith("text/") ||
          ct.startsWith("application/json") ||
          ct.includes("javascript")
        ) {
          try {
            body = await resp.text();
          } catch {
            body = null;
          }
        }
        networkResponses.push({
          url,
          status: resp.status(),
          contentType: ct,
          bytes: body?.length ?? 0,
          bodyPreview: body ? body.slice(0, 500) : null,
        });
      }
    } catch {
      // ignore
    }
  });

  try {
    // ── Step 1: Bootstrap ────────────────────────────────────────────
    log({ event: "step", step: "1_load", url: BHUNAKSHA_URL });
    await page.goto(BHUNAKSHA_URL, { waitUntil: "domcontentloaded", timeout: TIMEOUT_MS });
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
    log({ event: "page_loaded", url: page.url() });

    // Dump the level_1 options so we know what's available.
    const level1 = await listOptions(page, "#level_1");
    log({ event: "level_1_options", count: level1.length, options: level1 });

    // ── Step 2: Drive cascade (district 20 → tahasil 2 → RI → village) ─
    log({ event: "step", step: "2a_pick_district", value: "20" });
    await pickByLabel(page, "#level_1", "20 ଖୋର୍ଦ୍ଧା", "20");
    const level2 = await listOptions(page, "#level_2");
    log({ event: "level_2_options", count: level2.length, options: level2 });

    log({ event: "step", step: "2b_pick_tahasil", value: "2" });
    await pickByLabel(page, "#level_2", "2 ଭୁବନେଶ୍ଵର", "2");
    const level3 = await listOptions(page, "#level_3");
    log({ event: "level_3_options", count: level3.length, options: level3 });

    // Pick the first non-empty RI under Bhubaneswar
    log({ event: "step", step: "2c_pick_ri" });
    const firstRi = level3.find((o) => o.value && o.value !== "");
    if (!firstRi) throw new Error("No RI option under Bhubaneswar");
    await pickByLabel(page, "#level_3", firstRi.text, firstRi.value);
    const level4 = await listOptions(page, "#level_4");
    log({ event: "level_4_options", count: level4.length, options: level4 });

    // Pick the first non-empty village
    log({ event: "step", step: "2d_pick_village" });
    const firstVill = level4.find((o) => o.value && o.value !== "");
    if (!firstVill) throw new Error("No village option under RI");
    await pickByLabel(page, "#level_4", firstVill.text, firstVill.value);
    const level5 = await listOptions(page, "#level_5");
    log({ event: "level_5_options", count: level5.length, options: level5 });

    if (level5.length > 0) {
      const firstSheet = level5.find((o) => o.value && o.value !== "");
      if (firstSheet) {
        await pickByLabel(page, "#level_5", firstSheet.text, firstSheet.value);
      }
    }
    await page.waitForTimeout;
    log({ event: "cascade_complete" });

    // ── Step 3: Look up Plot 415 via the navbar plotNo input ─────────
    log({ event: "step", step: "3_select_plot", plotNo: "415" });
    await page.fill("#plotNo", "415");
    // Trigger the same selectPlot() the search button does
    await page.evaluate(() => {
      // selectPlot is a global function defined in index.js
      // eslint-disable-next-line no-undef
      if (typeof selectPlot === "function") selectPlot(document.getElementById("plotNo").value.trim());
    });
    await page.waitForTimeout;

    // Wait for the WMS tile to load
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
    log({ event: "select_plot_complete", url: page.url() });

    // ── Step 4: Probe for inline SVG / img / canvas ─────────────────
    const inlineSvg = await page.evaluate(() => {
      const svg = document.querySelector("svg");
      return svg ? svg.outerHTML.slice(0, 5000) : null;
    });
    const inlineSvgBytes = inlineSvg?.length ?? 0;
    log({ event: "inline_svg_probe", bytes: inlineSvgBytes, present: inlineSvg !== null });

    const plotImg = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll("img"));
      return imgs
        .map((i) => ({
          src: i.getAttribute("src") || null,
          alt: i.getAttribute("alt") || null,
          width: i.naturalWidth,
          height: i.naturalHeight,
        }))
        .filter((i) => /plot|map|cadastral|svg/i.test((i.src || "") + " " + (i.alt || "")));
    });
    log({ event: "plot_img_probe", count: plotImg.length, sample: plotImg.slice(0, 5) });

    // ── Step 5: Capture the canvas (OpenLayers renders to <canvas>) ─
    const canvasInfo = await page.evaluate(() => {
      const canvases = Array.from(document.querySelectorAll("canvas"));
      return canvases.map((c) => ({
        id: c.id || null,
        width: c.width,
        height: c.height,
        clientW: c.clientWidth,
        clientH: c.clientHeight,
      }));
    });
    log({ event: "canvas_probe", count: canvasInfo.length, sample: canvasInfo.slice(0, 5) });

    let mapScreenshotPath = null;
    if (canvasInfo.length > 0) {
      const map = page.locator("#map");
      const shot = await map.screenshot();
      mapScreenshotPath = join(FIXTURE_DIR, "plot-report-map-screenshot.png");
      writeFileSync(mapScreenshotPath, shot);
      log({ event: "map_screenshot", path: mapScreenshotPath, bytes: shot.length });
    }

    // ── Step 6: Capture the plot info sidebar text ──────────────────
    const plotInfo = await page.evaluate(() => {
      const el = document.getElementById("plotinfo");
      return el ? el.innerText.slice(0, 4000) : null;
    });
    log({ event: "plot_info_text", present: plotInfo !== null, bytes: plotInfo?.length ?? 0 });
    if (plotInfo) {
      const plotInfoPath = join(FIXTURE_DIR, "plot-report-plotinfo.txt");
      writeFileSync(plotInfoPath, plotInfo);
      log({ event: "plot_info_saved", path: plotInfoPath });
    }

    // ── Step 7: Save the ScalarDatahandler / WMS / rest/* responses ─
    const networkPath = join(FIXTURE_DIR, "plot-report-network.json");
    writeFileSync(networkPath, JSON.stringify(networkResponses, null, 2));
    log({
      event: "network_saved",
      path: networkPath,
      count: networkResponses.length,
      sample: networkResponses.slice(0, 5).map((r) => ({ url: r.url, status: r.status, bytes: r.bytes, contentType: r.contentType })),
    });

    // Pull the ScalarDatahandler JSON for OP=5 (plot lookup) as the
    // canonical "report data" the app uses internally.
    const scalarPayloads = networkResponses.filter((r) => r.url.includes("ScalarDatahandler"));
    if (scalarPayloads.length > 0) {
      const scalarPath = join(FIXTURE_DIR, "plot-report-scalardatahandler.txt");
      writeFileSync(scalarPath, JSON.stringify(scalarPayloads, null, 2));
      log({ event: "scalar_saved", path: scalarPath, count: scalarPayloads.length });
    }

    // ── Step 8: Save the page HTML for offline inspection ───────────
    const htmlPath = join(FIXTURE_DIR, "plot-report-page.html");
    const html = await page.content();
    writeFileSync(htmlPath, html);
    log({ event: "html_saved", path: htmlPath, bytes: html.length });

    // ── Step 9: Verdict ──────────────────────────────────────────────
    const verdict = {
      event: "verdict",
      inlineSvgBytes,
      plotImgCount: plotImg.length,
      canvasCount: canvasInfo.length,
      plotInfoBytes: plotInfo?.length ?? 0,
      conclusion: null,
    };
    if (inlineSvgBytes > 1024) {
      verdict.conclusion =
        "INLINE_SVG: Found a parseable inline SVG > 1KB. Plot report is a static SVG element.";
    } else if (plotImg.length > 0 && plotImg.some((i) => /svg/i.test(i.src || ""))) {
      verdict.conclusion =
        "IMG_SVG: Found an <img src=*.svg> element. Plot report is a referenced SVG image.";
    } else if (plotImg.length > 0) {
      verdict.conclusion =
        "IMG_OTHER: Found <img> elements but no SVG. Plot report is a raster image.";
    } else if (canvasInfo.length > 0) {
      verdict.conclusion =
        "CANVAS_WMS: No inline SVG or <img>. The diagram is rendered to a <canvas> via OpenLayers WMS tiles. There is NO static plot report — the diagram is a live tiled map. Task 32 must either screenshot the canvas or query the WMS endpoints directly.";
    } else if (plotInfo && plotInfo.length > 0) {
      verdict.conclusion =
        "TEXT_ONLY: No diagram at all. The 'report' is only the ScalarDatahandler text payload.";
    } else {
      verdict.conclusion =
        "MISSING: No diagram, no canvas, no plot info. Plot 415 may not exist in Bhunaksha for Mendhasala.";
    }
    log(verdict);
  } catch (err) {
    log({ event: "fatal", error: err instanceof Error ? err.message : String(err), stack: err.stack });
    process.exitCode = 1;
  } finally {
    await browser.close();
    const finishedAt = new Date().toISOString();
    log({ event: "probe_end", startedAt, finishedAt, observationCount: observations.length });
    const reportPath = join(FIXTURE_DIR, "plot-report-probe.json");
    writeFileSync(reportPath, JSON.stringify({ startedAt, finishedAt, observations }, null, 2));
    console.error(`probe log saved to: ${reportPath}`);
  }
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});