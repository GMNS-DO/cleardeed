import { NextResponse } from "next/server";
import { setLawyerSignature } from "@/lib/db";
import { isDashboardAuthorized } from "@/lib/dashboard-auth";

export const dynamic = "force-dynamic";

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  if (!isDashboardAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return bad("Invalid JSON body");
  }
  const lawyerId = typeof body.lawyerId === "string" ? body.lawyerId.trim() : "";
  const lawyerSignatureUrl = typeof body.lawyerSignatureUrl === "string" ? body.lawyerSignatureUrl.trim() : "";
  const signedAt = typeof body.signedAt === "string" ? body.signedAt : new Date().toISOString();
  if (!lawyerId || !lawyerSignatureUrl) return bad("lawyerId and lawyerSignatureUrl are required");

  await setLawyerSignature({
    reportId: params.id,
    lawyerId,
    lawyerSignatureUrl,
    signedAt,
  });
  return NextResponse.json({ ok: true });
}
