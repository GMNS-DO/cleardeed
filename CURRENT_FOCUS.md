# CURRENT_FOCUS.md

> **One page. Updated daily. Delete completed items rather than marking them done.**
> If this file is longer than what fits on one screen without scrolling, you are using it wrong.
> Today is the only thing that matters.
> **Implementation sprints only. Commercial activities begin after PI 3. See `COMMERCIAL_TRACK.md`.**

---

## This week's user behavior (the only thing that ships)

**Sprint 1 — Week 1–2**

> **A buyer in Khordha can pay ₹1 and receive a report by email within 10 minutes. No manual intervention, no concierge, no review queue.**

If a task does not contribute to that sentence shipping, it does not happen this week.

---

## Tasks remaining this sprint

(Delete as completed. Do not strikethrough. Just delete.)

- [ ] Resend email delivery with PDF attachment — needs RESEND_API_KEY
- [ ] Free preview endpoint — Bhulekh lookup, masked owner name, Kisam, map pin
- [ ] Token-scoped persistent report URL — works, shareable
- [ ] Server-rendered PDF from the same HTML as web report
- [ ] Privacy Policy + Terms of Service pages live
- [ ] In-report thumbs up/down feedback per section
- [ ] Reports auto-send on generation — no review gate
- [ ] Razorpay checkout at ₹1 — pay before report generation

---

## Blockers

(If empty, you're unblocked.)

- Need RESEND_API_KEY for email delivery
- Vercel password protection — site returns 401 to all visitors

---

## This week's execution only

(Implementation only. Commercial activities in `COMMERCIAL_TRACK.md`.)

- [ ] Disable Vercel password protection
- [ ] Add RESEND_API_KEY to Vercel env vars
- [ ] Add RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET to Vercel env vars
- [ ] Test end-to-end: free preview → pay ₹1 → report email delivered → feedback captured

---

## Friday retrospective

**Did the product infrastructure ship?**
- If yes → continue Monday with Sprint 2.
- If no → Monday is product work.

---

*Last touched: 2026-05-15*