import { describe, it, expect } from "vitest";
import { buildTogglePillBar } from "../index";

describe("toggle-bar (deprecated)", () => {
  it("returns empty string — replaced by q-grid in CRED redesign", () => {
    expect(
      buildTogglePillBar(
        [
          { id: "plot", label: "Plot", status: "verified", contentHtml: "<p>x</p>" },
        ],
        undefined
      )
    ).toBe("");
  });
});