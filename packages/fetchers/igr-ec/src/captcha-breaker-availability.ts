/**
 * Captcha-breaker availability probe.
 *
 * Task 1.3 — Layer 1.3. Used by:
 *   - `index.ts` to decide whether to attempt the V3 fast-path.
 *   - tests to skip captcha-breaker-specific assertions when the package
 *     is not yet importable.
 *
 * `true` means `@cleardeed/captcha-breaker` is importable AND exports a
 * `solveCaptcha(imageBuffer, options)` function. Otherwise `false`.
 *
 * NOTE: This module is intentionally tiny and side-effect-free. It must
 * not import the captcha-breaker package directly (that would defeat the
 * dynamic-import-based availability check). Instead it does a synchronous
 * module-existence probe via `require.resolve`.
 */

import { createRequire } from "node:module";

let cached: boolean | null = null;

export function isCaptchaBreakerAvailable(): boolean {
  if (cached !== null) return cached;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const requireFn: NodeRequire = (createRequire as any)(import.meta.url);
    const resolved = requireFn.resolve("@cleardeed/captcha-breaker");
    cached = typeof resolved === "string" && resolved.length > 0;
  } catch {
    cached = false;
  }
  return cached;
}

/**
 * Synchronous boolean flag used in places where a function call would be
 * awkward (e.g. test assertions). Prefer `isCaptchaBreakerAvailable()`.
 */
export const CAPTCHA_BREAKER_AVAILABLE = isCaptchaBreakerAvailable();
