import { NextResponse } from "next/server";
import { listLawyers, upsertLawyer } from "@/lib/db";
import { isDashboardAuthorized } from "@/lib/dashboard-auth";

export const dynamic = "force-dynamic";

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function getProvidedToken(request: Request): string | null {
  const auth = request.headers.get("authorization") ?? "";
  const bearer = auth.match(/^Bearer\s+(.+)$/i)?.[1];
  return request.headers.get("x-cleardeed-admin-token") ?? bearer ?? null;
}

export async function GET(request: Request): Promise<NextResponse> {
  const providedToken = getProvidedToken(request);
  if (!isDashboardAuthorized(providedToken)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const lawyers = await listLawyers();
  return NextResponse.json({ lawyers });
}

export async function POST(request: Request): Promise<NextResponse> {
  const providedToken = getProvidedToken(request);
  if (!isDashboardAuthorized(providedToken)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return bad("Invalid JSON body");
  }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (!name || !email) return bad("name and email are required");
  const lawyer = await upsertLawyer({
    name,
    firm: typeof body.firm === "string" ? body.firm : null,
    email,
    phone: typeof body.phone === "string" ? body.phone : null,
    license_number: typeof body.license_number === "string" ? body.license_number : null,
    photo_url: typeof body.photo_url === "string" ? body.photo_url : null,
    is_panel: body.is_panel !== false,
  });
  return NextResponse.json({ lawyer }, { status: 201 });
}
