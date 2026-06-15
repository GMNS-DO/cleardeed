export const metadata = {
  title: "Privacy Policy — ClearDeed",
  description: "How ClearDeed collects, uses, and protects your data. DPDP Act compliant.",
};

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-[#f7f7f2] px-5 py-8 text-[#17231d] md:px-8">
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <a href="/" className="text-xl font-bold text-[#163d33]">ClearDeed</a>
          <a href="/" className="text-sm text-[#1d6f5b]">← Back to site</a>
        </div>

        <article className="rounded border border-[#d9ddd4] bg-white p-6 md:p-8">
          <header className="mb-6 border-b border-[#d9ddd4] pb-6">
            <p className="text-sm font-semibold uppercase tracking-normal text-[#8a5f1d]">Legal</p>
            <h1 className="mt-1 text-3xl font-bold text-[#13251e]">Privacy Policy</h1>
            <p className="mt-2 text-sm text-[#5b665f]">Last updated: 2026-05-14. Effective date: 2026-05-14.</p>
          </header>

          <div className="prose prose-sm max-w-none text-[#26362f]">
            <p className="text-base leading-7">
              ClearDeed (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) operates the website <strong>cleardeed.in</strong> and the ClearDeed
              property intelligence service. This Privacy Policy explains how we collect, use, disclose, and
              safeguard your information when you use our service.
            </p>

            <h2 className="mt-6 text-lg font-bold">1. Information We Collect</h2>

            <h3 className="mt-4 text-base font-semibold">1.1 Information you provide directly</h3>
            <ul className="mt-2 list-inside space-y-1.5 text-sm leading-6">
              <li><strong>Plot identification:</strong> District, tehsil, village, plot number, or khatiyan number you enter to generate a report.</li>
              <li><strong>Contact details:</strong> Name, phone number, and email address if you request a report or contact us.</li>
              <li><strong>Seller name:</strong> Name of the claimed property owner (optional), provided for owner-match verification only.</li>
              <li><strong>Payment information:</strong> Handled entirely by Razorpay. ClearDeed does not store or process your payment card details.</li>
            </ul>

            <h3 className="mt-4 text-base font-semibold">1.2 Information from public records</h3>
            <ul className="mt-2 list-inside space-y-1.5 text-sm leading-6">
              <li><strong>Bhulekh RoR data:</strong> We fetch publicly available revenue records from bhulekh.ori.nic.in (Government of Odisha). These records are public land records and are not personal data under DPDP Act.</li>
              <li><strong>Court records:</strong> If you purchase a full report, we may query eCourts India (services.ecourts.gov.in) for pending litigation on the claimed owner name.</li>
              <li><strong>Encumbrance data:</strong> The Encumbrance Certificate is obtained via manual fulfillment from the Sub-Registrar Office and is not stored in our systems beyond the report delivery period.</li>
            </ul>

            <h2 className="mt-6 text-lg font-bold">2. How We Use Your Information</h2>
            <ul className="mt-2 list-inside space-y-1.5 text-sm leading-6">
              <li>To generate and deliver your property intelligence report.</li>
              <li>To improve our service and the accuracy of our fraud detection rules.</li>
              <li>To respond to your support requests.</li>
              <li>To send you your report, follow-up communications, and post-purchase surveys (you can opt out at any time).</li>
              <li><strong>We do not sell your personal data to third parties.</strong></li>
            </ul>

            <h2 className="mt-6 text-lg font-bold">3. Data Retention</h2>
            <p className="mt-2 text-sm leading-6">
              Reports and feedback are retained for <strong>60 days</strong> from generation (the report-validity window for refresh decisions).
              Lead requests are retained for <strong>12 months</strong> for fraud-pattern analysis.
              After these periods, or upon a deletion request, records are removed within <strong>30 days</strong>.
              You may request deletion of your data at any time by contacting us (see Section 10) or by submitting
              a deletion request via <code className="rounded bg-[#f7f7f2] px-1.5 py-0.5">POST /api/user/delete</code> with your phone number.
            </p>

            <h2 className="mt-6 text-lg font-bold">4. Data Sharing</h2>
            <p className="mt-2 text-sm leading-6">
              We do not share your personal information with third parties except:
            </p>
            <ul className="mt-2 list-inside space-y-1.5 text-sm leading-6">
              <li><strong>Razorpay:</strong> For payment processing only. Their privacy policy applies.</li>
              <li><strong>Resend:</strong> For transactional email delivery only. Their privacy policy applies.</li>
              <li><strong>Legal obligation:</strong> If required by law, court order, or government authority.</li>
            </ul>

            <h2 className="mt-6 text-lg font-bold">5. Data Security</h2>
            <p className="mt-2 text-sm leading-6">
              Report data is stored in Supabase (PostgreSQL database) with access controls.
              All data in transit is encrypted (TLS). Report URLs use unique, unguessable tokens.
              We do not guarantee absolute security; we implement industry-standard measures appropriate for a bootstrapped service.
            </p>

            <h2 className="mt-6 text-lg font-bold">6. Your Rights (DPDP Act)</h2>
            <p className="mt-2 text-sm leading-6">Under the Digital Personal Data Protection Act, 2023 (DPDP Act), you have the right to:</p>
            <ul className="mt-2 list-inside space-y-1.5 text-sm leading-6">
              <li><strong>Access:</strong> Request a copy of the personal data we hold about you.</li>
              <li><strong>Correction:</strong> Request correction of inaccurate personal data.</li>
              <li><strong>Deletion:</strong> Request deletion of your personal data (&quot;right to be forgotten&quot;).</li>
              <li><strong>Portability:</strong> Request your data in a machine-readable format.</li>
              <li><strong>Consent withdrawal:</strong> Withdraw consent for data processing at any time.</li>
              <li><strong>Grievance redressal:</strong> File a complaint if you believe your data rights have been violated.</li>
            </ul>

            <h2 className="mt-6 text-lg font-bold">7. Cookies and Tracking</h2>
            <p className="mt-2 text-sm leading-6">
              ClearDeed uses minimal cookies — only for essential session management and basic analytics
              (page views, report generation events). We do not use advertising cookies or third-party tracking.
            </p>

            <h2 className="mt-6 text-lg font-bold">8. Children's Data</h2>
            <p className="mt-2 text-sm leading-6">
              ClearDeed is not intended for use by persons under 18 years of age. We do not knowingly collect
              personal data from children.
            </p>

            <h2 className="mt-6 text-lg font-bold">9. Changes to This Policy</h2>
            <p className="mt-2 text-sm leading-6">
              We may update this Privacy Policy from time to time. Changes will be posted on this page with an
              updated &quot;Last updated&quot; date. For material changes, we will notify you by email or by posting a
              notice on the website.
            </p>

            <h2 className="mt-6 text-lg font-bold">10. Contact Us / Grievance Redressal</h2>
            <div className="mt-3 rounded border border-[#e8efe9] bg-[#f7f7f2] p-4 text-sm leading-6">
              <p><strong>Designated Data Protection Officer (DPO):</strong></p>
              <p>Founder, ClearDeed</p>
              <p>Email: <a href="mailto:privacy@cleardeed.in" className="text-[#1d6f5b]">privacy@cleardeed.in</a></p>
              <p className="mt-2 text-xs text-[#5b665f]">
                Under DPDP Act, you may also file complaints with the Data Protection Board of India
                (www.dpbi.gov.in) if you are not satisfied with our response within 30 days.
              </p>
            </div>

            <h2 className="mt-6 text-lg font-bold">11. Disclaimer on Public Records</h2>
            <p className="mt-2 text-sm leading-6">
              Bhulekh RoR records fetched by ClearDeed are publicly available government records under the
              Right to Information Act, 2005. We are a consumer-facing interface for accessing these records.
              We do not modify, create, or certify these records. The original Bhulekh records remain the
              authoritative source.
            </p>
          </div>
        </article>

        {/* Footer */}
        <footer className="mt-8 flex flex-wrap gap-4 text-sm text-[#5b665f]">
          <a href="/privacy" className="text-[#1d6f5b]">Privacy Policy</a>
          <span>·</span>
          <a href="/terms" className="text-[#1d6f5b]">Terms of Service</a>
          <span>·</span>
          <span>© 2026 ClearDeed</span>
        </footer>
      </div>
    </main>
  );
}