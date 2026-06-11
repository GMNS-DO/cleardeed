export const metadata = {
  title: "Terms of Service — ClearDeed",
  description: "Terms governing your use of the ClearDeed property intelligence service.",
};

export default function TermsOfServicePage() {
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
            <h1 className="mt-1 text-3xl font-bold text-[#13251e]">Terms of Service</h1>
            <p className="mt-2 text-sm text-[#5b665f]">Last updated: 2026-05-14. Effective date: 2026-05-14.</p>
          </header>

          <div className="prose prose-sm max-w-none text-[#26362f]">
            <p className="text-base leading-7">
              These Terms of Service (&quot;Terms&quot;) govern your access to and use of the ClearDeed property
              intelligence service operated by ClearDeed (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;). By using our service, you agree
              to be bound by these Terms.
            </p>

            <h2 className="mt-6 text-lg font-bold">1. Acceptance of Terms</h2>
            <p className="mt-2 text-sm leading-6">
              By accessing or using ClearDeed, you confirm that you are 18 years of age or older and able to
              enter into a binding contract. If you do not agree to these Terms, do not use the service.
            </p>

            <h2 className="mt-6 text-lg font-bold">2. The Service — What It Is and Is Not</h2>

            <h3 className="mt-4 text-base font-semibold">2.1 What ClearDeed does</h3>
            <p className="mt-2 text-sm leading-6">
              ClearDeed fetches publicly available land records (Bhulekh RoR from bhulekh.ori.nic.in and other
              public government portals) and structures them into a plain-English property intelligence report.
              The report also includes insights derived from these records and a checklist of manual verification
              steps.
            </p>

            <h3 className="mt-4 text-base font-semibold">2.2 What ClearDeed does NOT do</h3>
            <p className="mt-2 text-sm leading-6">
              <strong>ClearDeed is not a lawyer, not a title insurance product, and not a fraud prevention tool.</strong>
              Specifically, ClearDeed does not:
            </p>
            <ul className="mt-2 list-inside space-y-1.5 text-sm leading-6">
              <li>Certify ownership of any property.</li>
              <li>Guarantee that a transaction is safe, legal, or risk-free.</li>
              <li>Replace the judgment of a qualified lawyer.</li>
              <li>Verify the authenticity of physical documents (sale deeds, agreements, PoAs).</li>
              <li>Detect all forms of fraud, impersonation, or forgery.</li>
              <li>Provide title insurance or financial guarantees.</li>
            </ul>

            <h2 className="mt-6 text-lg font-bold">3. Reports Are Information, Not Legal Opinions</h2>
            <p className="mt-2 text-sm leading-6">
              Every ClearDeed report carries the following notice on the first page:
            </p>
            <blockquote className="my-4 rounded border-l-4 border-[#8a5f1d] bg-[#f7f7f2] px-4 py-3 text-sm italic text-[#5b665f]">
              &quot;ClearDeed surfaces and structures public land records. It does not certify ownership, guarantee
              the absence of fraud, or recommend any transaction. Every report should be reviewed by a
              qualified lawyer before you sign any agreement or pay any money. This report is not a legal opinion.&quot;
            </blockquote>
            <p className="mt-2 text-sm leading-6">
              This notice cannot be removed, altered, or obscured in any report shared or delivered to third parties.
            </p>

            <h2 className="mt-6 text-lg font-bold">4. Fees and Payment</h2>
            <ul className="mt-2 list-inside space-y-1.5 text-sm leading-6">
              <li><strong>Standard report:</strong> ₹1 (launch testing price; will change to ₹999 when conversion is proven). Prices are subject to change with 30 days' notice.</li>
              <li>Payment is processed by Razorpay. ClearDeed does not store your payment card details.</li>
              <li>After successful payment, the report is shown in the browser and a copy is sent to the email address you provide.</li>
              <li>Reports are non-refundable once delivered, unless the report contains a material factual error attributable to ClearDeed's processing (not the underlying government records).</li>
              <li>Report refresh within 60 days of original purchase: ₹299 (when this feature is available).</li>
            </ul>

            <h2 className="mt-6 text-lg font-bold">5. Report Validity and Limitations</h2>
            <ul className="mt-2 list-inside space-y-1.5 text-sm leading-6">
              <li>Reports are valid for 60 days from generation. Government records change — a report older than 60 days should not be used as the sole basis for a transaction decision.</li>
              <li>Reports may show incomplete data when government portals are slow, unavailable, or return partial results. In such cases, the report will indicate which sources are incomplete and what manual verification is required.</li>
              <li>ClearDeed is not responsible for outcomes when buyers proceed with a transaction without completing the manual verification steps listed in the report.</li>
            </ul>

            <h2 className="mt-6 text-lg font-bold">6. Data Accuracy</h2>
            <p className="mt-2 text-sm leading-6">
              ClearDeed fetches data from government portals and publicly available sources. We make reasonable
              efforts to accurately parse and present this data. However, we do not warrant that any data
              fetched from government portals is complete, accurate, or current. The original government
              record is always the authoritative source.
            </p>
            <p className="mt-2 text-sm leading-6">
              If you believe any data in your report is inaccurate due to a ClearDeed processing error, contact
              us at <a href="mailto:support@cleardeed.in" className="text-[#1d6f5b]">support@cleardeed.in</a>. We will
              investigate and, where appropriate, issue a corrected report.
            </p>

            <h2 className="mt-6 text-lg font-bold">7. User Obligations</h2>
            <ul className="mt-2 list-inside space-y-1.5 text-sm leading-6">
              <li>You must use ClearDeed for lawful purposes only.</li>
              <li>You must not attempt to reverse-engineer, copy, or republish the report output for commercial resale.</li>
              <li>You must not use automated tools to mass-generate reports without our written consent.</li>
              <li>You must not misrepresent the ClearDeed report as a legal opinion, government certificate, or title guarantee.</li>
            </ul>

            <h2 className="mt-6 text-lg font-bold">8. Limitation of Liability</h2>
            <p className="mt-2 text-sm leading-6">
              To the maximum extent permitted by law, ClearDeed and its founder are not liable for any direct,
              indirect, incidental, special, consequential, or punitive damages — including but not limited to
              loss of money, loss of property, or legal costs — arising from:
            </p>
            <ul className="mt-2 list-inside space-y-1.5 text-sm leading-6">
              <li>Any decision to buy, sell, or not transact on a property based on a ClearDeed report.</li>
              <li>Errors or omissions in government land records fetched by ClearDeed.</li>
              <li>Any fraud, impersonation, or misrepresentation by sellers, brokers, or third parties.</li>
              <li>Any manual verification step not completed by the buyer.</li>
              <li>Changes in government records after a report is generated.</li>
            </ul>
            <p className="mt-2 text-sm leading-6">
              The maximum aggregate liability of ClearDeed for any claim arising from use of the service shall
              not exceed the amount you paid for the specific report giving rise to the claim.
            </p>

            <h2 className="mt-6 text-lg font-bold">9. Intellectual Property</h2>
            <p className="mt-2 text-sm leading-6">
              The ClearDeed report layout, report content structure, and service branding are the intellectual
              property of ClearDeed. You may share your report with your lawyer, family members, and financial
              advisors for personal use. Commercial resale, republication, or incorporation into third-party
              products is prohibited without written consent.
            </p>
            <p className="mt-2 text-sm leading-6">
              Bhulekh RoR data and other government records are in the public domain. ClearDeed's presentation
              of that data is proprietary; the underlying data belongs to the Government of Odisha.
            </p>

            <h2 className="mt-6 text-lg font-bold">10. Governing Law and Dispute Resolution</h2>
            <p className="mt-2 text-sm leading-6">
              These Terms are governed by the laws of India. Any dispute arising from these Terms shall be
              subject to the exclusive jurisdiction of the courts in Bhubaneswar, Odisha.
              Before initiating any legal action, you agree to contact us and give us 30 days to attempt
              resolution.
            </p>

            <h2 className="mt-6 text-lg font-bold">11. Changes to These Terms</h2>
            <p className="mt-2 text-sm leading-6">
              We may modify these Terms at any time. Material changes will be communicated by email to
              registered users and posted on this page. Your continued use of ClearDeed after any change
              constitutes acceptance of the updated Terms.
            </p>

            <h2 className="mt-6 text-lg font-bold">12. Contact</h2>
            <div className="mt-3 rounded border border-[#e8efe9] bg-[#f7f7f2] p-4 text-sm leading-6">
              <p>For questions about these Terms, contact:</p>
              <p>Email: <a href="mailto:support@cleardeed.in" className="text-[#1d6f5b]">support@cleardeed.in</a></p>
              <p>ClearDeed · Bhubaneswar, Odisha · India</p>
            </div>
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
