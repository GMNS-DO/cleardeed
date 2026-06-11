/**
 * Test script: directly call pregenerate endpoint to trace data flow
 * Usage: npx tsx scripts/test-pregenerate.ts
 */
import fetch from "node-fetch";

const TEST_PARAMS = {
  tehsil: "Bhubaneswar",
  tehsilValue: "2",
  village: "Mendhasala",
  villageCode: "105",
  searchMode: "Plot",
  identifier: "128",
};

async function test() {
  console.info("Testing pregenerate with params:", TEST_PARAMS);
  const start = Date.now();

  try {
    const response = await fetch("http://localhost:3000/api/report/pregenerate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(TEST_PARAMS),
    });

    const data = await response.json() as any;
    const elapsed = Date.now() - start;

    console.info("\n=== PREGENERATE RESULT ===");
    console.info(`Status: ${response.status}`);
    console.info(`Time: ${elapsed}ms`);
    console.info(`reportId: ${data.reportId}`);
    console.info(`response status: ${data.status}`);
    console.info(`error: ${data.error}`);
    console.info(`HTML length: ${data.html?.length ?? 0}`);

    if (data.html) {
      // Extract key fields from HTML to verify
      const hasOwnerSection = data.html.includes("The Owner");
      const hasBhulekhRoR = data.html.includes("Bhulekh RoR");
      const hasKhatiyan = data.html.includes("Khatiyan");
      const hasPlotSection = data.html.includes("The Plot");
      const hasTenantTable = data.html.includes("tenant-table");
      const hasLandClass = data.html.includes("Land Classification");

      console.info("\n=== REPORT SECTIONS ===");
      console.info("Owner section:", hasOwnerSection);
      console.info("Bhulekh RoR mention:", hasBhulekhRoR);
      console.info("Khatiyan mention:", hasKhatiyan);
      console.info("Plot section:", hasPlotSection);
      console.info("Tenant table:", hasTenantTable);
      console.info("Land Classification:", hasLandClass);

      // Extract sample tenant rows
      const tenantRowMatch = data.html.match(/<tbody>[\s\S]*?<\/tbody>/);
      if (tenantRowMatch) {
        console.info("\n=== TENANT TABLE ===");
        console.info(tenantRowMatch[0].slice(0, 2000));
      }

      // Check for empty/null fields
      const emptyFieldPatterns = [
        /td>\s*—\s*<\/td>/g,
        /No tenant records/g,
        /Owner block could not be read/g,
      ];
      let emptyCount = 0;
      for (const pattern of emptyFieldPatterns) {
        emptyCount += (data.html.match(pattern) || []).length;
      }
      console.info(`\n=== EMPTY FIELD INDICATORS ===`);
      console.info(`Empty/missing field indicators: ${emptyCount}`);
    }
  } catch (err) {
    console.error("Test failed:", err);
  }
}

test();