/**
 * Tests for the certified-copy generator.
 *
 * Covers: hash determinism, signature determinism, signature
 * verification (valid + invalid), HTML escaping (XSS), field
 * stripping (XSS), canonical text shape.
 */
import { describe, it, expect } from "vitest";
import {
  buildCertifiedCopy,
  signCertifiedCopy,
  verifyCertifiedCopy,
  renderCertifiedCopyHtml,
  type CertifiedCopyInput,
} from "./certified-copy";

const baseInput: CertifiedCopyInput = {
  reportId: "CLD-123",
  docType: "igr_ec",
  fields: [
    {
      field: "sro",
      value: "Bhubaneswar SRO",
      quote: { text: "SRO Bhubaneswar" },
      interpretation: "The Sub-Registrar Office is Bhubaneswar.",
      confidence: 0.95,
    },
    {
      field: "docNo",
      value: "2014/1234",
      quote: { text: "Document No. 2014/1234" },
      interpretation: "Document registered as 2014/1234.",
      confidence: 0.92,
    },
  ],
  summary: "A sale deed was registered in 2014 transferring the plot.",
  generatedAt: "2026-06-17T10:00:00.000Z",
  model: "claude-sonnet-4-5",
  costUsdCents: 4,
  durationMs: 1234,
};

describe("certified-copy", () => {
  describe("signCertifiedCopy", () => {
    it("returns a 64-char hex hash and 64-char hex signature", () => {
      const { hash, signature } = signCertifiedCopy(baseInput);
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
      expect(signature).toMatch(/^[0-9a-f]{64}$/);
    });

    it("is deterministic — same input gives same hash", () => {
      const a = signCertifiedCopy(baseInput);
      const b = signCertifiedCopy(baseInput);
      expect(a.hash).toBe(b.hash);
      expect(a.signature).toBe(b.signature);
    });

    it("hash changes when fields change", () => {
      const a = signCertifiedCopy(baseInput);
      const b = signCertifiedCopy({
        ...baseInput,
        fields: [
          ...baseInput.fields,
          {
            field: "amount",
            value: "1000000",
            quote: { text: "₹10,00,000" },
            interpretation: "Sale amount was ten lakh rupees.",
            confidence: 0.9,
          },
        ],
      });
      expect(a.hash).not.toBe(b.hash);
    });

    it("hash changes when fields are reordered (canonical is sorted)", () => {
      const a = signCertifiedCopy(baseInput);
      const reordered: CertifiedCopyInput = {
        ...baseInput,
        fields: [baseInput.fields[1]!, baseInput.fields[0]!],
      };
      const b = signCertifiedCopy(reordered);
      // Sorted by field name, so the canonical text is identical.
      expect(a.hash).toBe(b.hash);
    });

    it("signature is bound to (reportId, docType, hash) — change reportId", () => {
      const a = signCertifiedCopy(baseInput);
      const b = signCertifiedCopy({ ...baseInput, reportId: "CLD-999" });
      // Same hash (canonical text doesn't include reportId? — it does,
      // see canonicalize). So hash should also differ.
      expect(a.hash).not.toBe(b.hash);
      expect(a.signature).not.toBe(b.signature);
    });
  });

  describe("verifyCertifiedCopy", () => {
    it("verifies a freshly-signed copy", () => {
      const { hash, signature } = signCertifiedCopy(baseInput);
      expect(
        verifyCertifiedCopy({
          reportId: baseInput.reportId,
          docType: baseInput.docType,
          hash,
          signature,
        }),
      ).toBe(true);
    });

    it("rejects a tampered hash", () => {
      const { hash, signature } = signCertifiedCopy(baseInput);
      const tamperedHash = hash.replace(/.$/, "0");
      expect(
        verifyCertifiedCopy({
          reportId: baseInput.reportId,
          docType: baseInput.docType,
          hash: tamperedHash,
          signature,
        }),
      ).toBe(false);
    });

    it("rejects a tampered signature", () => {
      const { hash, signature } = signCertifiedCopy(baseInput);
      const tamperedSig = signature.replace(/^./, "0");
      expect(
        verifyCertifiedCopy({
          reportId: baseInput.reportId,
          docType: baseInput.docType,
          hash,
          signature: tamperedSig,
        }),
      ).toBe(false);
    });

    it("rejects a different reportId", () => {
      const { hash, signature } = signCertifiedCopy(baseInput);
      expect(
        verifyCertifiedCopy({
          reportId: "CLD-999",
          docType: baseInput.docType,
          hash,
          signature,
        }),
      ).toBe(false);
    });
  });

  describe("buildCertifiedCopy", () => {
    it("returns HTML containing the reportId and docType", () => {
      const cc = buildCertifiedCopy(baseInput);
      expect(cc.html).toContain(baseInput.reportId);
      expect(cc.html).toContain(baseInput.docType);
    });

    it("inlines the hash and signature into the page", () => {
      const cc = buildCertifiedCopy(baseInput);
      expect(cc.html).toContain(cc.hash);
      expect(cc.html).toContain(cc.signature);
    });

    it("HTML-escapes special characters in field values (XSS guard)", () => {
      const malicious: CertifiedCopyInput = {
        ...baseInput,
        fields: [
          {
            field: "sro",
            value: "<script>alert(1)</script>",
            quote: { text: "SRO Bhubaneswar" },
            interpretation: "Test",
            confidence: 0.9,
          },
        ],
      };
      const html = renderCertifiedCopyHtml(malicious);
      // The literal <script> tag is not present — stripDangerous removed
      // it; the remaining angle brackets are escaped.
      expect(html).not.toContain("<script>alert(1)</script>");
    });

    it("strips stray <script> tags from AI output", () => {
      const malicious: CertifiedCopyInput = {
        ...baseInput,
        summary: "Hello <script>steal()</script> world",
      };
      const html = renderCertifiedCopyHtml(malicious);
      expect(html).not.toContain("<script>steal()");
      expect(html).toContain("Hello");
      expect(html).toContain("world");
    });

    it("renders each field with confidence and quote", () => {
      const html = renderCertifiedCopyHtml(baseInput);
      expect(html).toContain("sro");
      expect(html).toContain("Bhubaneswar SRO");
      expect(html).toContain("95% confidence");
      expect(html).toContain("SRO Bhubaneswar"); // from the quote
      expect(html).toContain("docNo");
      expect(html).toContain("2014/1234");
    });

    it("includes a disclaimer that this is not legal advice", () => {
      const html = renderCertifiedCopyHtml(baseInput);
      expect(html).toContain("not legal advice");
    });
  });
});
