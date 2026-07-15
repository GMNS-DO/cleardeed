/**
 * qa/bhulekh_district_list.mjs
 *
 * Read every option in the ddlDistrict dropdown on the live portal so we
 * can confirm the Khordha district code (the villages.ts file claims
 * 20, but the live portal may differ).
 */
import { chromium } from "playwright-core";

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
const page = await ctx.newPage();
try {
  await page.goto("https://bhulekh.ori.nic.in/RoRView.aspx", {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
  const here = await page.$("#ctl00_ContentPlaceHolder1_LinkButton1");
  if (here) {
    await here.click();
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
    await page.waitForTimeout(500);
  }
  const all = await page.$$eval("#ctl00_ContentPlaceHolder1_ddlDistrict option", (els) =>
    els.map((e) => ({ value: e.value, text: (e.textContent || "").trim() }))
  );
  console.log("DISTRICTS:", JSON.stringify(all, null, 2));
  const khordha = all.find((o) => o.text?.includes("ଖୋର୍ଦ୍ଧା") || o.text?.toLowerCase().includes("khordha"));
  console.log("KHORDHA:", khordha);
} catch (err) {
  console.error("FATAL:", err);
} finally {
  await browser.close();
}
