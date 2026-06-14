/**
 * Sprint V2 — IGR-EC, CERSAI, Circle-Rate, BDA-Zoning, Nominatim corpus regression.
 *
 * Per the 2026-06-14 plan, this suite closes the "adapters missing" gap for
 * the 5 remaining wired fetchers that have contracts but no mapXToContract
 * adapter. Mirrors `bhulekh-bhunaksha-corpus.test.ts` and
 * `ecourts-rccms-corpus.test.ts`.
 *
 * Each fetcher takes different inputs:
 *   - IGR-EC:            partyName + district + fromYear + toYear
 *   - CERSAI:            partyName + partyType
 *   - Circle-Rate:       mouza + tehsil + kisam (synthesized from corpus)
 *   - BDA-Zoning:        village + tehsil
 *   - Nominatim:         GPS coords
 *
 * The corpus inputs are plot-level (tahasil, village, identifier, coords),
 * not party/borrower/asset level. For IGR-EC and CERSAI we synthesize a
 * stable party name from the village + identifier so the test is
 * reproducible. For Circle-Rate, BDA-Zoning, and Nominatim the corpus
 * inputs map directly.
 *
 * CI slice: first 5 inputs per fetcher. `RUN_FULL_CORPUS=1` for nightly.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { igrEcFetch } from "@cleardeed/fetcher-igr-ec";
import { cersaiFetch } from "@cleardeed/fetcher-cersai";
import { fetch as circleRateFetch } from "@cleardeed/fetcher-circle-rate";
import { fetch as bdaZoningFetch } from "@cleardeed/fetcher-bda-zoning";
import { nominatimFetch } from "@cleardeed/fetcher-nominatim";

import {
  IgrEcContract,
  mapIgrEcToContract,
} from "../../apps/web/src/lib/pipeline/contracts/igr-ec";
import {
  CersaiContract,
  mapCersaiToContract,
} from "../../apps/web/src/lib/pipeline/contracts/cersai";
import {
  CircleRateContract,
  mapCircleRateToContract,
} from "../../apps/web/src/lib/pipeline/contracts/circle-rate";
import {
  BdaZoningContract,
  mapBdaZoningToContract,
} from "../../apps/web/src/lib/pipeline/contracts/bda-zoning";
import {
  NominatimContract,
  mapNominatimToContract,
} from "../../apps/web/src/lib/pipeline/contracts/nominatim";

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

/** Stable party-name synthesis for the case-data fetchers (IGR-EC, CERSAI). */
function synthesizePartyName(input: CorpusInput): string {
  return `${input.village} Kumar ${input.identifier.replace(/[^a-z0-9]/gi, "")}`;
}

const corpus = loadCorpus();

// ── IGR-EC ────────────────────────────────────────────────────────────────

describe("IGR-EC — corpus regression (typed contract envelope)", () => {
  it("loads at least one corpus input", () => {
    expect(corpus.length).toBeGreaterThan(0);
  });

  for (const input of corpus) {
    it(`${input.tahasil} / ${input.village} / ${input.identifier} → typed envelope`, async () => {
      const fetchedAt = new Date().toISOString();
      const result = await igrEcFetch({
        partyName: synthesizePartyName(input),
        district: "Khordha",
        fromYear: 2010,
        toYear: 2026,
      });

      const envelope = mapIgrEcToContract(result, fetchedAt);
      const parsed = IgrEcContract.safeParse(envelope);
      if (!parsed.success) {
        console.error(`[${input.identifier}] IGR-EC envelope failed Zod:`, parsed.error.issues);
      }
      expect(parsed.success).toBe(true);

      if (parsed.data.status === "ok") {
        expect(typeof parsed.data.data.ecAvailable).toBe("boolean");
      } else {
        expect(parsed.data.error).toBeDefined();
        expect(parsed.data.error.code.length).toBeGreaterThan(0);
        expect(parsed.data.error.message.length).toBeGreaterThan(0);
      }
    }, 60_000);
  }
});

// ── CERSAI ────────────────────────────────────────────────────────────────

describe("CERSAI — corpus regression (typed contract envelope)", () => {
  for (const input of corpus) {
    it(`${input.tahasil} / ${input.village} / ${input.identifier} → typed envelope`, async () => {
      const fetchedAt = new Date().toISOString();
      const result = await cersaiFetch({
        name: synthesizePartyName(input),
        partyType: "individual",
      });

      const envelope = mapCersaiToContract(result, fetchedAt);
      const parsed = CersaiContract.safeParse(envelope);
      if (!parsed.success) {
        console.error(`[${input.identifier}] CERSAI envelope failed Zod:`, parsed.error.issues);
      }
      expect(parsed.success).toBe(true);

      if (parsed.data.status === "ok") {
        // ok branch: charges array, totals, or all three optional
        const d = parsed.data.data;
        if (d.charges !== undefined) {
          for (const c of d.charges) {
            // chargeType/chargeStatus are optional; just check string types if present
            if (c.chargeType !== undefined) expect(typeof c.chargeType).toBe("string");
            if (c.chargeStatus !== undefined) {
              expect(["Active", "Satisfied", "Unknown"]).toContain(c.chargeStatus);
            }
          }
        }
      } else {
        expect(parsed.data.error).toBeDefined();
        expect(parsed.data.error.code.length).toBeGreaterThan(0);
        expect(parsed.data.error.message.length).toBeGreaterThan(0);
      }
    }, 60_000);
  }
});

// ── Circle-Rate ───────────────────────────────────────────────────────────

describe("Circle-Rate — corpus regression (typed contract envelope)", () => {
  for (const input of corpus) {
    it(`${input.tahasil} / ${input.village} / ${input.identifier} → typed envelope`, async () => {
      const fetchedAt = new Date().toISOString();
      // Map corpus (tahasil, village, identifier) to (mouza, tehsil, kisam).
      // The corpus identifiers look like "D/114" (khatiyan) or "25/98" (plot).
      // The local JSON has rows keyed on mouza/tehsil/kisam — pass the village
      // as mouza and "Residential" as a default kisam.
      const result = await circleRateFetch({
        mouza: input.village,
        tehsil: input.tahasil,
        kisam: "Residential",
      });

      const envelope = mapCircleRateToContract(result, fetchedAt);
      const parsed = CircleRateContract.safeParse(envelope);
      if (!parsed.success) {
        console.error(`[${input.identifier}] Circle-Rate envelope failed Zod:`, parsed.error.issues);
      }
      expect(parsed.success).toBe(true);

      if (parsed.data.status === "ok") {
        for (const row of parsed.data.data.rows) {
          expect(row.ratePerAcre).toBeGreaterThanOrEqual(0);
          expect(row.ratePerSqft).toBeGreaterThanOrEqual(0);
          expect(["rural", "urban", "peri-urban"]).toContain(row.rateType);
        }
      } else {
        expect(parsed.data.error).toBeDefined();
      }
    }, 15_000);
  }
});

// ── BDA-Zoning ────────────────────────────────────────────────────────────

describe("BDA-Zoning — corpus regression (typed contract envelope)", () => {
  for (const input of corpus) {
    it(`${input.tahasil} / ${input.village} / ${input.identifier} → typed envelope`, async () => {
      const fetchedAt = new Date().toISOString();
      const result = await bdaZoningFetch({
        village: input.village,
        tehsil: input.tahasil,
      });

      const envelope = mapBdaZoningToContract(result, fetchedAt);
      const parsed = BdaZoningContract.safeParse(envelope);
      if (!parsed.success) {
        console.error(`[${input.identifier}] BDA-Zoning envelope failed Zod:`, parsed.error.issues);
      }
      expect(parsed.success).toBe(true);

      // Valid statuses: ok | no_data | source_down | invalid_input | parse_error | out_of_scope
      expect(["ok", "no_data", "source_down", "invalid_input", "parse_error", "out_of_scope"])
        .toContain(parsed.data.status);

      if (parsed.data.status === "ok") {
        for (const row of parsed.data.data.rows) {
          expect(["residential", "commercial", "industrial", "green_belt", "special", "mixed_use", "institutional"])
            .toContain(row.zone.id);
        }
      }
    }, 15_000);
  }
});

// ── Nominatim ─────────────────────────────────────────────────────────────

describe("Nominatim — corpus regression (typed contract envelope)", () => {
  for (const input of corpus) {
    it(`${input.tahasil} / ${input.village} / ${input.identifier} → typed envelope`, async () => {
      const fetchedAt = new Date().toISOString();
      if (!input.coordinates) {
        // Skip — most corpus inputs have coords but if not, return no_data path
        const envelope = mapNominatimToContract(
          { source: "nominatim", status: "failed", statusReason: "no_data", fetchedAt: new Date().toISOString(), inputsTried: [] } as never,
          fetchedAt,
        );
        expect(envelope.status).toBe("no_data");
        return;
      }

      const result = await nominatimFetch({
        gps: input.coordinates,
      });

      const envelope = mapNominatimToContract(result, fetchedAt);
      const parsed = NominatimContract.safeParse(envelope);
      if (!parsed.success) {
        console.error(`[${input.identifier}] Nominatim envelope failed Zod:`, parsed.error.issues);
      }
      expect(parsed.success).toBe(true);

      if (parsed.data.status === "ok") {
        expect(parsed.data.data.displayName.length).toBeGreaterThan(0);
      } else {
        expect(parsed.data.error).toBeDefined();
        expect(parsed.data.error.code.length).toBeGreaterThan(0);
        expect(parsed.data.error.message.length).toBeGreaterThan(0);
      }
    }, 30_000);
  }
});
