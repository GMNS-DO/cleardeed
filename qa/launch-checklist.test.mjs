/**
 * qa/launch-checklist.test.mjs — schema test for the launch-checklist script
 *
 * Verifies the script is well-formed and the 8 checks are present.
 * The actual launch-checklist run requires a fully-set-up environment.
 */
import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(__dirname, "launch-checklist.mjs");

describe("launch-checklist.mjs", () => {
  it("is syntactically valid", () => {
    const proc = spawnSync("node", ["--check", SCRIPT], { encoding: "utf8" });
    expect(proc.status).toBe(0);
  });

  it("defines all 8 launch checks per A.5.4", () => {
    const src = fs.readFileSync(SCRIPT, "utf8");
    const expected = [
      "Check 1: 1506/1506 tests pass",
      "Check 2: Map renders on all devices",
      "Check 3: 9 sources return data",
      "Check 4: PDF <10s p95",
      "Check 5: Email <2min p95",
      "Check 6: trackError captures",
      "Check 7: Staging + production",
      "Check 8: Founder executed full buyer journey",
    ];
    for (const label of expected) {
      expect(src, `should include ${label}`).toContain(label);
    }
  });
});
