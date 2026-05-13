#!/usr/bin/env npx tsx
/**
 * Inspects the Bhulekh plot dropdown options.
 * Run: pnpm dlx tsx scripts/probe-bhulekh-plot-options.ts
 */
import { chromium } from "playwright";

const ROR_VIEW = "https://bhulekh.ori.nic.in/RoRView.aspx";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setExtraHTTPHeaders({
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
  });

  await page.goto(ROR_VIEW, { waitUntil: "domcontentloaded", timeout: 30_000 });
  if (page.url().includes("BhulekhError.aspx")) {
    await page.locator("a", { hasText: "here" }).click();
    await page.waitForURL(/RoRView\.aspx/, { timeout: 30_000 });
  }

  await page.selectOption("#ctl00_ContentPlaceHolder1_ddlDistrict", "20");
  await page.waitForFunction(() => {
    const el = document.querySelector<HTMLSelectElement>("#ctl00_ContentPlaceHolder1_ddlTahsil");
    return !!el && el.options.length > 1;
  }, { timeout: 15_000 });

  await page.selectOption("#ctl00_ContentPlaceHolder1_ddlTahsil", "2");
  await page.waitForFunction(() => {
    const el = document.querySelector<HTMLSelectElement>("#ctl00_ContentPlaceHolder1_ddlVillage");
    return !!el && el.options.length > 1;
  }, { timeout: 15_000 });

  await page.selectOption("#ctl00_ContentPlaceHolder1_ddlVillage", "105");
  await page.waitForFunction(() => {
    const el = document.querySelector<HTMLInputElement>("#ctl00_ContentPlaceHolder1_rbtnRORSearchtype_0");
    return !!el && !el.disabled;
  }, { timeout: 15_000 });

  await page.locator('input[name="ctl00$ContentPlaceHolder1$rbtnRORSearchtype"][value="Plot"]').click();
  await page.waitForFunction(() => {
    const el = document.querySelector<HTMLSelectElement>("#ctl00_ContentPlaceHolder1_ddlBindData");
    return !!el && el.options.length > 1;
  }, { timeout: 15_000 });

  // Inspect ALL options
  const options = await page.evaluate(() => {
    const sel = document.querySelector<HTMLSelectElement>("#ctl00_ContentPlaceHolder1_ddlBindData");
    if (!sel) return { count: 0, options: [] };
    const opts = Array.from(sel.options).map(o => ({
      index: o.index,
      value: o.value,
      text: o.textContent?.replace(/\s+/g, " ").trim() ?? "",
      valueBytes: new TextEncoder().encode(o.value).length,
      textBytes: new TextEncoder().encode(o.textContent ?? "").length,
    }));
    return { count: sel.options.length, options: opts };
  });

  console.log(`Total options: ${options.count}`);
  console.log("\nFirst 10 options:");
  for (const o of options.options.slice(0, 10)) {
    console.log(`  [${o.index}] value=${JSON.stringify(o.value)} (${o.valueBytes}B) text=${JSON.stringify(o.text)}`);
  }

  // Find options with text "128"
  const plot128 = options.options.filter(o => o.text === "128");
  console.log(`\nOptions with text "128":`, plot128);

  // Try selecting with label
  console.log("\nTrying selectOption with {label: '128'}...");
  const byLabel = await page.locator("#ctl00_ContentPlaceHolder1_ddlBindData").selectOption({ label: "128" });
  console.log("Selected:", byLabel);

  const afterSelect = await page.evaluate(() => {
    const sel = document.querySelector<HTMLSelectElement>("#ctl00_ContentPlaceHolder1_ddlBindData");
    return sel?.value ?? null;
  });
  console.log("After selectOption({label: '128'}), value:", JSON.stringify(afterSelect));

  // Reset and try with value
  await page.reload({ waitUntil: "domcontentloaded" });
  // Re-do cascade (simplified - just do it)
  await page.selectOption("#ctl00_ContentPlaceHolder1_ddlDistrict", "20");
  await page.waitForTimeout(500);
  await page.selectOption("#ctl00_ContentPlaceHolder1_ddlTahsil", "2");
  await page.waitForTimeout(500);
  await page.selectOption("#ctl00_ContentPlaceHolder1_ddlVillage", "105");
  await page.waitForFunction(() => {
    const r = document.querySelector<HTMLInputElement>("#ctl00_ContentPlaceHolder1_rbtnRORSearchtype_0");
    return !!r && !r.disabled;
  }, { timeout: 10000 });
  await page.locator('input[name="ctl00$ContentPlaceHolder1$rbtnRORSearchtype"][value="Plot"]').click();
  await page.waitForTimeout(500);

  // Try with actual option index
  console.log("\nTrying selectOption with index 1...");
  const byIndex = await page.locator("#ctl00_ContentPlaceHolder1_ddlBindData").selectOption({ index: 1 });
  console.log("Selected:", byIndex);
  const afterIndex = await page.evaluate(() => {
    const sel = document.querySelector<HTMLSelectElement>("#ctl00_ContentPlaceHolder1_ddlBindData");
    return { value: sel?.value ?? null, text: sel?.selectedOptions[0]?.textContent?.trim() ?? null };
  });
  console.log("After selectOption({index: 1}), value:", JSON.stringify(afterIndex.value), "text:", JSON.stringify(afterIndex.text));

  await browser.close();
}

main().catch(console.error);
