/**
 * ClearDeed Production-Grade Test Suite Runner
 *
 * This script iterates through all test cases defined in `testing/cases/`,
 * runs the full `generateReport` pipeline for each, and compares the output
 * against the "golden" fixture defined in the test case file.
 */

import fs from "fs/promises";
import path from "path";
import { generateReport, type PipelineInput } from "../apps/web/src/lib/pipeline";
import { JSDOM } from "jsdom";
import diff from "jest-diff";

const CASES_DIR = path.resolve(__dirname, "../testing/cases");

interface TestCase {
  caseId: string;
  description: string;
  input: PipelineInput;
  goldenOutput: {
    owner?: {
      nameMatch?: "exact" | "partial" | "mismatch" | "unknown";
      transliteratedName?: string;
      coOwnersCount?: number;
    };
    land?: {
      classification?: string;
    };
    regulatory?: {
      flagsCount?: number;
      flagTypes?: string[];
    };
  };
}

async function runSuite() {
  console.log("🚀 Starting ClearDeed Production Test Suite...");
  const caseFiles = (await fs.readdir(CASES_DIR)).filter(f => f.endsWith(".json"));
  const results = [];

  for (const caseFile of caseFiles) {
    const caseContent = await fs.readFile(path.join(CASES_DIR, caseFile), "utf-8");
    const testCase = JSON.parse(caseContent) as TestCase;
    console.log(`\n🧪 Running test case: ${testCase.caseId} - ${testCase.description}`);

    try {
      const output = await generateReport(testCase.input);
      const dom = new JSDOM(output.html);
      const document = dom.window.document;

      // Extract actual data from the generated HTML report
      const actual = {
        owner: {
          nameMatch: document.querySelector("#section-owner .status-badge")?.textContent?.trim().toLowerCase().includes("mismatch") ? "mismatch" :
                     document.querySelector("#section-owner .status-badge")?.textContent?.trim().toLowerCase().includes("partial") ? "partial" :
                     document.querySelector("#section-owner .status-badge")?.textContent?.trim().toLowerCase().includes("match") ? "exact" : "unknown",
          coOwnersCount: document.querySelectorAll(".tenant-table tbody tr").length - 1,
        },
        land: {
          classification: document.querySelector(".classification-type")?.textContent?.trim(),
        },
        regulatory: {
          flagsCount: document.querySelectorAll("#section-regulatory .warning-notice, #section-regulatory .info-notice").length,
          flagTypes: Array.from(document.querySelectorAll("#section-regulatory [class*='-notice'] strong")).map(el => el.textContent?.replace(/\[|\]|Warning|Info/gi, "").trim()),
        },
      };

      // Compare actual vs golden
      const diffResult = diff(testCase.goldenOutput, actual, {
        expand: false,
        contextLines: 1,
      });

      const hasDiff = diffResult && !diffResult.includes("Compared values have no visual difference.");

      if (hasDiff) {
        console.error(`❌ FAILED: ${testCase.caseId}`);
        console.log(diffResult);
        results.push({ id: testCase.caseId, status: "failed" });
      } else {
        console.log(`✅ PASSED: ${testCase.caseId}`);
        results.push({ id: testCase.caseId, status: "passed" });
      }
    } catch (error) {
      console.error(`💥 ERROR during test case ${testCase.caseId}:`, error);
      results.push({ id: testCase.caseId, status: "error" });
    }
  }

  // --- Summary ---
  console.log("\n\n--- Test Suite Summary ---");
  const passed = results.filter(r => r.status === "passed").length;
  const failed = results.filter(r => r.status === "failed").length;
  const errored = results.filter(r => r.status === "error").length;

  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`💥 Errored: ${errored}`);
  console.log("--------------------------");

  if (failed > 0 || errored > 0) {
    console.log("\nSome tests failed. Please review the logs above.");
    process.exit(1);
  } else {
    console.log("\nAll tests passed successfully!");
    process.exit(0);
  }
}

runSuite().catch(err => {
  console.error("Unhandled error in test suite runner:", err);
  process.exit(1);
});