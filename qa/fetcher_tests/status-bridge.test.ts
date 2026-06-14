/**
 * Sprint V2 — status-bridge helper contract tests.
 *
 * The bridge projects the typed `ContractStatus` (5 values) into the
 * renderer vocabulary (8 values). The mapping is part of the public surface
 * of the contract layer — if it drifts, downstream consumers (mapper, PID
 * ingest, observability) will silently break.
 */
import { describe, it, expect } from "vitest";
import { projectContractStatus, type RendererStatus } from "../../apps/web/src/lib/pipeline/contracts/status-bridge";

describe("status-bridge — contract test", () => {
  it("ok → success", () => {
    expect(projectContractStatus("ok")).toBe<RendererStatus>("success");
  });

  it("no_data → partial", () => {
    // Typed "no hits" — the report renders "no cases found" copy, not a
    // failure. The renderer's "partial" status means "data was attempted,
    // no usable rows came back".
    expect(projectContractStatus("no_data")).toBe<RendererStatus>("partial");
  });

  it("source_down → manual_required", () => {
    // Portal unavailable / network error — the buyer should verify manually
    // at the source. Matches the existing pipeline behavior for bhulekh /
    // eCourts / RCCMS (e.g. qa/known_issues.md KI-001).
    expect(projectContractStatus("source_down")).toBe<RendererStatus>("manual_required");
  });

  it("invalid_input → error", () => {
    expect(projectContractStatus("invalid_input")).toBe<RendererStatus>("error");
  });

  it("parse_error → partial", () => {
    // Data came back but couldn't be parsed — soft degradation, not a hard
    // error. Matches the existing renderer behavior for HTML-parse failures.
    expect(projectContractStatus("parse_error")).toBe<RendererStatus>("partial");
  });
});
