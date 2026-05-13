#!/usr/bin/env npx tsx
/**
 * Bhulekh RoRView.aspx probe — v3
 *
 * All network activity is captured globally from page creation.
 * Actions are performed first, then we inspect what was captured.
 *
 * Target: Khordha / Bhubaneswar / Mendhasala / plot 128
 *
 * Run:
 *   npx tsx scripts/probe-bhulekh-ror.ts
 */

import { chromium, type Browser, type Page } from "playwright";

const BHULEKH_URL = "https://bhulekh.ori.nic.in";
const ROR_VIEW_URL = `${BHULEKH_URL}/RoRView.aspx`;
const DISTRICT_CODE = "20";
const TAHASIL_CODE = "2";
const VILLAGE_CODE = "105";
const TARGET_PLOT = "128";

// ─── Helpers ────────────────────────────────────────────────────────────────

async function readOptions(page: Page, selector: string) {
  return page.locator(`${selector} option`).evaluateAll((nodes) =>
    nodes.map((n) => ({
      value: (n as HTMLOptionElement).value,
      text: (n as HTMLOptionElement).textContent?.replace(/\s+/g, " ").trim() ?? "",
    }))
  );
}

async function getFormFields(page: Page): Promise<Record<string, string>> {
  return page.evaluate(() => {
    const form = document.forms[0];
    if (!form) return {};
    const obj: Record<string, string> = {};
    new FormData(form).forEach((v, k) => { obj[k] = String(v); });
    return obj;
  });
}

function normalizeBody(body: string): string {
  try {
    const p = new URLSearchParams(body);
    const obj: Record<string, string> = {};
    p.forEach((v, k) => { obj[k] = v; });
    return JSON.stringify(obj, null, 2);
  } catch {
    return body;
  }
}

function parseDelta(raw: string): {
  pageRedirect?: string;
  updatePanelHtml?: string;
  hiddenFields: Record<string, string>;
} {
  const hiddenFields: Record<string, string> = {};
  for (const m of raw.matchAll(/hiddenField\|([^|]+)\|([^|]*)\|/g)) {
    hiddenFields[m[1]] = m[2];
  }
  const redirectMatch = raw.match(/pageRedirect\|\|([^|]+)\|/);
  const updateMatch = raw.match(
    /updatePanel\|ctl00_ContentPlaceHolder1_UpdatePanel1\|([\s\S]*?)(?=\|hiddenField\||\|scriptBlock\||\|pageRedirect\||$)/
  );
  return {
    hiddenFields,
    pageRedirect: redirectMatch ? decodeURIComponent(redirectMatch[1]) : undefined,
    updatePanelHtml: updateMatch?.[1],
  };
}

// ─── Global network capture ─────────────────────────────────────────────────

interface CapturedPost {
  url: string;
  body: string;
  status?: number;
  responseBody?: string;
  order: number;
}

let _postCounter = 0;
function makePostCapture() {
  const posts: CapturedPost[] = [];
  return {
    posts,
    reqHandler: (req: any) => {
      if (req.method() === "POST" && req.url().includes("bhulekh")) {
        posts.push({ url: req.url(), body: req.postData() ?? "", order: ++_postCounter });
      }
    },
    respHandler: async (res: any) => {
      if (res.url().includes("bhulekh")) {
        const p = posts.find(p => p.url === res.url());
        if (p) {
          try { p.responseBody = await res.text(); p.status = res.status(); } catch {}
        }
      }
    },
  };
}

// ─── Step 1: Bootstrap ───────────────────────────────────────────────────────

async function bootstrap(page: Page) {
  console.log("\n=== STEP 1: Bootstrap ===");
  await page.goto(ROR_VIEW_URL, { waitUntil: "domcontentloaded", timeout: 30_000 });
  if (page.url().includes("BhulekhError.aspx")) {
    await page.locator("a", { hasText: "here" }).click();
    await page.waitForURL(/RoRView\.aspx/, { timeout: 30_000 });
  }
  console.log("  ✓", page.url());
}

// ─── Step 2: District → Tahasil cascade ─────────────────────────────────

async function cascadeSelect(page: Page, cap: ReturnType<typeof makePostCapture>) {
  page.on("request", cap.reqHandler);
  page.on("response", cap.respHandler);

  console.log("\n=== STEP 2: District → Tahasil → Village ===");

  // District select
  const districtOpts = await readOptions(page, "#ctl00_ContentPlaceHolder1_ddlDistrict");
  console.log("  Districts:", districtOpts.slice(0, 5).map(o => `${o.value}=${o.text}`).join(", "), "…");
  console.log(`  Selecting district=${DISTRICT_CODE}`);
  await page.selectOption("#ctl00_ContentPlaceHolder1_ddlDistrict", DISTRICT_CODE);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout;

  const tahasilOpts = await readOptions(page, "#ctl00_ContentPlaceHolder1_ddlTahsil");
  console.log("  Tahasils:", tahasilOpts.map(o => `${o.value}=${o.text}`).join(", "));
  console.log(`  Selecting tahasil=${TAHASIL_CODE}`);
  await page.selectOption("#ctl00_ContentPlaceHolder1_ddlTahsil", TAHASIL_CODE);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout;

  const villageOpts = await readOptions(page, "#ctl00_ContentPlaceHolder1_ddlVillage");
  console.log(`  Villages (${villageOpts.length}):`, villageOpts.slice(0, 5).map(o => `${o.value}=${o.text}`).join(", "));

  const mendhasala = villageOpts.find(o => o.text.includes("ମେଣ") || o.text.toLowerCase().includes("mendhasala"));
  if (mendhasala) {
    console.log(`  Mendhasala found: ${mendhasala.value}=${mendhasala.text}`);
  } else {
    console.log(`  Mendhasala NOT found. Using first real village.`);
  }
  const villageCode = mendhasala?.value ?? villageOpts.find(o => o.value && o.text !== "Select Village")?.value ?? VILLAGE_CODE;
  console.log(`  Selecting village=${villageCode}`);
  await page.selectOption("#ctl00_ContentPlaceHolder1_ddlVillage", villageCode);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout;

  await page.waitForFunction(
    () => {
      const r = document.querySelector<HTMLInputElement>('input[type="radio"][id*="rbtnRORSearchtype"]');
      return !!r && !r.disabled;
    },
    { timeout: 15_000 }
  );
  console.log("  ✓ Search radios enabled");

  // Print captured POSTs
  console.log("\n  ── Captured POSTs ──");
  for (const p of cap.posts) {
    console.log(`  [${p.order}] POST ${p.url.slice(-60)} status=${p.status}`);
    console.log(normalizeBody(p.body));
    if (p.responseBody) {
      const delta = parseDelta(p.responseBody);
      console.log(`  → pageRedirect: ${delta.pageRedirect ?? "(none)"}`);
      console.log(`  → updatePanel: ${delta.updatePanelHtml ? "YES (" + delta.updatePanelHtml.slice(0, 100) + "…)" : "(none)"}`);
    }
    console.log();
  }

  return { villageOpts };
}

// ─── Step 3: Plot mode ───────────────────────────────────────────────────

async function switchToPlot(page: Page, cap: ReturnType<typeof makePostCapture>) {
  console.log("\n=== STEP 3: Switch to Plot mode ===");
  const before = cap.posts.length;
  await page.locator('input[type="radio"][id*="rbtnRORSearchtype_1"]').click();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout;
  const newPosts = cap.posts.slice(before);
  console.log(`  Posts during Plot switch: ${newPosts.length}`);
  for (const p of newPosts) {
    console.log(`  [${p.order}] POST status=${p.status}`);
    console.log(normalizeBody(p.body).slice(0, 500));
    if (p.responseBody) {
      const delta = parseDelta(p.responseBody);
      console.log(`  → pageRedirect: ${delta.pageRedirect ?? "(none)"}`);
      console.log(`  → updatePanel: ${delta.updatePanelHtml ? "YES (" + delta.updatePanelHtml.slice(0, 150) + "…)" : "(none)"}`);
    }
  }

  await page.waitForFunction(
    () => {
      const sel = document.querySelector<HTMLSelectElement>("#ctl00_ContentPlaceHolder1_ddlBindData");
      return sel && sel.options.length > 1;
    },
    { timeout: 15_000 }
  );

  const bindOpts = await readOptions(page, "#ctl00_ContentPlaceHolder1_ddlBindData");
  console.log(`  ddlBindData options: ${bindOpts.length}`);
  console.log("  First 8:", bindOpts.slice(0, 8).map(o => `${o.value.trim()}=${o.text}`).join(", "));

  const targetOpt = bindOpts.find(o => o.text === TARGET_PLOT || o.value.trim() === TARGET_PLOT);
  console.log(`  Plot "${TARGET_PLOT}":`, !!targetOpt, targetOpt);
  return { bindOpts, targetOpt };
}

// ─── Step 4: Select ddlBindData → View RoR ───────────────────────────────

async function submitRoR(page: Page, cap: ReturnType<typeof makePostCapture>, plotValue: string) {
  console.log("\n=== STEP 4: Select ddlBindData → Click View RoR ===");

  const before = cap.posts.length;

  // Read form state before
  const formBefore = await getFormFields(page);
  const relevant = Object.fromEntries(
    Object.entries(formBefore)
      .filter(([k]) =>
        k.includes("VIEWSTATE") || k.includes("EVENT") || k.includes("rbtn") ||
        k.includes("ddlBind") || k.includes("ddlVillage") || k.includes("btnROR")
      )
  );
  console.log("  Form fields before:", JSON.stringify(relevant, null, 2));

  // Select plot
  console.log(`  Selecting ddlBindData=${plotValue.trim()}`);
  await page.selectOption("#ctl00_ContentPlaceHolder1_ddlBindData", plotValue.trim());
  await page.waitForTimeout;

  const afterSelect = cap.posts.slice(before);
  console.log(`  Posts during ddlBindData select: ${afterSelect.length}`);
  for (const p of afterSelect) {
    console.log(`  [${p.order}] POST status=${p.status}`);
    console.log(normalizeBody(p.body).slice(0, 500));
  }

  // Read form state before View RoR
  const formAfterSelect = await getFormFields(page);
  const relevantAfter = Object.fromEntries(
    Object.entries(formAfterSelect)
      .filter(([k]) => k.includes("VIEWSTATE") || k.includes("ddlBind") || k.includes("btnROR"))
  );
  console.log("  Form fields after ddlBindData select:", JSON.stringify(relevantAfter, null, 2));

  // Capture what happens when we click View RoR
  const beforeViewRoR = cap.posts.length;

  const btn = page.locator('input[type="submit"][name="ctl00$ContentPlaceHolder1$btnRORFront"]');
  const btnInfo = await btn.evaluate(el => ({
    name: (el as HTMLInputElement).name,
    id: el.id,
    value: (el as HTMLInputElement).value,
    disabled: (el as HTMLInputElement).disabled,
  }));
  console.log("\n  View RoR button:", btnInfo);
  console.log("  Clicking…");

  // Try using page.evaluate to trigger the submit and capture the response
  // by hijacking the form submit
  const [viewRoRResult] = await Promise.all([
    page.evaluate(async (btnName: string) => {
      const form = document.forms[0] as HTMLFormElement;
      if (!form) return { error: "no form" };

      const fd = new FormData(form);
      const body = new URLSearchParams();
      fd.forEach((v, k) => body.append(k, String(v)));

      const resp = await fetch(form.action || window.location.href, {
        method: "POST",
        body: body.toString(),
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "x-microsoftajax": "Delta=true",
          "x-requested-with": "XMLHttpRequest",
        },
        credentials: "include",
      });

      return {
        status: resp.status,
        body: await resp.text(),
        url: resp.url,
        redirected: resp.redirected,
      };
    }, btnInfo.name),
  ]);

  console.log("\n  ── View RoR direct fetch result ──");
  console.log("  Status:", viewRoRResult.status);
  console.log("  URL after:", viewRoRResult.url);
  console.log("  Redirected:", viewRoRResult.redirected);

  if (viewRoRResult.body) {
    const delta = parseDelta(viewRoRResult.body);
    console.log("\n  ── Delta parse ──");
    console.log("  pageRedirect:", delta.pageRedirect ?? "(none)");
    console.log("  updatePanel HTML (first 500):", delta.updatePanelHtml?.slice(0, 500) ?? "(none)");
    console.log("  Hidden fields updated:", Object.keys(delta.hiddenFields).slice(0, 8));

    // Save full response to file
    const fs = await import("fs");
    const path = await import("path");
    const outPath = path.join(process.cwd(), "scripts", "probe", "bhulekh-viewror-response.txt");
    fs.writeFileSync(outPath, viewRoRResult.body);
    console.log(`\n  Full response saved to: ${outPath}`);
  }

  // Also capture natural button click
  const naturalPosts = cap.posts.slice(beforeViewRoR);
  console.log(`\n  Natural posts during View RoR click: ${naturalPosts.length}`);
  for (const p of naturalPosts) {
    console.log(`  [${p.order}] POST status=${p.status}`);
    console.log(normalizeBody(p.body).slice(0, 300));
    if (p.responseBody) {
      const delta = parseDelta(p.responseBody);
      console.log(`  → pageRedirect: ${delta.pageRedirect ?? "(none)"}`);
      console.log(`  → updatePanel: ${delta.updatePanelHtml ? "YES (" + delta.updatePanelHtml.slice(0, 200) + ")" : "(none)"}`);
    }
  }

  // Click the button naturally
  try {
    await btn.click({ timeout: 10_000 });
    await page.waitForTimeout;
  } catch (err) {
    console.log("  Natural click error:", err);
  }

  console.log("\n  URL after everything:", page.url());
}

// ─── Step 5: Inspect page ─────────────────────────────────────────────────

async function inspectPage(page: Page) {
  console.log("\n=== STEP 5: Final page inspection ===");
  console.log("  URL:", page.url());

  const selectors = [
    { s: "#ctl00_ContentPlaceHolder1_UpdatePanel1", label: "UpdatePanel1" },
    { s: "#gvfront tr", label: "gvfront rows" },
    { s: "#gvRorBack tr", label: "gvRorBack rows" },
    { s: '[id*="lblKhatiyan"]', label: "lblKhatiyan elements" },
    { s: '[id*="lblName"]', label: "lblName elements" },
    { s: '[id*="lblKhata"]', label: "lblKhata elements" },
    { s: ". RorTable", label: ".RorTable" },
    { s: "table", label: "all tables" },
  ];

  for (const { s, label } of selectors) {
    const n = await page.locator(s).count();
    if (n > 0) console.log(`  ${label}: ${n}`);
  }

  // Print UpdatePanel content
  const upHtml = await page.locator("#ctl00_ContentPlaceHolder1_UpdatePanel1").innerHTML().catch(() => "(not found)");
  console.log("\n  UpdatePanel1 HTML (first 2000):");
  console.log(upHtml.slice(0, 2000));

  // Print page title + visible text
  console.log("\n  Page title:", await page.title());
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  let browser: Browser | null = null;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.setExtraHTTPHeaders({
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    });

    const cap = makePostCapture();
    await bootstrap(page);
    const { villageOpts } = await cascadeSelect(page, cap);

    // If Mendhasala not found, use first village
    const mendhasalaFound = villageOpts.some(o => o.text.includes("ମେଣ") || o.text.toLowerCase().includes("mendhasala"));
    if (!mendhasalaFound) {
      const firstVillage = villageOpts.find(o => o.value && o.text !== "Select Village");
      if (firstVillage) {
        console.log(`\n  Using first village: ${firstVillage.value} = ${firstVillage.text}`);
        // Re-bootstrap by re-selecting district + tahasil then the village
        await page.selectOption("#ctl00_ContentPlaceHolder1_ddlVillage", firstVillage.value);
        await page.waitForLoadState("networkidle");
        await page.waitForFunction(
          () => {
            const r = document.querySelector<HTMLInputElement>('input[type="radio"][id*="rbtnRORSearchtype"]');
            return !!r && !r.disabled;
          },
          { timeout: 15_000 }
        );
      }
    }

    const { bindOpts, targetOpt } = await switchToPlot(page, cap);
    const plotValue = (targetOpt ?? bindOpts.find(o => o.value.trim()))?.value ?? TARGET_PLOT;

    await submitRoR(page, cap, plotValue);
    await inspectPage(page);

    console.log("\n=== PROBE COMPLETE ===");
  } catch (err) {
    console.error("\n=== PROBE ERROR ===", err);
  } finally {
    await browser?.close();
  }
}

main();
