/**
 * Test: Can we do ASP.NET AJAX POSTs using a helper iframe approach
 * instead of page.evaluate?
 *
 * Run: npx tsx scripts/probe/ajax-without-evaluate.ts
 */

import { chromium } from "playwright";

const BHULEKH_URL = "https://bhulekh.ori.nic.in";
const TIMEOUT_MS = 30_000;

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    // Bootstrap
    await page.goto(`${BHULEKH_URL}/RoRView.aspx`, {
      waitUntil: "domcontentloaded",
      timeout: TIMEOUT_MS,
    });
    if (page.url().includes("BhulekhError.aspx")) {
      await page.locator("a", { hasText: "here" }).click();
      await page.waitForURL(/RoRView\.aspx/, { timeout: TIMEOUT_MS });
    }
    console.log("1. Bootstrap OK");

    await page.selectOption("#ctl00_ContentPlaceHolder1_ddlDistrict", "20");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);

    await page.selectOption("#ctl00_ContentPlaceHolder1_ddlTahsil", "2");
    await page.waitForLoadState("networkidle");
    await page.waitForFunction(() => {
      const el = document.querySelector("#ctl00_ContentPlaceHolder1_ddlVillage") as HTMLSelectElement | null;
      return !!el && el.options.length > 1;
    }, { timeout: 15_000 });
    console.log("2. District + Tahasil OK");

    await page.selectOption("#ctl00_ContentPlaceHolder1_ddlVillage", "105");
    await page.waitForFunction(() => {
      const radio = document.querySelector<HTMLInputElement>("#ctl00_ContentPlaceHolder1_rbtnRORSearchtype_0");
      return !!radio && !radio.disabled;
    }, { timeout: 15_000 });
    console.log("3. Village OK");

    // Read all form fields using locator/handle approach (no page.evaluate)
    console.log("4. Reading form fields via locator...");
    const form = page.locator("form");
    const hiddenFields = await page.$$eval("form input[type=hidden]", (nodes) =>
      nodes.map((n) => ({ name: (n as HTMLInputElement).name, value: (n as HTMLInputElement).value }))
    );
    const viewState = hiddenFields.find(f => f.name === "__VIEWSTATE");
    const eventValidation = hiddenFields.find(f => f.name === "__EVENTVALIDATION");
    console.log("   ViewState length:", viewState?.value.length);
    console.log("   EventValidation length:", eventValidation?.value.length);

    // Read current radio selection
    const radioChecked = await page.locator("#ctl00_ContentPlaceHolder1_rbtnRORSearchtype_0").isChecked();
    console.log("   Khatiyan radio checked:", radioChecked);

    // Switch to Plot mode via locator click
    console.log("5. Switching to Plot mode...");
    await page.locator("#ctl00_ContentPlaceHolder1_rbtnRORSearchtype_1").click();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(800);

    // Read plot options
    console.log("6. Reading plot options...");
    const plotCount = await page.locator("#ctl00_ContentPlaceHolder1_ddlBindData option").count();
    console.log("   Plot option count:", plotCount);

    const plotOptions = await page.$$eval("#ctl00_ContentPlaceHolder1_ddlBindData option", (nodes) =>
      nodes.map((n) => ({ value: n.value.trim(), text: n.textContent?.trim() ?? "" }))
    );
    console.log("   First 5 options:", plotOptions.slice(0, 5));

    // Try selecting plot 128
    const plot128 = plotOptions.find(o => o.text === "128");
    if (plot128) {
      console.log("7. Selecting plot 128...");
      await page.selectOption("#ctl00_ContentPlaceHolder1_ddlBindData", plot128.value);
      await page.waitForTimeout(500);

      // Click View RoR
      console.log("8. Clicking View RoR...");
      await page.locator("#ctl00_ContentPlaceHolder1_btnRORFront").click();
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout;

      if (page.url().includes("SRoRFront_Uni.aspx")) {
        console.log("9. SUCCESS - on SRoR page!");
        const ownerSpan = await page.locator("#gvfront_ctl02_lblName").textContent();
        const khataSpan = await page.locator("#gvfront_ctl02_lblKhatiyanslNo").textContent();
        const totalSpan = await page.locator("#gvfront_ctl02_lblTotal").textContent();
        console.log("   Owner:", ownerSpan?.trim());
        console.log("   Khata:", khataSpan?.trim());
        console.log("   Total:", totalSpan?.trim());
      } else {
        console.log("   Still on:", page.url());
        // Check if any error message appears
        const errorText = await page.locator("body").textContent();
        if (errorText?.includes("Error") || errorText?.includes("error")) {
          console.log("   Error in page:", errorText?.slice(0, 200));
        }
      }
    }

    console.log("\n=== DONE ===");
  } finally {
    await browser.close();
  }
}

run().catch(console.error);
