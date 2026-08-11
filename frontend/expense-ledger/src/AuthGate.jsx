import React, { useState } from "react";
import { ReceiptText, Calculator, Clock, Check } from "lucide-react";
import { useAuth } from "./lib/AuthProvider.jsx";

const inputCls =
  "w-full bg-[#1D2129] border border-[#3A3F49] rounded-sm px-3 py-2 text-[#EDE7D8] placeholder-[#7A7F89] focus:outline-none focus:ring-1 focus:ring-[#B8902E] text-sm";
const labelCls = "block text-[10px] uppercase tracking-widest text-[#8A8F98] mb-1";

const FEATURES = [
  {
    icon: ReceiptText,
    title: "Expense Ledger",
    description: "Track deductions across every venture with per-category tax rules built in, receipt flags, and accountant-ready CSV exports.",
  },
  {
    icon: Calculator,
    title: "Payroll App",
    description: "Manage your roster, estimate net pay and employer cost from configurable withholding, and export payroll-ready records.",
  },
  {
    icon: Clock,
    title: "Income Ledger",
    description: "Log billable hours, build a clean proof-of-income packet for housing applications, and track your rent-readiness Shelter Score.",
  },
];

const INCLUDED = [
  "All three apps — Expense, Payroll, and Income Ledger",
  "Unlimited entries, ventures, and CSV exports",
  "Your data, synced securely to your account",
  "Cancel anytime from the in-app billing portal",
];

export default function AuthGate({ children }) {
  const { user, loading, signIn, signUp } = useAuth();
  const [mode, setMode] = useState("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  if (loading) {
    return (
      <div className="min-h-screen bg-[#14171C] flex items-center justify-center text-[#8A8F98] font-mono text-sm">
        Checking your session…
      </div>
    );
  }

  if (user) return children;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setNotice("");
    if (!email.trim() || password.length < 6) {
      setError("Enter an email and a password of at least 6 characters.");
      return;
    }
    if (mode === "sign-up" && !agreed) {
      setError("You need to agree to the Terms of Service and Privacy Policy to create an account.");
      return;
    }
    setSubmitting(true);
    const { error: authError } =
      mode === "sign-in" ? await signIn(email.trim(), password) : await signUp(email.trim(), password);
    setSubmitting(false);
    if (authError) {
      setError(authError.message);
      return;
    }
    if (mode === "sign-up") {
      setNotice("Check your email to confirm your account, then sign in.");
      setMode("sign-in");
    }
  };

  return (
    <div className="min-h-screen bg-[#14171C] text-[#EDE7D8]" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-12 px-6 py-16 md:px-10 lg:grid-cols-[1fr_420px] lg:items-start">
        {/* Marketing column */}
        <div>
          <p className="mb-2 text-[10px] uppercase tracking-[0.25em] text-[#B8902E]">Digital Plug Co.</p>
          <h1 className="font-display text-4xl font-semibold leading-tight md:text-5xl" style={{ fontFamily: "'Fraunces', serif" }}>
            Finance Suite
          </h1>
          <p className="mt-4 max-w-lg text-base text-[#C7C2B4] leading-relaxed">
            Expense tracking, payroll estimation, and self-employment income documentation — one subscription,
            built for people running more than one venture.
          </p>

          <div className="mt-10 space-y-6">
            {FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <div key={feature.title} className="flex gap-4">
                  <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-[#B8902E] text-[#B8902E]">
                    <Icon size={16} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-widest text-[#EDE7D8]">{feature.title}</p>
                    <p className="mt-1 text-sm text-[#8A8F98] leading-relaxed">{feature.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Auth + pricing column */}
        <div className="space-y-6">
          <div className="border border-[rgba(237,231,216,0.12)] bg-[#1A1D24] p-6">
            <div className="mb-6 flex items-end justify-between border-b border-[rgba(237,231,216,0.12)] pb-6">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-[#8A8F98]">Subscription</p>
                <p className="font-mono-fig mt-1 text-3xl text-[#EDE7D8]">
                  $15<span className="text-sm text-[#8A8F98]">/month</span>
                </p>
              </div>
            </div>
            <ul className="space-y-2">
              {INCLUDED.map((item) => (
                <li key={item} className="flex items-start gap-2 text-xs text-[#C7C2B4]">
                  <Check size={14} className="mt-0.5 flex-shrink-0 text-[#8FAF97]" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="border border-[rgba(237,231,216,0.12)] bg-[#1A1D24] p-6">
            <div className="flex mb-6 border border-[rgba(237,231,216,0.12)] rounded-sm overflow-hidden text-xs uppercase tracking-widest">
              <button
                type="button"
                onClick={() => setMode("sign-in")}
                className={`flex-1 py-2 ${mode === "sign-in" ? "bg-[#B8902E] text-[#14171C]" : "text-[#8A8F98]"}`}
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => setMode("sign-up")}
                className={`flex-1 py-2 ${mode === "sign-up" ? "bg-[#B8902E] text-[#14171C]" : "text-[#8A8F98]"}`}
              >
                Create account
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className={labelCls}>Email</label>
                <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="you@business.com" />
              </div>
              <div>
                <label className={labelCls}>Password</label>
                <input
                  type="password"
                  autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputCls}
                  placeholder="At least 6 characters"
                />
              </div>

              {mode === "sign-up" && (
                <label className="flex items-start gap-2 text-xs text-[#8A8F98]">
                  <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 accent-[#B8902E]" />
                  <span>
                    I agree to the <a href="#/terms" className="text-[#B8902E] underline">Terms of Service</a> and{" "}
                    <a href="#/privacy" className="text-[#B8902E] underline">Privacy Policy</a>.
                  </span>
                </label>
              )}

              {error && <p className="text-[#C97066] text-xs">{error}</p>}
              {notice && <p className="text-[#8FAF97] text-xs">{notice}</p>}

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-[#B8902E] text-[#14171C] py-2 text-xs uppercase tracking-widest font-medium rounded-sm hover:bg-[#CBA544] transition-colors disabled:opacity-50"
              >
                {submitting ? "Please wait…" : mode === "sign-in" ? "Sign in" : "Create account"}
              </button>
            </form>
          </div>

          <p className="text-center text-[10px] text-[#8A8F98]">
            <a href="#/terms" className="underline hover:text-[#EDE7D8]">Terms</a>
            {" · "}
            <a href="#/privacy" className="underline hover:text-[#EDE7D8]">Privacy</a>
          </p>
        </div>
      </main>
    </div>
  );
}
