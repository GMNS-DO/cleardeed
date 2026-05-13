import { NextRequest, NextResponse } from "next/server";
import { createLeadRequest } from "@/lib/db";

export const runtime = "nodejs";

function cleanText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return undefined;
  return normalized.slice(0, maxLength);
}

function parseCoordinate(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string" || !value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const buyerName = cleanText(body.buyerName, 120);
    const phone = cleanText(body.phone, 40);

    if (!buyerName || !phone) {
      return NextResponse.json(
        { error: "Name and WhatsApp number are required." },
        { status: 400 }
      );
    }

    const lead = await createLeadRequest({
      buyerName,
      phone,
      userType: cleanText(body.userType, 40) ?? "buyer",
      locationText: cleanText(body.locationText, 240),
      gpsLat: parseCoordinate(body.gpsLat),
      gpsLon: parseCoordinate(body.gpsLon),
      claimedOwnerName: cleanText(body.claimedOwnerName, 160),
      plotDescription: cleanText(body.plotDescription, 500),
      notes: cleanText(body.notes, 1000),
      source: "website",
      utm: {
        referrer: req.headers.get("referer"),
      },
    });

    return NextResponse.json({ ok: true, leadId: lead.id }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[/api/leads]", message);
    return NextResponse.json(
      { error: "We could not save your request. Please try again." },
      { status: 500 }
    );
  }
}
