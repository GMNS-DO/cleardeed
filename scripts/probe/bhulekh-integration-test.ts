/**
 * Bhulekh Integration Test — verify the fetcher returns RoR data
 *
 * Run: npx tsx scripts/probe/bhulekh-integration-test.ts
 */

import { bhulekhFetch } from "../packages/fetchers/bhulekh/src/index.ts";

async function run() {
  console.log("Testing Bhulekh fetcher for Mendhasala plot 128...");

  const result = await bhulekhFetch({
    village: "Mendhasala",
    plotNo: "128",
  });

  console.log("\nResult:");
  console.log(JSON.stringify(result, null, 2));
}

run().catch(console.error);
