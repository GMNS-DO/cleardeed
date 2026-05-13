#!/usr/bin/env npx tsx
/**
 * Gets the SRoRFront_Uni page HTML for Mendhasala + plot 128 via Playwright.
 * Run: pnpm dlx tsx scripts/probe-bhulekh-sror-playwright.ts
 */
import { chromium } from "playwright";
import { writeFileSync } from "fs";
import path from "path";

const ROR_VIEW = "https://bhulekh.ori.nic.in/RoRView.aspx";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setExtraHTTPHeaders({
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
  });

  // Bootstrap
  await page.goto(ROR_VIEW, { waitUntil: "domcontentloaded", timeout: 30_000 });
  if (page.url().includes("BhulekhError.aspx")) {
    await page.locator("a", { hasText: "here" }).click();
    await page.waitForURL(/RoRView\.aspx/, { timeout: 30_000 });
  }

  // Cascade: district → tahasil → village → plot mode
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

  // Plot mode
  await page.locator('input[name="ctl00$ContentPlaceHolder1$rbtnRORSearchtype"][value="Plot"]').click();
  await page.waitForFunction(() => {
    const el = document.querySelector<HTMLSelectElement>("#ctl00_ContentPlaceHolder1_ddlBindData");
    return !!el && el.options.length > 1;
  }, { timeout: 15_000 });

  // Select plot 128
  const plotValue = await page.evaluate(() => {
    const sel = document.querySelector<HTMLSelectElement>("#ctl00_ContentPlaceHolder1_ddlBindData");
    if (!sel) return null;
    for (const opt of sel.options) {
      if (opt.textContent?.trim() === "128") return opt.value.trim();
    }
    return null;
  });
  console.log("Plot 128 value:", plotValue);

  if (!plotValue) { await browser.close(); return; }

  await page.selectOption("#ctl00_ContentPlaceHolder1_ddlBindData", plotValue);

  await page.waitForFunction(() => {
    const btn = document.querySelector<HTMLInputElement>("#ctl00_ContentPlaceHolder1_btnRORFront");
    return !!btn && !btn.disabled;
  }, { timeout: 15_000 });

  // Click View RoR
  console.log("Clicking View RoR...");
  await Promise.all([
    page.waitForURL(/SRoRFront_Uni\.aspx|CRoRFront_Uni\.aspx/, { timeout: 30_000 }),
    page.locator("#ctl00_ContentPlaceHolder1_btnRORFront").click(),
  ]);

  await page.waitForLoadState("networkidle");
  const html = await page.content();
  console.log("RoR page loaded:", page.url(), "HTML length:", html.length);

  writeFileSync(path.join(process.cwd(), "scripts", "probe", "bhulekh-sror-playwright-plot128.html"), html);
  console.log("Saved to scripts/probe/bhulekh-sror-playwright-plot128.html");

  // Print all visible text to understand structure
  const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 3000));
  console.log("\n--- BODY TEXT (first 3000 chars) ---");
  console.log(bodyText);

  // Print all table structures
  const tableInfo = await page.evaluate(() => {
    const tables = document.querySelectorAll("table");
    return Array.from(tables).map((t, i) => {
      const rows = t.querySelectorAll("tr");
      const headerCells = rows[0] ? Array.from(rows[0].querySelectorAll("th, td")).map(c => c.textContent?.trim() ?? "") : [];
      return { index: i, rows: rows.length, headerCells, firstRow: rows[1] ? Array.from(rows[1].querySelectorAll("td")).map(c => c.textContent?.trim() ?? "") : [] };
    });
  });
  console.log("\n--- TABLES ---");
  for (const t of tableInfo.slice(0, 5)) {
    console.log(`Table ${t.index}: ${t.rows} rows, header: [${t.headerCells.join(" | ")}]`);
    if (t.firstRow.length > 0) console.log(`  first data row: [${t.firstRow.join(" | ")}]`);
  }

  // Print all spans with IDs
  const spans = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("[id]")).slice(0, 40).map(el => ({
      id: el.id, tag: el.tagName, text: (el as HTMLElement).innerText?.replace(/\s+/g, " ").trim().slice(0, 60) ?? ""
    }));
  });
  console.log("\n--- ELEMENT IDs ---");
  for (const s of spans) console.log(`  #${s.id} (${s.tag}): ${s.text}`);

  await browser.close();
}

main().catch(console.error);