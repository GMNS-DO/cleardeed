import { NextResponse } from "next/server";
import { renderPdf } from "@cleardeed/pdf-renderer";

// This is a placeholder. A real implementation would:
// 1. Get the report ID from the URL.
// 2. Use Supabase to fetch the stored HTML for that report.
// 3. Check user permissions (auth).
// 4. Render the PDF from the stored HTML.
// 5. Return the PDF.

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const reportId = params.id;

  // For now, just render a dummy PDF to prove the concept.
  const dummyHtml = `<html><body><h1>PDF for Report ${reportId}</h1><p>This is a placeholder. A full implementation will render the report's actual HTML content.</p></body></html>`;

  try {
    const pdfBuffer = await renderPdf({ html: dummyHtml });

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="ClearDeed-Report-${reportId}.pdf"`,
      },
    });
  } catch (error) {
    console.error(`[pdf-renderer] Failed to generate PDF for report ${reportId}:`, error);
    return new NextResponse("Failed to generate PDF.", { status: 500 });
  }
}