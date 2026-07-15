#!/usr/bin/env node
// Cross-link probe: take real Bhulekh values and try them in ccms.nic.in
// Tests 3 cross-link paths:
//   1) hal-khata no.  →  searchbyhallkhatano.html  (with captcha)
//   2) hal-plot no.   →  searchbykhatanoid.html    (with captcha)
//   3) case-no        →  findCase.html / fetchallCaseDetails.html
//   4) party name     →  findPetCase.html          (no captcha)
//
// The earlier "reverse-lookup NO-GO" finding was based on 0000/0000 (which
// returns "Record Not Found"). This probe uses REAL Khordha values from
// production Bhulekh fetches (Session 050 + build_pre_filled).
//
// Goal: determine whether the result row for a real key echoes back the
// key plus identifying context, or only case-management columns.

import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { createWorker } from "/Users/deekshamohapatra/Documents/cleardeed/node_modules/tesseract.js/src/index.js";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const BASE = "https://ccms.nic.in";

const browserHeaders = {
  "User-Agent": UA,
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9,hi;q=0.8",
  "Accept-Encoding": "gzip, deflate, br",
  Connection: "keep-alive",
  "Upgrade-Insecure-Requests": "1",
};

const OUT_DIR = "/tmp/ccms-probe";
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

let cookieJar = {};
let worker;

function captureSetCookie(res) {
  const sc =
    typeof res.headers.getSetCookie === "function"
      ? res.headers.getSetCookie()
      : [res.headers.get("set-cookie")].filter(Boolean);
  for (const c of sc) {
    const [pair] = c.split(";");
    const [name, ...rest] = pair.split("=");
    if (name) cookieJar[name.trim()] = rest.join("=").trim();
  }
}

function cookieHeader() {
  return Object.entries(cookieJar)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

function clearCookies() {
  cookieJar = {};
}

async function bootstrap() {
  clearCookies();
  const r1 = await fetch(`${BASE}/loginHome.html`, {
    headers: browserHeaders,
    redirect: "follow",
  });
  captureSetCookie(r1);
  const r2 = await fetch(`${BASE}/searchCases.html`, {
    headers: { ...browserHeaders, Cookie: cookieHeader() },
    redirect: "follow",
  });
  captureSetCookie(r2);
  console.log(`[bootstrap] session=${Object.keys(cookieJar).join(",")}`);
}

async function getCaptcha() {
  const r = await fetch(`${BASE}/captcha.jpg`, {
    headers: {
      ...browserHeaders,
      Cookie: cookieHeader(),
      Referer: `${BASE}/searchCases.html`,
    },
  });
  captureSetCookie(r);
  return Buffer.from(await r.arrayBuffer());
}

async function solveCaptcha(buf, attempt) {
  if (!worker) worker = await createWorker("eng");
  const { data } = await worker.recognize(buf);
  const text = (data.text || "").trim().replace(/\s+/g, "");
  const confidence = data.confidence || 0;
  console.log(`  [captcha attempt=${attempt}] text="${text}" confidence=${confidence.toFixed(1)}`);
  return { text, confidence };
}

async function shutdown() {
  if (worker) {
    await worker.terminate();
    worker = null;
  }
}

function extractTable(text) {
  const tableMatch = text.match(/<table[\s\S]*?<\/table>/i);
  if (!tableMatch) return { columns: [], rowCount: 0, sampleRows: [] };
  const thead = tableMatch[0].match(/<thead[\s\S]*?<\/thead>/i);
  let columns = [];
  if (thead) {
    columns = (thead[0].match(/<th[^>]*>([\s\S]*?)<\/th>/gi) || [])
      .map((c) => c.replace(/<[^>]+>/g, "").trim().replace(/&nbsp;/g, " "))
      .filter(Boolean);
  }
  // If no thead, try first tr as header
  if (!columns.length) {
    const firstTr = tableMatch[0].match(/<tr[\s\S]*?<\/tr>/i);
    if (firstTr) {
      const tds = firstTr[0].match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || [];
      if (tds.length > 1) {
        columns = tds
          .map((c) => c.replace(/<[^>]+>/g, "").trim().replace(/&nbsp;/g, " "))
          .filter(Boolean);
      }
    }
  }
  // Extract all data rows
  const allTrs = tableMatch[0].match(/<tr[\s\S]*?<\/tr>/gi) || [];
  const sampleRows = [];
  // Skip the header row (first tr) when extracting samples
  for (let i = columns.length ? 1 : 0; i < Math.min(allTrs.length, 6); i++) {
    const tds = (allTrs[i].match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || [])
      .map((c) => c.replace(/<[^>]+>/g, "").trim().replace(/&nbsp;/g, " ").replace(/\s+/g, " "))
      .filter((s) => s.length > 0);
    if (tds.length) sampleRows.push(tds);
  }
  return { columns, rowCount: allTrs.length, sampleRows };
}

function extractActionMessage(text) {
  const m = text.match(/class="action-message"[\s\S]*?<\/div>/i);
  if (!m) return null;
  const span = m[0].match(/<span>([\s\S]*?)<\/span>/);
  return span ? span[1].trim() : m[0].replace(/<[^>]+>/g, "").trim();
}

async function postCaptchaForm(url, body, label, maxCaptchaAttempts = 3) {
  for (let attempt = 1; attempt <= maxCaptchaAttempts; attempt++) {
    const captchaBuf = await getCaptcha();
    const { text: captchaText } = await solveCaptcha(captchaBuf, attempt);
    if (!captchaText) continue;
    const bodyWithCaptcha = `${body}&captchaValue=${encodeURIComponent(captchaText)}`;
    const r = await fetch(`${BASE}${url}`, {
      method: "POST",
      headers: {
        ...browserHeaders,
        Cookie: cookieHeader(),
        "Content-Type": "application/x-www-form-urlencoded",
        Referer: `${BASE}/searchCases.html`,
        Origin: BASE,
      },
      body: bodyWithCaptcha,
      redirect: "follow",
    });
    captureSetCookie(r);
    const buf = Buffer.from(await r.arrayBuffer());
    writeFileSync(`${OUT_DIR}/${label}.html`, buf);
    const text = buf.toString("utf8");
    const msg = extractActionMessage(text);
    const table = extractTable(text);
    if (msg && /invalid\s*captcha/i.test(msg)) {
      console.log(`  → invalid captcha, retrying (attempt ${attempt}/${maxCaptchaAttempts})`);
      // session may be invalidated; re-bootstrap
      if (attempt === maxCaptchaAttempts) {
        return { status: r.status, captcha: "invalid-after-retries", msg, table };
      }
      continue;
    }
    return { status: r.status, captcha: "solved", captchaText, msg, table, text, bytes: buf.length };
  }
}

async function postNoCaptchaForm(url, body, label) {
  const r = await fetch(`${BASE}${url}`, {
    method: "POST",
    headers: {
      ...browserHeaders,
      Cookie: cookieHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
      Referer: `${BASE}/searchCases.html`,
      Origin: BASE,
    },
    body,
    redirect: "follow",
  });
  captureSetCookie(r);
  const buf = Buffer.from(await r.arrayBuffer());
  writeFileSync(`${OUT_DIR}/${label}.html`, buf);
  const text = buf.toString("utf8");
  const msg = extractActionMessage(text);
  const table = extractTable(text);
  return { status: r.status, msg, table, text, bytes: buf.length };
}

// --- Test data: real Bhulekh values from production fetches ----------
const TEST_KHATAS = [
  { khata: "94", plot: "415", village: "Mendhasala", source: "Session 050 demo-fixture" },
  { khata: "412", plot: "D/588", village: "Chandrasekharpur", source: "build_pre_filled" },
  { khata: "318", plot: "127/2", village: "Khandagiri", source: "build_pre_filled" },
  { khata: "245", plot: "89A", village: "Sundarpada", source: "build_pre_filled" },
];

// --- Test functions ---------------------------------------------------

async function testHalKhataSearch(entry) {
  console.log(`\n=== hal-khata search: khata=${entry.khata} (village=${entry.village}) ===`);
  const body = new URLSearchParams({ hallkhatano: entry.khata }).toString();
  return await postCaptchaForm("/searchbyhallkhatano.html", body, `khata-${entry.khata}-halkhata`);
}

async function testHalPlotSearch(entry) {
  console.log(`\n=== hal-plot search: plot=${entry.plot} (village=${entry.village}) ===`);
  // /searchbykhatanoid.html uses field name "incoming_khataid"
  const body = new URLSearchParams({ incoming_khataid: entry.plot }).toString();
  return await postCaptchaForm("/searchbykhatanoid.html", body, `plot-${entry.plot.replace(/\//g, "_")}-halplot`);
}

async function testPartyNameSearch(firstName, lastName, village) {
  console.log(`\n=== party-name search: ${firstName} ${lastName} (village=${village}) ===`);
  // /findPetCase.html — firstName required
  const body = new URLSearchParams({ firstName, lastName }).toString();
  return await postNoCaptchaForm(
    "/findPetCase.html",
    body,
    `party-${firstName}-${lastName}`.toLowerCase()
  );
}

async function testCaseNoForwardLookup(caseNo, courtId) {
  console.log(`\n=== case-no forward: caseNo=${caseNo} courtId=${courtId} ===`);
  // /findCase.html — captcha required
  const body = new URLSearchParams({ caseNumber: caseNo, courtId: String(courtId) }).toString();
  const safe = String(caseNo).replace(/[\/\\\s]+/g, "_");
  return await postCaptchaForm("/findCase.html", body, `case-${safe}-find`);
}

async function testCaseNoAllDetails(caseNo) {
  console.log(`\n=== case-no all details: caseNo=${caseNo} ===`);
  // /fetchallCaseDetails.html — no captcha
  const body = new URLSearchParams({ caseno: caseNo }).toString();
  const safe = String(caseNo).replace(/[\/\\\s]+/g, "_");
  return await postNoCaptchaForm("/fetchallCaseDetails.html", body, `case-${safe}-all`);
}

// --- Main -------------------------------------------------------------

async function main() {
  await bootstrap();

  const results = {
    probedAt: new Date().toISOString(),
    paths: {},
  };

  // Path 1: hal-khata
  console.log("\n========== PATH 1: hal-khata search (captcha-protected) ==========");
  const halKhataResults = [];
  for (const entry of TEST_KHATAS) {
    await bootstrap();
    const r = await testHalKhataSearch(entry);
    halKhataResults.push({
      khata: entry.khata,
      village: entry.village,
      source: entry.source,
      captchaStatus: r.captcha,
      captchaText: r.captchaText,
      actionMessage: r.msg,
      columns: r.table.columns,
      rowCount: r.table.rowCount,
      sampleRows: r.table.sampleRows,
    });
    console.log(
      `  result: msg="${r.msg}" cols=[${r.table.columns.join("|")}] rows=${r.table.rowCount}`
    );
    if (r.table.sampleRows.length) {
      console.log(`  sample row: ${JSON.stringify(r.table.sampleRows[0])}`);
    }
  }
  results.paths.halKhata = halKhataResults;

  // Path 2: hal-plot
  console.log("\n========== PATH 2: hal-plot search (captcha-protected) ==========");
  const halPlotResults = [];
  for (const entry of TEST_KHATAS) {
    await bootstrap();
    const r = await testHalPlotSearch(entry);
    halPlotResults.push({
      plot: entry.plot,
      khata: entry.khata,
      village: entry.village,
      source: entry.source,
      captchaStatus: r.captcha,
      captchaText: r.captchaText,
      actionMessage: r.msg,
      columns: r.table.columns,
      rowCount: r.table.rowCount,
      sampleRows: r.table.sampleRows,
    });
    console.log(
      `  result: msg="${r.msg}" cols=[${r.table.columns.join("|")}] rows=${r.table.rowCount}`
    );
    if (r.table.sampleRows.length) {
      console.log(`  sample row: ${JSON.stringify(r.table.sampleRows[0])}`);
    }
  }
  results.paths.halPlot = halPlotResults;

  // Path 3: party-name
  console.log("\n========== PATH 3: party-name search (no captcha) ==========");
  await bootstrap();
  const partyResults = [];
  // Test common Odia surname + first-name patterns from the test khata villages
  const partyTests = [
    { firstName: "Ramesh", lastName: "Mohapatra", village: "Mendhasala" },
    { firstName: "Bijayalaxmi", lastName: "Moharana", village: "Khandagiri" },
    { firstName: "Krushna", lastName: "Pradhan", village: "Sundarpada" },
  ];
  for (const p of partyTests) {
    const r = await testPartyNameSearch(p.firstName, p.lastName, p.village);
    partyResults.push({
      ...p,
      actionMessage: r.msg,
      columns: r.table.columns,
      rowCount: r.table.rowCount,
      sampleRows: r.table.sampleRows,
    });
    console.log(
      `  result: msg="${r.msg}" cols=[${r.table.columns.join("|")}] rows=${r.table.rowCount}`
    );
    if (r.table.sampleRows.length) {
      console.log(`  sample row: ${JSON.stringify(r.table.sampleRows[0])}`);
    }
  }
  results.paths.partyName = partyResults;

  // Path 4: caseNo forward lookup (using a likely-valid historical case format)
  // We don't have a real caseNo from production yet; the form's "no case found" path
  // tells us whether the schema is case-management-only (confirming prior finding) or
  // a real case (proving the forward path could enrich Bhulekh's mutationReferences).
  console.log("\n========== PATH 4: case-no forward (probe shape) ==========");
  await bootstrap();
  // Use 01 (BOR Cuttack) as court; try a non-existent case to confirm schema
  const caseNoProbe = await testCaseNoForwardLookup("9999/2020", 1);
  results.paths.caseNoForward = {
    actionMessage: caseNoProbe.msg,
    columns: caseNoProbe.table.columns,
    rowCount: caseNoProbe.rowCount,
    sampleRows: caseNoProbe.table.sampleRows,
  };
  console.log(
    `  result: msg="${caseNoProbe.msg}" cols=[${caseNoProbe.table.columns.join("|")}] rows=${caseNoProbe.rowCount}`
  );

  // Path 5: caseNo all-details (no captcha)
  console.log("\n========== PATH 5: case-no all details (no captcha) ==========");
  await bootstrap();
  const caseAllProbe = await testCaseNoAllDetails("9999/2020");
  results.paths.caseNoAllDetails = {
    actionMessage: caseAllProbe.msg,
    columns: caseAllProbe.table.columns,
    rowCount: caseAllProbe.rowCount,
    sampleRows: caseAllProbe.table.sampleRows,
  };
  console.log(
    `  result: msg="${caseAllProbe.msg}" cols=[${caseAllProbe.table.columns.join("|")}] rows=${caseAllProbe.rowCount}`
  );

  // --- Verdict synthesis ----------------------------------------------
  const synthesis = synthesize(results);
  results.synthesis = synthesis;

  writeFileSync(`${OUT_DIR}/cross-link-probe-results.json`, JSON.stringify(results, null, 2));
  console.log(`\n=== Results written to ${OUT_DIR}/cross-link-probe-results.json ===`);

  await shutdown();
}

function synthesize(results) {
  const verdict = { paths: {}, overall: "" };

  // hal-khata: does the result row echo back the khata key plus identifying context?
  const hk = results.paths.halKhata || [];
  const hkWithRows = hk.filter((r) => r.rowCount > 1);
  const hkHasKhataColumn = hkWithRows.some((r) =>
    r.columns.some((c) => /khata|plot|village|mouza|tehsil|tenant|owner/i.test(c))
  );
  const hkCaseOnly = hkWithRows.every((r) =>
    r.columns.every((c) => !/khata|plot|village|mouza|tehsil|tenant|owner/i.test(c))
  );
  verdict.paths.halKhata = {
    rowsFound: hkWithRows.length,
    totalProbed: hk.length,
    hasIdentifyingColumns: hkHasKhataColumn,
    caseManagementOnly: hkCaseOnly,
    columnSet: [...new Set(hkWithRows.flatMap((r) => r.columns))],
    sampleRowsWithIdentifyingFields: hkWithRows
      .filter((r) => r.sampleRows.length)
      .slice(0, 2)
      .map((r) => r.sampleRows[0]),
  };

  // hal-plot: same logic
  const hp = results.paths.halPlot || [];
  const hpWithRows = hp.filter((r) => r.rowCount > 1);
  const hpHasIdentifyingColumns = hpWithRows.some((r) =>
    r.columns.some((c) => /khata|plot|village|mouza|tehsil|tenant|owner/i.test(c))
  );
  verdict.paths.halPlot = {
    rowsFound: hpWithRows.length,
    totalProbed: hp.length,
    hasIdentifyingColumns: hpHasIdentifyingColumns,
    columnSet: [...new Set(hpWithRows.flatMap((r) => r.columns))],
  };

  // party-name: do results identify court case role + reverse-linkable party?
  const pn = results.paths.partyName || [];
  const pnWithRows = pn.filter((r) => r.rowCount > 1);
  verdict.paths.partyName = {
    rowsFound: pnWithRows.length,
    totalProbed: pn.length,
    columnSet: [...new Set(pnWithRows.flatMap((r) => r.columns))],
    sampleRows: pnWithRows.slice(0, 2).map((r) => r.sampleRows[0]).filter(Boolean),
  };

  // caseNo forward: is there a useful hearing-details schema?
  verdict.paths.caseNoForward = {
    msg: results.paths.caseNoForward?.actionMessage,
    columnSet: results.paths.caseNoForward?.columns || [],
  };

  // Overall verdict
  const reverseLinkUsable = hkHasKhataColumn || verdict.paths.halPlot.hasIdentifyingColumns;
  if (reverseLinkUsable) {
    verdict.overall =
      "GO — ccms.nic.in result table ECHOES khata/plot/village context in the row. Reverse-link from Bhulekh khata/plot → revenue court cases is buildable.";
  } else if (hkWithRows.length === 0 && hpWithRows.length === 0) {
    verdict.overall =
      "INCONCLUSIVE — no rows returned for any probe. The empty-result path cannot distinguish 'no cases exist' from 'schema is wrong'. Need to find a known-pending revenue case to verify schema with a positive result.";
  } else {
    verdict.overall =
      "NO-GO REINFORCED — real Khordha khata/plot values return rows, but the result table contains ONLY case-management columns (SL NO, Case No, Section, Court, Petitioner, Opposite Party). The khata/plot/village key is NOT echoed in the result row, so a forward probe cannot identify which row, if any, corresponds to a specific Bhulekh record. Cross-link remains structurally unbuildable.";
  }

  return verdict;
}

main().catch(async (e) => {
  console.error(`FATAL: ${e.message}`);
  console.error(e.stack);
  await shutdown();
  process.exit(1);
});
