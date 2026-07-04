import React, { useState, useEffect, useMemo } from "react";
import { Plus, Trash2, Download, Search, Receipt, X, Pencil, ChevronDown } from "lucide-react";

const CATEGORIES = [
  { name: "Advertising & Marketing", pct: 100 },
  { name: "Car & Mileage", pct: 100 },
  { name: "Contract Labor / Freelancers", pct: 100 },
  { name: "Legal & Professional Fees", pct: 100 },
  { name: "Office Supplies", pct: 100 },
  { name: "Rent & Lease", pct: 100 },
  { name: "Software & Subscriptions", pct: 100 },
  { name: "Travel", pct: 100 },
  { name: "Meals & Entertainment", pct: 50 },
  { name: "Utilities & Phone", pct: 100 },
  { name: "Education & Training", pct: 100 },
  { name: "Insurance", pct: 100 },
  { name: "Bank & Merchant Fees", pct: 100 },
  { name: "Equipment", pct: 100 },
  { name: "Other", pct: 100 },
];

const DEFAULT_VENTURES = [
  "Digital Plug Co.",
  "Digital Business Academy",
  "NerdTV",
  "Project Refuge",
  "Carey Maison",
  "Sovereign Sounds",
  "FreshStart Holdings",
  "Settle & Sip",
  "Personal / Other",
];

const emptyForm = {
  date: new Date().toISOString().slice(0, 10),
  vendor: "",
  description: "",
  venture: DEFAULT_VENTURES[0],
  category: CATEGORIES[0].name,
  amount: "",
  pct: CATEGORIES[0].pct,
  receipt: false,
  notes: "",
};

function currency(n) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function initials(str) {
  return str
    .replace(/[^\w\s&]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export default function ExpenseTracker() {
  const [expenses, setExpenses] = useState([]);
  const [ventures, setVentures] = useState(DEFAULT_VENTURES);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [filterVenture, setFilterVenture] = useState("All");
  const [filterCategory, setFilterCategory] = useState("All");
  const [filterPeriod, setFilterPeriod] = useState("All");
  const [search, setSearch] = useState("");
  const [newVenture, setNewVenture] = useState("");
  const [showVentureAdd, setShowVentureAdd] = useState(false);
  const [error, setError] = useState("");

  // Load persisted data
  useEffect(() => {
    try {
      const ex = localStorage.getItem("expenses");
      if (ex) setExpenses(JSON.parse(ex));
    } catch (e) {
      /* no existing data */
    }
    try {
      const v = localStorage.getItem("ventures");
      if (v) setVentures(JSON.parse(v));
    } catch (e) {
      /* no existing data */
    }
    setLoaded(true);
  }, []);

  const persistExpenses = (next) => {
    setExpenses(next);
    setSaving(true);
    try {
      localStorage.setItem("expenses", JSON.stringify(next));
      setError("");
    } catch (e) {
      setError("Couldn't save — try again.");
    }
    setSaving(false);
  };

  const persistVentures = (next) => {
    setVentures(next);
    try {
      localStorage.setItem("ventures", JSON.stringify(next));
    } catch (e) {
      setError("Couldn't save the venture list.");
    }
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
  };

  const handleCategoryChange = (name) => {
    const cat = CATEGORIES.find((c) => c.name === name);
    setForm((f) => ({ ...f, category: name, pct: cat ? cat.pct : 100 }));
  };

  const handleSubmit = () => {
    const amt = parseFloat(form.amount);
    if (!form.vendor.trim() || isNaN(amt) || amt <= 0) {
      setError("Enter a vendor and a valid amount.");
      return;
    }
    setError("");
    const record = { ...form, amount: amt, pct: Number(form.pct) || 0 };
    if (editingId) {
      persistExpenses(expenses.map((e) => (e.id === editingId ? { ...record, id: editingId } : e)));
    } else {
      persistExpenses([{ ...record, id: crypto.randomUUID() }, ...expenses]);
    }
    resetForm();
  };

  const handleEdit = (exp) => {
    setForm({ ...exp, amount: String(exp.amount) });
    setEditingId(exp.id);
    setShowForm(true);
  };

  const handleDelete = (id) => {
    persistExpenses(expenses.filter((e) => e.id !== id));
  };

  const addVenture = () => {
    const v = newVenture.trim();
    if (v && !ventures.includes(v)) {
      persistVentures([...ventures, v]);
    }
    setNewVenture("");
    setShowVentureAdd(false);
  };

  const now = new Date();
  const filtered = useMemo(() => {
    return expenses
      .filter((e) => filterVenture === "All" || e.venture === filterVenture)
      .filter((e) => filterCategory === "All" || e.category === filterCategory)
      .filter((e) => {
        if (filterPeriod === "All") return true;
        const d = new Date(e.date);
        if (filterPeriod === "This Month")
          return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        if (filterPeriod === "This Year") return d.getFullYear() === now.getFullYear();
        if (filterPeriod === "Last Year") return d.getFullYear() === now.getFullYear() - 1;
        return true;
      })
      .filter((e) => {
        const q = search.toLowerCase();
        if (!q) return true;
        return (
          e.vendor.toLowerCase().includes(q) ||
          e.description.toLowerCase().includes(q) ||
          e.notes.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [expenses, filterVenture, filterCategory, filterPeriod, search]);

  const totals = useMemo(() => {
    const total = filtered.reduce((s, e) => s + e.amount, 0);
    const deductible = filtered.reduce((s, e) => s + (e.amount * e.pct) / 100, 0);
    const noReceipt = filtered.filter((e) => !e.receipt).length;
    return { total, deductible, count: filtered.length, noReceipt };
  }, [filtered]);

  const byCategory = useMemo(() => {
    const map = {};
    filtered.forEach((e) => {
      map[e.category] = (map[e.category] || 0) + (e.amount * e.pct) / 100;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  const byVenture = useMemo(() => {
    const map = {};
    filtered.forEach((e) => {
      map[e.venture] = (map[e.venture] || 0) + (e.amount * e.pct) / 100;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  const maxCat = byCategory.length ? byCategory[0][1] : 1;
  const maxVent = byVenture.length ? byVenture[0][1] : 1;

  const exportCSV = () => {
    const header = [
      "Date",
      "Vendor",
      "Description",
      "Venture",
      "Category",
      "Amount",
      "Deductible %",
      "Deductible Amount",
      "Receipt on file",
      "Notes",
    ];
    const rows = filtered.map((e) => [
      e.date,
      e.vendor,
      e.description,
      e.venture,
      e.category,
      e.amount.toFixed(2),
      e.pct,
      ((e.amount * e.pct) / 100).toFixed(2),
      e.receipt ? "Yes" : "No",
      e.notes,
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `expenses_${filterPeriod.replace(/\s/g, "_")}_${now.toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const inputCls =
    "w-full bg-[#1D2129] border border-[#3A3F49] rounded-sm px-3 py-2 text-[#EDE7D8] placeholder-[#7A7F89] focus:outline-none focus:ring-1 focus:ring-[#B8902E] text-sm";
  const labelCls = "block text-[10px] uppercase tracking-widest text-[#8A8F98] mb-1";

  if (!loaded) {
    return (
      <div className="min-h-screen bg-[#14171C] flex items-center justify-center text-[#8A8F98] font-mono text-sm">
        Opening the ledger…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#14171C] text-[#EDE7D8]" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        .font-display { font-family: 'Fraunces', serif; }
        .font-mono-fig { font-family: 'IBM Plex Mono', monospace; font-variant-numeric: tabular-nums; }
        .ledger-rule { border-color: rgba(237,231,216,0.12); }
      `}</style>

      {/* Masthead */}
      <header className="border-b ledger-rule px-6 md:px-10 py-6">
        <div className="max-w-6xl mx-auto flex items-end justify-between gap-4 flex-wrap">
          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-[#B8902E] mb-1">Sine Macula · Ledger</p>
            <h1 className="font-display text-3xl md:text-4xl font-semibold">Business Expense Ledger</h1>
            <p className="text-[#8A8F98] text-sm mt-1">Track deductions across every venture, ready for your accountant.</p>
          </div>
          <button
            onClick={exportCSV}
            disabled={filtered.length === 0}
            className="flex items-center gap-2 border border-[#B8902E] text-[#B8902E] hover:bg-[#B8902E] hover:text-[#14171C] transition-colors px-4 py-2 text-xs uppercase tracking-widest rounded-sm disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-[#B8902E]"
          >
            <Download size={14} /> Export CSV
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 md:px-10 py-8 grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-8">
        <div>
          {/* Totals strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-[#2A2E36] mb-8 border ledger-rule">
            {[
              ["Filtered Total", currency(totals.total)],
              ["Deductible Amount", currency(totals.deductible)],
              ["Entries", totals.count],
              ["Missing Receipts", totals.noReceipt],
            ].map(([label, val]) => (
              <div key={label} className="bg-[#1A1D24] px-4 py-4">
                <p className="text-[10px] uppercase tracking-widest text-[#8A8F98]">{label}</p>
                <p className="font-mono-fig text-xl mt-1">{val}</p>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="relative flex-1 min-w-[180px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A8F98]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search vendor, description, notes…"
                className={inputCls + " pl-8"}
              />
            </div>
            <select value={filterVenture} onChange={(e) => setFilterVenture(e.target.value)} className={inputCls + " w-auto"}>
              <option>All</option>
              {ventures.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
            <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className={inputCls + " w-auto"}>
              <option>All</option>
              {CATEGORIES.map((c) => (
                <option key={c.name}>{c.name}</option>
              ))}
            </select>
            <select value={filterPeriod} onChange={(e) => setFilterPeriod(e.target.value)} className={inputCls + " w-auto"}>
              {["All", "This Month", "This Year", "Last Year"].map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
            <button
              onClick={() => {
                setShowForm(true);
                setEditingId(null);
                setForm(emptyForm);
              }}
              className="flex items-center gap-2 bg-[#B8902E] text-[#14171C] px-4 py-2 text-xs uppercase tracking-widest font-medium rounded-sm hover:bg-[#CBA544] transition-colors"
            >
              <Plus size={14} /> Add Expense
            </button>
          </div>

          {error && <p className="text-[#C97066] text-xs mb-3">{error}</p>}

          {/* Add/Edit form */}
          {showForm && (
            <div className="border ledger-rule bg-[#1A1D24] p-5 mb-6 relative">
              <button onClick={resetForm} className="absolute top-3 right-3 text-[#8A8F98] hover:text-[#EDE7D8]">
                <X size={16} />
              </button>
              <p className="font-display text-lg mb-4">{editingId ? "Edit entry" : "New entry"}</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>Date</label>
                  <input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Vendor</label>
                  <input value={form.vendor} onChange={(e) => setForm((f) => ({ ...f, vendor: e.target.value }))} className={inputCls} placeholder="e.g. Adobe" />
                </div>
                <div>
                  <label className={labelCls}>Amount</label>
                  <input type="number" step="0.01" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} className={inputCls} placeholder="0.00" />
                </div>
                <div>
                  <label className={labelCls}>Venture</label>
                  <select value={form.venture} onChange={(e) => setForm((f) => ({ ...f, venture: e.target.value }))} className={inputCls}>
                    {ventures.map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                  {!showVentureAdd ? (
                    <button onClick={() => setShowVentureAdd(true)} className="text-[10px] text-[#B8902E] mt-1 uppercase tracking-widest">
                      + New venture
                    </button>
                  ) : (
                    <div className="flex gap-1 mt-1">
                      <input value={newVenture} onChange={(e) => setNewVenture(e.target.value)} className={inputCls} placeholder="Venture name" />
                      <button onClick={addVenture} className="text-xs bg-[#B8902E] text-[#14171C] px-2 rounded-sm">
                        Add
                      </button>
                    </div>
                  )}
                </div>
                <div>
                  <label className={labelCls}>Category</label>
                  <select value={form.category} onChange={(e) => handleCategoryChange(e.target.value)} className={inputCls}>
                    {CATEGORIES.map((c) => (
                      <option key={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Deductible %</label>
                  <input type="number" min="0" max="100" value={form.pct} onChange={(e) => setForm((f) => ({ ...f, pct: e.target.value }))} className={inputCls} />
                </div>
                <div className="md:col-span-2">
                  <label className={labelCls}>Description</label>
                  <input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className={inputCls} placeholder="What was this for?" />
                </div>
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 text-sm text-[#C7C2B4]">
                    <input type="checkbox" checked={form.receipt} onChange={(e) => setForm((f) => ({ ...f, receipt: e.target.checked }))} className="accent-[#B8902E]" />
                    Receipt on file
                  </label>
                </div>
                <div className="md:col-span-3">
                  <label className={labelCls}>Notes</label>
                  <input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} className={inputCls} placeholder="Optional" />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-4">
                <button onClick={resetForm} className="text-xs uppercase tracking-widest text-[#8A8F98] px-4 py-2">
                  Cancel
                </button>
                <button onClick={handleSubmit} className="text-xs uppercase tracking-widest bg-[#B8902E] text-[#14171C] px-5 py-2 rounded-sm hover:bg-[#CBA544]">
                  {editingId ? "Save changes" : "Add to ledger"}
                </button>
              </div>
            </div>
          )}

          {/* Ledger table */}
          <div className="border ledger-rule">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b ledger-rule text-[10px] uppercase tracking-widest text-[#8A8F98]">
                  <th className="text-left px-3 py-2 font-normal">Date</th>
                  <th className="text-left px-3 py-2 font-normal">Vendor / Description</th>
                  <th className="text-left px-3 py-2 font-normal hidden md:table-cell">Venture</th>
                  <th className="text-left px-3 py-2 font-normal hidden md:table-cell">Category</th>
                  <th className="text-right px-3 py-2 font-normal">Amount</th>
                  <th className="text-right px-3 py-2 font-normal">Deductible</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center text-[#8A8F98] py-10 text-sm">
                      No entries yet. Add your first expense to start the ledger.
                    </td>
                  </tr>
                )}
                {filtered.map((e) => (
                  <tr key={e.id} className="border-b ledger-rule hover:bg-[#1A1D24] group">
                    <td className="px-3 py-3 font-mono-fig text-[#C7C2B4] whitespace-nowrap">{e.date}</td>
                    <td className="px-3 py-3">
                      <p className="text-[#EDE7D8]">{e.vendor}</p>
                      {e.description && <p className="text-[#8A8F98] text-xs">{e.description}</p>}
                    </td>
                    <td className="px-3 py-3 hidden md:table-cell">
                      <span className="inline-flex items-center gap-1.5 text-xs text-[#C7C2B4]">
                        <span className="w-5 h-5 rounded-full bg-[#2A2E36] border ledger-rule flex items-center justify-center text-[9px] text-[#B8902E]">
                          {initials(e.venture)}
                        </span>
                        {e.venture}
                      </span>
                    </td>
                    <td className="px-3 py-3 hidden md:table-cell text-[#C7C2B4] text-xs">{e.category}</td>
                    <td className="px-3 py-3 text-right font-mono-fig">{currency(e.amount)}</td>
                    <td className="px-3 py-3 text-right font-mono-fig text-[#8FAF97]">
                      {currency((e.amount * e.pct) / 100)}
                      {e.pct < 100 && <span className="text-[#8A8F98] text-[10px]"> ({e.pct}%)</span>}
                      {!e.receipt && <Receipt size={11} className="inline ml-1 text-[#C97066]" />}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleEdit(e)} className="text-[#8A8F98] hover:text-[#B8902E]">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => handleDelete(e.id)} className="text-[#8A8F98] hover:text-[#C97066]">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              {filtered.length > 0 && (
                <tfoot>
                  <tr>
                    <td colSpan={4} className="px-3 py-3 text-right text-[10px] uppercase tracking-widest text-[#8A8F98]">
                      Grand total
                    </td>
                    <td className="px-3 py-3 text-right font-mono-fig border-t-2 border-double border-[#B8902E] pt-2">{currency(totals.total)}</td>
                    <td className="px-3 py-3 text-right font-mono-fig border-t-2 border-double border-[#B8902E] pt-2 text-[#8FAF97]">{currency(totals.deductible)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          {saving && <p className="text-[10px] text-[#8A8F98] mt-2">Saving…</p>}
        </div>

        {/* Sidebar summaries */}
        <aside className="space-y-8">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-[#8A8F98] mb-3">By category</p>
            <div className="space-y-2">
              {byCategory.length === 0 && <p className="text-xs text-[#8A8F98]">Nothing to summarize yet.</p>}
              {byCategory.map(([cat, amt]) => (
                <div key={cat}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-[#C7C2B4]">{cat}</span>
                    <span className="font-mono-fig">{currency(amt)}</span>
                  </div>
                  <div className="h-1 bg-[#2A2E36]">
                    <div className="h-1 bg-[#B8902E]" style={{ width: `${(amt / maxCat) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-widest text-[#8A8F98] mb-3">By venture</p>
            <div className="space-y-2">
              {byVenture.length === 0 && <p className="text-xs text-[#8A8F98]">Nothing to summarize yet.</p>}
              {byVenture.map(([v, amt]) => (
                <div key={v}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-[#C7C2B4]">{v}</span>
                    <span className="font-mono-fig">{currency(amt)}</span>
                  </div>
                  <div className="h-1 bg-[#2A2E36]">
                    <div className="h-1 bg-[#8FAF97]" style={{ width: `${(amt / maxVent) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border ledger-rule p-4 text-xs text-[#8A8F98] leading-relaxed">
            <p className="text-[#C7C2B4] mb-1 font-medium">Notes on deductions</p>
            <p>Meals default to 50% deductible per IRS rules. Everything else defaults to 100% — adjust per entry if an accountant advises otherwise. This tool organizes records; it isn't tax advice.</p>
          </div>
        </aside>
      </main>
    </div>
  );
}
