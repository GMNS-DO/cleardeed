#!/usr/bin/env node
// Audit script: parse CLAUDE.md task list and classify each task's evidence.
//
// Output: JSON array of { id, status, title, evidenceLevel, overClaimed, evidencePaths }
// where evidenceLevel is one of: BUILT, LIVE-VALIDATED, WIRED, SHIPPED, INSUFFICIENT
// and overClaimed is true when status is DONE and evidenceLevel is INSUFFICIENT.
//
// Usage: node scripts/audit-task-status.mjs [--repo-root <path>] [--claude-md <path>]
//   - if --claude-md is "-" or "/dev/stdin", reads from stdin
//   - default --claude-md is ./CLAUDE.md
//   - default --repo-root is current working directory

import { readFileSync, existsSync } from "node:fs";
import { resolve, join, dirname } from "node:path";

function parseArgs(argv) {
  const args = { repoRoot: process.cwd(), claudeMd: null };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--repo-root") args.repoRoot = resolve(argv[++i]);
    else if (argv[i] === "--claude-md") args.claudeMd = argv[++i];
  }
  return args;
}

function readClaudeMd(args) {
  if (args.claudeMd && args.claudeMd !== "-" && args.claudeMd !== "/dev/stdin") {
    return readFileSync(args.claudeMd, "utf8");
  }
  // stdin path
  return readFileSync(0, "utf8");
}

// Parse CLAUDE.md task list.
// Each task starts with [T-XXX] or [DPR-XXX] at line start.
// Status, priority, title follow on the same line.
// Notes (if any) follow on indented lines until the next task header or end.
function parseTasks(text) {
  const lines = text.split("\n");
  const tasks = [];
  let current = null;
  const headerRe = /^\[(T-\d+|DPR-[A-Z]+-\d+)\]\s+\[(\w[\w\s]*?)\]\s+\[([P]\d)\]\s+(.+)$/;

  for (const line of lines) {
    const m = line.match(headerRe);
    if (m) {
      if (current) tasks.push(current);
      current = {
        id: m[1],
        status: m[2].trim(),
        priority: m[3],
        title: m[4].trim(),
        notes: "",
        headerLine: line,
      };
    } else if (current && /^\s+/.test(line)) {
      current.notes += (current.notes ? "\n" : "") + line;
    } else if (current && line.trim() === "") {
      // blank line ends the task block
      if (current.notes) {
        tasks.push(current);
        current = null;
      }
    } else if (current) {
      // non-indented, non-blank line ends the task
      tasks.push(current);
      current = null;
    }
  }
  if (current) tasks.push(current);
  return tasks;
}

// Extract file paths mentioned in notes.
// Matches: scripts/foo.ts, packages/x/y.ts, docs/a.md, /tmp/x.json
function extractPathsFromNotes(notes) {
  if (!notes) return [];
  const re = /(?:^|\s)((?:\/tmp|\.\/|\.\.\/|\/)[A-Za-z0-9_\-./]+\.[A-Za-z0-9]+|(?:scripts|packages|apps|docs|qa|agents|workers|infra)\/[A-Za-z0-9_\-./]+\.[A-Za-z0-9]+)/g;
  const out = [];
  let m;
  while ((m = re.exec(notes)) !== null) {
    out.push(m[1]);
  }
  return out;
}

// Infer canonical paths from a task's title. This catches the common case
// where the notes don't reference any specific file but the title names the
// component: e.g. "Build Bhulekh fetcher" -> packages/fetchers/bhulekh/.
//
// Returns the list of repo-relative paths that are explicit or strongly
// implied by the title, regardless of whether they exist on disk. Existence
// is checked by the caller via the standard "any of these paths exists"
// pattern, so unresolved hints simply contribute nothing.
function inferCanonicalPathsFromTitle(title) {
  const out = [];
  const t = title.toLowerCase();

  // 1. Direct path mentions in the title (most reliable).
  // Matches things like "packages/schema", "apps/web", "docs/sources/igr.md",
  // "scripts/probe/kyl.md", "infra/supabase/migrations", "qa/...".
  const directRe =
    /(packages|apps|workers|infra|scripts|docs|qa|agents)\/[a-z0-9_\-./]+/gi;
  for (const m of title.matchAll(directRe)) {
    out.push(m[0].replace(/\.$/, ""));
  }

  // 2. Fetcher-name inference: "Build X fetcher" or "X fetcher" in the title
  //    -> packages/fetchers/x/{src,fixtures,...}.
  const fetcherNames = [
    "nominatim",
    "bhunaksha",
    "bhulekh",
    "ecourts",
    "rccms",
    "high-court",
    "drt",
    "rera",
    "igr",
    "cersai",
    "bhuvan",
    "bda",
    "larr",
    "bmc",
    "tpcodl",
    "phed",
    "eow",
  ];
  for (const name of fetcherNames) {
    // Match "Bhulekh fetcher", "Bhuvan flood", "IGR deep-link", etc. The
    // name appearing in the title is enough; we don't require "fetcher".
    if (t.includes(name)) {
      out.push(`packages/fetchers/${name}`);
    }
  }

  // 3. Known monorepo component names from the title (Section 2 of CLAUDE.md).
  const components = {
    "orchestrator": "packages/orchestrator",
    "schema": "packages/schema",
    "pdf renderer": "packages/pdf-renderer",
    "pdf-renderer": "packages/pdf-renderer",
    "report pdf": "packages/pdf-renderer",
    "next.js app": "apps/web",
    "next.js": "apps/web",
    "monorepo skeleton": "apps",
    "monorepo": "apps",
    "playwright worker": "workers/playwright-worker",
    "supabase migrations": "infra/supabase/migrations",
  };
  for (const [phrase, path] of Object.entries(components)) {
    if (t.includes(phrase)) {
      out.push(path);
    }
  }

  return [...new Set(out)];
}

// Classify a single task's evidence level given the repo root.
function classify(task, repoRoot) {
  const id = task.id;
  const status = task.status;
  const paths = extractPathsFromNotes(task.notes);

  // TODO / IN PROGRESS / UNTESTED / SUPERSEDED are not overclaim targets,
  // but we still want to record what code/evidence is on disk so a reviewer
  // can see "IN PROGRESS but the code is already BUILT" or similar.

  // Check for live artifact: any path in notes that exists in the repo
  let liveArtifact = false;
  let builtArtifact = false;
  const evidencePaths = [];

  // Title-implied canonical paths (BEFORE we look at notes-paths). This is
  // the key change: a DONE task whose title names a component is BUILT if
  // that component exists in the repo, even when notes don't reference it.
  for (const p of inferCanonicalPathsFromTitle(task.title)) {
    const candidates = [join(repoRoot, p), join(repoRoot, p + "/package.json")];
    for (const c of candidates) {
      if (existsSync(c)) {
        builtArtifact = true;
        evidencePaths.push(p);
        break;
      }
    }
  }

  for (const p of paths) {
    // Try resolving relative to repoRoot (handles "./" and absolute /tmp paths)
    const cleaned = p.replace(/^\.\//, "");
    const candidates = [join(repoRoot, cleaned), join(repoRoot, p)];
    for (const c of candidates) {
      if (existsSync(c)) {
        evidencePaths.push(p);
        // Any file in the repo that's referenced as evidence is at minimum BUILT.
        builtArtifact = true;
        // Heuristic: a path that contains "live" or "diag" or a JSON file
        // from a fetcher's fixtures dir, or a probe script, suggests live evidence
        if (p.includes("live") || p.includes("diag") || p.includes("probe") || p.includes("smoke")) {
          liveArtifact = true;
        }
        break;
      }
    }
  }

  // Check for fetcher package code: src/index.ts + src/index.test.ts + fixtures/
  // Try to infer the fetcher name from the task ID prefix
  // T-006 -> nominatim, T-007 -> orchestrator, T-015 -> bhulekh, etc.
  // We use a simple heuristic: look at notes for fetcher names mentioned.
  const fetcherHints = ["nominatim", "bhunaksha", "bhulekh", "ecourts", "rccms", "high-court", "drt", "rera", "igr", "cersai", "bhuvan", "bda", "larr", "bmc", "tpcodl", "phed", "eow"];
  const mentionedFetcher = fetcherHints.find((h) => task.notes.toLowerCase().includes(h) || task.title.toLowerCase().includes(h));

  if (mentionedFetcher) {
    const base = join(repoRoot, "packages", "fetchers", mentionedFetcher);
    const srcIdx = join(base, "src", "index.ts");
    const testIdx = join(base, "src", "index.test.ts");
    const fixtures = join(base, "fixtures");
    if (existsSync(srcIdx) && existsSync(testIdx) && existsSync(fixtures)) {
      builtArtifact = true;
      evidencePaths.push(`packages/fetchers/${mentionedFetcher}/{src,fixtures}/`);
    }
  }

  // Check for tests/ typecheck/build evidence mentioned in notes
  const testCountMatch = task.notes.match(/(\d+)\s*\/\s*(\d+)\s+tests?\s+pass|all\s+(\d+)\s+tests?\s+pass|(\d+)\s+tests?\s+pass/i);
  if (testCountMatch) {
    builtArtifact = true;
    evidencePaths.push("tests-pass");
  }

  // Check for explicit "CONFIRMED WORKING" or "live" markers in notes
  if (/\b(CONFIRMED WORKING|LIVE-VALIDATED|verified|smoke test passed|live test)\b/i.test(task.notes)) {
    liveArtifact = true;
  }

  // Check for explicit URL mention
  if (/\bhttps?:\/\//i.test(task.notes)) {
    liveArtifact = true;
    evidencePaths.push("live-url-mentioned");
  }

  // Check for deployed routes (apps/web/src/app/<route>)
  if (/\/api\//i.test(task.notes) || /\/report\//i.test(task.notes) || /\/admin\b/i.test(task.notes) || /\/dashboard\b/i.test(task.notes)) {
    liveArtifact = true;
    evidencePaths.push("route-mentioned");
  }

  // Determine evidence level
  let evidenceLevel;
  if (liveArtifact) {
    evidenceLevel = "LIVE-VALIDATED";
  } else if (builtArtifact) {
    evidenceLevel = "BUILT";
  } else {
    evidenceLevel = "INSUFFICIENT";
  }

  // A DONE task with INSUFFICIENT evidence is overclaimed. For non-DONE
  // statuses (TODO/IN PROGRESS/UNTESTED/SUPERSEDED/BLOCKED) the code may
  // still exist on disk — that's recorded in evidenceLevel/evidencePaths
  // but the task is not overclaimed.
  const overClaimed = status === "DONE" && evidenceLevel === "INSUFFICIENT";

  return { evidenceLevel, evidencePaths: [...new Set(evidencePaths)], overClaimed };
}

function auditTaskStatus(claudeMdText, repoRoot) {
  const tasks = parseTasks(claudeMdText);
  return tasks.map((t) => {
    const c = classify(t, repoRoot);
    return {
      id: t.id,
      status: t.status,
      priority: t.priority,
      title: t.title,
      evidenceLevel: c.evidenceLevel,
      overClaimed: c.overClaimed,
      evidencePaths: c.evidencePaths,
    };
  });
}

// CLI entry
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = parseArgs(process.argv);
  const text = readClaudeMd(args);
  const rows = auditTaskStatus(text, args.repoRoot);
  // Default CLI output: human-readable table, not JSON.
  // JSON output is enabled with --json for the test harness.
  if (process.argv.includes("--json")) {
    process.stdout.write(JSON.stringify(rows, null, 2) + "\n");
  } else {
    const width = (s, n) => (s.length > n ? s.slice(0, n - 1) + "…" : s.padEnd(n));
    const flag = (b) => (b ? "OVERCLAIMED" : "ok");
    process.stdout.write(
      [
        width("ID", 14),
        width("STATUS", 12),
        width("LEVEL", 16),
        width("FLAG", 12),
        width("TITLE", 50),
      ].join(" ") + "\n",
    );
    process.stdout.write("-".repeat(110) + "\n");
    for (const r of rows) {
      process.stdout.write(
        [
          width(r.id, 14),
          width(r.status, 12),
          width(r.evidenceLevel, 16),
          width(flag(r.overClaimed), 12),
          width(r.title, 50),
        ].join(" ") + "\n",
      );
    }
    const overCount = rows.filter((r) => r.overClaimed).length;
    const doneCount = rows.filter((r) => r.status === "DONE").length;
    process.stdout.write("\n");
    process.stdout.write(`Total tasks: ${rows.length}\n`);
    process.stdout.write(`Marked DONE: ${doneCount}\n`);
    process.stdout.write(`Over-claimed: ${overCount}\n`);
  }
}

export { parseTasks, classify, auditTaskStatus, extractPathsFromNotes, inferCanonicalPathsFromTitle };
