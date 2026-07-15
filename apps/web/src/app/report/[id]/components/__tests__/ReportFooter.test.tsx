/**
 * Tests for ReportFooter React component (PI-3 T2 — guarantee tier).
 *
 * Verifies:
 * - Renders guarantee section when paidTier is guaranteed and guaranteeAcceptedAt is set
 * - Skips when paidTier is standard
 * - Renders lawyer signature block when lawyerName + signedAt are set
 * - Omits lawyer block when not signed
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReportFooter } from "../ReportFooter";

describe("ReportFooter", () => {
  it("renders the guarantee section when paidTier is guaranteed and guaranteeAcceptedAt is set", () => {
    render(
      <ReportFooter
        paidTier="guaranteed"
        guaranteeAcceptedAt="2026-07-01T10:00:00Z"
        lawyerName={null}
        lawyerFirm={null}
        signedAt={null}
      />
    );
    expect(screen.getByTestId("guarantee-footer")).toBeTruthy();
    expect(screen.getByText(/18-month/i)).toBeTruthy();
  });

  it("returns null (renders nothing) when paidTier is standard", () => {
    const { container } = render(
      <ReportFooter
        paidTier="standard"
        guaranteeAcceptedAt="2026-07-01T10:00:00Z"
        lawyerName={null}
        lawyerFirm={null}
        signedAt={null}
      />
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders the lawyer signature block when lawyerName and signedAt are set", () => {
    const { container } = render(
      <ReportFooter
        paidTier="guaranteed"
        guaranteeAcceptedAt="2026-07-01T10:00:00Z"
        lawyerName="Adv. R Sharma"
        lawyerFirm="Sharma Legal"
        signedAt="2026-07-02T09:30:00Z"
      />
    );
    const lawyerBlock = container.querySelector(".guarantee-lawyer-block");
    expect(lawyerBlock).not.toBeNull();
    expect(lawyerBlock?.textContent).toContain("Adv. R Sharma");
    expect(lawyerBlock?.textContent).toContain("Sharma Legal");
    expect(lawyerBlock?.textContent).toContain("Signed by:");
  });

  it("omits the lawyer block when lawyerName is null", () => {
    const { container } = render(
      <ReportFooter
        paidTier="guaranteed"
        guaranteeAcceptedAt="2026-07-01T10:00:00Z"
        lawyerName={null}
        lawyerFirm={null}
        signedAt={null}
      />
    );
    // The lawyer block should not render at all when lawyerName is absent.
    expect(container.querySelector(".guarantee-lawyer-block")).toBeNull();
    expect(container.innerHTML).not.toContain("Signed by:");
  });
});
