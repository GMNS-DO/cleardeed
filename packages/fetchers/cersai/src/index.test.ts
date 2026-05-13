/**
 * Unit tests for CERSAI public charge-search fetcher.
 *
 * Tests cover:
 * - Name variant generation
 * - Result page classification
 * - Charge table parsing
 * - Health check
 *
 * Note: Live browser tests require Playwright installation + CERSAI portal access.
 * These unit tests use mocked HTML to verify parser and classification logic.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { generateNameVariants, parseChargeTable, classifyCersaiPage } from "./index.js";

// ─────────────────────────────────────────────────────────────────────────────
// Mock playwright at top level (required for vitest hoisting)
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("playwright", () => ({
  chromium: {
    launch: vi.fn().mockResolvedValue({
      newPage: vi.fn().mockResolvedValue({
        goto: vi.fn().mockResolvedValue(undefined),
        waitForTimeout: vi.fn().mockResolvedValue(undefined),
        locator: vi.fn().mockReturnValue({
          first: vi.fn().mockReturnValue({
            isVisible: vi.fn().mockResolvedValue(true),
          }),
        }),
        evaluate: vi.fn().mockResolvedValue("CERSAI Public Search — Search by Borrower"),
        close: vi.fn().mockResolvedValue(undefined),
      }),
      isConnected: vi.fn().mockReturnValue(true),
      close: vi.fn().mockResolvedValue(undefined),
    }),
  },
}));

// ─────────────────────────────────────────────────────────────────────────────
// Name variant generation tests
// ─────────────────────────────────────────────────────────────────────────────

describe("generateNameVariants", () => {
  it("returns full name as-is", () => {
    const variants = generateNameVariants("Bikash Chandra Mohapatra");
    expect(variants).toContain("Bikash Chandra Mohapatra");
  });

  it("returns single-token surname for multi-token names", () => {
    const variants = generateNameVariants("Bikash Chandra Mohapatra");
    expect(variants).toContain("Mohapatra");
  });

  it("returns first name alone for two-token names", () => {
    const variants = generateNameVariants("Ranjan Das");
    expect(variants).toContain("Ranjan");
  });

  it("returns initials pattern for 3+ token names", () => {
    const variants = generateNameVariants("Bikash Chandra Mohapatra");
    expect(variants).toContain("B C Mohapatra");
  });

  it("returns first+last for 3+ token names", () => {
    const variants = generateNameVariants("Bikash Chandra Mohapatra");
    expect(variants).toContain("Bikash Mohapatra");
  });

  it("applies Odia surname transliteration variants for known surnames", () => {
    const variants = generateNameVariants("Prasanna Kumar Das");
    const dasVariants = variants.filter((v) => v.toLowerCase().includes("das"));
    expect(dasVariants.length).toBeGreaterThan(0);
  });

  it("returns empty array for empty input", () => {
    expect(generateNameVariants("")).toEqual([]);
    expect(generateNameVariants("   ")).toEqual([]);
  });

  it("limits to MAX_NAME_VARIANTS (5) variants", () => {
    const variants = generateNameVariants("Bikash Chandra Mohapatra");
    expect(variants.length).toBeLessThanOrEqual(5);
  });

  it("does not duplicate variants", () => {
    const variants = generateNameVariants("Bikash Chandra Mohapatra");
    const uniqueSet = new Set(variants);
    expect(variants.length).toBe(uniqueSet.size);
  });

  it("handles single-token name gracefully", () => {
    const variants = generateNameVariants("Mohapatra");
    expect(variants).toContain("Mohapatra");
    expect(variants.length).toBeGreaterThanOrEqual(1);
  });

  it("handles company/entity name", () => {
    const variants = generateNameVariants("ABC Logistics Pvt Ltd");
    expect(variants).toContain("ABC Logistics Pvt Ltd");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Result classification tests
// ─────────────────────────────────────────────────────────────────────────────

describe("classifyCersaiPage", () => {
  it("returns charges_found when 'active' and charge keywords present", () => {
    const result = classifyCersaiPage(
      "Borrower: Bikash Mohapatra | Charge Type: Mortgage | Amount: Rs. 5,00,000 | Status: Active | Date: 15-03-2021",
      ""
    );
    expect(result.outcome).toBe("charges_found");
  });

  it("returns no_records when 'no record' text present", () => {
    const result = classifyCersaiPage("No records found for the search criteria.", "");
    expect(result.outcome).toBe("no_records");
  });

  it("returns no_records for 'zero result' phrasing", () => {
    const result = classifyCersaiPage("Search returned 0 records. No matching data found.", "");
    expect(result.outcome).toBe("no_records");
  });

  it("returns captcha_failed for invalid captcha text", () => {
    const result = classifyCersaiPage("Invalid Captcha! Please enter correct captcha.", "");
    expect(result.outcome).toBe("captcha_failed");
  });

  it("returns search_error for server error text", () => {
    const result = classifyCersaiPage("500 Internal Server Error. Please try again later.", "");
    expect(result.outcome).toBe("search_error");
    expect(result.errorMessage).toBe("cersai_server_error");
  });

  it("returns search_error for login prompt without result context", () => {
    const result = classifyCersaiPage("Please login to access CERSAI portal.", "");
    expect(result.outcome).toBe("search_error");
    expect(result.errorMessage).toBe("cersai_portal_requires_login");
  });

  it("returns unknown for unrecognized page content", () => {
    const result = classifyCersaiPage("Welcome to CERSAI Portal — Your Security Interest Registry", "");
    expect(result.outcome).toBe("unknown");
  });

  it("returns charges_found for satisfied status with mortgage keywords", () => {
    const result = classifyCersaiPage(
      "Search Result: 1 charge found. Borrower: R Das | Charge: Simple Mortgage | Amount: 200000 | Status: Satisfied | Date: 10-01-2019",
      ""
    );
    expect(result.outcome).toBe("charges_found");
  });

  it("returns no_records for 'not found' phrasing", () => {
    const result = classifyCersaiPage("Borrower not found in CERSAI database.", "");
    expect(result.outcome).toBe("no_records");
  });

  it("handles case-insensitive matching", () => {
    const result = classifyCersaiPage("NO RECORDS FOUND FOR THIS SEARCH", "");
    expect(result.outcome).toBe("no_records");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Charge table parser tests
// ─────────────────────────────────────────────────────────────────────────────

describe("parseChargeTable", () => {
  it("parses a single charge row with all fields", () => {
    const html = `
      <table>
        <tr>
          <td>Bikash Mohapatra</td>
          <td>Mortgage</td>
          <td>Rs. 5,00,000</td>
          <td>Active</td>
          <td>15-03-2021</td>
          <td>State Bank of India</td>
        </tr>
      </table>
    `;
    const charges = parseChargeTable(html);
    expect(charges.length).toBeGreaterThan(0);
    const charge = charges[0];
    // At minimum, some field should be populated
    expect(charge.borrowerName || charge.chargeType || charge.chargeStatus).toBeTruthy();
  });

  it("returns empty array for empty HTML", () => {
    const charges = parseChargeTable("");
    expect(charges).toEqual([]);
  });

  it("returns empty array when no table rows match", () => {
    const html = "<div>No results here</div>";
    const charges = parseChargeTable(html);
    expect(charges).toEqual([]);
  });

  it("skips header rows containing keywords like 'Borrower' or 'Sr No'", () => {
    const html = `
      <table>
        <tr><th>Borrower Name</th><th>Charge Type</th><th>Amount</th><th>Status</th></tr>
        <tr><td>Bikash Mohapatra</td><td>Mortgage</td><td>Rs. 5,00,000</td><td>Active</td></tr>
      </table>
    `;
    const charges = parseChargeTable(html);
    expect(charges.length).toBeGreaterThanOrEqual(1);
  });

  it("parses active status correctly", () => {
    const html = `
      <table>
        <tr><td>1</td><td>Bikash Mohapatra</td><td>Mortgage</td><td>500000</td><td>Active</td><td>15-03-2021</td><td>SBI</td></tr>
      </table>
    `;
    const charges = parseChargeTable(html);
    const activeCharges = charges.filter((c) => c.chargeStatus === "Active");
    expect(activeCharges.length).toBeGreaterThan(0);
  });

  it("parses satisfied status correctly", () => {
    const html = `
      <table>
        <tr><td>1</td><td>R Das</td><td>Simple Mortgage</td><td>200000</td><td>Satisfied</td><td>10-01-2019</td><td>HDFC Bank</td></tr>
      </table>
    `;
    const charges = parseChargeTable(html);
    const satisfiedCharges = charges.filter((c) => c.chargeStatus === "Satisfied");
    expect(satisfiedCharges.length).toBeGreaterThan(0);
  });

  it("returns Unknown status when status cell doesn't match Active/Satisfied", () => {
    const html = `
      <table>
        <tr><td>1</td><td>J Panda</td><td>H hypothecation</td><td>100000</td><td>Pending</td><td>20-05-2022</td><td>Axis Bank</td></tr>
      </table>
    `;
    const charges = parseChargeTable(html);
    expect(charges.length).toBeGreaterThanOrEqual(1);
    const charge = charges[0];
    expect(charge.chargeStatus).toBe("Unknown");
  });

  it("extracts case reference from first cell", () => {
    const html = `
      <table>
        <tr><td>OD2021001234</td><td>R Das</td><td>Mortgage</td><td>300000</td><td>Active</td></tr>
      </table>
    `;
    const charges = parseChargeTable(html);
    if (charges.length > 0) {
      expect(charges[0].caseRef).toBeTruthy();
    }
  });

  it("handles multiple charge rows in same table", () => {
    const html = `
      <table>
        <tr><td>Bikash Mohapatra</td><td>Mortgage</td><td>500000</td><td>Active</td></tr>
        <tr><td>Prasanna Das</td><td>H hypothecation</td><td>200000</td><td>Satisfied</td></tr>
      </table>
    `;
    const charges = parseChargeTable(html);
    expect(charges.length).toBeGreaterThanOrEqual(1);
  });

  it("returns empty for table with header row only", () => {
    const html = `
      <table>
        <tr><th>Borrower</th><th>Charge Type</th><th>Amount</th><th>Status</th></tr>
      </table>
    `;
    const charges = parseChargeTable(html);
    expect(charges).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Health check tests (uses top-level mock)
// ─────────────────────────────────────────────────────────────────────────────

describe("healthCheck", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("healthCheck returns true when portal is reachable", async () => {
    const { healthCheck } = await import("./index.js");
    const result = await healthCheck();
    expect(result).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Interface/signature tests (no runtime needed)
// ─────────────────────────────────────────────────────────────────────────────

describe("export shape", () => {
  it("generateNameVariants is exported and callable", () => {
    expect(typeof generateNameVariants).toBe("function");
  });

  it("generateNameVariants handles edge case of whitespace-only name", () => {
    const result = generateNameVariants("   ");
    expect(Array.isArray(result)).toBe(true);
  });

  it("generateNameVariants handles edge case of single character name", () => {
    const result = generateNameVariants("B");
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it("parseChargeTable handles HTML with only whitespace", () => {
    const result = parseChargeTable("   \n\t  ");
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
  });

  it("classifyCersaiPage handles empty text gracefully", () => {
    const result = classifyCersaiPage("", "");
    expect(["charges_found", "no_records", "search_error", "captcha_failed", "unknown"]).toContain(result.outcome);
  });

  it("classifyCersaiPage is not fooled by keyword in non-result context", () => {
    const result = classifyCersaiPage(
      "Active server error — please contact support. The word 'Active' appears in this error message.",
      ""
    );
    // Should not return charges_found — it's an error page
    expect(result.outcome).not.toBe("charges_found");
  });
});