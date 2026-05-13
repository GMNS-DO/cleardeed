/**
 * Bhulekh dropdown text probe — check what villages look like after selection
 *
 * Run: npx tsx scripts/probe/bhulekh-village-text-probe.ts
 */

import { chromium, type Page } from "playwright";

const BHULEKH_URL = "https://bhulekh.ori.nic.in";
const TIMEOUT_MS = 30_000;

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    console.log("=== Bhulekh Village Text Probe ===");

    // Bootstrap
    await page.goto(`${BHULEKH_URL}/RoRView.aspx`, { waitUntil: "domcontentloaded", timeout: TIMEOUT_MS });
    if (page.url().includes("BhulekhError.aspx")) {
      await page.locator("a", { hasText: "here" }).click();
      await page.waitForURL(/RoRView\.aspx/, { timeout: TIMEOUT_MS });
    }

    await page.selectOption("#ctl00_ContentPlaceHolder1_ddlDistrict", "20");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);

    await page.selectOption("#ctl00_ContentPlaceHolder1_ddlTahsil", "2");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);

    // Read village options and check what characters they contain
    const villages = await page.evaluate(() => {
      const el = document.querySelector("#ctl00_ContentPlaceHolder1_ddlVillage") as HTMLSelectElement;
      if (!el) return [];
      return Array.from(el.options).slice(1, 5).map(o => ({
        value: o.value,
        text: o.textContent || "",
        textCodes: Array.from(o.textContent || "").map(c => c.charCodeAt(0).toString(16)),
        textBytes: Buffer.from(o.textContent || "").toString("hex"),
      }));
    });

    console.log("\nVillage dropdown text analysis:");
    villages.forEach((v, i) => {
      console.log(`\nVillage ${i + 1} [${v.value}]:`);
      console.log(`  Text: "${v.text}"`);
      console.log(`  Char codes: ${v.textCodes.join(", ")}`);
      console.log(`  UTF-8 hex: ${v.textBytes}`);
    });

    // Compare with villages.ts expected value
    const expectedMendha = "ମେଣ୍ଢାଶାଳ";
    console.log(`\nExpected Mendhasala: "${expectedMendha}"`);
    console.log(`  Char codes: ${Array.from(expectedMendha).map(c => c.charCodeAt(0).toString(16)).join(", ")}`);
    console.log(`  UTF-8 hex: ${Buffer.from(expectedMendha).toString("hex")}`);

    // Try direct code selection to verify
    console.log("\n=== Trying direct code selection ===");

    // Try code 105 (Mendhasala)
    const villagesByCode = await page.evaluate(() => {
      const el = document.querySelector("#ctl00_ContentPlaceHolder1_ddlVillage") as HTMLSelectElement;
      if (!el) return {};
      return Array.from(el.options).reduce((acc, o) => {
        acc[o.value] = o.textContent || "";
        return acc;
      }, {} as Record<string, string>);
    });

    console.log("Village code 105:", villagesByCode["105"] || "NOT IN DROPDOWN");
    console.log("Village code 2:", villagesByCode["2"] || "NOT IN DROPDOWN");
    console.log("Village code 104:", villagesByCode["104"] || "NOT IN DROPDOWN");

    // Select village 105 and check if Mendhasala text matches
    await page.selectOption("#ctl00_ContentPlaceHolder1_ddlVillage", "105");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);

    await page.waitForFunction(() => {
      const r = document.querySelector<HTMLInputElement>("#ctl00_ContentPlaceHolder1_rbtnRORSearchtype_0");
      return !!r && !r.disabled;
    }, { timeout: 15_000 });

    console.log("\nSelected village 105. Checking plot dropdown...");
    await page.locator("#ctl00_ContentPlaceHolder1_rbtnRORSearchtype_1").click();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout;

    const plots = await page.evaluate(() => {
      const el = document.querySelector("#ctl00_ContentPlaceHolder1_ddlBindData") as HTMLSelectElement;
      if (!el) return [];
      return Array.from(el.options).slice(1, 6).map(o => ({
        value: o.value,
        text: o.textContent || "",
      }));
    });

    console.log("Plot options (first 5):");
    plots.forEach(p => console.log(`  [${p.value}] "${p.text}"`));

    console.log("\n=== DONE ===");

  } finally {
    await browser.close();
  }
}

run().catch(console.error);
