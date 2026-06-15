/**
 * Smoke test — fetch the Bhunaksha plot report for Mendhasala 181/10454.
 * Run with: npx tsx src/smoke-mendhasala.ts
 * Skips the Playwright screenshot pass to keep CI fast.
 */

import { bhunakshaPlotReportFetch } from "./index.js";

async function main() {
  const t0 = Date.now();
  const result = await bhunakshaPlotReportFetch({
    village: "Mendhasala",
    tahasil: "Bhubaneswar",
    plotNo: "181/10454",
    // Don't skip the Playwright path — the live page renders the data
    // client-side via AJAX to ../rest/ReportsOR/PlotReport, so plain HTTP
    // cannot see the data. The fetcher will use Playwright to render.
  });
  const elapsed = Date.now() - t0;
  console.log(`[smoke] elapsed ${elapsed}ms`);
  console.log(`[smoke] status: ${result.status}`);
  console.log(`[smoke] verification: ${result.verification}`);
  console.log(`[smoke] reason: ${result.statusReason ?? "(none)"}`);
  console.log(`[smoke] data.plotNo: ${result.data?.plotNo}`);
  console.log(`[smoke] data.khatiyanNo: ${result.data?.khatiyanNo}`);
  console.log(`[smoke] data.thana: ${result.data?.thana}`);
  console.log(`[smoke] data.thanaNo: ${result.data?.thanaNo}`);
  console.log(`[smoke] data.mouza: ${result.data?.mouza}`);
  console.log(`[smoke] data.tehsil: ${result.data?.tehsil}`);
  console.log(`[smoke] data.tehsilNo: ${result.data?.tehsilNo}`);
  console.log(`[smoke] data.district: ${result.data?.district}`);
  console.log(`[smoke] data.area: ${JSON.stringify(result.data?.area)}`);
  console.log(`[smoke] data.owner: ${JSON.stringify(result.data?.owner)}`);
  console.log(`[smoke] data.mapScale: ${result.data?.mapScale}`);
  console.log(`[smoke] data.gisCode: ${result.data?.gisCode}`);
  console.log(`[smoke] data.sourceUrl: ${result.data?.sourceUrl}`);
  console.log(
    `[smoke] data.mapImageBase64: ${
      result.data?.mapImageBase64
        ? `${result.data.mapImageBase64.length} bytes (${(
            result.data.mapImageBase64.length / 1024
          ).toFixed(1)} KB)`
        : "null"
    }`
  );
}

main().catch((err) => {
  console.error("[smoke] failed:", err);
  process.exit(1);
});
