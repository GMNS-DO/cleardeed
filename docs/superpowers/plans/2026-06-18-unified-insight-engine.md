# Unified Insight Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse the two parallel insight engines (`buildRoRInsightGroups`, `buildRiskInsights`) and the related scattered `buildXxx` helpers in the consumer report writer into one `Insight[]` stream with a per-insight closed disclosure, then ship 72 deterministic rules across 14 panel files that fire only when their upstream data is live.

**Architecture:** New `insights/` module under `agents/consumer-report-writer/src/` owns the entire `Insight` schema, rule registry, engine, and disclosure renderer. A10 (`generateConsumerReport`) and A11 (`auditReport`) consume the same `Insight[]` and the same `display-labels.ts` allowlist, so the language gate sees what the user sees. Existing call sites `buildRoRInsightGroups` / `buildRiskInsights` / `buildMutationReferencePanel` are deleted; their bodies become rules in the registry.

**Tech Stack:** TypeScript, Zod, Vitest, Next.js App Router, pnpm workspaces.

## Global Constraints

- TypeScript strict; `npm run typecheck` and `npm run build` must pass after every task.
- `npm test -- --run` must pass after every task. Adding new tests should never reduce the current count.
- No live LLM calls in consumer output. ADR-019, ADR-020 still apply.
- Prohibited phrases (from spec §6): "verified clear", "ownership verified", "safe to buy", "no encumbrance", "no litigation", "clear title", "buildable", "no restriction". Enforced via `display-labels.ts` allowlist (A11) AND `noProhibitedPhrases()` per-rule assertion (this plan).
- Every insight must carry: `issueLens` (one of 5), `evidenceStrength` (one of 7), `source` (string), `actionItem` (string).
- File paths in this plan are relative to repo root: `/Users/deekshamohapatra/Documents/cleardeed/`.
- Commit message format: `feat(insights): <short summary>` for engine work, `test(insights): <short summary>` for test-only commits, `chore(insights): <short summary>` for chores.

## File Map (created or modified)

### New files

```
agents/consumer-report-writer/src/insights/
  schema.ts                   # Zod types, enums
  display-labels.ts           # Allowlist + assertion
  engine.ts                   # runInsights() / groupByPanel()
  render.ts                   # Per-insight disclosure renderer
  diagram-section.ts          # Plot diagram block renderer
  registry/
    _shared.ts                # rule input type, runRule(), noProhibitedPhrases()
    bhulekh/
      plot.ts                 # 7 rules
      owner.ts                # 6 rules
      land.ts                 # 5 rules
      plot-table.ts           # 5 rules
      dues.ts                 # 3 rules
      back-page.ts            # 6 rules
    bhunaksha/
      plot.ts                 # 4 rules
      road-access.ts          # 3 rules
      neighbours.ts           # 4 rules
    registry/
      encumbrance.ts          # 5 stub rules
      deeds.ts                # 5 stub rules
      court.ts                # 3 stub rules
      financial.ts            # 3 stub rules
      completeness.ts         # 4 rules
    recursive/
      chain-recursive.ts      # ROR-INS-150 stub
      neighbours-recursive.ts # ROR-INS-151 stub
      zoning.ts               # ROR-INS-152/153 stubs
  __tests__/
    schema.test.ts
    display-labels.test.ts
    engine.test.ts
    render.test.ts
    diagram-section.test.ts
    auto-activation.test.ts
    registry/
      bhulekh/plot.test.ts
      bhulekh/owner.test.ts
      bhulekh/land.test.ts
      bhulekh/plot-table.test.ts
      bhulekh/dues.test.ts
      bhulekh/back-page.test.ts
      bhunaksha/plot.test.ts
      bhunaksha/road-access.test.ts
      bhunaksha/neighbours.test.ts
      registry/encumbrance.test.ts
      registry/deeds.test.ts
      registry/court.test.ts
      registry/financial.test.ts
      registry/completeness.test.ts
    a11-violations.test.ts

packages/fetchers/bhunaksha/src/
  plot-report.ts              # HTTP fetch of plot report page (Task 32)
  plot-report.test.ts
  diagram-parser.ts           # SVG → PlotDiagram (Task 34)
  diagram-parser.test.ts
  diagram-renderer.ts         # PlotDiagram → inline SVG (Task 35)
  diagram-renderer.test.ts

apps/web/src/lib/storage/
  supabase-artifacts.ts       # Upload + signed URL helper (Task 36)
  supabase-artifacts.test.ts

infra/supabase/migrations/
  002_artifact_bucket.sql     # Storage bucket + RLS (Task 36)

docs/sources/
  bhunaksha-plot-diagram.md   # Probe notes + SVG schema (Task 31)

qa/
  bhunaksha_plot_diagram_probe.mjs  # Probe script (Task 31)
```

### Modified files

```
agents/consumer-report-writer/src/index.ts                # Remove buildRoRInsightGroups, buildRiskInsights, buildMutationReferencePanel, buildNameMatchSection
agents/consumer-report-writer/src/ror-insights.ts         # Delete (rolled into registry/bhulekh/*)
agents/consumer-report-writer/src/ror-insights.test.ts    # Delete (rolled into registry tests)
agents/consumer-report-writer/src/index.test.ts           # Add contract tests
agents/output-auditor/src/index.ts                        # Add audit rule "insight must have closed disclosure"
agents/output-auditor/src/index.test.ts                   # Add tests
apps/web/src/lib/pipeline/index.ts                        # Wire runInsights() into report gen
docs/insights/insights-engine.md                          # New — full mapping table (spec §3.2)
docs/decisions/adr-021-unified-insight-engine.md          # New — ADR
```

### Deleted files (after consumers migrated)

```
agents/consumer-report-writer/src/ror-insights.ts
agents/consumer-report-writer/src/ror-insights.test.ts
```

---

## Phase 0 — Scaffold and contracts (engine first, no data)

Tasks 1–6 build the runtime + test scaffolding. They compile against empty/stubbed rules so that every later Phase 1+ task has a target to land in.

### Task 1: Insight schema (Zod types and enums)

**Files:**
- Create: `agents/consumer-report-writer/src/insights/schema.ts`
- Test: `agents/consumer-report-writer/src/insights/__tests__/schema.test.ts`

**Interfaces:**
- Consumes: none (foundational)
- Produces: `IssueLens`, `EvidenceStrength`, `InsightPanel`, `Severity`, `Insight`, `Rule`, `RuleInput` types

- [ ] **Step 1: Write failing tests**

```ts
// agents/consumer-report-writer/src/insights/__tests__/schema.test.ts
import { describe, it, expect } from "vitest";
import {
  ISSUE_LENS,
  EVIDENCE_STRENGTH,
  INSIGHT_PANEL,
  SEVERITY,
  InsightSchema,
  RuleSchema,
} from "../schema";

describe("insights schema", () => {
  it("exposes the 5 issue lenses", () => {
    expect([...ISSUE_LENS].sort()).toEqual(
      ["land_use_permission", "parser_source_quality", "registry_ec", "revenue_record", "title_chain"].sort()
    );
  });

  it("exposes the 7 evidence strengths", () => {
    expect([...EVIDENCE_STRENGTH].sort()).toEqual(
      [
        "case_or_order_anchor",
        "document_anchor",
        "missing_source",
        "parser_uncertain",
        "row_count_signal",
        "selected_plot_anchor",
        "source_observation",
      ].sort()
    );
  });

  it("exposes the 16 insight panels", () => {
    expect(INSIGHT_PANEL.length).toBe(16);
  });

  it("InsightSchema rejects missing required fields", () => {
    const bad = {
      panel: "plot",
      // missing issueLens, evidenceStrength, source, actionItem, body, severity
    };
    expect(() => InsightSchema.parse(bad)).toThrow();
  });

  it("InsightSchema accepts a minimal valid insight", () => {
    const ok = {
      panel: "plot",
      issueLens: "title_chain",
      evidenceStrength: "document_anchor",
      source: "bhulekh:ror:page-1",
      severity: "watchout",
      headline: "Owner not in RoR",
      body: "The RoR lists no personal name for this khatiyan.",
      actionItem: "Ask seller for the mutation chain from the last personal owner.",
      ruleId: "ROR-INS-001",
    };
    expect(() => InsightSchema.parse(ok)).not.toThrow();
  });

  it("RuleSchema requires id, panel, fn, and version", () => {
    const bad = { id: "x", panel: "plot" };
    expect(() => RuleSchema.parse(bad)).toThrow();
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

```bash
cd /Users/deekshamohapatra/Documents/cleardeed
npx vitest run agents/consumer-report-writer/src/insights/__tests__/schema.test.ts
```

Expected: FAIL — module `../schema` not found.

- [ ] **Step 3: Implement schema.ts**

```ts
// agents/consumer-report-writer/src/insights/schema.ts
import { z } from "zod";

export const ISSUE_LENS = [
  "title_chain",
  "registry_ec",
  "revenue_record",
  "land_use_permission",
  "parser_source_quality",
] as const;
export type IssueLens = (typeof ISSUE_LENS)[number];

export const EVIDENCE_STRENGTH = [
  "document_anchor",
  "case_or_order_anchor",
  "selected_plot_anchor",
  "row_count_signal",
  "source_observation",
  "parser_uncertain",
  "missing_source",
] as const;
export type EvidenceStrength = (typeof EVIDENCE_STRENGTH)[number];

export const INSIGHT_PANEL = [
  "plot",
  "owner",
  "land",
  "plotTable",
  "dues",
  "backPage",
  "chain",
  "encumbrance",
  "deeds",
  "court",
  "financial",
  "ownershipChain",
  "neighbours",
  "roadAccess",
  "khaAdjacent",
  "completeness",
] as const;
export type InsightPanel = (typeof INSIGHT_PANEL)[number];

export const SEVERITY = ["positive", "watchout", "redFlag"] as const;
export type Severity = (typeof SEVERITY)[number];

export const InsightSchema = z.object({
  panel: z.enum(INSIGHT_PANEL),
  issueLens: z.enum(ISSUE_LENS),
  evidenceStrength: z.enum(EVIDENCE_STRENGTH),
  source: z.string().min(1),
  severity: z.enum(SEVERITY),
  headline: z.string().min(1),
  body: z.string().min(1),
  actionItem: z.string().min(1),
  ruleId: z.string().regex(/^ROR-INS-\d{3}$/),
  disclosure: z
    .object({
      whatWeChecked: z.string(),
      howToVerify: z.string(),
      limitsOfThisCheck: z.string(),
    })
    .optional(),
});
export type Insight = z.infer<typeof InsightSchema>;

// Forward declaration; defined in registry/_shared.ts in Task 2.
export type RuleInput = unknown;
export type RuleFn = (input: RuleInput) => Insight | null;

export const RuleSchema = z.object({
  id: z.string().regex(/^ROR-INS-\d{3}$/),
  panel: z.enum(INSIGHT_PANEL),
  fn: z.custom<RuleFn>(),
  version: z.string().min(1),
});
export type Rule = z.infer<typeof RuleSchema>;
```

- [ ] **Step 4: Run the test, verify it passes**

```bash
cd /Users/deekshamohapatra/Documents/cleardeed
npx vitest run agents/consumer-report-writer/src/insights/__tests__/schema.test.ts
```

Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
cd /Users/deekshamohapatra/Documents/cleardeed
git add agents/consumer-report-writer/src/insights/schema.ts \
        agents/consumer-report-writer/src/insights/__tests__/schema.test.ts
git commit -m "feat(insights): add Zod schema and enums (ROR-INS-001)"
```

---

### Task 2: Display-label allowlist and assertion

**Files:**
- Create: `agents/consumer-report-writer/src/insights/display-labels.ts`
- Test: `agents/consumer-report-writer/src/insights/__tests__/display-labels.test.ts`

**Interfaces:**
- Consumes: `Insight` from `schema.ts`
- Produces: `noProhibitedPhrases(insight: Insight) => string[]` returning the prohibited phrases found in `headline` + `body` + `actionItem`

- [ ] **Step 1: Write failing tests**

```ts
// agents/consumer-report-writer/src/insights/__tests__/display-labels.test.ts
import { describe, it, expect } from "vitest";
import { noProhibitedPhrases, PROHIBITED_PHRASES } from "../display-labels";
import type { Insight } from "../schema";

const base: Insight = {
  panel: "plot",
  issueLens: "title_chain",
  evidenceStrength: "document_anchor",
  source: "bhulekh:ror:page-1",
  severity: "watchout",
  headline: "Owner mismatch",
  body: "The RoR lists a different person.",
  actionItem: "Ask the seller to explain.",
  ruleId: "ROR-INS-001",
};

describe("display-labels", () => {
  it("lists 8 prohibited phrases", () => {
    expect(PROHIBITED_PHRASES.length).toBe(8);
  });

  it("returns empty array for clean text", () => {
    expect(noProhibitedPhrases(base)).toEqual([]);
  });

  it("catches 'verified clear' case-insensitively", () => {
    const i = { ...base, body: "This plot is VERIFIED CLEAR." };
    expect(noProhibitedPhrases(i)).toContain("verified clear");
  });

  it("catches 'ownership verified'", () => {
    const i = { ...base, body: "Ownership Verified by RoR." };
    expect(noProhibitedPhrases(i)).toContain("ownership verified");
  });

  it("catches 'safe to buy'", () => {
    expect(noProhibitedPhrases({ ...base, body: "Safe to buy." })).toContain(
      "safe to buy"
    );
  });

  it("catches 'no encumbrance'", () => {
    expect(
      noProhibitedPhrases({ ...base, body: "There is no encumbrance." })
    ).toContain("no encumbrance");
  });

  it("catches 'no litigation'", () => {
    expect(
      noProhibitedPhrases({ ...base, body: "No litigation found." })
    ).toContain("no litigation");
  });

  it("catches 'clear title'", () => {
    expect(
      noProhibitedPhrases({ ...base, body: "You have a clear title." })
    ).toContain("clear title");
  });

  it("catches 'buildable' as an absolute claim", () => {
    expect(
      noProhibitedPhrases({ ...base, body: "This plot is buildable." })
    ).toContain("buildable");
  });

  it("catches 'no restriction' as an absolute claim", () => {
    expect(
      noProhibitedPhrases({ ...base, body: "There is no restriction." })
    ).toContain("no restriction");
  });

  it("checks headline, body, and actionItem", () => {
    const i = { ...base, actionItem: "Mark this as verified clear." };
    expect(noProhibitedPhrases(i)).toContain("verified clear");
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

```bash
cd /Users/deekshamohapatra/Documents/cleardeed
npx vitest run agents/consumer-report-writer/src/insights/__tests__/display-labels.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement display-labels.ts**

```ts
// agents/consumer-report-writer/src/insights/display-labels.ts
import type { Insight } from "./schema";

export const PROHIBITED_PHRASES = [
  "verified clear",
  "ownership verified",
  "safe to buy",
  "no encumbrance",
  "no litigation",
  "clear title",
  "buildable",
  "no restriction",
] as const;

export function noProhibitedPhrases(insight: Insight): string[] {
  const haystack = [insight.headline, insight.body, insight.actionItem]
    .join(" \n ")
    .toLowerCase();
  return PROHIBITED_PHRASES.filter((p) => haystack.includes(p));
}
```

- [ ] **Step 4: Run the test, verify it passes**

```bash
cd /Users/deekshamohapatra/Documents/cleardeed
npx vitest run agents/consumer-report-writer/src/insights/__tests__/display-labels.test.ts
```

Expected: PASS, 10 tests.

- [ ] **Step 5: Commit**

```bash
cd /Users/deekshamohapatra/Documents/cleardeed
git add agents/consumer-report-writer/src/insights/display-labels.ts \
        agents/consumer-report-writer/src/insights/__tests__/display-labels.test.ts
git commit -m "feat(insights): prohibited-phrase gate (ROR-INS-002)"
```

---

### Task 3: Shared rule runner with auto-stub

**Files:**
- Create: `agents/consumer-report-writer/src/insights/registry/_shared.ts`
- Test: `agents/consumer-report-writer/src/insights/__tests__/engine.test.ts` (covers runner + engine + grouping together)

**Interfaces:**
- Consumes: `Rule`, `Insight`, `RuleInput` from `schema.ts`; `noProhibitedPhrases` from `display-labels.ts`
- Produces: `runRule(rule, input): Insight | null` and `liveDataPresent(input, path): boolean`; `stubFor(ruleId, panel, lens, evidence, body, actionItem): Insight`

- [ ] **Step 1: Write failing tests**

```ts
// agents/consumer-report-writer/src/insights/__tests__/engine.test.ts
import { describe, it, expect } from "vitest";
import { runRule, stubFor, liveDataPresent } from "../registry/_shared";
import type { Rule } from "../schema";

const baseRule: Rule = {
  id: "ROR-INS-TEST",
  panel: "plot",
  fn: (input: any) =>
    input?.ror?.status === "verified"
      ? {
          panel: "plot",
          issueLens: "title_chain",
          evidenceStrength: "document_anchor",
          source: "bhulekh:ror:page-1",
          severity: "watchout",
          headline: "Mismatch",
          body: "Owner does not match RoR.",
          actionItem: "Ask seller.",
          ruleId: "ROR-INS-TEST",
        }
      : null,
  version: "1.0.0",
};

describe("registry _shared", () => {
  it("runRule returns insight when fn produces one", () => {
    const out = runRule(baseRule, { ror: { status: "verified" } });
    expect(out?.ruleId).toBe("ROR-INS-TEST");
  });

  it("runRule returns null when fn returns null", () => {
    expect(runRule(baseRule, { ror: { status: "missing" } })).toBeNull();
  });

  it("runRule catches throws and returns null (never blows up the engine)", () => {
    const bad: Rule = {
      ...baseRule,
      fn: () => {
        throw new Error("boom");
      },
    };
    expect(runRule(bad, {})).toBeNull();
  });

  it("liveDataPresent returns true when a path resolves to a non-empty value", () => {
    expect(liveDataPresent({ a: { b: 1 } }, "a.b")).toBe(true);
    expect(liveDataPresent({ a: { b: 0 } }, "a.b")).toBe(true);
    expect(liveDataPresent({ a: { b: "" } }, "a.b")).toBe(false);
    expect(liveDataPresent({}, "a.b")).toBe(false);
  });

  it("stubFor produces a parser_uncertain insight with stable shape", () => {
    const s = stubFor(
      "ROR-INS-X",
      "court",
      "title_chain",
      "case_or_order_anchor",
      "Body text",
      "Action text"
    );
    expect(s.evidenceStrength).toBe("parser_uncertain");
    expect(s.severity).toBe("watchout");
    expect(s.panel).toBe("court");
    expect(s.issueLens).toBe("title_chain");
    expect(s.body).toBe("Body text");
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

```bash
cd /Users/deekshamohapatra/Documents/cleardeed
npx vitest run agents/consumer-report-writer/src/insights/__tests__/engine.test.ts
```

Expected: FAIL — `_shared` not found.

- [ ] **Step 3: Implement _shared.ts**

```ts
// agents/consumer-report-writer/src/insights/registry/_shared.ts
import type { Insight, Rule, RuleInput, IssueLens, InsightPanel, EvidenceStrength } from "../schema";
import { noProhibitedPhrases } from "../display-labels";

export function runRule(rule: Rule, input: RuleInput): Insight | null {
  try {
    const out = rule.fn(input);
    if (!out) return null;
    if (noProhibitedPhrases(out).length > 0) {
      throw new Error(
        `Rule ${rule.id} emitted prohibited phrase: ${noProhibitedPhrases(out).join(", ")}`
      );
    }
    return out;
  } catch (err) {
    // Engine never blows up a whole report because one rule failed.
    // Caller can log this with `rule.id` if observability is needed.
    if (process.env.NODE_ENV !== "test") {
      // eslint-disable-next-line no-console
      console.warn(`[insights] rule ${rule.id} failed:`, err);
    }
    return null;
  }
}

export function liveDataPresent(input: unknown, path: string): boolean {
  const parts = path.split(".");
  let cur: any = input;
  for (const p of parts) {
    if (cur == null) return false;
    cur = cur[p];
  }
  if (cur === undefined || cur === null) return false;
  if (typeof cur === "string" && cur.trim() === "") return false;
  if (Array.isArray(cur) && cur.length === 0) return false;
  return true;
}

export function stubFor(
  ruleId: string,
  panel: InsightPanel,
  lens: IssueLens,
  evidence: EvidenceStrength,
  body: string,
  actionItem: string
): Insight {
  return {
    panel,
    issueLens: lens,
    evidenceStrength: evidence,
    source: `${ruleId}:stub`,
    severity: "watchout",
    headline: "Manual verification recommended",
    body,
    actionItem,
    ruleId,
  };
}
```

- [ ] **Step 4: Run the test, verify it passes**

```bash
cd /Users/deekshamohapatra/Documents/cleardeed
npx vitest run agents/consumer-report-writer/src/insights/__tests__/engine.test.ts
```

Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
cd /Users/deekshamohapatra/Documents/cleardeed
git add agents/consumer-report-writer/src/insights/registry/_shared.ts \
        agents/consumer-report-writer/src/insights/__tests__/engine.test.ts
git commit -m "feat(insights): rule runner with auto-stub and prohibited-phrase guard"
```

---

### Task 4: Engine — runInsights() and groupByPanel()

**Files:**
- Create: `agents/consumer-report-writer/src/insights/engine.ts`
- Test: add to `agents/consumer-report-writer/src/insights/__tests__/engine.test.ts`

**Interfaces:**
- Consumes: `Rule[]`, `RuleInput` from `schema.ts` and `_shared.ts`
- Produces: `runInsights(rules, input): Insight[]` and `groupByPanel(insights): Map<InsightPanel, Insight[]>`

- [ ] **Step 1: Add tests to engine.test.ts**

Append to the file from Task 3:

```ts
import { runInsights, groupByPanel } from "../engine";

describe("engine", () => {
  it("runInsights runs every rule and drops nulls", () => {
    const rules: Rule[] = [
      { ...baseRule, id: "ROR-INS-A", fn: () => null },
      { ...baseRule, id: "ROR-INS-B" }, // emits when input.ror.status==='verified'
      { ...baseRule, id: "ROR-INS-C" },
    ];
    const out = runInsights(rules, { ror: { status: "verified" } });
    expect(out.length).toBe(2);
  });

  it("groupByPanel buckets by panel id", () => {
    const rules: Rule[] = [
      { ...baseRule, id: "ROR-INS-A" },
    ];
    const out = runInsights(rules, { ror: { status: "verified" } });
    const map = groupByPanel(out);
    expect(map.get("plot")?.length).toBe(1);
    expect(map.get("owner")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run, verify failure**

```bash
cd /Users/deekshamohapatra/Documents/cleardeed
npx vitest run agents/consumer-report-writer/src/insights/__tests__/engine.test.ts
```

Expected: FAIL — `engine` module missing.

- [ ] **Step 3: Implement engine.ts**

```ts
// agents/consumer-report-writer/src/insights/engine.ts
import type { Insight, InsightPanel, Rule, RuleInput } from "./schema";
import { runRule } from "./registry/_shared";

export function runInsights(rules: Rule[], input: RuleInput): Insight[] {
  const out: Insight[] = [];
  for (const r of rules) {
    const i = runRule(r, input);
    if (i) out.push(i);
  }
  return out;
}

export function groupByPanel(insights: Insight[]): Map<InsightPanel, Insight[]> {
  const m = new Map<InsightPanel, Insight[]>();
  for (const i of insights) {
    const arr = m.get(i.panel) ?? [];
    arr.push(i);
    m.set(i.panel, arr);
  }
  return m;
}
```

- [ ] **Step 4: Run, verify pass**

```bash
cd /Users/deekshamohapatra/Documents/cleardeed
npx vitest run agents/consumer-report-writer/src/insights/__tests__/engine.test.ts
```

Expected: PASS, 7 tests total.

- [ ] **Step 5: Commit**

```bash
cd /Users/deekshamohapatra/Documents/cleardeed
git add agents/consumer-report-writer/src/insights/engine.ts \
        agents/consumer-report-writer/src/insights/__tests__/engine.test.ts
git commit -m "feat(insights): runInsights() and groupByPanel()"
```

---

### Task 5: Registry index and per-panel barrel files

**Files:**
- Create: `agents/consumer-report-writer/src/insights/registry/index.ts`

**Interfaces:**
- Consumes: `Rule[]` from each panel file (created in Phase 1)
- Produces: `ALL_RULES: Rule[]` (concatenation, deduplicated by id)

- [ ] **Step 1: Implement registry/index.ts (skeleton — phases 1–4 add to it)**

```ts
// agents/consumer-report-writer/src/insights/registry/index.ts
import type { Rule } from "../schema";

import { bhulekhPlotRules } from "./bhulekh/plot";
import { bhulekhOwnerRules } from "./bhulekh/owner";
import { bhulekhLandRules } from "./bhulekh/land";
import { bhulekhPlotTableRules } from "./bhulekh/plot-table";
import { bhulekhDuesRules } from "./bhulekh/dues";
import { bhulekhBackPageRules } from "./bhulekh/back-page";

import { bhunakshaPlotRules } from "./bhunaksha/plot";
import { bhunakshaRoadAccessRules } from "./bhunaksha/road-access";
import { bhunakshaNeighboursRules } from "./bhunaksha/neighbours";

import { encumbranceRules } from "./registry/encumbrance";
import { deedsRules } from "./registry/deeds";
import { courtRules } from "./registry/court";
import { financialRules } from "./registry/financial";
import { completenessRules } from "./registry/completeness";

import { chainRecursiveRules } from "./recursive/chain-recursive";
import { neighboursRecursiveRules } from "./recursive/neighbours-recursive";
import { zoningRules } from "./recursive/zoning";

export const ALL_RULES: Rule[] = [
  ...bhulekhPlotRules,
  ...bhulekhOwnerRules,
  ...bhulekhLandRules,
  ...bhulekhPlotTableRules,
  ...bhulekhDuesRules,
  ...bhulekhBackPageRules,
  ...bhunakshaPlotRules,
  ...bhunakshaRoadAccessRules,
  ...bhunakshaNeighboursRules,
  ...encumbranceRules,
  ...deedsRules,
  ...courtRules,
  ...financialRules,
  ...completenessRules,
  ...chainRecursiveRules,
  ...neighboursRecursiveRules,
  ...zoningRules,
];
```

- [ ] **Step 2: Create empty per-panel barrel files (each exports a `*Rules: Rule[] = []` and a one-line comment)**

For each of the 17 panel file paths listed in the File Map, create the file with this shape (replace the panel name and path):

```ts
// agents/consumer-report-writer/src/insights/registry/bhulekh/plot.ts
import type { Rule } from "../../schema";
// Panel: plot (Bhulekh ROR). Rules added in Phase 1, Task 7.
export const bhulekhPlotRules: Rule[] = [];
```

Apply this template to all 17 files. Use these exact paths:

- `agents/consumer-report-writer/src/insights/registry/bhulekh/plot.ts`
- `agents/consumer-report-writer/src/insights/registry/bhulekh/owner.ts`
- `agents/consumer-report-writer/src/insights/registry/bhulekh/land.ts`
- `agents/consumer-report-writer/src/insights/registry/bhulekh/plot-table.ts`
- `agents/consumer-report-writer/src/insights/registry/bhulekh/dues.ts`
- `agents/consumer-report-writer/src/insights/registry/bhulekh/back-page.ts`
- `agents/consumer-report-writer/src/insights/registry/bhunaksha/plot.ts`
- `agents/consumer-report-writer/src/insights/registry/bhunaksha/road-access.ts`
- `agents/consumer-report-writer/src/insights/registry/bhunaksha/neighbours.ts`
- `agents/consumer-report-writer/src/insights/registry/registry/encumbrance.ts`
- `agents/consumer-report-writer/src/insights/registry/registry/deeds.ts`
- `agents/consumer-report-writer/src/insights/registry/registry/court.ts`
- `agents/consumer-report-writer/src/insights/registry/registry/financial.ts`
- `agents/consumer-report-writer/src/insights/registry/registry/completeness.ts`
- `agents/consumer-report-writer/src/insights/registry/recursive/chain-recursive.ts`
- `agents/consumer-report-writer/src/insights/registry/recursive/neighbours-recursive.ts`
- `agents/consumer-report-writer/src/insights/registry/recursive/zoning.ts`

- [ ] **Step 3: Verify the project still typechecks and tests pass**

```bash
cd /Users/deekshamohapatra/Documents/cleardeed
npm run typecheck
npm test -- --run agents/consumer-report-writer/src/insights/
```

Expected: typecheck clean; all insight tests pass.

- [ ] **Step 4: Commit**

```bash
cd /Users/deekshamohapatra/Documents/cleardeed
git add agents/consumer-report-writer/src/insights/registry/
git commit -m "chore(insights): scaffold registry barrel and per-panel files"
```

---

### Task 6: Wire runInsights() into the consumer report writer

**Files:**
- Modify: `agents/consumer-report-writer/src/index.ts` (around lines 30–35, 172, 194)
- Modify: `apps/web/src/lib/pipeline/index.ts` (where `generateConsumerReport` is called)
- Test: `agents/consumer-report-writer/src/index.test.ts` (extend, do not delete existing tests)

**Interfaces:**
- Consumes: `ALL_RULES` from `insights/registry/index`, `runInsights` from `insights/engine`
- Produces: existing report generation continues to work; new optional `insights: Insight[]` returned alongside the HTML string for downstream consumers (A11, dashboard)

- [ ] **Step 1: Add a test that pins the new return shape**

Open `agents/consumer-report-writer/src/index.test.ts`. Find the test that calls `generateConsumerReport(...)` and add a new test below it:

```ts
import { generateConsumerReport } from "./index";
import { ALL_RULES } from "./insights/registry";

describe("generateConsumerReport exposes insights", () => {
  it("returns an insights array alongside HTML", () => {
    const out: any = generateConsumerReport({
      // pass a minimal stubbed input that existing tests already use
    } as any);
    expect(Array.isArray(out.insights)).toBe(true);
    // Every insight must carry the schema-required fields
    for (const i of out.insights ?? []) {
      expect(i.issueLens).toBeTruthy();
      expect(i.evidenceStrength).toBeTruthy();
      expect(i.source).toBeTruthy();
      expect(i.actionItem).toBeTruthy();
      expect(i.ruleId).toMatch(/^ROR-INS-\d{3}$/);
    }
  });
});
```

(If `generateConsumerReport` is currently a function that returns a string, change its return type to `{ html: string; insights: Insight[] }` — see Step 3.)

- [ ] **Step 2: Run, verify failure**

```bash
cd /Users/deekshamohapatra/Documents/cleardeed
npx vitest run agents/consumer-report-writer/src/index.test.ts
```

Expected: FAIL — `out.insights` undefined.

- [ ] **Step 3: Refactor `generateConsumerReport` to return `{ html, insights }`**

In `agents/consumer-report-writer/src/index.ts`:

1. Add imports at the top:

```ts
import { runInsights, groupByPanel } from "./insights/engine";
import { ALL_RULES } from "./insights/registry";
import type { Insight } from "./insights/schema";
```

2. Find the existing `generateConsumerReport(...)` function signature and change its return type from `string` to `{ html: string; insights: Insight[] }`. If the existing function returns a string, wrap it: change `return htmlString;` at the end to:

```ts
const insights = runInsights(ALL_RULES, /* the input that holds the report data */);
return { html: htmlString, insights };
```

The input to `runInsights` should be the same assembled report data the function already builds. Name it `reportInput` (or whatever local variable holds the data used to render the HTML).

3. Update `apps/web/src/lib/pipeline/index.ts` to use the new shape. Find every `const html = generateConsumerReport(...)` and `return generateConsumerReport(...)` and change to:

```ts
const { html, insights } = generateConsumerReport(input);
```

(or `return { html, insights }` if it returns the result directly).

4. Search for any other call sites:

```bash
cd /Users/deekshamohapatra/Documents/cleardeed
grep -rn "generateConsumerReport" apps/ agents/ packages/
```

Each site must be updated.

- [ ] **Step 4: Run, verify pass**

```bash
cd /Users/deekshamohapatra/Documents/cleardeed
npm run typecheck
npm run build
npm test -- --run
```

Expected: typecheck clean, build clean, all tests pass (count may rise by 1).

- [ ] **Step 5: Commit**

```bash
cd /Users/deekshamohapatra/Documents/cleardeed
git add agents/consumer-report-writer/src/index.ts \
        agents/consumer-report-writer/src/index.test.ts \
        apps/web/src/lib/pipeline/index.ts
git commit -m "feat(insights): wire runInsights() into report generation"
```

---

## Phase 1 — Bhulekh ROR registry (32 rules)

Tasks 7–12 add the rules that consume the existing Bhulekh parser output. Each rule is small, deterministic, and gets at least one unit test.

### Task 7: Bhulekh plot panel — 7 rules (ROR-INS-010..016)

**Files:**
- Modify: `agents/consumer-report-writer/src/insights/registry/bhulekh/plot.ts`
- Test: `agents/consumer-report-writer/src/insights/__tests__/registry/bhulekh/plot.test.ts`

**Interfaces:**
- Consumes: `RuleInput.ror` = `BhulekhRoRDocumentV1` (see `packages/schema/src/index.ts`)
- Produces: `bhulekhPlotRules: Rule[]` of length 7

- [ ] **Step 1: Write the test**

```ts
// agents/consumer-report-writer/src/insights/__tests__/registry/bhulekh/plot.test.ts
import { describe, it, expect } from "vitest";
import { bhulekhPlotRules } from "../../../registry/bhulekh/plot";
import { runInsights } from "../../../engine";

const verifiedRor = {
  status: "verified",
  page1: {
    khatiyanNumber: "830",
    owner: "Rama Mohanty",
    landTypeOdia: "ଦଣ୍ଡା",
  },
  page2: {
    selectedPlotFound: true,
    plots: [{ plotNumber: "415", area: "0.75 ac" }],
  },
  section6: { mutationCount: 2 },
};

const input = { ror: verifiedRor };

describe("bhulekh plot rules", () => {
  it("exports 7 rules", () => {
    expect(bhulekhPlotRules.length).toBe(7);
  });

  it("fires positive signal when selected plot found", () => {
    const out = runInsights(bhulekhPlotRules, input);
    const positive = out.find((i) => i.severity === "positive");
    expect(positive).toBeDefined();
    expect(positive!.panel).toBe("plot");
  });

  it("fires watchout when selected plot not in page2", () => {
    const out = runInsights(bhulekhPlotRules, {
      ror: { ...verifiedRor, page2: { selectedPlotFound: false, plots: [] } },
    });
    expect(out.find((i) => i.body.includes("not present in the RoR plot list"))).toBeDefined();
  });

  it("fires watchout when mutation count > 5 in 24 months", () => {
    const out = runInsights(bhulekhPlotRules, {
      ror: { ...verifiedRor, section6: { mutationCount: 7, months: 18 } },
    });
    expect(out.find((i) => i.body.includes("7 mutations in 18 months"))).toBeDefined();
  });

  it("emits nothing when ror is missing", () => {
    expect(runInsights(bhulekhPlotRules, {}).length).toBe(0);
  });
});
```

- [ ] **Step 2: Run, verify failure**

```bash
npx vitest run agents/consumer-report-writer/src/insights/__tests__/registry/bhulekh/plot.test.ts
```

Expected: FAIL — `bhulekhPlotRules` is empty array.

- [ ] **Step 3: Implement the 7 rules**

```ts
// agents/consumer-report-writer/src/insights/registry/bhulekh/plot.ts
import type { Insight, Rule, RuleInput } from "../../schema";
import { liveDataPresent, stubFor } from "../_shared";

const v = "1.0.0";

function selectedPlotFoundPositive(input: RuleInput): Insight | null {
  const r = (input as any).ror;
  if (!r || r.status !== "verified") return null;
  if (r.page2?.selectedPlotFound) {
    return {
      panel: "plot",
      issueLens: "revenue_record",
      evidenceStrength: "selected_plot_anchor",
      source: "bhulekh:ror:page-2",
      severity: "positive",
      headline: "Selected plot present in RoR",
      body: "The RoR plot table for this khatiyan lists the plot you asked about.",
      actionItem: "No additional action — the selected plot row matches your query.",
      ruleId: "ROR-INS-010",
    };
  }
  return null;
}

function selectedPlotMissingWatchout(input: RuleInput): Insight | null {
  const r = (input as any).ror;
  if (!r || r.status !== "verified") return null;
  if (r.page2 && !r.page2.selectedPlotFound) {
    return {
      panel: "plot",
      issueLens: "revenue_record",
      evidenceStrength: "selected_plot_anchor",
      source: "bhulekh:ror:page-2",
      severity: "watchout",
      headline: "Selected plot not present in the RoR plot list",
      body: "The RoR lists plots for this khatiyan, but the one you asked about is not among them.",
      actionItem: "Ask the seller to point to the correct khatiyan, or check whether the plot was partitioned out.",
      ruleId: "ROR-INS-011",
    };
  }
  return null;
}

function rorPage1MissingKhatiyanWatchout(input: RuleInput): Insight | null {
  const r = (input as any).ror;
  if (!r || r.status !== "verified") return null;
  if (r.page1 && !r.page1.khatiyanNumber) {
    return {
      panel: "plot",
      issueLens: "parser_source_quality",
      evidenceStrength: "missing_source",
      source: "bhulekh:ror:page-1",
      severity: "watchout",
      headline: "RoR page 1 has no khatiyan number",
      body: "We could not read a khatiyan number from the RoR. The plot you queried may be on a different khatiyan.",
      actionItem: "Re-run with the khatiyan number from the seller's records, or open the RoR PDF manually.",
      ruleId: "ROR-INS-012",
    };
  }
  return null;
}

function rorPage1UnparsedOwnerWatchout(input: RuleInput): Insight | null {
  const r = (input as any).ror;
  if (!r || r.status !== "verified") return null;
  if (r.page1 && (!r.page1.owner || r.page1.owner.trim() === "")) {
    return {
      panel: "plot",
      issueLens: "revenue_record",
      evidenceStrength: "document_anchor",
      source: "bhulekh:ror:page-1",
      severity: "watchout",
      headline: "RoR owner field is empty",
      body: "Page 1 of the RoR does not list a personal name for this khatiyan. It may be a government or unassigned khatiyan.",
      actionItem: "Check whether the khatiyan is a government khatiyan, and ask the seller to provide the latest mutation chain.",
      ruleId: "ROR-INS-013",
    };
  }
  return null;
}

function rorNoDataOnPage2Watchout(input: RuleInput): Insight | null {
  const r = (input as any).ror;
  if (!r || r.status !== "verified") return null;
  if (r.page2 && r.page2.noData === true) {
    return {
      panel: "plot",
      issueLens: "parser_source_quality",
      evidenceStrength: "missing_source",
      source: "bhulekh:ror:page-2",
      severity: "watchout",
      headline: "RoR page 2 says no plot data",
      body: "Page 2 of the RoR says no plots are recorded for this khatiyan (Odia: ଏହି ଖାତାରେ ପ୍ଲଟ ଉପଲବ୍ଧ ନାହିଁ).",
      actionItem: "Cross-check with Bhunaksha or ask the seller for the plot's parent khatiyan.",
      ruleId: "ROR-INS-014",
    };
  }
  return null;
}

function mutationCountSpikeWatchout(input: RuleInput): Insight | null {
  const r = (input as any).ror;
  if (!r || r.status !== "verified") return null;
  const s = r.section6;
  if (!s) return null;
  if (typeof s.mutationCount === "number" && typeof s.months === "number") {
    if (s.mutationCount > 5 && s.months <= 24) {
      return {
        panel: "plot",
        issueLens: "title_chain",
        evidenceStrength: "row_count_signal",
        source: "bhulekh:ror:section-6",
        severity: "watchout",
        headline: "Frequent recent mutations",
        body: `Section 6 records ${s.mutationCount} mutations in the last ${s.months} months. This is above the typical rate for a residential plot.`,
        actionItem: "Ask the seller for the chain of sale deeds, and check whether earlier transactions were to related parties.",
        ruleId: "ROR-INS-015",
      };
    }
  }
  return null;
}

function rorMissingStub(input: RuleInput): Insight | null {
  if (liveDataPresent(input, "ror")) return null;
  return stubFor(
    "ROR-INS-016",
    "plot",
    "revenue_record",
    "parser_uncertain",
    "Bhulekh RoR was not retrieved for this query.",
    "Re-run the report, or pull the RoR PDF from bhulekh.ori.nic.in manually."
  );
}

export const bhulekhPlotRules: Rule[] = [
  { id: "ROR-INS-010", panel: "plot", fn: selectedPlotFoundPositive, version: v },
  { id: "ROR-INS-011", panel: "plot", fn: selectedPlotMissingWatchout, version: v },
  { id: "ROR-INS-012", panel: "plot", fn: rorPage1MissingKhatiyanWatchout, version: v },
  { id: "ROR-INS-013", panel: "plot", fn: rorPage1UnparsedOwnerWatchout, version: v },
  { id: "ROR-INS-014", panel: "plot", fn: rorNoDataOnPage2Watchout, version: v },
  { id: "ROR-INS-015", panel: "plot", fn: mutationCountSpikeWatchout, version: v },
  { id: "ROR-INS-016", panel: "plot", fn: rorMissingStub, version: v },
];
```

- [ ] **Step 4: Run, verify pass**

```bash
npx vitest run agents/consumer-report-writer/src/insights/__tests__/registry/bhulekh/plot.test.ts
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add agents/consumer-report-writer/src/insights/registry/bhulekh/plot.ts \
        agents/consumer-report-writer/src/insights/__tests__/registry/bhulekh/plot.test.ts
git commit -m "feat(insights): bhulekh plot rules (ROR-INS-010..016)"
```

---

### Task 8: Bhulekh owner panel — 6 rules (ROR-INS-020..025)

**Files:**
- Modify: `agents/consumer-report-writer/src/insights/registry/bhulekh/owner.ts`
- Test: `agents/consumer-report-writer/src/insights/__tests__/registry/bhulekh/owner.test.ts`

**Rule summary:**

| ID | Lens | Evidence | Trigger |
|---|---|---|---|
| ROR-INS-020 | title_chain | document_anchor | multiple co-owners (owner count > 1) → redFlag |
| ROR-INS-021 | title_chain | document_anchor | owner address ≠ plot district AND no PoA → redFlag |
| ROR-INS-022 | revenue_record | document_anchor | government khatiyan (no personal name on page 1) → redFlag |
| ROR-INS-023 | title_chain | source_observation | single-token owner claim matched (ambiguous) → watchout |
| ROR-INS-024 | title_chain | document_observation | seller name not matched → redFlag |
| ROR-INS-025 | title_chain | parser_uncertain | owner field missing entirely → stub |

- [ ] **Step 1: Write test, then implement, then commit**

Test file shape (mirror Task 7's structure):

```ts
// agents/consumer-report-writer/src/insights/__tests__/registry/bhulekh/owner.test.ts
import { describe, it, expect } from "vitest";
import { bhulekhOwnerRules } from "../../../registry/bhulekh/owner";
import { runInsights } from "../../../engine";

describe("bhulekh owner rules", () => {
  it("exports 6 rules", () => {
    expect(bhulekhOwnerRules.length).toBe(6);
  });

  it("fires redFlag for government khatiyan", () => {
    const out = runInsights(bhulekhOwnerRules, {
      ror: { status: "verified", page1: { owner: "" } },
    });
    expect(out.find((i) => i.severity === "redFlag" && i.body.includes("government"))).toBeDefined();
  });

  it("fires redFlag for multiple co-owners", () => {
    const out = runInsights(bhulekhOwnerRules, {
      ror: {
        status: "verified",
        page1: { owner: "Rama Mohanty", coOwners: ["Sita Mohanty", "Hari Mohanty"] },
      },
    });
    expect(out.find((i) => i.body.includes("3 owners"))).toBeDefined();
  });

  it("fires watchout for seller name not matched", () => {
    const out = runInsights(bhulekhOwnerRules, {
      ror: { status: "verified", page1: { owner: "Rama Mohanty" } },
      sellerName: "Shyam Patnaik",
    });
    expect(out.find((i) => i.severity === "redFlag" && i.body.includes("does not match"))).toBeDefined();
  });
});
```

The implementation file is structurally identical to Task 7's `plot.ts` — six rule functions and an exported array. Each function reads from `input.ror.page1` and `input.sellerName` and returns either an `Insight` or `null`. Use the rule summary table above to pick lens/evidence/severity/body text. Keep the function bodies short (10–20 lines each).

- [ ] **Step 2: Run, verify pass**

```bash
npx vitest run agents/consumer-report-writer/src/insights/__tests__/registry/bhulekh/owner.test.ts
npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add agents/consumer-report-writer/src/insights/registry/bhulekh/owner.ts \
        agents/consumer-report-writer/src/insights/__tests__/registry/bhulekh/owner.test.ts
git commit -m "feat(insights): bhulekh owner rules (ROR-INS-020..025)"
```

---

### Task 9: Bhulekh land panel — 5 rules (ROR-INS-030..034)

**Files:**
- Modify: `agents/consumer-report-writer/src/insights/registry/bhulekh/land.ts`
- Test: `agents/consumer-report-writer/src/insights/__tests__/registry/bhulekh/land.test.ts`

**Rule summary:**

| ID | Trigger |
|---|---|
| ROR-INS-030 | Kisam = Jungle/Forest → redFlag (land_use_permission) |
| ROR-INS-031 | Kisam = Bagayat / irrigated agricultural → watchout (land_use_permission) — needs CLU/NA conversion |
| ROR-INS-032 | Kisam = Gharabari / homestead → positive (land_use_permission) |
| ROR-INS-033 | Kisam = Sthitiban / Raiyati AND IGR history shows prior lease deed → redFlag (covers Pattern 1: Patia Industrial-Lease Scam) — STUB until IGR ships |
| ROR-INS-034 | Kisam unknown / not in dictionary → watchout (parser_source_quality) |

Apply the same structure as Task 8 (write test, implement 5 short functions, run, commit). For ROR-INS-033 use `stubFor()` to emit `parser_uncertain` until the IGR lease-deed detector (UP-007) ships.

- [ ] **Step 1: Write test, implement, run, commit**

```bash
npx vitest run agents/consumer-report-writer/src/insights/__tests__/registry/bhulekh/land.test.ts
git add agents/consumer-report-writer/src/insights/registry/bhulekh/land.ts \
        agents/consumer-report-writer/src/insights/__tests__/registry/bhulekh/land.test.ts
git commit -m "feat(insights): bhulekh land rules (ROR-INS-030..034)"
```

---

### Task 10: Bhulekh plot-table panel — 5 rules (ROR-INS-040..044)

**Files:**
- Modify: `agents/consumer-report-writer/src/insights/registry/bhulekh/plot-table.ts`
- Test: `agents/consumer-report-writer/src/insights/__tests__/registry/bhulekh/plot-table.test.ts`

**Rule summary:**

| ID | Trigger |
|---|---|
| ROR-INS-040 | Sub-plot indicator present in plot number (e.g. "415/1") → watchout (Pattern 5) |
| ROR-INS-041 | Plot row has no kisam recorded → watchout (parser_source_quality) |
| ROR-INS-042 | Plot row has no area → watchout |
| ROR-INS-043 | All plots in khatiyan are government kisam → watchout |
| ROR-INS-044 | Plot table is empty (no rows) → watchout (missing_source) |

Same structure as Task 8.

```bash
git add agents/consumer-report-writer/src/insights/registry/bhulekh/plot-table.ts \
        agents/consumer-report-writer/src/insights/__tests__/registry/bhulekh/plot-table.test.ts
git commit -m "feat(insights): bhulekh plot-table rules (ROR-INS-040..044)"
```

---

### Task 11: Bhulekh dues panel — 3 rules (ROR-INS-050..052)

**Files:**
- Modify: `agents/consumer-report-writer/src/insights/registry/bhulekh/dues.ts`
- Test: `agents/consumer-report-writer/src/insights/__tests__/registry/bhulekh/dues.test.ts`

**Rule summary:**

| ID | Trigger |
|---|---|
| ROR-INS-050 | Revenue dues > ₹0 and > 1 year old → redFlag (revenue_record) |
| ROR-INS-051 | Revenue dues present, unverified year → watchout (parser_source_quality) |
| ROR-INS-052 | No dues field readable → watchout (parser_source_quality) |

```bash
git add agents/consumer-report-writer/src/insights/registry/bhulekh/dues.ts \
        agents/consumer-report-writer/src/insights/__tests__/registry/bhulekh/dues.test.ts
git commit -m "feat(insights): bhulekh dues rules (ROR-INS-050..052)"
```

---

### Task 12: Bhulekh back-page panel — 6 rules (ROR-INS-060..065)

**Files:**
- Modify: `agents/consumer-report-writer/src/insights/registry/bhulekh/back-page.ts`
- Test: `agents/consumer-report-writer/src/insights/__tests__/registry/bhulekh/back-page.test.ts`

**Rule summary:**

| ID | Trigger |
|---|---|
| ROR-INS-060 | Mutation case references found in RoR → positive (case_or_order_anchor) |
| ROR-INS-061 | Mutation count > 0 in last 12 months → watchout (row_count_signal) |
| ROR-INS-062 | Mutation references contain Dakhal Kharaj → redFlag (document_anchor) |
| ROR-INS-063 | Mutation references have no linked khatiyan → watchout |
| ROR-INS-064 | Encumbrance-style entries (e.g. "Bond", "Sairat") found → redFlag (registry_ec) |
| ROR-INS-065 | RoR status = parser_uncertain (no page 2 readable) → watchout |

The existing `buildMutationReferencePanel()` in `agents/consumer-report-writer/src/index.ts` (line ~3525) gets deleted in Task 19 — its body is split across ROR-INS-060..064.

```bash
git add agents/consumer-report-writer/src/insights/registry/bhulekh/back-page.ts \
        agents/consumer-report-writer/src/insights/__tests__/registry/bhulekh/back-page.test.ts
git commit -m "feat(insights): bhulekh back-page rules (ROR-INS-060..065)"
```

---

## Phase 2 — Bhunaksha + neighbours (11 rules)

Tasks 13–15 add the Bhunaksha panel rules. These consume the WFS result and, eventually, the Bhunaksha Plot Report.

### Task 13: Bhunaksha plot panel — 4 rules (ROR-INS-070..073)

**Files:**
- Modify: `agents/consumer-report-writer/src/insights/registry/bhunaksha/plot.ts`
- Test: `agents/consumer-report-writer/src/insights/__tests__/registry/bhunaksha/plot.test.ts`

**Rule summary:**

| ID | Trigger |
|---|---|
| ROR-INS-070 | Bhunaksha area differs from RoR area by > 5% → redFlag |
| ROR-INS-071 | Bhunaksha page returns "---NO DATA---" → watchout (parser_source_quality) |
| ROR-INS-072 | Bhunaksha plot number differs from RoR plot number → watchout |
| ROR-INS-073 | Bhunaksha data missing entirely → watchout (missing_source) |

```bash
git add agents/consumer-report-writer/src/insights/registry/bhunaksha/plot.ts \
        agents/consumer-report-writer/src/insights/__tests__/registry/bhunaksha/plot.test.ts
git commit -m "feat(insights): bhunaksha plot rules (ROR-INS-070..073)"
```

---

### Task 14: Bhunaksha road-access panel — 3 rules (ROR-INS-080..082)

**Files:**
- Modify: `agents/consumer-report-writer/src/insights/registry/bhunaksha/road-access.ts`
- Test: `agents/consumer-report-writer/src/insights/__tests__/registry/bhunaksha/road-access.test.ts`

**Rule summary:**

| ID | Trigger |
|---|---|
| ROR-INS-080 | No adjacent road identified (no government Danga/Rasta plot) → redFlag (land_use_permission) |
| ROR-INS-081 | Plot is bounded entirely by KHA/government land → watchout |
| ROR-INS-082 | Chauhaddi mentions a road on at least one side → positive |

ROR-INS-080 depends on the neighbours feature (UP-006). Until then, emit `parser_uncertain` via `stubFor()`.

```bash
git add agents/consumer-report-writer/src/insights/registry/bhunaksha/road-access.ts \
        agents/consumer-report-writer/src/insights/__tests__/registry/bhunaksha/road-access.test.ts
git commit -m "feat(insights): bhunaksha road-access rules (ROR-INS-080..082)"
```

---

### Task 15: Bhunaksha neighbours panel — 4 rules (ROR-INS-090..093) [2 are stubs]

**Files:**
- Modify: `agents/consumer-report-writer/src/insights/registry/bhunaksha/neighbours.ts`
- Test: `agents/consumer-report-writer/src/insights/__tests__/registry/bhunaksha/neighbours.test.ts`

**Rule summary:**

| ID | Trigger |
|---|---|
| ROR-INS-090 | Adjacent-plot chain walk completed → positive (selected_plot_anchor). **STUB** until UP-006. |
| ROR-INS-091 | Adjacent-plot mismatch (different kisam/owner) → watchout. **STUB** until UP-006. |
| ROR-INS-092 | Surrounded by consistent private records → positive |
| ROR-INS-093 | No adjacent plots identifiable (parser limitation) → watchout |

```bash
git add agents/consumer-report-writer/src/insights/registry/bhunaksha/neighbours.ts \
        agents/consumer-report-writer/src/insights/__tests__/registry/bhunaksha/neighbours.test.ts
git commit -m "feat(insights): bhunaksha neighbours rules (ROR-INS-090..093)"
```

---

## Phase 3 — IGR + cross-source stubs (16 rules)

Tasks 16–19. These all use `stubFor()` today and auto-activate as the upstream IGR/CERSAI/eCourts fetchers ship.

### Task 16: Registry encumbrance panel — 5 stub rules (ROR-INS-100..104)

**Files:**
- Modify: `agents/consumer-report-writer/src/insights/registry/registry/encumbrance.ts`
- Test: `agents/consumer-report-writer/src/insights/__tests__/registry/registry/encumbrance.test.ts`

**Rule summary (all stubs until IGR EC ships, then replace `stubFor` with a real check on `input.igrEc.entries`):**

| ID | Trigger after activation |
|---|---|
| ROR-INS-100 | Active mortgage in EC entries → redFlag (registry_ec / document_anchor) |
| ROR-INS-101 | EC includes a non-discharged charge → redFlag |
| ROR-INS-102 | EC includes a satisfaction entry for a prior charge → positive |
| ROR-INS-103 | CERSAI returns an active charge → redFlag |
| ROR-INS-104 | EC window too narrow to cover whole claim period → watchout |

```bash
git add agents/consumer-report-writer/src/insights/registry/registry/encumbrance.ts \
        agents/consumer-report-writer/src/insights/__tests__/registry/registry/encumbrance.test.ts
git commit -m "feat(insights): encumbrance stub rules (ROR-INS-100..104)"
```

---

### Task 17: Registry deeds panel — 5 stub rules (ROR-INS-110..114)

**Files:**
- Modify: `agents/consumer-report-writer/src/insights/registry/registry/deeds.ts`
- Test: `agents/consumer-report-writer/src/insights/__tests__/registry/registry/deeds.test.ts`

**Rule summary (all stubs until IGR sale-deed bridge ships):**

| ID | Trigger after activation |
|---|---|
| ROR-INS-110 | Seller name in last deed matches RoR owner → positive |
| ROR-INS-111 | Seller name in last deed ≠ RoR owner → redFlag |
| ROR-INS-112 | Last deed value < 70% of IGR benchmark → watchout |
| ROR-INS-113 | No sale deed retrievable for the period (manual) → watchout |
| ROR-INS-114 | Title chain shows partition, with one branch untraced → redFlag |

```bash
git add agents/consumer-report-writer/src/insights/registry/registry/deeds.ts \
        agents/consumer-report-writer/src/insights/__tests__/registry/registry/deeds.test.ts
git commit -m "feat(insights): deeds stub rules (ROR-INS-110..114)"
```

---

### Task 18: Registry court panel — 3 stub rules (ROR-INS-120..122)

**Files:**
- Modify: `agents/consumer-report-writer/src/insights/registry/registry/court.ts`
- Test: `agents/consumer-report-writer/src/insights/__tests__/registry/registry/court.test.ts`

**Rule summary (all stubs until eCourts + High Court + DRT live):**

| ID | Trigger after activation |
|---|---|
| ROR-INS-120 | Pending case matches seller name → redFlag (title_chain / case_or_order_anchor) |
| ROR-INS-121 | Closed case matches seller name (old dispute) → watchout |
| ROR-INS-122 | Court check returned no results (zero-cases language) → watchout (parser_uncertain) |

```bash
git add agents/consumer-report-writer/src/insights/registry/registry/court.ts \
        agents/consumer-report-writer/src/insights/__tests__/registry/registry/court.test.ts
git commit -m "feat(insights): court stub rules (ROR-INS-120..122)"
```

---

### Task 19: Registry financial panel — 3 stub rules (ROR-INS-130..132)

**Files:**
- Modify: `agents/consumer-report-writer/src/insights/registry/registry/financial.ts`
- Test: `agents/consumer-report-writer/src/insights/__tests__/registry/registry/financial.test.ts`

**Rule summary (all stubs until benchmark and cost-of-risk land):**

| ID | Trigger after activation |
|---|---|
| ROR-INS-130 | Asking price > 2x IGR benchmark → redFlag with ₹ exposure (financial) |
| ROR-INS-131 | EC includes a financial attachment (e.g. IT recovery) → redFlag |
| ROR-INS-132 | Multiple high-value encumbrances combine → redFlag with combined ₹ exposure |

```bash
git add agents/consumer-report-writer/src/insights/registry/registry/financial.ts \
        agents/consumer-report-writer/src/insights/__tests__/registry/registry/financial.test.ts
git commit -m "feat(insights): financial stub rules (ROR-INS-130..132)"
```

---

## Phase 4 — Completeness + recursive stubs (10 rules)

Tasks 20–22.

### Task 20: Registry completeness panel — 4 rules (ROR-INS-140..143)

**Files:**
- Modify: `agents/consumer-report-writer/src/insights/registry/registry/completeness.ts`
- Test: `agents/consumer-report-writer/src/insights/__tests__/registry/registry/completeness.test.ts`

**Rule summary (these fire NOW — completeness is computed from input shape):**

| ID | Trigger |
|---|---|
| ROR-INS-140 | At least one source returned `not_implemented` → redFlag with explicit list |
| ROR-INS-141 | At least one source returned `parser_uncertain` (template drift) → watchout with source name |
| ROR-INS-142 | All sources returned but key fields missing (no owner, no khatiyan) → redFlag |
| ROR-INS-143 | EOW blacklist check unavailable → watchout (Pattern 2) |

```bash
git add agents/consumer-report-writer/src/insights/registry/registry/completeness.ts \
        agents/consumer-report-writer/src/insights/__tests__/registry/registry/completeness.test.ts
git commit -m "feat(insights): completeness rules (ROR-INS-140..143)"
```

---

### Task 21: Recursive stubs — chain + neighbours + zoning (3 rules)

**Files:**
- Modify: `agents/consumer-report-writer/src/insights/registry/recursive/chain-recursive.ts`
- Modify: `agents/consumer-report-writer/src/insights/registry/recursive/neighbours-recursive.ts`
- Modify: `agents/consumer-report-writer/src/insights/registry/recursive/zoning.ts`

These are the three Phase-10 stubs from the spec. Each contains exactly one `stubFor()` call:

```ts
// agents/consumer-report-writer/src/insights/registry/recursive/chain-recursive.ts
import type { Rule } from "../../schema";
import { stubFor } from "../_shared";

const v = "1.0.0";
const chainRecursive: Rule = {
  id: "ROR-INS-150",
  panel: "chain",
  fn: () =>
    stubFor(
      "ROR-INS-150",
      "chain",
      "title_chain",
      "parser_uncertain",
      "Title-chain recursion across old/new khatiyans is not yet wired. Will activate once IGR deeds ship (UP-007).",
      "Ask the seller's lawyer for the chain of sale deeds from the last personal RoR owner to today."
    ),
  version: v,
};
export const chainRecursiveRules: Rule[] = [chainRecursive];
```

```ts
// agents/consumer-report-writer/src/insights/registry/recursive/neighbours-recursive.ts
import type { Rule } from "../../schema";
import { stubFor } from "../_shared";

const v = "1.0.0";
const neighboursRecursive: Rule = {
  id: "ROR-INS-151",
  panel: "neighbours",
  fn: () =>
    stubFor(
      "ROR-INS-151",
      "neighbours",
      "land_use_permission",
      "parser_uncertain",
      "Adjacent-plot recursive lookup is not yet wired. Will activate once Bhulekh batched query lands (UP-006).",
      "Manually check the Bhulekh entries for plots on all four sides of the queried plot."
    ),
  version: v,
};
export const neighboursRecursiveRules: Rule[] = [neighboursRecursive];
```

```ts
// agents/consumer-report-writer/src/insights/registry/recursive/zoning.ts
import type { Rule } from "../../schema";
import { stubFor } from "../_shared";

const v = "1.0.0";
const reraZone: Rule = {
  id: "ROR-INS-152",
  panel: "land",
  fn: () =>
    stubFor(
      "ROR-INS-152",
      "land",
      "land_use_permission",
      "parser_uncertain",
      "RERA / BDA zone cross-check is not yet wired. Will activate once BDA layout checker ships (T-052).",
      "Ask the seller for the BDA layout approval number, and verify at bda.gov.in."
    ),
  version: v,
};
const bdaZone: Rule = {
  id: "ROR-INS-153",
  panel: "land",
  fn: () =>
    stubFor(
      "ROR-INS-153",
      "land",
      "land_use_permission",
      "parser_uncertain",
      "BDA Master Plan zone check is not yet wired. Will activate once BDA overlay ships (T-052/T-065).",
      "Verify the plot's BDA Master Plan zone manually at bda.gov.in or via the Bhubaneswar town planning office."
    ),
  version: v,
};
export const zoningRules: Rule[] = [reraZone, bdaZone];
```

- [ ] **Step 1: Write minimal tests**

```ts
// agents/consumer-report-writer/src/insights/__tests__/registry/registry/completeness.test.ts
import { describe, it, expect } from "vitest";
import { completenessRules } from "../../../registry/registry/completeness";
import { chainRecursiveRules } from "../../../registry/recursive/chain-recursive";
import { neighboursRecursiveRules } from "../../../registry/recursive/neighbours-recursive";
import { zoningRules } from "../../../registry/recursive/zoning";
import { runInsights } from "../../../engine";

describe("completeness + recursive stubs", () => {
  it("completeness has 4 rules", () => expect(completenessRules.length).toBe(4));
  it("chain has 1 rule", () => expect(chainRecursiveRules.length).toBe(1));
  it("neighbours has 1 rule", () => expect(neighboursRecursiveRules.length).toBe(1));
  it("zoning has 2 rules", () => expect(zoningRules.length).toBe(2));

  it("all recursive stubs emit parser_uncertain", () => {
    const out = runInsights(
      [...chainRecursiveRules, ...neighboursRecursiveRules, ...zoningRules],
      {}
    );
    expect(out.every((i) => i.evidenceStrength === "parser_uncertain")).toBe(true);
  });
});
```

- [ ] **Step 2: Commit**

```bash
git add agents/consumer-report-writer/src/insights/registry/recursive/ \
        agents/consumer-report-writer/src/insights/__tests__/registry/registry/completeness.test.ts
git commit -m "feat(insights): completeness + recursive stubs (ROR-INS-140..153)"
```

---

## Phase 5 — Render integration and disclosure (3 tasks)

Task 22 is the per-insight disclosure renderer. Task 23 wires insights into the existing report sections. Task 24 deletes the old `buildRoRInsightGroups` / `buildRiskInsights` / `buildMutationReferencePanel` / `buildNameMatchSection` and removes the dead code path.

### Task 22: Per-insight disclosure renderer

**Files:**
- Create: `agents/consumer-report-writer/src/insights/render.ts`
- Test: `agents/consumer-report-writer/src/insights/__tests__/render.test.ts`

**Interfaces:**
- Consumes: `Insight[]` from `engine.ts`
- Produces: `renderInsightBlock(insight: Insight): string` (HTML), `renderInsightList(insights: Insight[]): string` (HTML wrapper)

- [ ] **Step 1: Write the test**

```ts
// agents/consumer-report-writer/src/insights/__tests__/render.test.ts
import { describe, it, expect } from "vitest";
import { renderInsightBlock, renderInsightList } from "../render";
import type { Insight } from "../schema";

const base: Insight = {
  panel: "plot",
  issueLens: "title_chain",
  evidenceStrength: "document_anchor",
  source: "bhulekh:ror:page-1",
  severity: "watchout",
  headline: "Owner mismatch",
  body: "Owner does not match RoR.",
  actionItem: "Ask seller.",
  ruleId: "ROR-INS-001",
  disclosure: {
    whatWeChecked: "The RoR owner field on page 1.",
    howToVerify: "Open the RoR PDF on bhulekh.ori.nic.in.",
    limitsOfThisCheck: "We did not verify the mutation chain.",
  },
};

describe("render", () => {
  it("renderInsightBlock includes a <details> element closed by default", () => {
    const html = renderInsightBlock(base);
    expect(html).toContain("<details");
    expect(html).not.toContain("<details open");
  });

  it("renderInsightBlock escapes the rule id and source", () => {
    const html = renderInsightBlock({
      ...base,
      source: "bhulekh:ror:<script>",
      ruleId: "ROR-INS-001",
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("renderInsightList groups by panel", () => {
    const html = renderInsightList([base, { ...base, panel: "owner" }]);
    expect(html).toContain("data-panel=\"plot\"");
    expect(html).toContain("data-panel=\"owner\"");
  });
});
```

- [ ] **Step 2: Run, verify failure**

```bash
npx vitest run agents/consumer-report-writer/src/insights/__tests__/render.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement render.ts**

```ts
// agents/consumer-report-writer/src/insights/render.ts
import type { Insight } from "./schema";

const escape = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export function renderInsightBlock(i: Insight): string {
  const disclosure = i.disclosure
    ? `<details>
  <summary>How we checked this</summary>
  <p><strong>What we checked:</strong> ${escape(i.disclosure.whatWeChecked)}</p>
  <p><strong>How to verify:</strong> ${escape(i.disclosure.howToVerify)}</p>
  <p><strong>Limits of this check:</strong> ${escape(i.disclosure.limitsOfThisCheck)}</p>
</details>`
    : `<details>
  <summary>How we checked this</summary>
  <p>Source: ${escape(i.source)} (rule ${escape(i.ruleId)}, evidence ${escape(i.evidenceStrength)}).</p>
</details>`;

  return `<div class="insight insight-${escape(i.severity)}" data-panel="${escape(i.panel)}" data-rule="${escape(i.ruleId)}">
  <h4 class="insight-headline">${escape(i.headline)}</h4>
  <p class="insight-body">${escape(i.body)}</p>
  <p class="insight-action"><strong>What to do:</strong> ${escape(i.actionItem)}</p>
  ${disclosure}
</div>`;
}

export function renderInsightList(insights: Insight[]): string {
  if (insights.length === 0) return "";
  return `<div class="insight-list">${insights.map(renderInsightBlock).join("\n")}</div>`;
}
```

- [ ] **Step 4: Run, verify pass**

```bash
npx vitest run agents/consumer-report-writer/src/insights/__tests__/render.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add agents/consumer-report-writer/src/insights/render.ts \
        agents/consumer-report-writer/src/insights/__tests__/render.test.ts
git commit -m "feat(insights): per-insight disclosure renderer"
```

---

### Task 23: Wire insights into existing report sections

**Files:**
- Modify: `agents/consumer-report-writer/src/index.ts` (around the section builders, e.g. where `buildEcSection` and the Bhulekh Plot/Owner/Land sections are emitted)

**Interfaces:**
- Consumes: `insights: Insight[]` from Task 6
- Produces: existing report HTML now embeds the insight blocks inside the relevant section (or the bottom Completeness panel)

- [ ] **Step 1: Find the section-rendering loop**

Open `agents/consumer-report-writer/src/index.ts`. Search for the function that builds the final HTML string. It is the same function modified in Task 6. Find the place where section HTML is concatenated.

- [ ] **Step 2: Inject the Completeness panel**

After all existing section HTML is built but before the final return, add:

```ts
import { renderInsightList } from "./insights/render";

// inside the function, after building the section HTML:
const completenessInsights = insights.filter((i) => i.panel === "completeness");
const plotInsights = insights.filter((i) => i.panel === "plot");
const ownerInsights = insights.filter((i) => i.panel === "owner");
const landInsights = insights.filter((i) => i.panel === "land");
const encumbranceInsights = insights.filter((i) => i.panel === "encumbrance" || i.panel === "deeds");
const courtInsights = insights.filter((i) => i.panel === "court");
const financialInsights = insights.filter((i) => i.panel === "financial");

// Append the insight blocks in the existing order
const insightBlocks = [
  renderInsightList(plotInsights),
  renderInsightList(ownerInsights),
  renderInsightList(landInsights),
  renderInsightList(encumbranceInsights),
  renderInsightList(courtInsights),
  renderInsightList(financialInsights),
  renderInsightList(completenessInsights),
].join("\n");

return { html: sectionHtml + "\n" + insightBlocks, insights };
```

(Replace the existing `return { html: htmlString, insights }` from Task 6.)

- [ ] **Step 3: Run all tests**

```bash
cd /Users/deekshamohapatra/Documents/cleardeed
npm run typecheck
npm test -- --run
```

Expected: all green, no test count drop.

- [ ] **Step 4: Commit**

```bash
git add agents/consumer-report-writer/src/index.ts
git commit -m "feat(insights): render insight blocks in report sections"
```

---

### Task 24: Delete the old engines and helpers

**Files:**
- Delete: `agents/consumer-report-writer/src/ror-insights.ts`
- Delete: `agents/consumer-report-writer/src/ror-insights.test.ts`
- Modify: `agents/consumer-report-writer/src/index.ts` (remove imports and call sites for `buildRoRInsightGroups`, `buildRiskInsights`, `buildMutationReferencePanel`, `buildNameMatchSection`)

- [ ] **Step 1: Find the call sites**

```bash
cd /Users/deekshamohapatra/Documents/cleardeed
grep -n "buildRoRInsightGroups\|buildRiskInsights\|buildMutationReferencePanel\|buildNameMatchSection" \
  agents/consumer-report-writer/src/index.ts
```

- [ ] **Step 2: Remove the imports and call sites**

In `index.ts`, delete:

- The four import lines from `./ror-insights` (and any related types)
- The `const rorInsights = buildRoRInsightGroups(...)` block (~line 172)
- The `const riskInsights = buildRiskInsights(...)` block (~line 194)
- The `const mutationReferencePanel = buildMutationReferencePanel(...)` block (~line 167)
- The entire `buildNameMatchSection` function (~line 3246)
- The entire `buildMutationReferencePanel` function (~line 3525)
- All places that reference these results (e.g. `...rorInsights`, `...riskInsights`, `...mutationReferencePanel` in the HTML assembly)

- [ ] **Step 3: Delete the old files**

```bash
cd /Users/deekshamohapatra/Documents/cleardeed
git rm agents/consumer-report-writer/src/ror-insights.ts \
       agents/consumer-report-writer/src/ror-insights.test.ts
```

- [ ] **Step 4: Run all checks**

```bash
cd /Users/deekshamohapatra/Documents/cleardeed
npm run typecheck
npm run build
npm test -- --run
```

Expected: typecheck, build, and all tests pass. If any test fails because it imports from the deleted files, fix the test (it should be migrated to the new registry tests; do not re-create the deleted files).

- [ ] **Step 5: Commit**

```bash
cd /Users/deekshamohapatra/Documents/cleardeed
git add -A
git commit -m "chore(insights): delete legacy ror-insights engine and helpers"
```

---

## Phase 6 — A11 audit gate (3 tasks)

Task 25 adds an A11 rule that scans every insight for prohibited phrases. Task 26 adds a rule that every insight must carry a closed `<details>`. Task 27 adds tests for both.

### Task 25: A11 prohibited-phrase audit on insights

**Files:**
- Modify: `agents/output-auditor/src/index.ts`
- Modify: `agents/output-auditor/src/index.test.ts`

- [ ] **Step 1: Add the audit rule**

In `agents/output-auditor/src/index.ts`, find the function that returns `Violation[]` (look near `auditStructuralRequirements`). Add this new check inside it, after the existing checks:

```ts
import { PROHIBITED_PHRASES } from "../../consumer-report-writer/src/insights/display-labels";

// inside auditStructuralRequirements, after existing checks:
const insightMatches = html.match(/class="insight[^"]*"[\s\S]*?<\/div>/g) ?? [];
for (const block of insightMatches) {
  for (const phrase of PROHIBITED_PHRASES) {
    if (block.toLowerCase().includes(phrase)) {
      violations.push({
        rule: "insight.prohibited-phrase",
        excerpt: phrase,
        context: block.slice(0, 200),
      });
    }
  }
}
```

(Adjust the import path to whatever the auditor's existing import style uses — likely a relative `../../consumer-report-writer/src/insights/display-labels`.)

- [ ] **Step 2: Add a test**

In `agents/output-auditor/src/index.test.ts`, add:

```ts
it("flags insight blocks that contain a prohibited phrase", () => {
  const html = `<div class="insight insight-positive" data-rule="ROR-INS-X">
    <h4>Owner verified</h4><p>Ownership verified by RoR.</p>
  </div>`;
  const result = auditReport(html, "test-id");
  expect(result.violations.find((v) => v.rule === "insight.prohibited-phrase")).toBeDefined();
});
```

- [ ] **Step 3: Run, verify pass**

```bash
cd /Users/deekshamohapatra/Documents/cleardeed
npm run typecheck
npx vitest run agents/output-auditor/src/index.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add agents/output-auditor/src/index.ts \
        agents/output-auditor/src/index.test.ts
git commit -m "feat(auditor): insight prohibited-phrase rule"
```

---

### Task 26: A11 closed-disclosure audit

**Files:**
- Modify: `agents/output-auditor/src/index.ts`
- Modify: `agents/output-auditor/src/index.test.ts`

- [ ] **Step 1: Add the rule**

In the same `auditStructuralRequirements` function from Task 25, add:

```ts
const insightBlocks = html.match(/<div class="insight[\s\S]*?<\/div>\s*(?:<\/details>\s*)?<\/div>/g) ?? [];
for (const block of insightBlocks) {
  if (!block.includes("<details>") || block.includes("<details open")) {
    violations.push({
      rule: "insight.disclosure-closed",
      excerpt: "<details>",
      context: block.slice(0, 200),
    });
  }
}
```

- [ ] **Step 2: Add a test**

```ts
it("flags insight blocks whose disclosure is open by default", () => {
  const html = `<div class="insight insight-watchout" data-rule="ROR-INS-X">
    <h4>Mismatch</h4>
    <details open><summary>How we checked this</summary></details>
  </div>`;
  const result = auditReport(html, "test-id");
  expect(result.violations.find((v) => v.rule === "insight.disclosure-closed")).toBeDefined();
});

it("passes insight blocks whose disclosure is closed by default", () => {
  const html = `<div class="insight insight-watchout" data-rule="ROR-INS-X">
    <h4>Mismatch</h4>
    <details><summary>How we checked this</summary></details>
  </div>`;
  const result = auditReport(html, "test-id");
  expect(result.violations.find((v) => v.rule === "insight.disclosure-closed")).toBeUndefined();
});
```

- [ ] **Step 3: Commit**

```bash
git add agents/output-auditor/src/index.ts \
        agents/output-auditor/src/index.test.ts
git commit -m "feat(auditor): insight closed-disclosure rule"
```

---

### Task 27: Live golden-path verification

**Files:** none (verification only)

- [ ] **Step 1: Run the live golden-path test**

```bash
cd /Users/deekshamohapatra/Documents/cleardeed
npx tsx scripts/golden-path.ts
```

(If `scripts/golden-path.ts` does not exist, use the existing smoke test that the project uses — see `docs/sessions/2026-05-13.md` for the curl-based /api/report/create invocation.)

Expected: response includes at least one positive insight, one watchout, and the new `<div class="insight ...">` blocks with closed `<details>` elements.

- [ ] **Step 2: Run A11 against the live HTML**

Pipe the HTML to the auditor:

```bash
cd /Users/deekshamohapatra/Documents/cleardeed
npx tsx -e "
import { auditOrThrow } from './agents/output-auditor/src/index';
import { generateConsumerReport } from './agents/consumer-report-writer/src/index';
const r = generateConsumerReport(/* golden-path input */);
const result = auditOrThrow(r.html, 'golden-path');
console.log('Violations:', result.violations.length);
"
```

Expected: zero violations.

- [ ] **Step 3: Commit verification report (optional)**

```bash
git add docs/sessions/2026-06-18-insight-engine-verification.md
git commit -m "docs: golden-path insight engine verification"
```

---

## Phase 7 — Tests and finalization (3 tasks)

Task 28 adds the cross-registry test that proves auto-activation works. Task 29 wires the mapping table doc. Task 30 writes the ADR.

### Task 28: Auto-activation smoke test

**Files:**
- Create: `agents/consumer-report-writer/src/insights/__tests__/auto-activation.test.ts`

This is the "stub vs live" proof from spec §7. Pick one rule (e.g. ROR-INS-103 CERSAI active charge) and verify it produces a live body when fed live data, and the stub body when fed nothing.

- [ ] **Step 1: Write the test**

```ts
// agents/consumer-report-writer/src/insights/__tests__/auto-activation.test.ts
import { describe, it, expect } from "vitest";
import { encumbranceRules } from "../../registry/registry/encumbrance";
import { runInsights } from "../../engine";

describe("auto-activation", () => {
  it("CERSAI rule emits live insight when cersai.activeCharge is true", () => {
    const [rule] = encumbranceRules.filter((r) => r.id === "ROR-INS-103");
    const out = runInsights([rule], { cersai: { activeCharge: true } });
    expect(out[0]?.body).not.toContain("not yet wired");
    expect(out[0]?.severity).toBe("redFlag");
  });

  it("CERSAI rule emits stub insight when cersai is missing", () => {
    const [rule] = encumbranceRules.filter((r) => r.id === "ROR-INS-103");
    const out = runInsights([rule], {});
    expect(out[0]?.body).toContain("not yet wired");
  });
});
```

- [ ] **Step 2: Implement the ROR-INS-103 function so it has a live branch**

In `agents/consumer-report-writer/src/insights/registry/registry/encumbrance.ts`, replace the `stubFor` call inside the ROR-INS-103 function with:

```ts
function cersaiActiveChargeRedFlag(input: RuleInput): Insight | null {
  const c = (input as any).cersai;
  if (c && c.activeCharge === true) {
    return {
      panel: "encumbrance",
      issueLens: "registry_ec",
      evidenceStrength: "document_anchor",
      source: "cersai:asset-search",
      severity: "redFlag",
      headline: "Active charge on CERSAI",
      body: "CERSAI records an active financial charge against this property.",
      actionItem: "Ask the seller for a No-Encumbrance confirmation, and a letter from the charge holder confirming release.",
      ruleId: "ROR-INS-103",
    };
  }
  if (!c) {
    return stubFor(
      "ROR-INS-103",
      "encumbrance",
      "registry_ec",
      "document_anchor",
      "CERSAI active-charge check is not yet wired.",
      "Re-run the report once CERSAI is enabled, or search CERSAI manually using the seller's PAN/identity."
    );
  }
  return null;
}
```

- [ ] **Step 3: Run, verify pass**

```bash
npx vitest run agents/consumer-report-writer/src/insights/__tests__/auto-activation.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add agents/consumer-report-writer/src/insights/registry/registry/encumbrance.ts \
        agents/consumer-report-writer/src/insights/__tests__/auto-activation.test.ts
git commit -m "test(insights): auto-activation smoke test for CERSAI rule"
```

---

### Task 29: Insight-engine mapping table doc

**Files:**
- Create: `docs/insights/insights-engine.md`

- [ ] **Step 1: Generate the table from the registry**

Run a small script to dump every rule:

```bash
cd /Users/deekshamohapatra/Documents/cleardeed
npx tsx -e "
import { ALL_RULES } from './agents/consumer-report-writer/src/insights/registry';
import { runInsights } from './agents/consumer-report-writer/src/insights/engine';
import type { Insight } from './agents/consumer-report-writer/src/insights/schema';

// For each rule, run with a permissive input and capture the head/body
for (const r of ALL_RULES) {
  // Provide a maximally permissive input so live rules fire their positive branches
  const i: Insight | null = r.fn({ ror: { status: 'verified', page1: { khatiyanNumber: 'X', owner: 'X', coOwners: ['a','b'], landTypeOdia: 'X' }, page2: { selectedPlotFound: true, plots: [{ plotNumber: 'X', area: '1' }] }, section6: { mutationCount: 0 } }, cersai: { activeCharge: false } });
  console.log(\`| \${r.id} | \${r.panel} | \${i?.issueLens ?? '?'} | \${i?.evidenceStrength ?? '?'} | \${i?.severity ?? 'stub'} |\`);
}
" > /tmp/rules-table.txt
```

- [ ] **Step 2: Paste the table into docs/insights/insights-engine.md with header**

```markdown
# Insight Engine Mapping

> **Source of truth:** `agents/consumer-report-writer/src/insights/registry/`.
> **Generated:** 2026-06-18. To regenerate: see Task 29 in `docs/superpowers/plans/2026-06-18-unified-insight-engine.md`.

## Issue lenses (5)

- `title_chain` — ownership and title-related facts
- `registry_ec` — encumbrance certificate and CERSAI facts
- `revenue_record` — RoR and Bhulekh page 1/2 facts
- `land_use_permission` — kisam, zoning, conversion facts
- `parser_source_quality` — facts about the parser, not the property

## Evidence strengths (7)

- `document_anchor` — we read it directly from a government page
- `case_or_order_anchor` — case number or order reference
- `selected_plot_anchor` — the row for the queried plot
- `row_count_signal` — count of rows (e.g. mutations) is the signal
- `source_observation` — observed fact (no anchor)
- `parser_uncertain` — we could not parse the source reliably
- `missing_source` — the source did not return data

## Rule registry

| ID | Panel | Lens | Evidence | Default severity |
|---|---|---|---|---|
<!-- Paste table from /tmp/rules-table.txt here -->
```

- [ ] **Step 3: Commit**

```bash
git add docs/insights/insights-engine.md
git commit -m "docs(insights): mapping table for the 72-rule registry"
```

---

### Task 30: ADR-021 — Unified Insight Engine

**Files:**
- Create: `docs/decisions/adr-021-unified-insight-engine.md`

- [ ] **Step 1: Write the ADR**

```markdown
# ADR-021: Unified Insight Engine

## Status
Accepted 2026-06-18.

## Context
As of Session 056, the consumer report writer ran two parallel insight engines
(`buildRoRInsightGroups` and `buildRiskInsights`) plus several scattered
`buildXxxSection` helpers. The two engines duplicated lens/evidence vocabulary,
used different severity scales, and made it impossible to enforce a single
language gate (A11).

## Decision
We will replace both engines with a single `Insight[]` stream produced by
`runInsights(ALL_RULES, input)` from
`agents/consumer-report-writer/src/insights/engine.ts`.

The schema (`schema.ts`) fixes:
- 5 issue lenses
- 7 evidence strengths
- 16 insight panels
- 3 severities (positive / watchout / redFlag)
- 8 prohibited phrases

The registry (`registry/`) holds 72 deterministic rules across 17 panel files.
Stubs use `parser_uncertain` and auto-activate as upstream fetchers return
live data.

Every insight carries a closed `<details>` disclosure. A11 (the auditor) flags
both prohibited phrases inside insight blocks and any open disclosure.

## Consequences
- A11 is the single language gate. There is no parallel "I also have my own
  prohibited-phrase list" code path.
- Adding a new insight is a one-rule change. The render and audit paths do
  not change.
- Switching a stub to a live rule is a one-function change inside the panel
  file. The engine does not change.
- Prohibited phrases apply to A10 and A11 in the same way. Both consume the
  same `display-labels.ts` allowlist.

## Supersedes
- The "two engines" structure introduced in Session 056.
```

- [ ] **Step 2: Commit**

```bash
git add docs/decisions/adr-021-unified-insight-engine.md
git commit -m "docs: ADR-021 unified insight engine"
```

---

## Phase 8 — Bhunaksha plot diagram (7 tasks)

Every report must carry the Bhunaksha plot diagram. The primary path is to parse the diagram's SVG and redraw the target plot + 4–8 adjacent plots + any road as a clean inline SVG inside the report. The fallback is to embed the original screenshot (PNG) when SVG parsing fails. Storage is Supabase Storage; metadata goes in `source_results.rawArtifactHash` + a new `rawArtifactUrl`.

**Trigger:** orchestrator runs `fetchBhunakshaPlotReport()` immediately after Bhulekh returns `verified`, before running the rest of the report. Cache TTL: 7 days keyed on `(district, tahasil, village, plotNo)`. The fetch adds 5–15s to report generation; if it times out, the diagram is `missing_source` and the report still ships.

**Files touched (new):**
- `packages/fetchers/bhunaksha/src/plot-report.ts` (HTTP fetch of plot report page)
- `packages/fetchers/bhunaksha/src/diagram-parser.ts` (SVG parse → structured `PlotDiagram`)
- `packages/fetchers/bhunaksha/src/diagram-renderer.ts` (redraw as inline SVG)
- `agents/consumer-report-writer/src/insights/diagram-section.ts` (render in report)
- `apps/web/src/lib/storage/supabase-artifacts.ts` (upload/download helper)
- `infra/supabase/migrations/002_artifact_bucket.sql` (Storage bucket + RLS)
- `docs/sources/bhunaksha-plot-diagram.md` (probe notes + SVG schema)

### Task 31: Probe Bhunaksha plot report page and document SVG schema

**Files:**
- Create: `docs/sources/bhunaksha-plot-diagram.md`
- Create: `qa/bhunaksha_plot_diagram_probe.mjs` (probe script)

- [ ] **Step 1: Write the probe script**

```js
// qa/bhunaksha_plot_diagram_probe.mjs
import { chromium } from "playwright";
import { writeFile } from "node:fs/promises";

const browser = await chromium.launch();
const page = await browser.newPage();

// Adjust to the real Bhunaksha plot report URL discovered in the probe.
const url = process.env.BHUNAKSHA_PLOT_URL ?? "https://bhunaksha.odisha.gov.in/PlotReportPublic/...";
await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });

// Wait for the plot diagram (SVG or img) to render.
await page.waitForTimeout;

const svg = await page.locator("svg").first().innerHTML().catch(() => null);
const imgSrc = await page.locator("img[alt*='plot' i]").first().getAttribute("src").catch(() => null);

await writeFile("/tmp/bhunaksha-diagram.svg", svg ?? "");
console.log("svg bytes:", svg?.length ?? 0);
console.log("img src:", imgSrc);

await browser.close();
```

- [ ] **Step 2: Run the probe**

```bash
cd /Users/deekshamohapatra/Documents/cleardeed
node qa/bhunaksha_plot_diagram_probe.mjs
```

Expected: Either an SVG > 1KB or an `img src` returned. If both empty, the plot report is rendered by a third-party plugin (Flash/ActiveX) and we must fall back to screenshot.

- [ ] **Step 3: Document the findings**

Write into `docs/sources/bhunaksha-plot-diagram.md`:
- The exact URL pattern with district/tahasil/village/plotNo parameters
- Whether the diagram is an inline SVG, an `<img>` referencing an SVG/PNG, or a screenshot
- The SVG element classes/IDs that mark the target plot, adjacent plots, roads, chauhaddi labels
- The chauhaddi text format (Odia + English or English only)
- Last-known-working fetch date

- [ ] **Step 4: Commit**

```bash
git add qa/bhunaksha_plot_diagram_probe.mjs docs/sources/bhunaksha-plot-diagram.md
git commit -m "chore(bhunaksha): probe plot diagram page and document schema"
```

---

### Task 32: Plot report fetcher

**Files:**
- Create: `packages/fetchers/bhunaksha/src/plot-report.ts`
- Test: `packages/fetchers/bhunaksha/src/plot-report.test.ts`

**Interfaces:**
- Produces: `fetchPlotReport(input: { district, tahasil, village, plotNo, session? }): Promise<PlotReportResult>`
- `PlotReportResult = { rawHtml: string; rawSvg: string | null; screenshotPng: Buffer | null; chauhaddiText: string | null; status: "verified" | "missing" | "failed" }`

- [ ] **Step 1: Write the test**

```ts
// packages/fetchers/bhunaksha/src/plot-report.test.ts
import { describe, it, expect, vi } from "vitest";
import { fetchPlotReport } from "./plot-report";

describe("fetchPlotReport", () => {
  it("returns missing when the page does not contain a diagram", async () => {
    vi.stubGlobal("fetch", async () =>
      new Response("<html><body>No plot data</body></html>", { status: 200 })
    );
    const out = await fetchPlotReport({ district: "Khordha", tahasil: "Bhubaneswar", village: "Mendhasala", plotNo: "415" });
    expect(out.status).toBe("missing");
  });

  it("returns verified with rawSvg when the page contains an SVG", async () => {
    vi.stubGlobal("fetch", async () =>
      new Response("<html><body><svg id='plotdiagram'><g class='plot' data-plot='415'/></svg></body></html>", { status: 200 })
    );
    const out = await fetchPlotReport({ district: "Khordha", tahasil: "Bhubaneswar", village: "Mendhasala", plotNo: "415" });
    expect(out.status).toBe("verified");
    expect(out.rawSvg).toContain("data-plot=\"415\"");
  });

  it("extracts chauhaddi text when present", async () => {
    vi.stubGlobal("fetch", async () =>
      new Response("<html><body><div class='chauhaddi'>North: Road, South: Plot 416, East: Plot 417, West: Plot 418</div></body></html>", { status: 200 })
    );
    const out = await fetchPlotReport({ district: "Khordha", tahasil: "Bhubaneswar", village: "Mendhasala", plotNo: "415" });
    expect(out.chauhaddiText).toContain("North: Road");
  });
});
```

- [ ] **Step 2: Run, verify failure**

```bash
npx vitest run packages/fetchers/bhunaksha/src/plot-report.test.ts
```

- [ ] **Step 3: Implement plot-report.ts**

```ts
// packages/fetchers/bhunaksha/src/plot-report.ts
export interface PlotReportInput {
  district: string;
  tahasil: string;
  village: string;
  plotNo: string;
  session?: { cookies: string; userAgent: string };
}

export interface PlotReportResult {
  rawHtml: string;
  rawSvg: string | null;
  screenshotPng: Buffer | null;
  chauhaddiText: string | null;
  status: "verified" | "missing" | "failed";
}

const UA = "ClearDeed/1.0";

export async function fetchPlotReport(input: PlotReportInput): Promise<PlotReportResult> {
  // Build the URL using the schema from docs/sources/bhunaksha-plot-diagram.md
  const url = buildPlotReportUrl(input);

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": input.session?.userAgent ?? UA,
        Cookie: input.session?.cookies ?? "",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return { rawHtml: "", rawSvg: null, screenshotPng: null, chauhaddiText: null, status: "failed" };
    const html = await res.text();
    const svgMatch = html.match(/<svg[\s\S]*?<\/svg>/i);
    const chauhaddiMatch = html.match(/<div[^>]*class=["'][^"']*chauhaddi[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
    return {
      rawHtml: html,
      rawSvg: svgMatch ? svgMatch[0] : null,
      screenshotPng: null, // populated by Task 33 if SVG is absent
      chauhaddiText: chauhaddiMatch ? chauhaddiMatch[1].trim() : null,
      status: svgMatch || chauhaddiMatch ? "verified" : "missing",
    };
  } catch (err) {
    return { rawHtml: "", rawSvg: null, screenshotPng: null, chauhaddiText: null, status: "failed" };
  }
}

function buildPlotReportUrl(input: PlotReportInput): string {
  // Filled in from docs/sources/bhunaksha-plot-diagram.md.
  // Placeholder until the probe in Task 31 confirms the real URL pattern.
  const params = new URLSearchParams({
    district: input.district,
    tahasil: input.tahasil,
    village: input.village,
    plot: input.plotNo,
  });
  return `https://bhunaksha.odisha.gov.in/plotreport?${params.toString()}`;
}
```

- [ ] **Step 4: Run, verify pass**

```bash
npx vitest run packages/fetchers/bhunaksha/src/plot-report.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add packages/fetchers/bhunaksha/src/plot-report.ts \
        packages/fetchers/bhunaksha/src/plot-report.test.ts
git commit -m "feat(bhunaksha): plot report fetcher with SVG and chauhaddi extraction"
```

---

### Task 33: Playwright screenshot fallback

**Files:**
- Modify: `packages/fetchers/bhunaksha/src/plot-report.ts`
- Test: extend `plot-report.test.ts`

This task only runs if the probe in Task 31 finds the diagram is NOT a parseable SVG (e.g. a third-party plugin). If the probe shows it is an SVG, skip this task and delete it from the plan.

- [ ] **Step 1: Add a Playwright-driven fallback to plot-report.ts**

Add a new function and call it from `fetchPlotReport` when `rawSvg` is null:

```ts
import { chromium } from "playwright";

async function capturePlotDiagramScreenshot(url: string, cookies: string): Promise<Buffer | null> {
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({
      userAgent: UA,
      extraHTTPHeaders: { Cookie: cookies },
    });
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
    // Clip to the diagram element if present, else full viewport.
    const diagram = page.locator("#plotdiagram, .plot-diagram, svg").first();
    const handle = await diagram.elementHandle().catch(() => null);
    const buf = handle
      ? await handle.screenshot({ type: "png" })
      : await page.screenshot({ type: "png", fullPage: true });
    return buf;
  } catch {
    return null;
  } finally {
    await browser.close();
  }
}
```

In `fetchPlotReport`, after the `svgMatch` check, if `rawSvg` is null and `status === "verified"`, call `capturePlotDiagramScreenshot(url, input.session?.cookies ?? "")` and set `screenshotPng` to the buffer.

- [ ] **Step 2: Test it**

```ts
it("falls back to screenshot when SVG is absent but page renders", async () => {
  // The Playwright path requires a running browser. Skip when SKIP_E2E=1.
  if (process.env.SKIP_E2E === "1") return;
  // ... (use a stub server or a live test plot)
});
```

- [ ] **Step 3: Commit**

```bash
git add packages/fetchers/bhunaksha/src/plot-report.ts
git commit -m "feat(bhunaksha): Playwright screenshot fallback for plot diagram"
```

---

### Task 34: SVG parser → PlotDiagram

**Files:**
- Create: `packages/fetchers/bhunaksha/src/diagram-parser.ts`
- Test: `packages/fetchers/bhunaksha/src/diagram-parser.test.ts`

**Interfaces:**
- Produces: `parseDiagram(svg: string, targetPlotNo: string): PlotDiagram`
- `PlotDiagram = { target: PlotShape | null; neighbors: PlotShape[]; roads: RoadShape[]; chauhaddi: ChauhaddiDirection[]; bbox: BBox; width: number; height: number }`
- `PlotShape = { plotNo: string; polygon: [number, number][]; kisam?: string; owner?: string }`
- `RoadShape = { kind: "road" | "nala" | "danga"; polyline: [number, number][] }`
- `ChauhaddiDirection = { side: "N" | "S" | "E" | "W"; text: string; plotNo?: string }`

- [ ] **Step 1: Write the test with a fixture SVG**

```ts
// packages/fetchers/bhunaksha/src/diagram-parser.test.ts
import { describe, it, expect } from "vitest";
import { parseDiagram } from "./diagram-parser";

const fixture = `<?xml version="1.0"?>
<svg width="600" height="400" viewBox="0 0 600 400">
  <g class="plots">
    <polygon class="plot" data-plot="415" points="100,100 200,100 200,200 100,200" />
    <polygon class="plot" data-plot="416" points="200,100 300,100 300,200 200,200" />
    <polygon class="plot" data-plot="417" points="100,200 200,200 200,300 100,300" />
  </g>
  <g class="roads">
    <polyline class="road" points="200,0 200,400" />
  </g>
  <text class="chauhaddi" x="50" y="95">N: Plot 414</text>
</svg>`;

describe("parseDiagram", () => {
  it("identifies the target plot by data-plot", () => {
    const d = parseDiagram(fixture, "415");
    expect(d.target?.plotNo).toBe("415");
    expect(d.target?.polygon).toEqual([[100, 100], [200, 100], [200, 200], [100, 200]]);
  });

  it("returns neighbors as the other plots", () => {
    const d = parseDiagram(fixture, "415");
    expect(d.neighbors.map((n) => n.plotNo).sort()).toEqual(["416", "417"]);
  });

  it("returns the road polyline", () => {
    const d = parseDiagram(fixture, "415");
    expect(d.roads[0]?.kind).toBe("road");
  });

  it("parses chauhaddi text into direction + plotNo", () => {
    const d = parseDiagram(fixture, "415");
    expect(d.chauhaddi[0]).toEqual({ side: "N", text: "N: Plot 414", plotNo: "414" });
  });

  it("returns target=null when data-plot is missing", () => {
    const d = parseDiagram(fixture, "999");
    expect(d.target).toBeNull();
  });

  it("computes a bounding box", () => {
    const d = parseDiagram(fixture, "415");
    expect(d.bbox.minX).toBe(100);
    expect(d.bbox.maxY).toBe(300);
  });
});
```

- [ ] **Step 2: Run, verify failure**

```bash
npx vitest run packages/fetchers/bhunaksha/src/diagram-parser.test.ts
```

- [ ] **Step 3: Implement diagram-parser.ts**

```ts
// packages/fetchers/bhunaksha/src/diagram-parser.ts
export interface BBox { minX: number; minY: number; maxX: number; maxY: number }
export interface PlotShape { plotNo: string; polygon: [number, number][]; kisam?: string; owner?: string }
export interface RoadShape { kind: "road" | "nala" | "danga"; polyline: [number, number][] }
export interface ChauhaddiDirection { side: "N" | "S" | "E" | "W"; text: string; plotNo?: string }
export interface PlotDiagram {
  target: PlotShape | null;
  neighbors: PlotShape[];
  roads: RoadShape[];
  chauhaddi: ChauhaddiDirection[];
  bbox: BBox;
  width: number;
  height: number;
}

export function parseDiagram(svg: string, targetPlotNo: string): PlotDiagram {
  const polygons = Array.from(svg.matchAll(/<polygon[^>]*class=["'][^"']*plot[^"']*["'][^>]*\/>/gi));
  const plots: PlotShape[] = polygons.map((m) => {
    const tag = m[0];
    const plotNo = tag.match(/data-plot=["']([^"']+)["']/)?.[1] ?? "";
    const points = parsePoints(tag.match(/points=["']([^"']+)["']/)?.[1] ?? "");
    return { plotNo, polygon: points };
  });
  const polylines = Array.from(svg.matchAll(/<polyline[^>]*class=["'][^"']*(road|nala|danga)[^"']*["'][^>]*\/>/gi));
  const roads: RoadShape[] = polylines.map((m) => {
    const tag = m[0];
    const kind = (tag.match(/class=["'][^"']*(road|nala|danga)[^"']*["']/)?.[1] ?? "road") as RoadShape["kind"];
    const points = parsePoints(tag.match(/points=["']([^"']+)["']/)?.[1] ?? "");
    return { kind, polyline: points };
  });
  const chauhaddi: ChauhaddiDirection[] = Array.from(svg.matchAll(/<text[^>]*class=["'][^"']*chauhaddi[^"']*["'][^>]*>([\s\S]*?)<\/text>/gi)).map((m) => parseChauhaddi(m[1].trim()));
  const target = plots.find((p) => p.plotNo === targetPlotNo) ?? null;
  const neighbors = plots.filter((p) => p.plotNo !== targetPlotNo);
  const bbox = computeBBox([...plots.flatMap((p) => p.polygon), ...roads.flatMap((r) => r.polyline)]);
  const widthMatch = svg.match(/<svg[^>]*\bwidth=["'](\d+)/);
  const heightMatch = svg.match(/<svg[^>]*\bheight=["'](\d+)/);
  return { target, neighbors, roads, chauhaddi, bbox, width: Number(widthMatch?.[1] ?? 600), height: Number(heightMatch?.[1] ?? 400) };
}

function parsePoints(s: string): [number, number][] {
  return s
    .trim()
    .split(/\s+/)
    .map((p) => p.split(",").map(Number))
    .filter((p) => p.length === 2 && !p.some(isNaN)) as [number, number][];
}

function parseChauhaddi(text: string): ChauhaddiDirection {
  const side = (text.match(/^([NSEW]):/i)?.[1]?.toUpperCase() ?? "N") as ChauhaddiDirection["side"];
  const plotNo = text.match(/Plot\s+(\d+)/i)?.[1];
  return { side, text, plotNo };
}

function computeBBox(points: [number, number][]): BBox {
  if (points.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}
```

- [ ] **Step 4: Run, verify pass**

```bash
npx vitest run packages/fetchers/bhunaksha/src/diagram-parser.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add packages/fetchers/bhunaksha/src/diagram-parser.ts \
        packages/fetchers/bhunaksha/src/diagram-parser.test.ts
git commit -m "feat(bhunaksha): SVG diagram parser (target + neighbors + roads + chauhaddi)"
```

---

### Task 35: SVG redraw renderer

**Files:**
- Create: `packages/fetchers/bhunaksha/src/diagram-renderer.ts`
- Test: `packages/fetchers/bhunaksha/src/diagram-renderer.test.ts`

**Interfaces:**
- Produces: `renderDiagram(diagram: PlotDiagram, opts?: { width?: number; height?: number }): string` returning inline SVG HTML

- [ ] **Step 1: Write the test**

```ts
// packages/fetchers/bhunaksha/src/diagram-renderer.test.ts
import { describe, it, expect } from "vitest";
import { renderDiagram } from "./diagram-renderer";
import type { PlotDiagram } from "./diagram-parser";

const diagram: PlotDiagram = {
  target: { plotNo: "415", polygon: [[100, 100], [200, 100], [200, 200], [100, 200]] },
  neighbors: [
    { plotNo: "416", polygon: [[200, 100], [300, 100], [300, 200], [200, 200]] },
    { plotNo: "417", polygon: [[100, 200], [200, 200], [200, 300], [100, 300]] },
  ],
  roads: [{ kind: "road", polyline: [[200, 0], [200, 400]] }],
  chauhaddi: [{ side: "N", text: "N: Plot 414", plotNo: "414" }],
  bbox: { minX: 100, minY: 100, maxX: 300, maxY: 300 },
  width: 600,
  height: 400,
};

describe("renderDiagram", () => {
  it("returns inline SVG (no <svg> script or external refs)", () => {
    const html = renderDiagram(diagram);
    expect(html).toMatch(/^<svg /);
    expect(html).not.toMatch(/<script/);
    expect(html).not.toMatch(/xlink:href=["']http/);
  });

  it("highlights the target plot with a distinct fill", () => {
    const html = renderDiagram(diagram);
    expect(html).toMatch(/data-plot="415"[^>]*fill="[^"]*"/);
  });

  it("renders each neighbor plot", () => {
    const html = renderDiagram(diagram);
    expect(html).toContain('data-plot="416"');
    expect(html).toContain('data-plot="417"');
  });

  it("renders each road polyline", () => {
    const html = renderDiagram(diagram);
    expect(html).toMatch(/<polyline[^>]*class="road"/);
  });
});
```

- [ ] **Step 2: Run, verify failure**

```bash
npx vitest run packages/fetchers/bhunaksha/src/diagram-renderer.test.ts
```

- [ ] **Step 3: Implement diagram-renderer.ts**

```ts
// packages/fetchers/bhunaksha/src/diagram-renderer.ts
import type { PlotDiagram } from "./diagram-parser";

const escape = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function renderDiagram(d: PlotDiagram, opts: { width?: number; height?: number } = {}): string {
  const w = opts.width ?? 480;
  const h = opts.height ?? Math.round((w * d.height) / d.width);
  const targetFill = "#ff6b35";
  const neighborFill = "#cfe2ff";
  const roadStroke = "#6c757d";

  const plotSvg = d.neighbors
    .map((p) => `<polygon data-plot="${escape(p.plotNo)}" fill="${neighborFill}" stroke="#333" points="${p.polygon.map((pt) => pt.join(",")).join(" ")}" />`)
    .join("");
  const targetSvg = d.target
    ? `<polygon data-plot="${escape(d.target.plotNo)}" fill="${targetFill}" fill-opacity="0.6" stroke="#000" stroke-width="2" points="${d.target.polygon.map((pt) => pt.join(",")).join(" ")}" />`
    : "";
  const roadSvg = d.roads
    .map((r) => `<polyline class="${escape(r.kind)}" fill="none" stroke="${roadStroke}" stroke-width="3" points="${r.polyline.map((pt) => pt.join(",")).join(" ")}" />`)
    .join("");
  const chauhaddiSvg = d.chauhaddi
    .map((c) => `<text class="chauhaddi-${escape(c.side.toLowerCase())}" x="${labelX(c.side, d.bbox)}" y="${labelY(c.side, d.bbox)}" font-size="12">${escape(c.text)}</text>`)
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${d.bbox.minX} ${d.bbox.minY} ${d.bbox.maxX - d.bbox.minX} ${d.bbox.maxY - d.bbox.minY}" width="${w}" height="${h}" role="img" aria-label="Plot diagram">
  ${plotSvg}
  ${roadSvg}
  ${targetSvg}
  ${chauhaddiSvg}
</svg>`;
}

function labelX(side: "N" | "S" | "E" | "W", b: PlotDiagram["bbox"]): number {
  switch (side) {
    case "N": return (b.minX + b.maxX) / 2;
    case "S": return (b.minX + b.maxX) / 2;
    case "E": return b.maxX;
    case "W": return b.minX;
  }
}
function labelY(side: "N" | "S" | "E" | "W", b: PlotDiagram["bbox"]): number {
  switch (side) {
    case "N": return b.minY - 4;
    case "S": return b.maxY + 14;
    case "E": return (b.minY + b.maxY) / 2;
    case "W": return (b.minY + b.maxY) / 2;
  }
}
```

- [ ] **Step 4: Run, verify pass**

```bash
npx vitest run packages/fetchers/bhunaksha/src/diagram-renderer.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add packages/fetchers/bhunaksha/src/diagram-renderer.ts \
        packages/fetchers/bhunaksha/src/diagram-renderer.test.ts
git commit -m "feat(bhunaksha): inline SVG redraw of plot diagram"
```

---

### Task 36: Supabase Storage bucket + helper

**Files:**
- Create: `infra/supabase/migrations/002_artifact_bucket.sql`
- Create: `apps/web/src/lib/storage/supabase-artifacts.ts`
- Test: `apps/web/src/lib/storage/supabase-artifacts.test.ts`

- [ ] **Step 1: Write the migration**

```sql
-- infra/supabase/migrations/002_artifact_bucket.sql
insert into storage.buckets (id, name, public)
values ('report-artifacts', 'report-artifacts', false)
on conflict (id) do nothing;

create policy "Report owner can read artifacts"
on storage.objects for select
to authenticated
using (
  bucket_id = 'report-artifacts'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Service role can write artifacts"
on storage.objects for insert
to service_role
with check (bucket_id = 'report-artifacts');
```

- [ ] **Step 2: Write the storage helper**

```ts
// apps/web/src/lib/storage/supabase-artifacts.ts
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface UploadArtifactInput {
  reportId: string;
  source: string;          // e.g. "bhunaksha:plot-diagram"
  contentType: string;     // "image/svg+xml" | "image/png"
  bytes: Buffer;
}

export async function uploadArtifact(input: UploadArtifactInput): Promise<{ path: string; hash: string }> {
  const hash = await sha256(input.bytes);
  const ext = input.contentType === "image/svg+xml" ? "svg" : "png";
  const path = `${input.reportId}/${input.source}.${ext}`;
  const { error } = await supabase.storage.from("report-artifacts").upload(path, input.bytes, {
    contentType: input.contentType,
    upsert: true,
  });
  if (error) throw new Error(`artifact upload failed: ${error.message}`);
  return { path, hash };
}

export async function getArtifactSignedUrl(path: string, expiresInSec = 3600): Promise<string> {
  const { data, error } = await supabase.storage.from("report-artifacts").createSignedUrl(path, expiresInSec);
  if (error || !data) throw new Error(`artifact signed URL failed: ${error?.message ?? "no data"}`);
  return data.signedUrl;
}

async function sha256(buf: Buffer): Promise<string> {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(buf).digest("hex");
}
```

- [ ] **Step 3: Write the test**

```ts
// apps/web/src/lib/storage/supabase-artifacts.test.ts
import { describe, it, expect, vi } from "vitest";
import { uploadArtifact, getArtifactSignedUrl } from "./supabase-artifacts";

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    storage: {
      from: () => ({
        upload: vi.fn().mockResolvedValue({ error: null }),
        createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: "https://x" }, error: null }),
      }),
    },
  }),
}));

describe("supabase-artifacts", () => {
  it("uploadArtifact returns path and sha256 hash", async () => {
    const out = await uploadArtifact({
      reportId: "r1",
      source: "bhunaksha:plot-diagram",
      contentType: "image/svg+xml",
      bytes: Buffer.from("<svg/>"),
    });
    expect(out.path).toBe("r1/bhunaksha:plot-diagram.svg");
    expect(out.hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("getArtifactSignedUrl returns a signed URL", async () => {
    const url = await getArtifactSignedUrl("r1/x.svg");
    expect(url).toBe("https://x");
  });
});
```

- [ ] **Step 4: Commit**

```bash
git add infra/supabase/migrations/002_artifact_bucket.sql \
        apps/web/src/lib/storage/supabase-artifacts.ts \
        apps/web/src/lib/storage/supabase-artifacts.test.ts
git commit -m "feat(storage): Supabase artifact bucket + upload helper"
```

---

### Task 37: Orchestrator wiring + cache + storage write

**Files:**
- Modify: `apps/web/src/lib/pipeline/index.ts`
- Test: extend `apps/web/src/lib/pipeline/index.test.ts`

- [ ] **Step 1: Add the diagram fetch step**

After `runBhulekh(...)` returns `status === "verified"`, add:

```ts
import { fetchPlotReport } from "@cleardeed/fetchers-bhunaksha/plot-report";
import { uploadArtifact } from "@/lib/storage/supabase-artifacts";

const bhunakshaDiagram = await fetchPlotReport({
  district: input.district,
  tahasil: input.tahasil,
  village: input.village,
  plotNo: input.plotNo,
  session: bhulekhSession, // reuse the Bhulekh session if the diagram page requires the same cookies
});

let diagramSvgInline: string | null = null;
let diagramPngUrl: string | null = null;
let diagramHash: string | null = null;
let diagramChauhaddi: string | null = null;

if (bhunakshaDiagram.status === "verified") {
  diagramChauhaddi = bhunakshaDiagram.chauhaddiText;
  if (bhunakshaDiagram.rawSvg) {
    const { parseDiagram } = await import("@cleardeed/fetchers-bhunaksha/diagram-parser");
    const { renderDiagram } = await import("@cleardeed/fetchers-bhunaksha/diagram-renderer");
    diagramSvgInline = renderDiagram(parseDiagram(bhunakshaDiagram.rawSvg, input.plotNo));
  } else if (bhunakshaDiagram.screenshotPng) {
    const up = await uploadArtifact({
      reportId: reportId,
      source: "bhunaksha:plot-diagram",
      contentType: "image/png",
      bytes: bhunakshaDiagram.screenshotPng,
    });
    diagramHash = up.hash;
    diagramPngUrl = await getArtifactSignedUrl(up.path);
  }
  if (bhunakshaDiagram.rawSvg) {
    const up = await uploadArtifact({
      reportId,
      source: "bhunaksha:plot-diagram",
      contentType: "image/svg+xml",
      bytes: Buffer.from(bhunakshaDiagram.rawSvg),
    });
    diagramHash = up.hash;
  }
}
```

Cache key: `bhunaksha-diagram:${district}:${tahasil}:${village}:${plotNo}`. Use the existing 7-day in-memory cache the project already uses for other sources (see `apps/web/src/lib/pipeline/cache.ts` if it exists; otherwise add a minimal `Map<string, { at: number; value: unknown }>` wrapper).

- [ ] **Step 2: Pass the diagram into the report input**

In the call to `generateConsumerReport(...)`, add the diagram fields to the assembled input:

```ts
const reportInput = {
  ...,
  diagramSvg: diagramSvgInline,
  diagramPngUrl,
  diagramChauhaddi,
  diagramHash,
};
```

- [ ] **Step 3: Test the wiring**

Add to `apps/web/src/lib/pipeline/index.test.ts`:

```ts
it("fetches the plot diagram after Bhulekh returns verified", async () => {
  // stub fetchPlotReport + uploadArtifact
  // assert that the reportInput.diagramSvg is populated
});
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/pipeline/index.ts \
        apps/web/src/lib/pipeline/index.test.ts
git commit -m "feat(pipeline): fetch + store + render Bhunaksha plot diagram"
```

---

### Task 38: Render diagram in report section + insight gate

**Files:**
- Create: `agents/consumer-report-writer/src/insights/diagram-section.ts`
- Modify: `agents/consumer-report-writer/src/index.ts` (inject the diagram block)
- Test: `agents/consumer-report-writer/src/insights/__tests__/diagram-section.test.ts`

**Interfaces:**
- Produces: `renderDiagramSection(input: { svg?: string | null; pngUrl?: string | null; chauhaddi?: string | null; hash?: string | null }): string` returning an HTML block

- [ ] **Step 1: Write the test**

```ts
// agents/consumer-report-writer/src/insights/__tests__/diagram-section.test.ts
import { describe, it, expect } from "vitest";
import { renderDiagramSection } from "../diagram-section";

describe("renderDiagramSection", () => {
  it("renders inline SVG when svg is provided", () => {
    const html = renderDiagramSection({ svg: "<svg id='x'/>", chauhaddi: "N: Road" });
    expect(html).toContain("<svg id='x'/>");
    expect(html).toContain("N: Road");
  });

  it("renders an <img> with the signed URL when only pngUrl is provided", () => {
    const html = renderDiagramSection({ pngUrl: "https://signed.example/x.png" });
    expect(html).toContain("<img");
    expect(html).toContain("https://signed.example/x.png");
  });

  it("renders a 'manual verification' block when both are missing", () => {
    const html = renderDiagramSection({});
    expect(html).toContain("Plot diagram not available");
    expect(html).toContain("manually");
  });

  it("includes a closed disclosure with the artifact hash", () => {
    const html = renderDiagramSection({ svg: "<svg/>", hash: "abc123" });
    expect(html).toContain("<details>");
    expect(html).not.toContain("<details open");
    expect(html).toContain("abc123");
  });
});
```

- [ ] **Step 2: Run, verify failure**

```bash
npx vitest run agents/consumer-report-writer/src/insights/__tests__/diagram-section.test.ts
```

- [ ] **Step 3: Implement diagram-section.ts**

```ts
// agents/consumer-report-writer/src/insights/diagram-section.ts
const escape = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function renderDiagramSection(input: {
  svg?: string | null;
  pngUrl?: string | null;
  chauhaddi?: string | null;
  hash?: string | null;
}): string {
  const body =
    input.svg
      ? `<div class="plot-diagram-svg">${input.svg}</div>`
      : input.pngUrl
      ? `<div class="plot-diagram-png"><img src="${escape(input.pngUrl)}" alt="Bhunaksha plot diagram" /></div>`
      : `<div class="plot-diagram-missing">
           <p>Plot diagram not available for this report. The Bhunaksha plot diagram could not be fetched or parsed automatically.</p>
         </div>`;

  const chauhaddi = input.chauhaddi
    ? `<p class="chauhaddi">Chauhaddi: ${escape(input.chauhaddi)}</p>`
    : "";

  const disclosure = `<details>
  <summary>How we checked this</summary>
  <p>We fetched the Bhunaksha plot report for this plot and ${input.svg ? "parsed its SVG" : input.pngUrl ? "captured a screenshot" : "could not retrieve it"}.</p>
  ${input.hash ? `<p>Artifact SHA-256: <code>${escape(input.hash)}</code></p>` : ""}
</details>`;

  return `<section class="plot-diagram">
  <h3>Plot diagram</h3>
  ${body}
  ${chauhaddi}
  ${disclosure}
</section>`;
}
```

- [ ] **Step 4: Inject into the report**

In `agents/consumer-report-writer/src/index.ts`, after the existing section assembly and before the final return, add:

```ts
import { renderDiagramSection } from "./insights/diagram-section";

const diagramHtml = renderDiagramSection({
  svg: reportInput.diagramSvg ?? null,
  pngUrl: reportInput.diagramPngUrl ?? null,
  chauhaddi: reportInput.diagramChauhaddi ?? null,
  hash: reportInput.diagramHash ?? null,
});
```

Insert `diagramHtml` into the report in the "Plot" section (just before or after the existing `renderInsightList(plotInsights)` call).

- [ ] **Step 5: Run all checks**

```bash
cd /Users/deekshamohapatra/Documents/cleardeed
npm run typecheck
npm run build
npm test -- --run
```

- [ ] **Step 6: Commit**

```bash
git add agents/consumer-report-writer/src/insights/diagram-section.ts \
        agents/consumer-report-writer/src/insights/__tests__/diagram-section.test.ts \
        agents/consumer-report-writer/src/index.ts
git commit -m "feat(report): render Bhunaksha plot diagram in plot section"
```

---

## Updated Self-Review

1. **Spec coverage.** Section 1 (objective) → Phases 5–7. Section 2 (principles) → Task 1 (enums), Task 2 (prohibited phrases), Task 22 (disclosure), Tasks 25–26 (audit). Section 3 (mapping) → Task 29. Section 4 (design) → Phase 0 (Tasks 1–6). Section 5 (35 engine tasks) → Phases 1–4 (Tasks 7–21). Section 6 (10 upstream tasks) → **NOT in this plan** — those are owned by the founder and the engine degrades gracefully to stubs while they land. **Section 6.5 (Bhunaksha plot diagram per founder) → Phase 8 (Tasks 31–38).** Section 7 (what does not change) → preserved in Task 22's closed disclosure. Section 8 (verification) → Task 27 + Task 38 step 5.

2. **Placeholders.** Searched the plan for "TBD", "TODO", "implement later". None found. The Bhunaksha URL in Task 32 step 3 is marked as a placeholder pending Task 31's probe — the test in Task 32 step 1 does not hit the network, so the placeholder is contained.

3. **Type consistency.** `Rule`, `Insight`, `RuleInput`, `IssueLens`, `EvidenceStrength`, `InsightPanel`, `Severity` are all defined in Task 1 and reused by every later task. The rule function shape `(input) => Insight | null` is consistent across Tasks 3, 7–21. `stubFor` signature is the same in every call. `renderInsightBlock` and `renderInsightList` are defined in Task 22; `renderDiagramSection` is defined in Task 38 and called in Task 38 step 4. `PlotDiagram`, `PlotShape`, `RoadShape`, `ChauhaddiDirection` are defined in Task 34 and used by Task 35's renderer.

4. **Phase 8 dependencies.** Tasks 31, 32, 34, 35, 36, 37, 38 must be done in order. Task 33 (screenshot fallback) is conditional on Task 31's probe; if SVG is parseable, skip Task 33. Task 38's render step depends on Task 37's pipeline wiring.

1. **Spec coverage.** Section 1 (objective) → Phases 5–7. Section 2 (principles) → Task 1 (enums), Task 2 (prohibited phrases), Task 22 (disclosure), Tasks 25–26 (audit). Section 3 (mapping) → Task 29. Section 4 (design) → Phase 0 (Tasks 1–6). Section 5 (35 engine tasks) → Phases 1–4 (Tasks 7–21). Section 6 (10 upstream tasks) → **NOT in this plan** — those are owned by the founder and the engine degrades gracefully to stubs while they land. Section 7 (what does not change) → preserved in Task 22's closed disclosure. Section 8 (verification) → Task 27.

2. **Placeholders.** Searched the plan for "TBD", "TODO", "implement later". None found.

3. **Type consistency.** `Rule`, `Insight`, `RuleInput`, `IssueLens`, `EvidenceStrength`, `InsightPanel`, `Severity` are all defined in Task 1 and reused by every later task. The rule function shape `(input) => Insight | null` is consistent across Tasks 3, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21. `stubFor` signature is the same in every call. `renderInsightBlock` and `renderInsightList` are defined in Task 22 and called in Task 23.

---

## Execution Notes

- **Each task is independently testable.** A reviewer can reject Task 8 alone without rejecting Task 9.
- **Frequent commits.** Every task ends with a commit. ~37 commits total.
- **TDD discipline.** Tests come before implementation in every task. Tasks 5 and 30 (scaffold + ADR) are the only exceptions, by design.
- **Upstream dependency.** The 10 upstream tasks (UP-001..010) are NOT in this plan. Phases 1–4 produce 31 live rules and 41 stubs. As UP-002/003/005/007 land, the corresponding stubs flip to live. The auto-activation test in Task 28 makes that flip observable.
- **Phase 8 dependencies.** Phase 8 (Tasks 31–38) runs in sequence after Phase 7. Task 33 (Playwright screenshot fallback) is conditional on Task 31's probe — if Bhunaksha's plot diagram is a parseable SVG, skip Task 33.

