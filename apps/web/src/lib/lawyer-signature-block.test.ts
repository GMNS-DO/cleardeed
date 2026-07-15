/**
 * Tests for injectLawyerSignatureBlock — the Guaranteed-tier co-sign block.
 *
 * The function is pure: it takes HTML + advocate metadata and returns
 * (possibly mutated) HTML with the signature block appended before </body>.
 *
 * It must be a no-op when:
 *   - lawyerName is null (advocate not yet assigned)
 *   - signedAt is null (advocate has not signed yet)
 *   - signatureUrl is null (no PDF uploaded yet)
 *   - signedAt is not a parseable date
 */
import { describe, it, expect } from "vitest";
import { injectLawyerSignatureBlock } from "./report-access";

const SAMPLE_BODY = `<!doctype html><body>
<header>ClearDeed Property Due-Diligence Report</header>
<main>... rest of report ...</main>
</body>`;

describe("injectLawyerSignatureBlock", () => {
  it("renders the signature block before </body> when all fields are present", () => {
    const result = injectLawyerSignatureBlock(SAMPLE_BODY, {
      lawyerName: "Adv. Ramesh Patel",
      lawyerFirm: "Patel & Associates",
      lawyerLicense: "ORI/1234/2010",
      lawyerEmail: "ramesh@patel.in",
      lawyerPhotoUrl: null,
      signedAt: "2026-07-15T10:00:00.000Z",
      signatureUrl: "https://storage.example.com/sig.png",
    });
    expect(result).toContain("lawyer-co-sign");
    expect(result).toContain("Advocate Co-Signature");
    expect(result).toContain("Adv. Ramesh Patel");
    expect(result).toContain("Patel &amp; Associates"); // HTML-escaped
    expect(result).toContain("ORI/1234/2010");
    // Signature image URL embedded
    expect(result).toContain("sig.png");
    // Date rendered in en-IN format
    expect(result).toContain("15 Jul 2026");
    // Block appears BEFORE </body>
    const blockIdx = result.indexOf("lawyer-co-sign");
    const bodyEndIdx = result.lastIndexOf("</body>");
    expect(blockIdx).toBeGreaterThan(-1);
    expect(bodyEndIdx).toBeGreaterThan(blockIdx);
  });

  it("renders lawyer photo when photo_url is set", () => {
    const result = injectLawyerSignatureBlock(SAMPLE_BODY, {
      lawyerName: "Adv. Asha Mishra",
      lawyerFirm: null,
      lawyerLicense: null,
      lawyerEmail: "asha@mishra.in",
      lawyerPhotoUrl: "https://cdn.example.com/asha.jpg",
      signedAt: "2026-07-15T10:00:00.000Z",
      signatureUrl: "https://storage.example.com/asha-sig.png",
    });
    expect(result).toContain("asha.jpg");
    expect(result).toContain('class="lawyer-photo"');
  });

  it("omits firm and license rows when those fields are null", () => {
    const result = injectLawyerSignatureBlock(SAMPLE_BODY, {
      lawyerName: "Adv. Asha Mishra",
      lawyerFirm: null,
      lawyerLicense: null,
      lawyerEmail: "asha@mishra.in",
      lawyerPhotoUrl: null,
      signedAt: "2026-07-15T10:00:00.000Z",
      signatureUrl: "https://storage.example.com/asha-sig.png",
    });
    // Firm and license data rows are absent; CSS class definitions are fine.
    expect(result).not.toMatch(/<div class="lawyer-firm"/);
    expect(result).not.toMatch(/<div class="lawyer-license"/);
  });

  it("is a no-op when lawyerName is null", () => {
    const result = injectLawyerSignatureBlock(SAMPLE_BODY, {
      lawyerName: null,
      lawyerFirm: null,
      lawyerLicense: null,
      lawyerEmail: null,
      lawyerPhotoUrl: null,
      signedAt: "2026-07-15T10:00:00.000Z",
      signatureUrl: "https://storage.example.com/sig.png",
    });
    expect(result).toBe(SAMPLE_BODY);
  });

  it("is a no-op when signedAt is null", () => {
    const result = injectLawyerSignatureBlock(SAMPLE_BODY, {
      lawyerName: "Adv. Ramesh Patel",
      lawyerFirm: null,
      lawyerLicense: null,
      lawyerEmail: null,
      lawyerPhotoUrl: null,
      signedAt: null,
      signatureUrl: "https://storage.example.com/sig.png",
    });
    expect(result).toBe(SAMPLE_BODY);
  });

  it("is a no-op when signatureUrl is null", () => {
    const result = injectLawyerSignatureBlock(SAMPLE_BODY, {
      lawyerName: "Adv. Ramesh Patel",
      lawyerFirm: null,
      lawyerLicense: null,
      lawyerEmail: null,
      lawyerPhotoUrl: null,
      signedAt: "2026-07-15T10:00:00.000Z",
      signatureUrl: null,
    });
    expect(result).toBe(SAMPLE_BODY);
  });

  it("is a no-op when signedAt is not a parseable date", () => {
    const result = injectLawyerSignatureBlock(SAMPLE_BODY, {
      lawyerName: "Adv. Ramesh Patel",
      lawyerFirm: null,
      lawyerLicense: null,
      lawyerEmail: null,
      lawyerPhotoUrl: null,
      signedAt: "not-a-date",
      signatureUrl: "https://storage.example.com/sig.png",
    });
    expect(result).toBe(SAMPLE_BODY);
  });

  it("escapes HTML in the advocate's name", () => {
    const result = injectLawyerSignatureBlock(SAMPLE_BODY, {
      lawyerName: "<script>alert('xss')</script>",
      lawyerFirm: null,
      lawyerLicense: null,
      lawyerEmail: null,
      lawyerPhotoUrl: null,
      signedAt: "2026-07-15T10:00:00.000Z",
      signatureUrl: "https://storage.example.com/sig.png",
    });
    expect(result).not.toContain("<script>alert('xss')</script>");
    expect(result).toContain("&lt;script&gt;");
  });

  it("renders 18-Month Guarantee disclaimer language", () => {
    const result = injectLawyerSignatureBlock(SAMPLE_BODY, {
      lawyerName: "Adv. Ramesh Patel",
      lawyerFirm: "Patel & Associates",
      lawyerLicense: "ORI/1234/2010",
      lawyerEmail: "ramesh@patel.in",
      lawyerPhotoUrl: null,
      signedAt: "2026-07-15T10:00:00.000Z",
      signatureUrl: "https://storage.example.com/sig.png",
    });
    expect(result).toContain("18-Month Guarantee");
    expect(result).toMatch(/co-sign/i);
    expect(result).toMatch(/not a legal opinion/i);
  });
});
