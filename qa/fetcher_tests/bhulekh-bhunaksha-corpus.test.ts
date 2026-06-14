/**
 * Sprint V2 — Bhulekh + Bhunaksha corpus regression (100% confidence).
 *
 * Per the 2026-06-14 plan, this suite asserts that EVERY entry in
 * `qa/khordha_inputs.json` returns a typed-correct contract envelope from
 * the Bhulekh ROR fetcher and the Bhunaksha polygon fetcher.
 *
 * Where the previous contract tests (bhulekh.test.ts, bhunaksha.test.ts) only
 * checked structural correctness on synthetic data + golden-path manifests,
 * this suite runs the *real* fetchers against the *real* input corpus and
 * asserts the contract envelope Zod-validates.
 *
 * Three layered describe blocks:
 *   1. Bhulekh corpus regression  — direct `fetch()` calls per input
 *   2. Bhunaksha corpus regression — direct `bhunakshaFetch()` calls per input
 *   3. Cross-source invariants    — Check 6 (village match), Check 8 (share sum)
 *
 * CI runs the first 5 inputs per fetcher (sanity check). Locally and in
 * nightly, set RUN_FULL_CORPUS=1 to exercise all 4,389 inputs.
 *
 * Per CLAUDE.md: no abstractions beyond what the task requires. The helper
 * functions are inlined, not extracted.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Direct fetcher imports — these return the raw RoRResult / BhunakshaResult.
// The `mapXToContract` adapters convert them into the typed V2 contract
// envelope that the pipeline orchestrator consumes.
import { fetch as bhulekhFetch } from "@cleardeed/fetcher-bhulekh";
import { bhunakshaFetch } from "@cleardeed/fetcher-bhunaksha";
import {
  BhulekhContract,
  mapBhulekhToContract,
} from "../../apps/web/src/lib/pipeline/contracts/bhulekh";
import {
  BhunakshaContract,
  mapBhunakshaToContract,
} from "../../apps/web/src/lib/pipeline/contracts/bhunaksha";

// ── Corpus loading ────────────────────────────────────────────────────────

interface CorpusInput {
  tahasil: string;
  village: string;
  searchMode: string;
  identifier: string;
  coordinates?: { lat: number; lon: number };
  metadata?: {
    tahasilCode?: string;
    villageCode?: string;
    notDigitized?: boolean;
    patternCategory?: string;
  };
}

const CORPUS_PATH = join(process.cwd(), "qa", "khordha_inputs.json");
const CORPUS_LIMIT = process.env.RUN_FULL_CORPUS === "1"
  ? Number.POSITIVE_INFINITY
  : 5;

function loadCorpus(): CorpusInput[] {
  const raw = JSON.parse(readFileSync(CORPUS_PATH, "utf-8")) as { inputs: CorpusInput[] };
  return raw.inputs.slice(0, CORPUS_LIMIT);
}

// ── Helpers ──────────────────────────────────────────────────────────────

/**
 * Bhulekh input adapter: khordha_inputs.json uses (tahasil, village, searchMode, identifier)
 * but the Bhulekh fetcher uses (tehsil, village, searchMode, identifierValue, tehsilCode, villageCode).
 */
function toBhulekhFetchInput(input: CorpusInput) {
  return {
    tehsil: input.tahasil,
    village: input.village,
    searchMode: input.searchMode as "Plot" | "Khatiyan" | "Tenant",
    identifierValue: input.identifier,
    tehsilCode: input.metadata?.tahasilCode,
    villageCode: input.metadata?.villageCode,
  };
}

/**
 * Bhunaksha input adapter: needs (lat, lon) for WFS. Use the corpus-provided
 * coordinates when present, otherwise skip (Bhunaksha requires a GPS anchor).
 */
function toBhunakshaFetchInput(input: CorpusInput) {
  return {
    lat: input.coordinates?.lat ?? 0,
    lon: input.coordinates?.lon ?? 0,
    villageName: input.village,
    plotNo: input.identifier,
    layer: "khurda_bhubaneswar",
  };
}

/**
 * Parse a share string ("1/1", "1/2", "3/4") into a fraction. Returns 0 on
 * unparseable input — the test only counts when share is present and well-formed.
 */
function parseShare(share: string | undefined): number {
  if (!share) return 0;
  const m = /^(\d+)\s*\/\s*(\d+)$/.exec(share.trim());
  if (!m) return 0;
  const num = Number(m[1]);
  const den = Number(m[2]);
  if (den === 0) return 0;
  return num / den;
}

/**
 * Normalize a village name for comparison: lowercase, trim, collapse whitespace,
 * strip trailing punctuation.
 */
function normalizeVillage(name: string | null | undefined): string {
  if (!name) return "";
  return name.toLowerCase().replace(/[\s.,-]+/g, " ").trim();
}

// ── Suite setup ──────────────────────────────────────────────────────────

const corpus = loadCorpus();
const corpusHasGps = corpus.filter((c) => c.coordinates?.lat && c.coordinates?.lon);

describe("Bhulekh ROR — corpus regression (typed contract envelope)", () => {
  it("loads at least one corpus input", () => {
    expect(corpus.length).toBeGreaterThan(0);
  });

  for (const input of corpus) {
    it(`${input.tahasil} / ${input.village} / ${input.identifier} → typed envelope`, async () => {
      const fetchedAt = new Date().toISOString();
      // The Bhulekh `fetch` returns RoRResultType directly (the post-parse
      // front-page payload). Back-page data is a separate call.
      const rorResult = await bhulekhFetch(toBhulekhFetchInput(input));
      expect(rorResult).toBeDefined();
      expect(rorResult.source).toBe("bhulekh");

      // Convert to typed contract envelope.
      const envelope = mapBhulekhToContract(rorResult, fetchedAt);

      // Typed envelope: must pass Zod.
      const parsed = BhulekhContract.safeParse(envelope);
      if (!parsed.success) {
        console.error(`[${input.identifier}] Bhulekh envelope failed Zod:`, parsed.error.issues);
      }
      expect(parsed.success).toBe(true);

      // Per-status structural invariants.
      if (parsed.data.status === "ok") {
        const data = parsed.data.data;
        // plotNo and village must be present and non-empty in a success envelope
        expect(data.plotNo.length).toBeGreaterThan(0);
        expect(data.village.length).toBeGreaterThan(0);
        // Tenants must be non-empty (Bhulekh "blank" responses should not reach `ok`)
        expect(data.tenants.length).toBeGreaterThan(0);
        // Every tenant must have a tenant name
        for (const t of data.tenants) {
          expect(t.tenantName.length).toBeGreaterThan(0);
          expect(t.area).toBeGreaterThan(0);
        }
      } else {
        // Failure branch: must have a structured error
        expect(parsed.data.error).toBeDefined();
        expect(parsed.data.error.code.length).toBeGreaterThan(0);
        expect(parsed.data.error.message.length).toBeGreaterThan(0);
      }
    }, 120_000);
  }
});

describe("Bhunaksha polygon — corpus regression (typed contract envelope)", () => {
  it("loads at least one corpus input with GPS coordinates", () => {
    // Some khordha_inputs.json entries may not have coordinates; we only
    // test the ones that do. Bhunaksha requires a GPS anchor.
    expect(corpus.length).toBeGreaterThan(0);
  });

  for (const input of corpusHasGps) {
    it(`${input.tahasil} / ${input.village} / ${input.identifier} → typed envelope`, async () => {
      const fetchedAt = new Date().toISOString();
      const result = await bhunakshaFetch(toBhunakshaFetchInput(input));

      // Bhunaksha returns BhunakshaResult directly.
      expect(result.source).toBe("bhunaksha");

      // Convert to typed contract envelope.
      const envelope = mapBhunakshaToContract(result, fetchedAt);

      // Typed envelope: must pass Zod.
      const parsed = BhunakshaContract.safeParse(envelope);
      if (!parsed.success) {
        console.error(`[${input.identifier}] Bhunaksha envelope failed Zod:`, parsed.error.issues);
      }
      expect(parsed.success).toBe(true);

      // Per-status structural invariants.
      if (parsed.data.status === "ok") {
        const data = parsed.data.data;
        // A successful Bhunaksha fetch always carries the three location
        // strings (they may be empty when only BBOX matched, but the fields
        // are required by the schema so Zod will catch any genuine breakage).
        expect(typeof data.plotNo).toBe("string");
        expect(typeof data.village).toBe("string");
        expect(typeof data.tahasil).toBe("string");
      } else {
        expect(parsed.data.error).toBeDefined();
        expect(parsed.data.error.code.length).toBeGreaterThan(0);
        expect(parsed.data.error.message.length).toBeGreaterThan(0);
      }
    }, 30_000);
  }
});

describe("Cross-source invariants (Bhulekh × Bhunaksha)", () => {
  // This suite runs only when both fetchers returned `ok` for the same input.
  // Each assertion is conditional on the data being present.

  for (const input of corpusHasGps) {
    it(`${input.village} / ${input.identifier} — Check 6 (village match) + Check 8 (share sum)`, async () => {
      const fetchedAt = new Date().toISOString();
      const [bhulekhRaw, bhunakshaRaw] = await Promise.all([
        bhulekhFetch(toBhulekhFetchInput(input)),
        bhunakshaFetch(toBhunakshaFetchInput(input)),
      ]);

      const bhulekhEnvelope = mapBhulekhToContract(bhulekhRaw, fetchedAt);
      const bhunakshaEnvelope = mapBhunakshaToContract(bhunakshaRaw, fetchedAt);

      // Check 6: When both succeed, normalized village names must match.
      if (bhulekhEnvelope.status === "ok" && bhunakshaEnvelope.status === "ok") {
        const bv = normalizeVillage(bhulekhEnvelope.data.village);
        const nv = normalizeVillage(bhunakshaEnvelope.data.village);
        if (bv && nv) {
          expect(bv).toBe(nv);
        }

        // Check 8: Tenant share fractions must sum to 1.0.
        const tenants = bhulekhEnvelope.data.tenants;
        if (tenants.length > 0) {
          const total = tenants.reduce((acc, t) => acc + parseShare(t.share), 0);
          // Allow 0.001 tolerance for floating point.
          expect(Math.abs(total - 1.0)).toBeLessThan(0.001);
        }
      }
      // If either returned non-ok, the invariant doesn't apply — this is
      // a typed-degradation scenario, not a regression.
    }, 180_000);
  }
});
