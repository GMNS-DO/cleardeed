# ClearDeed FAQ (A.5.3)

> Top 10 buyer questions — for support and pre-launch testing.

---

## 1. Is this for real? Is your data accurate?

**Answer:** ClearDeed sources data directly from the official Odisha land records portal (Bhulekh), court records (eCourts), and 7 other government databases. We use no third-party sources.

Each report is verified against at least 2 sources (Bhulekh + IGR), with a clear "confidence level" in Section 2. Our ground-truth tests confirm >92% accuracy on Khordha district.

---

## 2. My plot number is not matching online. Why?

**Answer:** Odisha uses two numbering systems:

- **Plot number:** Official government parcel identifier
- **Khatiyan number:** Survey-based system used by local revenue offices

If your plot number isn't in our system, try:

1. Using the "Khatiyan" search mode instead
2. Including the tehsil and village for better matching
3. Checking spelling: sometimes official records have typos

---

## 3. Will you find previous owners of the property?

**Answer:** Section 2 shows the chain of ownership. For properties in Khordha district, we can trace:

- Recent owner changes (up to 10 years) in Bhulekh Back Page
- Encumbrance details from IGR (loans, mortgages, court cases)
- E-court cases involving the property

If the property hasn't been sold in 10 years, some entries may be missing.

---

## 4. How old is the data?

**Answer:** Most sources are near real-time (updates within 24-72 hours):

- Bhulekh: daily batch updates
- IGR: 7-10 day lag for encumbrance certificates
- eCourts: 14-21 day lag for new cases

We show the last-updated date in each section so you know exactly how recent the data is.

---

## 5. What do I do if your report shows a problem?

**Answer:** Different sections need different actions:

- **Section 1 (Ownership):** Contact a local lawyer immediately. A disputed chain of ownership means the sale is at risk.
- **Section 2 (Encumbrance):** Clarify with the owner if the loan or mortgage will be discharged at sale.
- **Section 3 (Legal Cases):** Ask the seller about pending litigation. If it involves the property, it must be disclosed and resolved before sale.

---

## 6. What if your report is missing data?

**Answer:** This can happen for two reasons:

1. **Data unavailable:** The government database doesn't have the record (common in rural areas)
2. **Processing delay:** Our fetchers are retrying (typical 24-48h)

In either case, we'll show a clear confidence level and manual verification instructions in the report. For high-value deals, consult a lawyer to supplement our report.

---

## 7. Why does the report cost ₹1?

**Answer:** We're offering a limited-time introductory price of ₹1 (instead of the standard ₹399) as a special promotion to gather user feedback and build our initial ground-truth corpus.

The price will increase to ₹399 once we've validated the product on 100+ real transactions.

---

## 8. How do I get my money back?

**Answer:** ClearDeed offers a 30-day money-back guarantee. If:

- The report does not contain data from Bhulekh, OR
- The data is demonstrably wrong (you have official evidence), OR
- The delivery failed entirely

Just email us at hello@cleardeed.in with your order number and evidence, and we'll refund your money.

---

## 9. Will you share my email with others?

**Answer:** No. Your email is used solely to deliver your report:

- One email with a report link (PDF in Google Drive)
- Optional reminder after 7 days if the link hasn't been opened
- We never share, sell, or use your email for marketing

Your data is deleted after 90 days per our DPDP policy.

---

## 10. Why does my report say "manual verification required"?

**Answer:** This happens when our AI can't fully parse the raw government documents. In these cases:

1. The key details are still included (owner name, plot number, legal status)
2. A lawyer needs to review the original documents
3. The confidence level is "medium" instead of "high"

You can proceed with the sale with this flag, but have a lawyer double-check the official records.
