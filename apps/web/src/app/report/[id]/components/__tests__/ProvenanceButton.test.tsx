import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

import { SourceLinkResolver, resolveSourceAction } from "../SourceLinkResolver";
import { ProvenanceButton } from "../ProvenanceButton";
import { VerdictCard } from "../VerdictCard";
import { QuestionPanel } from "../QuestionPanel";

afterEach(() => {
  cleanup();
});

// ---------------------------------------------------------------------------
// SourceLinkResolver
// ---------------------------------------------------------------------------

describe("SourceLinkResolver", () => {
  it("bhulekh success → bhulekh.ori.nic.in URL", () => {
    const result = SourceLinkResolver("bhulekh", "success");
    expect(result).not.toBeNull();
    expect(result!.url).toBe("https://bhulekh.ori.nic.in/");
    expect(result!.label).toBe("Bhulekh RoR");
  });

  it("bhunaksha partial → mapserver URL (partial still returns URL)", () => {
    const result = SourceLinkResolver("bhunaksha", "partial");
    expect(result).not.toBeNull();
    expect(result!.url).toBe("https://mapserver.odisha4kgeo.in/");
    expect(result!.label).toBe("Bhunaksha plot map");
  });

  it("ecourts no_go → still returns URL (no automated fetch → URL is the fallback)", () => {
    const result = SourceLinkResolver("ecourts", "no_go");
    expect(result).not.toBeNull();
    expect(result!.url).toBe("https://services.ecourts.gov.in/");
  });

  it("rccms not_run → null (use resolveSourceAction for manual copy)", () => {
    const result = SourceLinkResolver("rccms", "not_run");
    expect(result).toBeNull();
    expect(resolveSourceAction("rccms")).toContain("ccms.nic.in");
    expect(resolveSourceAction("rccms")).toContain("Hal Khata No.");
  });

  it("unknown key → generic fallback with null url", () => {
    const result = SourceLinkResolver("unknown-source", "success");
    expect(result).not.toBeNull();
    expect(result!.url).toBe("");
    expect(result!.fallbackAction).toBe("Ask your lawyer to verify manually");
  });

  it("igr-ec always returns URL regardless of status", () => {
    for (const status of ["success", "partial", "failed", "manual_required", "no_go"] as const) {
      const result = SourceLinkResolver("igr-ec", status);
      expect(result).not.toBeNull();
      expect(result!.url).toBe("https://igrodisha.gov.in/");
      expect(result!.label).toBe("IGR EC portal");
    }
  });
});

// ---------------------------------------------------------------------------
// resolveSourceAction
// ---------------------------------------------------------------------------

describe("resolveSourceAction", () => {
  it("rccms → manual query copy", () => {
    expect(resolveSourceAction("rccms")).toContain("ccms.nic.in");
    expect(resolveSourceAction("rccms")).toContain("Hal Khata No.");
  });

  it("unknown → generic fallback", () => {
    expect(resolveSourceAction("unknown-source")).toBe(
      "Ask your lawyer to verify manually",
    );
  });

  it("ecourts → captcha-aware copy", () => {
    const copy = resolveSourceAction("ecourts");
    expect(copy.length).toBeGreaterThan(0);
    expect(copy.toLowerCase()).toContain("manual");
  });
});

// ---------------------------------------------------------------------------
// ProvenanceButton
// ---------------------------------------------------------------------------

describe("ProvenanceButton", () => {
  it("renders link with correct href and aria-label", () => {
    render(
      <ProvenanceButton
        href="https://bhulekh.ori.nic.in/"
        label="Bhulekh RoR"
      />,
    );
    const link = screen.getByRole("link", { name: /Verify this claim on Bhulekh RoR/i });
    expect(link).toBeTruthy();
    expect(link.getAttribute("href")).toBe("https://bhulekh.ori.nic.in/");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("renders fetchedAt timestamp below the link", () => {
    render(
      <ProvenanceButton
        href="https://bhulekh.ori.nic.in/"
        label="Bhulekh RoR"
        fetchedAt="2026-07-14T10:30:00Z"
      />,
    );
    expect(screen.getByText(/Data from Bhulekh RoR, fetched 14 Jul 2026/)).toBeTruthy();
  });

  it("returns null when href is empty", () => {
    const { container } = render(
      <ProvenanceButton href="" label="Test" />,
    );
    expect(container.querySelector("[data-component='ProvenanceButton']")).toBeNull();
  });

  it("returns null when href is undefined", () => {
    const { container } = render(
      <ProvenanceButton href={undefined as unknown as string} label="Test" />,
    );
    expect(container.querySelector("[data-component='ProvenanceButton']")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// VerdictCard provenance integration
// ---------------------------------------------------------------------------

describe("VerdictCard provenance", () => {
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

  it("redFlag + fallbackAction (no_go) renders 'verify manually' text instead of link", () => {
    render(
      <VerdictCard
        {...baseProps}
        sourceLabel="RCCMS"
        fallbackAction="Manually query ccms.nic.in at the local revenue office."
      />,
    );
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText(/RCCMS/)).toBeTruthy();
    expect(screen.getByText(/data unavailable/i)).toBeTruthy();
  });

  it("without sourceUrl renders nothing provenance-related", () => {
    const { container } = render(<VerdictCard {...baseProps} />);
    expect(container.querySelector("[data-component='ProvenanceButton']")).toBeNull();
    expect(screen.queryByText(/Verify yourself/)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// QuestionPanel provenance integration
// ---------------------------------------------------------------------------

describe("QuestionPanel provenance", () => {
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
