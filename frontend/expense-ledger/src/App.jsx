import React, { useEffect, useState } from "react";
import { Calculator, Clock, CreditCard, LogOut, ReceiptText } from "lucide-react";
import ExpenseTracker from "./ExpenseTracker.jsx";
import IncomeLedger from "./IncomeLedger.jsx";
import PayrollTracker from "./PayrollTracker.jsx";
import { useAuth } from "./lib/AuthProvider.jsx";
import { supabase } from "./lib/supabaseClient.js";

const APPS = [
  {
    id: "expenses",
    label: "Expense Ledger",
    description: "Deductions, receipts, and CSV exports",
    icon: ReceiptText,
  },
  {
    id: "payroll",
    label: "Payroll App",
    description: "Employees, pay runs, net pay, and employer cost",
    icon: Calculator,
  },
  {
    id: "income",
    label: "Income Ledger",
    description: "Billable hours and housing proof packet",
    icon: Clock,
  },
];

function getInitialApp() {
  const hash = window.location.hash.replace("#", "");
  if (APPS.some((app) => app.id === hash)) return hash;
  try {
    const stored = localStorage.getItem("dpcFinanceSuiteActiveApp");
    return APPS.some((app) => app.id === stored) ? stored : "income";
  } catch (e) {
    return "income";
  }
}

export default function App() {
  const [activeApp, setActiveApp] = useState(getInitialApp);
  const { user, signOut } = useAuth();
  const [openingBilling, setOpeningBilling] = useState(false);

  const openBillingPortal = async () => {
    setOpeningBilling(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch("/api/create-portal-session", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Could not open billing portal.");
      window.location.href = body.url;
    } catch (e) {
      console.error(e);
      setOpeningBilling(false);
    }
  };

  useEffect(() => {
    const onHashChange = () => {
      const hash = window.location.hash.replace("#", "");
      if (APPS.some((app) => app.id === hash)) setActiveApp(hash);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const switchApp = (id) => {
    setActiveApp(id);
    try {
      localStorage.setItem("dpcFinanceSuiteActiveApp", id);
    } catch (e) {
      /* navigation still works without localStorage */
    }
    window.location.hash = id;
  };

  return (
    <div className="min-h-screen bg-[#14171C] text-[#EDE7D8]">
      <nav className="sticky top-0 z-40 border-b border-[rgba(237,231,216,0.12)] bg-[#111419]/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-3 md:flex-row md:items-center md:justify-between md:px-10">
          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-[#B8902E]">Digital Plug Co.</p>
            <p className="font-display text-lg font-semibold">Finance Suite</p>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {APPS.map((app) => {
              const Icon = app.icon;
              const selected = activeApp === app.id;
              return (
                <button
                  key={app.id}
                  onClick={() => switchApp(app.id)}
                  className={`flex items-center gap-3 rounded-sm border px-4 py-2 text-left transition-colors ${
                    selected
                      ? "border-[#B8902E] bg-[#B8902E] text-[#14171C]"
                      : "border-[#2A2E36] bg-[#1A1D24] text-[#C7C2B4] hover:border-[#B8902E] hover:text-[#EDE7D8]"
                  }`}
                  aria-pressed={selected}
                >
                  <Icon size={18} />
                  <span>
                    <span className="block text-xs font-semibold uppercase tracking-widest">{app.label}</span>
                    <span className={`block text-[10px] ${selected ? "text-[#3C2F10]" : "text-[#8A8F98]"}`}>{app.description}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <div className="flex items-center justify-end gap-4 text-xs text-[#8A8F98]">
            <span className="hidden sm:inline">{user?.email}</span>
            <button
              onClick={openBillingPortal}
              disabled={openingBilling}
              className="flex items-center gap-1.5 uppercase tracking-widest hover:text-[#EDE7D8] disabled:opacity-50"
            >
              <CreditCard size={14} /> Billing
            </button>
            <button onClick={signOut} className="flex items-center gap-1.5 uppercase tracking-widest hover:text-[#EDE7D8]">
              <LogOut size={14} /> Sign out
            </button>
          </div>
        </div>
      </nav>

      {activeApp === "expenses" && <ExpenseTracker />}
      {activeApp === "payroll" && <PayrollTracker />}
      {activeApp === "income" && <IncomeLedger />}
    </div>
  );
}
