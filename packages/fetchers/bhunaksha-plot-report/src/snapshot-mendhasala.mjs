/**
 * Captures a screenshot of the live plotreportOR.jsp render for the P051
 * ground-truth record. Run with:
 *
 *   npx tsx src/snapshot-mendhasala.mjs
 *
 * Output: /Users/deekshamohapatra/Documents/cleardeed/qa/ground_truth/P051/screenshots/plot_report_dom.png
 */
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const URL = "https://app3bhunakshaodisha.nic.in/bhunaksha/21/plotreportOR.jsp?state=21&giscode=20021110500&plotno=181%2F10454";
const OUT_DIR = "/Users/deekshamohapatra/Documents/cleardeed/qa/ground_truth/P051/screenshots";
const OUT_FILE = join(OUT_DIR, "plot_report_dom.png");

mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 1200 },
  userAgent: "Mozilla/5.0 ClearDeed/1.0",
});
const page = await ctx.newPage();

const t0 = Date.now();
console.log(`[snapshot] navigating to ${URL}`);
await page.goto(URL, { waitUntil: "networkidle", timeout: 60_000 });
await page.waitForSelector("#htmlReport", { state: "attached", timeout: 15_000 });
await page.waitForLoadState("networkidle", { timeout: 5_000 });

// Crop to #htmlReport for a tighter, more useful screenshot.
const report = page.locator("#htmlReport");
await report.screenshot({ path: OUT_FILE, omitBackground: false });
const elapsed = Date.now() - t0;
console.log(`[snapshot] elapsed ${elapsed}ms`);
console.log(`[snapshot] wrote ${OUT_FILE}`);

await browser.close();
