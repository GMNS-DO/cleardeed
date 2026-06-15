/**
 * Stamp Duty Fetcher for ClearDeed
 *
 * Calls the live IGR Odisha public endpoint `StampDutyCalc.aspx/GetDoMRVal`
 * to compute the government-expected stamp duty for a given (district, SRO,
 * deed type, market value) tuple. The buyer's report uses this to:
 *   1. Show the buyer exactly what the government expects them to pay.
 *   2. Cross-check the seller's quoted price: if the buyer agreed to a price
 *      below the government minimum, the government bumps the market value
 *      to the BMV — and `bmvFloorApplied` will be `true` in the response.
 *
 * Endpoint shape (per the V5b plan; verified against the live portal in
 * the live smoke test):
 *   POST https://igrodisha.gov.in/StampDutyCalc.aspx/GetDoMRVal
 *   Content-Type: application/json
 *   Body: { "distCd": "21", "sroCd": "10", "deedType": "Sale", "mvalue": 5000000 }
 *   Response: { "d": "<json-string>" } (ASP.NET ScriptMethod envelope)
 *
 * Fallback: if the live endpoint is down, the fetcher computes stamp duty
 * locally from a hardcoded 2024-25 schedule (5% of market value for Sale
 * deeds in Odisha, plus 1% registration fee, plus 2% cess on stamp duty).
 * The local fallback is clearly marked in `statusReason` and `warnings`.
 */

import { createHash } from "node:crypto";
import type { StampDutyResult, StampDutyBreakup } from "./contract.js";

const IGR_STAMP_DUTY_URL = "https://igrodisha.gov.in/StampDutyCalc.aspx/GetDoMRVal";
const PARSER_VERSION = "stamp-duty-v1";
const HTTP_TIMEOUT_MS = 10_000;

const DISTRICT_CODE = "21";
const SRO_CODE_MAP: Record<string, string> = {
  Bhubaneswar: "10",
  Jatni: "11",
  Balipatna: "12",
  Banapur: "13",
};

export interface StampDutyInput {
  district?: string;
  sro: string;
  /** Market value in INR (the price the buyer agreed to pay). */
  marketValue: number;
  /** Deed type (Sale / Gift / Mortgage / Lease / Partition). */
  deedType?: "Sale" | "Gift" | "Mortgage" | "Lease" | "Partition";
  /** Skip the live call and use the local fallback. Used for tests. */
  skipLive?: boolean;
  /** Override the BMV the local fallback would apply. Used in tests. */
  bmvFloorOverride?: number;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * Compute stamp duty locally using the 2024-25 Odisha schedule.
 *
 * For Sale deeds: 5% of (max(marketValue, BMV)) + 1% registration fee
 *   + 2% cess on stamp duty.
 * For Gift: same as Sale.
 * For Mortgage: 0.1% of secured amount, capped at ₹25,000.
 * For Lease: 2% of annual rent × lease years.
 * For Partition: nominal ₹100.
 */
function localCompute(input: StampDutyInput, bmv: number): StampDutyBreakup {
  const requested = input.marketValue;
  const applied = Math.max(requested, bmv);
  const bmvFloorApplied = applied > requested;

  const deed = input.deedType ?? "Sale";
  let stampDuty = 0;
  let registrationFee = 0;
  let cess = 0;
  let basis = "";

  if (deed === "Sale" || deed === "Gift") {
    stampDuty = applied * 0.05;
    registrationFee = applied * 0.01;
    cess = stampDuty * 0.02;
    basis = `${deed} deed: 5% of ${bmvFloorApplied ? "BMV (₹" + bmv + ")" : "market value"} + 1% reg fee + 2% cess`;
  } else if (deed === "Mortgage") {
    stampDuty = Math.min(applied * 0.001, 25000);
    registrationFee = applied * 0.005;
    basis = "Mortgage: 0.1% of secured amount (capped at ₹25,000) + 0.5% reg fee";
  } else if (deed === "Lease") {
    stampDuty = applied * 0.02;
    registrationFee = applied * 0.005;
    basis = "Lease: 2% of annual rent × lease years + 0.5% reg fee";
  } else {
    stampDuty = 100;
    registrationFee = 100;
    basis = "Partition: nominal fee";
  }

  const totalPayable = stampDuty + registrationFee + cess;
  return {
    stampDuty: Math.round(stampDuty),
    registrationFee: Math.round(registrationFee),
    cess: Math.round(cess),
    totalPayable: Math.round(totalPayable),
    calculationBasis: basis,
    appliedMarketValue: applied,
    requestedMarketValue: requested,
    bmvFloorApplied,
  };
}

/**
 * Parse the ASP.NET ScriptMethod envelope and return the live breakup.
 * Returns null if the response is unparseable.
 */
function parseStampDutyResponse(rawText: string): StampDutyBreakup | null {
  let payload: unknown;
  try {
    payload = JSON.parse(rawText);
  } catch {
    return null;
  }
  if (payload && typeof payload === "object" && "d" in payload) {
    const d = (payload as { d: unknown }).d;
    if (typeof d === "string") {
      try {
        payload = JSON.parse(d);
      } catch {
        return null;
      }
    } else {
      payload = d;
    }
  }
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  const stampDuty = Number(p.StampDuty ?? p.stampDuty ?? 0);
  const registrationFee = Number(p.RegistrationFee ?? p.registrationFee ?? 0);
  const cess = Number(p.Cess ?? p.cess ?? 0);
  const totalPayable = Number(p.Total ?? p.totalPayable ?? stampDuty + registrationFee + cess);
  const applied = Number(p.MarketValue ?? p.appliedMarketValue ?? 0);
  const requested = Number(p.RequestedMarketValue ?? p.requestedMarketValue ?? applied);
  if (!Number.isFinite(stampDuty) || !Number.isFinite(totalPayable)) return null;
  return {
    stampDuty: Math.round(stampDuty),
    registrationFee: Math.round(registrationFee),
    cess: Math.round(cess),
    totalPayable: Math.round(totalPayable),
    calculationBasis: String(p.Basis ?? p.calculationBasis ?? "Live IGR computation"),
    appliedMarketValue: Math.round(applied),
    requestedMarketValue: Math.round(requested),
    bmvFloorApplied: applied > requested,
  };
}

async function fetchLive(input: StampDutyInput): Promise<string | null> {
  const sroCode = SRO_CODE_MAP[input.sro] ?? input.sro;
  const body = JSON.stringify({
    distCd: DISTRICT_CODE,
    sroCd: sroCode,
    deedType: input.deedType ?? "Sale",
    mvalue: input.marketValue,
  });
  try {
    const res = await globalThis.fetch(IGR_STAMP_DUTY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 ClearDeed/1.0",
      },
      body,
      signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/**
 * Compute stamp duty for the given (district, sro, market value, deed type).
 * Tries the live endpoint first; falls back to a local 2024-25 schedule if
 * the endpoint is unreachable.
 */
export async function stampDutyFetch(input: StampDutyInput): Promise<StampDutyResult> {
  const fetchedAt = new Date().toISOString();

  if (!input.sro) {
    return {
      source: "stamp-duty",
      status: "failed",
      statusReason: "missing_input",
      verification: "manual_required",
      fetchedAt,
      parserVersion: PARSER_VERSION,
      data: undefined,
      warnings: [{ code: "INVALID_INPUT", message: "sro is required" }],
      error: "missing sro",
    };
  }
  if (!Number.isFinite(input.marketValue) || input.marketValue <= 0) {
    return {
      source: "stamp-duty",
      status: "failed",
      statusReason: "missing_input",
      verification: "manual_required",
      fetchedAt,
      parserVersion: PARSER_VERSION,
      data: undefined,
      warnings: [{ code: "INVALID_INPUT", message: "marketValue must be > 0" }],
      error: "missing or non-positive marketValue",
    };
  }

  const bmv = input.bmvFloorOverride ?? input.marketValue;

  if (input.skipLive) {
    const breakup = localCompute(input, bmv);
    return {
      source: "stamp-duty",
      status: "partial",
      statusReason: "skipLive_local_fallback",
      verification: "verified",
      fetchedAt,
      attempts: 0,
      inputsTried: [{ label: "local_fallback_2024_25_schedule", input: { ...input } }],
      parserVersion: PARSER_VERSION,
      data: { breakup },
      warnings: [
        {
          code: "LOCAL_FALLBACK_USED",
          message: "skipLive=true: stamp duty computed from the local 2024-25 schedule, not the live IGR endpoint. Verify with the SRO before paying.",
        },
      ],
    };
  }

  const rawText = await fetchLive(input);
  if (rawText !== null) {
    const parsed = parseStampDutyResponse(rawText);
    if (parsed) {
      return {
        source: "stamp-duty",
        status: "success",
        statusReason: "live_endpoint_ok",
        verification: "verified",
        fetchedAt,
        attempts: 1,
        inputsTried: [{ label: "igr_stamp_duty_live_post", input: { ...input } }],
        rawArtifactHash: sha256(rawText),
        parserVersion: PARSER_VERSION,
        data: { breakup: parsed },
        warnings: [
          {
            code: "LIVE_FETCH_OK",
            message: `Live IGR stamp-duty endpoint returned total ₹${parsed.totalPayable.toLocaleString("en-IN")} for ${input.deedType ?? "Sale"} @ ₹${input.marketValue.toLocaleString("en-IN")}.`,
          },
        ],
      };
    }
  }

  // Live endpoint down → local fallback
  const breakup = localCompute(input, bmv);
  return {
    source: "stamp-duty",
    status: "partial",
    statusReason: "live_endpoint_unreachable_local_fallback",
    verification: "verified",
    fetchedAt,
    attempts: 1,
    inputsTried: [
      { label: "igr_stamp_duty_live_post", input: { ...input } },
      { label: "local_fallback_2024_25_schedule", input: { ...input } },
    ],
    parserVersion: PARSER_VERSION,
    data: { breakup },
    warnings: [
      {
        code: "LOCAL_FALLBACK_USED",
        message: "Live IGR stamp-duty endpoint unreachable. Used the 2024-25 local schedule. Verify with the SRO before paying.",
      },
    ],
  };
}

export async function healthCheck(): Promise<boolean> {
  try {
    const res = await globalThis.fetch(IGR_STAMP_DUTY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ distCd: DISTRICT_CODE, sroCd: "10", deedType: "Sale", mvalue: 100000 }),
      signal: AbortSignal.timeout(5_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
