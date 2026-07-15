// scripts/probe/court-disposition-probe.mjs — minimal reachability probe
// for the three PI-2 Track A court fetchers.
//
// Why this script instead of the existing measure-captcha-rate.mjs:
//   - The ecourts captcha probe uses Playwright + Tesseract, takes minutes per
//     run, and assumes the portal is at least reachable enough to render an
//     HTML form. The 2026-06-19 probe found the legacy V6 portal stuck in
//     an infinite 302 chain that Chromium times out at.
//   - High Court / DRT have no documented live-validation history. Before
//     scheduling a 10-run captcha-rate probe (or applying the NO-GO stamp),
//     we need a fast yes/no answer to "is the base URL reachable today".
//   - A 30s fetch-then-redirect-follow loop simulates browser behaviour for
//     up to 20 hops without the overhead of launching Chromium.
//
// Output: stdout JSON per fetcher + a written fixture under
//   qa/fetcher_tests/court-disposition-probe-{DATE}.json
//
// Read-only. No fetcher or orchestrator code is modified.

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = resolve(__dirname, "../fixtures/court-probes");
mkdirSync(FIXTURE_DIR, { recursive: true });

const NOW = new Date().toISOString();
const DATE_STAMP = new Date().toISOString().slice(0, 10);

const TARGETS = [
  {
    id: "ecourts-legacy-v6",
    url: "https://services.ecourts.gov.in/ecourtindia_v6/?p=casestatus/index",
    fetcher: "packages/fetchers/ecourts",
    note: "Known broken since 2026-06-19 (infinite 302 redirect chain). Re-validated today.",
  },
  {
    id: "ecourts-sso-2.0",
    url: "https://ecourts.gov.in/",
    fetcher: "packages/fetchers/ecourts",
    note: "Confirmed reachable 2026-06-19 (HTTP 200). Migration target. Re-validated today.",
  },
  {
    id: "high-court-orissa",
    url: "https://hcservices.ecourts.gov.in/ecourtindiaHC/cases/ki_petres.php?state_cd=11&dist_cd=1&court_code=1&stateNm=Odisha",
    fetcher: "packages/fetchers/high-court",
    note: "Same domain as broken district eCourts. Inheritance assumption — validated today.",
  },
  {
    id: "drt-cuttack-cis",
    url: "https://cis.drt.gov.in/drtlive/order/page1_advocate.php",
    fetcher: "packages/fetchers/drt",
    note: "Different host (cis.drt.gov.in). No prior live-validation history — probed today.",
  },
];

// Helper: fetch a URL with timeout + bounded redirect chain.
async function probe(url) {
  const maxHops = 20;
  const visited = [];
  let currentUrl = url;
  let content = null;
  try {
    for (let hop = 0; hop < maxHops; hop++) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 15_000);
      let r;
      try {
        r = await globalThis.fetch(currentUrl, {
          method: "GET",
          redirect: "manual",
          signal: ctrl.signal,
          headers: { "User-Agent": "ClearDeed/1.0 (court-disposition-probe)" },
        });
      } finally {
        clearTimeout(timer);
      }
      visited.push({ hop, url: currentUrl, status: r.status, location: r.headers.get("location") ?? null });
      // Follow 302/301 manually.
      if (r.status === 301 || r.status === 302 || r.status === 303 || r.status === 307 || r.status === 308) {
        const next = r.headers.get("location");
        if (!next) {
          return { outcome: "redirect_with_no_location", visited };
        }
        // Convert relative → absolute.
        currentUrl = next.startsWith("http") ? next : new URL(next, currentUrl).toString();
        content = null;
        continue;
      }
      // Capture body for 200s, snippet only.
      if (r.ok) {
        const txt = await r.text();
        content = txt.slice(0, 1024);
        visited[visited.length - 1].bodySnippet = content;
        return { outcome: r.status, visited };
      }
      // Non-redirect non-200.
      return { outcome: r.status, visited };
    }
    return { outcome: "redirect_loop", visited };
  } catch (err) {
    return { outcome: err?.name === "AbortError" ? "timeout" : "fetch_error", error: err?.message, visited };
  }
}

async function main() {
  const runResults = [];
  for (const tgt of TARGETS) {
    process.stdout.write(`[${tgt.id}] probing ${tgt.url}\n`);
    const t0 = Date.now();
    const res = await probe(tgt.url);
    const ms = Date.now() - t0;
    runResults.push({
      id: tgt.id,
      url: tgt.url,
      fetcher: tgt.fetcher,
      probedAt: NOW,
      durationMs: ms,
      outcome: res.outcome,
      hops: res.visited.length,
      finalStatus: res.visited.at(-1)?.status ?? null,
      hasBody: Boolean(res.visited.at(-1)?.bodySnippet),
      visited: res.visited,
      note: tgt.note,
    });
    process.stdout.write(`  outcome=${res.outcome} final=${res.visited.at(-1)?.status ?? "-"} hops=${res.visited.length} ms=${ms}\n`);
  }

  // Summary verdict per target.
  const summary = runResults.map((r) => {
    let verdict = "inconclusive";
    if (r.outcome === 200) verdict = "reachable";
    if (r.outcome === "redirect_loop") verdict = "infinite_redirect_NO_GO";
    if (r.outcome === "timeout") verdict = "timeout";
    if (r.outcome === "fetch_error") verdict = "fetch_error";
    if (r.finalStatus && r.finalStatus >= 400 && r.finalStatus < 500) verdict = `http_${r.finalStatus}`;
    if (r.finalStatus && r.finalStatus >= 500) verdict = "server_error";
    return { id: r.id, outcome: r.outcome, verdict };
  });

  const fixture = {
    schemaVersion: 1,
    probedAt: NOW,
    dateStamp: DATE_STAMP,
    targets: TARGETS.map((t) => ({ id: t.id, fetcher: t.fetcher, note: t.note })),
    runs: runResults,
    summary,
  };

  const outPath = resolve(FIXTURE_DIR, `court-disposition-probe-${DATE_STAMP}.json`);
  writeFileSync(outPath, JSON.stringify(fixture, null, 2));
  process.stdout.write(`\nFixture written: ${outPath}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
