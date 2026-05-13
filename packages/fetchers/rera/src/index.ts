// Odisha RERA project/promoter search fetcher
// Portal: rera.odisha.gov.in (ORERA - Odisha Real Estate Regulatory Authority)
// URL: https://rera.odisha.gov.in/
//
// T-035: Build RERA project search fetcher
//
// Trigger conditions (from source-roadmap.md):
// - Plot is marketed as part of a layout/project
// - Seller is a promoter/builder
// - Buyer provides a project/layout name
//
// Search modes:
// 1. Project search by name
// 2. Project search by registration number
// 3. Promoter search by name
//
// This is a placeholder fetcher returning manual_required status.
// Live implementation requires:
// 1. Probe rera.odisha.gov.in for search form structure
// 2. Confirm captcha requirements (likely)
// 3. Document API endpoints and response schema
// 4. Build Playwright flow for search + result extraction

import { createHash } from "node:crypto";
import { SourceResultBase } from "@cleardeed/schema";

const PARSER_VERSION = "rera-project-parser-v1";
const USER_AGENT = "ClearDeed/1.0 (property due-diligence; contact@cleardeed.in)";

export interface RERAInput {
  /** Project name to search (partial match supported) */
  projectName?: string;
  /** RERA registration number (e.g., ORERA/XXXX/XXXX/XXXXX) */
  registrationNumber?: string;
  /** Promoter/developer name to search */
  promoterName?: string;
  /** District filter (optional) */
  district?: string;
}

type RERAOutcome = "no_project_found" | "project_found" | "promoter_found" | "portal_error" | "unknown";

interface RERAAttemptMetadata {
  searchType: "project_name" | "registration_number" | "promoter_name";
  query: string;
  outcome: RERAOutcome;
  statusReason?: string;
}

interface RERAProject {
  registrationNumber: string;
  projectName: string;
  promoterName: string;
  district: string;
  address: string;
  status: "Active" | "Expired" | "Cancelled" | "Completed" | "Pending";
  registrationDate: string;
  completionDate: string | null;
  approvedCarpetArea: string | null;
  totalUnits: number | null;
  complaintsCount: number;
  ordersCount: number;
}

interface RERAPromoter {
  promoterName: string;
  registrationNumber: string;
  address: string;
  state: string;
  district: string;
  ongoingProjects: number;
  completedProjects: number;
}

export interface RERAProjectSearchResult {
  source: "rera";
  status: "success" | "partial" | "failed";
  verification: "verified" | "unverified" | "manual_required" | "error";
  fetchedAt: string;
  data?: {
    projects: RERAProject[];
    promoters: RERAPromoter[];
    totalProjects: number;
    searchMetadata: {
      searchType: RERAAttemptMetadata["searchType"];
      query: string;
      outcomes: RERAAttemptMetadata[];
    };
  };
  statusReason?: string;
  attempts: RERAAttemptMetadata[];
  rawArtifactRef?: string;
  parserVersion: string;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export async function fetch(input: RERAInput): Promise<RERAProjectSearchResult> {
  const fetchedAt = new Date().toISOString();
  const attempts: RERAAttemptMetadata[] = [];

  if (!input.projectName && !input.registrationNumber && !input.promoterName) {
    return {
      source: "rera",
      status: "failed",
      verification: "error",
      fetchedAt,
      statusReason: "No search input provided — projectName, registrationNumber, or promoterName required.",
      attempts: [],
      parserVersion: PARSER_VERSION,
    };
  }

  // Determine primary search type
  let searchType: RERAAttemptMetadata["searchType"];
  let query: string;

  if (input.registrationNumber) {
    searchType = "registration_number";
    query = input.registrationNumber;
  } else if (input.projectName) {
    searchType = "project_name";
    query = input.projectName;
  } else {
    searchType = "promoter_name";
    query = input.promoterName!;
  }

  attempts.push({
    searchType,
    query,
    outcome: "unknown",
    statusReason: "RERA fetcher is not yet live-implemented — requires probe of rera.odisha.gov.in",
  });

  // Return manual_required status until live probe is completed
  return {
    source: "rera",
    status: "partial",
    verification: "manual_required",
    fetchedAt,
    data: {
      projects: [],
      promoters: [],
      totalProjects: 0,
      searchMetadata: {
        searchType,
        query,
        outcomes: attempts,
      },
    },
    statusReason: `RERA automated search not yet implemented. To verify project/promoter registration, visit https://rera.odisha.gov.in and search by ${searchType === "registration_number" ? "registration number" : searchType === "project_name" ? "project name" : "promoter name"}: "${query}".`,
    attempts,
    rawArtifactRef: `rera-manual-required-${sha256(fetchedAt)}`,
    parserVersion: PARSER_VERSION,
  };
}

export async function healthCheck(): Promise<{ ok: boolean; reason?: string }> {
  return {
    ok: false,
    reason: "RERA fetcher is not live-implemented. Requires portal probe before health check is meaningful.",
  };
}