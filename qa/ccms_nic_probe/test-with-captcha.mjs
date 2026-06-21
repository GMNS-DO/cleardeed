#!/usr/bin/env node
// Run hal-khata search with a real captcha solve.
// Tests whether the captcha can be solved and whether the result table
// exposes plot/khata/village columns.

import { writeFileSync } from "node:fs";
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

let cookieJar = {};

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

async function bootstrap() {
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
  console.log(
    `[bootstrap] session=${Object.keys(cookieJar).join(",")} url=${r2.url}`
  );
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
  const buf = Buffer.from(await r.arrayBuffer());
  writeFileSync("/tmp/ccms-probe/09-captcha-latest.jpg", buf);
  return buf;
}

async function solveCaptcha(buf, attempt) {
  const worker = await createWorker("eng");
  const { data } = await worker.recognize(buf);
  await worker.terminate();
  const text = (data.text || "").trim().replace(/\s+/g, "");
  const confidence = data.confidence || 0;
  console.log(
    `[captcha attempt=${attempt}] text="${text}" confidence=${confidence.toFixed(1)}`
  );
  return { text, confidence };
}

async function postHalKhata(halKhataNo, captchaText, label) {
  const body = new URLSearchParams({
    hallkhatano: halKhataNo,
    captchaValue: captchaText,
  }).toString();
  const r = await fetch(`${BASE}/searchbyhallkhatano.html`, {
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
  writeFileSync(`/tmp/ccms-probe/${label}.html`, buf);
  const text = buf.toString("utf8");
  const tableMatch = text.match(/<table[\s\S]*?<\/table>/i);
  const actionMessage = text.match(/class="action-message"[\s\S]*?<\/div>/i);
  let cols = [];
  let rowCount = 0;
  if (tableMatch) {
    const thead = tableMatch[0].match(/<thead[\s\S]*?<\/thead>/i);
    if (thead) {
      cols = (thead[0].match(/<th[^>]*>([\s\S]*?)<\/th>/gi) || [])
        .map((c) => c.replace(/<[^>]+>/g, "").trim().replace(/&nbsp;/g, " "))
        .filter(Boolean);
    }
    const trs = tableMatch[0].match(/<tr[\s\S]*?<\/tr>/gi) || [];
    rowCount = trs.length;
  }
  console.log(
    `[${label}] status=${r.status} bytes=${buf.length} cols=${cols.join("|") || "(none)"} rows=${rowCount}`
  );
  if (actionMessage) {
    const msg = (actionMessage[0].match(/<span>([\s\S]*?)<\/span>/) || [])[1];
    console.log(`  message: ${msg}`);
  }
  if (cols.length) {
    console.log(`  COLUMNS: ${cols.join(" | ")}`);
  }
  return { status: r.status, cols, rowCount, actionMessage: actionMessage && actionMessage[0], text };
}

async function main() {
  await bootstrap();

  // Try hal-khata search with captcha-solved payload. Use a clearly non-existent value.
  for (let attempt = 1; attempt <= 3; attempt++) {
    const captchaBuf = await getCaptcha();
    const { text } = await solveCaptcha(captchaBuf, attempt);
    if (!text) continue;
    const r = await postHalKhata("0000/0000", text, `10-halkhata-attempt-${attempt}`);
    // If invalid captcha, retry. If "no record" or empty table, that's our answer.
    if (r.actionMessage && /no\s*record|no\s*data|not\s*found/i.test(r.actionMessage)) {
      console.log(`  → "no records" path observed, schema confirmed empty result`);
      break;
    }
    if (r.actionMessage && /invalid\s*captcha/i.test(r.actionMessage)) {
      console.log(`  → invalid captcha, retrying with fresh image...`);
      // session may be invalidated; re-bootstrap
      if (attempt === 3) break;
      continue;
    }
    if (r.cols.length) break;
  }
}

main().catch((e) => {
  console.error(`FATAL: ${e.message}`);
  console.error(e.stack);
  process.exit(1);
});
