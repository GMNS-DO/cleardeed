#!/usr/bin/env node
// scripts/plan.mjs — Master-plan progress tracker and resume helper.
//
// Reads docs/plans/MASTER-PLAN.md as the source of truth for tasks (each PI
// has a "### Tasks" section with `- [x]` / `- [ ]` checklist items, optionally
// with a **T<n>** tag in the line). Maintains a cursor at
// docs/plans/.resume-state.json so any session can pick up where the last one
// stopped.
//
// Subcommands:
//   status                  Print per-PI progress + aggregate % complete.
//   resume                  Print the next task to work on + session-start checklist.
//   complete <TASK_ID>      Mark TASK_ID done in MASTER-PLAN.md, advance cursor,
//                           append a history entry to .resume-state.json.
//   list [PI]               List all tasks in a PI (default: current PI).
//   drift                   Detect drift between .resume-state.json and the
//                           current PI status text (only relevant while the PI
//                           boundary hasn't been updated yet).
//
// Exit codes:
//   0 — success
//   1 — task not found / ambiguous
//   2 — drift detected (printed to stderr)
//
// The script writes MASTER-PLAN.md in place via regex replace_all, preserving
// the file's prose. It does NOT change narrative text — only checkbox states.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, "..");
const PLAN_PATH = join(REPO_ROOT, "docs/plans/MASTER-PLAN.md");
const STATE_PATH = join(REPO_ROOT, "docs/plans/.resume-state.json");

function planPath() {
  return process.env.PLAN && process.env.PLAN !== "."
    ? join(process.env.PLAN, "MASTER-PLAN.md")
    : PLAN_PATH;
}
function statePath() {
  return process.env.RESUME_STATE && process.env.RESUME_STATE !== "."
    ? join(process.env.RESUME_STATE, ".resume-state.json")
    : STATE_PATH;
}

// ── YAML frontmatter ─────────────────────────────────────────────────────────

function parseFrontmatter(md) {
  if (!md.startsWith("---\n")) return { frontmatter: {}, body: md };
  const end = md.indexOf("\n---\n", 4);
  if (end === -1) return { frontmatter: {}, body: md };
  const yaml = md.slice(4, end);
  const body = md.slice(end + 5);
  const frontmatter = {};
  for (const line of yaml.split("\n")) {
    const m = line.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    frontmatter[m[1]] = v;
  }
  return { frontmatter, body };
}

function updateFrontmatter(md, fields) {
  const { frontmatter, body } = parseFrontmatter(md);
  const merged = { ...frontmatter, ...fields };
  const yaml = Object.entries(merged)
    .map(([k, v]) => `${k}: "${String(v).replace(/"/g, '\\"')}"`)
    .join("\n");
  return `---\n${yaml}\n---\n${body}`;
}

// ── PI / task parsing ───────────────────────────────────────────────────────

// Find "## PI <n>" headings and the "### Tasks" subsection under each.
function parsePIs(md) {
  const lines = md.split("\n");
  const pis = [];
  let current = null;
  let inTasks = false;
  for (const line of lines) {
    const piHead = line.match(/^##\s+PI\s+(\d+)\s+—/);
    if (piHead) {
      current = { number: Number(piHead[1]), title: line, tasks: [], taskStartLine: -1, body: [] };
      pis.push(current);
      inTasks = false;
      continue;
    }
    if (!current) continue;
    if (line.match(/^###\s+Tasks\s*$/)) {
      inTasks = true;
      current.taskStartLine = pis[pis.length - 1].body.length;
      continue;
    }
    if (line.match(/^##\s+/) || line.match(/^---\s*$/)) {
      inTasks = false;
    }
    if (inTasks) {
      const taskMatch = line.match(/^-\s+\[(x| )\]\s+\*\*(T\d+)\*\*\s+—\s+(.*)$/);
      if (taskMatch) {
        current.tasks.push({
          id: taskMatch[2],
          done: taskMatch[1] === "x",
          description: taskMatch[3].trim(),
        });
      }
    }
    current.body.push(line);
  }
  return pis;
}

// ── Progress calc ────────────────────────────────────────────────────────────

function progress(pis) {
  let total = 0;
  let done = 0;
  const perPI = pis.map((pi) => {
    const piTotal = pi.tasks.length;
    const piDone = pi.tasks.filter((t) => t.done).length;
    total += piTotal;
    done += piDone;
    return {
      pi: pi.number,
      title: pi.title,
      total: piTotal,
      done: piDone,
      pct: piTotal === 0 ? 0 : Math.round((piDone / piTotal) * 100),
    };
  });
  return {
    aggregate: { total, done, pct: total === 0 ? 0 : Math.round((done / total) * 100) },
    perPI,
  };
}

// ── State file ──────────────────────────────────────────────────────────────

function readState() {
  if (!existsSync(statePath())) {
    return {
      currentPI: 0,
      currentTaskId: null,
      lastSessionId: null,
      lastSessionDate: null,
      sessionSummary: null,
      resumeHint: null,
      history: [],
    };
  }
  return JSON.parse(readFileSync(statePath(), "utf8"));
}

function writeState(state) {
  writeFileSync(statePath(), JSON.stringify(state, null, 2) + "\n");
}// ── Mutate MASTER-PLAN.md (checkboxes + frontmatter) ─────────────────────────

function markTaskDone(md, taskId) {
  // Two spaces of indent before the bullet; ensure we only flip the matching T<id>.
  const re = new RegExp(
    `^( {0,4}-\\s+\\[)( )(\\]\\s+\\*\\*${taskId}\\*\\*\\s+—)`,
    "m",
  );
  if (!re.test(md)) return null;
  return md.replace(re, (_match, a, _b, c) => `${a}x${c}`);
}

function markTaskOpen(md, taskId) {
  const re = new RegExp(
    `^( {0,4}-\\s+\\[)(x)(\\]\\s+\\*\\*${taskId}\\*\\*\\s+—)`,
    "m",
  );
  if (!re.test(md)) return null;
  return md.replace(re, (_match, a, _b, c) => `${a} ${c}`);
}

// ── Subcommands ─────────────────────────────────────────────────────────────

function cmdStatus() {
  const md = readFileSync(planPath(), "utf8");
  const pis = parsePIs(md);
  const { aggregate, perPI } = progress(pis);
  const state = readState();
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(` ClearDeed Master Plan — ${aggregate.pct}% complete`);
  console.log(` (${aggregate.done}/${aggregate.total} tasks)`);
  console.log("═══════════════════════════════════════════════════════════════");
  for (const p of perPI) {
    const bar = "█".repeat(Math.floor(p.pct / 10)) + "░".repeat(10 - Math.floor(p.pct / 10));
    const mark = p.pi === state.currentPI ? "→" : " ";
    console.log(`${mark} PI ${p.pi}: ${bar} ${p.pct}%  (${p.done}/${p.total})  ${p.title.replace(/^##\s+PI\s+\d+\s+—\s*/, "")}`);
  }
  console.log("═══════════════════════════════════════════════════════════════");
  if (state.lastSessionId) {
    console.log(` Last session: ${state.lastSessionId} (${state.lastSessionDate || "?"})`);
    console.log(` Cursor: PI-${state.currentPI} → ${state.currentTaskId || "no active task"}`);
  }
  return 0;
}

function nextOpenTask(pis, pi) {
  const target = pis.find((p) => p.number === pi);
  if (!target) return null;
  return target.tasks.find((t) => !t.done) || null;
}

function cmdResume() {
  const md = readFileSync(planPath(), "utf8");
  const pis = parsePIs(md);
  const state = readState();

  console.log("═══════════════════════════════════════════════════════════════");
  console.log(` RESUME — PI ${state.currentPI} • ${state.lastSessionId || "(no prior session)"}`);
  console.log("═══════════════════════════════════════════════════════════════");

  if (state.sessionSummary) {
    console.log("");
    console.log(` Last session summary:`);
    console.log(`   ${state.sessionSummary}`);
    console.log("");
  }

  // Drift check
  const drift = detectDrift(pis, state);
  if (drift.length) {
    console.log(" ⚠️  DRIFT DETECTED:");
    for (const d of drift) console.log(`   - ${d}`);
    console.log("   Resolve with `pnpm plan:complete <TASK_ID>` or `pnpm plan:status` to confirm.");
    console.log("");
  }

  const cursorTask = pis
    .flatMap((p) => p.tasks.map((t) => ({ ...t, pi: p.number })))
    .find((t) => t.id === state.currentTaskId);

  // If cursor task is done, advance.
  let next = cursorTask && !cursorTask.done ? cursorTask : nextOpenTask(pis, state.currentPI);
  // If current PI is fully done, peek into the next PI.
  if (!next) {
    const nextPI = pis.find((p) => p.number > state.currentPI);
    next = nextPI ? nextOpenTask(pis, nextPI.number) : null;
    if (next) {
      console.log(` PI-${state.currentPI} is fully complete.`);
      console.log(` Jumping to PI-${next.pi}: ${next.description}`);
      console.log("");
    }
  }

  if (!next) {
    console.log(" ✓ All PIs complete. Handoff criteria met.");
    return 0;
  }

  console.log(` NEXT TASK: **${next.id}** (PI-${next.pi})`);
  console.log(`   ${next.description}`);
  console.log("");
  if (state.resumeHint) {
    console.log(` Resume hint:`);
    console.log(`   ${state.resumeHint}`);
    console.log("");
  }
  console.log(" To start: confirm task is still in scope, then run `pnpm plan:complete " + next.id + "` when done.");
  return 0;
}

function cmdList(argPI) {
  const md = readFileSync(planPath(), "utf8");
  const pis = parsePIs(md);
  const state = readState();
  const target = argPI !== undefined ? Number(argPI) : state.currentPI;
  const pi = pis.find((p) => p.number === target);
  if (!pi) {
    console.error(`PI ${target} not found.`);
    return 1;
  }
  console.log(`PI ${pi.number}: ${pi.title}`);
  for (const t of pi.tasks) {
    const mark = t.done ? "[x]" : "[ ]";
    console.log(`  ${mark} ${t.id}  ${t.description}`);
  }
  return 0;
}

function detectDrift(pis, state) {
  const issues = [];
  // Find the cursor task. If it's marked done but state still points to it,
  // the cursor is stale.
  const cursor = pis
    .flatMap((p) => p.tasks.map((t) => ({ ...t, pi: p.number })))
    .find((t) => t.id === state.currentTaskId);
  if (cursor && cursor.done) {
    issues.push(`Cursor ${cursor.id} is already done — run \`pnpm plan:status\` to advance.`);
  }
  // If the current PI's first task is open and the cursor is on a task later
  // in the same PI, there might be an earlier open task the cursor skipped.
  if (cursor) {
    const pi = pis.find((p) => p.number === cursor.pi);
    if (pi) {
      const idx = pi.tasks.findIndex((t) => t.id === cursor.id);
      const earlierOpen = pi.tasks.slice(0, idx).find((t) => !t.done);
      if (earlierOpen) {
        issues.push(`Earlier open task ${earlierOpen.id} in PI-${pi.number} skipped by cursor.`);
      }
    }
  }
  return issues;
}

function cmdComplete(taskId, summaryArg) {
  if (!taskId) {
    console.error("Usage: pnpm plan:complete <TASK_ID> [--summary \"...\"]");
    return 1;
  }
  if (!/^T\d+$/.test(taskId)) {
    console.error(`Task ID must look like T<n> (got "${taskId}")`);
    return 1;
  }
  const md = readFileSync(planPath(), "utf8");
  const pis = parsePIs(md);
  const target = pis
    .flatMap((p) => p.tasks.map((t) => ({ ...t, pi: p.number })))
    .find((t) => t.id === taskId);
  if (!target) {
    console.error(`Task ${taskId} not found in MASTER-PLAN.md`);
    return 1;
  }
  if (target.done) {
    console.error(`Task ${taskId} is already marked done.`);
    return 1;
  }

  const updated = markTaskDone(md, taskId);
  if (updated == null) {
    console.error(`Failed to flip checkbox for ${taskId} (regex miss).`);
    return 1;
  }

  // Advance cursor to the next open task in the same PI.
  const state = readState();
  const allTasks = pis.flatMap((p) => p.tasks.map((t) => ({ ...t, pi: p.number })));
  const next = allTasks.find((t) => !t.done && t.id !== taskId);
  let nextPI = state.currentPI;
  let nextTaskId = state.currentTaskId;
  if (next) {
    nextTaskId = next.id;
  } else {
    // PI is done — try the next PI.
    const later = pis.find((p) => p.number > target.pi);
    const laterOpen = later ? later.tasks.find((t) => !t.done) : null;
    if (laterOpen) {
      nextPI = later.number;
      nextTaskId = laterOpen.id;
    } else {
      nextPI = target.pi;
      nextTaskId = null;
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const sessionId = `${today}-${taskId.toLowerCase()}`;
  const summary = summaryArg || `Completed ${taskId} (${target.description})`;

  state.currentPI = nextPI;
  state.currentTaskId = nextTaskId;
  state.lastSessionId = sessionId;
  state.lastSessionDate = today;
  state.sessionSummary = summary;
  state.resumeHint = nextTaskId
    ? `Pick up ${nextTaskId} in PI-${nextPI}`
    : `PI-${target.pi} complete — review handoff criteria or jump to next PI`;
  state.history = state.history || [];
  state.history.push({
    session: sessionId,
    date: today,
    pi: target.pi,
    taskId,
    summary,
  });

  // Update frontmatter
  const updatedMd = updateFrontmatter(updated, {
    current_pi: nextPI,
    current_task: nextTaskId || "none",
    last_session: sessionId,
    last_session_date: today,
    session_summary: summary,
    resume_hint: state.resumeHint,
  });

  writeFileSync(planPath(), updatedMd);
  writeState(state);

  console.log(`✓ Marked ${taskId} done (PI-${target.pi})`);
  console.log(`  Cursor advanced: ${nextTaskId ? nextTaskId : "(no open task)"} in PI-${nextPI}`);
  console.log(`  Session recorded: ${sessionId}`);
  return 0;
}

function cmdDrift() {
  const md = readFileSync(planPath(), "utf8");
  const pis = parsePIs(md);
  const state = readState();
  const issues = detectDrift(pis, state);
  if (issues.length === 0) {
    console.log("✓ No drift. Cursor is consistent with master plan checklist.");
    return 0;
  }
  console.error("Drift detected:");
  for (const i of issues) console.error(`  - ${i}`);
  return 2;
}

// ── Entry ───────────────────────────────────────────────────────────────────

function usage() {
  console.log(`Usage: node scripts/plan.mjs <subcommand> [args]

Subcommands:
  status                  Print per-PI progress + aggregate % complete.
  resume                  Print the next task to work on.
  list [PI]               List tasks in a PI (default: current PI).
  complete <TASK_ID>      Mark TASK_ID done, advance cursor.
       [--summary "..."]  Override the auto-generated session summary.
  drift                   Detect drift between cursor and checklist.
`);
}

function main(argv) {
  const [subcmd, ...rest] = argv.slice(2);
  switch (subcmd) {
    case "status":
      return cmdStatus();
    case "resume":
      return cmdResume();
    case "list":
      return cmdList(rest[0]);
    case "complete": {
      const taskId = rest[0];
      const summaryIdx = rest.indexOf("--summary");
      const summaryArg = summaryIdx !== -1 ? rest[summaryIdx + 1] : undefined;
      return cmdComplete(taskId, summaryArg);
    }
    case "drift":
      return cmdDrift();
    default:
      usage();
      return subcmd ? 1 : 0;
  }
}

process.exit(main(process.argv));
