#!/usr/bin/env npx tsx
/**
 * Tests direct __doPostBack call for the View RoR button.
 * Run: pnpm dlx tsx scripts/probe-bhulekh-ror-direct-postback.ts
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

    // Select plot 128 using label (text)
    await page.selectOption("#ctl00_ContentPlaceHolder1_ddlBindData", "128");
    await page.waitForTimeout(300);

    // Verify plot is selected
    const plotValue = await page.evaluate(() => {
      const sel = document.querySelector<HTMLSelectElement>("#ctl00_ContentPlaceHolder1_ddlBindData");
      return sel?.value?.trim() ?? null;
    });
    console.log("Plot selected:", JSON.stringify(plotValue));

    // Read current hidden fields
    const hiddenBefore = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll<HTMLInputElement>('input[type="hidden"]'));
      return inputs.map(n => ({ name: n.name, valueLen: n.value.length }));
    });
    console.log("Hidden fields before:", hiddenBefore.map(h => h.name).join(", "));

    // Check the btnRORFront button
    const btnInfo = await page.evaluate(() => {
      const btn = document.querySelector<HTMLInputElement>("#ctl00_ContentPlaceHolder1_btnRORFront");
      if (!btn) return { found: false };
      return {
        found: true,
        type: btn.type,
        name: btn.name,
        id: btn.id,
        disabled: btn.disabled,
        visible: btn.offsetWidth > 0 && btn.offsetHeight > 0,
        onclick: btn.getAttribute("onclick"),
      };
    });
    console.log("Button info:", JSON.stringify(btnInfo, null, 2));

    // Intercept requests
    let postData: string | null = null;
    page.on("request", req => {
      if (req.url().includes("RoRView") && !postData) {
        const pd = req.postData();
        if (pd) postData = pd;
      }
    });

    // Try direct __doPostBack call
    console.log("\nTrying __doPostBack...");
    const postbackResult = await page.evaluate(() => {
      const btnId = "ctl00$ContentPlaceHolder1$btnRORFront";
      if (typeof (window as any).__doPostBack === "function") {
        (window as any).__doPostBack(btnId, "");
        return "called";
      }
      return "not found";
    });
    console.log("__doPostBack result:", postbackResult);

    // Wait for response/navigation
    try {
      await page.waitForURL(/SRoRFront_Uni\.aspx|CRoRFront_Uni\.aspx/, { timeout: 20000 });
      console.log("SUCCESS! URL:", page.url());
    } catch {
      console.log("No navigation within 20s.");
    }

    const finalUrl = page.url();
    const html = await page.content();
    const isRorPage = finalUrl.includes("Uni");

    if (isRorPage) {
      writeFileSync(path.join(process.cwd(), "scripts", "probe", "bhulekh-ror-via-postback.html"), html);
      console.log(`\nSaved RoR page: ${html.length} chars`);

      // Inspect structure
      const domInfo = await page.evaluate(() => {
        const spans = Array.from(document.querySelectorAll("[id]")).slice(0, 40);
        const tables = document.querySelectorAll("table");
        const firstTableRows = tables[0] ? Array.from(tables[0].querySelectorAll("tr")).slice(0, 5) : [];
        return {
          url: window.location.href,
          elementIds: spans.map(el => ({ id: el.id, tag: el.tagName, text: (el as HTMLElement).innerText?.replace(/\s+/g, " ").trim().slice(0, 60) })),
          tableCount: tables.length,
          firstTableHeaders: firstTableRows[0] ? Array.from(firstTableRows[0].querySelectorAll("th,td")).map(c => c.textContent?.trim() ?? "") : [],
          firstTableRows: firstTableRows.slice(1).map(row => Array.from(row.querySelectorAll("td")).map(c => c.textContent?.trim() ?? "")),
          bodyText: document.body.innerText?.replace(/\s+/g, " ").trim().slice(0, 1000),
        };
      });

      console.log("\n--- RO R PAGE ---");
      console.log("URL:", domInfo.url);
      console.log("Tables:", domInfo.tableCount);
      console.log("First table headers:", domInfo.firstTableHeaders);
      for (const row of domInfo.firstTableRows) {
        console.log("  Row:", row.join(" | "));
      }
      console.log("\nElement IDs:");
      for (const el of domInfo.elementIds) console.log(`  #${el.id} (${el.tag}): "${el.text}"`);
      console.log("\nBody text:", domInfo.bodyText.slice(0, 500));
    } else {
      // Save the current page
      writeFileSync(path.join(process.cwd(), "scripts", "probe", "bhulekh-post-postback-state.html"), html);
      console.log("\nStill on:", finalUrl);
      if (postData) {
        const params = new URLSearchParams(postData);
        console.log("POST body keys:", [...params.keys()].join(", "));
        console.log("EVENTTARGET:", JSON.stringify(params.get("__EVENTTARGET")));
        console.log("EVENTARGUMENT:", JSON.stringify(params.get("__EVENTARGUMENT")));
      }
    }

  } finally {
    await browser.close();
  }
}

main().catch(console.error);
