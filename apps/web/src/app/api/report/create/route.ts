import { NextRequest, NextResponse } from "next/server";
import { fetch as nominatimFetch } from "@cleardeed/fetcher-nominatim";
import { CreateReportRequest } from "@cleardeed/schema";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = CreateReportRequest.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { lat, lon, claimedOwnerName, fatherHusbandName, claimedPlotNo } = parsed.data;

    // Step 1: Geocode
    const geoResult = await nominatimFetch({ gps: { lat, lon } });

    // Step 2: Bhulekh RoR (if village resolved)
    // TODO: wire up bhulekh fetcher when village is known

    return NextResponse.json({
      success: true,
      request: {
        lat,
        lon,
        claimedOwnerName,
        fatherHusbandName,
        claimedPlotNo,
      },
      geocode: geoResult,
      message: "Report pipeline started. Geocode complete. Additional sources pending.",
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}