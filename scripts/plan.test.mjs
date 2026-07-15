#!/usr/bin/env node
// Tests for scripts/plan.mjs.
//
// Strategy: builds a minimal MASTER-PLAN.md fixture into a temp dir, runs
// node scripts/plan.mjs with --plan and --state overrides, and asserts on
// stdout / exit code / fixture state. The real MASTER-PLAN.md is never touched.

import { mkdtempSync, writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, it } from "node:test";
import assert from "node:assert/strict";

const SCRIPT = join(process.cwd(), "scripts/plan.mjs");

function run(args, fixtureDir, extraEnv = {}) {
  const env = { ...process.env, PLAN: fixtureDir, RESUME_STATE: fixtureDir, ...extraEnv };
  const result = spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    env,
    timeout: 5000,
  });
  return {
    exitCode: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

// Support for --plan and --state overrides: override env var, pass the path.
// The script reads PLAN and RESUME_STATE env vars.
const PLAN_ENV = "PLAN";
const STATE_ENV = "RESUME_STATE";

function setupFixture(piTasks) {
  const dir = mkdtempSync(join(tmpdir(), "plan-test-"));
  const md = fixtureMarkdown(piTasks);
  writeFileSync(join(dir, "MASTER-PLAN.md"), md);
  writeFileSync(join(dir, ".resume-state.json"), emptyState());
  return dir;
}

function emptyState() {
  return JSON.stringify(
    {
      currentPI: 0,
      currentTaskId: null,
      lastSessionId: null,
      lastSessionDate: null,
      sessionSummary: null,
      resumeHint: null,
      history: [],
    },
    null,
    2,
  );
}

function fixtureMarkdown(piTasks) {
  // piTasks: Map<PI-number, [{id, done, description}]>
  const piBlocks = [];
  for (const [pi, tasks] of piTasks) {
    const checklist = tasks
      .map((t) => `- [${t.done ? "x" : " "}] **${t.id}** — ${t.description}`)
      .join("\n");
    piBlocks.push(
      `\n## PI ${pi} — Placeholder\n\n### Tasks\n\n${checklist}\n`,
    );
  }
  const body = `---
current_pi: "0"
current_task: "T1"
last_session: null
last_session_date: null
session_summary: null
resume_hint: null
---

# ClearDeed Master Plan\n${piBlocks.join("\n")}\n`;
  return body;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("plan.mjs", () => {
  describe("status", () => {
    it("prints 0% when no task is done", () => {
      const dir = setupFixture(new Map([[0, [{ id: "T1", done: false, description: "do A" }]]]));
      const r = run(
        ["status"],
        dir,
      );
      assert.equal(r.exitCode, 0, r.stderr);
      assert.ok(r.stdout.includes("0% complete"), `Expected 0% complete in: ${r.stdout}`);
      assert.ok(r.stdout.includes("(0/1)"), `Expected (0/1) in: ${r.stdout}`);
      assert.ok(r.stdout.includes("PI 0"));
    });

    it("computes aggregate progress across multiple PIs", () => {
      const dir = setupFixture(
        new Map([
          [
            0,
            [
              { id: "T1", done: true, description: "A" },
              { id: "T2", done: false, description: "B" },
            ],
          ],
          [
            1,
            [
              { id: "T3", done: false, description: "C" },
              { id: "T4", done: true, description: "D" },
            ],
          ],
        ]),
      );
      const r = run(["status"], dir);
      assert.equal(r.exitCode, 0, r.stderr);
      assert.ok(r.stdout.includes("50%"), `Expected 50% in: ${r.stdout}`);
      assert.ok(r.stdout.includes("(2/4 tasks)"), `Expected (2/4 tasks) in: ${r.stdout}`);
    });

    it("shows last session info from .resume-state.json", () => {
      const dir = setupFixture(
        new Map([[0, [{ id: "T1", done: false, description: "A" }]]]),
      );
      const state = {
        currentPI: 0,
        currentTaskId: "T1",
        lastSessionId: "2026-07-14-test",
        lastSessionDate: "2026-07-14",
        sessionSummary: "Summary text",
        resumeHint: "next hint",
        history: [],
      };
      writeFileSync(join(dir, ".resume-state.json"), JSON.stringify(state, null, 2));
      const r = run(["resume"], dir);
      assert.equal(r.exitCode, 0, r.stderr);
      assert.ok(r.stdout.includes("2026-07-14-test"), "Expected lastSession in output");
      assert.ok(r.stdout.includes("Summary text"), "Expected sessionSummary in output");
    });
  });

  describe("resume", () => {
    it("prints next open task", () => {
      const dir = setupFixture(
        new Map([
          [0, [{ id: "T1", done: true }, { id: "T2", done: false, description: "the next thing" }]],
        ]),
      );
      const state = { ...JSON.parse(emptyState()), currentPI: 0, currentTaskId: "T2" };
      writeFileSync(join(dir, ".resume-state.json"), JSON.stringify(state, null, 2));
      const r = run(["resume"], dir);
      assert.equal(r.exitCode, 0, r.stderr);
      assert.ok(r.stdout.includes("T2"), `Expected T2 in: ${r.stdout}`);
      assert.ok(r.stdout.includes("the next thing"), `Expected description in: ${r.stdout}`);
    });

    it("detects drift when cursor is stale", () => {
      const dir = setupFixture(
        new Map([
          [0, [{ id: "T1", done: true, description: "A" }]],
        ]),
      );
      // Cursor points to a task that's already done.
      const state = { ...JSON.parse(emptyState()), currentPI: 0, currentTaskId: "T1" };
      writeFileSync(join(dir, ".resume-state.json"), JSON.stringify(state, null, 2));
      const r = run(["resume"], dir);
      assert.equal(r.exitCode, 0, r.stderr);
      assert.ok(r.stdout.includes("DRIFT"), `Expected drift warning in: ${r.stdout}`);
    });
  });

  describe("complete", () => {
    it("marks task done in master plan and advances cursor", () => {
      const dir = setupFixture(
        new Map([
          [0, [{ id: "T1", done: false, description: "A" }, { id: "T2", done: false, description: "B" }]],
        ]),
      );
      const state = { ...JSON.parse(emptyState()), currentPI: 0, currentTaskId: "T1" };
      writeFileSync(join(dir, ".resume-state.json"), JSON.stringify(state, null, 2));

      const r = run(["complete", "T1", "--summary", "did T1"], dir);
      assert.equal(r.exitCode, 0, `Expected 0, got ${r.exitCode}. stderr=${r.stderr}`);

      const updatedMd = readFileSync(join(dir, "MASTER-PLAN.md"), "utf8");
      assert.ok(updatedMd.includes("- [x] **T1**"), `T1 should be checked in: ${updatedMd}`);
      assert.ok(updatedMd.includes('- [ ] **T2**'), `T2 should still be open in: ${updatedMd}`);

      const updatedState = JSON.parse(readFileSync(join(dir, ".resume-state.json"), "utf8"));
      assert.equal(updatedState.currentTaskId, "T2");
      assert.equal(updatedState.sessionSummary, "did T1");
      assert.equal(updatedState.history.length, 1);
      assert.equal(updatedState.history[0].taskId, "T1");
    });

    it("rejects unknown task id", () => {
      const dir = setupFixture(
        new Map([[0, [{ id: "T1", done: false, description: "A" }]]]),
      );
      const r = run(["complete", "T99"], dir);
      assert.equal(r.exitCode, 1);
      assert.ok(r.stderr.includes("not found"), `Expected 'not found' in stderr: ${r.stderr}`);
    });
  });

  describe("list", () => {
    it("lists tasks for current PI when no arg", () => {
      const dir = setupFixture(
        new Map([
          [0, [{ id: "T1", done: true, description: "A" }, { id: "T2", done: false, description: "B" }]],
          [1, [{ id: "T3", done: false, description: "C" }]],
        ]),
      );
      const state = { ...JSON.parse(emptyState()), currentPI: 0 };
      writeFileSync(join(dir, ".resume-state.json"), JSON.stringify(state, null, 2));
      const r = run(["list"], dir);
      assert.equal(r.exitCode, 0, r.stderr);
      assert.ok(r.stdout.includes("T1"), `Expected T1 in output: ${r.stdout}`);
      assert.ok(r.stdout.includes("T2"), `Expected T2 in output: ${r.stdout}`);
      assert.ok(!r.stdout.includes("T3"), `Expected PI 1 excluded: ${r.stdout}`);
    });

    it("lists tasks for explicit PI", () => {
      const dir = setupFixture(
        new Map([
          [0, [{ id: "T1", done: true, description: "A" }]],
          [1, [{ id: "T3", done: false, description: "C" }]],
        ]),
      );
      const r = run(["list", "1"], dir);
      assert.equal(r.exitCode, 0, r.stderr);
      assert.ok(r.stdout.includes("T3"), `Expected T3 in output: ${r.stdout}`);
      assert.ok(!r.stdout.includes("T1"), `Expected T1 excluded: ${r.stdout}`);
    });
  });
});
