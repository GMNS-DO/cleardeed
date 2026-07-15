import { NextResponse } from "next/server";
import { listLawyers } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  try {
    const lawyers = await listLawyers({ panelOnly: true });
    return NextResponse.json(lawyers);
  } catch (error) {
    console.error("[GET /api/lawyers]", error);
    return NextResponse.json({ error: "Failed to list lawyers" }, { status: 500 });
  }
}
