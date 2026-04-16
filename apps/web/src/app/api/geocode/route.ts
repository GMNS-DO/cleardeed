import { NextRequest, NextResponse } from "next/server";
import { nominatimFetch } from "@cleardeed/fetcher-nominatim";
import { CreateReportRequest } from "@cleardeed/schema";

export async function GET(req: NextRequest) {
  const lat = parseFloat(req.nextUrl.searchParams.get("lat") ?? "");
  const lon = parseFloat(req.nextUrl.searchParams.get("lon") ?? "");

  if (isNaN(lat) || isNaN(lon)) {
    return NextResponse.json(
      { error: "lat and lon are required query params" },
      { status: 400 }
    );
  }
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return NextResponse.json(
      { error: "Coordinates out of range" },
      { status: 400 }
    );
  }

  try {
    const gps = { lat, lon };
    const result = await nominatimFetch({ gps });
    return NextResponse.json(result);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    return NextResponse.json({ error: errorMessage, stack }, { status: 500 });
  }
}

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

    const gps = { lat: parsed.data.lat, lon: parsed.data.lon };
    const result = await nominatimFetch({ gps });
    return NextResponse.json(result);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    return NextResponse.json({ error: errorMessage, stack }, { status: 500 });
  }
}