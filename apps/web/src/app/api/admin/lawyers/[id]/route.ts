import { NextResponse } from "next/server";
import { deleteLawyer, getLawyer, upsertLawyer } from "@/lib/db";
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

export async function PUT(
  request: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
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
  const existing = await getLawyer(params.id);
  if (!existing) return bad("Lawyer not found", 404);

  const merged = {
    id: params.id,
    name: typeof body.name === "string" ? body.name : existing.name,
    firm: typeof body.firm === "string" ? body.firm : existing.firm,
    email: typeof body.email === "string" ? body.email : existing.email,
    phone: typeof body.phone === "string" ? body.phone : existing.phone,
    license_number: typeof body.license_number === "string" ? body.license_number : existing.license_number,
    photo_url: typeof body.photo_url === "string" ? body.photo_url : existing.photo_url,
    is_panel: typeof body.is_panel === "boolean" ? body.is_panel : existing.is_panel,
  };

  const lawyer = await upsertLawyer(merged);
  return NextResponse.json({ lawyer });
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const providedToken = getProvidedToken(request);
  if (!isDashboardAuthorized(providedToken)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const existing = await getLawyer(params.id);
  if (!existing) return bad("Lawyer not found", 404);
  await deleteLawyer(params.id);
  return new NextResponse(null, { status: 204 });
}
