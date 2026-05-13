#!/usr/bin/env npx tsx
/**
 * Final canary: replicate exact working flow from first canary run.
 * - selectOption for cascade (these work)
 * - selectOption for plot 128 by TEXT (NOT by value)
 * - locator().click() for View RoR (this navigated in first run)
 * Run: pnpm dlx tsx scripts/probe-bhulekh-final.ts
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

  try {
    // Bootstrap
    await page.goto(ROR_VIEW, { waitUntil: "domcontentloaded", timeout: 30_000 });
    if (page.url().includes("BhulekhError.aspx")) {
      await page.locator("a", { hasText: "here" }).click();
      await page.waitForURL(/RoRView\.aspx/, { timeout: 30_000 });
    }

    // District
    await page.selectOption("#ctl00_ContentPlaceHolder1_ddlDistrict", "20");
    await page.waitForLoadState("networkidle");

    // Tahasil
    await page.selectOption("#ctl00_ContentPlaceHolder1_ddlTahsil", "2");
    await page.waitForFunction(() => {
      const el = document.querySelector<HTMLSelectElement>("#ctl00_ContentPlaceHolder1_ddlVillage");
      return !!el && el.options.length > 1;
    }, { timeout: 15_000 });

    // Village
    await page.selectOption("#ctl00_ContentPlaceHolder1_ddlVillage", "105");
    await page.waitForFunction(() => {
      const el = document.querySelector<HTMLInputElement>("#ctl00_ContentPlaceHolder1_rbtnRORSearchtype_0");
      return !!el && !el.disabled;
    }, { timeout: 15_000 });

    // Plot mode
    await page.locator('input[name="ctl00$ContentPlaceHolder1$rbtnRORSearchtype"][value="Plot"]').click();
    await page.waitForLoadState("networkidle");

    // Wait for plot dropdown
    await page.waitForFunction(() => {
      const el = document.querySelector<HTMLSelectElement>("#ctl00_ContentPlaceHolder1_ddlBindData");
      return !!el && el.options.length > 1;
    }, { timeout: 15_000 });

    // Read plot options (TRIM values like the working first canary did)
    const plotOpts = await page.evaluate(() => {
      const sel = document.querySelector<HTMLSelectElement>("#ctl00_ContentPlaceHolder1_ddlBindData");
      if (!sel) return [];
      return Array.from(sel.options)
        .filter(o => o.value.trim())
        .map(o => ({ value: o.value.trim(), text: o.textContent?.replace(/\s+/g, " ").trim() ?? "" }));
    });
    console.log("Total plot options:", plotOpts.length);

    const plot128 = plotOpts.find(o => o.text === "128");
    console.log("Plot 128:", plot128 ? `found (value="${plot128.value}")` : "NOT FOUND");
    console.log("First 5 options:", plotOpts.slice(0, 5).map(o => `${o.text}(${o.value})`));

    if (!plot128) {
      console.log("ABORT: plot 128 not found");
      await browser.close();
      return;
    }

    // Select plot by TEXT (first canary used value="830" from OLD Bhulekh format)
    // New Bhulekh format: value = "128", text = "128"
    // Try both
    console.log("\nTrying to select plot...");

    // Read ALL hidden fields right before the click
    const hiddenBeforeClick = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll<HTMLInputElement>('input[type="hidden"]'));
      const result: Record<string, string> = {};
      for (const n of inputs) result[n.name] = n.value;
      return result;
    });
    console.log("Hidden before click:", Object.keys(hiddenBeforeClick).join(", "));
    console.log("ddlBindData:", hiddenBeforeClick["ctl00$ContentPlaceHolder1$ddlBindData"] ?? "(not hidden)");
    console.log("EVENTVALIDATION len:", (hiddenBeforeClick["__EVENTVALIDATION"] ?? "").length);

    // Intercept the POST
    let capturedPost: string | null = null;
    page.on("request", req => {
      if (req.url().includes("RoRView") && !capturedPost) {
        const pd = req.postData();
        if (pd) capturedPost = pd;
      }
    });

    // Try selecting by the plot's TEXT
    await page.selectOption("#ctl00_ContentPlaceHolder1_ddlBindData", plot128.text);
    await page.waitForTimeout(200);

    // Verify the form state after selecting plot
    const formAfterSelect = await page.evaluate(() => {
      const sel = document.querySelector<HTMLSelectElement>("#ctl00_ContentPlaceHolder1_ddlBindData");
      return sel?.value ?? null;
    });
    console.log("\nAfter plot select, ddlBindData value:", JSON.stringify(formAfterSelect));
    console.log("Expected:", JSON.stringify(plot128.value));

    // Read updated hidden fields
    const hiddenAfterSelect = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll<HTMLInputElement>('input[type="hidden"]'));
      const result: Record<string, string> = {};
      for (const n of inputs) result[n.name] = n.value;
      return result;
    });
    console.log("EVENTVALIDATION len after select:", (hiddenAfterSelect["__EVENTVALIDATION"] ?? "").length);

    // Click View RoR
    console.log("\nClicking View RoR...");
    await Promise.all([
      page.waitForURL(/SRoRFront_Uni\.aspx|CRoRFront_Uni\.aspx/, { timeout: 30000 }),
      page.locator("#ctl00_ContentPlaceHolder1_btnRORFront").click(),
    ]);

    await page.waitForLoadState("networkidle");
    console.log("SUCCESS! URL:", page.url());

    const html = await page.content();
    writeFileSync(path.join(process.cwd(), "scripts", "probe", "bhulekh-ror-final.html"), html);
    console.log("Saved:", html.length, "chars");

    // Quick structure dump
    const spans = await page.evaluate(() =>
      Array.from(document.querySelectorAll("[id]")).slice(0, 40)
        .map(el => ({ id: el.id, tag: el.tagName, text: (el as HTMLElement).innerText?.replace(/\s+/g, " ").trim().slice(0, 60) }))
    );
    const tables = await page.evaluate(() => {
      const ts = document.querySelectorAll("table");
      return Array.from(ts).slice(0, 5).map((t, i) => {
        const rows = t.querySelectorAll("tr");
        return { i, rows: rows.length, header: Array.from(rows[0]?.querySelectorAll("th,td") ?? []).map(c => c.textContent?.trim() ?? "") };
      });
    });
    console.log("\nTables:", tables.map(t => `Table ${t.i}: ${t.rows} rows, headers: [${t.header.join(" | ")}]`).join("\n"));
    console.log("\nElement IDs:");
    for (const s of spans) console.log(`  #${s.id} (${s.tag}): "${s.text}"`);

  } finally {
    await browser.close();
  }
}

main().catch(console.error);
