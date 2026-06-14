/**
 * Sprint V2 — eCourts + RCCMS corpus regression (100% confidence).
 *
 * Per the 2026-06-14 plan, this suite asserts that every valid Khordha input
 * returns a typed-correct contract envelope from the eCourts case-search
 * fetcher and the RCCMS revenue-court fetcher. Mirrors the structure of
 * `bhulekh-bhunaksha-corpus.test.ts` (commit 4a90b6c).
 *
 * Two additions specific to this file:
 *  1. The eCourts fetcher takes a *party name*, not a plot identifier. The
 *     corpus inputs have plot info, not names, so we synthesize a stable
 *     party name from the village + identifier to exercise the fetcher.
 *  2. RCCMS calls the live fetcher behind a 5s budget; this test calls the
 *     fetcher directly (not via the pipeline wrapper) so a hung portal
 *     surfaces as a typed `source_down` envelope, not a test timeout.
 *
 * CI runs the first 5 inputs per fetcher (~7.5 min worst case). Locally or
 * in nightly, set `RUN_FULL_CORPUS=1` to exercise all 4,389 inputs.
 *
 * Per CLAUDE.md: no abstractions beyond what the task requires. Helpers are
 * inlined, not extracted.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { ecourtsFetch } from "@cleardeed/fetcher-ecourts";
import { fetch as rccmsFetch } from "@cleardeed/fetcher-rccms";

import {
  EcourtsContract,
  mapEcourtsToContract,
} from "../../apps/web/src/lib/pipeline/contracts/ecourts";
import {
  RccmsContract,
  mapRccmsToContract,
} from "../../apps/web/src/lib/pipeline/contracts/rccms";

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
 * Synthesize a stable party name from a corpus input. eCourts needs a
 * *name*, not a plot number — we use the village + identifier as a
 * deterministic string so the test is reproducible.
 */
function synthesizePartyName(input: CorpusInput): string {
  // Pad with "Kumar" so the name has the expected Indian-name shape
  // (helps the OCR name-variants path produce useful variants).
  return `${input.village} Kumar ${input.identifier.replace(/[^a-z0-9]/gi, "")}`;
}

const corpus = loadCorpus();

describe("eCourts — corpus regression (typed contract envelope)", () => {
  it("loads at least one corpus input", () => {
    expect(corpus.length).toBeGreaterThan(0);
  });

  for (const input of corpus) {
    it(`${input.tahasil} / ${input.village} / ${input.identifier} → typed envelope`, async () => {
      const fetchedAt = new Date().toISOString();
      const result = await ecourtsFetch({
        partyName: synthesizePartyName(input),
        districtName: "Khordha",
        districtCode: "8",
        tryNameVariants: false,
      });

      expect(result.source).toBe("ecourts");

      // Convert to typed contract envelope.
      const envelope = mapEcourtsToContract(result, fetchedAt);

      // Typed envelope: must pass Zod.
      const parsed = EcourtsContract.safeParse(envelope);
      if (!parsed.success) {
        console.error(`[${input.identifier}] eCourts envelope failed Zod:`, parsed.error.issues);
      }
      expect(parsed.success).toBe(true);

      // Per-status structural invariants.
      if (parsed.data.status === "ok") {
        const data = parsed.data.data;
        // total must equal cases.length when no pagination is involved
        expect(data.total).toBe(data.cases.length);
        // Every case must have the four required fields + at least one party
        for (const c of data.cases) {
          expect(c.caseNo.length).toBeGreaterThan(0);
          expect(c.caseType.length).toBeGreaterThan(0);
          expect(c.court.length).toBeGreaterThan(0);
          expect(c.status.length).toBeGreaterThan(0);
          expect(c.parties.length).toBeGreaterThan(0);
        }
      } else {
        // Failure branch: must have a structured error with code + message
        expect(parsed.data.error).toBeDefined();
        expect(parsed.data.error.code.length).toBeGreaterThan(0);
        expect(parsed.data.error.message.length).toBeGreaterThan(0);
      }
    }, 180_000);
  }
});

describe("RCCMS — corpus regression (typed contract envelope)", () => {
  it("loads at least one corpus input", () => {
    expect(corpus.length).toBeGreaterThan(0);
  });

  for (const input of corpus) {
    it(`${input.tahasil} / ${input.village} / ${input.identifier} → typed envelope`, async () => {
      const fetchedAt = new Date().toISOString();
      // The live fetcher caps its own internal probe at 3s; the pipeline
      // adds a 5s wrapper. We call the fetcher directly so the test
      // surfaces whatever the fetcher decides to return — typed-degradation
      // included.
      const result = await rccmsFetch({
        district: "Khordha",
        tahasil: input.tahasil,
        village: input.village,
        plotNo: input.identifier,
      });

      expect(result.source).toBe("rccms");

      // Convert to typed contract envelope.
      const envelope = mapRccmsToContract(result, fetchedAt);

      // Typed envelope: must pass Zod.
      const parsed = RccmsContract.safeParse(envelope);
      if (!parsed.success) {
        console.error(`[${input.identifier}] RCCMS envelope failed Zod:`, parsed.error.issues);
      }
      expect(parsed.success).toBe(true);

      // Per-status structural invariants.
      if (parsed.data.status === "ok") {
        const data = parsed.data.data;
        expect(data.total).toBe(data.cases.length);
        for (const c of data.cases) {
          expect(c.caseNo.length).toBeGreaterThan(0);
          expect(c.caseType.length).toBeGreaterThan(0);
          expect(c.court.length).toBeGreaterThan(0);
          expect(c.status.length).toBeGreaterThan(0);
        }
      } else {
        expect(parsed.data.error).toBeDefined();
        expect(parsed.data.error.code.length).toBeGreaterThan(0);
        expect(parsed.data.error.message.length).toBeGreaterThan(0);
      }
    }, 30_000);
  }
});

describe("Cross-source sanity (eCourts × RCCMS)", () => {
  // When both fetchers return `ok` for the same plot, the case sets should
  // be distinct — eCourts finds civil/criminal cases, RCCMS finds revenue
  // cases. Overlap on `caseNo` would indicate a duplicate-system error.

  for (const input of corpus) {
    it(`${input.village} / ${input.identifier} — case sets are disjoint`, async () => {
      const fetchedAt = new Date().toISOString();
      const [ecourtsRaw, rccmsRaw] = await Promise.all([
        ecourtsFetch({
          partyName: synthesizePartyName(input),
          districtName: "Khordha",
          districtCode: "8",
          tryNameVariants: false,
        }),
        rccmsFetch({
          district: "Khordha",
          tahasil: input.tahasil,
          village: input.village,
          plotNo: input.identifier,
        }),
      ]);

      const ecourtsEnvelope = mapEcourtsToContract(ecourtsRaw, fetchedAt);
      const rccmsEnvelope = mapRccmsToContract(rccmsRaw, fetchedAt);

      if (ecourtsEnvelope.status === "ok" && rccmsEnvelope.status === "ok") {
        const ecourtsCaseNos = new Set(ecourtsEnvelope.data.cases.map((c) => c.caseNo));
        for (const c of rccmsEnvelope.data.cases) {
          expect(ecourtsCaseNos.has(c.caseNo)).toBe(false);
        }
      }
      // If either returned non-ok, the cross-source check doesn't apply.
    }, 120_000);
  }
});
