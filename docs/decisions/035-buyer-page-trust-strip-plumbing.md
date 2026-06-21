# ADR-035: Buyer Page Trust Strip Provenance Plumbing

**Date:** 2026-06-23
**Status:** Implemented
**Deciders:** @deeksha
**Affected:** `agents/consumer-report-writer/src/index.ts`, `agents/consumer-report-writer/src/__tests__/buyer-page.test.ts`

---

## Problem

The buyer page trust strip (Q1, Q3) was displaying demo placeholders like "Bhulekh v3.2" and "1 attempt" with no connection to the actual source fetch. Buyers couldn't verify:

- When the source was fetched
- What the raw artifact hash is
- Which parser version processed the data
- How many attempts were made (for captcha sources)
- What warnings the parser emitted

These signals are the core trust mechanism — without them, buyers have no proof we actually fetched the source and are being transparent about failures.

---

## Options Considered

### Option A: Drill through existing context (`ctx.data`)

Pass the entire `Tier2Input` / `OrchestratorOutput` context into `buildBuyerPage` and read `ctx.data.sourceDetails` directly inside the Q detail helpers (`buildQ1TrustStrip`, etc.).

**Pros:**
- No new types
- All data available

**Cons:**
- Tight coupling to `Tier2Input` shape
- Violates the interface contract (`BuyerPageInternalInput`)
- Hard to test without building a full orchestrator fixture
- Fragile to upstream shape changes

### Option B: Add optional `sourceMeta` keyed by source name

Add an optional `sourceMeta: { bhulekh?: {...}, eCourts?: {...} }` field to `BuyerPageInternalInput`, populated by `buildBuyerPage` caller before calling. Each entry contains only the fields the trust strip reads.

**Pros:**
- Explicit surface — the contract is clear: "here's what you might get"
- Type-safe per source (each source has different available fields)
- Easy to extend to new sources without changing existing callers
- Partial-fail-safe: if `eCourts` is absent, the trust strip renders a minimal summary
- Tests can pass a fixture without building a full `Tier2Input`

**Cons:**
- One more field on `BuyerPageInternalInput` (already large)
- Boilerplate: each source needs a key in `sourceMeta`

### Option C: Store source metadata in `riskInsights` or similar

Attach the source metadata to the insights themselves (e.g., a `sourceMeta` field on each `Insight`), then the trust strip reads from the first insight for that source.

**Pros:**
- No new field on the page-level input

**Cons:**
- Insights are already large
- Not all sources fire insights (CERSAI, Bhunaksha may have no red flags but still need provenance)
- Confusing contract: which insight carries the "real" source metadata?

---

## Decision: Option B — `sourceMeta` keyed by source name

Add an optional `sourceMeta` field to `BuyerPageInternalInput`:

```ts
interface BuyerPageInternalInput {
  // ... existing fields

  sourceMeta?: {
    bhulekh?: SourceProvenance;
    eCourts?: SourceProvenance;
    bhunaksha?: SourceProvenance;
  };
}

interface SourceProvenance {
  fetchedAt?: string;
  rawArtifactHash?: string;
  parserVersion?: string;
  templateHash?: string;
  attempts?: string;
  inputsTried?: ReadonlyArray<{ label?: string; input?: Record<string, unknown> }>;
  warnings?: ReadonlyArray<string>;
  rawOdia?: { english: string; odia: string };
  casteOdia?: string | null;
  cacheServedAt?: string;
}
```

The caller (`buildBuyerPage`) reads `ctx.data.sourceDetails` and populates the appropriate keys:

```ts
sourceMeta: {
  bhulekh: ctx.data.sourceDetails.bhulekh ? {
    fetchedAt: ctx.data.sourceDetails.bhulekh.fetchedAt,
    rawArtifactHash: ctx.data.sourceDetails.bhulekh.rawArtifactHash,
    parserVersion: ctx.data.sourceDetails.bhulekh.parserVersion,
    rawOdia: ctx.data.sourceDetails.bhulekh.rawOdia,
    casteOdia: ctx.data.sourceDetails.bhulekh.casteOdia,
  } : undefined,
  eCourts: ctx.data.sourceDetails.eCourts ? {
    fetchedAt: ctx.data.sourceDetails.eCourts.fetchedAt,
    rawArtifactHash: ctx.data.sourceDetails.eCourts.rawArtifactHash,
    parserVersion: ctx.data.sourceDetails.eCourts.parserVersion,
    attempts: ctx.data.sourceDetails.eCourts.attempts?.toString(),
    warnings: ctx.data.sourceDetails.eCourts.warnings,
  } : undefined,
  // bhunaksha, cersai, etc. added in future work
}
```

Inside `buildQDetail`, the helpers read from `input.sourceMeta.{source}` and fall back to demo strings when undefined.

---

## Why This Works

1. **Explicit contract:** The `sourceMeta` field clearly documents which sources can pass provenance and what fields are available.
2. **Partial-fail-safe:** If `eCourts` is missing (not fetched, or permission denied), the trust strip renders a minimal summary ("2h ago") instead of crashing or hiding.
3. **Type-safe:** Each `SourceProvenance` entry is typed — mismatches are caught at compile time.
4. **Future-proof:** Adding CERSAI or Bhunaksha provenance is just one more key — no existing Q-detail helpers change.
5. **Testable:** A test can pass `sourceMeta: { bhulekh: { fetchedAt: "2026-06-23...", rawArtifactHash: "abc123" } }` without building a full `Tier2Input`.

---

## Trade-offs

- **Larger interface:** `BuyerPageInternalInput` grows. But it's an internal type — not a public API — and the clarity outweighs the size.
- **Boilerplate in caller:** Each source needs to be mapped from `ctx.data.sourceDetails` into the `sourceMeta` shape. This mapping lives in one place (`buildBuyerPage` caller) and is explicit about what fields are passed through.

---

## Implementation

- `agents/consumer-report-writer/src/index.ts`:
  - Added `SourceProvenance` interface (subset of `SourceResultBase`)
  - Added `sourceMeta` to `BuyerPageInternalInput`
  - Added `buildQ1TrustStrip`, `buildQ3TrustStrip` helpers that read from `input.sourceMeta`
  - `deriveQDetail` calls the helpers and passes `trustStrip` to `buildQDetail`
  - Caste flag: when `casteOdia` is present, emits a transferability warning
  - Raw Odia: when `rawOdia` is present, pairs English with Odia

- `agents/consumer-report-writer/src/__tests__/buyer-page.test.ts`:
  - 6 new tests covering real-data plumbing, fallback, caste flag, raw Odia, eCourts attempts

- **Future work:** Extend `sourceMeta` to include CERSAI, Bhunaksha, IGR EC, RCCMS. Each source's Q-detail helper will read the appropriate key.

---

## Alternatives Rejected

- **Option A (drill-through):** Rejected because it couples the page renderer to `Tier2Input` and makes testing harder.
- **Option C (attach to insights):** Rejected because not all sources fire insights and the contract would be ambiguous ("which insight has the real source metadata?").

---

## References

- Commit 26fc951: "feat(report): trust strip on critical facts — buyer-facing source provenance" — introduced the trust strip with demo strings.
- CLAUDE.md Section 6: "Trust mechanisms — provenance per claim" — requires that every fact show its source.
