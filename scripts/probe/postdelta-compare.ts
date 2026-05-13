/**
 * Compare URLSearchParams vs string-assembly approach in Bhulekh context
 * Run: npx tsx scripts/probe/postdelta-compare.ts
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
    await page.selectOption("#ctl00_ContentPlaceHolder1_ddlDistrict", "20");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);
    await page.selectOption("#ctl00_ContentPlaceHolder1_ddlTahsil", "2");
    await page.waitForLoadState("networkidle");
    await page.waitForFunction(() => {
      const el = document.querySelector("#ctl00_ContentPlaceHolder1_ddlVillage") as HTMLSelectElement | null;
      return !!el && el.options.length > 1;
    }, { timeout: 15_000 });
    await page.selectOption("#ctl00_ContentPlaceHolder1_ddlVillage", "105");
    await page.waitForFunction(() => {
      const radio = document.querySelector<HTMLInputElement>("#ctl00_ContentPlaceHolder1_rbtnRORSearchtype_0");
      return !!radio && !radio.disabled;
    }, { timeout: 15_000 });

    // Test 1: URLSearchParams approach (BUGGY - creates duplicate keys)
    console.log("=== Test: URLSearchParams.append() approach ===");
    try {
      const delta1 = await page.evaluate(async (params) => {
        const form = document.forms[0] as HTMLFormElement;
        const formData = new FormData(form);
        formData.set("ctl00$ContentPlaceHolder1$rbtnRORSearchtype", params.mode);
        formData.set("ctl00$ScriptManager1", `ctl00$ContentPlaceHolder1$UpdatePanel1|${params.eventTarget}`);
        formData.set("__EVENTTARGET", params.eventTarget);
        formData.set("__EVENTARGUMENT", "");
        const body = new URLSearchParams();
        formData.forEach((value, key) => {
          body.append(key, String(value));
        });
        const response = await window.fetch(window.location.href, {
          method: "POST",
          headers: {
            "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
            "x-microsoftajax": "Delta=true",
            "x-requested-with": "XMLHttpRequest",
          },
          body: body.toString(),
          credentials: "include",
        });
        return response.text();
      }, { mode: "Plot", eventTarget: "ctl00$ContentPlaceHolder1$rbtnRORSearchtype$1" });
      const hasRedirect1 = delta1.includes("pageRedirect");
      const hasError1 = delta1.includes("error");
      console.log("Has pageRedirect:", hasRedirect1);
      console.log("Has error:", hasError1);
      console.log("First 200 chars:", delta1.slice(0, 200));
    } catch (e: any) {
      console.log("FAILED:", e.message);
    }

    // Test 2: String assembly approach (FIXED)
    console.log("\n=== Test: String assembly approach ===");
    try {
      const delta2 = await page.evaluate(async (params) => {
        const form = document.forms[0] as HTMLFormElement;
        const formData = new FormData(form);
        const parts: string[] = [];
        formData.forEach((value, key) => {
          parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
        });
        // Append overrides (replace earlier entries)
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
      const hasRedirect2 = delta2.includes("pageRedirect");
      const hasError2 = delta2.includes("error");
      console.log("Has pageRedirect:", hasRedirect2);
      console.log("Has error:", hasError2);
      console.log("First 200 chars:", delta2.slice(0, 200));
    } catch (e: any) {
      console.log("FAILED:", e.message);
    }

    console.log("\n=== DONE ===");
  } finally {
    await browser.close();
  }
}

run().catch(console.error);
