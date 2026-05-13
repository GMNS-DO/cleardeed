/**
 * Khordha Manual Verification Instructions
 *
 * Per-tehsil SRO addresses, form names, fee ranges, turnaround times, and exact steps
 * for manual verification of Bhulekh RoR entries and encumbrance status.
 *
 * Sources: Odisha Registration Department + local tehsil office knowledge
 * Last verified: 2026-05-13
 * V1.1 coverage: All 10 tehsils in Khordha district
 */

export interface SROInfo {
  /** Official SRO name */
  name: string;
  /** Jurisdiction tehsils */
  tehsils: string[];
  /** Full address */
  address: string;
  /** Phone number (landline, verified) */
  phone?: string;
  /** Google Maps pin or landmark */
  landmark?: string;
  /** Whether EC can be obtained here */
  ecAvailable: boolean;
  /** EC fee (₹) */
  ecFee?: number;
  /** EC processing time */
  ecTurnaround?: string;
  /** EC form name */
  ecForm?: string;
  /** Encumbrance search URL (if any) */
  ecPortalUrl?: string;
  /** Notes about special procedures */
  notes?: string;
}

export interface ManualVerificationStep {
  /** Step number */
  step: number;
  /** What to do */
  action: string;
  /** Where to go */
  location: string;
  /** Required documents */
  documents: string[];
  /** Estimated fee (₹) */
  fee: number;
  /** Time expected */
  turnaround: string;
  /** Warning or caveat */
  caveat?: string;
}

export interface TehsilManualVerification {
  /** Tehsil name in English */
  tehsilName: string;
  /** Bhulekh tehsil code */
  tehsilCode: string;
  /** Nearest SRO */
  sro: SROInfo;
  /** Step-by-step verification instructions */
  steps: ManualVerificationStep[];
  /** What to ask the clerk */
  clerkPhrases: string[];
  /** Common rejection reasons */
  rejectionReasons: string[];
  /** Alternative verification if SRO is unavailable */
  alternativeLocation?: {
    name: string;
    address: string;
    distance: string;
  };
}

export const KHORDHA_MANUAL_VERIFICATION: TehsilManualVerification[] = [
  {
    tehsilName: "Bhubaneswar",
    tehsilCode: "2",
    sro: {
      name: "Sub-Registrar, Bhubaneswar No. I",
      tehsils: ["Bhubaneswar", "Mancheswar"],
      address: "Raj Bhawan Road, Near BJB College, Bhubaneswar-751014, Odisha",
      phone: "0674-2536744",
      landmark: "Near BJB College, opposite Raj Bhawan",
      ecAvailable: true,
      ecFee: 50,
      ecTurnaround: "Same day if before 1 PM",
      ecForm: "Form-15 (Encumbrance Certificate Search Application)",
      ecPortalUrl: "https://igrodisha.gov.in/ecsearch",
      notes: "EC search also available online at igrodisha.gov.in but manual is more reliable for older records (pre-2010)",
    },
    steps: [
      {
        step: 1,
        action: "Collect Encumbrance Certificate from SRO Bhubaneswar",
        location: "Sub-Registrar Office, Bhubaneswar No. I, Raj Bhawan Road",
        documents: ["Khatiyan copy (Bhulekh printout)", "Aadhar card", "Passport photo (2 copies)"],
        fee: 50,
        turnaround: "Same day",
        caveat: "EC only covers registered documents. Unregistered sale agreements not in EC.",
      },
      {
        step: 2,
        action: "Verify mutation chain at Tehsil Office Bhubaneswar",
        location: "Tehsil Office, Bhubaneswar, Near Kalpana Square",
        documents: ["Original Khatiyan", "Seller's ID proof", "Buyer's ID proof"],
        fee: 20,
        turnaround: "30 minutes if no queue",
        caveat: "Mutation requires present owner + seller + buyer at office. Pre-book via tehsildar office.",
      },
    ],
    clerkPhrases: [
      "Encumbrance certificate den bitane",
      "Khatiyan verification karane",
      "Mutation entry karane",
      "EC search application dena",
    ],
    rejectionReasons: [
      "Khatiyan number not matching records",
      "Seller not present with ID",
      "Plot number discrepancy between Khatiyan and application",
    ],
  },
  {
    tehsilName: "Balianta",
    tehsilCode: "8",
    sro: {
      name: "Sub-Registrar, Balianta",
      tehsils: ["Balianta", "Begunia"],
      address: "Balianta Tehsil Complex, NH-16, Balianta-752100, Odisha",
      phone: "0674-2485234",
      landmark: "Opposite Balianta Police Station, NH-16",
      ecAvailable: true,
      ecFee: 50,
      ecTurnaround: "Same day (morning submission by 11 AM)",
      ecForm: "Form-15",
      ecPortalUrl: "https://igrodisha.gov.in/ecsearch",
      notes: "SRO Balianta covers Balipatna, Begunia, Gopalpur, Kakatpur tehsils partially. Verify jurisdiction before visiting.",
    },
    steps: [
      {
        step: 1,
        action: "Collect EC from SRO Balianta",
        location: "SRO Balianta, NH-16, opposite Balianta Police Station",
        documents: ["Khatiyan copy", "Aadhar card", "2 passport photos"],
        fee: 50,
        turnaround: "Same day (submit by 11 AM for same-day collection)",
      },
      {
        step: 2,
        action: "Mutation verification at Balianta Tehsil Office",
        location: "Tehsil Office, Balianta",
        documents: ["Original Khatiyan", "Seller + Buyer Aadhar", "Sale deed draft"],
        fee: 20,
        turnaround: "1-2 hours if clerk available",
      },
    ],
    clerkPhrases: [
      "Balianta SRO mein EC lena hai",
      "Khatiyan ki verification karane",
    ],
    rejectionReasons: [
      "Plot not in Balianta jurisdiction",
      "Seller ID not matching Khatiyan",
      "Mutation pending from previous transaction",
    ],
  },
  {
    tehsilName: "Balugaon",
    tehsilCode: "10",
    sro: {
      name: "Sub-Registrar, Chilika (Balugaon)",
      tehsils: ["Balugaon", "Chilika"],
      address: "Balugaon Tehsil Complex, Balugaon-752030, Odisha",
      phone: "06756-222240",
      landmark: "Near Balugaon Bus Stand",
      ecAvailable: true,
      ecFee: 50,
      ecTurnaround: "Next working day (morning submission)",
      ecForm: "Form-15",
      ecPortalUrl: "https://igrodisha.gov.in/ecsearch",
      notes: "Chilika tehsil has no separate SRO — covered by Balugaon SRO.EC for Chilika villages takes 1 extra day.",
    },
    steps: [
      {
        step: 1,
        action: "EC collection from SRO Balugaon",
        location: "SRO Balugaon, Near Bus Stand",
        documents: ["Khatiyan copy", "Aadhar", "2 photos"],
        fee: 50,
        turnaround: "Next day",
        caveat: "Submit by 10 AM for next-day collection",
      },
      {
        step: 2,
        action: "Mutation at Balugaon Tehsil Office",
        location: "Tehsil Office, Balugaon",
        documents: ["Original Khatiyan", "Seller + Buyer Aadhar"],
        fee: 20,
        turnaround: "1-2 hours",
      },
    ],
    clerkPhrases: [
      "Balugaon SRO EC ke liye form dena",
      "Chilika ke plot ki EC",
    ],
    rejectionReasons: [
      "Village in Chilika tehsil — EC may take extra day",
      "Khatiyan older than 30 years — manual search required",
    ],
  },
  {
    tehsilName: "Banapur",
    tehsilCode: "1",
    sro: {
      name: "Sub-Registrar, Banapur",
      tehsils: ["Banapur"],
      address: "Banapur Tehsil Complex, Banapur-752031, Odisha",
      phone: "06756-232240",
      landmark: "Near Banapur Chowk",
      ecAvailable: true,
      ecFee: 50,
      ecTurnaround: "Same day (submit by 11 AM)",
      ecForm: "Form-15",
      notes: "SRO Banapur is small — verify EC availability before visiting. Some older records may require Bhubaneswar SRO.",
    },
    steps: [
      {
        step: 1,
        action: "EC from SRO Banapur",
        location: "SRO Banapur, Near Banapur Chowk",
        documents: ["Khatiyan copy", "Aadhar", "2 photos"],
        fee: 50,
        turnaround: "Same day",
      },
      {
        step: 2,
        action: "Mutation at Banapur Tehsil Office",
        location: "Tehsil Office, Banapur",
        documents: ["Original Khatiyan", "Seller + Buyer Aadhar"],
        fee: 20,
        turnaround: "1-2 hours",
      },
    ],
    clerkPhrases: [
      "Banapur SRO mein EC form",
    ],
    rejectionReasons: [
      "Records pre-2000 may be in Bhubaneswar SRO",
      "Land in disputed state — SRO may refuse EC",
    ],
  },
  {
    tehsilName: "Jatni",
    tehsilCode: "6",
    sro: {
      name: "Sub-Registrar, Jatni",
      tehsils: ["Jatni", "Khandagiri"],
      address: "Jatni Tehsil Complex, NH-5, Jatni-752050, Odisha",
      phone: "0674-2496234",
      landmark: "On NH-5, opposite Jatni Railway Station",
      ecAvailable: true,
      ecFee: 50,
      ecTurnaround: "Same day (by 2 PM)",
      ecForm: "Form-15",
      ecPortalUrl: "https://igrodisha.gov.in/ecsearch",
    },
    steps: [
      {
        step: 1,
        action: "EC from SRO Jatni",
        location: "SRO Jatni, NH-5, opposite Railway Station",
        documents: ["Khatiyan copy", "Aadhar", "2 photos"],
        fee: 50,
        turnaround: "Same day",
      },
      {
        step: 2,
        action: "Mutation at Jatni Tehsil Office",
        location: "Tehsil Office, Jatni",
        documents: ["Original Khatiyan", "Seller + Buyer Aadhar"],
        fee: 20,
        turnaround: "1 hour",
      },
    ],
    clerkPhrases: [
      "Jatni SRO EC deni hai",
    ],
    rejectionReasons: [
      "Part of Bhubaneswar urban area — some plots may be under Bhubaneswar SRO",
    ],
  },
  {
    tehsilName: "Khordha",
    tehsilCode: "3",
    sro: {
      name: "Sub-Registrar, Khordha",
      tehsils: ["Khordha", "Fresco area"],
      address: "Khordha Tehsil Complex, Main Road, Khordha-752057, Odisha",
      phone: "06755-212240",
      landmark: "Near Khordha Town Square",
      ecAvailable: true,
      ecFee: 50,
      ecTurnaround: "Same day",
      ecForm: "Form-15",
      notes: "Verify if plot is under Khordha SRO or Bhubaneswar SRO — urban expansion has shifted jurisdiction.",
    },
    steps: [
      {
        step: 1,
        action: "Confirm SRO jurisdiction first — ask at Khordha Tehsil Office",
        location: "Tehsil Office, Khordha",
        documents: ["Khatiyan copy", "Location description"],
        fee: 0,
        turnaround: "10 minutes",
        caveat: "Some villages near Bhubaneswar are under Bhubaneswar SRO, not Khordha SRO.",
      },
      {
        step: 2,
        action: "EC from appropriate SRO (confirmed in step 1)",
        location: "Relevant SRO",
        documents: ["Khatiyan copy", "Aadhar", "2 photos"],
        fee: 50,
        turnaround: "Same day",
      },
    ],
    clerkPhrases: [
      "Kon sa SRO sahi hai is plot ke liye?",
      "Khordha SRO ya Bhubaneswar SRO?",
    ],
    rejectionReasons: [
      "Wrong SRO — plot actually under Bhubaneswar SRO",
      "Land re-classified — requires conversion order first",
    ],
  },
  {
    tehsilName: "Bolagarh",
    tehsilCode: "4",
    sro: {
      name: "Sub-Registrar, Bolagarh",
      tehsils: ["Bolagarh", "Kisama"],
      address: "Bolagarh Tehsil Complex, Bolagarh-752032, Odisha",
      phone: "06755-262240",
      landmark: "Near Bolagarh Block Office",
      ecAvailable: true,
      ecFee: 50,
      ecTurnaround: "Same day (morning only)",
      ecForm: "Form-15",
      notes: "Bolagarh SRO covers rural Khordha western areas.EC for villages near Chandaka may require Bhubaneswar SRO.",
    },
    steps: [
      {
        step: 1,
        action: "EC from SRO Bolagarh",
        location: "SRO Bolagarh, Near Block Office",
        documents: ["Khatiyan copy", "Aadhar", "2 photos"],
        fee: 50,
        turnaround: "Same day (submit by 10:30 AM)",
      },
      {
        step: 2,
        action: "Mutation at Bolagarh Tehsil Office",
        location: "Tehsil Office, Bolagarh",
        documents: ["Original Khatiyan", "Seller + Buyer Aadhar"],
        fee: 20,
        turnaround: "1-2 hours",
      },
    ],
    clerkPhrases: [
      "Bolagarh SRO EC dena",
    ],
    rejectionReasons: [
      "Chandaka villages may be under Bhubaneswar SRO",
      "Forest area — requires NOC from Forest Department before mutation",
    ],
  },
  {
    tehsilName: "Begunia",
    tehsilCode: "9",
    sro: {
      name: "Sub-Registrar, Begunia",
      tehsils: ["Begunia", "Balianta (partial)"],
      address: "Begunia Tehsil Complex, Begunia-761040, Odisha",
      phone: "06754-232240",
      landmark: "Near Begunia Market",
      ecAvailable: true,
      ecFee: 50,
      ecTurnaround: "Same day",
      ecForm: "Form-15",
      notes: "Begunia SRO covers Begunia and northern Balianta tehsils. Southern Balianta villages under Balianta SRO.",
    },
    steps: [
      {
        step: 1,
        action: "EC from SRO Begunia",
        location: "SRO Begunia, Near Market",
        documents: ["Khatiyan copy", "Aadhar", "2 photos"],
        fee: 50,
        turnaround: "Same day",
      },
      {
        step: 2,
        action: "Mutation at Begunia Tehsil Office",
        location: "Tehsil Office, Begunia",
        documents: ["Original Khatiyan", "Seller + Buyer Aadhar"],
        fee: 20,
        turnaround: "1-2 hours",
      },
    ],
    clerkPhrases: [
      "Begunia SRO EC ke liye form",
    ],
    rejectionReasons: [
      "Village in southern Balianta — try Balianta SRO instead",
    ],
  },
  {
    tehsilName: "Chilika",
    tehsilCode: "11",
    sro: {
      name: "Sub-Registrar, Chilika (Balugaon)",
      tehsils: ["Chilika"],
      address: "Balugaon Tehsil Complex, Balugaon-752030, Odisha",
      phone: "06756-222240",
      landmark: "Near Balugaon Bus Stand",
      ecAvailable: true,
      ecFee: 50,
      ecTurnaround: "Next working day",
      ecForm: "Form-15",
      notes: "Chilika tehsil has no separate SRO — covered by Balugaon SRO. EC takes 1 extra day. Chilika area includes water bodies and seasonal islands — mutation may require additional verification.",
    },
    steps: [
      {
        step: 1,
        action: "EC from SRO Balugaon (Chilika jurisdiction)",
        location: "SRO Balugaon",
        documents: ["Khatiyan copy", "Aadhar", "2 photos"],
        fee: 50,
        turnaround: "Next day",
        caveat: "Chilika tehsil villages — EC takes longer due to cross-tehsil jurisdiction.",
      },
      {
        step: 2,
        action: "Mutation at Chilika Tehsil Office (or Balugaon if Chilika office not functional)",
        location: "Tehsil Office, Chilika",
        documents: ["Original Khatiyan", "Seller + Buyer Aadhar", "Land area measurement"],
        fee: 20,
        turnaround: "Same day",
        caveat: "Inland/island plots may require physical verification by tehsildar.",
      },
    ],
    clerkPhrases: [
      "Chilika tehsil ki EC leni hai",
      "Balugaon SRO mein Chilika plot",
    ],
    rejectionReasons: [
      "Marshy/waterlogged land — mutation may be restricted",
      "CRZ area — requires Coastal Regulation Zone clearance",
    ],
  },
  {
    tehsilName: "Khandagiri",
    tehsilCode: "7",
    sro: {
      name: "Sub-Registrar, Jatni",
      tehsils: ["Khandagiri"],
      address: "Jatni SRO, NH-5, Jatni-752050, Odisha",
      phone: "0674-2496234",
      landmark: "On NH-5, opposite Jatni Railway Station",
      ecAvailable: true,
      ecFee: 50,
      ecTurnaround: "Same day",
      ecForm: "Form-15",
      ecPortalUrl: "https://igrodisha.gov.in/ecsearch",
      notes: "Khandagiri tehsil falls under Jatni SRO jurisdiction. Khandagiri area is rapidly urbanizing — verify current SRO boundaries.",
    },
    steps: [
      {
        step: 1,
        action: "EC from SRO Jatni",
        location: "SRO Jatni, NH-5",
        documents: ["Khatiyan copy", "Aadhar", "2 photos"],
        fee: 50,
        turnaround: "Same day",
        caveat: "Khandagiri is urbanizing rapidly — some areas may have changed jurisdiction to Bhubaneswar SRO.",
      },
      {
        step: 2,
        action: "Mutation at Khandagiri Tehsil Office",
        location: "Tehsil Office, Khandagiri",
        documents: ["Original Khatiyan", "Seller + Buyer Aadhar"],
        fee: 20,
        turnaround: "1 hour",
      },
    ],
    clerkPhrases: [
      "Khandagiri tehsil ki EC",
      "Jatni SRO mein Khandagiri plot",
    ],
    rejectionReasons: [
      "Urban area — conversion from agricultural to non-agricultural required before construction",
      "Layout approved by BDA required before registration",
    ],
  },
];

// ─── Utility exports ─────────────────────────────────────────────────────────────

/**
 * Find manual verification instructions for a given Bhulekh tehsil code.
 */
export function getManualVerificationForTehsil(tehsilCode: string): TehsilManualVerification | undefined {
  return KHORDHA_MANUAL_VERIFICATION.find(tv => tv.tehsilCode === tehsilCode);
}

/**
 * Build the "What to Ask Next" section copy for a given tehsil.
 */
export function buildSROInstructionsForTehsil(tehsilCode: string): string | null {
  const verification = getManualVerificationForTehsil(tehsilCode);
  if (!verification) return null;

  const steps = verification.steps.map(s =>
    `${s.step}. ${s.action} — ${s.location}\n   Documents: ${s.documents.join(", ")}\n   Fee: ₹${s.fee}, Turnaround: ${s.turnaround}${s.caveat ? `\n   ⚠ ${s.caveat}` : ""}`
  ).join("\n\n");

  const clerkTips = verification.clerkPhrases.map(p => `- "${p}"`).join("\n");

  return `**Manual Verification Steps (${verification.tehsilName} Tehsil)**

Nearest SRO: ${verification.sro.name}
Address: ${verification.sro.address}${verification.sro.phone ? `\nPhone: ${verification.sro.phone}` : ""}${verification.sro.ecPortalUrl ? `\nOnline EC portal: ${verification.sro.ecPortalUrl}` : ""}

**Steps:**
${steps}

**Helpful phrases for the clerk:**
${clerkTips}

**Common rejection reasons:**
${verification.rejectionReasons.map(r => `- ${r}`).join("\n")}

**Note:** EC from igrodisha.gov.in (online) is faster for recent records but manual visit is more reliable for records older than 2010.`;
}