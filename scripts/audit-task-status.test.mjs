// Test for scripts/audit-task-status.mjs
//
// Contract:
//   - auditTaskStatus(claudeMdText, repoRoot) returns an array of task rows
//   - each row: { id, status, title, evidenceLevel, overClaimed, evidencePaths[] }
//   - evidenceLevel ∈ { 'BUILT' | 'LIVE-VALIDATED' | 'INSUFFICIENT' }
//   - for tasks marked DONE, overClaimed is true when evidenceLevel is 'INSUFFICIENT'
//
// Tests use a controlled fixture and tmp repo roots. They do not depend on
// the real CLAUDE.md.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

function makeTmpRepo(files) {
  const dir = mkdtempSync(join(tmpdir(), "audit-test-"));
  for (const [relPath, content] of Object.entries(files)) {
    const full = join(dir, relPath);
    mkdirSync(join(full, ".."), { recursive: true });
    writeFileSync(full, content);
  }
  return dir;
}

const SCRIPT = join(process.cwd(), "scripts", "audit-task-status.mjs");

function runAudit(fixture, repo) {
  return JSON.parse(
    execFileSync("node", [SCRIPT, "--json", "--claude-md", "/dev/stdin", "--repo-root", repo], {
      input: fixture,
      encoding: "utf8",
    }),
  );
}

const FIXTURE_CLAUDE = `# Test

[T-001] [DONE] [P0] Set up monorepo skeleton
  Notes: Mirror Section 2 layout.

[T-002] [DONE] [P0] Live-validate Bhulekh fetcher
  Notes: CONFIRMED WORKING (Session 050). Live artifact at /tmp/bhulekh-live-diag.json.

[T-003] [DONE] [P0] Fetcher with fixtures but no live run
  Notes: Code written, 3 tests pass.

[T-004] [TODO] [P1] Not started
  Notes: pending.

[T-005] [IN PROGRESS] [P1] Halfway
  Notes: in flight.

[DPR-INF-001] [DONE] [P0] Add source-level provenance bundle
  Notes: completed.
`;

test("parses all task statuses from CLAUDE.md", () => {
  const repo = makeTmpRepo({});
  const rows = runAudit(FIXTURE_CLAUDE, repo);
  const ids = rows.map((r) => r.id);
  assert.deepEqual(ids, ["T-001", "T-002", "T-003", "T-004", "T-005", "DPR-INF-001"]);
});

test("flags DONE tasks with no code as OVERCLAIMED", () => {
  const repo = makeTmpRepo({});
  const rows = runAudit(FIXTURE_CLAUDE, repo);
  const t001 = rows.find((r) => r.id === "T-001");
  assert.equal(t001.status, "DONE", "fixture says DONE");
  assert.equal(t001.overClaimed, true, "T-001 has no evidence, must be flagged");
  assert.ok(
    ["INSUFFICIENT", "BUILT", "LIVE-VALIDATED"].includes(t001.evidenceLevel),
    "evidenceLevel must be one of the defined values",
  );
});

test("marks LIVE-VALIDATED when live artifact path mentioned in notes exists", () => {
  const repo = makeTmpRepo({
    "tmp/bhulekh-live-diag.json": '{"status":"success","owner":"Purti Bibhag"}',
  });
  const rows = runAudit(FIXTURE_CLAUDE, repo);
  const t002 = rows.find((r) => r.id === "T-002");
  assert.equal(t002.evidenceLevel, "LIVE-VALIDATED");
  assert.equal(t002.overClaimed, false);
  assert.ok(t002.evidencePaths.some((p) => p.includes("bhulekh-live-diag.json")));
});

test("marks BUILT when test files exist but no live artifact", () => {
  const repo = makeTmpRepo({
    "packages/fetchers/something/src/index.ts": "export const x = 1;",
    "packages/fetchers/something/src/index.test.ts": "test('x', () => {});",
    "packages/fetchers/something/fixtures/sample.json": "{}",
  });
  const claude = FIXTURE_CLAUDE.replace(
    "[T-003] [DONE] [P0] Fetcher with fixtures but no live run",
    "[T-003] [DONE] [P0] something fetcher with tests and fixtures",
  );
  const rows = runAudit(claude, repo);
  const t003 = rows.find((r) => r.id === "T-003");
  assert.equal(t003.evidenceLevel, "BUILT");
  assert.equal(t003.overClaimed, false);
});

test("does not flag TODO or IN PROGRESS tasks as overclaimed", () => {
  const repo = makeTmpRepo({});
  const rows = runAudit(FIXTURE_CLAUDE, repo);
  const t004 = rows.find((r) => r.id === "T-004");
  const t005 = rows.find((r) => r.id === "T-005");
  assert.equal(t004.overClaimed, false, "TODO is not overclaimed, it is not yet claimed");
  assert.equal(t005.overClaimed, false, "IN PROGRESS is not overclaimed");
});

test("handles DPR-prefixed tasks identically to T-prefixed", () => {
  const repo = makeTmpRepo({
    "packages/schema/src/index.ts": "export const z = 1;",
    "packages/schema/src/validation.ts": "export const y = 1;",
  });
  const rows = runAudit(FIXTURE_CLAUDE, repo);
  const dpr = rows.find((r) => r.id === "DPR-INF-001");
  assert.ok(dpr, "DPR task must be in output");
  assert.equal(dpr.status, "DONE");
});

// Tighter detector: canonical-path resolution from title.
//
// A DONE task whose title implies a file location (e.g. "Bhulekh fetcher" ->
// packages/fetchers/bhulekh/**) is BUILT if the canonical path exists, even
// when the notes don't reference any path. This is the common case in the
// real CLAUDE.md: early tasks (T-001, T-002) describe a structural change
// whose evidence is the directory layout, not a path mention.

test("marks BUILT from title-implied canonical path when files exist", () => {
  const repo = makeTmpRepo({
    "packages/fetchers/bhulekh/src/index.ts": "export const b = 1;",
    "packages/fetchers/bhulekh/src/index.test.ts": "test('b', () => {});",
    "packages/fetchers/bhulekh/fixtures/real.json": "{}",
  });
  const claude = `[T-099] [DONE] [P0] Build Bhulekh fetcher
  Notes: code shipped.`;
  const rows = runAudit(claude, repo);
  const t = rows.find((r) => r.id === "T-099");
  assert.equal(t.evidenceLevel, "BUILT", `expected BUILT, got ${t.evidenceLevel}`);
  assert.equal(t.overClaimed, false);
  assert.ok(
    t.evidencePaths.some((p) => p.includes("packages/fetchers/bhulekh")),
    `evidencePaths should reference bhulekh dir, got ${JSON.stringify(t.evidencePaths)}`,
  );
});

test("monorepo-skeleton task: BUILT when apps/ and packages/ both exist", () => {
  const repo = makeTmpRepo({
    "apps/web/package.json": "{}",
    "apps/web/next.config.ts": "",
    "packages/schema/package.json": "{}",
    "packages/orchestrator/package.json": "{}",
  });
  const claude = `[T-001] [DONE] [P0] Set up monorepo skeleton (Next.js + packages + Supabase local)
  Notes: Mirror Section 2 layout exactly. No fetchers yet.`;
  const rows = runAudit(claude, repo);
  const t = rows.find((r) => r.id === "T-001");
  assert.equal(t.evidenceLevel, "BUILT", `expected BUILT, got ${t.evidenceLevel}`);
  assert.equal(t.overClaimed, false);
});

test("Zod-first schema task: BUILT when schema package has zod usage", () => {
  const repo = makeTmpRepo({
    "packages/schema/package.json": '{"dependencies": {"zod": "^3.0.0"}}',
    "packages/schema/src/index.ts": 'import { z } from "zod";\nexport const S = z.object({});',
  });
  const claude = `[T-002] [DONE] [P0] Define shared schemas in packages/schema
  Notes: Report, SourceResult, PlotIdentifier, OwnerRecord. Zod-first.`;
  const rows = runAudit(claude, repo);
  const t = rows.find((r) => r.id === "T-002");
  assert.equal(t.evidenceLevel, "BUILT", `expected BUILT, got ${t.evidenceLevel}`);
});

test("pdf-renderer task: BUILT when pdf-renderer package exists", () => {
  // T-008 is IN PROGRESS in the real CLAUDE.md but the code lives in
  // packages/pdf-renderer/. The title-based detector should mark it BUILT
  // (the code is on disk) but NOT overclaimed (status is not DONE).
  const repo = makeTmpRepo({
    "packages/pdf-renderer/package.json": "{}",
    "packages/pdf-renderer/src/index.ts": "export const p = 1;",
  });
  const claude = `[T-008] [IN PROGRESS] [P1] Report PDF renderer (lawyer-facing layout)
  Notes: Sectioned, printable, includes manual-verification checklist per source.`;
  const rows = runAudit(claude, repo);
  const t = rows.find((r) => r.id === "T-008");
  assert.equal(t.evidenceLevel, "BUILT", `expected BUILT, got ${t.evidenceLevel}`);
  assert.equal(t.overClaimed, false, "IN PROGRESS is not overclaimed");
});
