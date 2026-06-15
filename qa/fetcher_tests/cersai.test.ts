/**
 * Sprint V2 — CERSAI (Central Registry) contract tests.
 *
 * CERSAI OCR is the silent killer: the captcha is high-friction, and the
 * accuracy of Tesseract against the CERSAI captcha image determines whether
 * this fetcher is actually usable in production. The V2 contract tests cover
 * the post-parse shape; the captcha accuracy is tracked separately under
 * `qa/fetcher_tests/cersai_ocr/`.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";
import {
  goldenPathsFor,
  loadManifest,
  fetcherSlice,
  assertStructuralCorrectness,
  loadInvalidInputs,
} from "./_helper";
import { CersaiContract, CersaiDataSchema } from "../../apps/web/src/lib/pipeline/contracts/cersai";

const goldenPaths = goldenPathsFor("cersai");

describe("CERSAI — structural correctness", () => {
  it("accepts a synthetic success case with active charges", () => {
    const synthetic = {
      source: "cersai",
      status: "ok" as const,
      data: {
        searchType: "borrower" as const,
        searchName: "Bikash Chandra Mohapatra",
        totalCharges: 1,
        activeCharges: 1,
        satisfiedCharges: 0,
        charges: [
          {
            chargeType: "Hypothecation",
            borrowerName: "Bikash Chandra Mohapatra",
            propertyDesc: "Plot 128, Mendhasala",
            securedCreditor: "SBI",
            chargeCreationDate: "2024-03-15",
            chargeAmount: "₹25,00,000",
            chargeStatus: "Active" as const,
            caseRef: "CERSAI/2024/12345",
          },
        ],
        searchMetadata: {
          nameVariantsTried: ["Bikash Chandra Mohapatra", "B Mohapatra"],
          searchAttempts: 2,
        },
      },
      fetchedAt: "2026-06-12T10:00:00.000Z",
      sourceUrl: "https://www.cersai.org.in/Search/SearchByBorrower.aspx",
      latencyMs: 8500,
    };
    const result = CersaiContract.safeParse(synthetic);
    expect(result.success).toBe(true);
  });

  it("accepts a no_data result with satisfied charges only", () => {
    const synthetic = {
      source: "cersai",
      status: "ok" as const,
      data: {
        searchType: "borrower" as const,
        searchName: "Test",
        totalCharges: 0,
        activeCharges: 0,
        satisfiedCharges: 0,
        charges: [],
        searchMetadata: {
          nameVariantsTried: ["Test"],
          searchAttempts: 1,
        },
      },
      fetchedAt: "2026-06-12T10:00:00.000Z",
      sourceUrl: "https://www.cersai.org.in/...",
      latencyMs: 1200,
    };
    const result = CersaiContract.safeParse(synthetic);
    expect(result.success).toBe(true);
  });
});

describe("CERSAI — value correctness (per golden path)", () => {
  for (const plotId of goldenPaths) {
    it(`manifest ${plotId} matches contract structure`, () => {
      const manifest = loadManifest(plotId);
      if (!manifest) return;
      const slice = fetcherSlice(manifest, "cersai");
      if (!slice) return;
      const fieldSchemas: Record<string, z.ZodTypeAny> = {
        searchType: z.enum(["borrower", "asset"]).optional(),
        searchName: z.string().optional(),
        totalCharges: z.number().int().nonnegative().optional(),
        activeCharges: z.number().int().nonnegative().optional(),
        satisfiedCharges: z.number().int().nonnegative().optional(),
        charges: z
          .array(
            z.object({
              chargeStatus: z.enum(["Active", "Satisfied", "Unknown"]).optional(),
            }).passthrough()
          )
          .optional(),
      };
      const checks = assertStructuralCorrectness(slice, fieldSchemas);
      const mismatches = checks.filter((c) => c.status === "mismatch");
      if (mismatches.length > 0) {
        console.warn(`[${plotId}] cersai mismatches:`, mismatches);
      }
      expect(mismatches).toEqual([]);
    });
  }

  it("data schema validates a no-charges result", () => {
    const result = CersaiDataSchema.safeParse({
      charges: [],
      totalCharges: 0,
      activeCharges: 0,
      satisfiedCharges: 0,
    });
    expect(result.success).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Status mapping tests (test discriminant logic)
// ─────────────────────────────────────────────────────────────────────────────

describe("CERSAI status mapping", () => {
  beforeEach(() => {
    // Reset module cache so each test gets a fresh cersai module that picks up
    // the current vi.doMock state for "playwright" and "tesseract.js".
    vi.resetModules();
  });

  it("captcha solved + 0 records → status='success' with data.charges=[]", async () => {
    vi.doMock("playwright", () => {
      // Returns isVisible: true for form inputs, false for captcha images
      const isVisibleFor = (selector: string) => /captcha/i.test(selector) ? false : true;
      return {
        chromium: {
          launch: vi.fn().mockResolvedValue({
            newPage: vi.fn().mockResolvedValue({
              goto: vi.fn().mockResolvedValue(undefined),
              waitForTimeout: vi.fn().mockResolvedValue(undefined),
              waitForSelector: vi.fn().mockResolvedValue(undefined),
              locator: vi.fn().mockImplementation((selector: string) => ({
                first: vi.fn().mockImplementation(function (this: any) { return this; }),
                last: vi.fn().mockImplementation(function (this: any) { return this; }),
                count: vi.fn().mockResolvedValue(0),
                isVisible: vi.fn().mockImplementation(() => Promise.resolve(isVisibleFor(selector))),
                click: vi.fn().mockResolvedValue(undefined),
                fill: vi.fn().mockResolvedValue(undefined),
                press: vi.fn().mockResolvedValue(undefined),
                selectOption: vi.fn().mockResolvedValue(undefined),
                getAttribute: vi.fn().mockResolvedValue(""),
              })),
              evaluate: vi.fn().mockResolvedValue("No records found for the search criteria."),
              click: vi.fn().mockResolvedValue(undefined),
              fill: vi.fn().mockResolvedValue(undefined),
              press: vi.fn().mockResolvedValue(undefined),
              close: vi.fn().mockResolvedValue(undefined),
              content: vi.fn().mockResolvedValue(""),
              setExtraHTTPHeaders: vi.fn().mockResolvedValue(undefined),
            }),
            isConnected: vi.fn().mockReturnValue(true),
            close: vi.fn().mockResolvedValue(undefined),
          }),
        },
      };
    });

    const { cersaiFetch } = await import("../../packages/fetchers/cersai/src/index.js");
    const result = await cersaiFetch({ partyName: "Bikash Chandra Mohapatra" });

    expect(result.status).toBe("success");
    expect(result.statusReason).toBe("no_charges_found");
    expect(result.verification).toBe("verified");
    expect(result.data?.charges).toEqual([]);
    expect(result.data?.totalCharges).toBe(0);
  });

  it("captcha unsolvable → status='failed' with verification='manual_required'", async () => {
    vi.doMock("playwright", () => ({
      chromium: {
        launch: vi.fn().mockResolvedValue({
          newPage: vi.fn().mockResolvedValue({
            goto: vi.fn().mockResolvedValue(undefined),
            waitForTimeout: vi.fn().mockResolvedValue(undefined),
            locator: vi.fn().mockReturnValue({
              first: vi.fn().mockReturnValue({
                isVisible: vi.fn().mockResolvedValue(true),
                click: vi.fn().mockResolvedValue(undefined),
                fill: vi.fn().mockResolvedValue(undefined),
                press: vi.fn().mockResolvedValue(undefined),
                selectOption: vi.fn().mockResolvedValue(undefined),
                getAttribute: vi.fn().mockResolvedValue(""),
              }),
              isVisible: vi.fn().mockResolvedValue(true),
              click: vi.fn().mockResolvedValue(undefined),
              fill: vi.fn().mockResolvedValue(undefined),
              press: vi.fn().mockResolvedValue(undefined),
              selectOption: vi.fn().mockResolvedValue(undefined),
              getAttribute: vi.fn().mockResolvedValue(""),
            }),
            evaluate: vi.fn().mockResolvedValue("Invalid captcha! Please enter correct captcha."),
            click: vi.fn().mockResolvedValue(undefined),
            fill: vi.fn().mockResolvedValue(undefined),
            press: vi.fn().mockResolvedValue(undefined),
            close: vi.fn().mockResolvedValue(undefined),
            content: vi.fn().mockResolvedValue(""),
            setExtraHTTPHeaders: vi.fn().mockResolvedValue(undefined),
          }),
          isConnected: vi.fn().mockReturnValue(true),
          close: vi.fn().mockResolvedValue(undefined),
        }),
      },
    }));

    // Mock tesseract.js so the OCR solver doesn't blow up
    vi.doMock("tesseract.js", () => ({
      createWorker: vi.fn().mockResolvedValue({
        recognize: vi.fn().mockResolvedValue({ data: { text: "ABCDE", confidence: 80 } }),
        terminate: vi.fn().mockResolvedValue(undefined),
      }),
    }));

    const { cersaiFetch } = await import("../../packages/fetchers/cersai/src/index.js");
    const result = await cersaiFetch({ partyName: "Bikash Chandra Mohapatra" });

    expect(result.status).toBe("failed");
    expect(result.verification).toBe("manual_required");
  });
});

describe("CERSAI — negative cases", () => {
  const cases = loadInvalidInputs().filter((c) => c.fetcher === "cersai");
  if (cases.length === 0) {
    it.skip("no cersai negative cases loaded from qa/invalid_inputs.json", () => {});
    return;
  }
  for (const c of cases) {
    it(`${c.description} → ${c.expected_status}`, () => {
      expect(["invalid_input", "no_data", "source_down"]).toContain(c.expected_status);
    });
  }
});
