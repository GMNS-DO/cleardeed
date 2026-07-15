// @vitest-environment jsdom
//
// NOTE: vitest + @testing-library/react must be installed before these tests run.
// Run: pnpm add -D vitest @testing-library/react @testing-library/jest-dom jsdom
//
// Also: vitest.config.ts at the repo root uses environment: "node" and does NOT
// currently include this directory in its `include` list. To run these tests,
// add the following pattern to the `include` array:
//
//   "apps/web/src/app/report/[id]/components/**/*.test.tsx"
//
// and either set `environment: "jsdom"` globally or annotate this file with
// `// @vitest-environment jsdom`.
//
// Until both deps and config changes land, the tests below are valid TS/React
// but `pnpm test` will skip them.

import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

import { PropertyHeader } from "../PropertyHeader";
import { OwnerSection } from "../OwnerSection";
import { LandClassCard } from "../LandClassCard";
import { PlotMap } from "../PlotMap";
import { VerdictCard } from "../VerdictCard";
import { QuestionPanel } from "../QuestionPanel";
import { QuestionTile } from "../QuestionTile";
import { FinancialExposureSummary } from "../FinancialExposureSummary";

afterEach(() => cleanup());

// ---------------------------------------------------------------------------
// PropertyHeader
// ---------------------------------------------------------------------------

describe("PropertyHeader", () => {
  const baseProps = {
    village: "Mendhasala",
    tahasil: "Bhubaneswar",
    district: "Khordha",
    plotNo: "415",
    areaAcres: 1.075,
    areaDecimal: 0.075,
    gpsLat: 20.272688,
    gpsLon: 85.701271,
    sourceStatus: {
      bhulekh: "success" as const,
      bhunaksha: "success" as const,
      nominatim: "success" as const,
    },
  };

  it("renders the village/tahasil/district breadcrumb", () => {
    render(<PropertyHeader {...baseProps} />);
    expect(screen.getByText(/Mendhasala.*Bhubaneswar.*Khordha/i)).toBeTruthy();
  });

  it("renders the plot number and GPS coordinates", () => {
    render(<PropertyHeader {...baseProps} />);
    expect(screen.getByText("415")).toBeTruthy();
    expect(screen.getByText(/20\.272688.*85\.701271/)).toBeTruthy();
  });

  it("renders source-status chips with the success colour class", () => {
    render(<PropertyHeader {...baseProps} />);
    const bhulekhChip = screen.getByTitle(/^bhulekh:/);
    expect(bhulekhChip.className).toContain("bg-[#1d6f5b]");
  });

  it("renders partial status chip in amber", () => {
    render(
      <PropertyHeader
        {...baseProps}
        sourceStatus={{
          bhulekh: "partial",
          bhunaksha: "success",
          nominatim: "success",
        }}
      />,
    );
    const chip = screen.getByTitle(/^bhulekh:/);
    expect(chip.className).toContain("bg-[#8a5f1d]");
  });

  it("renders failed status chip in red", () => {
    render(
      <PropertyHeader
        {...baseProps}
        sourceStatus={{
          bhulekh: "failed",
          bhunaksha: "success",
          nominatim: "success",
        }}
      />,
    );
    const chip = screen.getByTitle(/^bhulekh:/);
    expect(chip.className).toContain("bg-[#b91c1c]");
  });

  it("renders not_run status chip in gray", () => {
    render(
      <PropertyHeader
        {...baseProps}
        sourceStatus={{
          bhulekh: "not_run",
          bhunaksha: "success",
          nominatim: "success",
        }}
      />,
    );
    const chip = screen.getByTitle(/^bhulekh:/);
    expect(chip.className).toContain("bg-[#5b665f]");
  });

  it("renders area in acres+decimals when both are provided", () => {
    render(<PropertyHeader {...baseProps} />);
    expect(screen.getByText(/1\.0750 ac.*0\.07.*dec|0\.08 dec/i)).toBeTruthy();
  });

  it("renders em-dash for area when both area fields are null", () => {
    render(
      <PropertyHeader {...baseProps} areaAcres={null} areaDecimal={null} />,
    );
    expect(screen.getByText("—")).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// OwnerSection
// ---------------------------------------------------------------------------

describe("OwnerSection", () => {
  const primary = {
    odia: "କୃଷ୍ଣଚନ୍ଦ୍ର ବଡ଼ଯେନା",
    latin: "Krushnachandra Barajena",
    guardianOdia: "ବାଉରିବନ୍ଧୁ ବଡ଼ଯେନା",
    guardianLatin: "Bauribandhu Barajena",
    casteOdia: "ମହାଲାଏକ",
    residenceOdia: "ନିଜଗାଁ",
  };

  const baseMatch = {
    state: "ror_available" as const,
    claimedName: "Krushnachandra Barajena",
    officialName: "Krushnachandra Barajena",
    confidence: 0.95,
    explanation: "Exact match against RoR tenant block.",
  };

  it("renders primary owner Odia + Latin and guardian, caste, residence", () => {
    render(
      <OwnerSection
        primaryOwner={primary}
        coOwners={[]}
        nameMatch={baseMatch}
      />,
    );
    expect(screen.getByText("Krushnachandra Barajena")).toBeTruthy();
    expect(screen.getByText(/କୃଷ୍ଣଚନ୍ଦ୍ର ବଡ଼ଯେନା/)).toBeTruthy();
    expect(screen.getByText(/Bauribandhu/)).toBeTruthy();
    expect(screen.getByText(/ମହାଲାଏକ/)).toBeTruthy();
    expect(screen.getByText(/ନିଜଗାଁ/)).toBeTruthy();
  });

  it("renders co-owners list with both Latin and Odia parenthetical", () => {
    render(
      <OwnerSection
        primaryOwner={primary}
        coOwners={[
          { latin: "Sarojini Barajena", odia: "ସରୋଜିନୀ ବଡ଼ଯେନା" },
          { latin: "Bhubaneswar Barajena", odia: "ଭୁବନେଶ୍ୱର ବଡ଼ଯେନା" },
        ]}
        nameMatch={baseMatch}
      />,
    );
    expect(screen.getByText(/Co-owners \(2\)/)).toBeTruthy();
    expect(screen.getByText(/Sarojini Barajena/)).toBeTruthy();
    expect(screen.getByText(/Bhubaneswar Barajena/)).toBeTruthy();
    expect(screen.getByText(/ସରୋଜିନୀ ବଡ଼ଯେନା/)).toBeTruthy();
  });

  it("renders the name-match verdict chip with correct text for ror_available", () => {
    render(
      <OwnerSection primaryOwner={primary} coOwners={[]} nameMatch={baseMatch} />,
    );
    expect(screen.getByText(/RoR owner found/)).toBeTruthy();
  });

  it("renders the name-match verdict chip for ror_unavailable", () => {
    render(
      <OwnerSection
        primaryOwner={null}
        coOwners={[]}
        nameMatch={{
          ...baseMatch,
          state: "ror_unavailable",
          explanation: "Bhulekh did not return owner data.",
        }}
      />,
    );
    expect(screen.getByText(/RoR owner not available/)).toBeTruthy();
    expect(screen.getByText(/No primary owner recorded/)).toBeTruthy();
  });

  it("renders the name-match verdict chip for claimed_name_mismatch", () => {
    render(
      <OwnerSection
        primaryOwner={primary}
        coOwners={[]}
        nameMatch={{
          ...baseMatch,
          state: "claimed_name_mismatch",
          claimedName: "John Doe",
          officialName: "Krushnachandra Barajena",
          confidence: 0.1,
        }}
      />,
    );
    expect(screen.getByText(/Claimed name does not match/)).toBeTruthy();
  });

  it("renders the name-match verdict chip for no_claimed_name", () => {
    render(
      <OwnerSection
        primaryOwner={primary}
        coOwners={[]}
        nameMatch={{
          ...baseMatch,
          state: "no_claimed_name",
          claimedName: null,
        }}
      />,
    );
    expect(screen.getByText(/No claimed name provided/)).toBeTruthy();
  });

  it("renders the name-match verdict chip for unknown", () => {
    render(
      <OwnerSection
        primaryOwner={primary}
        coOwners={[]}
        nameMatch={{
          ...baseMatch,
          state: "unknown",
          confidence: 0,
        }}
      />,
    );
    expect(screen.getByText(/Match status unknown/)).toBeTruthy();
  });

  it("hides co-owners section when list is empty", () => {
    render(
      <OwnerSection primaryOwner={primary} coOwners={[]} nameMatch={baseMatch} />,
    );
    expect(screen.queryByText(/Co-owners/)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// LandClassCard
// ---------------------------------------------------------------------------

describe("LandClassCard", () => {
  it("renders the English translation prominently", () => {
    render(
      <LandClassCard
        odia="ଶାରଦ ଦୁଇ"
        english="Agricultural"
        conversionRequired={true}
        restrictions={[]}
      />,
    );
    expect(screen.getByText("Agricultural")).toBeTruthy();
    expect(screen.getByText("ଶାରଦ ଦୁଇ")).toBeTruthy();
  });

  it("renders Conversion required badge when conversionRequired=true", () => {
    render(
      <LandClassCard
        odia="ଶାରଦ"
        english="Agricultural"
        conversionRequired={true}
        restrictions={[]}
      />,
    );
    expect(screen.getByText("Conversion required")).toBeTruthy();
  });

  it("renders No conversion required badge when conversionRequired=false", () => {
    render(
      <LandClassCard
        odia="ଗହଣ ଜୋଗ୍ୟ"
        english="Homestead / Residential"
        conversionRequired={false}
        restrictions={[]}
      />,
    );
    expect(screen.getByText("No conversion required")).toBeTruthy();
  });

  it("renders Conversion status unknown badge when conversionRequired=null", () => {
    render(
      <LandClassCard
        odia="?"
        english="Unknown"
        conversionRequired={null}
        restrictions={[]}
      />,
    );
    expect(screen.getByText("Conversion status unknown")).toBeTruthy();
  });

  it("renders restrictions list with severity-coded left-border colours", () => {
    const { container } = render(
      <LandClassCard
        odia="?"
        english="Agricultural"
        conversionRequired={true}
        restrictions={[
          {
            flag: "Section 6",
            severity: "info",
            description: "Government-notified category.",
          },
          {
            flag: "Conversion lag",
            severity: "watchout",
            description: "Conversion paperwork pending.",
            recommendedAction: "Engage a CLU agent.",
          },
          {
            flag: "Subdivided plot",
            severity: "redFlag",
            description: "Sub-plot indicator without BDA layout approval.",
          },
        ]}
      />,
    );
    expect(screen.getByText("Section 6")).toBeTruthy();
    expect(screen.getByText(/Government-notified/)).toBeTruthy();
    expect(screen.getByText("Conversion lag")).toBeTruthy();
    expect(screen.getByText(/Engage a CLU agent/)).toBeTruthy();
    expect(screen.getByText("Subdivided plot")).toBeTruthy();

    // Severity -> border colour mapping is applied inline via borderLeftColor.
    const list = container.querySelectorAll("li");
    expect(list.length).toBe(3);
    const colors = Array.from(list).map(
      (li) => (li as HTMLElement).style.borderLeftColor,
    );
    expect(colors).toContain("#1d6f5b"); // info -> green
    expect(colors).toContain("#8a5f1d"); // watchout -> amber
    expect(colors).toContain("#b91c1c"); // redFlag -> red
  });

  it("omits restrictions heading when the list is empty", () => {
    render(
      <LandClassCard
        odia="?"
        english="Homestead / Residential"
        conversionRequired={false}
        restrictions={[]}
      />,
    );
    expect(screen.queryByText(/Restrictions \(/)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// VerdictCard
// ---------------------------------------------------------------------------

describe("VerdictCard", () => {
  it("renders headline, body, actionItem, and ruleId", () => {
    render(
      <VerdictCard
        severity="watchout"
        headline="Active mortgage on RoR"
        body="Lender has an unresolved mortgage on this plot."
        actionItem="Demand a no-dues certificate from the lender."
        ruleId="ROR-INS-181"
      />,
    );
    expect(screen.getByText("Active mortgage on RoR")).toBeTruthy();
    expect(screen.getByText(/Lender has an unresolved mortgage/)).toBeTruthy();
    expect(screen.getByText(/Demand a no-dues certificate/)).toBeTruthy();
    expect(screen.getByText("ROR-INS-181")).toBeTruthy();
  });

  it("renders Watch-out chip for watchout severity", () => {
    render(
      <VerdictCard
        severity="watchout"
        headline="X"
        body="Y"
      />,
    );
    expect(screen.getByText("Watch-out")).toBeTruthy();
  });

  it("renders Red flag chip for redFlag severity", () => {
    render(
      <VerdictCard
        severity="redFlag"
        headline="X"
        body="Y"
      />,
    );
    expect(screen.getByText("Red flag")).toBeTruthy();
  });

  it("renders Positive signal chip for positive severity", () => {
    render(
      <VerdictCard
        severity="positive"
        headline="X"
        body="Y"
      />,
    );
    expect(screen.getByText("Positive signal")).toBeTruthy();
  });

  it("applies the correct borderLeftColor for each severity", () => {
    const cases = [
      { severity: "positive" as const, color: "#1d6f5b" },
      { severity: "watchout" as const, color: "#8a5f1d" },
      { severity: "redFlag" as const, color: "#b91c1c" },
    ];
    for (const c of cases) {
      const { container, unmount } = render(
        <VerdictCard severity={c.severity} headline="h" body="b" />,
      );
      const article = container.querySelector(
        '[data-component="VerdictCard"]',
      ) as HTMLElement | null;
      expect(article).toBeTruthy();
      expect(article!.style.borderLeftColor).toBe(c.color);
      unmount();
    }
  });

  it("exposes severity via data-severity attribute", () => {
    const { container } = render(
      <VerdictCard severity="redFlag" headline="h" body="b" />,
    );
    const article = container.querySelector('[data-severity="redFlag"]');
    expect(article).toBeTruthy();
  });

  it("hides actionItem and ruleId when not provided", () => {
    render(<VerdictCard severity="positive" headline="h" body="b" />);
    expect(screen.queryByText(/Action:/)).toBeNull();
    expect(screen.queryByText(/ROR-INS-/)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// QuestionTile
// ---------------------------------------------------------------------------

describe("QuestionTile", () => {
  const baseProps = {
    id: "Q1",
    title: "Does the seller actually own this?",
    summary: "One-line answer.",
    tally: { critical: 0, watchout: 0, positive: 0, total: 0 },
  };

  it("collapsed by default: shows title + summary and no children", () => {
    render(
      <QuestionTile {...baseProps}>
        <p>child content</p>
      </QuestionTile>,
    );
    expect(screen.getByText("Does the seller actually own this?")).toBeTruthy();
    expect(screen.getByText("One-line answer.")).toBeTruthy();
    expect(screen.getByText("no findings")).toBeTruthy();
    expect(screen.queryByText("child content")).toBeNull();
  });

  it("renders tally chips when critical/watchout/positive counts are > 0", () => {
    render(
      <QuestionTile
        {...baseProps}
        tally={{ critical: 2, watchout: 1, positive: 3, total: 6 }}
      />,
    );
    expect(screen.getByText("2 critical")).toBeTruthy();
    expect(screen.getByText("1 watchout")).toBeTruthy();
    expect(screen.getByText("3 positive")).toBeTruthy();
    expect(screen.queryByText("no findings")).toBeNull();
  });

  it("expanded=true renders children", () => {
    render(
      <QuestionTile {...baseProps} expanded>
        <p>child content</p>
      </QuestionTile>,
    );
    expect(screen.getByText("child content")).toBeTruthy();
    expect(screen.getByText("▾")).toBeTruthy();
  });

  it("collapsed renders the right-pointing chevron and no children", () => {
    render(
      <QuestionTile {...baseProps}>
        <p>hidden</p>
      </QuestionTile>,
    );
    expect(screen.getByText("▸")).toBeTruthy();
    expect(screen.queryByText("hidden")).toBeNull();
  });

  it("clicking the toggle button invokes onToggle", () => {
    const onToggle = vi.fn();
    render(<QuestionTile {...baseProps} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("reflects expanded state in data-expanded attribute", () => {
    const { container } = render(
      <QuestionTile {...baseProps} expanded />,
    );
    const section = container.querySelector('[data-component="QuestionTile"]');
    expect(section?.getAttribute("data-expanded")).toBe("true");
  });
});



describe("FinancialExposureSummary", () => {
  const baseProps = {
    verifiedClearExposure: 0,
    verifiedClearCategories: ["Mortgage", "Court attachment"],
    atRiskExposure: 850000,
    atRiskCategories: ["Lease resumption"],
    unquantifiedItems: ["Flood zone", "Road widening reservation"],
  };

  it("renders the three summary rows with the right headers", () => {
    render(<FinancialExposureSummary {...baseProps} />);
    expect(screen.getByText("Verified clear exposure")).toBeTruthy();
    expect(screen.getByText("At-risk exposure")).toBeTruthy();
    expect(
      screen.getByText(/Unquantified items requiring manual verification/),
    ).toBeTruthy();
  });

  it("formats verified-clear rupee value with ₹0 and en-IN locale", () => {
    render(<FinancialExposureSummary {...baseProps} />);
    // Intl.NumberFormat("en-IN") renders 0 as "₹0"
    expect(screen.getByText("₹0")).toBeTruthy();
  });

  it("formats at-risk rupee value with en-IN grouping", () => {
    render(<FinancialExposureSummary {...baseProps} />);
    // 850000 -> "₹8,50,000" via en-IN locale
    expect(screen.getByText("₹8,50,000")).toBeTruthy();
  });

  it("renders verified-clear category chips when list is non-empty", () => {
    render(<FinancialExposureSummary {...baseProps} />);
    expect(screen.getByText("Mortgage")).toBeTruthy();
    expect(screen.getByText("Court attachment")).toBeTruthy();
    expect(screen.queryByText("none disclosed")).toBeNull();
  });

  it("renders 'none disclosed' when verifiedClearCategories is empty", () => {
    render(
      <FinancialExposureSummary {...baseProps} verifiedClearCategories={[]} />,
    );
    expect(screen.getByText("none disclosed")).toBeTruthy();
  });

  it("renders 'none quantified' when atRiskCategories is empty", () => {
    render(
      <FinancialExposureSummary {...baseProps} atRiskCategories={[]} />,
    );
    expect(screen.getByText("none quantified")).toBeTruthy();
  });

  it("renders 'none flagged' when unquantifiedItems is empty", () => {
    render(
      <FinancialExposureSummary {...baseProps} unquantifiedItems={[]} />,
    );
    expect(screen.getByText("none flagged")).toBeTruthy();
  });

  it("renders unquantified items as list entries", () => {
    render(<FinancialExposureSummary {...baseProps} />);
    expect(screen.getByText("Flood zone")).toBeTruthy();
    expect(screen.getByText("Road widening reservation")).toBeTruthy();
  });

  it("formats very large rupee values with en-IN grouping (lakhs/crores style)", () => {
    render(
      <FinancialExposureSummary
        {...baseProps}
        atRiskExposure={49_99_999}
        atRiskCategories={["Circle-rate overpayment"]}
      />,
    );
    // Intl en-IN renders 4999999 as "₹49,99,999" (Indian grouping).
    expect(screen.getByText("₹49,99,999")).toBeTruthy();
  });

  it("renders em-dash when at-risk exposure is non-finite", () => {
    render(
      <FinancialExposureSummary
        {...baseProps}
        atRiskExposure={Number.NaN}
      />,
    );
    // formatRupees returns "—" for non-finite input; ₹0 still appears for verified-clear.
    expect(screen.getByText("—")).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// VerdictCard provenance integration
// ---------------------------------------------------------------------------

describe("VerdictCard provenance integration", () => {
  const baseProps = {
    severity: "redFlag" as const,
    headline: "Active mortgage on RoR",
    body: "Lender has an unresolved mortgage on this plot.",
  };

  it("redFlag + sourceUrl renders link with correct href", () => {
    render(
      <VerdictCard
        {...baseProps}
        sourceUrl="https://bhulekh.ori.nic.in/"
        sourceLabel="Bhulekh RoR"
      />,
    );
    expect(screen.getByRole("link", { name: /Verify this claim on Bhulekh RoR/i })).toBeTruthy();
  });

  it("positive + sourceUrl does NOT render link (positive signals skip)", () => {
    render(
      <VerdictCard
        {...baseProps}
        severity="positive"
        sourceUrl="https://bhulekh.ori.nic.in/"
        sourceLabel="Bhulekh RoR"
      />,
    );
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("redFlag + fallbackAction + no sourceUrl renders 'verify manually' text", () => {
    render(
      <VerdictCard
        {...baseProps}
        fallbackAction="Manually query ccms.nic.in at the local revenue office."
        sourceLabel="RCCMS"
      />,
    );
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText(/RCCMS/)).toBeTruthy();
    expect(screen.getByText(/data unavailable/i)).toBeTruthy();
    expect(screen.getByText(/Manually query ccms.nic.in/)).toBeTruthy();
  });

  it("without sourceUrl/fallbackAction renders nothing provenance-related", () => {
    const { container } = render(<VerdictCard {...baseProps} />);
    expect(container.querySelector("[data-component='ProvenanceButton']")).toBeNull();
    expect(screen.queryByText(/Verify yourself/)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// QuestionPanel provenance integration
// ---------------------------------------------------------------------------

describe("QuestionPanel provenance integration", () => {
  const baseProps = {
    id: "Q1",
    question: "Does the seller actually own this?",
    verdict: "redFlag" as const,
    verdictHeadline: "Red flag detected",
  };

  it("verdict='redFlag' + sourceUrl renders link", () => {
    render(
      <QuestionPanel
        {...baseProps}
        sourceUrl="https://bhulekh.ori.nic.in/"
        sourceLabel="Bhulekh RoR"
      />,
    );
    expect(screen.getByRole("link", { name: /Verify this claim on Bhulekh RoR/i })).toBeTruthy();
  });

  it("verdict='clear' + sourceUrl does NOT render link", () => {
    render(
      <QuestionPanel
        {...baseProps}
        verdict="clear"
        verdictHeadline="All clear"
        sourceUrl="https://bhulekh.ori.nic.in/"
        sourceLabel="Bhulekh RoR"
      />,
    );
    expect(screen.queryByRole("link")).toBeNull();
  });
});