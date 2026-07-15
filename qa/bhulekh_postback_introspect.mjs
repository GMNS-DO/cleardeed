/**
 * qa/bhulekh_postback_introspect.mjs
 *
 * What happens after the page loads? Try clicking btnSubmit (the only
 * visible submit button on the captcha-gated landing page) and see what
 * the response looks like. Also try __doPostBack on the "here" link
 * (the existing fetcher reads its href — see packages/fetchers/bhulekh/src/index.ts:904).
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
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);

  console.log("=== BEFORE submit ===");
  console.log("URL:", page.url());
  console.log("SELECTS:", (await page.$$("select")).length);
  console.log("IMG (any captcha?):", await page.$$eval("img", (els) =>
    els.map((e) => ({ id: e.id, src: (e.getAttribute("src") || "").slice(0, 120), alt: e.alt }))
  ));
  console.log("ALL INPUTS:", await page.$$eval("input", (els) =>
    els.map((e) => ({ id: e.id, name: e.name, type: e.type, value: e.value }))
  ));

  // Try the "here" link which is ctl00_ContentPlaceHolder1_LinkButton1
  console.log("\n=== Clicking 'here' LinkButton ===");
  try {
    await page.click("#ctl00_ContentPlaceHolder1_LinkButton1", { timeout: 5000 });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
    await page.waitForTimeout;
  } catch (err) {
    console.log("link click failed:", err.message);
  }
  console.log("URL after click:", page.url());
  const selects2 = await page.$$eval("select", (els) =>
    els.map((e) => ({
      id: e.id,
      name: e.name,
      visible: e.offsetParent !== null,
      optionCount: e.options.length,
      first5: Array.from(e.options).slice(0, 5).map((o) => ({ value: o.value, text: (o.textContent || "").trim() })),
    }))
  );
  console.log("SELECTS after click:", JSON.stringify(selects2, null, 2));
  console.log("ALL IMGs after click:", await page.$$eval("img", (els) =>
    els.map((e) => ({ id: e.id, src: (e.getAttribute("src") || "").slice(0, 120), alt: e.alt }))
  ));

  // Save the page HTML so we can see what's there
  const html = await page.content();
  const fs = await import("node:fs");
  fs.writeFileSync("/tmp/bhulekh_postback.html", html);
  console.log("\nSaved HTML to /tmp/bhulekh_postback.html (length:", html.length, ")");
} catch (err) {
  console.error("FATAL:", err);
  process.exitCode = 1;
} finally {
  await browser.close();
}
