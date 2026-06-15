/**
 * POST /api/preview
 *
 * Legacy/internal preview endpoint — fast Bhulekh lookup without creating a full report.
 * Returns: plot found confirmation, masked owner name, Kisam, map pin.
 * No payment required. No full report generated.
 *
 * Input: { tehsil, tehsilValue, village, villageCode, searchMode, identifier }
 * Output: { plotFound, ownerMasked, kisam, kisamEnglish, landClass, mapPin, source, fetchedAt }
 */
import { NextRequest, NextResponse } from "next/server";
import { fetch as bhulekhFetch } from "@cleardeed/fetcher-bhulekh";
import { trackEvent, trackError } from "@/lib/track";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

interface PreviewInput {
  tehsil: string;
  tehsilValue: string;
  village: string;
  villageCode: string;
  searchMode: "Plot" | "Khatiyan" | "Tenant";
  identifier: string;
}

function maskOwnerName(fullName: string): string {
  if (!fullName || fullName.trim().length === 0) return "—";
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0][0] + ".";
  }
  const first = parts[0];
  const last = parts[parts.length - 1];
  // Show first name + last initial (e.g. "Laxmikanta D.")
  const lastInitial = last[0] ? last[0] + "." : "";
  return `${first} ${lastInitial}`.trim();
}

export async function POST(req: NextRequest) {
  // Rate limit: 10 requests per IP per 60 seconds (A.4.2)
  const rl = checkRateLimit({
    ip: getClientIp(req.headers),
    route: "preview",
    capacity: 10,
    refillPerSec: 10 / 60, // 1 token per 6s
  });
  if (rl.limited) {
    return NextResponse.json(
      { error: "Too many requests. Please wait before trying again.", retryAfter: rl.retryAfter },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

  try {
    const body = await req.json() as PreviewInput;

    if (!body.tehsil || !body.village || !body.villageCode || !body.searchMode || !body.identifier) {
      return NextResponse.json(
        { error: "Missing required fields: tehsil, village, villageCode, searchMode, identifier" },
        { status: 400 }
      );
    }

    // Run Bhulekh fetch with short timeout for preview
    let bhulekhResult;
    try {
      const fetchOptions = {
        tehsil: body.tehsil,
        tehsilCode: body.tehsilValue,
        village: body.village,
        villageCode: body.villageCode,
        searchMode: body.searchMode,
        identifierValue: body.identifier,
        identifierLabel: body.identifier,
        claimedOwnerName: undefined,
      };
      console.log("[/api/preview] fetchOptions:", JSON.stringify(fetchOptions));
      bhulekhResult = await withTimeout(
        bhulekhFetch({ ...fetchOptions, previewOnly: true }),
        90_000,
        "Bhulekh preview timed out before Vercel's function limit"
      );
      console.log("[/api/preview] bhulekhFetch status:", bhulekhResult.status, "reason:", bhulekhResult.statusReason);
    } catch (fetchErr) {
      const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
      console.warn("[/api/preview] Bhulekh fetch threw:", msg, fetchErr);
      return NextResponse.json({
        plotFound: false,
        source: "bhulekh",
        sourceStatus: "failed",
        fetchedAt: new Date().toISOString(),
        error: "Could not reach Bhulekh records. The site may be slow — try again or request a full report.",
      });
    }

    if (bhulekhResult.status !== "success" || !bhulekhResult.data) {
      const sourceFailed = bhulekhResult.status === "failed";
      // Include diagnostic info in the response so we can see it from the client
      return NextResponse.json({
        plotFound: false,
        source: "bhulekh",
        sourceStatus: bhulekhResult.status,
        statusReason: bhulekhResult.statusReason ?? bhulekhResult.error,
        fetchedAt: bhulekhResult.fetchedAt,
        // Diagnostic: include Bhulekh's own status reason
        bhulekhError: bhulekhResult.statusReason,
        bhulekhAttempts: bhulekhResult.attempts,
        error: sourceFailed
          ? "Could not check Bhulekh records right now. The portal or browser session failed before verification completed."
          : "Plot not found in Bhulekh records for the given tehsil/village/identifier. Verify the plot or khatiyan number.",
      });
    }

    // Extract preview fields from Bhulekh result
    const data = bhulekhResult.data as {
      ownerBlocks?: Array<{ ownerName?: string; guardianName?: string }>;
      tenants?: Array<{
        tenantName?: string;
        landClass?: string;
        landClassOdia?: string;
        landClassEnglish?: string;
      }>;
    };

    // Get primary owner (first owner block)
    const primaryOwner = data?.ownerBlocks?.[0]?.ownerName ?? data?.tenants?.[0]?.tenantName ?? "";
    const ownerMasked = maskOwnerName(primaryOwner);

    // Get primary kisam (first tenant's land class)
    const primaryTenant = data?.tenants?.[0];
    const kisamOdia = primaryTenant?.landClassOdia ?? "";
    const kisamStandardized = primaryTenant?.landClass ?? "";
    const kisamEnglish = primaryTenant?.landClassEnglish ?? getKisamDisplay(kisamStandardized);

    // Estimate GPS pin from tehsil center (placeholder — Bhunaksha WFS resolution is S2)
    const mapPin = `${body.tehsil}, ${body.village}`;

    // Track successful preview view
    await trackEvent({
      eventName: "preview_view",
      reportId: null,
      metadata: {
        village: body.village,
        tehsil: body.tehsil,
        kisamStandardized,
        plotFound: true,
      },
    });

    return NextResponse.json({
      plotFound: true,
      ownerMasked,
      kisam: kisamOdia || "—",
      kisamEnglish: kisamEnglish || kisamStandardized || "—",
      landClass: getLandClassSignal(kisamStandardized),
      mapPin,
      village: body.village,
      tehsil: body.tehsil,
      source: "bhulekh",
      sourceStatus: bhulekhResult.status,
      fetchedAt: bhulekhResult.fetchedAt,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[/api/preview]", message);
    await trackError(err, { route: "/api/preview" });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
    promise
      .then(resolve, reject)
      .finally(() => clearTimeout(timeout));
  });
}

function getLandClassSignal(kisam: string): string {
  if (!kisam) return "unknown";
  if (["buildable", "agricultural", "prohibited"].includes(kisam)) return kisam;
  const buildable = ["nagariya_jogya", "gharabari", "byabasaika", "unnayana_jogya", "abaddh"];
  const agricultural = ["anajalasechita", "bagayat", "patita", "jalasechita_single", "jalasechita_double", "sarad"];
  const prohibited = ["neya_niyogita", "jalasaya", "nadi", "jungle", "gochar", "smasana", "rashtriya_khet"];

  if (buildable.includes(kisam)) return "buildable";
  if (agricultural.includes(kisam)) return "agricultural";
  if (prohibited.includes(kisam)) return "prohibited";
  return "unknown";
}

function getKisamDisplay(kisam: string): string {
  if (kisam === "agricultural") return "Agricultural";
  if (kisam === "buildable") return "Buildable";
  if (kisam === "prohibited") return "Restricted";
  return kisam;
}
