export interface CivicDuesInput {
  sellerName: string;
  consumerNumber?: string;
  isCompany?: boolean;
}

export interface CivicDuesResult {
  source: "civic_dues";
  status: "partial" | "manual_required" | "failed";
  verification: "manual_required";
  fetchedAt: string;
  data: {
    bmcInstructions: string;
    phedInstructions: string;
    mcaInstructions?: string;
  };
}

export async function fetchCivicDues(input: CivicDuesInput): Promise<CivicDuesResult> {
  const fetchedAt = new Date().toISOString();

  let bmcInstructions = "No BMC consumer number provided. Manual verification required at Bhubaneswar Municipal Corporation office or via bmc.gov.in using property index number.";
  if (input.consumerNumber) {
    bmcInstructions = `Check BMC property tax dues online at bmc.gov.in using consumer number: ${input.consumerNumber}.`;
  }

  const phedInstructions = "Check PHED (Public Health Engineering Department) water dues. Require the seller to provide the latest paid water bill and check for any arrears.";

  let mcaInstructions;
  if (input.isCompany) {
    mcaInstructions = `Seller appears to be a company/LLP. Check MCA portal (mca.gov.in) for Company Master Data, list of directors, and any registered charges (Form CHG-1) against the property. Require board resolution authorizing the sale.`;
  }

  return {
    source: "civic_dues",
    status: "partial",
    verification: "manual_required",
    fetchedAt,
    data: {
      bmcInstructions,
      phedInstructions,
      mcaInstructions,
    },
  };
}