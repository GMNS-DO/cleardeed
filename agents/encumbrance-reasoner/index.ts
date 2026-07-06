/**
 * EncumbranceReasoner (A7) — Encumbrance Certificate instructions for ClearDeed
 *
 * V1 does not retrieve EC automatically. Instead, generates the IGR deep-link
 * and step-by-step instructions for manual EC retrieval from the Sub-Registrar office.
 *
 * Future: User-uploaded EC review, automatic encumbrance search via IGR API.
 */
import { computeEcFeeRs, FEE_TABLE, feeLine } from "./fee-schedule";

export interface PlotIdentifier {
  district: string;
  tahasil: string;
  sro?: string;
  village: string;
  plotNo: string;
  khataNo?: string;
}

export interface EncumbranceEntry {
  docType?: string;
  docNo?: string;
  regDate?: string;
  party1?: string;
  party2?: string;
  propertyDesc?: string;
  consideration?: string;
  marketValue?: string;
}

export interface CERSAICharge {
  chargeType?: string;
  borrowerName?: string;
  propertyDesc?: string;
  securedCreditor?: string;
  chargeCreationDate?: string;
  chargeAmount?: string;
  chargeStatus?: "Active" | "Satisfied" | "Unknown";
  caseRef?: string;
}

export interface EncumbranceResult {
  status: "clear" | "encumbered" | "manual_required" | "error";
  encumbrances?: Array<{
    type: string;
    party?: string;
    amount?: string;
    date?: string;
    registrationNo?: string;
    source?: string;
  }>;
  /** IGR EC entries from the IGR Odisha EC fetcher — passthrough to the report. */
  igrEcEntries?: EncumbranceEntry[];
  /** CERSAI active/satisfied charges from the CERSAI fetcher — passthrough to the report. */
  cersaiCharges?: CERSAICharge[];
  clearPeriod?: { from?: string; to?: string };
  instructions: string | null;
  confidence: number;
  confidenceBasis: string;
}

/**
 * Reason about encumbrances on a given plot.
 *
 * In V1: generates manual EC retrieval instructions.
 * Future: call IGR API, check for pending mutations, court orders, mortgages.
 */
export function reasonEncumbrance(input: { plotIdentifier: PlotIdentifier }): EncumbranceResult {
  const { district, sro, village, plotNo } = input.plotIdentifier;

  const igrUrl = "https://odishalandrevenue.gov.in/igr/";
  const districtSroInstruction = isVerifiedText(district) && isVerifiedText(sro)
    ? `Select District: ${district}, SRO: ${sro}`
    : "Confirm the correct district and SRO in the live IGR Odisha flow or at the Sub-Registrar office before searching";

  // Build step-by-step instructions
  const instructions = [
    `Visit the Inspector General of Registration (IGR) Odisha portal at ${igrUrl}`,
    districtSroInstruction,
    `Search by Plot Number: ${plotNo} or Village: ${village}`,
    `Requirements for EC application:`,
    ` - Identity proof (Aadhaar/PAN)`,
    ` - Property details (Khata No, Plot No, Village, Tahasil, District)`,
    ` - Copy of previous registered deed (if available)`,
    ` - Government fee: ${feeLine("IGRSL_EC_FEE_PER_13Y")} (covers first 13 years) + ${feeLine("IGRSL_EC_FEE_PER_EXTRA_YEAR")} beyond. For a 30-year search the total is Rs. ${computeEcFeeRs(30)}.`,
    `Confirm and pay the current government fee shown on the portal or at the Sub-Registrar office`,
    `Download the Encumbrance Certificate for the last 30 years`,
    `Review the EC for: prior transfers, mortgages, liens, court attachments, pending mutations`,
  ].join("\n");

  return {
    status: "manual_required",
    instructions,
    confidence: 0,
    confidenceBasis: "EC retrieval is not automated in V1. Manual retrieval from IGR Odisha required.",
  };
}

function isVerifiedText(value: string | undefined): boolean {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized !== "" && normalized !== "not verified" && normalized !== "unknown" && normalized !== "—";
}
