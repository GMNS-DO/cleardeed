#!/usr/bin/env node

/**
 * Sprint V4: CI summary writer
 *
 * Reads vitest JSON output files (qa/test_results.json, qa/gate_results.json)
 * and writes a Markdown summary to qa/ci_summary.md that the PR-comment step
 * posts to GitHub. Intentionally a single-purpose script: parse, format, write.
 *
 * Per CLAUDE.md §3, no generalized "test reporter" abstraction — this is the
 * one place we summarize for PR display, so the format lives here.
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const QA_DIR = __dirname;
const FILES = [
  { path: join(QA_DIR, "test_results.json"), label: "QA regression suite" },
  { path: join(QA_DIR, "gate_results.json"), label: "Pre-payment input gate (V4)" },
];

function summarizeVitestJson(file) {
  if (!existsSync(file.path)) {
    return { label: file.label, present: false };
  }
  let data;
  try {
    data = JSON.parse(readFileSync(file.path, "utf-8"));
  } catch (err) {
    return { label: file.label, present: true, error: `parse failed: ${err.message}` };
  }

  // Vitest JSON reporter (v4) puts results under numPassedTests, numFailedTests, etc.
  // Top-level startTime is an epoch ms; per-file endTime is also epoch ms.
  // Sum per-file durations if endTime is present, else fall back to (now - startTime).
  let durationMs = 0;
  if (Array.isArray(data.testResults)) {
    for (const f of data.testResults) {
      if (f?.startTime && f?.endTime) {
        durationMs += f.endTime - f.startTime;
      }
    }
  }
  if (durationMs === 0 && data.startTime) {
    durationMs = Date.now() - data.startTime;
  }
  const duration = durationMs > 0 ? (durationMs / 1000).toFixed(1) : null;
  const passed = data.numPassedTests ?? 0;
  const failed = data.numFailedTests ?? 0;
  const pending = data.numPendingTests ?? 0;
  const todo = data.numTodoTests ?? 0;
  const total = data.numTotalTests ?? passed + failed + pending + todo;

  // Pull the first few failed test names for the comment
  const failedNames = [];
  if (Array.isArray(data.testResults)) {
    for (const file of data.testResults) {
      if (Array.isArray(file.assertionResults)) {
        for (const assertion of file.assertionResults) {
          if (assertion.status === "failed" && failedNames.length < 10) {
            failedNames.push(`${assertion.fullName ?? assertion.title}`);
          }
        }
      }
    }
  }

  return {
    label: file.label,
    present: true,
    passed,
    failed,
    pending,
    total,
    duration,
    failedNames,
  };
}

function renderSummary(summaries) {
  const lines = ["## QA regression", ""];
  for (const s of summaries) {
    if (!s.present) {
      lines.push(`- **${s.label}**: _no results file (job likely did not run)_`);
      continue;
    }
    if (s.error) {
      lines.push(`- **${s.label}**: ❌ ${s.error}`);
      continue;
    }
    const icon = s.failed === 0 ? "✅" : "❌";
    const dur = s.duration ? ` in ${s.duration}s` : "";
    lines.push(
      `- ${icon} **${s.label}**: ${s.passed}/${s.total} passed${s.failed ? ` (${s.failed} failed)` : ""}${dur}`
    );
    if (s.pending) {
      lines.push(`  - ${s.pending} pending/todo`);
    }
    if (s.failedNames && s.failedNames.length > 0) {
      lines.push(`  - First failures:`);
      for (const n of s.failedNames) {
        lines.push(`    - \`${n}\``);
      }
    }
  }
  lines.push("");
  lines.push(`_Posted automatically by the QA Regression workflow._`);
  return lines.join("\n");
}

function main() {
  const summaries = FILES.map(summarizeVitestJson);
  const md = renderSummary(summaries);
  const out = join(QA_DIR, "ci_summary.md");
  writeFileSync(out, md);
  console.log(`[ci-summarize] wrote ${out}`);
  console.log(md);
  // Exit 0 — the calling workflow step decides pass/fail
  process.exit(0);
}

main();
