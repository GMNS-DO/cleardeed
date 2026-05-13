#!/usr/bin/env npx tsx
/**
 * Bhulekh onChange redirect test — verifies plot selection redirects to SRoRFront_Uni.aspx.
 * Run: pnpm dlx tsx scripts/test-bhulekh-rofr-trigger.ts
 */
import { chromium } from "playwright";
import { writeFileSync } from "fs";
import path from "path";

const BHULEKH_URL = "https://bhulekh.ori.nic.in";
const ROR_VIEW_URL = `${BHULEKH_URL}/RoRView.aspx`;
const TIMEOUT_MS = 30_000;

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setExtraHTTPHeaders({
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
  });

  try {
    // Bootstrap: cold GET to RoRView.aspx → BhulekhError.aspx → here postback → RoRView.aspx
    console.log("1. Going to RoRView.aspx...");
    await page.goto(ROR_VIEW_URL, { waitUntil: "domcontentloaded", timeout: TIMEOUT_MS });
    if (page.url().includes("BhulekhError.aspx")) {
      console.log("   On error page — clicking 'here'...");
      await page.locator("a", { hasText: "here" }).click();
      await page.waitForURL(/RoRView\.aspx/, { timeout: TIMEOUT_MS });
    }
    console.log("   URL:", page.url());

    // Select district 20 (Khordha)
    console.log("2. Select district 20 (Khordha)...");
    await page.selectOption("#ctl00_ContentPlaceHolder1_ddlDistrict", "20");
    await page.waitForLoadState("networkidle");

    // Select tahasil 2 (Bhubaneswar)
    console.log("3. Select tahasil 2 (Bhubaneswar)...");
    await page.selectOption("#ctl00_ContentPlaceHolder1_ddlTahsil", "2");
    await page.waitForLoadState("networkidle");

    // Wait for village dropdown
    await page.waitForFunction(() => {
      const el = document.querySelector("#ctl00_ContentPlaceHolder1_ddlVillage") as HTMLSelectElement | null;
      return !!el && el.options.length > 1;
    }, { timeout: 15000 });
    console.log("4. Village dropdown populated.");

    // Set village value + trigger __doPostBack directly (bypasses onchange)
    console.log("5. Setting village 105 (Mendhasala) + triggering AJAX...");

    // Intercept responses
    const allResponses: { status: number; body: string }[] = [];
    page.on("response", (resp) => {
      if (resp.url().includes("RoRView")) {
        resp.text().then(t => allResponses.push({ status: resp.status(), body: t })).catch(() => {});
      }
    });

    await new Promise(r => setTimeout(r, 100));
    await page.evaluate(() => {
      const sel = document.querySelector<HTMLSelectElement>("#ctl00_ContentPlaceHolder1_ddlVillage");
      if (sel) sel.value = "105";
      (window as any).__doPostBack("ctl00$ContentPlaceHolder1$ddlVillage", "");
    });
    console.log("   AJAX triggered, waiting for response...");

    // Wait for radio buttons to become enabled (indicates all cascades complete)
    await page.waitForFunction(() => {
      const radio = document.querySelector<HTMLInputElement>("#ctl00_ContentPlaceHolder1_rbtnRORSearchtype_0");
      return !!radio && !radio.disabled;
    }, { timeout: 30000 });

    const radioState = await page.evaluate(() => {
      const radio0 = document.querySelector<HTMLInputElement>("#ctl00_ContentPlaceHolder1_rbtnRORSearchtype_0");
      const ri = document.querySelector<HTMLSelectElement>("#ctl00_ContentPlaceHolder1_ddlRI");
      return {
        radio0Disabled: radio0?.disabled,
        riDisabled: ri?.disabled,
      };
    });
    console.log("6. Radios enabled! Radio0 disabled:", radioState.radio0Disabled, "RI disabled:", radioState.riDisabled);
    console.log("   (Proceeding even if RI is disabled — it may be optional)...");

    // Select RI circle 11 (Mendhasala)
    console.log("7. Selecting RI 11 (Mendhasala)...");
    await page.selectOption("#ctl00_ContentPlaceHolder1_ddlRI", "11");
    await page.waitForLoadState("networkidle");

    // Wait for radio buttons to enable
    await page.waitForFunction(() => {
      const r = document.querySelector<HTMLInputElement>("#ctl00_ContentPlaceHolder1_rbtnRORSearchtype_0");
      return !!r && !r.disabled;
    }, { timeout: 15000 });
    console.log("8. Radios enabled.");

    // Switch to Plot mode
    console.log("9. Switching to Plot mode...");
    await page.locator('input[name="ctl00$ContentPlaceHolder1$rbtnRORSearchtype"][value="Plot"]').click();
    await page.waitForLoadState("networkidle");

    // Wait for plot dropdown
    await page.waitForFunction(() => {
      const el = document.querySelector("#ctl00_ContentPlaceHolder1_ddlBindData") as HTMLSelectElement | null;
      return !!el && el.options.length > 1;
    }, { timeout: 15000 });
    console.log("10. Plot dropdown populated.");

    // Read plot options
    const plotOpts = await page.evaluate(() => {
      const el = document.querySelector("#ctl00_ContentPlaceHolder1_ddlBindData") as HTMLSelectElement | null;
      if (!el) return [];
      return Array.from(el.options).map(o => ({
        value: o.value.trim(),
        text: o.textContent?.trim() ?? "",
      }));
    });
    const plot128 = plotOpts.find(o => o.text === "128");
    console.log("   Plot 128:", plot128 ? `found (value="${plot128.value}")` : "NOT FOUND");
    console.log("   Total plot options:", plotOpts.filter(o => o.value).length);

    if (!plot128) {
      console.log("   Available options:", plotOpts.slice(0, 10));
      await browser.close();
      return;
    }

    // === THE KEY TEST: selectOption triggers onChange redirect ===
    console.log("\n11. Selecting plot 128 (TRIGGERS REDIRECT)...");

    // Navigate event listener FIRST
    let navigated = false;
    page.on("framenavigated", () => { navigated = true; });

    await page.selectOption("#ctl00_ContentPlaceHolder1_ddlBindData", plot128.value);

    console.log("   Waiting for SRoRFront_Uni.aspx...");
    await page.waitForURL(/SRoRFront_Uni\.aspx/, { timeout: TIMEOUT_MS });

    console.log("   SUCCESS! URL:", page.url());
    console.log("   Navigated:", navigated);

    // Capture RoR page content
    await page.waitForLoadState("networkidle");
    const rorHTML = await page.content();
    console.log("\n   RoR page HTML length:", rorHTML.length, "chars");

    // Parse key fields
    const ownerName = await page.locator("#gvfront_ctl02_lblName").textContent().catch(() => "NOT FOUND");
    const khataNo = await page.locator("#gvfront_ctl02_lblKhatiyanslNo").textContent().catch(() => "NOT FOUND");
    const landClass = await page.locator("#gvfront_ctl02_lblStatua").textContent().catch(() => "NOT FOUND");
    const totalAmount = await page.locator("#gvfront_ctl02_lblTotal").textContent().catch(() => "NOT FOUND");

    console.log("\n   Parsed RoR fields:");
    console.log("   Owner name:", ownerName?.replace(/\s+/g, " ").trim());
    console.log("   Khata No:", khataNo?.replace(/\s+/g, " ").trim());
    console.log("   Land class:", landClass?.replace(/\s+/g, " ").trim());
    console.log("   Total:", totalAmount?.replace(/\s+/g, " ").trim());

    // Save full HTML
    writeFileSync(
      path.join(process.cwd(), "scripts", "probe", "bhulekh-sror-plot128.html"),
      rorHTML
    );
    console.log("\n   Saved to scripts/probe/bhulekh-sror-plot128.html");

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("\n   ERROR:", msg);
    // Save page state on failure
    try {
      const html = await page.content();
      writeFileSync(
        path.join(process.cwd(), "scripts", "probe", "bhulekh-error-state.html"),
        html
      );
      console.log("   Error HTML saved to scripts/probe/bhulekh-error-state.html");
    } catch {}
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
