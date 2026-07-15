/**
 * qa/bhulekh_introspect.mjs
 *
 * Tiny one-shot script: open RoRView.aspx in Playwright, wait for the
 * page to fully load, and dump every <select> on the page along with its
 * name/id and the first 5 options. This is the only way to know the
 * real control IDs and option shapes the live portal is using today.
 */
import { chromium } from "playwright-core";

const TIMEOUT_MS = 30_000;

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
const page = await ctx.newPage();
try {
  await page.goto("https://bhulekh.ori.nic.in/RoRView.aspx", {
    waitUntil: "domcontentloaded",
    timeout: TIMEOUT_MS,
  });
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
  // Give ASP.NET UpdatePanel async postbacks a moment to settle.
  await page.waitForTimeout;

  const selects = await page.$$eval("select", (els) =>
    els.map((e) => ({
      id: e.id,
      name: e.name,
      visible: e.offsetParent !== null,
      optionCount: e.options.length,
      first5: Array.from(e.options).slice(0, 5).map((o) => ({
        value: o.value,
        text: (o.textContent || "").trim(),
      })),
    }))
  );
  console.log("SELECTS:", JSON.stringify(selects, null, 2));

  // Also dump all <a> on the page so we can see what the "View RoR" button
  // and any pre-rendered links look like.
  const links = await page.$$eval("a", (els) =>
    els.slice(0, 30).map((e) => ({
      id: e.id,
      name: e.name,
      text: (e.textContent || "").trim().slice(0, 80),
      href: (e.getAttribute("href") || "").slice(0, 100),
    }))
  );
  console.log("LINKS:", JSON.stringify(links, null, 2));

  // Buttons
  const buttons = await page.$$eval("input[type=submit], input[type=button], button", (els) =>
    els.map((e) => ({
      id: e.id,
      name: e.name,
      type: e.type,
      value: e.value,
      text: (e.textContent || "").trim().slice(0, 80),
    }))
  );
  console.log("BUTTONS:", JSON.stringify(buttons, null, 2));

  // Title
  const title = await page.title();
  console.log("TITLE:", title);
} catch (err) {
  console.error("FATAL:", err);
  process.exitCode = 1;
} finally {
  await browser.close();
}
