import { describe, it, expect } from "vitest";
import { findMatchingPlotOption } from "./index";

interface Opt {
  value: string;
  text: string;
}

const opt = (value: string, text = value): Opt => ({ value, text });

describe("findMatchingPlotOption", () => {
  it("matches an option whose text equals the target (regression guard)", () => {
    const opts = [opt("3937")];
    const m = findMatchingPlotOption(opts, "3937");
    expect(m).toBeDefined();
    expect(m?.value).toBe("3937");
  });

  it("matches when the option text has leading/trailing NBSP-style whitespace", () => {
    // \xa0 is non-breaking space — survives .trim() and is not collapsed
    // by readSelectOptions' /\s+/g normalisation
    const opts = [opt(" 3937", " 3937")];
    const m = findMatchingPlotOption(opts, "3937");
    expect(m).toBeDefined();
    expect(m?.text).toBe(" 3937");
  });

  it("matches when the option has internal multi-space whitespace", () => {
    const opts = [opt("182 / 3937", "182 / 3937")];
    const m = findMatchingPlotOption(opts, "182/3937");
    expect(m).toBeDefined();
    expect(m?.value).toBe("182 / 3937");
  });

  it("falls back to the compound tail: target '182/3937' matches option '3937'", () => {
    // The user's reported bug: Mendhasal dropdown stores only "3937" but
    // the user (and BhulekhInputForm) sends the compound "182/3937".
    const opts = [opt("182", "182"), opt("3937", "3937")];
    const m = findMatchingPlotOption(opts, "182/3937");
    expect(m).toBeDefined();
    expect(m?.value).toBe("3937");
  });

  it("falls back to the compound head: target '182/3937' matches option '182' when no tail exists", () => {
    // Real Bhulekh Mendhasal dropdown: contains "182" (khata) and
    // "607/182" (compound) but NO "3937" option. The user types
    // "182/3937" meaning "plot 3937 under khata 182"; the closest the
    // dropdown can offer is the khata entry "182", which still yields
    // the full RoR (the specific plot rows are filtered downstream).
    const opts = [opt("182", "182"), opt("607/182", "607/182")];
    const m = findMatchingPlotOption(opts, "182/3937");
    expect(m).toBeDefined();
    expect(m?.value).toBe("182");
  });

  it("prefers the compound tail over the head when both exist", () => {
    // Tail is more specific than head — try tail first.
    const opts = [opt("182", "182"), opt("3937", "3937")];
    const m = findMatchingPlotOption(opts, "182/3937");
    expect(m?.value).toBe("3937");
  });

  it("matches by pure-digit suffix: target '3937' matches option '182/3937'", () => {
    const opts = [opt("182/3937", "182/3937")];
    const m = findMatchingPlotOption(opts, "3937");
    expect(m).toBeDefined();
    expect(m?.value).toBe("182/3937");
  });

  it("does not over-match a single-digit target against '182'", () => {
    // Tier 3 is gated on /^\d{2,}$/ — a 1-digit target must NOT match.
    const opts = [opt("182", "182"), opt("193", "193")];
    const m = findMatchingPlotOption(opts, "1");
    expect(m).toBeUndefined();
  });

  it("compound tail is exact on the tail, not a suffix — picks '3937' over '1937'", () => {
    const opts = [opt("3937", "3937"), opt("1937", "1937")];
    const m = findMatchingPlotOption(opts, "182/3937");
    expect(m?.value).toBe("3937");
  });

  it("returns undefined for empty or undefined target without false-positive matching", () => {
    const opts = [opt("3937", "3937")];
    expect(findMatchingPlotOption(opts, "")).toBeUndefined();
    expect(findMatchingPlotOption(opts, undefined)).toBeUndefined();
  });

  it("returns undefined when no option matches", () => {
    const opts = [opt("1", "1"), opt("2", "2"), opt("3", "3")];
    const m = findMatchingPlotOption(opts, "9999");
    expect(m).toBeUndefined();
  });

  it("matches on the value side when text is uninformative", () => {
    // Some Bhulekh variants put the plot number in `value` and a
    // human-readable label (e.g. "—Select—") in `text`. The matcher
    // must consider both sides symmetrically.
    const opts = [opt("3937", "—Select—")];
    const m = findMatchingPlotOption(opts, "182/3937");
    expect(m).toBeDefined();
    expect(m?.value).toBe("3937");
  });
});
