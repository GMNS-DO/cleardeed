/**
 * GET /api/report/[id]/whatsapp
 *
 * Returns the shareable WhatsApp Forward text for a stored report.
 * Regenerated from the report's source_summary (no extra DB columns needed).
 * The text is the "Layer 1" shareable summary — one screen, spouse-readable.
 */
import { NextRequest, NextResponse } from "next/server";
import { getReport } from "@/lib/db";
import { generateWhatsAppForward } from "@cleardeed/consumer-report-writer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface SourceSummary {
  village?: string;
  tahasil?: string;
  district?: string;
  plotNo?: string;
  plotArea?: string;
  plotAreaAcres?: number;
  bhulekh?: {
    primaryOwner?: string;
    landClass?: string;
    ownerStatus?: string;
    conversionRequired?: boolean;
    revenueDemand?: number;
    totalEncumbrance?: number;
    courtCaseCount?: number;
    redFlags?: string[];
  };
  court?: {
    totalCases?: number;
    ecourtsStatus?: string;
    rccmsStatus?: string;
  };
  financial?: {
    totalAtRisk?: number;
    exposureItems?: Array<{ label: string; amount: number; severity: string }>;
  };
}

function buildRiskInsightsFromSummary(summary: SourceSummary) {
  return {
    transferability: [
      summary.bhulekh?.conversionRequired
        ? { label: "Agricultural land — CLU required for non-farm use", severity: "watchout", priority: 2 }
        : null,
      summary.bhulekh?.landClass
        ? { label: `Land class: ${summary.bhulekh.landClass}`, severity: "positive", priority: 5 }
        : null,
    ].filter(Boolean) as Array<{ label: string; severity: string; priority: number }>,
    title: [
      summary.bhulekh?.ownerStatus === "verified"
        ? { label: "Owner verified in Bhulekh RoR", severity: "positive", priority: 3 }
        : summary.bhulekh?.ownerStatus === "manual_required"
          ? { label: "RoR owner not confirmed — verify with Tehsil", severity: "watchout", priority: 2 }
          : null,
      summary.bhulekh?.redFlags && summary.bhulekh.redFlags.length > 0
        ? { label: summary.bhulekh.redFlags[0], severity: "redFlag", priority: 1 }
        : null,
    ].filter(Boolean) as Array<{ label: string; severity: string; priority: number }>,
    financial: [
      summary.bhulekh?.revenueDemand && summary.bhulekh.revenueDemand > 0
        ? { label: `₹${summary.bhulekh.revenueDemand.toLocaleString("en-IN")} revenue demand in Bhulekh`, severity: "watchout", priority: 2 }
        : null,
      summary.bhulekh?.totalEncumbrance && summary.bhulekh.totalEncumbrance > 0
        ? { label: `₹${summary.bhulekh.totalEncumbrance.toLocaleString("en-IN")} registered charge on land`, severity: "redFlag", priority: 1 }
        : null,
    ].filter(Boolean) as Array<{ label: string; severity: string; priority: number }>,
    positive: [] as Array<{ label: string; severity: string; priority: number }>,
    redFlag: [
      summary.bhulekh?.courtCaseCount && summary.bhulekh.courtCaseCount > 0
        ? { label: `${summary.bhulekh.courtCaseCount} court case(s) found in land records`, severity: "redFlag", priority: 1 }
        : null,
    ].filter(Boolean) as Array<{ label: string; severity: string; priority: number }>,
  };
}

function computeAtRiskAmount(summary: SourceSummary): string | undefined {
  if (!summary.bhulekh) return undefined;
  const { revenueDemand = 0, totalEncumbrance = 0, courtCaseCount = 0 } = summary.bhulekh;
  const courtExposure = courtCaseCount > 0 ? 50000 : 0;
  const total = revenueDemand + totalEncumbrance + courtExposure;
  if (total <= 0) return undefined;
  return `₹${total.toLocaleString("en-IN")}`;
}

function computeAreaSummary(summary: SourceSummary): string {
  if (summary.plotAreaAcres) return `${summary.plotAreaAcres.toFixed(3)} acres`;
  if (summary.plotArea) return summary.plotArea;
  return "verify from Bhulekh";
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  try {
    const { report } = await getReport(id) as {
      report?: {
        id?: string;
        report_title?: string | null;
        source_summary?: SourceSummary | null;
        created_at?: string;
      } | null;
    };

    if (!report) {
      return NextResponse.json({ error: "Report not found." }, { status: 404 });
    }

    const summary = (report.source_summary ?? {}) as SourceSummary;
    const riskInsights = buildRiskInsightsFromSummary(summary);

    const forward = generateWhatsAppForward({
      plotVillage: summary.village ?? "—",
      plotTahasil: summary.tahasil ?? "—",
      plotNo: summary.plotNo ?? "—",
      ownerName: summary.bhulekh?.primaryOwner ?? "—",
      plotAreaSummary: computeAreaSummary(summary),
      bhulekhUsable: summary.bhulekh != null,
      riskInsights,
      reportId: id,
      generatedAt: report.created_at ?? new Date().toISOString(),
      atRiskAmount: computeAtRiskAmount(summary),
      reportUrl: `${process.env.NEXT_PUBLIC_BASE_URL ?? "https://cleardeed.app"}/report/${id}`,
    });

    return new NextResponse(forward, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "private, no-store",
        "Content-Disposition": `attachment; filename="ClearDeed-${id}.txt"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate WhatsApp forward.";
    console.error(`[/api/report/${id}/whatsapp]`, message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}