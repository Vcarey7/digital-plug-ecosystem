import React, { useState } from "react";
import { useAuth } from "./lib/AuthProvider.jsx";

const inputCls =
  "w-full bg-[#1D2129] border border-[#3A3F49] rounded-sm px-3 py-2 text-[#EDE7D8] placeholder-[#7A7F89] focus:outline-none focus:ring-1 focus:ring-[#B8902E] text-sm";
const labelCls = "block text-[10px] uppercase tracking-widest text-[#8A8F98] mb-1";

export default function AuthGate({ children }) {
  const { user, loading, signIn, signUp } = useAuth();
  const [mode, setMode] = useState("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
    <div className="min-h-screen bg-[#14171C] text-[#EDE7D8] flex items-center justify-center px-6" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="text-[10px] uppercase tracking-[0.25em] text-[#B8902E] mb-1">Digital Plug Co.</p>
          <h1 className="text-3xl font-semibold" style={{ fontFamily: "'Fraunces', serif" }}>
            Finance Suite
          </h1>
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
      </div>
    </div>
  );
}
