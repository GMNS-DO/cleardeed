import { describe, it, expect } from "vitest";
import { solveCaptcha } from "./index";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("solveCaptcha", () => {
  it("returns text + confidence for a valid captcha image", async () => {
    const img = readFileSync(join(__dirname, "../../../qa/captcha-corpus/khordha-captchas/sample.png"));
    const result = await solveCaptcha(img);
    expect(result.text).toMatch(/^[a-zA-Z0-9]{4,6}$/);
    expect(result.confidence).toBeGreaterThan(0.5);
  });
});
