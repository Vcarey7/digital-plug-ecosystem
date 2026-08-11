import React from "react";

const sectionCls = "space-y-3";
const h2Cls = "font-display text-xl font-semibold text-[#EDE7D8] mt-8 mb-2";
const pCls = "text-sm text-[#C7C2B4] leading-relaxed";

export default function TermsOfService({ onBack }) {
  return (
    <div className="min-h-screen bg-[#14171C] text-[#EDE7D8]" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
      <header className="border-b border-[rgba(237,231,216,0.12)] px-6 py-6 md:px-10">
        <div className="mx-auto max-w-3xl">
          <button onClick={onBack} className="text-xs uppercase tracking-widest text-[#B8902E] hover:text-[#CBA544]">
            ← Back
          </button>
          <p className="mt-3 text-[10px] uppercase tracking-[0.25em] text-[#B8902E]">Digital Plug Co.</p>
          <h1 className="font-display text-3xl font-semibold">Terms of Service</h1>
          <p className="mt-1 text-xs text-[#8A8F98]">Last updated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10 md:px-10">
        <div className="mb-8 border border-[#B8902E] bg-[#1A1D24] p-4 text-xs leading-relaxed text-[#B8902E]">
          <strong>Template notice:</strong> this is a starting-point Terms of Service, not legal advice. Have a
          lawyer review and adapt it — in particular the governing-law clause, liability limits, and refund
          policy below — before relying on it for a paid product.
        </div>

        <div className={sectionCls}>
          <p className={pCls}>
            These Terms of Service ("Terms") govern access to and use of the DPC Finance Suite (the "Service"),
            operated by Digital Plug Co. ("we," "us," "our"). By creating an account or subscribing, you agree to
            these Terms.
          </p>
        </div>

        <h2 className={h2Cls}>1. The Service</h2>
        <p className={pCls}>
          DPC Finance Suite provides expense tracking, payroll estimation, and self-employment income
          documentation tools. It organizes records you enter and performs calculations for planning purposes.
          It does not provide tax, legal, payroll filing, or financial advice, and does not guarantee approval of
          any loan, lease, or housing application. Verify anything submitted to a third party (landlord, lender,
          tax authority, payroll provider) independently.
        </p>

        <h2 className={h2Cls}>2. Accounts</h2>
        <p className={pCls}>
          You must provide accurate information when creating an account and are responsible for activity under
          your account and for keeping your password confidential. Notify us promptly of any unauthorized use.
        </p>

        <h2 className={h2Cls}>3. Subscriptions and billing</h2>
        <p className={pCls}>
          The Service is billed as a recurring subscription through Stripe, our payment processor. Subscriptions
          renew automatically each billing period until canceled. You can cancel anytime from the in-app billing
          portal; cancellation takes effect at the end of the current billing period, and{" "}
          <strong>[insert refund policy — e.g., "we do not provide refunds for partial billing periods" or
          "refunds are available within N days of a charge, contact support"]</strong>. We may change pricing
          with advance notice; continued use after a price change constitutes acceptance.
        </p>

        <h2 className={h2Cls}>4. Your data</h2>
        <p className={pCls}>
          You retain ownership of the financial and business records you enter into the Service. You're
          responsible for the accuracy of what you enter, particularly income documentation intended for housing
          or lending applications — the Service organizes and calculates but does not verify the underlying
          facts. See our <a href="#/privacy" className="text-[#B8902E] underline">Privacy Policy</a> for how we
          handle your data.
        </p>

        <h2 className={h2Cls}>5. Acceptable use</h2>
        <p className={pCls}>
          Don't use the Service to store or transmit unlawful content, misrepresent income or employment
          information for fraudulent purposes, attempt to breach its security, or resell access without our
          written consent.
        </p>

        <h2 className={h2Cls}>6. Disclaimers</h2>
        <p className={pCls}>
          The Service is provided "as is" without warranties of any kind, express or implied. We don't warrant
          that it will be uninterrupted, error-free, or that calculations (payroll withholding estimates,
          deduction percentages, income averages) are complete or suitable for any specific filing, application,
          or legal purpose.
        </p>

        <h2 className={h2Cls}>7. Limitation of liability</h2>
        <p className={pCls}>
          To the maximum extent permitted by law, Digital Plug Co. will not be liable for indirect, incidental,
          or consequential damages, or for any loss arising from decisions made based on data or calculations
          produced by the Service. <strong>[insert a liability cap appropriate to your jurisdiction and risk
          tolerance, e.g., "our total liability will not exceed the amount you paid us in the twelve months
          before the claim"]</strong>.
        </p>

        <h2 className={h2Cls}>8. Termination</h2>
        <p className={pCls}>
          You may stop using the Service and cancel your subscription at any time. We may suspend or terminate
          accounts that violate these Terms. Upon termination, your right to access the Service ends; we handle
          retained data as described in the Privacy Policy.
        </p>

        <h2 className={h2Cls}>9. Governing law</h2>
        <p className={pCls}>
          <strong>[insert your state/country of incorporation or operation]</strong> — these Terms are governed by
          the laws of that jurisdiction, without regard to conflict-of-law principles.
        </p>

        <h2 className={h2Cls}>10. Changes to these Terms</h2>
        <p className={pCls}>
          We may update these Terms from time to time. Material changes will be posted here with an updated
          "Last updated" date. Continued use of the Service after changes take effect constitutes acceptance.
        </p>

        <h2 className={h2Cls}>11. Contact</h2>
        <p className={pCls}>
          Questions about these Terms: <strong>[insert support/contact email]</strong>.
        </p>
      </main>
    </div>
  );
}
