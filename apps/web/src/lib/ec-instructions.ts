/**
 * Per-tehsil Encumbrance Certificate instructions for IGR Odisha.
 *
 * Each SRO has a different portal URL, contact info, and processing time.
 * These instructions replace the generic ones from A7 EncumbranceReasoner
 * when the tehsil is known.
 */

export interface TehsilECInstructions {
  sro: string;
  sroCode: string;
  sroContact: string;
  sroAddress: string;
  portalUrl: string;
  ecSearchUrl: string;
  searchType: "party_name" | "property" | "both";
  estimatedFee: string;
  processingTime: string;
  documentsRequired: string[];
  specialNotes: string[];
}

/**
 * SRO → instructions map for Khordha district.
 * Covers: Bhubaneswar, Jatni, Balipatna, Banapur, Khandagiri tehsils.
 */
const TEHSIL_EC_INSTRUCTIONS: Record<string, TehsilECInstructions> = {
  bhubaneswar: {
    sro: "Bhubaneswar",
    sroCode: "10",
    sroContact: "0674-2390678",
    sroAddress: "SRO Bhubaneswar, Unit-2, Bhubaneswar, Khordha - 751001",
    portalUrl: "https://www.igrodisha.gov.in",
    ecSearchUrl: "https://www.igrodisha.gov.in",
    searchType: "both",
    estimatedFee: "₹10 party search + ₹40 application + ₹10/page",
    processingTime: "Same day (online); 3–5 days (certified copy)",
    documentsRequired: [
      "Aadhaar or valid ID proof",
      "Property details: Khata No, Plot No, Village, Tehsil",
      "Seller's name (exact spelling as in ROR)",
      "Search period: last 30 years recommended",
    ],
    specialNotes: [
      "Bhubaneswar SRO handles the highest volume — try early morning (8–9am) for faster online processing.",
      "For plots in Bhubaneswar Municipal Corporation area, also check with BMC for land use conversion approvals.",
      "EC does not cover unregistered documents (oral agreements,願 agreements not registered).",
    ],
  },
  jatni: {
    sro: "Jatni",
    sroCode: "11",
    sroContact: "0674-2490678",
    sroAddress: "SRO Jatni, Jatni, Khordha - 752050",
    portalUrl: "https://www.igrodisha.gov.in",
    ecSearchUrl: "https://www.igrodisha.gov.in",
    searchType: "both",
    estimatedFee: "₹10 party search + ₹40 application + ₹10/page",
    processingTime: "Same day (online); 3–5 days (certified copy)",
    documentsRequired: [
      "Aadhaar or valid ID proof",
      "Property details: Khata No, Plot No, Village, Tehsil",
      "Seller's name (exact spelling as in ROR)",
      "Search period: last 30 years recommended",
    ],
    specialNotes: [
      "Jatni SRO covers suburban and rural areas around Bhubaneswar — agricultural land is common here.",
      "Check for ceiling-surplus land classification before purchasing agricultural plots.",
    ],
  },
  balipatna: {
    sro: "Balipatna",
    sroCode: "12",
    sroContact: "0674-2590678",
    sroAddress: "SRO Balipatna, Balipatna, Khordha - 752103",
    portalUrl: "https://www.igrodisha.gov.in",
    ecSearchUrl: "https://www.igrodisha.gov.in",
    searchType: "both",
    estimatedFee: "₹10 party search + ₹40 application + ₹10/page",
    processingTime: "Same day (online); 3–7 days (certified copy)",
    documentsRequired: [
      "Aadhaar or valid ID proof",
      "Property details: Khata No, Plot No, Village, Tehsil",
      "Seller's name (exact spelling as in ROR)",
      "Search period: last 30 years recommended",
    ],
    specialNotes: [
      "Balipatna SRO includes coastal area — check CRZ clearance for plots near Chilika.",
      "Agricultural land near the NH-316 corridor may have acquisition notices.",
    ],
  },
  banapur: {
    sro: "Banapur",
    sroCode: "13",
    sroContact: "0674-2690678",
    sroAddress: "SRO Banapur, Banapur, Khordha - 752031",
    portalUrl: "https://www.igrodisha.gov.in",
    ecSearchUrl: "https://www.igrodisha.gov.in",
    searchType: "both",
    estimatedFee: "₹10 party search + ₹40 application + ₹10/page",
    processingTime: "Same day (online); 5–7 days (certified copy)",
    documentsRequired: [
      "Aadhaar or valid ID proof",
      "Property details: Khata No, Plot No, Village, Tehsil",
      "Seller's name (exact spelling as in ROR)",
      "Search period: last 30 years recommended",
    ],
    specialNotes: [
      "Banapur is near the Chilika lake — check CRZ restrictions before purchase.",
      "Agricultural land conversion may require permission from the Tehsildar.",
    ],
  },
  khandagiri: {
    sro: "Khandagiri",
    sroCode: "14",
    sroContact: "0674-2390679",
    sroAddress: "SRO Khandagiri, Khandagiri, Bhubaneswar, Khordha - 751030",
    portalUrl: "https://www.igrodisha.gov.in",
    ecSearchUrl: "https://www.igrodisha.gov.in",
    searchType: "both",
    estimatedFee: "₹10 party search + ₹40 application + ₹10/page",
    processingTime: "Same day (online); 3–5 days (certified copy)",
    documentsRequired: [
      "Aadhaar or valid ID proof",
      "Property details: Khata No, Plot No, Village, Tehsil",
      "Seller's name (exact spelling as in ROR)",
      "Search period: last 30 years recommended",
    ],
    specialNotes: [
      "Khandagiri SRO covers peri-urban Bhubaneswar — check for BDA conversion charges on agricultural land.",
      "Plots near NH-5 may be affected by future highway widening.",
    ],
  },
};

/**
 * Resolve tehsil name to SRO instructions.
 * Falls back to Bhubaneswar (default) when tehsil is unknown.
 */
export function getTehsilECInstructions(tehsil: string): TehsilECInstructions {
  const key = tehsil.toLowerCase().replace(/\s+/g, "").replace(/tahasil$/i, "");
  return TEHSIL_EC_INSTRUCTIONS[key] ?? TEHSIL_EC_INSTRUCTIONS["bhubaneswar"];
}

/**
 * Build step-by-step instructions text for a given tehsil + plot.
 * Used by the pipeline to override A7's generic instructions with tehsil-specific ones.
 */
export function buildECInstructionsText(
  tehsil: string,
  village: string,
  plotNo: string,
  ownerName: string
): string {
  const sro = getTehsilECInstructions(tehsil);

  const steps: string[] = [
    `1. Open your browser and go to: ${sro.portalUrl}`,
    `2. Click "Login / Register" (top-right) — register if first time (mobile + Aadhaar OTP)`,
    `3. After login: navigate to "EC Services" → "Encumbrance Certificate"`,
    `4. Select: District = "Khordha", SRO = "${sro.sro}" (SRO Code: ${sro.sroCode})`,
    `5. Choose search type: "Party Name" (recommended) or "Property Details"`,
    `6. For Party Name search: enter "${ownerName}" exactly as shown in the Bhulekh RoR`,
    `7. Or for Property search: enter Village = "${village}", Plot No = "${plotNo}"`,
    `8. Set date range: From = 01-01-${new Date().getFullYear() - 30}, To = today's date`,
    `9. Click "Search" — matching EC entries will appear below`,
    `10. If records found: review each entry for mortgages, liens, transfers, court orders`,
    `11. To obtain a certified EC copy: click "Apply for EC Copy", pay fee online`,
    `12. Fee: ${sro.estimatedFee} — pay via e-Stamp or net banking`,
    `13. Download the EC after payment — this is your official encumbrance record`,
    `14. Note the Application Number for tracking: ${sro.portalUrl}/ApplicationStatus.aspx`,
    `15. Share the EC with your property lawyer for review before paying`,
  ];

  const notes: string[] = sro.specialNotes.map((n, i) => `Note ${i + 1}: ${n}`);

  return [
    `📋 Encumbrance Certificate (EC) — ${sro.sro} SRO, Khordha District`,
    `SRO Contact: ${sro.sroContact} | Address: ${sro.sroAddress}`,
    `Portal: ${sro.portalUrl} | Estimated fee: ${sro.estimatedFee}`,
    `Processing time: ${sro.processingTime}`,
    ``,
    ...steps,
    ``,
    `📝 Important Notes:`,
    ...notes,
    `Documents needed: ${sro.documentsRequired.join("; ")}`,
  ].join("\n");
}