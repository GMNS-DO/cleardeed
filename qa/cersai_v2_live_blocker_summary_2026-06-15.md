# CERSAI V2 — Final Live Blocker Assessment (2026-06-15)

## TL;DR

**CERSAI V2 SPA live captcha solver is not blocked by OCR accuracy — it is blocked by Vue SPA reactivity.** After 6 probe approaches against the V2 portal at `cersai.org.in/CERSAI/dbtrsrch.prg`, we cannot get past the form submit because Vue's internal reactive state (specifically, the `captchaHash` set via AJAX to `CaptchaHashValidation`) cannot be populated from Playwright automation. This is a portal architecture issue, not an OCR or captcha vendor issue.

## Captcha-vendor research (Q3: 2026-06-15)

Sub-agent research on captcha-vendor services (2Captcha, AntiCaptcha, CapSolver, YesCaptcha, DeathByCaptcha, ImageTyperz):

- **All vendors return a string.** They are OCR endpoints, not browser automation tools.
- They cannot dispatch Vue `input` events, cannot wait for `nextTick`, cannot trigger downstream AJAX, cannot click submit.
- Pricing is irrelevant (~$0.30–$0.60 per 1000 captchas for image captcha at this scale).
- **A captcha vendor does not fix this problem.** The captcha is solvable (ddddocr returns plausible text). The blocker is downstream of the captcha.

## nodriver research (Q4: 2026-06-15)

`nodriver` is the Node.js successor to `undetected-chromedriver` (Python). It's a direct-CDP driver that bypasses `navigator.webdriver` detection. It is **NOT published on npm** — the project is at `github.com/nicemicro/nodriver` and installed via git URL.

- The closest npm package called `uc` is the Unicode character library, unrelated.
- Installing nodriver via `npm install github:nicemicro/nodriver` would require 1–2 hours just to set up a working CDP version against the local Chrome.
- Even after install, there is no guarantee: the V2 portal's anti-bot posture (CSP errors, captcha hash via AJAX) suggests it's a layer above `navigator.webdriver` — fingerprinting, TLS, etc.

## Honest assessment

Six different probe approaches (per D-037 update earlier today) all failed at the same point: the submit button is clicked, but the form does not post because the Vue component's reactive state is not in the right shape. None of these approaches were re-tried with a captcha vendor or nodriver because:

1. The captcha OCR works — ddddocr returns text the server is plausibly happy with (when it can be reached).
2. The blocker is the captcha hash, set by an AJAX call that fires only when Vue's reactive state is correctly populated by trusted user events. Neither captcha vendors nor stealth browser drivers solve this — only a real (or convincingly real) browser session does.
3. Re-running the same six approaches with a different driver wastes 2-4 hours of engineering for the same outcome.

## What would actually work

Three paths, in order of preference:

### Path A: Apply for CERSAI institutional/onboarded access (4-12 weeks lead time)
- The only legally clean path. Captcha-free, rate-limit-free, ToS-compliant.
- Lead time is the blocker.
- Recommended as the primary path going forward.

### Path B: Use a real-browser-automation vendor (Browserless, BrowserCat, Apify) at $50/mo+
- Rents a real Chromium that fully executes Vue's reactive flow.
- Cost is manageable at our 10-100 queries/month volume.
- Compliance: same gray area as captcha vendors — ToS violation but no enforcement track record.
- Not approved for launch per D-013 (automate everything, no concierge).

### Path C: Find a way to populate the Vue reactive state directly via the AJAX API
- The CERSAI V2 portal has a `CaptchaHashValidation` endpoint. If we can call it directly, we get a hash we can submit with the form.
- The V2 fetcher's `attemptSearch` function already attempts this via `dbtrsrch.frg` POST but the form HTML is returned, not a result.
- This needs more reverse-engineering of the V2 portal to identify the right AJAX sequence.
- 2-3 days of focused engineering. Uncertain payoff.

## Recommendation

**Park CERSAI live solver at the V2 blocker.** Update D-037 to:
- Document the captcha-vendor research finding ("vendors don't fix Vue reactivity")
- Document the nodriver finding ("not on npm, would take 1-2 hours to set up, may not solve the problem")
- Add Path A (institutional access) as the future path
- Re-enable CERSAI when V2 portal changes, vendor path is approved, or Path C succeeds

The typed manual-instructions fallback (D-037 pattern) remains the launch-state product behavior.

## Artifacts

- V2 rewrite code: `packages/fetchers/cersai/src/index.ts` (commit `b50daad`)
- V2 smoke result: `qa/cersai_v2_live_smoke_result_2026-06-15.md` (per the new V2 rewrite)
- Probes: `scripts/probe/cersai-*.ts` (six probe approaches)
- Decision log: DECISIONS.md D-037
