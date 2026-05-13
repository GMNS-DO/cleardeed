#!/usr/bin/env npx tsx
/**
 * Canary: Bhulekh HTTP session-replay fetch for Mendhasala + plot 128.
 * Run: pnpm dlx tsx scripts/canary-bhulekh-http.ts
 */
import { fetch as bhulekhFetch } from "@cleardeed/fetcher-bhulekh";
import { writeFileSync } from "fs";
import path from "path";

async function main() {
  console.log("Starting Bhulekh canary fetch: Mendhasala + plot 128\n");
  const result = await bhulekhFetch({ village: "Mendhasala", plotNo: "128" });

  console.log("\nResult:");
  console.log("  source:", result.source);
  console.log("  status:", result.status);
  console.log("  verification:", result.verification);
  if (result.error) console.log("  error:", result.error);

  if (result.data) {
    console.log("\n  Tenants:");
    for (const t of result.data.tenants) {
      console.log(`    - ${t.tenantName} (${t.fatherHusbandName ?? "no father"})`);
      console.log(`      surveyNo: ${t.surveyNo}, area: ${t.area} ${t.unit}, class: ${t.landClass}`);
    }
  }

  // Save raw response for debugging
  if (result.rawResponse) {
    writeFileSync(
      path.join(process.cwd(), "scripts", "probe", "bhulekh-canary-raw.html"),
      result.rawResponse
    );
    console.log("\nRaw response saved to scripts/probe/bhulekh-canary-raw.html");
  }

  // Save full result
  writeFileSync(
    path.join(process.cwd(), "scripts", "probe", "bhulekh-canary-result.json"),
    JSON.stringify(result, null, 2)
  );
  console.log("Full result saved to scripts/probe/bhulekh-canary-result.json");
}

main().catch(console.error);
