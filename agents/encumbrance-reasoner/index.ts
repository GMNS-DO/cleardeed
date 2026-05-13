/**
 * EncumbranceReasoner (A7) — Encumbrance Certificate instructions for ClearDeed
 *
 * V1 does not retrieve EC automatically. Instead, generates the IGR deep-link
 * and step-by-step instructions for manual EC retrieval from the Sub-Registrar office.
 *
 * Future: User-uploaded EC review, automatic encumbrance search via IGR API.
 */

export interface PlotIdentifier {
  district: string;
  tahasil: string;
  sro?: string;
  village: string;
  plotNo: string;
  khataNo?: string;
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
    ` - Government fee (typically ₹100 - ₹500 depending on search period and pages)`,
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
