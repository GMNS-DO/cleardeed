#!/usr/bin/env npx tsx
/**
 * Simple RoR page fetch — just get to SRoRFront_Uni and save HTML.
 * Run: pnpm dlx tsx scripts/probe-bhulekh-ror-simple.ts
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
    await page.waitForFunction(() => {
      const el = document.querySelector<HTMLSelectElement>("#ctl00_ContentPlaceHolder1_ddlTahsil");
      return !!el && el.options.length > 1;
    }, { timeout: 15_000 });

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
    await page.waitForFunction(() => {
      const el = document.querySelector<HTMLSelectElement>("#ctl00_ContentPlaceHolder1_ddlBindData");
      return !!el && el.options.length > 1;
    }, { timeout: 15_000 });

    // Use selectOption with the text "128" — Playwright focuses, selects, fires change event
    // This should trigger ASP.NET's onchange → __doPostBack
    await page.selectOption("#ctl00_ContentPlaceHolder1_ddlBindData", "128");
    await page.waitForTimeout(500);

    // Verify the value was set correctly
    const actualValue = await page.evaluate(() => {
      const sel = document.querySelector<HTMLSelectElement>("#ctl00_ContentPlaceHolder1_ddlBindData");
      return sel?.value?.trim() ?? null;
    });
    console.log("After selectOption, ddlBindData value:", JSON.stringify(actualValue));

    // Wait for btn to be enabled
    await page.waitForFunction(() => {
      const btn = document.querySelector<HTMLInputElement>("#ctl00_ContentPlaceHolder1_btnRORFront");
      return !!btn && !btn.disabled;
    }, { timeout: 15_000 });

    // Intercept the View RoR request using request handler
    let postData: string | null = null;
    let navigated = false;
    page.on("request", req => {
      if (req.url().includes("RoRView") && !postData) {
        const pd = req.postData();
        if (pd && (pd.includes("btnRORFront") || pd.includes("View"))) {
          postData = pd;
        }
      }
    });
    page.on("framenavigated", () => { navigated = true; });

    // Click View RoR
    console.log("Clicking View RoR...");
    await page.locator("#ctl00_ContentPlaceHolder1_btnRORFront").click();

    // Wait for either URL change or 15 seconds
    try {
      await page.waitForURL(/SRoRFront_Uni\.aspx|CRoRFront_Uni\.aspx/, { timeout: 20_000 });
      console.log("SUCCESS! URL:", page.url());
      await page.waitForLoadState("networkidle");
    } catch {
      console.log("No URL change within 20s.");
      console.log("postData captured:", postData ? "YES" : "NO");
      if (postData) {
        const params = new URLSearchParams(postData);
        console.log("Body keys:", [...params.keys()].join(", "));
        for (const [k, v] of params) {
          if (k.includes("btnRORFront")) console.log(`  ${k}: "${decodeURIComponent(v)}"`);
          else if (k.includes("ddlBindData")) console.log(`  ${k}: "${decodeURIComponent(v)}"`);
        }
      }
    }

    const url = page.url();
    const html = await page.content();
    const filename = url.includes("Uni")
      ? "bhulekh-sror-playwright-plot128.html"
      : "bhulekh-post-viewror-state.html";
    writeFileSync(path.join(process.cwd(), "scripts", "probe", filename), html);
    console.log(`\nSaved ${html.length} chars to scripts/probe/${filename}`);
    console.log("URL:", url);

    // Quick DOM inspection
    const domInfo = await page.evaluate(() => {
      const tables = document.querySelectorAll("table");
      const spans = Array.from(document.querySelectorAll("[id]")).slice(0, 30);
      return {
        url: window.location.href,
        tableCount: tables.length,
        elementIds: spans.map(el => ({ id: el.id, tag: el.tagName, text: (el as HTMLElement).innerText?.replace(/\s+/g, " ").trim().slice(0, 50) })),
        bodyText: document.body.innerText?.slice(0, 2000)?.replace(/\s+/g, " ") ?? ""
      };
    });
    console.log("\n--- DOM INFO ---");
    console.log("Tables:", domInfo.tableCount);
    console.log("\nElement IDs:");
    for (const el of domInfo.elementIds) {
      console.log(`  #${el.id} (${el.tag}): "${el.text}"`);
    }
    console.log("\nBody text:", domInfo.bodyText.slice(0, 500));

  } finally {
    await browser.close();
  }
}

main().catch(console.error);
