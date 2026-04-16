import { chromium, type Browser, type Page } from "playwright";
import { RoRResult } from "@cleardeed/schema";
import {
  KHRDHA_VILLAGES,
  DISTRICT_CODE,
  type VillageMapping,
} from "./villages";
import { z } from "zod";

const BHULEKH_URL = "https://bhulekh.ori.nic.in";
const TIMEOUT_MS = 30_000;

let browserInstance: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browserInstance || !browserInstance.isConnected()) {
    browserInstance = await chromium.launch({ headless: true });
  }
  return browserInstance;
}

export interface BhulekhInput {
  village: string; // English village name
  ownerName?: string; // Optional owner name filter
}

export async function fetch(input: {
  gps?: { lat: number; lon: number };
  village: string;
  ownerName?: string;
}): Promise<z.infer<typeof RoRResult>> {
  const fetchedAt = new Date().toISOString();

  // Find village mapping
  const villageInfo = KHRDHA_VILLAGES.find(
    (v) => v.english.toLowerCase() === input.village.toLowerCase()
  );

  if (!villageInfo) {
    return {
      source: "bhulekh",
      status: "failed",
      verification: "manual_required" as const,
      fetchedAt,
      error: `Village "${input.village}" not found in Khordha village dictionary. Add it to villages.ts first.`,
    };
  }

  let browser: Browser;
  let page: Page;
  let rawHtml = "";

  try {
    browser = await getBrowser();
    page = await browser.newPage();
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.setExtraHTTPHeaders({
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });

    // Step 1: Load Index.aspx (session init + ViewState)
    const indexResponse = await page.goto(`${BHULEKH_URL}/Index.aspx`, {
      waitUntil: "networkidle",
      timeout: TIMEOUT_MS,
    });

    if (!indexResponse || indexResponse.status() !== 200) {
      return buildFailedResult(fetchedAt, `Bhulekh index returned ${indexResponse?.status()}`);
    }

    rawHtml = await page.content();

    // Step 2: Select district (Khordha = 18)
    const districtSelect = await page.locator("#ddl_district").first();
    await districtSelect.selectOption(DISTRICT_CODE);
    await page.waitForTimeout;

    // Step 3: Select tahasil
    const tahasilSelect = await page.locator("#ddl_tahasil").first();
    const tahasilOptions = await tahasilSelect.locator("option").all();
    const tahasilText = villageInfo.tahasil.toUpperCase();
    const tahasilOption = tahasilOptions.find(
      async (opt) => (await opt.textContent())?.trim().toUpperCase().includes(tahasilText)
    );
    if (tahasilOption) {
      await tahasilOption.click();
    }
    await page.waitForTimeout;

    // Step 4: Select village (Odia dropdown)
    const villageSelect = await page.locator("#ddl_village").first();
    const villageOptions = await villageSelect.locator("option").all();
    const villageOption = villageOptions.find(
      async (opt) => (await opt.textContent())?.trim() === villageInfo.odia
    );
    if (!villageOption) {
      return buildFailedResult(fetchedAt, `Village "${villageInfo.odia}" not found in Bhulekh dropdown`);
    }
    await villageOption.click();
    await page.waitForTimeout(500);

    // Step 5: Click View ROR button
    const viewRorButton = page.locator("input[name='btn_view_ror']").first();
    await viewRorButton.click();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout;

    rawHtml = await page.content();

    // Parse the ROR table
    const result = await parseRoRTable(page, villageInfo, input.ownerName, fetchedAt);

    await page.close();
    return result;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    try { await page?.close(); } catch {}
    return {
      source: "bhulekh",
      status: "failed",
      verification: "manual_required" as const,
      fetchedAt,
      rawResponse: rawHtml.slice(0, 5000),
      error: `Bhulekh fetch error: ${errorMessage}`,
    };
  }
}

async function parseRoRTable(
  page: Page,
  villageInfo: VillageMapping,
  ownerNameFilter: string | undefined,
  fetchedAt: string
): Promise<z.infer<typeof RoRResult>> {
  try {
    const table = page.locator("#gv_ror").first();
    const rows = await table.locator("tr").all();

    if (rows.length <= 1) {
      return {
        source: "bhulekh",
        status: "partial",
        verification: "manual_required" as const,
        fetchedAt,
        data: {
          plotNo: "",
          village: villageInfo.english,
          tenants: [],
        },
      };
    }

    const tenants: Array<{
      surveyNo: string;
      area: number;
      unit: string;
      landClass: string;
      tenantName: string;
      fatherHusbandName?: string;
      share?: string;
    }> = [];

    for (const row of rows.slice(1)) {
      // Skip header row
      const cells = await row.locator("td").all();
      if (cells.length < 5) continue;

      const surveyNo = (await cells[0].textContent())?.trim() ?? "";
      const areaText = (await cells[1].textContent())?.trim() ?? "";
      const landClass = (await cells[2].textContent())?.trim() ?? "";
      const tenantName = (await cells[3].textContent())?.trim() ?? "";
      const fatherHusband = (await cells[4]?.textContent())?.trim() ?? "";

      // Parse area (handle "1.00 acre" or "0.10 acre")
      const areaMatch = areaText.match(/^([\d.]+)/);
      const area = areaMatch ? parseFloat(areaMatch[1]) : 0;

      // Filter by owner name if provided
      if (ownerNameFilter) {
        if (!tenantName.toLowerCase().includes(ownerNameFilter.toLowerCase())) {
          continue;
        }
      }

      tenants.push({
        surveyNo,
        area,
        unit: "acre",
        landClass,
        tenantName,
        fatherHusbandName: fatherHusband || undefined,
      });
    }

    return {
      source: "bhulekh",
      status: "success",
      verification: "verified",
      fetchedAt,
      data: {
        plotNo: "MULTI", // ROR may contain multiple plots
        village: villageInfo.english,
        tenants,
        lastUpdated: new Date().toISOString().slice(0, 10),
        sourceDocument: `${BHULEKH_URL}/RoRView.aspx`,
      },
    };
  } catch {
    return {
      source: "bhulekh",
      status: "partial",
      verification: "manual_required" as const,
      fetchedAt,
      error: "Failed to parse ROR table from Bhulekh response",
    };
  }
}

function buildFailedResult(fetchedAt: string, error: string): z.infer<typeof RoRResult> {
  return {
    source: "bhulekh",
    status: "failed",
    verification: "manual_required",
    fetchedAt,
    error,
  };
}

export async function healthCheck(): Promise<boolean> {
  try {
    const browser = await getBrowser();
    const page = await browser.newPage();
    const res = await page.goto(`${BHULEKH_URL}/Index.aspx`, {
      waitUntil: "domcontentloaded",
      timeout: 10_000,
    });
    await page.close();
    return !!res && res.status() === 200;
  } catch {
    return false;
  }
}

export async function cleanup(): Promise<void> {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
}