#!/usr/bin/env npx tsx
/**
 * Debug probe: Bhulekh HTTP session-replay with full request/response logging.
 * Run: pnpm dlx tsx scripts/probe-bhulekh-debug.ts
 */
import { chromium } from "playwright";
import { writeFileSync } from "fs";
import path from "path";

const BHULEKH_URL = "https://bhulekh.ori.nic.in";
const ROR_VIEW_URL = `${BHULEKH_URL}/RoRView.aspx`;

function districtField(short: string): string {
  return "ctl00$ContentPlaceHolder1$" + short;
}

// ─────────────────────────────────────────────────────────────────────────────
// Minimal BhulekhSession with debug logging
// ─────────────────────────────────────────────────────────────────────────────
class Session {
  private cookies: string[] = [];
  private hiddenFields: Record<string, string> = {};
  private step = 0;

  injectSession(opts: { cookies: string[]; hiddenFields: Record<string, string> }) {
    this.cookies = [...opts.cookies];
    this.hiddenFields = { ...opts.hiddenFields };
  }

  private dumpHiddenFields(label: string) {
    const ev = this.hiddenFields["__EVENTVALIDATION"] ?? "(missing)";
    const vs = this.hiddenFields["__VIEWSTATE"] ?? "(missing)";
    console.log(`   [${label}] __EVENTVALIDATION length: ${ev.length}, __VIEWSTATE length: ${vs.length}`);
    console.log(`   [${label}] btnRORFront: "${this.hiddenFields[districtField("btnRORFront")] ?? "(not in hidden)"}"`);
    console.log(`   [${label}] rbtnRORSearchtype: "${this.hiddenFields[districtField("rbtnRORSearchtype")] ?? "(not in hidden)"}"`);
    console.log(`   [${label}] ddlBindData: "${this.hiddenFields[districtField("ddlBindData")] ?? "(not in hidden)"}"`);
  }

  private async request(url: string, init: RequestInit & { headers?: Record<string, string> }) {
    const response = await globalThis.fetch(url, {
      ...init,
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept": "*/*",
        "Accept-Language": "en-US,en;q=0.9",
        ...(init.headers ?? {}),
      },
      credentials: "omit",
    } as RequestInit);
    const headers = response.headers as unknown as { getSetCookie?: () => string[] };
    const setCookie = headers.getSetCookie?.() ?? [];
    for (const cookie of setCookie) {
      const [nameVal] = cookie.split(";");
      if (nameVal && !this.cookies.includes(nameVal)) this.cookies.push(nameVal);
    }
    return { status: response.status, text: await response.text() };
  }

  private buildBody(overrides: Record<string, string>) {
    // Build manually to avoid URLSearchParams encoding bugs with ASP.NET $ in keys.
    // Skip empty values from hiddenFields so overrides take precedence without duplication.
    const seen = new Set<string>();
    const parts: string[] = [];
    for (const [k, v] of Object.entries(this.hiddenFields)) {
      if (!seen.has(k)) { parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`); seen.add(k); }
    }
    for (const [k, v] of Object.entries(overrides)) {
      // Remove the key if already added (from hiddenFields with empty value)
      const idx = parts.findIndex(p => p.startsWith(encodeURIComponent(k) + "="));
      if (idx >= 0) parts.splice(idx, 1);
      parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
    }
    return parts.join("&");
  }

  private extractHidden(html: string) {
    let count = 0;
    for (const m of html.matchAll(/<input[^>]+type="hidden"[^>]+>/gi)) {
      const nm = m[0].match(/name="([^"]+)"/)?.[1];
      const vl = m[0].match(/value="([^"]*)"/)?.[1] ?? "";
      if (nm) { this.hiddenFields[nm] = vl; count++; }
    }
    for (const m of html.matchAll(/hiddenField\|([^|]+)\|([^|]*)\|/g)) {
      this.hiddenFields[m[1]] = m[2]; count++;
    }
    return count;
  }

  parseDelta(text: string) {
    const redirectMatch = text.match(/pageRedirect\|\|([^|]+)/);
    const redirectPath = redirectMatch ? decodeURIComponent(redirectMatch[1]) : undefined;
    const updatePanelMatch = text.match(
      /updatePanel\|[^|]*\|([\s\S]*?)(?=\|\d+\|hiddenField\||\|\d+\|scriptBlock\|$)/i
    );
    return { redirectPath, updatePanelHtml: updatePanelMatch?.[1] ?? "", raw: text };
  }

  async postAsync(eventTarget: string, eventArg: string, extra: Record<string, string>, label: string) {
    this.step++;
    const body = this.buildBody({
      ...extra,
      "ctl00$ScriptManager1": `ctl00$ContentPlaceHolder1$UpdatePanel1|${eventTarget}`,
      "__EVENTTARGET": eventTarget,
      "__EVENTARGUMENT": eventArg,
    });
    console.log(`\n[Step ${this.step}] POST ${label}`);
    console.log("   body keys:", body.split("&").map(p => p.split("=")[0]).filter(k => !k.startsWith("__VIEWSTATE") && !k.startsWith("__EVENTVALIDATION")).join(", "));
    const res = await this.request(ROR_VIEW_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "x-microsoftajax": "Delta=true",
        "x-requested-with": "XMLHttpRequest",
        "Cookie": this.cookies.join("; "),
        "Referer": ROR_VIEW_URL,
      },
      body,
    });
    const n = this.extractHidden(res.text);
    console.log(`   status: ${res.status}, delta length: ${res.text.length}, hidden fields updated: ${n}`);
    if (res.text.includes("error|")) {
      console.log("   ERROR:", res.text.match(/error\|([^\|]+)/)?.[1]);
    }
    return this.parseDelta(res.text);
  }

  async postFinal(fields: Record<string, string>, label: string) {
    this.step++;
    const body = this.buildBody({
      ...fields,
      "ctl00$ScriptManager1": "ctl00$ContentPlaceHolder1$UpdatePanel1|ctl00$ContentPlaceHolder1$btnRORFront",
      "__EVENTTARGET": "ctl00$ContentPlaceHolder1$btnRORFront",
      "__EVENTARGUMENT": "",
      [districtField("btnRORFront")]: "View RoR",
    });
    console.log(`\n[Step ${this.step}] POSTFINAL ${label}`);
    const bodyKeys = body.split("&").map(p => {
      const [k, v] = p.split("=");
      if (k === "__VIEWSTATE" || k === "__EVENTVALIDATION") return k + "=(...)";
      if (k === districtField("btnRORFront")) return k + "=View RoR";
      return k + "=" + decodeURIComponent(v || "").slice(0, 20);
    });
    console.log("   body:", bodyKeys.join("&"));
    this.dumpHiddenFields("PRE-FINAL");
    const res = await this.request(ROR_VIEW_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "x-microsoftajax": "Delta=true",
        "x-requested-with": "XMLHttpRequest",
        "Cookie": this.cookies.join("; "),
        "Referer": ROR_VIEW_URL,
      },
      body,
    });
    const n = this.extractHidden(res.text);
    console.log(`   status: ${res.status}, delta length: ${res.text.length}, hidden updated: ${n}`);
    if (res.text.includes("error|")) {
      console.log("   ERROR:", res.text.match(/error\|([^\|]+)/)?.[1]);
      console.log("   First 500 chars of delta:", res.text.slice(0, 500));
    }
    return this.parseDelta(res.text);
  }

  async fetchPage(url: string) {
    const res = await this.request(url, {
      method: "GET",
      headers: { Cookie: this.cookies.join("; "), Referer: ROR_VIEW_URL },
    });
    return res.text;
  }
}

async function main() {
  console.log("1. Browser bootstrap...");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setExtraHTTPHeaders({
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
  });
  await page.goto(ROR_VIEW_URL, { waitUntil: "domcontentloaded", timeout: 30_000 });
  if (page.url().includes("BhulekhError.aspx")) {
    await page.locator("a", { hasText: "here" }).click();
    await page.waitForURL(/RoRView\.aspx/, { timeout: 30_000 });
  }

  const cookies = (await page.context().cookies([ROR_VIEW_URL])).map((c) => `${c.name}=${c.value}`);
  const hidden: Record<string, string> = {};
  for (const { name, value } of await page.locator("input[type=hidden]").evaluateAll(
    (nodes) => nodes.map((n) => ({ name: (n as HTMLInputElement).name, value: (n as HTMLInputElement).value }))
  )) {
    hidden[name] = value;
  }
  await page.close();
  console.log(`   Cookies: ${cookies.length}, Hidden fields: ${Object.keys(hidden).length}`);
  console.log("   Keys:", Object.keys(hidden).join(", "));

  const session = new Session();
  session.injectSession({ cookies, hiddenFields: hidden });

  // Cascade
  await session.postAsync(districtField("ddlDistrict"), "", {
    [districtField("ddlDistrict")]: "20",
    [districtField("ddlTahsil")]: "",
    [districtField("ddlVillage")]: "",
  }, "district");

  await session.postAsync(districtField("ddlTahsil"), "", {
    [districtField("ddlDistrict")]: "20",
    [districtField("ddlTahsil")]: "2",
    [districtField("ddlVillage")]: "",
  }, "tahasil");

  const d3 = await session.postAsync(districtField("ddlVillage"), "", {
    [districtField("ddlDistrict")]: "20",
    [districtField("ddlTahsil")]: "2",
    [districtField("ddlVillage")]: "105",
  }, "village");

  const d4 = await session.postAsync(districtField("rbtnRORSearchtype") + "$1", "", {
    [districtField("ddlDistrict")]: "20",
    [districtField("ddlTahsil")]: "2",
    [districtField("ddlVillage")]: "105",
    [districtField("rbtnRORSearchtype")]: "Plot",
  }, "plot-mode");

  // Find plot 128
  const plotMatch = d4.updatePanelHtml?.match(/<option[^>]+value="([^"]*)"[^>]*>\s*128\s*<\/option>/i);
  if (!plotMatch) {
    console.log("   Plot 128 not found!");
    await browser.close();
    return;
  }
  const plotValue = plotMatch[1].trim();
  console.log(`\n   Plot 128 value: ${JSON.stringify(plotValue)}`);

  // View RoR
  const d5 = await session.postFinal({
    [districtField("ddlDistrict")]: "20",
    [districtField("ddlTahsil")]: "2",
    [districtField("ddlVillage")]: "105",
    [districtField("rbtnRORSearchtype")]: "Plot",
    [districtField("ddlBindData")]: plotValue,
  }, "view-ror");

  if (!d5.redirectPath) {
    console.log("\n   No redirect! Saving delta to file...");
    writeFileSync(path.join(process.cwd(), "scripts", "probe", "bhulekh-debug-delta.txt"), d5.raw);
    await browser.close();
    return;
  }

  const redirectUrl = d5.redirectPath.startsWith("/")
    ? `${BHULEKH_URL}${d5.redirectPath}`
    : d5.redirectPath;
  console.log(`\n   Following redirect to: ${redirectUrl}`);
  const rorHtml = await session.fetchPage(redirectUrl);
  writeFileSync(path.join(process.cwd(), "scripts", "probe", "bhulekh-ror-sror-plot128.html"), rorHtml);
  console.log(`   HTML length: ${rorHtml.length} chars`);
  console.log("   Saved to scripts/probe/bhulekh-ror-sror-plot128.html");

  // Parse structure
  const spans = [...rorHtml.matchAll(/<span[^>]+id="([^"]*lbl[^"]*)"[^>]*>([\s\S]*?)<\/span>/gi)]
    .slice(0, 30)
    .map((m) => ({ id: m[1], text: m[2].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim() }));
  console.log("\n--- LBL SPANS ---");
  for (const s of spans) console.log(`  ${s.id}: ${s.text.slice(0, 80)}`);

  const tables = [...rorHtml.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/gi)];
  console.log(`\nTables: ${tables.length}`);
  for (let i = 0; i < Math.min(tables.length, 5); i++) {
    const rows = [...tables[i][1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
    console.log(`  Table ${i}: ${rows.length} rows`);
    for (const row of rows.slice(0, 6)) {
      const cells = [...row[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)]
        .map((m) => m[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim());
      if (cells.length > 0) console.log(`    [${cells.join(" | ")}]`);
    }
  }

  await browser.close();
}

main().catch(console.error);
