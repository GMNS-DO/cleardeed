#!/usr/bin/env npx tsx
/**
 * Simple click test: just try to click View RoR and see what happens.
 * Run: pnpm dlx tsx scripts/probe-bhulekh-click-test.ts
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
    await page.goto(ROR_VIEW, { waitUntil: "domcontentloaded", timeout: 30_000 });
    if (page.url().includes("BhulekhError.aspx")) {
      await page.locator("a", { hasText: "here" }).click();
      await page.waitForURL(/RoRView\.aspx/, { timeout: 30_000 });
    }

    // Cascade quickly
    await page.selectOption("#ctl00_ContentPlaceHolder1_ddlDistrict", "20");
    await page.waitForLoadState("networkidle");

    await page.selectOption("#ctl00_ContentPlaceHolder1_ddlTahsil", "2");
    await page.waitForFunction(() => {
      const el = document.querySelector<HTMLSelectElement>("#ctl00_ContentPlaceHolder1_ddlVillage");
      return !!el && el.options.length > 1;
    }, { timeout: 15000 });

    await page.selectOption("#ctl00_ContentPlaceHolder1_ddlVillage", "105");
    await page.waitForFunction(() => {
      const el = document.querySelector<HTMLInputElement>("#ctl00_ContentPlaceHolder1_rbtnRORSearchtype_0");
      return !!el && !el.disabled;
    }, { timeout: 15000 });

    await page.locator('input[name="ctl00$ContentPlaceHolder1$rbtnRORSearchtype"][value="Plot"]').click();
    await page.waitForFunction(() => {
      const el = document.querySelector<HTMLSelectElement>("#ctl00_ContentPlaceHolder1_ddlBindData");
      return !!el && el.options.length > 1;
    }, { timeout: 15000 });

    // Read plot options
    const plotOpts = await page.evaluate(() => {
      const sel = document.querySelector<HTMLSelectElement>("#ctl00_ContentPlaceHolder1_ddlBindData");
      if (!sel) return [];
      return Array.from(sel.options)
        .filter(o => o.value.trim())
        .map(o => ({ v: o.value, t: o.textContent?.replace(/\s+/g, " ").trim() ?? "" }));
    });
    console.log("Plot options:", plotOpts.length);
    const p128 = plotOpts.find(o => o.t === "128");
    console.log("Plot 128:", p128 ? `value=${JSON.stringify(p128.v)}` : "NOT FOUND");

    if (!p128) { await browser.close(); return; }

    // Select plot
    await page.selectOption("#ctl00_ContentPlaceHolder1_ddlBindData", p128.t);
    await page.waitForTimeout;

    // Intercept ALL network requests
    const allRequests: { url: string; method: string; body: string; status: number }[] = [];
    page.on("response", async resp => {
      if (!resp.url().includes("bhulekh")) return;
      try {
        const req = resp.request();
        allRequests.push({
          url: resp.url(),
          method: req.method(),
          body: req.postData() ?? "",
          status: resp.status(),
        });
      } catch {}
    });

    // Also catch requests
    page.on("request", req => {
      if (req.url().includes("bhulekh") && req.postData()) {
        const existing = allRequests.find(r => r.url === req.url() && r.body === "");
        if (existing) existing.body = req.postData() ?? "";
      }
    });

    // Check if ddlBindData is in hidden fields (it shouldn't be)
    const hiddenAfterSelect = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll<HTMLInputElement>('input[type="hidden"]'));
      const names = inputs.map(n => n.name);
      return names;
    });
    console.log("Hidden fields:", hiddenAfterSelect.join(", "));

    // Check btn state
    const btnState = await page.evaluate(() => {
      const btn = document.querySelector<HTMLInputElement>("#ctl00_ContentPlaceHolder1_btnRORFront");
      return btn ? { disabled: btn.disabled, value: btn.value } : null;
    });
    console.log("Button:", btnState);

    console.log("\nClicking View RoR...");
    await page.locator("#ctl00_ContentPlaceHolder1_btnRORFront").click();
    await page.waitForTimeout;  // Just wait 5 seconds

    const url = page.url();
    console.log("\nURL after 5s:", url);

    // Save page
    const html = await page.content();
    writeFileSync(path.join(process.cwd(), "scripts", "probe", "bhulekh-after-click.html"), html);
    console.log("Saved:", html.length, "chars to bhulekh-after-click.html");

    // Check all network responses
    const rorResponses = allRequests.filter(r => r.url.includes("RoRView") || r.url.includes("SRoR") || r.url.includes("CRoR"));
    console.log("\nNetwork activity:", rorResponses.length, "requests");
    for (const r of rorResponses.slice(-5)) {
      console.log(`  ${r.method} ${r.status} ${r.url.split("/").pop()?.slice(0, 50)}`);
    }

    // Try to understand what happened
    const bodyText = await page.evaluate(() => document.body.innerText?.replace(/\s+/g, " ").trim().slice(0, 500) ?? "");
    console.log("\nPage text:", bodyText.slice(0, 300));

    await browser.close();
  } catch(e) {
    console.error("ERROR:", e);
    await browser.close();
  }
}

main().catch(console.error);
