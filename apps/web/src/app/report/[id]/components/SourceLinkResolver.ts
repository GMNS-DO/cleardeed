/**
 * SourceLinkResolver
 *
 * Pure-function utility that maps an orchestrator source key + its fetch
 * status to a human-readable provenance link (or a manual-verification
 * fallback when the source has no usable URL).
 *
 * Status semantics:
 *   - success / partial        → link is usable
 *   - manual_required          → link is usable (e.g. IGR has no automated
 *                                 fetch, but the portal is the ground truth)
 *   - failed / no_go / not_run → link may be unavailable
 */

export type SourceStatus = "success" | "partial" | "failed" | "not_run" | "manual_required" | "no_go";

export interface SourceLinkResult {
  url: string;
  label: string;
  /** Shown as the Action: text when the link cannot be rendered. */
  fallbackAction?: string;
}

const PORTAL_LINKS: Record<string, { url: string; label: string }> = {
  "bhulekh": {
    url: "https://bhulekh.ori.nic.in/",
    label: "Bhulekh RoR",
  },
  "bhunaksha": {
    url: "https://mapserver.odisha4kgeo.in/",
    label: "Bhunaksha plot map",
  },
  "nominatim": {
    url: "https://nominatim.openstreetmap.org/",
    label: "OpenStreetMap",
  },
  "ecourts": {
    url: "https://services.ecourts.gov.in/",
    label: "eCourts case search",
  },
  "high-court": {
    url: "https://hcservices.ecourts.gov.in/",
    label: "Odisha High Court",
  },
  "drt": {
    url: "https://cis.drt.gov.in/drtlive/",
    label: "DRT case search",
  },
  "igr-ec": {
    url: "https://igrodisha.gov.in/",
    label: "IGR EC portal",
  },
  "igr-bmv": {
    url: "https://regis.odisha.gov.in/Benchmark/BMV_Search.aspx",
    label: "IGR benchmark valuation",
  },
  "circle-rate": {
    url: "https://regis.odisha.gov.in/Benchmark/BMV_Search.aspx",
    label: "IGR circle rate",
  },
  "bda-zoning": {
    url: "https://bda.gov.in/",
    label: "BDA Master Plan",
  },
  "bhuvan-flood": {
    url: "https://bhuvan-ras2.nrsc.gov.in/",
    label: "Bhuvan flood frequency",
  },
};

const RCCMS_FALLBACK_ACTION = "Manually query ccms.nic.in with Hal Khata No. at the local revenue office";

/**
 * Per-source manual-verification copy. Used as the `Action:` text when a
 * source has no usable URL or when the caller wants a fallback string
 * independent of source status.
 */
const MANUAL_VERIFICATION_COPY: Record<string, string> = {
  rccms: RCCMS_FALLBACK_ACTION,
  ecourts:
    "Search the case portal directly with the party name. Captcha accuracy is below 100%; manual verification is the safe path.",
  "high-court":
    "Search hcservices.ecourts.gov.in directly. Captcha is required; manual verification is the safe path.",
  drt: "Search cis.drt.gov.in directly with the party name.",
  bhulekh:
    "Visit bhulekh.ori.nic.in and search by Plot + Tahasil + Village. The portal is the source of truth.",
  bhunaksha:
    "Visit the Bhunaksha WFS endpoint or Bhubaneswar Bhulekh office for the official plot boundary.",
};

/**
 * Returns the manual-verification copy for a given source key. Falls
 * back to a generic lawyer-verification prompt when the source is unknown.
 */
export function resolveSourceAction(sourceKey: string): string {
  return (
    MANUAL_VERIFICATION_COPY[sourceKey] ??
    "Ask your lawyer to verify manually"
  );
}

export function SourceLinkResolver(
  sourceKey: string,
  sourceStatus: SourceStatus,
): SourceLinkResult | null {
  // RCCMS special handling: no_go / not_run / failed → null + manual fallback
  // (callers should use resolveSourceAction() to get the manual copy).
  if (sourceKey === "rccms") {
    if (sourceStatus === "no_go" || sourceStatus === "not_run" || sourceStatus === "failed") {
      return null;
    }
    // For success / partial / manual_required, still return the URL with the
    // manual-verification label (the portal has no reverse-lookup capability).
    return {
      url: "https://ccms.nic.in/",
      label: "RCCMS (manual — ask your lawyer)",
    };
  }

  const portal = PORTAL_LINKS[sourceKey];
  if (!portal) {
    return {
      url: "",
      label: "Unknown source",
      fallbackAction: "Ask your lawyer to verify manually",
    };
  }

  return {
    url: portal.url,
    label: portal.label,
  };
}
