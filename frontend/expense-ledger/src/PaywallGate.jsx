import React, { useState } from "react";
import { supabase } from "./lib/supabaseClient.js";
import { useAuth } from "./lib/AuthProvider.jsx";
import { useSubscription } from "./lib/useSubscription.js";

export default function PaywallGate({ children }) {
  const { user, signOut } = useAuth();
  const { active, loading, status, refresh } = useSubscription();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  if (loading) {
    return (
      <div className="min-h-screen bg-[#14171C] flex items-center justify-center text-[#8A8F98] font-mono text-sm">
        Checking your subscription…
      </div>
    );
  }

  if (active) return children;

  const startCheckout = async () => {
    setError("");
    setStarting(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Could not start checkout.");
      window.location.href = body.url;
    } catch (err) {
      setError(err.message);
      setStarting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#14171C] text-[#EDE7D8] flex items-center justify-center px-6" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
      <div className="w-full max-w-md border border-[rgba(237,231,216,0.12)] bg-[#1A1D24] p-8 text-center">
        <p className="text-[10px] uppercase tracking-[0.25em] text-[#B8902E] mb-1">Digital Plug Co.</p>
        <h1 className="text-2xl font-semibold mb-3" style={{ fontFamily: "'Fraunces', serif" }}>
          Subscribe to continue
        </h1>
        <p className="text-sm text-[#8A8F98] mb-6">
          {status === "past_due"
            ? "Your last payment didn't go through. Update your billing to keep using the Finance Suite."
            : "Your account isn't on an active plan yet. Subscribe to unlock the Expense Ledger, Payroll App, and Income Ledger."}
        </p>

        {error && <p className="text-[#C97066] text-xs mb-4">{error}</p>}

        <button
          onClick={startCheckout}
          disabled={starting}
          className="w-full bg-[#B8902E] text-[#14171C] py-2.5 text-xs uppercase tracking-widest font-medium rounded-sm hover:bg-[#CBA544] transition-colors disabled:opacity-50 mb-3"
        >
          {starting ? "Redirecting…" : "Subscribe now"}
        </button>
        <button onClick={refresh} className="w-full text-xs uppercase tracking-widest text-[#8A8F98] hover:text-[#EDE7D8] py-2">
          I just subscribed — refresh status
        </button>
        <div className="mt-6 pt-6 border-t border-[rgba(237,231,216,0.12)] flex items-center justify-between text-xs text-[#8A8F98]">
          <span>{user?.email}</span>
          <button onClick={signOut} className="uppercase tracking-widest hover:text-[#EDE7D8]">
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
