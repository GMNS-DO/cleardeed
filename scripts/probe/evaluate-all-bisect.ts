/**
 * Targeted probe to find which page.evaluate call causes __name error
 * Run: npx tsx scripts/probe/evaluate-all-bisect.ts
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
    console.log("2. District selected");

    await page.selectOption("#ctl00_ContentPlaceHolder1_ddlTahsil", "2");
    await page.waitForLoadState("networkidle");
    await page.waitForFunction(() => {
      const el = document.querySelector("#ctl00_ContentPlaceHolder1_ddlVillage") as HTMLSelectElement | null;
      return !!el && el.options.length > 1;
    }, { timeout: 15_000 });
    console.log("3. Tahasil selected");

    await page.selectOption("#ctl00_ContentPlaceHolder1_ddlVillage", "105");
    await page.waitForFunction(() => {
      const radio = document.querySelector<HTMLInputElement>("#ctl00_ContentPlaceHolder1_rbtnRORSearchtype_0");
      return !!radio && !radio.disabled;
    }, { timeout: 15_000 });
    console.log("4. Village selected");

    // Test page.evaluate for reading form data (like submitSelectedRoR does)
    console.log("5. Testing page.evaluate for form data...");
    try {
      const formData = await page.evaluate(() => {
        const form = document.forms[0];
        if (!form) return {};
        const fd = new FormData(form);
        const obj: Record<string, string> = {};
        fd.forEach((v, k) => { obj[k] = String(v); });
        return obj;
      });
      console.log("   Form data OK, keys:", Object.keys(formData).length);
    } catch (e: any) {
      console.log("   FAILED:", e.message);
    }

    // Test string-assembly postDelta approach
    console.log("6. Testing string-assembly AJAX post for Plot mode...");
    try {
      const delta = await page.evaluate(async (params) => {
        const form = document.forms[0];
        const formData = new FormData(form);
        const parts: string[] = [];
        formData.forEach((value, key) => {
          parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
        });
        parts.push(`${encodeURIComponent("ctl00$ContentPlaceHolder1$rbtnRORSearchtype")}=${encodeURIComponent(params.mode)}`);
        parts.push(`${encodeURIComponent("ctl00$ScriptManager1")}=${encodeURIComponent(`ctl00$ContentPlaceHolder1$UpdatePanel1|${params.eventTarget}`)}`);
        parts.push(`${encodeURIComponent("__EVENTTARGET")}=${encodeURIComponent(params.eventTarget)}`);
        parts.push(`${encodeURIComponent("__EVENTARGUMENT")}=`);
        const body = parts.join("&");
        const response = await window.fetch(window.location.href, {
          method: "POST",
          headers: {
            "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
            "x-microsoftajax": "Delta=true",
            "x-requested-with": "XMLHttpRequest",
          },
          body: body,
          credentials: "include",
        });
        return response.text();
      }, { mode: "Plot", eventTarget: "ctl00$ContentPlaceHolder1$rbtnRORSearchtype$1" });
      const hasRedirect = delta.includes("pageRedirect");
      console.log("   AJAX post OK, has pageRedirect:", hasRedirect);
      if (!hasRedirect) console.log("   First 200 chars:", delta.slice(0, 200));
    } catch (e: any) {
      console.log("   FAILED:", e.message);
    }

    // Select plot 128 from the dropdown
    await page.waitForTimeout(500);
    const options = await page.evaluate(() => {
      const sel = document.querySelector("#ctl00_ContentPlaceHolder1_ddlBindData") as HTMLSelectElement | null;
      if (!sel) return [];
      return Array.from(sel.options).slice(1, 10).map(n => ({
        value: n.value.trim(),
        text: n.textContent?.trim() ?? "",
      }));
    });
    console.log("7. Plot options:", options);

    // Try selecting plot 128
    const plot128Option = options.find(o => o.text === "128" || o.value.trim() === "128");
    if (plot128Option) {
      console.log("   Found plot 128, value:", JSON.stringify(plot128Option.value));
      await page.selectOption("#ctl00_ContentPlaceHolder1_ddlBindData", plot128Option.value.trim());
      await page.waitForTimeout(500);

      // Test submit RoR with the ACTUAL submitSelectedRoR approach
      console.log("8. Testing submit RoR (formData + string assembly)...");
      try {
        const formData2 = await page.evaluate(() => {
          const form = document.forms[0];
          if (!form) return {};
          const fd = new FormData(form);
          const obj: Record<string, string> = {};
          fd.forEach((v, k) => { obj[k] = String(v); });
          return obj;
        });

        const delta2 = await page.evaluate(async (params) => {
          const parts: string[] = [];
          for (const [key, value] of Object.entries(params.formData)) {
            parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
          }
          parts.push(`${encodeURIComponent("ctl00$ContentPlaceHolder1$rbtnRORSearchtype")}=${encodeURIComponent(params.mode)}`);
          parts.push(`${encodeURIComponent("ctl00$ScriptManager1")}=${encodeURIComponent(`ctl00$ContentPlaceHolder1$UpdatePanel1|${params.eventTarget}`)}`);
          parts.push(`${encodeURIComponent("__EVENTTARGET")}=${encodeURIComponent(params.eventTarget)}`);
          parts.push(`${encodeURIComponent("__EVENTARGUMENT")}=`);
          parts.push(`${encodeURIComponent("ctl00$ContentPlaceHolder1$ddlBindData")}=${encodeURIComponent(params.selectedValue)}`);
          parts.push(`${encodeURIComponent("ctl00$ContentPlaceHolder1$btnRORFront")}=${encodeURIComponent("View RoR")}`);
          const body = parts.join("&");
          const response = await window.fetch(window.location.href, {
            method: "POST",
            headers: {
              "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
              "x-microsoftajax": "Delta=true",
              "x-requested-with": "XMLHttpRequest",
            },
            body: body,
            credentials: "include",
          });
          return response.text();
        }, {
          mode: "Plot",
          eventTarget: "ctl00$ContentPlaceHolder1$btnRORFront",
          selectedValue: formData2["ctl00$ContentPlaceHolder1$ddlBindData"] ?? plot128Option.value.trim(),
          formData: formData2,
        });
        const hasRedirect2 = delta2.includes("pageRedirect");
        console.log("   Submit RoR OK, has pageRedirect:", hasRedirect2);
        if (hasRedirect2) {
          const match = delta2.match(/pageRedirect\|\|([^|]+)\|/);
          console.log("   Redirect path:", match?.[1]);
        }
      } catch (e: any) {
        console.log("   FAILED:", e.message);
      }
    }

    console.log("\n=== DONE ===");
  } finally {
    await browser.close();
  }
}

run().catch(console.error);
