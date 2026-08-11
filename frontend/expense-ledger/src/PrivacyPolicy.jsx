import React from "react";

const sectionCls = "space-y-3";
const h2Cls = "font-display text-xl font-semibold text-[#EDE7D8] mt-8 mb-2";
const pCls = "text-sm text-[#C7C2B4] leading-relaxed";
const liCls = "text-sm text-[#C7C2B4] leading-relaxed ml-5 list-disc";

export default function PrivacyPolicy({ onBack }) {
  return (
    <div className="min-h-screen bg-[#14171C] text-[#EDE7D8]" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
      <header className="border-b border-[rgba(237,231,216,0.12)] px-6 py-6 md:px-10">
        <div className="mx-auto max-w-3xl">
          <button onClick={onBack} className="text-xs uppercase tracking-widest text-[#B8902E] hover:text-[#CBA544]">
            ← Back
          </button>
          <p className="mt-3 text-[10px] uppercase tracking-[0.25em] text-[#B8902E]">Digital Plug Co.</p>
          <h1 className="font-display text-3xl font-semibold">Privacy Policy</h1>
          <p className="mt-1 text-xs text-[#8A8F98]">Last updated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10 md:px-10">
        <div className="mb-8 border border-[#B8902E] bg-[#1A1D24] p-4 text-xs leading-relaxed text-[#B8902E]">
          <strong>Template notice:</strong> this is a starting-point Privacy Policy, not legal advice. Have a
          lawyer review it before relying on it — especially if you'll have users in the EU/UK (GDPR), California
          (CCPA), or other jurisdictions with specific disclosure requirements.
        </div>

        <div className={sectionCls}>
          <p className={pCls}>
            This Privacy Policy explains what information Digital Plug Co. ("we," "us") collects through the DPC
            Finance Suite (the "Service"), how we use it, and the choices you have.
          </p>
        </div>

        <h2 className={h2Cls}>1. What we collect</h2>
        <ul className="space-y-2">
          <li className={liCls}><strong>Account data:</strong> the email address and password you sign up with (password is hashed by our authentication provider, Supabase — we never see it in plain text).</li>
          <li className={liCls}><strong>Content you enter:</strong> business expenses, venture/category labels, payroll roster and pay-run details, and income-documentation entries, including any name, business name, email, phone, or rent-target figures you add to your document profile.</li>
          <li className={liCls}><strong>Billing data:</strong> handled entirely by Stripe, our payment processor — we receive your subscription status and billing history, but Stripe (not us) stores your card details.</li>
          <li className={liCls}><strong>Basic technical data:</strong> standard web server logs (IP address, browser type, timestamps) collected by our hosting provider, Vercel.</li>
        </ul>

        <h2 className={h2Cls}>2. How we use it</h2>
        <ul className="space-y-2">
          <li className={liCls}>To provide the Service — storing and displaying the records you enter, calculating totals/deductions/payroll/income summaries, and generating your CSV exports and printable income ledger.</li>
          <li className={liCls}>To manage your subscription and billing through Stripe.</li>
          <li className={liCls}>To authenticate you and keep your account secure.</li>
          <li className={liCls}>To communicate service-related notices (billing issues, security notices, changes to these policies).</li>
        </ul>
        <p className={pCls}>We do not sell your data, and we do not use the financial records you enter for advertising.</p>

        <h2 className={h2Cls}>3. Where your data lives</h2>
        <p className={pCls}>
          Your content is stored in a Postgres database hosted by Supabase, scoped to your account with
          row-level security so other users cannot read or write your rows. The application itself is hosted on
          Vercel. Payment information is processed and stored by Stripe. <strong>[insert data region/location if
          relevant to your users, e.g. "data is hosted in the United States"]</strong>.
        </p>

        <h2 className={h2Cls}>4. Third parties we use</h2>
        <ul className="space-y-2">
          <li className={liCls}><strong>Supabase</strong> — authentication and database hosting.</li>
          <li className={liCls}><strong>Stripe</strong> — payment processing and subscription billing.</li>
          <li className={liCls}><strong>Vercel</strong> — application hosting.</li>
        </ul>
        <p className={pCls}>Each processes data under its own privacy policy and applicable data-processing agreements.</p>

        <h2 className={h2Cls}>5. Your rights</h2>
        <p className={pCls}>
          You can access, edit, or delete the records you've entered directly within the Service at any time.
          To request full account deletion (including your login and any retained billing history we control),
          contact us at <strong>[insert support/contact email]</strong>. We'll respond within a reasonable
          time and delete or anonymize your data except where we're required to retain it (e.g., billing records
          for tax purposes).
        </p>

        <h2 className={h2Cls}>6. Data retention</h2>
        <p className={pCls}>
          We retain your account and content for as long as your account is active. If you cancel your
          subscription, your data remains accessible if you sign back in, unless you request deletion.
          <strong> [insert your actual retention window if you plan to auto-delete inactive accounts]</strong>.
        </p>

        <h2 className={h2Cls}>7. Cookies</h2>
        <p className={pCls}>
          We use only the minimum needed to keep you signed in (an authentication session, set by Supabase Auth).
          We don't use advertising or third-party tracking cookies.
        </p>

        <h2 className={h2Cls}>8. Children's privacy</h2>
        <p className={pCls}>The Service is intended for business use by adults and is not directed to children under 18.</p>

        <h2 className={h2Cls}>9. Changes to this policy</h2>
        <p className={pCls}>
          We may update this Privacy Policy from time to time. Material changes will be posted here with an
          updated "Last updated" date.
        </p>

        <h2 className={h2Cls}>10. Contact</h2>
        <p className={pCls}>
          Questions about this policy or your data: <strong>[insert support/contact email]</strong>.
        </p>
      </main>
    </div>
  );
}
