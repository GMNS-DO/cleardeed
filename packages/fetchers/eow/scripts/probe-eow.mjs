#!/usr/bin/env node
/**
 * EOW Odisha live-site probe.
 *
 * Walks the candidate EOW endpoints (eowodisha.gov.in, eow.odisha.gov.in,
 * eowodisha.nic.in) and for each one tries the press-release listing paths
 * (/press-release, /news, /notices, etc.). For every reachable URL, the
 * raw HTML is saved under fixtures/ and the failure mode for every
 * unreachable URL is recorded in fixtures/probe-result.json.
 *
 * Exit code:
 *   0 — at least one press release HTML was captured OR a structured
 *       offline status was written to fixtures/probe-result.json
 *   1 — write failure (filesystem permission, etc.)
 *
 * Usage:
 *   node scripts/probe-eow.mjs                # try all endpoints
 *   node scripts/probe-eow.mjs --dry-run      # log only, no fetches
 *   node scripts/probe-eow.mjs --max-bytes N  # cap each response (default 5 MiB)
 */

import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PACKAGE_ROOT = join(__dirname, "..");
const FIXTURES_DIR = join(PACKAGE_ROOT, "fixtures");

const BASE_URLS = [
  "https://eowodisha.gov.in",
  "https://eow.odisha.gov.in",
  "https://eowodisha.nic.in",
];
const PRESS_PATHS = [
  "/press-release",
  "/press-release.html",
  "/press_releases",
  "/news",
  "/news.html",
  "/notices",
  "/media",
  "/",
];
const USER_AGENT =
  "Mozilla/5.0 (compatible; ClearDeed/1.0; +https://cleardeed.in) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

const argv = process.argv.slice(2);
const DRY_RUN = argv.includes("--dry-run");
const maxBytesArg = argv.find((a) => a.startsWith("--max-bytes="));
const MAX_BYTES = maxBytesArg
  ? Number.parseInt(maxBytesArg.split("=")[1], 10)
  : 5 * 1024 * 1024;

if (!existsSync(FIXTURES_DIR)) {
  mkdirSync(FIXTURES_DIR, { recursive: true });
}

function log(...args) {
  // eslint-disable-next-line no-console
  console.log("[probe-eow]", ...args);
}

function classifyFetchError(err) {
  // Node 22 fetch wraps the real error in err.cause — we have to walk the
  // chain to find the underlying ENOTFOUND / ETIMEDOUT / etc. code.
  let code = "";
  let msg = "";
  let node = err;
  while (node) {
    if (node.code) code = node.code;
    if (node.message) msg = node.message;
    if (!node.cause) break;
    node = node.cause;
  }
  if (!msg) msg = String(err);
  if (/ENOTFOUND|getaddrinfo|ENETUNREACH|EAI_AGAIN/i.test(code + " " + msg)) {
    return { kind: "dns_unresolvable", detail: msg, code: code || "ENOTFOUND" };
  }
  if (/ETIMEDOUT|aborted|AbortError/i.test(code + " " + msg)) {
    return { kind: "network_timeout", detail: msg, code: code || "ETIMEDOUT" };
  }
  if (/ECONNRESET/i.test(code)) {
    return { kind: "network_reset", detail: msg, code: "ECONNRESET" };
  }
  if (/ECONNREFUSED/i.test(code)) {
    return { kind: "connection_refused", detail: msg, code: "ECONNREFUSED" };
  }
  if (/certificate|TLS|SSL|ERR_CERT/i.test(msg)) {
    return { kind: "tls_error", detail: msg, code: code || "TLS_ERROR" };
  }
  return { kind: "unknown", detail: msg, code: code || "UNKNOWN" };
}

async function tryFetch(url, timeoutMs = 12_000) {
  if (DRY_RUN) {
    return { ok: false, status: 0, error: "dry-run mode" };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENT,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.7",
        "Accept-Language": "en-IN,en;q=0.9,or;q=0.8",
      },
    });
    if (!res.ok) {
      return { ok: false, status: res.status, error: `HTTP ${res.status}` };
    }
    const reader = res.body?.getReader();
    if (!reader) {
      return { ok: false, status: res.status, error: "no response body" };
    }
    const chunks = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BYTES) {
        await reader.cancel();
        return {
          ok: false,
          status: res.status,
          error: `response exceeded ${MAX_BYTES} bytes`,
        };
      }
      chunks.push(value);
    }
    const buffer = Buffer.concat(chunks);
    return {
      ok: true,
      status: res.status,
      contentType: res.headers.get("content-type") || "",
      body: buffer.toString("utf-8"),
      bytes: buffer.byteLength,
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      error: classifyFetchError(err),
    };
  } finally {
    clearTimeout(timer);
  }
}

function looksLikePressReleaseIndex(html) {
  if (!html) return false;
  const lower = html.toLowerCase();
  return (
    /press\s*release/i.test(lower) ||
    /notification/i.test(lower) ||
    /attachment/i.test(lower)
  );
}

function looksLikePressReleaseArticle(html) {
  if (!html) return false;
  const lower = html.toLowerCase();
  return (
    /<h1/i.test(html) &&
    /(attachment|fir\s*no|opid\s*case|eow\s*p\.?s\.?\s*case)/i.test(lower)
  );
}

async function main() {
  const startedAt = new Date().toISOString();
  log(`starting at ${startedAt} (DRY_RUN=${DRY_RUN}, MAX_BYTES=${MAX_BYTES})`);

  const attempts = [];
  const captured = [];

  for (const base of BASE_URLS) {
    for (const path of PRESS_PATHS) {
      const url = `${base}${path}`;
      const result = await tryFetch(url);
      const record = {
        url,
        ok: result.ok,
        status: result.status,
        contentType: result.contentType ?? null,
        bytes: result.bytes ?? 0,
        error: result.error ?? null,
        looksLikePressRelease: result.ok
          ? looksLikePressReleaseIndex(result.body) ||
            looksLikePressReleaseArticle(result.body)
          : false,
        capturedAt: new Date().toISOString(),
      };
      attempts.push(record);
      if (result.ok) {
        const safePath = path === "/" ? "root" : path.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "");
        const fileName = `${new URL(base).hostname.replace(/\./g, "_")}__${safePath || "root"}.html`;
        const filePath = join(FIXTURES_DIR, fileName);
        try {
          writeFileSync(filePath, result.body, "utf-8");
          captured.push({ url, file: fileName, bytes: result.body.length });
          log(`captured ${url} -> ${fileName} (${result.body.length} bytes)`);
        } catch (err) {
          log(`failed to write ${filePath}: ${err.message}`);
        }
      } else {
        const errMsg =
          typeof result.error === "string"
            ? result.error
            : result.error
              ? `${result.error.kind}: ${result.error.detail}`
              : "unknown";
        log(`miss   ${url} (${errMsg})`);
      }
    }
  }

  const probeResult = {
    startedAt,
    finishedAt: new Date().toISOString(),
    dryRun: DRY_RUN,
    maxBytes: MAX_BYTES,
    userAgent: USER_AGENT,
    attempts,
    captured,
    summary: {
      endpointsProbed: attempts.length,
      endpointsReachable: attempts.filter((a) => a.ok).length,
      looksLikePressRelease: attempts.filter((a) => a.looksLikePressRelease).length,
      dnsUnresolvable: attempts.filter(
        (a) => !a.ok && a.error && a.error.kind === "dns_unresolvable"
      ).length,
      networkTimeout: attempts.filter(
        (a) => !a.ok && a.error && a.error.kind === "network_timeout"
      ).length,
    },
  };

  const probeFile = join(FIXTURES_DIR, "probe-result.json");
  writeFileSync(probeFile, JSON.stringify(probeResult, null, 2) + "\n", "utf-8");
  log(`wrote ${probeFile}`);
  log(
    `summary: reachable=${probeResult.summary.endpointsReachable}/${probeResult.summary.endpointsProbed} ` +
      `dns_unresolvable=${probeResult.summary.dnsUnresolvable} ` +
      `network_timeout=${probeResult.summary.networkTimeout} ` +
      `looks_like_pr=${probeResult.summary.looksLikePressRelease}`
  );

  // Success criterion: at least one reachable URL with content that looks
  // like a press release, OR a structured offline status recorded.
  if (
    probeResult.summary.looksLikePressRelease > 0 ||
    probeResult.summary.endpointsReachable > 0 ||
    DRY_RUN
  ) {
    process.exit(0);
  }
  // No reachable endpoints at all: still exit 0 because the structured
  // offline status was written; the parent session reads the file to
  // learn the failure mode.
  process.exit(0);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("[probe-eow] fatal:", err);
  process.exit(1);
});
