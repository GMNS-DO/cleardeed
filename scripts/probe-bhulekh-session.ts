#!/usr/bin/env npx tsx
/**
 * Bhulekh session-replay probe — captures exact HTTP traces at the network layer.
 *
 * Uses Playwright to drive the browser (it handles __EVENTVALIDATION internally),
 * while we intercept and log the actual HTTP requests/responses at each step.
 *
 * Run: pnpm dlx tsx scripts/probe-bhulekh-session.ts
 */
import { chromium } from "playwright";
import { writeFileSync } from "fs";
import path from "path";

const ROR_VIEW = "https://bhulekh.ori.nic.in/RoRView.aspx";
const OUT_DIR = path.join(process.cwd(), "scripts", "probe");

interface TraceEntry {
  step: string;
  method: string;
  url: string;
  requestHeaders: Record<string, string>;
  requestBody: string;
  responseStatus: number;
  responseBody: string;
  parsed: {
    hasRedirect: boolean;
    redirectPath?: string;
    hasUpdatePanel: boolean;
    hiddenFieldKeys: string[];
    error?: string;
  };
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  await page.setExtraHTTPHeaders({
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
  });

  const traces: TraceEntry[] = [];
  const traceMap = new Map<string, TraceEntry>();

  // ── Network interceptor ────────────────────────────────────────────────────
  page.on("request", (req) => {
    if (!req.url().includes("RoRView")) return;
    const body = req.postDataBuffer?.toString("utf8") ?? "";
    const headers = req.headers();
    const entry: TraceEntry = {
      step: "pending",
      method: req.method(),
      url: req.url(),
      requestHeaders: headers,
      requestBody: body,
      responseStatus: 0,
      responseBody: "",
      parsed: { hasRedirect: false, hasUpdatePanel: false, hiddenFieldKeys: [], error: undefined },
    };
    const key = `${req.method()}:${req.url()}:${body.slice(0, 50)}`;
    traceMap.set(key, entry);
    (req as any)._traceKey = key;
  });

  page.on("response", async (resp) => {
    if (!resp.url().includes("RoRView")) return;
    const req = resp.request() as any;
    const key: string | undefined = req._traceKey;
    const entry = key ? traceMap.get(key) : undefined;
    if (!entry) return;
    entry.responseStatus = resp.status();
    entry.responseBody = await resp.text().catch(() => "");

    const raw = entry.responseBody;
    const redirectMatch = raw.match(/pageRedirect\|\|([^|]+)/);
    entry.parsed.hasRedirect = !!redirectMatch;
    entry.parsed.redirectPath = redirectMatch ? decodeURIComponent(redirectMatch[1]) : undefined;
    entry.parsed.hasUpdatePanel = raw.includes("updatePanel|");
    entry.parsed.hiddenFieldKeys = [...raw.matchAll(/hiddenField\|([^|]+)\|/g)].map((m) => m[1]);
    const errorMatch = raw.match(/error\|([^\|]+)/);
    entry.parsed.error = errorMatch?.[1];

    traces.push(entry);
  });

  // ── Step 1: Bootstrap ─────────────────────────────────────────────────────
  console.log("1. Bootstrap: GET RoRView.aspx...");
  await page.goto(ROR_VIEW, { waitUntil: "domcontentloaded", timeout: 30000 });

  if (page.url().includes("BhulekhError.aspx")) {
    console.log("   On BhulekhError.aspx — clicking 'here'...");
    await page.locator("a", { hasText: "here" }).click();
    await page.waitForURL(/RoRView\.aspx/, { timeout: 30000 });
  }
  const bootstrapTraces = traces.filter((t) => t.step === "pending").slice(-3);
  bootstrapTraces.forEach((t) => (t.step = "bootstrap"));
  console.log("   URL:", page.url());

  // ── Step 2: Select district 20 ─────────────────────────────────────────────
  console.log("\n2. Select district 20 (Khordha)...");
  await page.locator("#ctl00_ContentPlaceHolder1_ddlDistrict").selectOption("20");
  await page.waitForFunction(
    () => {
      const sel = document.querySelector<HTMLSelectElement>("#ctl00_ContentPlaceHolder1_ddlTahsil");
      return !!sel && !sel.disabled && sel.options.length > 1;
    },
    { timeout: 15000 }
  );
  traces.filter((t) => t.step === "pending").forEach((t) => (t.step = "district"));
  const districtTrace = traces.find((t) => t.step === "district");
  console.log("   Tahasil populated. Hidden fields:", districtTrace?.parsed.hiddenFieldKeys.slice(0, 3));

  // ── Step 3: Select tahasil 2 ───────────────────────────────────────────────
  console.log("\n3. Select tahasil 2 (Bhubaneswar)...");
  await page.locator("#ctl00_ContentPlaceHolder1_ddlTahsil").selectOption("2");
  await page.waitForFunction(
    () => {
      const sel = document.querySelector<HTMLSelectElement>("#ctl00_ContentPlaceHolder1_ddlVillage");
      return !!sel && !sel.disabled && sel.options.length > 1;
    },
    { timeout: 15000 }
  );
  traces.filter((t) => t.step === "pending").forEach((t) => (t.step = "tahasil"));
  console.log("   Village dropdown populated.");

  // ── Step 4: Select village 105 ───────────────────────────────────────────────
  console.log("\n4. Select village 105 (Mendhasala)...");
  await page.locator("#ctl00_ContentPlaceHolder1_ddlVillage").selectOption("105");
  await page.waitForFunction(
    () => {
      const radio = document.querySelector<HTMLInputElement>("#ctl00_ContentPlaceHolder1_rbtnRORSearchtype_0");
      return !!radio && !radio.disabled;
    },
    { timeout: 15000 }
  );
  traces.filter((t) => t.step === "pending").forEach((t) => (t.step = "village"));
  console.log("   Radios enabled.");

  // ── Step 5: Switch to Plot mode ─────────────────────────────────────────────
  console.log("\n5. Switch to Plot mode...");
  await page.locator(
    'input[name="ctl00$ContentPlaceHolder1$rbtnRORSearchtype"][value="Plot"]'
  ).click();
  await page.waitForFunction(
    () => {
      const sel = document.querySelector<HTMLSelectElement>("#ctl00_ContentPlaceHolder1_ddlBindData");
      return !!sel && sel.options.length > 1;
    },
    { timeout: 15000 }
  );
  traces.filter((t) => t.step === "pending").forEach((t) => (t.step = "plot-mode"));

  // Read plot options
  const plotOptions = await page.evaluate(() => {
    const sel = document.querySelector<HTMLSelectElement>("#ctl00_ContentPlaceHolder1_ddlBindData");
    if (!sel) return [];
    return Array.from(sel.options)
      .filter((o) => o.value.trim())
      .map((o) => ({ value: o.value.trim(), text: o.textContent?.trim() ?? "" }));
  });
  console.log("   Plot options:", plotOptions.length);
  const plot128 = plotOptions.find((o) => o.text.trim() === "128");
  console.log("   Plot 128:", plot128 ? `found (value="${plot128.value}")` : "NOT FOUND");
  console.log("   First 5:", plotOptions.slice(0, 5).map((o) => `${o.text}(${o.value})`));

  if (!plot128) {
    console.log("\n   ABORTING: plot 128 not found");
    await saveTraces(traces);
    await browser.close();
    return;
  }

  // ── Step 6: Read form state before View RoR ────────────────────────────────
  console.log("\n6. Reading form state before View RoR...");
  const formState = await page.evaluate(() => {
    const form = document.forms[0] as HTMLFormElement;
    const fd = new FormData(form);
    const obj: Record<string, string> = {};
    fd.forEach((v, k) => { obj[k] = String(v); });
    return obj;
  });
  writeFileSync(
    path.join(OUT_DIR, "bhulekh-trace-form-before-final.json"),
    JSON.stringify(formState, null, 2)
  );
  console.log("   Form state keys:", Object.keys(formState).length);
  console.log("   ddlBindData:", formState["ctl00$ContentPlaceHolder1$ddlBindData"]);
  console.log("   rbtnRORSearchtype:", formState["ctl00$ContentPlaceHolder1$rbtnRORSearchtype"]);
  console.log("   btnRORFront:", formState["ctl00$ContentPlaceHolder1$btnRORFront"] ?? "(not present)");

  // ── Step 7: Fire View RoR ───────────────────────────────────────────────────
  console.log("\n7. Clicking View RoR...");
  const pendingBefore = traces.length;
  await page.locator("#ctl00_ContentPlaceHolder1_btnRORFront").click();

  // Wait for either navigation OR UpdatePanel update (in case it's AJAX)
  let navigated = false;
  page.on("framenavigated", () => { navigated = true; });

  try {
    await Promise.race([
      page.waitForURL(/SRoRFront_Uni\.aspx|CRoRFront_Uni\.aspx/, { timeout: 20000 }),
      page.waitForFunction(
        () => document.body.innerText.includes("ପ୍ଲଟ") || document.body.innerText.includes("ଖଜଣା"),
        { timeout: 20000 }
      ),
    ]);
  } catch {
    // timeout — might be an AJAX delta that didn't redirect
  }

  traces.filter((t) => t.step === "pending").forEach((t) => (t.step = "final"));
  const finalTrace = traces.find(
    (t) =>
      t.step === "final" &&
      (t.responseBody.includes("pageRedirect") ||
        t.responseBody.includes("btnRORFront") ||
        t.responseBody.includes("updatePanel"))
  );

  if (finalTrace) {
    console.log("   Final trace status:", finalTrace.responseStatus);
    console.log("   Has pageRedirect:", finalTrace.parsed.hasRedirect);
    console.log("   Redirect path:", finalTrace.parsed.redirectPath);
    console.log("   Error:", finalTrace.parsed.error);
    if (finalTrace.parsed.error) {
      console.log("   !!! EVENTVALIDATION FAILURE");
    }
  }
  console.log("   Navigated:", navigated, "URL:", page.url());

  // ── Step 8: Parse ROR page ─────────────────────────────────────────────────
  const currentUrl = page.url();
  if (currentUrl.includes("SRoRFront_Uni") || currentUrl.includes("CRoRFront_Uni")) {
    const rorHtml = await page.content();
    writeFileSync(path.join(OUT_DIR, "bhulekh-ror-page.html"), rorHtml);
    console.log("\n8. SUCCESS! ROR page saved:", rorHtml.length, "chars");

    const ownerName = extractSpan(rorHtml, "gvfront_ctl02_lblName");
    const khataNo = extractSpan(rorHtml, "gvfront_ctl02_lblKhatiyanslNo");
    const landClass = extractSpan(rorHtml, "gvfront_ctl02_lblStatua");
    const total = extractSpan(rorHtml, "gvfront_ctl02_lblTotal");
    console.log("\n   RoR fields:");
    console.log("   Owner:", ownerName?.replace(/\s+/g, " ").trim());
    console.log("   Khata No:", khataNo?.replace(/\s+/g, " ").trim());
    console.log("   Land class:", landClass?.replace(/\s+/g, " ").trim());
    console.log("   Total:", total?.replace(/\s+/g, " ").trim());
  } else {
    writeFileSync(path.join(OUT_DIR, "bhulekh-post-viewror-state.html"), await page.content());
    console.log("\n   Did NOT navigate to RoR page. URL:", currentUrl);
    console.log("   Saved current page to bhulekh-post-viewror-state.html");
  }

  // ── Save traces ─────────────────────────────────────────────────────────────
  await saveTraces(traces);
  await browser.close();
}

async function saveTraces(traces: TraceEntry[]) {
  writeFileSync(
    path.join(OUT_DIR, "bhulekh-traces-summary.json"),
    JSON.stringify(
      traces.map((t) => ({
        step: t.step,
        method: t.method,
        status: t.responseStatus,
        hasRedirect: t.parsed.hasRedirect,
        redirectPath: t.parsed.redirectPath,
        error: t.parsed.error,
      })),
      null,
      2
    )
  );
  console.log("\nSaved: bhulekh-traces-summary.json");

  const fullTraces = traces.map((t) => ({
    ...t,
    responseBody: t.responseBody.length > 20000
      ? t.responseBody.slice(0, 20000) + "\n[TRUNCATED]"
      : t.responseBody,
  }));
  writeFileSync(
    path.join(OUT_DIR, "bhulekh-traces-full.json"),
    JSON.stringify(fullTraces, null, 2)
  );
  console.log("Saved: bhulekh-traces-full.json");
}

function extractSpan(html: string, id: string): string | null {
  const escapedId = id.replace(/\$/g, "\\$");
  const pattern = new RegExp(
    `<span[^>]+id=["']${escapedId}["'][^>]*>([\\s\\S]*?)</span>`, "i"
  );
  const match = html.match(pattern);
  if (!match) return null;
  return match[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim() || null;
}

main().catch(console.error);
