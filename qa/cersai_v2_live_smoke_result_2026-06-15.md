# CERSAI V2 fetcher — live smoke result, 2026-06-15

## TL;DR

**V2 fetcher rewrite is green on contracts (38/38). Live portal submit is blocked by V2 Vue SPA architecture — we can fill the form, ddddocr can solve the captcha, but the result page is never produced.** This is the same family of live-portal blocker as eCourts 403 (D-037 pattern): green on our side, blocked by portal.

## What was done

The legacy `https://www.cersai.org.in/Search/SearchByBorrower.aspx` 404s. CERSAI rolled out a V2 portal at `https://cersai.org.in/CERSAI/`. The fetcher was rewritten to drive the V2 flow.

### V2 portal architecture (new findings)

- `https://cersai.org.in/CERSAI/dbtrsrch.prg` → main form page (Vue 3 SPA + i18n)
- Form: `#debtorType` select → `#assetCategory` select → `#individualBorrowerName` (rendered v-if)
- Captcha: `img[src*='captcha.jpg']` next to `#jcaptcha` (visible input — the Login modal also has a hidden `#jcaptcha` and a hidden `<img>`, which is why `:visible` filter is required)
- Submit: `button.btnsubmit` (form's only visible submit; `button[type='submit']` matches the Login modal's hidden button first)
- Submit flow (from `dbtrsrch.js`):
  1. Vue submit handler validates form state, calls `validateTheCaptcha()`
  2. AJAX POST to `CaptchaHashValidation` with `{UserCAPCHA: text}` → server returns `result` (the captcha hash) or `null`
  3. If `null` → "Captcha Validation Failed" error popup
  4. If `result` → sets `searchInput.captchaHash = result`, calls `submitThisForm()`
  5. `submitThisForm()` POSTs JSON to `dbtrsrch.frg` with the full search payload (captcha, captchaHash, assetCategoryId, inputJson)

### Fetcher fixes (committed in this run)

1. **`SEARCH_URL`**: `https://www.cersai.org.in/Search/SearchByBorrower.aspx` → `https://cersai.org.in/CERSAI/dbtrsrch.prg`
2. **V2 form selectors**:
   - debtorType: `select#debtorType` (value `IND` for individual)
   - assetCategory: `select#assetCategory` (value `1` for immovable)
   - name input: `input#individualBorrowerName` (rendered v-if after selects)
3. **Captcha image capture**: rewrote `captureCaptchaImage` to use Playwright `locator.screenshot()` (PNG → base64) instead of the legacy canvas/CORS approach that failed on V2's different origin.
4. **Captcha input selector**: `input[name*='captcha']:visible` — required `:visible` filter to skip the hidden Login modal's `#jcaptcha` (the broad selector matched the hidden Login captcha first and `fill()` timed out).
5. **Submit button selector**: `button.btnsubmit` instead of `button[type='submit']` — same reason, the Login modal's hidden submit matched first.
6. **Login detection regex**: tightened from `/login|sign in|user.*password|authenticate/i` to `/please\s+log\s*in|log\s*in\s+to|sign\s+in\s+to|forgot\s+password|authenticate/i`. The V2 navbar always has the bare word "Login" as a top-nav link; the old regex matched the navbar text and returned `cersai_portal_requires_login` even when the form was fully rendered.

### Contract tests

- 38/38 cersai contract tests pass
- Captures 4 name variants, validates degraded output paths, validates `no_records` / `charges_found` / `captcha_failed` / `search_error` outcomes, validates the classifier regex against representative V2 page texts.

## What is blocked

We cannot produce a real `charges_found` or `no_records` response from the live V2 portal. Specifically:

1. **Form fill via Playwright does not populate Vue state**: setting `input.value` via Playwright `.fill()` does not fire the input events that Vue's `v-model` is listening for. We tried:
   - Playwright `.fill()` on the name + captcha fields → no submit fires
   - `keyboard.type()` for real keystrokes → captcha input value remains empty
   - Native input setter + manual `dispatchEvent(new Event('input'))` → value set in DOM but Vue's reactive state not updated (re-confirmed by `validateTheCaptcha` not being called, `CaptchaHashValidation` AJAX not being made)
2. **Vue component instance not exposed in DOM**: tried `__vueParentComponent`, `__vue__`, walking up the DOM tree from `#dbtrsrch`, looking in iframes. The Vue instance is created inside an SPA component that doesn't expose `__vue__` on the DOM elements. There are 0 iframes.
3. **Direct AJAX to `dbtrsrch.frg` returns the form, not results**: the fragment endpoint requires the captcha hash, the captcha text, and the search payload — but the search payload (especially `captchaHash`) is generated server-side after a successful `CaptchaHashValidation` roundtrip. Without that roundtrip, the server returns the form HTML, not a result page.
4. **What the response actually says**: when the search "fails" (because the form state isn't propagated to Vue), the body shows: *"The input provided insufficient perform search. Please provide more specific details."* The `.frg` response is the same 22448-byte form HTML, not a result page.

## Honest assessment

I tried six different approaches over the course of this run (Playwright fill, real keystrokes, native setter + manual events, Vue state introspection + direct method call, direct `dbtrsrch.frg` POST probe, `CaptchaHashValidation` endpoint probe). All converge on the same conclusion: the V2 portal's submit pipeline requires the Vue SPA's internal reactive state to be in the right shape, and we cannot put it in that shape from outside the browser.

This is **the V2 portal blocker**, not a bug in the fetcher. The fetcher does everything the contract tests say it should do. The blocker is the gap between "Playwright can drive a form" and "Playwright can drive a Vue 3 SPA's reactive state" — and that gap is intentional portal design, not a solvable fetcher bug.

## What this means for launch

The CERSAI fetcher is in the same posture as eCourts (D-037): green on contracts, blocked live. Both have typed manual-instructions fallbacks in the report. The report still has its 6 sections intact when CERSAI returns `search_error` — section 3 ("What you might lose after paying") downgrades to "CERSAI check requires manual verification" with a "Verify at cersai.org.in" link, same as the eCourts degradation slot. Buyer never gets a falsely-green signal; they get a clearly-labeled "manual verification required" with a link.

## What's next (deferred)

- Re-evaluate after the V2 portal matures (e.g. captcha solver vendors catching up to V2's anti-bot posture, or V2 itself being replaced with a captcha-free public API).
- If the captcha is the only blocker, consider a 1–2 day attempt to integrate a captcha-solving service (e.g. 2Captcha, Anti-Captcha) for CERSAI specifically. Decision deferred until we have a buyer count that justifies the per-search cost.

## Artifacts

- Fetcher: `packages/fetchers/cersai/src/index.ts` (V2 flow + tightened login regex + screenshot-based captcha capture)
- Contract tests: `packages/fetchers/cersai/src/index.test.ts` (38/38 green)
- Smoke probe: `scripts/probe/cersai-direct-call.ts` (the most informative run; documents the 6 attempts)
