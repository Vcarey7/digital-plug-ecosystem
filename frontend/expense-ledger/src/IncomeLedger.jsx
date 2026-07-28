import React, { useEffect, useMemo, useState } from "react";
import { Clock, DollarSign, Download, FileText, Pencil, Plus, Printer, Search, Target, Trash2, Users, X } from "lucide-react";

const INCOME_TYPES = [
  "Client Work",
  "Consulting",
  "Technical Build",
  "Operations",
  "Content / Media",
  "Training / Coaching",
  "Other Billable Work",
];

const STATUSES = ["Earned", "Invoiced", "Paid"];

const DEFAULT_PROFILE = {
  ownerName: "",
  businessName: "Digital Plug Co.",
  email: "",
  phone: "",
  rentTarget: "1200",
  standardRate: "125",
  documentId: "",
};

const emptyEntry = {
  date: new Date().toISOString().slice(0, 10),
  client: "",
  type: INCOME_TYPES[0],
  description: "",
  hours: "1",
  rate: "125",
  status: "Earned",
  reference: "",
  notes: "",
};

function uid(prefix = "inc") {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function documentId() {
  return `DPC-INC-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function numberValue(value) {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

function money(value) {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function shortDate(value) {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  return `${month}/${day}/${year}`;
}

function monthKey(value) {
  return String(value || "").slice(0, 7);
}

function monthLabel(key) {
  if (!key) return "Unknown";
  const [year, month] = key.split("-");
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function initials(str) {
  return String(str || "")
    .replace(/[^\w\s&]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function startOfCurrentMonth() {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d;
}

function entryTotal(entry) {
  return numberValue(entry.hours) * numberValue(entry.rate);
}

function entryInPeriod(entry, period) {
  if (period === "All") return true;
  const d = new Date(`${entry.date}T00:00:00`);
  const now = new Date();
  if (period === "This Month") return d >= startOfCurrentMonth();
  if (period === "Last 30 Days") return d >= daysAgo(30);
  if (period === "Last 60 Days") return d >= daysAgo(60);
  if (period === "Last 90 Days") return d >= daysAgo(90);
  if (period === "This Year") return d.getFullYear() === now.getFullYear();
  if (period.startsWith("month:")) return monthKey(entry.date) === period.replace("month:", "");
  return true;
}

function periodLabel(period) {
  if (period.startsWith("month:")) return monthLabel(period.replace("month:", ""));
  return period;
}

function monthlyAverage(entries) {
  if (!entries.length) return 0;
  const map = new Map();
  entries.forEach((entry) => {
    const key = monthKey(entry.date);
    map.set(key, (map.get(key) || 0) + entryTotal(entry));
  });
  return Array.from(map.values()).reduce((sum, value) => sum + value, 0) / map.size;
}

function csvEscape(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

export default function IncomeLedger() {
  const [entries, setEntries] = useState([]);
  const [profile, setProfile] = useState(DEFAULT_PROFILE);
  const [loaded, setLoaded] = useState(false);
  const [showEntryForm, setShowEntryForm] = useState(false);
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [form, setForm] = useState(emptyEntry);
  const [editingId, setEditingId] = useState(null);
  const [period, setPeriod] = useState("Last 90 Days");
  const [clientFilter, setClientFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const storedEntries = localStorage.getItem("dpcIncomeLedgerEntries");
      if (storedEntries) setEntries(JSON.parse(storedEntries));
    } catch (e) {
      /* no existing income entries */
    }

    try {
      const storedProfile = localStorage.getItem("dpcIncomeLedgerProfile");
      const parsedProfile = storedProfile ? JSON.parse(storedProfile) : {};
      const normalizedProfile = { ...DEFAULT_PROFILE, ...parsedProfile, documentId: parsedProfile.documentId || documentId() };
      setProfile(normalizedProfile);
      localStorage.setItem("dpcIncomeLedgerProfile", JSON.stringify(normalizedProfile));
    } catch (e) {
      setProfile({ ...DEFAULT_PROFILE, documentId: documentId() });
    }
    setLoaded(true);
  }, []);

  const persistEntries = (next) => {
    setEntries(next);
    try {
      localStorage.setItem("dpcIncomeLedgerEntries", JSON.stringify(next));
      setError("");
    } catch (e) {
      setError("Couldn't save the income ledger — try again.");
    }
  };

  const persistProfile = (next) => {
    const normalized = { ...next, documentId: next.documentId || documentId() };
    setProfile(normalized);
    try {
      localStorage.setItem("dpcIncomeLedgerProfile", JSON.stringify(normalized));
      setError("");
    } catch (e) {
      setError("Couldn't save the document profile — try again.");
    }
  };

  const resetForm = () => {
    setForm({ ...emptyEntry, rate: String(profile.standardRate || emptyEntry.rate) });
    setEditingId(null);
    setShowEntryForm(false);
  };

  const openNewEntry = () => {
    setForm({ ...emptyEntry, rate: String(profile.standardRate || emptyEntry.rate) });
    setEditingId(null);
    setShowEntryForm(true);
  };

  const clients = useMemo(() => Array.from(new Set(entries.map((entry) => entry.client).filter(Boolean))).sort(), [entries]);

  const monthOptions = useMemo(() => {
    const months = Array.from(new Set(entries.map((entry) => monthKey(entry.date)).filter(Boolean))).sort().reverse();
    return months.map((key) => ({ value: `month:${key}`, label: monthLabel(key) }));
  }, [entries]);

  const filteredEntries = useMemo(() => {
    const q = search.toLowerCase();
    return entries
      .filter((entry) => entryInPeriod(entry, period))
      .filter((entry) => clientFilter === "All" || entry.client === clientFilter)
      .filter((entry) => statusFilter === "All" || entry.status === statusFilter)
      .filter((entry) => {
        if (!q) return true;
        return (
          String(entry.client || "").toLowerCase().includes(q) ||
          String(entry.description || "").toLowerCase().includes(q) ||
          String(entry.type || "").toLowerCase().includes(q) ||
          String(entry.reference || "").toLowerCase().includes(q) ||
          String(entry.notes || "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [clientFilter, entries, period, search, statusFilter]);

  const proofEntries = useMemo(() => entries.filter((entry) => entryInPeriod(entry, "Last 90 Days")), [entries]);

  const totals = useMemo(() => {
    const income = filteredEntries.reduce((sum, entry) => sum + entryTotal(entry), 0);
    const paidIncome = filteredEntries.filter((entry) => entry.status === "Paid").reduce((sum, entry) => sum + entryTotal(entry), 0);
    const hours = filteredEntries.reduce((sum, entry) => sum + numberValue(entry.hours), 0);
    const clientCount = new Set(filteredEntries.map((entry) => entry.client).filter(Boolean)).size;
    return {
      income,
      paidIncome,
      hours,
      clientCount,
      averageRate: hours ? income / hours : 0,
      count: filteredEntries.length,
    };
  }, [filteredEntries]);

  const proofTotals = useMemo(() => {
    const income = proofEntries.reduce((sum, entry) => sum + entryTotal(entry), 0);
    const paidIncome = proofEntries.filter((entry) => entry.status === "Paid").reduce((sum, entry) => sum + entryTotal(entry), 0);
    const hours = proofEntries.reduce((sum, entry) => sum + numberValue(entry.hours), 0);
    return {
      income,
      paidIncome,
      hours,
      averageMonthlyIncome: income / 3,
      paidAverageMonthlyIncome: paidIncome / 3,
    };
  }, [proofEntries]);

  const monthlyBreakdown = useMemo(() => {
    const map = new Map();
    filteredEntries.forEach((entry) => {
      const key = monthKey(entry.date);
      const current = map.get(key) || { income: 0, hours: 0, count: 0 };
      current.income += entryTotal(entry);
      current.hours += numberValue(entry.hours);
      current.count += 1;
      map.set(key, current);
    });
    return Array.from(map.entries())
      .map(([key, value]) => ({ key, label: monthLabel(key), ...value }))
      .sort((a, b) => b.key.localeCompare(a.key));
  }, [filteredEntries]);

  const clientBreakdown = useMemo(() => {
    const map = new Map();
    filteredEntries.forEach((entry) => {
      const key = entry.client || "Unassigned";
      const current = map.get(key) || { income: 0, hours: 0, count: 0 };
      current.income += entryTotal(entry);
      current.hours += numberValue(entry.hours);
      current.count += 1;
      map.set(key, current);
    });
    return Array.from(map.entries())
      .map(([client, value]) => ({ client, ...value }))
      .sort((a, b) => b.income - a.income);
  }, [filteredEntries]);

  const allMonthlyAverage = useMemo(() => monthlyAverage(entries), [entries]);
  const rentTarget = numberValue(profile.rentTarget);
  const housingRatio = rentTarget ? proofTotals.averageMonthlyIncome / rentTarget : 0;
  const shelterScore = Math.max(0, Math.min(100, Math.round((housingRatio / 3) * 100)));
  const maxMonthly = monthlyBreakdown.length ? Math.max(...monthlyBreakdown.map((item) => item.income)) : 1;
  const maxClient = clientBreakdown.length ? Math.max(...clientBreakdown.map((item) => item.income)) : 1;

  const handleSubmit = () => {
    const client = form.client.trim();
    const hours = numberValue(form.hours);
    const rate = numberValue(form.rate);
    if (!client || hours <= 0 || rate <= 0) {
      setError("Enter a client/source, valid hours, and a valid hourly rate.");
      return;
    }
    const record = {
      ...form,
      client,
      description: form.description.trim(),
      hours,
      rate,
      status: STATUSES.includes(form.status) ? form.status : "Earned",
      reference: form.reference.trim(),
      notes: form.notes.trim(),
      updatedAt: new Date().toISOString(),
    };
    if (editingId) {
      persistEntries(entries.map((entry) => (entry.id === editingId ? { ...record, id: editingId, createdAt: entry.createdAt } : entry)));
    } else {
      persistEntries([{ ...record, id: uid(), createdAt: new Date().toISOString() }, ...entries]);
    }
    resetForm();
  };

  const handleEdit = (entry) => {
    setForm({
      ...entry,
      hours: String(entry.hours),
      rate: String(entry.rate),
    });
    setEditingId(entry.id);
    setShowEntryForm(true);
  };

  const exportCSV = () => {
    const header = [
      "Date",
      "Client / Source",
      "Type",
      "Description",
      "Hours",
      "Rate",
      "Total",
      "Status",
      "Reference",
      "Notes",
    ];
    const rows = filteredEntries.map((entry) => [
      entry.date,
      entry.client,
      entry.type,
      entry.description,
      numberValue(entry.hours).toFixed(2),
      numberValue(entry.rate).toFixed(2),
      entryTotal(entry).toFixed(2),
      entry.status,
      entry.reference,
      entry.notes,
    ]);
    const csv = [header, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `income_ledger_${periodLabel(period).replace(/\s|\//g, "_")}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const printLedger = () => window.print();

  const inputCls =
    "w-full bg-[#1D2129] border border-[#3A3F49] rounded-sm px-3 py-2 text-[#EDE7D8] placeholder-[#7A7F89] focus:outline-none focus:ring-1 focus:ring-[#B8902E] text-sm";
  const labelCls = "block text-[10px] uppercase tracking-widest text-[#8A8F98] mb-1";

  if (!loaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#14171C] font-mono text-sm text-[#8A8F98]">
        Opening income ledger…
      </div>
    );
  }

  return (
    <div className="income-ledger min-h-screen bg-[#14171C] text-[#EDE7D8]" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        .font-display { font-family: 'Fraunces', serif; }
        .font-mono-fig { font-family: 'IBM Plex Mono', monospace; font-variant-numeric: tabular-nums; }
        .ledger-rule { border-color: rgba(237,231,216,0.12); }
        .print-only { display: none; }
        @media print {
          @page { margin: 0.45in; }
          body { background: white !important; color: #111 !important; }
          body * { visibility: hidden; }
          .print-ledger, .print-ledger * { visibility: visible; }
          .print-ledger { display: block !important; position: absolute; inset: 0; color: #111; background: white; font-family: Arial, sans-serif; }
          .no-print { display: none !important; }
          .print-table { width: 100%; border-collapse: collapse; font-size: 10px; }
          .print-table th, .print-table td { border: 1px solid #bdbdbd; padding: 5px; vertical-align: top; }
          .print-table th { background: #efefef; text-align: left; }
        }
      `}</style>

      <section className="print-ledger print-only">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 24, borderBottom: "2px solid #111", paddingBottom: 12, marginBottom: 16 }}>
          <div>
            <h1 style={{ fontSize: 24, margin: 0 }}>Income Documentation Ledger</h1>
            <p style={{ margin: "4px 0 0", fontSize: 12 }}>Self-employment / billable hours record</p>
          </div>
          <div style={{ textAlign: "right", fontSize: 11 }}>
            <p style={{ margin: 0 }}><strong>Document ID:</strong> {profile.documentId}</p>
            <p style={{ margin: "4px 0 0" }}><strong>Generated:</strong> {new Date().toLocaleDateString()}</p>
            <p style={{ margin: "4px 0 0" }}><strong>Period:</strong> {periodLabel(period)}</p>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16, fontSize: 11 }}>
          <div>
            <p style={{ margin: 0 }}><strong>Name:</strong> {profile.ownerName || "____________________________"}</p>
            <p style={{ margin: "4px 0 0" }}><strong>Business:</strong> {profile.businessName || "____________________________"}</p>
            <p style={{ margin: "4px 0 0" }}><strong>Email:</strong> {profile.email || "____________________________"}</p>
            <p style={{ margin: "4px 0 0" }}><strong>Phone:</strong> {profile.phone || "____________________________"}</p>
          </div>
          <div>
            <p style={{ margin: 0 }}><strong>Filtered documented income:</strong> {money(totals.income)}</p>
            <p style={{ margin: "4px 0 0" }}><strong>Filtered billable hours:</strong> {totals.hours.toFixed(2)}</p>
            <p style={{ margin: "4px 0 0" }}><strong>Last 90 day monthly average:</strong> {money(proofTotals.averageMonthlyIncome)}</p>
            <p style={{ margin: "4px 0 0" }}><strong>All-time monthly average:</strong> {money(allMonthlyAverage)}</p>
          </div>
        </div>

        <table className="print-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Client / Source</th>
              <th>Description</th>
              <th>Hours</th>
              <th>Rate</th>
              <th>Total</th>
              <th>Status</th>
              <th>Reference</th>
            </tr>
          </thead>
          <tbody>
            {filteredEntries.map((entry) => (
              <tr key={entry.id}>
                <td>{shortDate(entry.date)}</td>
                <td>{entry.client}</td>
                <td>{entry.description || entry.type}</td>
                <td>{numberValue(entry.hours).toFixed(2)}</td>
                <td>{money(numberValue(entry.rate))}</td>
                <td>{money(entryTotal(entry))}</td>
                <td>{entry.status}</td>
                <td>{entry.reference}</td>
              </tr>
            ))}
            {filteredEntries.length === 0 && (
              <tr>
                <td colSpan={8}>No entries in this filtered period.</td>
              </tr>
            )}
          </tbody>
        </table>

        <div style={{ marginTop: 18, fontSize: 10, lineHeight: 1.45 }}>
          <p>
            I certify that this ledger is a record of actual billable work documented by the person/business named above. Supporting invoices, payment deposits, contracts, or client communications should be attached where available.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40, marginTop: 28 }}>
            <p>Signature: ________________________________________</p>
            <p>Date: ____________________________</p>
          </div>
        </div>
      </section>

      <header className="no-print border-b ledger-rule px-6 py-6 md:px-10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-1 text-[10px] uppercase tracking-[0.25em] text-[#B8902E]">Sine Macula · Income Proof</p>
            <h1 className="font-display text-3xl font-semibold md:text-4xl">Income Documentation Ledger</h1>
            <p className="mt-1 text-sm text-[#8A8F98]">Track billable hours and build a clean proof-of-income packet for housing applications.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={openNewEntry}
              className="flex items-center gap-2 bg-[#B8902E] px-4 py-2 text-xs font-medium uppercase tracking-widest text-[#14171C] transition-colors hover:bg-[#CBA544]"
            >
              <Plus size={14} /> Log Hours
            </button>
            <button
              onClick={printLedger}
              className="flex items-center gap-2 border border-[#B8902E] px-4 py-2 text-xs uppercase tracking-widest text-[#B8902E] transition-colors hover:bg-[#B8902E] hover:text-[#14171C]"
            >
              <Printer size={14} /> Print Proof
            </button>
            <button
              onClick={exportCSV}
              disabled={filteredEntries.length === 0}
              className="flex items-center gap-2 border border-[#3A3F49] px-4 py-2 text-xs uppercase tracking-widest text-[#C7C2B4] transition-colors hover:border-[#B8902E] hover:text-[#B8902E] disabled:opacity-30"
            >
              <Download size={14} /> Export CSV
            </button>
          </div>
        </div>
      </header>

      <main className="no-print mx-auto grid max-w-6xl grid-cols-1 gap-8 px-6 py-8 md:px-10 lg:grid-cols-[1fr_320px]">
        <div>
          <div className="mb-8 grid grid-cols-2 gap-px border ledger-rule bg-[#2A2E36] md:grid-cols-4">
            {[
              ["Documented Income", money(totals.income), DollarSign],
              ["Billable Hours", totals.hours.toFixed(2), Clock],
              ["Clients / Sources", totals.clientCount, Users],
              ["Average Rate", money(totals.averageRate), Target],
            ].map(([label, value, Icon]) => (
              <div key={label} className="bg-[#1A1D24] px-4 py-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] uppercase tracking-widest text-[#8A8F98]">{label}</p>
                  <Icon size={14} className="text-[#B8902E]" />
                </div>
                <p className="font-mono-fig mt-1 text-xl">{value}</p>
              </div>
            ))}
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="relative min-w-[190px] flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A8F98]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search client, description, reference, notes…"
                className={`${inputCls} pl-8`}
              />
            </div>
            <select value={period} onChange={(e) => setPeriod(e.target.value)} className={`${inputCls} w-auto`}>
              {["All", "This Month", "Last 30 Days", "Last 60 Days", "Last 90 Days", "This Year"].map((item) => (
                <option key={item}>{item}</option>
              ))}
              {monthOptions.length > 0 && <option disabled>──────────</option>}
              {monthOptions.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
            <select value={clientFilter} onChange={(e) => setClientFilter(e.target.value)} className={`${inputCls} w-auto`}>
              <option>All</option>
              {clients.map((client) => (
                <option key={client}>{client}</option>
              ))}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={`${inputCls} w-auto`}>
              <option>All</option>
              {STATUSES.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
          </div>

          {error && <p className="mb-3 text-xs text-[#C97066]">{error}</p>}

          {showEntryForm && (
            <div className="relative mb-6 border ledger-rule bg-[#1A1D24] p-5">
              <button onClick={resetForm} className="absolute right-3 top-3 text-[#8A8F98] hover:text-[#EDE7D8]">
                <X size={16} />
              </button>
              <p className="font-display mb-4 text-lg">{editingId ? "Edit billable entry" : "Log billable hours"}</p>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div>
                  <label className={labelCls}>Date</label>
                  <input type="date" value={form.date} onChange={(e) => setForm((current) => ({ ...current, date: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Client / Source</label>
                  <input value={form.client} onChange={(e) => setForm((current) => ({ ...current, client: e.target.value }))} className={inputCls} placeholder="Client, venture, or payer" />
                </div>
                <div>
                  <label className={labelCls}>Work Type</label>
                  <select value={form.type} onChange={(e) => setForm((current) => ({ ...current, type: e.target.value }))} className={inputCls}>
                    {INCOME_TYPES.map((type) => (
                      <option key={type}>{type}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Status</label>
                  <select value={form.status} onChange={(e) => setForm((current) => ({ ...current, status: e.target.value }))} className={inputCls}>
                    {STATUSES.map((status) => (
                      <option key={status}>{status}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Hours</label>
                  <input type="number" step="0.01" min="0" value={form.hours} onChange={(e) => setForm((current) => ({ ...current, hours: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Hourly Rate</label>
                  <input type="number" step="0.01" min="0" value={form.rate} onChange={(e) => setForm((current) => ({ ...current, rate: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Auto Total</label>
                  <div className="font-mono-fig rounded-sm border border-[#3A3F49] bg-[#14171C] px-3 py-2 text-sm text-[#8FAF97]">
                    {money(entryTotal(form))}
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Invoice / Ref</label>
                  <input value={form.reference} onChange={(e) => setForm((current) => ({ ...current, reference: e.target.value }))} className={inputCls} placeholder="INV-001, deposit, etc." />
                </div>
                <div className="md:col-span-4">
                  <label className={labelCls}>Description of Work</label>
                  <input value={form.description} onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))} className={inputCls} placeholder="What work was performed?" />
                </div>
                <div className="md:col-span-4">
                  <label className={labelCls}>Notes</label>
                  <input value={form.notes} onChange={(e) => setForm((current) => ({ ...current, notes: e.target.value }))} className={inputCls} placeholder="Optional: client contact, scope, supporting document location" />
                </div>
              </div>
              <div className="mt-4 flex justify-end gap-3">
                <button onClick={resetForm} className="px-4 py-2 text-xs uppercase tracking-widest text-[#8A8F98]">
                  Cancel
                </button>
                <button onClick={handleSubmit} className="rounded-sm bg-[#B8902E] px-5 py-2 text-xs uppercase tracking-widest text-[#14171C] hover:bg-[#CBA544]">
                  {editingId ? "Save entry" : "Add to ledger"}
                </button>
              </div>
            </div>
          )}

          <div className="border ledger-rule">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b ledger-rule text-[10px] uppercase tracking-widest text-[#8A8F98]">
                  <th className="px-3 py-2 text-left font-normal">Date</th>
                  <th className="px-3 py-2 text-left font-normal">Client / Work</th>
                  <th className="hidden px-3 py-2 text-left font-normal md:table-cell">Type</th>
                  <th className="px-3 py-2 text-right font-normal">Hours</th>
                  <th className="hidden px-3 py-2 text-right font-normal md:table-cell">Rate</th>
                  <th className="px-3 py-2 text-right font-normal">Total</th>
                  <th className="hidden px-3 py-2 text-left font-normal lg:table-cell">Status</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-sm text-[#8A8F98]">
                      No billable hours logged for this period. Add your first entry to start building proof of income.
                    </td>
                  </tr>
                )}
                {filteredEntries.map((entry) => (
                  <tr key={entry.id} className="group border-b ledger-rule hover:bg-[#1A1D24]">
                    <td className="font-mono-fig whitespace-nowrap px-3 py-3 text-[#C7C2B4]">{entry.date}</td>
                    <td className="px-3 py-3">
                      <p className="text-[#EDE7D8]">{entry.client}</p>
                      <p className="text-xs text-[#8A8F98]">{entry.description || entry.reference || "No description"}</p>
                    </td>
                    <td className="hidden px-3 py-3 md:table-cell">
                      <span className="inline-flex items-center gap-1.5 text-xs text-[#C7C2B4]">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full border ledger-rule bg-[#2A2E36] text-[9px] text-[#B8902E]">
                          {initials(entry.type)}
                        </span>
                        {entry.type}
                      </span>
                    </td>
                    <td className="font-mono-fig px-3 py-3 text-right">{numberValue(entry.hours).toFixed(2)}</td>
                    <td className="font-mono-fig hidden px-3 py-3 text-right text-[#C7C2B4] md:table-cell">{money(numberValue(entry.rate))}</td>
                    <td className="font-mono-fig px-3 py-3 text-right text-[#8FAF97]">{money(entryTotal(entry))}</td>
                    <td className="hidden px-3 py-3 lg:table-cell">
                      <span className={`rounded-full px-2 py-1 text-[10px] uppercase tracking-widest ${entry.status === "Paid" ? "bg-[#1F3528] text-[#8FAF97]" : entry.status === "Invoiced" ? "bg-[#352D1F] text-[#B8902E]" : "bg-[#2A2E36] text-[#C7C2B4]"}`}>
                        {entry.status}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                        <button onClick={() => handleEdit(entry)} className="text-[#8A8F98] hover:text-[#B8902E]" aria-label={`Edit income entry for ${entry.client}`}>
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => persistEntries(entries.filter((item) => item.id !== entry.id))} className="text-[#8A8F98] hover:text-[#C97066]" aria-label={`Delete income entry for ${entry.client}`}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              {filteredEntries.length > 0 && (
                <tfoot>
                  <tr>
                    <td colSpan={3} className="px-3 py-3 text-right text-[10px] uppercase tracking-widest text-[#8A8F98]">
                      Filtered total
                    </td>
                    <td className="font-mono-fig border-t-2 border-double border-[#B8902E] px-3 py-3 text-right">{totals.hours.toFixed(2)}</td>
                    <td className="font-mono-fig hidden border-t-2 border-double border-[#B8902E] px-3 py-3 text-right md:table-cell">{money(totals.averageRate)}</td>
                    <td className="font-mono-fig border-t-2 border-double border-[#B8902E] px-3 py-3 text-right text-[#8FAF97]">{money(totals.income)}</td>
                    <td className="hidden lg:table-cell"></td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        <aside className="space-y-8">
          <div className="border ledger-rule bg-[#1A1D24] p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-[10px] uppercase tracking-widest text-[#8A8F98]">Housing Proof Snapshot</p>
              <FileText size={15} className="text-[#B8902E]" />
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-[#8A8F98]">90-day income</span>
                <span className="font-mono-fig">{money(proofTotals.income)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-[#8A8F98]">90-day paid income</span>
                <span className="font-mono-fig">{money(proofTotals.paidIncome)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-[#8A8F98]">Monthly average</span>
                <span className="font-mono-fig text-[#8FAF97]">{money(proofTotals.averageMonthlyIncome)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-[#8A8F98]">Rent target</span>
                <span className="font-mono-fig">{money(rentTarget)}</span>
              </div>
              <div className="border-t ledger-rule pt-3">
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-[#C7C2B4]">Shelter Score</span>
                  <span className="font-mono-fig text-[#B8902E]">{shelterScore}/100</span>
                </div>
                <div className="h-1.5 bg-[#2A2E36]">
                  <div className="h-1.5 bg-[#B8902E]" style={{ width: `${shelterScore}%` }} />
                </div>
                <p className="mt-2 text-xs leading-relaxed text-[#8A8F98]">
                  Score estimates progress toward a common 3× rent income screen. It is not a guarantee of approval.
                </p>
              </div>
            </div>
          </div>

          <div className="border ledger-rule bg-[#1A1D24] p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-[10px] uppercase tracking-widest text-[#8A8F98]">Document Identity</p>
              <button onClick={() => setShowProfileForm((value) => !value)} className="text-[10px] uppercase tracking-widest text-[#B8902E]">
                {showProfileForm ? "Close" : "Edit"}
              </button>
            </div>
            {!showProfileForm ? (
              <div className="space-y-2 text-xs text-[#8A8F98]">
                <p><span className="text-[#C7C2B4]">Name:</span> {profile.ownerName || "Not set"}</p>
                <p><span className="text-[#C7C2B4]">Business:</span> {profile.businessName || "Not set"}</p>
                <p><span className="text-[#C7C2B4]">Document ID:</span> <span className="font-mono-fig">{profile.documentId}</span></p>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className={labelCls}>Your Name</label>
                  <input value={profile.ownerName} onChange={(e) => setProfile((current) => ({ ...current, ownerName: e.target.value }))} className={inputCls} placeholder="Full legal name" />
                </div>
                <div>
                  <label className={labelCls}>Business Name</label>
                  <input value={profile.businessName} onChange={(e) => setProfile((current) => ({ ...current, businessName: e.target.value }))} className={inputCls} placeholder="Business / DBA" />
                </div>
                <div>
                  <label className={labelCls}>Email</label>
                  <input value={profile.email} onChange={(e) => setProfile((current) => ({ ...current, email: e.target.value }))} className={inputCls} placeholder="you@example.com" />
                </div>
                <div>
                  <label className={labelCls}>Phone</label>
                  <input value={profile.phone} onChange={(e) => setProfile((current) => ({ ...current, phone: e.target.value }))} className={inputCls} placeholder="Phone number" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelCls}>Rent Target</label>
                    <input type="number" min="0" step="0.01" value={profile.rentTarget} onChange={(e) => setProfile((current) => ({ ...current, rentTarget: e.target.value }))} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Standard Rate</label>
                    <input type="number" min="0" step="0.01" value={profile.standardRate} onChange={(e) => setProfile((current) => ({ ...current, standardRate: e.target.value }))} className={inputCls} />
                  </div>
                </div>
                <button onClick={() => { persistProfile(profile); setShowProfileForm(false); }} className="w-full rounded-sm bg-[#B8902E] px-4 py-2 text-xs uppercase tracking-widest text-[#14171C] hover:bg-[#CBA544]">
                  Save profile
                </button>
              </div>
            )}
          </div>

          <div>
            <p className="mb-3 text-[10px] uppercase tracking-widest text-[#8A8F98]">Monthly income breakdown</p>
            <div className="space-y-2">
              {monthlyBreakdown.length === 0 && <p className="text-xs text-[#8A8F98]">Nothing to summarize yet.</p>}
              {monthlyBreakdown.map((item) => (
                <div key={item.key}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-[#C7C2B4]">{item.label}</span>
                    <span className="font-mono-fig">{money(item.income)}</span>
                  </div>
                  <div className="h-1 bg-[#2A2E36]">
                    <div className="h-1 bg-[#B8902E]" style={{ width: `${(item.income / maxMonthly) * 100}%` }} />
                  </div>
                  <p className="mt-0.5 text-[10px] text-[#8A8F98]">{item.hours.toFixed(2)} hrs · {item.count} entries</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-3 text-[10px] uppercase tracking-widest text-[#8A8F98]">Client/source breakdown</p>
            <div className="space-y-2">
              {clientBreakdown.length === 0 && <p className="text-xs text-[#8A8F98]">Nothing to summarize yet.</p>}
              {clientBreakdown.map((item) => (
                <div key={item.client}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-[#C7C2B4]">{item.client}</span>
                    <span className="font-mono-fig">{money(item.income)}</span>
                  </div>
                  <div className="h-1 bg-[#2A2E36]">
                    <div className="h-1 bg-[#8FAF97]" style={{ width: `${(item.income / maxClient) * 100}%` }} />
                  </div>
                  <p className="mt-0.5 text-[10px] text-[#8A8F98]">{item.hours.toFixed(2)} hrs · {item.count} entries</p>
                </div>
              ))}
            </div>
          </div>

          <div className="border ledger-rule p-4 text-xs leading-relaxed text-[#8A8F98]">
            <p className="mb-1 font-medium text-[#C7C2B4]">Proof packet tip</p>
            <p>
              Log actual work only. For a stronger housing packet, attach matching invoices, bank deposits, contracts, emails, or client messages to the printed ledger. This tool organizes documentation; it does not create official payroll or tax records.
            </p>
          </div>
        </aside>
      </main>
    </div>
  );
}
