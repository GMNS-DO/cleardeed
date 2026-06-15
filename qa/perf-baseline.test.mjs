/**
 * qa/perf-baseline.test.mjs — schema test for perf-baseline-results.json
 *
 * The actual perf measurement is in qa/perf-baseline.mjs and requires
 * a live base URL. This test verifies the JSON output schema is what
 * downstream tooling (the founder's perf-trend dashboard) can rely on.
 *
 * If the results file doesn't exist yet (no perf run has been done),
 * the test is a no-op. The founder should run `node qa/perf-baseline.mjs`
 * before each launch-week review to populate it.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RESULTS_PATH = path.join(__dirname, "perf-baseline-results.json");

describe("perf-baseline-results.json schema", () => {
  it("matches the expected shape (when the file exists)", () => {
    if (!fs.existsSync(RESULTS_PATH)) {
      // No run yet — that's OK, the file is generated on demand.
      return;
    }
    const results = JSON.parse(fs.readFileSync(RESULTS_PATH, "utf8"));
    expect(results.baseUrl).toMatch(/^https?:\/\//);
    expect(typeof results.ranAt).toBe("string");
    expect(results.sections).toHaveProperty("homePage");
    expect(results.sections).toHaveProperty("preview");
    expect(results.sections).toHaveProperty("reportCreate");
    for (const section of Object.values(results.sections)) {
      expect(section).toHaveProperty("n");
      expect(section).toHaveProperty("min");
      expect(section).toHaveProperty("max");
      expect(section).toHaveProperty("avg");
      expect(section).toHaveProperty("p50");
      expect(section).toHaveProperty("p95");
    }
    for (const summary of Object.values(results.summary)) {
      expect(summary).toHaveProperty("p95");
      expect(summary).toHaveProperty("target");
      expect(summary).toHaveProperty("pass");
      expect(typeof summary.pass).toBe("boolean");
    }
  });
});
