#!/usr/bin/env node
// ccms.nic.in probe — discover form fields, captcha, and result schema
// Read-only: GET/POST only, no scraping, no captcha solving.

import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const OUTDIR = "/tmp/ccms-probe";
mkdirSync(OUTDIR, { recursive: true });

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const BASE = "https://ccms.nic.in";

const browserHeaders = {
  "User-Agent": UA,
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9,hi;q=0.8",
  "Accept-Encoding": "gzip, deflate, br",
  Connection: "keep-alive",
  "Upgrade-Insecure-Requests": "1",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
};

// Simple cookie jar (single-session).
let cookieJar = {};

function captureSetCookie(res) {
  // Node 20+ exposes getSetCookie(); fall back to raw header.
  let setCookie = [];
  if (typeof res.headers.getSetCookie === "function") {
    setCookie = res.headers.getSetCookie();
  } else {
    const raw = res.headers.get("set-cookie");
    if (raw) setCookie = [raw];
  }
  for (const sc of setCookie) {
    const [pair] = sc.split(";");
    const [name, ...rest] = pair.split("=");
    if (name) cookieJar[name.trim()] = rest.join("=").trim();
  }
}

function cookieHeader() {
  return Object.entries(cookieJar)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

async function getWithRetry(url, opts = {}, attempts = 3) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, {
        ...opts,
        headers: { ...browserHeaders, ...(opts.headers || {}) },
        redirect: "follow",
      });
      captureSetCookie(res);
      return res;
    } catch (e) {
      lastErr = e;
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, 5000));
      }
    }
  }
  throw lastErr;
}

function bufferOf(res) {
  return res.arrayBuffer().then((b) => Buffer.from(b));
}

function summary(text) {
  return text.replace(/\s+/g, " ").trim();
}

async function main() {
  console.log(`PROBE_START: ${new Date().toISOString()}`);
  const findings = {
    probedAt: new Date().toISOString(),
    root: null,
    searchCases: null,
    captchaProbe: null,
    emptySearch: null,
    killCriteria: null,
    nextSteps: [],
    anomalies: [],
    raw: {},
  };

  // ---- 1. GET root ----
  try {
    const res = await getWithRetry(`${BASE}/`);
    const body = await bufferOf(res);
    const isGzipped = res.headers.get("content-encoding") === "gzip";
    writeFileSync(
      join(OUTDIR, "01-root.html"),
      isGzipped ? body : body
    );
    findings.root = {
      status: res.status,
      finalUrl: res.url,
      bytes: body.length,
      cookiesSet: { ...cookieJar },
      headers: {
        contentType: res.headers.get("content-type"),
        contentEncoding: res.headers.get("content-encoding"),
        server: res.headers.get("server"),
        setCookieRaw:
          typeof res.headers.getSetCookie === "function"
            ? res.headers.getSetCookie()
            : res.headers.get("set-cookie"),
      },
    };
    console.log(
      `ROOT: status=${res.status} bytes=${body.length} cookies=${Object.keys(cookieJar).join(",")}`
    );
  } catch (e) {
    console.log(`ROOT_FAIL: ${e.message}`);
    findings.raw = { ...findings.raw, rootError: e.message };
    return writeFindingsStub("network_blocked", e.message);
  }

  // ---- 2. GET /searchCases.html ----
  let searchHtml = "";
  try {
    const res = await getWithRetry(`${BASE}/searchCases.html`, {
      headers: { Cookie: cookieHeader() },
    });
    const body = await bufferOf(res);
    searchHtml = body.toString("utf8");
    writeFileSync(join(OUTDIR, "02-search-cases.html"), body);
    findings.searchCases = {
      status: res.status,
      bytes: body.length,
      finalUrl: res.url,
      cookiesSet: { ...cookieJar },
    };
    console.log(
      `SEARCH_HTML: status=${res.status} bytes=${body.length} cookies=${Object.keys(cookieJar).join(",")}`
    );
  } catch (e) {
    console.log(`SEARCH_HTML_FAIL: ${e.message}`);
    findings.anomalies.push(`searchCases.html fetch failed: ${e.message}`);
  }

  // ---- 3. Extract form fields, dropdowns, captcha URL from HTML ----
  const formMeta = extractFormMeta(searchHtml);
  findings.searchCases = {
    ...(findings.searchCases || {}),
    ...formMeta,
  };

  // Print single summary line per spec.
  const fieldSummary = (formMeta.formFields || [])
    .map((f) => `${f.name}=${f.type}${f.options ? `[${f.options.length}]` : ""}`)
    .join("|");
  console.log(`SEARCH_FIELDS: ${fieldSummary}`);
  console.log(`CAPTCHA_URL: ${formMeta.captchaUrl || "(none found)"}`);
  console.log(
    `COOKIES_SET: ${Object.entries(cookieJar)
      .map(([k, v]) => `${k}=${v.slice(0, 16)}…`)
      .join(", ")}`
  );
  console.log(`BODY_BYTES: ${searchHtml.length}`);

  // ---- 4. GET the captcha image if we found one ----
  if (formMeta.captchaUrl) {
    try {
      const absUrl = new URL(formMeta.captchaUrl, BASE).toString();
      const res = await getWithRetry(absUrl, {
        headers: {
          Cookie: cookieHeader(),
          Referer: `${BASE}/searchCases.html`,
        },
      });
      const body = await bufferOf(res);
      const ct = res.headers.get("content-type");
      const ext = (ct || "").includes("jpeg")
        ? "jpg"
        : (ct || "").includes("png")
        ? "png"
        : (ct || "").includes("gif")
        ? "gif"
        : "bin";
      writeFileSync(join(OUTDIR, `03-captcha.${ext}`), body);
      findings.captchaProbe = {
        url: absUrl,
        status: res.status,
        contentType: ct,
        bytes: body.length,
        extension: ext,
        cookiesSet: { ...cookieJar },
      };
      console.log(
        `CAPTCHA_FETCH: status=${res.status} ct=${ct} bytes=${body.length}`
      );
    } catch (e) {
      findings.captchaProbe = { error: e.message };
      findings.anomalies.push(`captcha fetch failed: ${e.message}`);
      console.log(`CAPTCHA_FETCH_FAIL: ${e.message}`);
    }
  }

  // ---- 5. POST empty/clearly-missing case to see result schema ----
  if (formMeta.formAction || formMeta.formFields) {
    try {
      const formAction = formMeta.formAction
        ? new URL(formMeta.formAction, BASE).toString()
        : `${BASE}/searchCases.html`;

      // Build a payload using a case_no that should not exist + any hidden
      // fields the form declared. We deliberately do NOT include captcha;
      // the response is informative regardless of validation outcome.
      const payload = new URLSearchParams();
      for (const f of formMeta.formFields) {
        if (f.type === "hidden") {
          payload.set(f.name, "");
        }
      }
      // Try common case-no field names; the server-side handler will
      // likely return some kind of result page even if invalid.
      if (formMeta.hasCaseNoSearch) {
        const cnf =
          formMeta.formFields.find((f) => /case.?no/i.test(f.name)) ||
          formMeta.formFields.find((f) => /caseNo|case_no/i.test(f.name));
        if (cnf) payload.set(cnf.name, "ZZZZ-NONEXISTENT-9999/2099");
      }
      // Year — pick something recent.
      const yf = formMeta.formFields.find((f) => /year/i.test(f.name));
      if (yf) payload.set(yf.name, "2099");

      const res = await fetch(formAction, {
        method: "POST",
        headers: {
          ...browserHeaders,
          Cookie: cookieHeader(),
          "Content-Type": "application/x-www-form-urlencoded",
          Referer: `${BASE}/searchCases.html`,
          Origin: BASE,
        },
        body: payload.toString(),
        redirect: "follow",
      });
      const body = await bufferOf(res);
      writeFileSync(join(OUTDIR, "04-empty-search.html"), body);
      const emptyHtml = body.toString("utf8");
      findings.emptySearch = {
        url: formAction,
        method: "POST",
        status: res.status,
        bytes: body.length,
        contentType: res.headers.get("content-type"),
      };
      // Try to extract any result-table column headers from the response.
      const cols = extractTableColumns(emptyHtml);
      if (cols.length) {
        findings.emptySearch.columns = cols;
        findings.emptySearch.sampleRow = extractFirstRow(emptyHtml);
      } else {
        findings.emptySearch.columns = [];
        findings.emptySearch.notes =
          "No <table> with multiple columns found in response; server may have returned a validation/error page.";
      }
      console.log(
        `EMPTY_SEARCH: status=${res.status} bytes=${body.length} cols=${(cols || []).join(",") || "none"}`
      );
    } catch (e) {
      findings.emptySearch = { error: e.message };
      findings.anomalies.push(`empty search POST failed: ${e.message}`);
      console.log(`EMPTY_SEARCH_FAIL: ${e.message}`);
    }
  }

  // ---- 6. Kill-criteria verdict ----
  const cols = (findings.emptySearch && findings.emptySearch.columns) || [];
  const hasPlot = cols.some((c) => /plot/i.test(c));
  const hasKhata = cols.some((c) => /khata|khatiyan|khatian/i.test(c));
  const hasVillage = cols.some((c) => /village|mouza|tehsil|district|moja/i.test(c));
  const hasCase = cols.some((c) => /case.?no|case.?number|file.?no/i.test(c));
  const hasParties = cols.some((c) => /party|petitioner|respondent|applicant|complainant|accused/i.test(c));

  // NOTE: This portal is Case Management (CMM) — likely a court-case-number
  // portal, NOT a property-record portal. We capture the verdict based on
  // observed columns, with a strong "PARTIAL-GO / NO-GO" default.
  let verdict = "NO-GO";
  let reason = "";
  if (!findings.emptySearch || findings.emptySearch.error) {
    verdict = "NO-GO";
    reason = "Could not POST to the search form to inspect result table.";
  } else if (hasPlot || hasKhata || hasVillage) {
    verdict = "PARTIAL-GO";
    reason =
      "Result table exposes a property-record column (plot/khata/village). Useful as a manual cross-check, not a primary fetcher.";
  } else if (hasCase && hasParties) {
    verdict = "PARTIAL-GO";
    reason =
      "Portal is a Case Management (CMM) system keyed on case number + parties. Can match by parties only if a plot/khata mapping exists upstream — which this portal does not appear to provide.";
  } else if (cols.length === 0) {
    verdict = "NO-GO";
    reason =
      "Server returned no result table on POST (likely captcha-gated, session-invalidated, or wrong endpoint).";
  } else {
    verdict = "NO-GO";
    reason = `Result table columns were ${cols.join(", ") || "(unknown)"} — no property-record key.`;
  }

  findings.killCriteria = {
    resultTableHasPlotColumn: hasPlot,
    resultTableHasKhataColumn: hasKhata,
    resultTableHasVillageColumn: hasVillage,
    resultTableHasCaseColumn: hasCase,
    resultTableHasPartiesColumn: hasParties,
    resultTableColumns: cols,
    verdict,
    reason,
  };

  // ---- 7. Persist findings ----
  writeFileSync(join(OUTDIR, "FINDINGS.json"), JSON.stringify(findings, null, 2));
  console.log(`\nVERDICT: ${verdict} — ${reason}`);
  console.log(`FINDINGS_WRITTEN: ${join(OUTDIR, "FINDINGS.json")}`);
}

function writeFindingsStub(status, message) {
  const stub = {
    probedAt: new Date().toISOString(),
    status,
    message,
    nextSteps: [
      "Re-run from a network with outbound access to ccms.nic.in.",
      "Consider using Playwright headless instead of raw fetch if the portal is JS-driven.",
    ],
  };
  writeFileSync(
    join("/tmp/ccms-probe", "FINDINGS.json"),
    JSON.stringify(stub, null, 2)
  );
  console.log(`NETWORK_BLOCKED: ${message}`);
  process.exit(0);
}

// ----------------- HTML extraction helpers -----------------

function extractFormMeta(html) {
  if (!html) return { formFields: [], captchaUrl: null };

  const out = {
    formFields: [],
    formAction: null,
    formMethod: null,
    captchaUrl: null,
    hasPartyNameSearch: false,
    hasPlotSearch: false,
    hasKhataSearch: false,
    hasCaseNoSearch: false,
    textSnippets: [],
  };

  // <form action method>
  const formMatch = html.match(/<form\b[^>]*>/i);
  if (formMatch) {
    const action = formMatch[0].match(/action\s*=\s*"([^"]*)"/i);
    const method = formMatch[0].match(/method\s*=\s*"([^"]*)"/i);
    if (action) out.formAction = action[1];
    if (method) out.formMethod = method[1].toUpperCase();
  }

  // <input ...>
  const inputRe = /<input\b[^>]*>/gi;
  let m;
  while ((m = inputRe.exec(html)) !== null) {
    const tag = m[0];
    const nameM = tag.match(/\bname\s*=\s*"([^"]*)"/i);
    const typeM = tag.match(/\btype\s*=\s*"([^"]*)"/i);
    const valueM = tag.match(/\bvalue\s*=\s*"([^"]*)"/i);
    if (!nameM) continue;
    const name = nameM[1];
    const type = (typeM && typeM[1].toLowerCase()) || "text";
    out.formFields.push({ name, type, value: valueM ? valueM[1] : undefined });
  }

  // <select><option>...</option></select>
  const selectRe = /<select\b[^>]*>([\s\S]*?)<\/select>/gi;
  while ((m = selectRe.exec(html)) !== null) {
    const tag = m[0];
    const nameM = tag.match(/\bname\s*=\s*"([^"]*)"/i);
    if (!nameM) continue;
    const name = nameM[1];
    const opts = [];
    const optRe = /<option\b[^>]*>([\s\S]*?)<\/option>/gi;
    let o;
    while ((o = optRe.exec(m[1])) !== null) {
      const optTag = o[0];
      const vM = optTag.match(/\bvalue\s*=\s*"([^"]*)"/i);
      const tM = o[1].match(/<[^>]*>([\s\S]*?)<\/[^>]*>/) || [null, o[1]];
      const text = (tM[1] || "").replace(/<[^>]+>/g, "").trim();
      const selected = /\bselected\b/i.test(optTag);
      opts.push({ value: vM ? vM[1] : text, text, selected });
    }
    out.formFields.push({ name, type: "select", options: opts });
  }

  // <textarea>
  const taRe = /<textarea\b[^>]*>/gi;
  while ((m = taRe.exec(html)) !== null) {
    const nameM = m[0].match(/\bname\s*=\s*"([^"]*)"/i);
    if (nameM) {
      out.formFields.push({ name: nameM[1], type: "textarea" });
    }
  }

  // Captcha image
  const capM =
    html.match(/<img\b[^>]*captcha[^>]*>/i) ||
    html.match(/<img\b[^>]*src\s*=\s*"([^"]*(?:captcha|Captcha|CAPTCHA)[^"]*)"[^>]*>/i);
  if (capM) {
    const srcM = capM[0].match(/\bsrc\s*=\s*"([^"]*)"/i);
    if (srcM) out.captchaUrl = srcM[1];
  }
  // If no captcha image, look for any image near the word "captcha".
  if (!out.captchaUrl) {
    const nearCap = html.match(/captcha[\s\S]{0,400}?<img\b[^>]*>/i);
    if (nearCap) {
      const srcM = nearCap[0].match(/\bsrc\s*=\s*"([^"]*)"/i);
      if (srcM) out.captchaUrl = srcM[1];
    }
  }

  // Hint text searches
  const text = html.replace(/<[^>]+>/g, " ").toLowerCase();
  out.hasPartyNameSearch =
    /party\s*name|petitioner|respondent|applicant|complainant|accused|ପକ୍ଷୀ/.test(text);
  out.hasPlotSearch = /plot\s*no|plot\s*number|ପ୍ଲଟ/.test(text);
  out.hasKhataSearch = /khata|khatiyan|khatian|ଖତିୟାନ/.test(text);
  out.hasCaseNoSearch = /case\s*no|case\s*number|file\s*no|ମାମଲା/.test(text);

  // Useful text snippets — page title, headings, alert messages.
  const titleM = html.match(/<title>([\s\S]*?)<\/title>/i);
  if (titleM) out.textSnippets.push(`title: ${summary(titleM[1])}`);
  const hM = html.match(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i);
  if (hM) out.textSnippets.push(`h1: ${summary(hM[1])}`);

  return out;
}

function extractTableColumns(html) {
  if (!html) return [];
  // Find first <table> with a <thead> and at least 2 columns.
  const tableRe = /<table\b[\s\S]*?<\/table>/gi;
  let m;
  while ((m = tableRe.exec(html)) !== null) {
    const t = m[0];
    const thead = t.match(/<thead[\s\S]*?<\/thead>/i);
    if (!thead) continue;
    const ths = [];
    const thRe = /<th\b[^>]*>([\s\S]*?)<\/th>/gi;
    let th;
    while ((th = thRe.exec(thead[0])) !== null) {
      ths.push(summary(th[1]).replace(/&nbsp;/g, " "));
    }
    if (ths.length >= 2) return ths;
  }
  // Fallback: first <tr> with multiple <td> after a search.
  const trRe = /<tr\b[\s\S]*?<\/tr>/gi;
  while ((m = trRe.exec(html)) !== null) {
    const tds = [];
    const tdRe = /<td\b[^>]*>([\s\S]*?)<\/td>/gi;
    let td;
    while ((td = tdRe.exec(m[0])) !== null) {
      tds.push(summary(td[1]).replace(/&nbsp;/g, " "));
    }
    if (tds.length >= 3) return tds;
  }
  return [];
}

function extractFirstRow(html) {
  if (!html) return null;
  const trRe = /<tr\b[\s\S]*?<\/tr>/gi;
  let m;
  while ((m = trRe.exec(html)) !== null) {
    const tds = [];
    const tdRe = /<td\b[^>]*>([\s\S]*?)<\/td>/gi;
    let td;
    while ((td = tdRe.exec(m[0])) !== null) {
      tds.push(summary(td[1]).replace(/&nbsp;/g, " "));
    }
    if (tds.length >= 2) return tds.join(" | ");
  }
  return null;
}

main().catch((e) => {
  console.log(`FATAL: ${e.message}`);
  console.log(e.stack);
  process.exit(1);
});
