#!/usr/bin/env npx tsx
/**
 * Captures the raw SRoRFront_Uni.aspx HTML for Mendhasala + plot 128.
 * Run: pnpm dlx tsx scripts/probe-bhulekh-ror-html.ts
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
// Minimal BhulekhSession (copied from fetcher)
// ─────────────────────────────────────────────────────────────────────────────
class Session {
  private cookies: string[] = [];
  private hiddenFields: Record<string, string> = {};

  injectSession(opts: { cookies: string[]; hiddenFields: Record<string, string> }) {
    this.cookies = [...opts.cookies];
    this.hiddenFields = { ...opts.hiddenFields };
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
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(this.hiddenFields)) p.set(k, v);
    for (const [k, v] of Object.entries(overrides)) p.set(k, v);
    return p.toString();
  }

  async postAsync(eventTarget: string, eventArg: string, extra: Record<string, string>) {
    const body = this.buildBody({
      ...extra,
      "ctl00$ScriptManager1": `ctl00$ContentPlaceHolder1$UpdatePanel1|${eventTarget}`,
      "__EVENTTARGET": eventTarget,
      "__EVENTARGUMENT": eventArg,
    });
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
    this.extractHidden(res.text);
    return this.parseDelta(res.text);
  }

  async postFinal(fields: Record<string, string>) {
    const body = this.buildBody({
      ...fields,
      "ctl00$ScriptManager1": "ctl00$ContentPlaceHolder1$UpdatePanel1|ctl00$ContentPlaceHolder1$btnRORFront",
      "__EVENTTARGET": "ctl00$ContentPlaceHolder1$btnRORFront",
      "__EVENTARGUMENT": "",
      [districtField("btnRORFront")]: "View RoR",
    });
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
    this.extractHidden(res.text);
    return this.parseDelta(res.text);
  }

  async fetchPage(url: string) {
    const res = await this.request(url, {
      method: "GET",
      headers: { Cookie: this.cookies.join("; "), Referer: ROR_VIEW_URL },
    });
    return res.text;
  }

  private extractHidden(html: string) {
    for (const m of html.matchAll(/<input[^>]+type="hidden"[^>]+>/gi)) {
      const nm = m[0].match(/name="([^"]+)"/)?.[1];
      const vl = m[0].match(/value="([^"]*)"/)?.[1] ?? "";
      if (nm) this.hiddenFields[nm] = vl;
    }
    for (const m of html.matchAll(/hiddenField\|([^|]+)\|([^|]*)\|/g)) {
      this.hiddenFields[m[1]] = m[2];
    }
  }

  parseDelta(text: string) {
    const redirectMatch = text.match(/pageRedirect\|\|([^|]+)/);
    const redirectPath = redirectMatch ? decodeURIComponent(redirectMatch[1]) : undefined;
    const updatePanelMatch = text.match(
      /updatePanel\|[^|]*\|([\s\S]*?)(?=\|\d+\|hiddenField\||\|\d+\|scriptBlock\|$)/i
    );
    return { redirectPath, updatePanelHtml: updatePanelMatch?.[1] ?? "", raw: text };
  }
}

async function main() {
  // ── Browser bootstrap ──────────────────────────────────────────────────────
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

  const session = new Session();
  session.injectSession({ cookies, hiddenFields: hidden });

  // ── HTTP cascade ───────────────────────────────────────────────────────────
  console.log("2. Select district 20...");
  await session.postAsync(districtField("ddlDistrict"), "", {
    [districtField("ddlDistrict")]: "20",
    [districtField("ddlTahsil")]: "",
    [districtField("ddlVillage")]: "",
  });

  console.log("3. Select tahasil 2...");
  await session.postAsync(districtField("ddlTahsil"), "", {
    [districtField("ddlDistrict")]: "20",
    [districtField("ddlTahsil")]: "2",
    [districtField("ddlVillage")]: "",
  });

  console.log("4. Select village 105...");
  const d3 = await session.postAsync(districtField("ddlVillage"), "", {
    [districtField("ddlDistrict")]: "20",
    [districtField("ddlTahsil")]: "2",
    [districtField("ddlVillage")]: "105",
  });

  console.log("5. Switch to Plot mode...");
  const d4 = await session.postAsync(districtField("rbtnRORSearchtype") + "$1", "", {
    [districtField("ddlDistrict")]: "20",
    [districtField("ddlTahsil")]: "2",
    [districtField("ddlVillage")]: "105",
    [districtField("rbtnRORSearchtype")]: "Plot",
  });

  // Find plot 128
  const plotMatch = d4.updatePanelHtml?.match(
    /<option[^>]+value="([^"]*)"[^>]*>\s*128\s*<\/option>/i
  );
  if (!plotMatch) {
    console.log("   Plot 128 not found in delta!");
    console.log("   Delta snippet:", d4.updatePanelHtml?.slice(0, 500));
    await browser.close();
    return;
  }
  const plotValue = plotMatch[1].trim();
  console.log(`   Plot 128 value: ${JSON.stringify(plotValue)}`);

  console.log("6. Click View RoR...");
  const d5 = await session.postFinal({
    [districtField("ddlDistrict")]: "20",
    [districtField("ddlTahsil")]: "2",
    [districtField("ddlVillage")]: "105",
    [districtField("rbtnRORSearchtype")]: "Plot",
    [districtField("ddlBindData")]: plotValue,
  });
  console.log("   redirect:", d5.redirectPath);
  if (d5.raw.includes("error|")) {
    console.log("   ERROR:", d5.raw.match(/error\|([^\|]+)/)?.[1]);
  }

  if (!d5.redirectPath) {
    console.log("   No redirect! Delta:", d5.raw.slice(0, 300));
    await browser.close();
    return;
  }

  const redirectUrl = d5.redirectPath.startsWith("/")
    ? `${BHULEKH_URL}${d5.redirectPath}`
    : d5.redirectPath;
  console.log("7. Fetching RoR page:", redirectUrl);
  const rorHtml = await session.fetchPage(redirectUrl);
  console.log("   HTML length:", rorHtml.length, "chars");

  writeFileSync(path.join(process.cwd(), "scripts", "probe", "bhulekh-ror-sror-plot128.html"), rorHtml);
  console.log("   Saved to scripts/probe/bhulekh-ror-sror-plot128.html");

  // ── Parse structure ────────────────────────────────────────────────────────
  console.log("\n--- PAGE STRUCTURE SAMPLES ---");

  const spans = [...rorHtml.matchAll(/<span[^>]+id="([^"]*lbl[^"]*)"[^>]*>([\s\S]*?)<\/span>/gi)]
    .slice(0, 30)
    .map((m) => ({ id: m[1], text: m[2].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim() }));
  console.log("\nSpans with 'lbl' in ID:");
  for (const s of spans) {
    console.log(`  ${s.id}: ${s.text.slice(0, 80)}`);
  }

  const tables = [...rorHtml.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/gi)];
  console.log(`\nTables found: ${tables.length}`);
  for (let i = 0; i < Math.min(tables.length, 5); i++) {
    const rows = [...tables[i][1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
    console.log(`  Table ${i}: ${rows.length} rows`);
    for (const row of rows.slice(0, 6)) {
      const cells = [...row[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)]
        .map((m) => m[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim());
      if (cells.length > 0) console.log(`    [${cells.join(" | ")}]`);
    }
  }

  // Print the header section of the page
  const headerSection = rorHtml.match(/<table[^>]*class="[^"]*Header[^"]*"[^>]*>([\s\S]*?)<\/table>/i);
  if (headerSection) {
    console.log("\n--- HEADER TABLE ---");
    console.log(headerSection[1].slice(0, 2000));
  }

  await browser.close();
}

main().catch(console.error);
