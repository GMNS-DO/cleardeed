# PID Schema Wire-Up — Sub-Plan A

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Parent plan:** [2026-06-17-source-reliability-and-pid-foundation.md](2026-06-17-source-reliability-and-pid-foundation.md) (24-task, 6-phase, 16-week program).
> **This sub-plan covers Phase 0 foundation work specific to PID schema wiring.** Other sub-plans (B captcha-breaker, C Phase 1 unblock, D Phase 2 wire-up, E Phase 3 new sources, F Phase 4 PID v1) will be written separately.
> **Already done on this branch (commit history):** Task 0.1 — typed `isSourceFired` gate (Phase 0 starter).
> **Schema status:** All 29 PID tables exist in production Supabase (migrations 006 + 007 applied 2026-06-25). Schema is live; wire-up code does not exist.

**Goal:** Make the PID tables reachable from the Next.js pipeline. End-to-end demo: one real Bhulekh fetch result lands as one `pid_artifact` + one `pid_fact_assertion` + one `pid_event`, queryable from a test, and a typed TypeScript client exists for future sub-plans.

**Architecture:** New `apps/web/src/lib/pipeline/pid/` module with three layers: (1) typed DB client wrapping `supabaseAdmin()` for all 29 PID tables, (2) Zod-validated mappers that convert a `SourceResult` (the existing fetcher output envelope) into pid rows, (3) a one-call `recordFetchResult()` entry point that handles idempotent upsert on `(source_id, artifact_key)` and writes a `pid_event` for every fetch. Write path is non-blocking: PID write failures log + return null but never break the report (per D-024/D-025 — PID is a corpus layer, not a production gate).

**Tech Stack:** TypeScript, Vitest, Zod, Supabase JS SDK (already wired via `supabaseAdmin()` in [apps/web/src/lib/db.ts](apps/web/src/lib/db.ts)), SHA-256 via `node:crypto` (already used by Bhulekh fetcher).

## Global Constraints

- **Typed contracts:** Every PID write function must accept a Zod-validated input, not `any` or `unknown`. The mapper Zod schema is the single source of truth for what counts as a recordable fetch result.
- **Service-role only:** All PID writes go through `supabaseAdmin()` (service role) — the tables have RLS that blocks anon. This matches the existing pattern in [apps/web/src/lib/db.ts](apps/web/src/lib/db.ts:60).
- **Idempotency:** Re-running the same fetcher with the same input must not duplicate `pid_artifact` rows. Use `artifact_key` (deterministic hash of source + input + query) as the unique key. `pid_fact_assertions` and `pid_events` are append-only and use UUIDs — re-runs create new rows with the same `source_id` + `artifact_id` and a `metadata.rerun=true` flag.
- **Non-blocking:** A PID write failure must NEVER fail the report. The pipeline must log a warning and continue.
- **No schema changes:** Do not write new migrations in this sub-plan. The 29 tables are already live. If a needed field is missing, log a `pid_missing_field` event and skip the write — flag the gap in the plan.
- **Test isolation:** All tests mock the Supabase client. No live network. The smoke test in Task A.6 is the only one that hits the real DB, and it's gated on `RUN_PID_SMOKE=1` so CI never runs it.
- **Branch discipline:** One commit per task. Branch: `feat/source-reliability-and-pid-foundation` (already checked out).

---

## File Structure

### Files this plan creates
- `apps/web/src/lib/pipeline/pid/types.ts` — Zod schemas for the 4 PID write-input types (SourceArtifact, FactAssertionInput, EventInput, PropertyInput)
- `apps/web/src/lib/pipeline/pid/types.test.ts` — schema validation tests
- `apps/web/src/lib/pipeline/pid/client.ts` — typed DB client: `pidUpsertArtifact()`, `pidInsertFactAssertion()`, `pidInsertEvent()`, `pidUpsertProperty()` — one function per table, no shared mega-function
- `apps/web/src/lib/pipeline/pid/client.test.ts` — mock-supabase tests for each function
- `apps/web/src/lib/pipeline/pid/mapper.ts` — `mapSourceResultToPid(input: SourceResult): PidWritePayload` — pure function, no I/O
- `apps/web/src/lib/pipeline/pid/mapper.test.ts` — golden-path mapping tests (bhulekh + bhunaksha + nominatim + eCourts)
- `apps/web/src/lib/pipeline/pid/record-fetch-result.ts` — `recordFetchResult(sourceId, input, sourceResult, reportId): Promise<{ artifactId, factIds, eventId } | null>` — top-level entry point used by pipeline
- `apps/web/src/lib/pipeline/pid/record-fetch-result.test.ts` — full-path tests with mock client
- `apps/web/src/lib/pipeline/pid/keys.ts` — `computeArtifactKey(sourceId, input)` — deterministic SHA-256
- `apps/web/src/lib/pipeline/pid/keys.test.ts` — determinism + collision tests
- `apps/web/src/lib/pipeline/pid/README.md` — one-page developer reference for the module
- `qa/pid_smoke/khordha-report-1.json` — captured output from the smoke test (Task A.6)

### Files this plan modifies
- `apps/web/src/lib/pipeline/index.ts` — adds one call to `recordFetchResult()` inside `generateReportV11()` after each fetcher returns. Wrapped in try/catch. Gated on `PID_RECORDING_ENABLED=1` env var (default off — same posture as the existing `PID_SYNTHESIS_ENABLED` kill switch in [apps/web/src/lib/pipeline/index.ts:30](apps/web/src/lib/pipeline/index.ts#L30)).
- `apps/web/src/lib/pipeline/corpus.ts` — no longer a no-op stub; exports `readPidArtifactsForReport(reportId)` and `readPidEventsForProperty(propertyId)` so future sub-plans have a read path.
- `apps/web/src/lib/db.ts` — no change (the PID client lives in its own module to keep the existing db.ts focused on the reports/billing domain).

### Files this plan does NOT touch
- `apps/web/src/lib/pipeline/contracts/*.ts` — fetcher contracts are the input to the mapper, not the mapper's concern
- `packages/fetchers/*` — fetchers don't know about PID
- `infra/supabase/migrations/*` — schema is done
- `agents/consumer-report-writer/*` — report rendering doesn't read PID in this sub-plan (that's Sub-plan F)
- The 11 uncommitted files in the working tree (CRED design, MapCard v0/v1/v1.1, etc.) — orthogonal workstreams, not PID

---

## Task A.1: PID artifact-key derivation (`keys.ts`)

**Files:**
- Create: `apps/web/src/lib/pipeline/pid/keys.ts`
- Create: `apps/web/src/lib/pipeline/pid/keys.test.ts`

**Interfaces:**
- Consumes: `sourceId: string`, `input: Record<string, unknown>` (the fetcher's query input — GPS coords, plot number, village, etc.)
- Produces: `computeArtifactKey(sourceId, input): string` — hex SHA-256, 64 chars, deterministic for the same `(sourceId, JSON.stringify(input))`

**Why first:** Every other PID write depends on the artifact key for idempotency. This task is the foundation.

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/lib/pipeline/pid/keys.test.ts
import { describe, it, expect } from "vitest";
import { computeArtifactKey } from "./keys";

describe("computeArtifactKey", () => {
  it("returns 64-char hex SHA-256", () => {
    const key = computeArtifactKey("bhulekh", { village: "Mendhasala", plot: 309 });
    expect(key).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic for the same input", () => {
    const a = computeArtifactKey("bhulekh", { village: "Mendhasala", plot: 309 });
    const b = computeArtifactKey("bhulekh", { village: "Mendhasala", plot: 309 });
    expect(a).toBe(b);
  });

  it("produces different keys for different sourceIds", () => {
    const a = computeArtifactKey("bhulekh", { village: "Mendhasala", plot: 309 });
    const b = computeArtifactKey("bhunaksha", { village: "Mendhasala", plot: 309 });
    expect(a).not.toBe(b);
  });

  it("produces different keys for different inputs", () => {
    const a = computeArtifactKey("bhulekh", { village: "Mendhasala", plot: 309 });
    const b = computeArtifactKey("bhulekh", { village: "Mendhasala", plot: 415 });
    expect(a).not.toBe(b);
  });

  it("normalizes key order so {a:1,b:2} === {b:2,a:1}", () => {
    const a = computeArtifactKey("bhulekh", { a: 1, b: 2 });
    const b = computeArtifactKey("bhulekh", { b: 2, a: 1 });
    expect(a).toBe(b);
  });

  it("throws on empty sourceId", () => {
    expect(() => computeArtifactKey("", { x: 1 })).toThrow(/sourceId/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm vitest run src/lib/pipeline/pid/keys.test.ts`
Expected: FAIL with "Cannot find module './keys'"

- [ ] **Step 3: Write the implementation**

```ts
// apps/web/src/lib/pipeline/pid/keys.ts
import { createHash } from "node:crypto";

/**
 * Deterministic artifact key for a fetcher call.
 *
 * Same (sourceId, input) → same key. Used as the unique constraint
 * on pid_artifacts.artifact_key for idempotent re-runs.
 *
 * Key order is normalized by sorting object keys before stringifying,
 * so {a:1,b:2} and {b:2,a:1} produce the same key.
 */
export function computeArtifactKey(
  sourceId: string,
  input: Record<string, unknown>
): string {
  if (!sourceId || typeof sourceId !== "string") {
    throw new Error("computeArtifactKey: sourceId is required and must be a string");
  }
  const normalized = JSON.stringify(input, Object.keys(input).sort());
  return createHash("sha256")
    .update(`${sourceId}:${normalized}`)
    .digest("hex");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && pnpm vitest run src/lib/pipeline/pid/keys.test.ts`
Expected: 6 passing

- [ ] **Step 5: Commit**

```bash
cd /Users/deekshamohapatra/Documents/cleardeed
git add apps/web/src/lib/pipeline/pid/keys.ts apps/web/src/lib/pipeline/pid/keys.test.ts
git commit -m "feat(pid): deterministic artifact-key derivation (Task A.1)"
```

---

## Task A.2: PID write-input Zod schemas (`types.ts`)

**Files:**
- Create: `apps/web/src/lib/pipeline/pid/types.ts`
- Create: `apps/web/src/lib/pipeline/pid/types.test.ts`

**Interfaces:**
- Consumes: nothing (this is the source of truth for input shapes)
- Produces: `SourceArtifactSchema`, `FactAssertionInputSchema`, `EventInputSchema`, `PropertyInputSchema` — all Zod schemas, all exported with their inferred TS types

**Why second:** Other tasks import these schemas. The mapper (Task A.4) and the client (Task A.3) both consume them.

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/lib/pipeline/pid/types.test.ts
import { describe, it, expect } from "vitest";
import {
  SourceArtifactSchema,
  FactAssertionInputSchema,
  EventInputSchema,
  PropertyInputSchema,
} from "./types";

describe("SourceArtifactSchema", () => {
  it("accepts a valid bhulekh artifact", () => {
    const ok = SourceArtifactSchema.safeParse({
      artifactKey: "a".repeat(64),
      sourceId: "bhulekh",
      artifactType: "html",
      storagePath: "pid-artifacts/bhulekh/aabb.html",
      sha256: "b".repeat(64),
      contentType: "text/html",
      byteSize: 12345,
      httpStatus: 200,
      query: { village: "Mendhasala", plot: 309 },
    });
    expect(ok.success).toBe(true);
  });

  it("rejects artifactKey that is not 64 hex chars", () => {
    const bad = SourceArtifactSchema.safeParse({
      artifactKey: "short",
      sourceId: "bhulekh",
      artifactType: "html",
      storagePath: "x",
      sha256: "b".repeat(64),
    });
    expect(bad.success).toBe(false);
  });

  it("rejects unknown sourceId", () => {
    const bad = SourceArtifactSchema.safeParse({
      artifactKey: "a".repeat(64),
      sourceId: "made-up-source",
      artifactType: "html",
      storagePath: "x",
      sha256: "b".repeat(64),
    });
    expect(bad.success).toBe(false);
  });
});

describe("FactAssertionInputSchema", () => {
  it("requires subject_type, predicate, source_id", () => {
    const ok = FactAssertionInputSchema.safeParse({
      subjectType: "property",
      subjectId: "11111111-1111-1111-1111-111111111111",
      predicate: "owner_name",
      rawValue: "Ram Kumar",
      sourceId: "bhulekh",
    });
    expect(ok.success).toBe(true);
  });

  it("rejects when subject_id is not a uuid", () => {
    const bad = FactAssertionInputSchema.safeParse({
      subjectType: "property",
      subjectId: "not-a-uuid",
      predicate: "owner_name",
      sourceId: "bhulekh",
    });
    expect(bad.success).toBe(false);
  });
});

describe("EventInputSchema", () => {
  it("accepts event without propertyId (lead-only signal)", () => {
    const ok = EventInputSchema.safeParse({
      eventType: "lead_signal",
      sourceId: "bhulekh",
      eventSummary: "raw text signal in OCR chunk",
    });
    expect(ok.success).toBe(true);
  });
});

describe("PropertyInputSchema", () => {
  it("accepts a minimal property", () => {
    const ok = PropertyInputSchema.safeParse({
      district: "Khordha",
      tahasil: "Bhubaneswar",
      village: "Mendhasala",
    });
    expect(ok.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm vitest run src/lib/pipeline/pid/types.test.ts`
Expected: FAIL with "Cannot find module './types'"

- [ ] **Step 3: Write the implementation**

```ts
// apps/web/src/lib/pipeline/pid/types.ts
import { z } from "zod";

// Valid source IDs are the same set the pipeline's fire gate uses.
// Mirrored here so the schema can validate without importing the fire module.
export const PID_SOURCE_IDS = [
  "bhulekh",
  "bhunaksha",
  "nominatim",
  "ecourts",
  "igr-ec",
  "cersai",
  "rccms",
  "circle-rate",
  "bda-zoning",
  "larr",
  "igr-sro",
  "igr-bmv",
  "stamp-duty",
  "igr-daily-bulletin",
  "public-dashboard",
  "govt-fee",
  "igr-certified-copy",
  "bhunaksha-plot-report",
  "high-court",
  "drt",
  "rera-odisha",
  "bmc-tax",
  "bhuvan",
  "bda-approved-layouts",
  "mca21",
  "nclt-ibbi",
  "eow-odisha",
  "dilrmp",
] as const;
export type PidSourceId = (typeof PID_SOURCE_IDS)[number];

const hex64 = z.string().regex(/^[0-9a-f]{64}$/, "must be 64 hex chars");
const uuid = z.string().uuid();
const iso8601 = z.string().datetime({ offset: true });

export const SourceArtifactSchema = z.object({
  artifactKey: hex64,
  sourceId: z.enum(PID_SOURCE_IDS),
  collectionRunId: uuid.optional(),
  artifactType: z.string().min(1),
  documentType: z.string().optional(),
  sourceUrl: z.string().url().optional(),
  sourceOrigin: z.string().optional(),
  accessMode: z.string().optional(),
  query: z.record(z.unknown()).default({}),
  storagePath: z.string().min(1),
  storageBucket: z.string().optional(),
  storageKey: z.string().optional(),
  sha256: hex64,
  byteSize: z.number().int().nonnegative().optional(),
  contentType: z.string().optional(),
  httpStatus: z.number().int().min(100).max(599).optional(),
  retrievedAt: iso8601.optional(),
  metadata: z.record(z.unknown()).default({}),
});
export type SourceArtifact = z.infer<typeof SourceArtifactSchema>;

export const FactAssertionInputSchema = z.object({
  subjectType: z.string().min(1),
  subjectId: uuid.optional(),
  predicate: z.string().min(1),
  rawValue: z.string().optional(),
  normalizedValue: z.string().optional(),
  valueJson: z.record(z.unknown()).default({}),
  sourceId: z.enum(PID_SOURCE_IDS),
  artifactId: uuid.optional(),
  pageNumber: z.number().int().positive().optional(),
  charStart: z.number().int().nonnegative().optional(),
  charEnd: z.number().int().nonnegative().optional(),
  bbox: z.record(z.unknown()).optional(),
  confidence: z.number().min(0).max(1).optional(),
  metadata: z.record(z.unknown()).default({}),
});
export type FactAssertionInput = z.infer<typeof FactAssertionInputSchema>;

export const EventInputSchema = z.object({
  eventType: z.string().min(1),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  recordedAt: iso8601.optional(),
  propertyId: uuid.optional(),
  documentId: uuid.optional(),
  caseId: uuid.optional(),
  chargeId: uuid.optional(),
  sourceId: z.enum(PID_SOURCE_IDS),
  artifactId: uuid.optional(),
  eventSummary: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  reviewStatus: z
    .enum(["unreviewed", "approved", "rejected", "needs_followup", "lead_only"])
    .default("lead_only"),
  metadata: z.record(z.unknown()).default({}),
});
export type EventInput = z.infer<typeof EventInputSchema>;

export const PropertyInputSchema = z.object({
  canonicalKey: z.string().optional(),
  state: z.string().default("Odisha"),
  district: z.string().optional(),
  tahasil: z.string().optional(),
  village: z.string().optional(),
  mouza: z.string().optional(),
  khataNumber: z.string().optional(),
  plotNumber: z.string().optional(),
  surveyNumber: z.string().optional(),
  areaValue: z.number().nonnegative().optional(),
  areaUnit: z.string().optional(),
  geometryRef: z.string().optional(),
  identityConfidence: z.number().min(0).max(1).optional(),
  metadata: z.record(z.unknown()).default({}),
});
export type PropertyInput = z.infer<typeof PropertyInputSchema>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && pnpm vitest run src/lib/pipeline/pid/types.test.ts`
Expected: 8 passing

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/pipeline/pid/types.ts apps/web/src/lib/pipeline/pid/types.test.ts
git commit -m "feat(pid): write-input Zod schemas for the 4 PID write types (Task A.2)"
```

---

## Task A.3: Typed DB client (`client.ts`)

**Files:**
- Create: `apps/web/src/lib/pipeline/pid/client.ts`
- Create: `apps/web/src/lib/pipeline/pid/client.test.ts`

**Interfaces:**
- Consumes: `supabaseAdmin()` from [apps/web/src/lib/db.ts](apps/web/src/lib/db.ts:60) + the Zod schemas from Task A.2
- Produces: 4 functions — `pidUpsertArtifact()`, `pidInsertFactAssertion()`, `pidInsertEvent()`, `pidUpsertProperty()`. Each is independently tested and independently callable. Each returns the inserted row's UUID, or `null` on failure (with a console.warn).

**Why third:** The client is the only code that touches Supabase for PID. By isolating it, the rest of the module (mapper, record-fetch-result) is pure / testable without mocks.

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/lib/pipeline/pid/client.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock supabaseAdmin BEFORE importing client
vi.mock("../../db", () => ({
  supabaseAdmin: vi.fn(),
}));

import { supabaseAdmin } from "../../db";
import {
  pidUpsertArtifact,
  pidInsertFactAssertion,
  pidInsertEvent,
  pidUpsertProperty,
} from "./client";

function makeMockSupabase(impl: (table: string) => Promise<{ data: unknown; error: unknown }>) {
  return {
    from: vi.fn((table: string) => ({
      upsert: vi.fn((payload: unknown, opts: unknown) => ({
        select: vi.fn(() => ({
          single: vi.fn(() => impl(table)),
        })),
        then: undefined,
        _payload: payload,
        _opts: opts,
      })),
      insert: vi.fn((payload: unknown) => ({
        select: vi.fn(() => ({
          single: vi.fn(() => impl(table)),
        })),
        _payload: payload,
      })),
    })),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("pidUpsertArtifact", () => {
  it("returns the inserted artifact id on success", async () => {
    const sb = makeMockSupabase(async () => ({ data: { id: "art-1" }, error: null }));
    vi.mocked(supabaseAdmin).mockReturnValue(sb as never);
    const id = await pidUpsertArtifact({
      artifactKey: "a".repeat(64),
      sourceId: "bhulekh",
      artifactType: "html",
      storagePath: "p",
      sha256: "b".repeat(64),
      query: {},
      metadata: {},
    });
    expect(id).toBe("art-1");
    expect(sb.from).toHaveBeenCalledWith("pid_artifacts");
  });

  it("returns null when supabase returns an error", async () => {
    const sb = makeMockSupabase(async () => ({ data: null, error: { message: "x" } }));
    vi.mocked(supabaseAdmin).mockReturnValue(sb as never);
    const id = await pidUpsertArtifact({
      artifactKey: "a".repeat(64),
      sourceId: "bhulekh",
      artifactType: "html",
      storagePath: "p",
      sha256: "b".repeat(64),
      query: {},
      metadata: {},
    });
    expect(id).toBeNull();
  });
});

describe("pidInsertFactAssertion", () => {
  it("returns the inserted fact id on success", async () => {
    const sb = makeMockSupabase(async () => ({ data: { id: "fact-1" }, error: null }));
    vi.mocked(supabaseAdmin).mockReturnValue(sb as never);
    const id = await pidInsertFactAssertion({
      subjectType: "property",
      predicate: "owner_name",
      rawValue: "Ram",
      sourceId: "bhulekh",
      valueJson: {},
      metadata: {},
    });
    expect(id).toBe("fact-1");
    expect(sb.from).toHaveBeenCalledWith("pid_fact_assertions");
  });
});

describe("pidInsertEvent", () => {
  it("returns the inserted event id on success", async () => {
    const sb = makeMockSupabase(async () => ({ data: { id: "ev-1" }, error: null }));
    vi.mocked(supabaseAdmin).mockReturnValue(sb as never);
    const id = await pidInsertEvent({
      eventType: "lead_signal",
      sourceId: "bhulekh",
      eventSummary: "x",
      metadata: {},
    });
    expect(id).toBe("ev-1");
    expect(sb.from).toHaveBeenCalledWith("pid_events");
  });
});

describe("pidUpsertProperty", () => {
  it("returns the upserted property id on success", async () => {
    const sb = makeMockSupabase(async () => ({ data: { id: "prop-1" }, error: null }));
    vi.mocked(supabaseAdmin).mockReturnValue(sb as never);
    const id = await pidUpsertProperty({
      state: "Odisha",
      district: "Khordha",
      tahasil: "Bhubaneswar",
      village: "Mendhasala",
      metadata: {},
    });
    expect(id).toBe("prop-1");
    expect(sb.from).toHaveBeenCalledWith("pid_properties");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm vitest run src/lib/pipeline/pid/client.test.ts`
Expected: FAIL with "Cannot find module './client'"

- [ ] **Step 3: Write the implementation**

```ts
// apps/web/src/lib/pipeline/pid/client.ts
/**
 * Typed DB client for the PID layer.
 *
 * One function per table. No mega-write functions — every operation is
 * independently tested, independently callable, and returns the row's UUID
 * (or null on failure). PID writes are best-effort; a failure here must
 * never break the report pipeline (per D-024/D-025).
 *
 * All writes go through supabaseAdmin() (service role) — the tables
 * have RLS that blocks anon access.
 */
import { supabaseAdmin } from "../../db";
import {
  SourceArtifactSchema,
  FactAssertionInputSchema,
  EventInputSchema,
  PropertyInputSchema,
  type SourceArtifact,
  type FactAssertionInput,
  type EventInput,
  type PropertyInput,
} from "./types";

async function singleInsert(
  table: string,
  payload: Record<string, unknown>,
  conflictTarget?: string
): Promise<string | null> {
  try {
    const supabase = supabaseAdmin();
    const query = supabase.from(table).insert(payload);
    const { data, error } = await query.select("id").single();
    if (error || !data) {
      console.warn(`[pid/client] insert ${table} failed: ${error?.message ?? "no data"}`);
      return null;
    }
    return (data as { id: string }).id;
  } catch (err) {
    console.warn(`[pid/client] insert ${table} threw: ${(err as Error).message}`);
    return null;
  }
}

async function singleUpsert(
  table: string,
  payload: Record<string, unknown>,
  onConflict: string
): Promise<string | null> {
  try {
    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from(table)
      .upsert(payload, { onConflict, ignoreDuplicates: false })
      .select("id")
      .single();
    if (error || !data) {
      console.warn(`[pid/client] upsert ${table} failed: ${error?.message ?? "no data"}`);
      return null;
    }
    return (data as { id: string }).id;
  } catch (err) {
    console.warn(`[pid/client] upsert ${table} threw: ${(err as Error).message}`);
    return null;
  }
}

export async function pidUpsertArtifact(input: SourceArtifact): Promise<string | null> {
  const parsed = SourceArtifactSchema.parse(input);
  return singleUpsert("pid_artifacts", parsed as unknown as Record<string, unknown>, "artifact_key");
}

export async function pidInsertFactAssertion(input: FactAssertionInput): Promise<string | null> {
  const parsed = FactAssertionInputSchema.parse(input);
  return singleInsert("pid_fact_assertions", parsed as unknown as Record<string, unknown>);
}

export async function pidInsertEvent(input: EventInput): Promise<string | null> {
  const parsed = EventInputSchema.parse(input);
  return singleInsert("pid_events", parsed as unknown as Record<string, unknown>);
}

export async function pidUpsertProperty(input: PropertyInput): Promise<string | null> {
  const parsed = PropertyInputSchema.parse(input);
  // Canonical key is the natural unique key. If not provided, build one from
  // (district, tahasil, village, khata, plot) — collisions across the same
  // tuple upsert into the same row, which is what we want.
  const payload = parsed as unknown as Record<string, unknown>;
  if (!payload.canonical_key) {
    payload.canonical_key = [
      payload.district,
      payload.tahasil,
      payload.village,
      payload.khata_number,
      payload.plot_number,
    ]
      .filter(Boolean)
      .join("|");
  }
  return singleUpsert("pid_properties", payload, "canonical_key");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && pnpm vitest run src/lib/pipeline/pid/client.test.ts`
Expected: 6 passing

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/pipeline/pid/client.ts apps/web/src/lib/pipeline/pid/client.test.ts
git commit -m "feat(pid): typed DB client for artifact/fact/event/property (Task A.3)"
```

---

## Task A.4: SourceResult → PidWritePayload mapper (`mapper.ts`)

**Files:**
- Create: `apps/web/src/lib/pipeline/pid/mapper.ts`
- Create: `apps/web/src/lib/pipeline/pid/mapper.test.ts`

**Interfaces:**
- Consumes: a `SourceResult` (the existing fetcher output envelope from `@cleardeed/orchestrator`) — minimum: `{ status, sourceId, input, data, fetchedAt, rawArtifactHash?, rawArtifactPath? }`
- Produces: `mapSourceResultToPid(sourceResult: SourceResult): PidWritePayload` — pure function returning `{ artifact?, facts: FactAssertionInput[], events: EventInput[], property?: PropertyInput }` where every field is optional. Empty `PidWritePayload` is valid (e.g. when status is `no_data`).

**Why fourth:** The mapper is the only place that knows how to convert a fetcher's output into PID rows. Keeping it pure means we can test it without a database.

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/lib/pipeline/pid/mapper.test.ts
import { describe, it, expect } from "vitest";
import { mapSourceResultToPid } from "./mapper";

describe("mapSourceResultToPid", () => {
  it("returns empty payload for no_data status", () => {
    const result = mapSourceResultToPid({
      status: "no_data",
      sourceId: "bhulekh",
      input: { village: "Mendhasala", plot: 309 },
      data: {},
      fetchedAt: "2026-06-25T10:00:00.000Z",
    });
    expect(result.artifact).toBeUndefined();
    expect(result.facts).toEqual([]);
    expect(result.events).toEqual([]);
  });

  it("returns empty payload for source_down status", () => {
    const result = mapSourceResultToPid({
      status: "source_down",
      sourceId: "bhulekh",
      input: { village: "Mendhasala" },
      data: {},
      fetchedAt: "2026-06-25T10:00:00.000Z",
    });
    expect(result.facts).toEqual([]);
  });

  it("builds artifact from rawArtifactHash + rawArtifactPath", () => {
    const result = mapSourceResultToPid({
      status: "ok",
      sourceId: "bhulekh",
      input: { village: "Mendhasala", plot: 309 },
      data: { tenants: [] },
      fetchedAt: "2026-06-25T10:00:00.000Z",
      rawArtifactHash: "a".repeat(64),
      rawArtifactPath: "raw/bhulekh/mendhasala-309.html",
      rawContentType: "text/html",
      rawByteSize: 4096,
    });
    expect(result.artifact?.sha256).toBe("a".repeat(64));
    expect(result.artifact?.storagePath).toBe("raw/bhulekh/mendhasala-309.html");
    expect(result.artifact?.artifactType).toBe("html");
  });

  it("emits no artifact when rawArtifactHash is missing (in-memory only)", () => {
    const result = mapSourceResultToPid({
      status: "ok",
      sourceId: "bhulekh",
      input: { village: "Mendhasala" },
      data: { tenants: [] },
      fetchedAt: "2026-06-25T10:00:00.000Z",
    });
    expect(result.artifact).toBeUndefined();
  });

  it("emits property fact when data has district/tahasil/village", () => {
    const result = mapSourceResultToPid({
      status: "ok",
      sourceId: "bhunaksha",
      input: { lat: 20.27, lon: 85.70 },
      data: {
        village: "Mendhasala",
        tahasil: "Bhubaneswar",
        district: "Khordha",
        plotNo: 309,
      },
      fetchedAt: "2026-06-25T10:00:00.000Z",
    });
    expect(result.property?.district).toBe("Khordha");
    expect(result.property?.village).toBe("Mendhasala");
  });

  it("emits owner_name fact from bhulekh data.tenants[0].name", () => {
    const result = mapSourceResultToPid({
      status: "ok",
      sourceId: "bhulekh",
      input: { village: "Mendhasala", plot: 309 },
      data: {
        tenants: [{ name: "Ram Kumar" }, { name: "Sita Devi" }],
      },
      fetchedAt: "2026-06-25T10:00:00.000Z",
    });
    const ownerFacts = result.facts.filter((f) => f.predicate === "owner_name");
    expect(ownerFacts).toHaveLength(2);
    expect(ownerFacts[0]?.rawValue).toBe("Ram Kumar");
  });

  it("emits a fetch event for every successful fetch", () => {
    const result = mapSourceResultToPid({
      status: "ok",
      sourceId: "nominatim",
      input: { lat: 20.27, lon: 85.70 },
      data: { displayName: "Mendhasala, Bhubaneswar" },
      fetchedAt: "2026-06-25T10:00:00.000Z",
    });
    expect(result.events).toHaveLength(1);
    expect(result.events[0]?.eventType).toBe("fetch_completed");
    expect(result.events[0]?.sourceId).toBe("nominatim");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm vitest run src/lib/pipeline/pid/mapper.test.ts`
Expected: FAIL with "Cannot find module './mapper'"

- [ ] **Step 3: Write the implementation**

```ts
// apps/web/src/lib/pipeline/pid/mapper.ts
/**
 * SourceResult → PidWritePayload mapper.
 *
 * Pure function. No I/O. Converts a fetcher's output envelope into the
 * PID write payloads: one optional artifact, zero or more fact assertions,
 * zero or more events, one optional property.
 *
 * Status semantics:
 *   - "ok" or "partial" → emit artifact + facts + fetch_completed event
 *   - "no_data", "source_down", "parse_error", "invalid_input", "manual_required"
 *     → emit nothing (or only a fetch_attempted event if rawArtifactHash present)
 *
 * The mapper knows about the SourceResult shape. It does NOT know about
 * Supabase, the pipeline, or the report renderer. Keeping it pure means
 * a snapshot test (Task A.4) gives full coverage.
 */
import { computeArtifactKey } from "./keys";
import type {
  SourceArtifact,
  FactAssertionInput,
  EventInput,
  PropertyInput,
} from "./types";

export interface PidWritePayload {
  artifact?: SourceArtifact;
  facts: FactAssertionInput[];
  events: EventInput[];
  property?: PropertyInput;
}

// Minimal shape the mapper needs from a SourceResult. We re-declare instead
// of importing the full @cleardeed/orchestrator type to avoid pulling the
// whole fetcher graph into the test.
export interface MapperInput {
  status: string;
  sourceId: string;
  input: Record<string, unknown>;
  data: Record<string, unknown>;
  fetchedAt: string;
  rawArtifactHash?: string;
  rawArtifactPath?: string;
  rawContentType?: string;
  rawByteSize?: number;
  rawHttpStatus?: number;
}

const RECORDABLE_STATUSES = new Set(["ok", "partial"]);

function isRecordable(input: MapperInput): boolean {
  return RECORDABLE_STATUSES.has(input.status);
}

export function mapSourceResultToPid(input: MapperInput): PidWritePayload {
  const empty: PidWritePayload = { facts: [], events: [] };

  if (!isRecordable(input)) {
    // No artifact, no facts. But still emit a fetch_attempted event if we
    // have a raw artifact, so the corpus knows the source was reached.
    if (input.rawArtifactHash && input.rawArtifactPath) {
      empty.events.push({
        eventType: "fetch_attempted",
        sourceId: input.sourceId as never,
        eventSummary: `status=${input.status}`,
        metadata: { artifact_key: computeArtifactKey(input.sourceId, input.input) },
      });
    }
    return empty;
  }

  // 1) Artifact
  let artifact: SourceArtifact | undefined;
  if (input.rawArtifactHash && input.rawArtifactPath) {
    artifact = {
      artifactKey: computeArtifactKey(input.sourceId, input.input),
      sourceId: input.sourceId as never,
      artifactType: guessArtifactType(input.rawContentType, input.rawArtifactPath),
      storagePath: input.rawArtifactPath,
      sha256: input.rawArtifactHash,
      contentType: input.rawContentType,
      byteSize: input.rawByteSize,
      httpStatus: input.rawHttpStatus,
      retrievedAt: input.fetchedAt,
      query: input.input,
      metadata: { status: input.status },
    };
  }

  // 2) Property (location identity)
  let property: PropertyInput | undefined;
  const data = input.data ?? {};
  if (data.district || data.tahasil || data.village) {
    property = {
      district: typeof data.district === "string" ? data.district : undefined,
      tahasil: typeof data.tahasil === "string" ? data.tahasil : undefined,
      village: typeof data.village === "string" ? data.village : undefined,
      mouza: typeof data.mouza === "string" ? data.mouza : undefined,
      khataNumber: typeof data.khataNo === "string" ? data.khataNo
        : typeof data.khata_number === "string" ? data.khata_number : undefined,
      plotNumber: typeof data.plotNo === "string" || typeof data.plotNo === "number"
        ? String(data.plotNo) : typeof data.plot_number === "string"
        ? data.plot_number : undefined,
      metadata: { source_id: input.sourceId },
    };
  }

  // 3) Facts — known predicate extractors. Add new extractors as new
  //    fetcher outputs need to land as PID facts.
  const facts: FactAssertionInput[] = [];
  const sourceId = input.sourceId as never;

  // Bhulekh tenants → owner_name facts
  if (Array.isArray(data.tenants)) {
    for (const t of data.tenants as Array<Record<string, unknown>>) {
      if (typeof t.name === "string") {
        facts.push({
          subjectType: "property",
          predicate: "owner_name",
          rawValue: t.name,
          sourceId,
          metadata: { source: "bhulekh.tenants" },
        });
      }
    }
  }

  // Bhunaksha plot_no → plot_number fact
  if (typeof data.plotNo === "string" || typeof data.plotNo === "number") {
    facts.push({
      subjectType: "property",
      predicate: "plot_number",
      rawValue: String(data.plotNo),
      sourceId,
    });
  }

  // Nominatim displayName → display_name fact
  if (typeof data.displayName === "string") {
    facts.push({
      subjectType: "property",
      predicate: "display_name",
      rawValue: data.displayName,
      sourceId,
    });
  }

  // 4) One fetch_completed event for every successful fetch
  const events: EventInput[] = [
    {
      eventType: "fetch_completed",
      sourceId,
      recordedAt: input.fetchedAt,
      eventSummary: `status=${input.status}`,
      metadata: {
        artifact_key: computeArtifactKey(input.sourceId, input.input),
        fact_count: facts.length,
      },
    },
  ];

  return { artifact, facts, events, property };
}

function guessArtifactType(
  contentType: string | undefined,
  path: string | undefined
): string {
  if (contentType?.includes("html")) return "html";
  if (contentType?.includes("json")) return "json";
  if (contentType?.includes("pdf")) return "pdf";
  if (contentType?.includes("image")) return "image";
  if (path?.endsWith(".html")) return "html";
  if (path?.endsWith(".json")) return "json";
  if (path?.endsWith(".pdf")) return "pdf";
  if (path?.endsWith(".png") || path?.endsWith(".jpg")) return "image";
  return "other";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && pnpm vitest run src/lib/pipeline/pid/mapper.test.ts`
Expected: 7 passing

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/pipeline/pid/mapper.ts apps/web/src/lib/pipeline/pid/mapper.test.ts
git commit -m "feat(pid): SourceResult → PidWritePayload pure mapper (Task A.4)"
```

---

## Task A.5: Top-level recordFetchResult entry point (`record-fetch-result.ts`)

**Files:**
- Create: `apps/web/src/lib/pipeline/pid/record-fetch-result.ts`
- Create: `apps/web/src/lib/pipeline/pid/record-fetch-result.test.ts`

**Interfaces:**
- Consumes: `(sourceId: string, input: Record<string, unknown>, sourceResult: MapperInput, reportId?: string): Promise<{ artifactId, factIds, eventId, propertyId? } | null>` — the one function the pipeline calls.
- Produces: orchestrates the four client functions in dependency order: property first (so subject_id is available for facts), then artifact, then facts + events.

**Why fifth:** The pipeline integration in Task A.7 needs a single call. This task is the orchestrator that ties mapper + client + ordering together.

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/lib/pipeline/pid/record-fetch-result.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../db", () => ({ supabaseAdmin: vi.fn() }));
vi.mock("./client", () => ({
  pidUpsertArtifact: vi.fn(),
  pidInsertFactAssertion: vi.fn(),
  pidInsertEvent: vi.fn(),
  pidUpsertProperty: vi.fn(),
}));

import {
  pidUpsertArtifact,
  pidInsertFactAssertion,
  pidInsertEvent,
  pidUpsertProperty,
} from "./client";
import { recordFetchResult } from "./record-fetch-result";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("recordFetchResult", () => {
  it("returns null when mapper says no artifact and no facts (no_data)", async () => {
    const out = await recordFetchResult(
      "bhulekh",
      { village: "X" },
      {
        status: "no_data",
        sourceId: "bhulekh",
        input: { village: "X" },
        data: {},
        fetchedAt: "2026-06-25T10:00:00.000Z",
      }
    );
    expect(out).toBeNull();
    expect(pidUpsertArtifact).not.toHaveBeenCalled();
    expect(pidInsertFactAssertion).not.toHaveBeenCalled();
  });

  it("writes property before facts so subject_id is available", async () => {
    vi.mocked(pidUpsertProperty).mockResolvedValue("prop-1");
    vi.mocked(pidUpsertArtifact).mockResolvedValue("art-1");
    vi.mocked(pidInsertFactAssertion).mockResolvedValue("fact-1");
    vi.mocked(pidInsertEvent).mockResolvedValue("ev-1");

    const callOrder: string[] = [];
    vi.mocked(pidUpsertProperty).mockImplementation(async () => {
      callOrder.push("property");
      return "prop-1";
    });
    vi.mocked(pidInsertFactAssertion).mockImplementation(async () => {
      callOrder.push("fact");
      return "fact-1";
    });
    vi.mocked(pidInsertEvent).mockImplementation(async () => {
      callOrder.push("event");
      return "ev-1";
    });

    await recordFetchResult(
      "bhunaksha",
      { lat: 20.27, lon: 85.7 },
      {
        status: "ok",
        sourceId: "bhunaksha",
        input: { lat: 20.27, lon: 85.7 },
        data: { district: "Khordha", tahasil: "Bhubaneswar", village: "Mendhasala", plotNo: 309 },
        fetchedAt: "2026-06-25T10:00:00.000Z",
        rawArtifactHash: "a".repeat(64),
        rawArtifactPath: "raw/bhunaksha/mendhasala-309.html",
      }
    );

    expect(callOrder.indexOf("property")).toBeLessThan(callOrder.indexOf("fact"));
    expect(callOrder.indexOf("property")).toBeLessThan(callOrder.indexOf("event"));
  });

  it("returns the assembled ids on success", async () => {
    vi.mocked(pidUpsertProperty).mockResolvedValue("prop-1");
    vi.mocked(pidUpsertArtifact).mockResolvedValue("art-1");
    vi.mocked(pidInsertFactAssertion).mockResolvedValue("fact-1");
    vi.mocked(pidInsertEvent).mockResolvedValue("ev-1");

    const out = await recordFetchResult(
      "bhulekh",
      { village: "X" },
      {
        status: "ok",
        sourceId: "bhulekh",
        input: { village: "X" },
        data: { tenants: [{ name: "Ram" }] },
        fetchedAt: "2026-06-25T10:00:00.000Z",
        rawArtifactHash: "a".repeat(64),
        rawArtifactPath: "raw/bhulekh/x.html",
      }
    );

    expect(out).toEqual({
      artifactId: "art-1",
      factIds: ["fact-1"],
      eventId: "ev-1",
      propertyId: undefined,
    });
  });

  it("does not throw when pidUpsertProperty fails (non-blocking)", async () => {
    vi.mocked(pidUpsertProperty).mockResolvedValue(null);
    vi.mocked(pidUpsertArtifact).mockResolvedValue("art-1");
    vi.mocked(pidInsertFactAssertion).mockResolvedValue("fact-1");
    vi.mocked(pidInsertEvent).mockResolvedValue("ev-1");

    const out = await recordFetchResult(
      "bhulekh",
      { village: "X" },
      {
        status: "ok",
        sourceId: "bhulekh",
        input: { village: "X" },
        data: { tenants: [] },
        fetchedAt: "2026-06-25T10:00:00.000Z",
      }
    );
    expect(out?.artifactId).toBe("art-1");
    expect(out?.propertyId).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm vitest run src/lib/pipeline/pid/record-fetch-result.test.ts`
Expected: FAIL with "Cannot find module './record-fetch-result'"

- [ ] **Step 3: Write the implementation**

```ts
// apps/web/src/lib/pipeline/pid/record-fetch-result.ts
/**
 * Top-level entry point for recording a fetcher's result in the PID layer.
 *
 * Called from the report pipeline after each fetcher returns. The pipeline
 * MUST be tolerant of PID failures (per D-024/D-025) — if every write fails
 * we return null and the report continues. PID is a corpus layer; it does
 * not gate the user-visible product.
 *
 * Order of writes (matters for foreign keys):
 *   1) pid_property (so subject_id is available for facts)
 *   2) pid_artifact (if raw bytes were saved)
 *   3) pid_fact_assertions (append-only)
 *   4) pid_event (one fetch_completed event)
 */
import { mapSourceResultToPid, type MapperInput } from "./mapper";
import {
  pidUpsertArtifact,
  pidInsertFactAssertion,
  pidInsertEvent,
  pidUpsertProperty,
} from "./client";

export interface RecordFetchResultOutput {
  artifactId?: string;
  factIds: string[];
  eventId?: string;
  propertyId?: string;
}

export async function recordFetchResult(
  sourceId: string,
  input: Record<string, unknown>,
  sourceResult: MapperInput,
  _reportId?: string
): Promise<RecordFetchResultOutput | null> {
  try {
    const payload = mapSourceResultToPid(sourceResult);

    // Short-circuit: nothing recordable
    if (
      !payload.artifact &&
      payload.facts.length === 0 &&
      payload.events.length === 0 &&
      !payload.property
    ) {
      return null;
    }

    // 1) Property (no-op if no location data in payload)
    let propertyId: string | undefined;
    if (payload.property) {
      propertyId = (await pidUpsertProperty(payload.property)) ?? undefined;
    }

    // 2) Artifact
    let artifactId: string | undefined;
    if (payload.artifact) {
      // If a reportId was provided, thread it into the artifact metadata
      // so readPidArtifactsForReport(reportId) can find it.
      if (_reportId) {
        payload.artifact.metadata = { ...payload.artifact.metadata, report_id: _reportId };
      }
      artifactId = (await pidUpsertArtifact(payload.artifact)) ?? undefined;
    }

    // 3) Facts
    const factIds: string[] = [];
    for (const fact of payload.facts) {
      const factWithSubject: typeof fact = { ...fact };
      if (propertyId && !factWithSubject.subjectId) {
        factWithSubject.subjectId = propertyId;
        factWithSubject.subjectType = "property";
      }
      if (artifactId) {
        factWithSubject.artifactId = artifactId;
      }
      const id = await pidInsertFactAssertion(factWithSubject);
      if (id) factIds.push(id);
    }

    // 4) Event(s)
    let eventId: string | undefined;
    for (const event of payload.events) {
      const eventWithRefs: typeof event = { ...event };
      if (propertyId) eventWithRefs.propertyId = propertyId;
      if (artifactId) eventWithRefs.artifactId = artifactId;
      if (_reportId) eventWithRefs.metadata = { ...eventWithRefs.metadata, report_id: _reportId };
      const id = await pidInsertEvent(eventWithRefs);
      if (id) eventId = id;
    }

    return { artifactId, factIds, eventId, propertyId };
  } catch (err) {
    console.warn(
      `[pid/recordFetchResult] ${sourceId} threw: ${(err as Error).message}`
    );
    return null;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && pnpm vitest run src/lib/pipeline/pid/record-fetch-result.test.ts`
Expected: 4 passing

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/pipeline/pid/record-fetch-result.ts apps/web/src/lib/pipeline/pid/record-fetch-result.test.ts
git commit -m "feat(pid): recordFetchResult orchestrator (Task A.5)"
```

---

## Task A.6: PID read paths in `corpus.ts` (replaces no-op stub)

**Files:**
- Modify: [apps/web/src/lib/pipeline/corpus.ts](apps/web/src/lib/pipeline/corpus.ts)
- Create: `apps/web/src/lib/pipeline/corpus.test.ts`

**Interfaces:**
- Consumes: `supabaseAdmin()` + a `reportId: string` (or `propertyId: string`)
- Produces: `readPidArtifactsForReport(reportId): Promise<PidArtifact[]>` and `readPidEventsForProperty(propertyId): Promise<PidEvent[]>` — both return empty arrays on failure (do not throw). The existing `readCorpusCases` no-op stub remains for backward compatibility with the gated `corpus.ts` import in [apps/web/src/lib/pipeline/index.ts:30](apps/web/src/lib/pipeline/index.ts#L30).

**Why sixth:** Future sub-plans (B, D, F) need to read PID back out. Adding it now means Task A.7 can wire one of the read paths into the pipeline as a smoke test, AND the next sub-plan has the read API ready.

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/lib/pipeline/corpus.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../db", () => ({ supabaseAdmin: vi.fn() }));

import { supabaseAdmin } from "../db";
import { readPidArtifactsForReport, readPidEventsForProperty } from "./corpus";

function mockSupabase(impl: (table: string) => Promise<{ data: unknown; error: unknown }>) {
  return {
    from: vi.fn((table: string) => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn(() => impl(table)),
          })),
        })),
      })),
    })),
  };
}

beforeEach(() => vi.clearAllMocks());

describe("readPidArtifactsForReport", () => {
  it("returns artifacts joined to the report", async () => {
    const sb = mockSupabase(async () => ({
      data: [{ id: "art-1", storage_path: "x" }],
      error: null,
    }));
    vi.mocked(supabaseAdmin).mockReturnValue(sb as never);
    const out = await readPidArtifactsForReport("r-1");
    expect(out).toHaveLength(1);
    expect(sb.from).toHaveBeenCalledWith("pid_artifacts");
  });

  it("returns empty array on error", async () => {
    const sb = mockSupabase(async () => ({ data: null, error: { message: "x" } }));
    vi.mocked(supabaseAdmin).mockReturnValue(sb as never);
    const out = await readPidArtifactsForReport("r-1");
    expect(out).toEqual([]);
  });
});

describe("readPidEventsForProperty", () => {
  it("returns events for a property", async () => {
    const sb = mockSupabase(async () => ({
      data: [{ id: "ev-1", event_type: "fetch_completed" }],
      error: null,
    }));
    vi.mocked(supabaseAdmin).mockReturnValue(sb as never);
    const out = await readPidEventsForProperty("p-1");
    expect(out).toHaveLength(1);
    expect(sb.from).toHaveBeenCalledWith("pid_events");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm vitest run src/lib/pipeline/corpus.test.ts`
Expected: FAIL with "readPidArtifactsForReport is not a function"

- [ ] **Step 3: Modify corpus.ts**

Replace the entire file with:

```ts
/**
 * PID corpus reader (server-side only) + legacy stub.
 *
 * - The legacy `readCorpusCases()` / `readCorpusCasesByFamily()` no-op stubs
 *   are kept so the gated `await import("./corpus")` in pipeline/index.ts
 *   continues to resolve cleanly. The PID synthesis block is gated on
 *   `PID_SYNTHESIS_ENABLED` and short-circuits when these return [].
 * - The new `readPidArtifactsForReport()` and `readPidEventsForProperty()`
 *   are the live read paths for the PID layer. They are best-effort: a
 *   failure returns [] and never throws.
 */
import { supabaseAdmin } from "../db";

// ── Legacy no-op stubs (D-024/D-025 — keep the import path alive) ──────────
export interface CorpusCase {
  id: string;
  case_no?: string;
  title?: string;
  parties?: string[];
  disposition?: string;
  court_type?: string;
  judicial_district?: string;
  filing_year?: number;
  judgment_year?: number;
  reported?: boolean;
  case_family?: string;
  case_tags?: string[];
  created_at?: string;
}

export async function readCorpusCases(): Promise<CorpusCase[]> {
  return [];
}

export async function readCorpusCasesByFamily(
  _family: string,
  _limit: number = 10
): Promise<CorpusCase[]> {
  return [];
}

export function _resetCorpusCache(): void {
  // no-op
}

// ── PID read paths ──────────────────────────────────────────────────────────
export interface PidArtifact {
  id: string;
  source_id: string;
  storage_path: string;
  sha256: string;
  retrieved_at: string;
  metadata: Record<string, unknown>;
}

export interface PidEvent {
  id: string;
  event_type: string;
  source_id: string | null;
  event_date: string | null;
  event_summary: string | null;
  property_id: string | null;
  review_status: string;
  metadata: Record<string, unknown>;
}

export async function readPidArtifactsForReport(
  reportId: string
): Promise<PidArtifact[]> {
  try {
    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("pid_artifacts")
      .select("id, source_id, storage_path, sha256, retrieved_at, metadata")
      .eq("metadata->>report_id", reportId)
      .order("retrieved_at", { ascending: false })
      .limit(500);
    if (error || !data) return [];
    return data as PidArtifact[];
  } catch (err) {
    console.warn(`[pid/corpus] readPidArtifactsForReport failed: ${(err as Error).message}`);
    return [];
  }
}

export async function readPidEventsForProperty(
  propertyId: string
): Promise<PidEvent[]> {
  try {
    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("pid_events")
      .select("id, event_type, source_id, event_date, event_summary, property_id, review_status, metadata")
      .eq("property_id", propertyId)
      .order("event_date", { ascending: false, nullsFirst: false })
      .limit(500);
    if (error || !data) return [];
    return data as PidEvent[];
  } catch (err) {
    console.warn(`[pid/corpus] readPidEventsForProperty failed: ${(err as Error).message}`);
    return [];
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && pnpm vitest run src/lib/pipeline/corpus.test.ts`
Expected: 3 passing

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/pipeline/corpus.ts apps/web/src/lib/pipeline/corpus.test.ts
git commit -m "feat(pid): corpus read paths (artifacts by report, events by property) (Task A.6)"
```

---

## Task A.7: Wire `recordFetchResult()` into `generateReportV11()` + smoke test

**Files:**
- Modify: [apps/web/src/lib/pipeline/index.ts](apps/web/src/lib/pipeline/index.ts) — adds one try-wrapped call after each fetcher returns
- Create: `qa/pid_smoke/smoke.test.ts` — live integration test (gated on `RUN_PID_SMOKE=1`)
- Create: `qa/pid_smoke/khordha-report-1.json` — captured output

**Interfaces:**
- Consumes: the existing fetcher result blocks in `generateReportV11()` (find by grep `const bhulekhData = ...` and `const nominatimResult = ...` etc.)
- Produces: per-fetcher `recordFetchResult()` calls, gated on `PID_RECORDING_ENABLED=1`. The smoke test runs `generateReportV11()` end-to-end and verifies that pid_artifacts + pid_fact_assertions + pid_events rows exist for the test report.

**Why seventh:** This is the user-visible deliverable. After this task, generating a real report on a real plot writes real rows to the PID layer. The smoke test is the only way to know it actually works against the live Supabase.

- [ ] **Step 1: Read the current fetcher return blocks**

Run: `grep -n "const bhulekhData\|const nominatimResult\|const bhunakshaData\|const ecourtsData" apps/web/src/lib/pipeline/index.ts | head -10`
Expected: 4+ matches, each followed by a fetcher return. Pick the last one before `// V1.2` (the cross-source validator block at line ~1219).

- [ ] **Step 2: Add the env flag + import to pipeline/index.ts**

Edit [apps/web/src/lib/pipeline/index.ts](apps/web/src/lib/pipeline/index.ts:29-32) to add (after the existing `PID_SYNTHESIS_ENABLED` and `PID_EXPERIMENT_CLUSTER_ORDER` lines):

```ts
// PID recording — off by default per D-024/D-025. When enabled, every
// fetcher return writes a pid_artifact + pid_fact_assertions + pid_event
// row. Failures are logged and swallowed (non-blocking).
const PID_RECORDING_ENABLED = process.env.PID_RECORDING_ENABLED === "true";
```

Then add to the import block at the top of the file (alongside the other `./corpus` import if one exists):

```ts
import { recordFetchResult } from "./pid/record-fetch-result";
```

- [ ] **Step 3: Insert the recording block immediately before the `// V1.2` cross-source validator block**

Find the comment `// V1.2 (B11) — Run cross-source validators` (or whichever is the first fetcher-completed marker in `generateReportV11()`). Insert this block right before it:

```ts
  // PID recording (sub-plan A, Task A.7). Off by default. Each call is
  // best-effort: a PID write failure must never break the report.
  if (PID_RECORDING_ENABLED) {
    const pidInput: Record<string, unknown> = {
      village: input.village ?? null,
      tahasil: input.tahasil ?? null,
      plot: input.plotNo ?? null,
      gps_lat: input.gpsLat ?? null,
      gps_lon: input.gpsLon ?? null,
    };
    if (nominatimResult) {
      await recordFetchResult("nominatim", pidInput, nominatimResult as never);
    }
    if (bhunakshaData) {
      await recordFetchResult("bhunaksha", pidInput, bhunakshaData as never);
    }
    if (bhulekhData) {
      await recordFetchResult("bhulekh", pidInput, bhulekhData as never);
    }
    if (ecourtsData) {
      await recordFetchResult("ecourts", pidInput, ecourtsData as never);
    }
  }
```

**Important:** The exact variable names (`nominatimResult`, `bhunakshaData`, `bhulekhData`, `ecourtsData`) may differ. Use `grep -n` to find the actual local variable names for each fetcher's result, and adapt accordingly. If any fetcher doesn't have its result stored in a local variable, add a binding (e.g. `const ecourtsData = await ecourtsFetch(...)`) before the recording block.

- [ ] **Step 4: Verify the existing test suite still passes**

Run: `cd apps/web && pnpm vitest run src/lib/pipeline/ 2>&1 | tail -20`
Expected: same pass count as before this task (the recording block is gated on the env flag, so by default it's a no-op).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/pipeline/index.ts
git commit -m "feat(pid): wire recordFetchResult into generateReportV11 (Task A.7)"
```

- [ ] **Step 6: Write the smoke test**

```ts
// qa/pid_smoke/smoke.test.ts
/**
 * PID live smoke test. GATED on RUN_PID_SMOKE=1.
 *
 * Run: RUN_PID_SMOKE=1 pnpm vitest run qa/pid_smoke/smoke.test.ts
 *
 * This is the only test in the PID layer that hits the real Supabase. It
 * generates a real report on the demo plot (20.272688, 85.701271) and
 * asserts that pid_artifacts, pid_fact_assertions, and pid_events rows
 * were written. Skipped by default so CI never hits prod.
 */
import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { generateReportV11 } from "../../apps/web/src/lib/pipeline/index";
import { supabaseAdmin } from "../../apps/web/src/lib/db";
import {
  readPidArtifactsForReport,
  readPidEventsForProperty,
} from "../../apps/web/src/lib/pipeline/corpus";
import { writeFileSync } from "node:fs";

const ENABLED = process.env.RUN_PID_SMOKE === "1";
const describeIf = ENABLED ? describe : describe.skip;

describeIf("PID live smoke — Khordha demo plot", () => {
  it("writes pid_artifacts + pid_fact_assertions + pid_events for a real report", async () => {
    const reportId = createHash("sha256")
      .update(`smoke-${Date.now()}`)
      .digest("hex")
      .slice(0, 36);

    process.env.PID_RECORDING_ENABLED = "true";
    process.env.REPORT_CREATE_TOKEN = process.env.REPORT_CREATE_TOKEN ?? "smoke-token";

    await generateReportV11({
      reportId,
      village: "Mendhasala",
      tahasil: "Bhubaneswar",
      plotNo: "309",
      gpsLat: 20.272688,
      gpsLon: 85.701271,
      claimedOwnerName: "Demo Owner",
    } as never);

    // Wait for any async writes to flush (PID writes are awaited but
    // Supabase client can buffer; 1s is plenty for the size of these rows).
    await new Promise((r) => setTimeout(r, 1000));

    // Use the read path now that reportId is wired into metadata.
    const artifacts = await readPidArtifactsForReport(reportId);
    const artifactCount = artifacts.length;

    // Facts and events are filtered by report_id metadata too.
    const supabase = supabaseAdmin();
    const { count: eventCount } = await supabase
      .from("pid_events")
      .select("id", { count: "exact", head: true })
      .eq("metadata->>report_id", reportId);
    const { count: factCount } = await supabase
      .from("pid_fact_assertions")
      .select("id", { count: "exact", head: true })
      .eq("metadata->>report_id", reportId);

    writeFileSync(
      "qa/pid_smoke/khordha-report-1.json",
      JSON.stringify(
        { reportId, artifactCount, factCount, eventCount, ranAt: new Date().toISOString() },
        null,
        2
      )
    );

    expect(artifactCount).toBeGreaterThan(0);
    expect(eventCount).toBeGreaterThan(0);
    // facts may be 0 if no fetcher produced data — only assert > 0 if bhulekh fired
    expect(artifactCount ?? 0).toBeGreaterThan(0);
  }, 120_000);
});
```

- [ ] **Step 7: Run the smoke test against prod**

Run: `RUN_PID_SMOKE=1 pnpm vitest run qa/pid_smoke/smoke.test.ts 2>&1 | tail -30`
Expected: 1 passing, captured `qa/pid_smoke/khordha-report-1.json` shows artifactCount > 0, eventCount > 0.

If the test fails: check the `pid_artifacts` count, then check the pipeline logs. Most likely causes: (a) the fetcher variables in step 3 don't match the actual locals in pipeline/index.ts, (b) `generateReportV11` throws on the demo plot, (c) Supabase env vars are missing locally.

- [ ] **Step 8: Commit**

```bash
git add qa/pid_smoke/smoke.test.ts qa/pid_smoke/khordha-report-1.json
git commit -m "test(pid): live smoke test for recordFetchResult (Task A.7)"
```

---

## Task A.8: PID module README

**Files:**
- Create: `apps/web/src/lib/pipeline/pid/README.md`

**Why eighth:** The module is now wired. A one-page dev reference is the difference between the next sub-plan being able to start in 5 minutes vs. an hour of code archaeology.

- [ ] **Step 1: Write the README**

```md
# PID layer (`apps/web/src/lib/pipeline/pid/`)

The Pattern Intelligence Database (PID) is the corpus layer that
sits underneath the report pipeline. Every fetch result lands here
as an artifact + fact assertions + an event. Future sub-plans
(Sub-plan F: seller-name normalizer, Sub-plan G: ground-truth
expansion) read from this layer.

## Modules

- `keys.ts` — deterministic SHA-256 artifact keys. Same input → same key.
- `types.ts` — Zod schemas for the 4 write-input types.
- `client.ts` — typed DB client. One function per PID table.
  All writes go through `supabaseAdmin()` (service role, bypasses RLS).
- `mapper.ts` — pure `SourceResult → PidWritePayload` mapper.
  No I/O, fully unit-testable.
- `record-fetch-result.ts` — top-level `recordFetchResult()` called
  from the pipeline. Best-effort; never throws.

## Read paths

Live in `apps/web/src/lib/pipeline/corpus.ts`:
- `readPidArtifactsForReport(reportId)` — artifacts linked to a report
- `readPidEventsForProperty(propertyId)` — events on a property

## Kill switch

`PID_RECORDING_ENABLED=true` in the env turns on the pipeline write path.
Default is OFF. Set on Vercel only when explicitly enabling for a session.

## Read-when-stuck checklist

- Schema lives in `infra/supabase/migrations/006_pid_core.sql` +
  `007_pid_operational_layers.sql`. Both applied 2026-06-25.
- Sub-plan A (this) wires write paths. Sub-plan F adds the UI badge.
- The original PID track was removed in commit `fb6a2aa` (D-024/D-025).
  See `apps/web/src/lib/pipeline/corpus.ts` for the legacy no-op stubs.
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/lib/pipeline/pid/README.md
git commit -m "docs(pid): PID module developer reference (Task A.8)"
```

---

## Self-Review (run before declaring done)

**1. Spec coverage:** The user asked for "wire PID tables into pipeline." This plan covers:
- Typed DB client for all 4 write types (artifacts, facts, events, properties) ✅
- Pure mapper from existing SourceResult envelope ✅
- One-call orchestrator the pipeline uses ✅
- Read paths in corpus.ts so future sub-plans can read PID back ✅
- Live smoke test that proves it works end-to-end against real Supabase ✅
- Kill-switch on env var (matches the existing `PID_SYNTHESIS_ENABLED` posture) ✅
- Non-blocking failures (D-024/D-025 contract) ✅

Not covered (deferred to other sub-plans per scoping):
- Captcha-breaker ONNX training (Sub-plan B)
- Fetcher captcha integration (Sub-plan C)
- Wiring 10 built-but-unwired fetchers (Sub-plan D)
- 6 new sources (Sub-plan E)
- Seller-name normalizer, cross-report lookup, PID UI badge (Sub-plan F)
- 75-plot corpus expansion + final fire audit (Sub-plan G)

**2. Placeholder scan:** No "TBD", "TODO", "implement later" anywhere. Every step has concrete code.

**3. Type consistency:** Checked all uses of `PidWritePayload`, `RecordFetchResultOutput`, `SourceArtifact`, `FactAssertionInput`, `EventInput`, `PropertyInput`, `MapperInput` — all consistent across files.

---

## Execution handoff

Plan saved to `docs/superpowers/plans/2026-06-25-pid-schema-wireup.md`.

**End-to-end deliverable after all 8 tasks:** A live Bhulekh fetch on the demo plot writes 1+ rows to `pid_artifacts`, 1+ rows to `pid_events`, and 0+ rows to `pid_fact_assertions` in production Supabase. The pipeline call site is gated on `PID_RECORDING_ENABLED=true`. Future sub-plans can read the data back via `readPidArtifactsForReport()` / `readPidEventsForProperty()`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
