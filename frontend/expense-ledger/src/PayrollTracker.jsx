import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Calculator, Download, Pencil, Plus, Search, Trash2, Users, Wallet, X } from "lucide-react";

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

const PAY_TYPES = ["Hourly", "Salary"];

const today = () => new Date().toISOString().slice(0, 10);

const currentPeriodStart = () => {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
};

const emptyEmployee = {
  name: "",
  role: "",
  venture: DEFAULT_VENTURES[0],
  payType: "Hourly",
  rate: "25",
  payPeriods: "26",
  defaultHours: "80",
  federalPct: "10",
  statePct: "3.5",
  localPct: "0",
  preTaxDeductions: "0",
  postTaxDeductions: "0",
  employerTaxPct: "7.65",
  active: true,
};

const emptyRun = {
  periodStart: currentPeriodStart(),
  periodEnd: today(),
  payDate: today(),
  employeeId: "",
  hours: "80",
  bonus: "0",
  reimbursements: "0",
  notes: "",
};

function uid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `pay_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function numberValue(value) {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

function pct(value) {
  return Math.min(100, Math.max(0, numberValue(value)));
}

function money(value) {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
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

function employeeSnapshot(employee) {
  return {
    employeeId: employee.id,
    employeeName: employee.name,
    role: employee.role,
    venture: employee.venture,
    payType: employee.payType,
    rate: numberValue(employee.rate),
    payPeriods: Math.max(1, numberValue(employee.payPeriods) || 26),
    federalPct: pct(employee.federalPct),
    statePct: pct(employee.statePct),
    localPct: pct(employee.localPct),
    preTaxDeductions: numberValue(employee.preTaxDeductions),
    postTaxDeductions: numberValue(employee.postTaxDeductions),
    employerTaxPct: pct(employee.employerTaxPct),
  };
}

function calculatePayroll(snapshot, run) {
  const hours = Math.max(0, numberValue(run.hours));
  const bonus = Math.max(0, numberValue(run.bonus));
  const reimbursements = Math.max(0, numberValue(run.reimbursements));
  const basePay = snapshot.payType === "Salary" ? snapshot.rate / snapshot.payPeriods : snapshot.rate * hours;
  const grossPay = round2(basePay + bonus);
  const preTaxDeductions = round2(Math.min(Math.max(0, snapshot.preTaxDeductions), grossPay));
  const taxablePay = Math.max(0, grossPay - preTaxDeductions);

  const socialSecurity = round2(taxablePay * 0.062);
  const medicare = round2(taxablePay * 0.0145);
  const federal = round2(taxablePay * (snapshot.federalPct / 100));
  const state = round2(taxablePay * (snapshot.statePct / 100));
  const local = round2(taxablePay * (snapshot.localPct / 100));
  const employeeTaxTotal = round2(socialSecurity + medicare + federal + state + local);
  const postTaxDeductions = round2(Math.min(Math.max(0, snapshot.postTaxDeductions), Math.max(0, taxablePay - employeeTaxTotal)));
  const employerTaxes = round2(taxablePay * (snapshot.employerTaxPct / 100));
  const netPay = round2(grossPay + reimbursements - preTaxDeductions - employeeTaxTotal - postTaxDeductions);
  const employerCost = round2(grossPay + reimbursements + employerTaxes);

  return {
    hours,
    bonus,
    reimbursements,
    basePay: round2(basePay),
    grossPay,
    taxablePay: round2(taxablePay),
    preTaxDeductions,
    employeeTaxes: {
      socialSecurity,
      medicare,
      federal,
      state,
      local,
    },
    employeeTaxTotal,
    postTaxDeductions,
    employerTaxes,
    netPay,
    employerCost,
  };
}

function periodMatches(dateString, filter) {
  if (filter === "All") return true;
  const d = new Date(`${dateString}T00:00:00`);
  const now = new Date();
  if (filter === "This Month") return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  if (filter === "This Quarter") {
    const quarter = Math.floor(now.getMonth() / 3);
    return d.getFullYear() === now.getFullYear() && Math.floor(d.getMonth() / 3) === quarter;
  }
  if (filter === "This Year") return d.getFullYear() === now.getFullYear();
  if (filter === "Last Year") return d.getFullYear() === now.getFullYear() - 1;
  return true;
}

export default function PayrollTracker() {
  const [employees, setEmployees] = useState([]);
  const [payRuns, setPayRuns] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [showEmployeeForm, setShowEmployeeForm] = useState(false);
  const [showRunForm, setShowRunForm] = useState(false);
  const [employeeForm, setEmployeeForm] = useState(emptyEmployee);
  const [runForm, setRunForm] = useState(emptyRun);
  const [editingEmployeeId, setEditingEmployeeId] = useState(null);
  const [editingRunId, setEditingRunId] = useState(null);
  const [filterEmployee, setFilterEmployee] = useState("All");
  const [filterVenture, setFilterVenture] = useState("All");
  const [filterPeriod, setFilterPeriod] = useState("This Year");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const storedEmployees = localStorage.getItem("dpcPayrollEmployees");
      if (storedEmployees) setEmployees(JSON.parse(storedEmployees));
    } catch (e) {
      /* no existing payroll roster */
    }
    try {
      const storedRuns = localStorage.getItem("dpcPayrollRuns");
      if (storedRuns) setPayRuns(JSON.parse(storedRuns));
    } catch (e) {
      /* no existing payroll runs */
    }
    setLoaded(true);
  }, []);

  const activeEmployees = useMemo(() => employees.filter((employee) => employee.active !== false), [employees]);
  const ventures = useMemo(() => Array.from(new Set([...DEFAULT_VENTURES, ...employees.map((employee) => employee.venture).filter(Boolean)])), [employees]);

  const persistEmployees = (next) => {
    setEmployees(next);
    try {
      localStorage.setItem("dpcPayrollEmployees", JSON.stringify(next));
      setError("");
    } catch (e) {
      setError("Couldn't save the payroll roster — try again.");
    }
  };

  const persistRuns = (next) => {
    setPayRuns(next);
    try {
      localStorage.setItem("dpcPayrollRuns", JSON.stringify(next));
      setError("");
    } catch (e) {
      setError("Couldn't save the pay run — try again.");
    }
  };

  const resetEmployeeForm = () => {
    setEmployeeForm(emptyEmployee);
    setEditingEmployeeId(null);
    setShowEmployeeForm(false);
  };

  const resetRunForm = () => {
    setRunForm({ ...emptyRun, employeeId: activeEmployees[0]?.id || "", hours: String(activeEmployees[0]?.defaultHours || 80) });
    setEditingRunId(null);
    setShowRunForm(false);
  };

  const openNewRun = () => {
    const first = activeEmployees[0];
    setRunForm({ ...emptyRun, employeeId: first?.id || "", hours: String(first?.defaultHours || 80) });
    setEditingRunId(null);
    setShowRunForm(true);
  };

  const handleEmployeeSubmit = () => {
    const name = employeeForm.name.trim();
    const rate = numberValue(employeeForm.rate);
    if (!name || rate <= 0) {
      setError("Enter an employee name and a valid pay rate.");
      return;
    }
    const normalized = {
      ...employeeForm,
      name,
      role: employeeForm.role.trim(),
      rate,
      payPeriods: Math.max(1, numberValue(employeeForm.payPeriods) || 26),
      defaultHours: Math.max(0, numberValue(employeeForm.defaultHours)),
      federalPct: pct(employeeForm.federalPct),
      statePct: pct(employeeForm.statePct),
      localPct: pct(employeeForm.localPct),
      preTaxDeductions: Math.max(0, numberValue(employeeForm.preTaxDeductions)),
      postTaxDeductions: Math.max(0, numberValue(employeeForm.postTaxDeductions)),
      employerTaxPct: pct(employeeForm.employerTaxPct),
      active: employeeForm.active !== false,
    };
    if (editingEmployeeId) {
      persistEmployees(employees.map((employee) => (employee.id === editingEmployeeId ? { ...normalized, id: editingEmployeeId } : employee)));
    } else {
      persistEmployees([{ ...normalized, id: uid(), createdAt: new Date().toISOString() }, ...employees]);
    }
    resetEmployeeForm();
  };

  const handleEditEmployee = (employee) => {
    setEmployeeForm({
      ...employee,
      rate: String(employee.rate),
      payPeriods: String(employee.payPeriods || 26),
      defaultHours: String(employee.defaultHours || 0),
      federalPct: String(employee.federalPct || 0),
      statePct: String(employee.statePct || 0),
      localPct: String(employee.localPct || 0),
      preTaxDeductions: String(employee.preTaxDeductions || 0),
      postTaxDeductions: String(employee.postTaxDeductions || 0),
      employerTaxPct: String(employee.employerTaxPct || 7.65),
    });
    setEditingEmployeeId(employee.id);
    setShowEmployeeForm(true);
  };

  const handleDeleteEmployee = (id) => {
    const hasRuns = payRuns.some((run) => run.employeeId === id);
    if (hasRuns) {
      persistEmployees(employees.map((employee) => (employee.id === id ? { ...employee, active: false } : employee)));
    } else {
      persistEmployees(employees.filter((employee) => employee.id !== id));
    }
  };

  const handleRunEmployeeChange = (id) => {
    const employee = activeEmployees.find((item) => item.id === id);
    setRunForm((form) => ({ ...form, employeeId: id, hours: String(employee?.defaultHours || form.hours || 80) }));
  };

  const selectedEmployee = useMemo(
    () => activeEmployees.find((employee) => employee.id === runForm.employeeId) || employees.find((employee) => employee.id === runForm.employeeId),
    [activeEmployees, employees, runForm.employeeId]
  );

  const runEmployeeOptions = useMemo(() => {
    if (selectedEmployee && !activeEmployees.some((employee) => employee.id === selectedEmployee.id)) {
      return [selectedEmployee, ...activeEmployees];
    }
    return activeEmployees;
  }, [activeEmployees, selectedEmployee]);

  const runPreview = useMemo(() => {
    if (!selectedEmployee) return null;
    return calculatePayroll(employeeSnapshot(selectedEmployee), runForm);
  }, [runForm, selectedEmployee]);

  const handleRunSubmit = () => {
    const employee = employees.find((item) => item.id === runForm.employeeId);
    if (!employee) {
      setError("Add or select an employee before recording payroll.");
      return;
    }
    const snapshot = employeeSnapshot(employee);
    const calculation = calculatePayroll(snapshot, runForm);
    if (calculation.grossPay <= 0) {
      setError("Gross pay must be greater than zero.");
      return;
    }
    const record = {
      ...snapshot,
      ...calculation,
      periodStart: runForm.periodStart,
      periodEnd: runForm.periodEnd,
      payDate: runForm.payDate,
      notes: runForm.notes.trim(),
      updatedAt: new Date().toISOString(),
    };
    if (editingRunId) {
      persistRuns(payRuns.map((run) => (run.id === editingRunId ? { ...record, id: editingRunId, createdAt: run.createdAt } : run)));
    } else {
      persistRuns([{ ...record, id: uid(), createdAt: new Date().toISOString() }, ...payRuns]);
    }
    resetRunForm();
  };

  const handleEditRun = (run) => {
    setRunForm({
      periodStart: run.periodStart,
      periodEnd: run.periodEnd,
      payDate: run.payDate,
      employeeId: run.employeeId,
      hours: String(run.hours || 0),
      bonus: String(run.bonus || 0),
      reimbursements: String(run.reimbursements || 0),
      notes: run.notes || "",
    });
    setEditingRunId(run.id);
    setShowRunForm(true);
  };

  const filteredRuns = useMemo(() => {
    const q = search.toLowerCase();
    return payRuns
      .filter((run) => filterEmployee === "All" || run.employeeId === filterEmployee)
      .filter((run) => filterVenture === "All" || run.venture === filterVenture)
      .filter((run) => periodMatches(run.payDate, filterPeriod))
      .filter((run) => {
        if (!q) return true;
        return (
          run.employeeName.toLowerCase().includes(q) ||
          String(run.role || "").toLowerCase().includes(q) ||
          String(run.venture || "").toLowerCase().includes(q) ||
          String(run.notes || "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => new Date(b.payDate) - new Date(a.payDate));
  }, [filterEmployee, filterPeriod, filterVenture, payRuns, search]);

  const totals = useMemo(() => {
    return filteredRuns.reduce(
      (sum, run) => ({
        count: sum.count + 1,
        grossPay: sum.grossPay + run.grossPay,
        netPay: sum.netPay + run.netPay,
        employeeTaxTotal: sum.employeeTaxTotal + run.employeeTaxTotal,
        employerTaxes: sum.employerTaxes + run.employerTaxes,
        employerCost: sum.employerCost + run.employerCost,
      }),
      { count: 0, grossPay: 0, netPay: 0, employeeTaxTotal: 0, employerTaxes: 0, employerCost: 0 }
    );
  }, [filteredRuns]);

  const byEmployee = useMemo(() => {
    const map = {};
    filteredRuns.forEach((run) => {
      map[run.employeeName] = (map[run.employeeName] || 0) + run.employerCost;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [filteredRuns]);

  const byVenture = useMemo(() => {
    const map = {};
    filteredRuns.forEach((run) => {
      map[run.venture] = (map[run.venture] || 0) + run.employerCost;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [filteredRuns]);

  const estimatedNextGross = useMemo(() => {
    return activeEmployees.reduce((sum, employee) => {
      const snapshot = employeeSnapshot(employee);
      const base = employee.payType === "Salary" ? snapshot.rate / snapshot.payPeriods : snapshot.rate * numberValue(employee.defaultHours);
      return sum + base;
    }, 0);
  }, [activeEmployees]);

  const exportCSV = () => {
    const header = [
      "Pay Date",
      "Period Start",
      "Period End",
      "Employee",
      "Role",
      "Venture",
      "Pay Type",
      "Rate",
      "Hours",
      "Gross Pay",
      "Pre-Tax Deductions",
      "Employee Taxes",
      "Post-Tax Deductions",
      "Reimbursements",
      "Net Pay",
      "Employer Taxes",
      "Employer Cost",
      "Notes",
    ];
    const rows = filteredRuns.map((run) => [
      run.payDate,
      run.periodStart,
      run.periodEnd,
      run.employeeName,
      run.role,
      run.venture,
      run.payType,
      run.rate.toFixed(2),
      run.hours,
      run.grossPay.toFixed(2),
      run.preTaxDeductions.toFixed(2),
      run.employeeTaxTotal.toFixed(2),
      run.postTaxDeductions.toFixed(2),
      run.reimbursements.toFixed(2),
      run.netPay.toFixed(2),
      run.employerTaxes.toFixed(2),
      run.employerCost.toFixed(2),
      run.notes,
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payroll_${filterPeriod.replace(/\s/g, "_")}_${today()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const inputCls =
    "w-full bg-[#1D2129] border border-[#3A3F49] rounded-sm px-3 py-2 text-[#EDE7D8] placeholder-[#7A7F89] focus:outline-none focus:ring-1 focus:ring-[#B8902E] text-sm";
  const labelCls = "block text-[10px] uppercase tracking-widest text-[#8A8F98] mb-1";
  const maxEmployee = byEmployee.length ? byEmployee[0][1] : 1;
  const maxVenture = byVenture.length ? byVenture[0][1] : 1;

  if (!loaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#14171C] font-mono text-sm text-[#8A8F98]">
        Opening payroll…
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

      <header className="border-b ledger-rule px-6 py-6 md:px-10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-1 text-[10px] uppercase tracking-[0.25em] text-[#B8902E]">Sine Macula · Payroll</p>
            <h1 className="font-display text-3xl font-semibold md:text-4xl">Payroll App</h1>
            <p className="mt-1 text-sm text-[#8A8F98]">Track employees, estimate paychecks, and export payroll-ready records.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                setEmployeeForm(emptyEmployee);
                setEditingEmployeeId(null);
                setShowEmployeeForm(true);
              }}
              className="flex items-center gap-2 border border-[#B8902E] px-4 py-2 text-xs uppercase tracking-widest text-[#B8902E] transition-colors hover:bg-[#B8902E] hover:text-[#14171C]"
            >
              <Plus size={14} /> Add Employee
            </button>
            <button
              onClick={openNewRun}
              disabled={activeEmployees.length === 0}
              className="flex items-center gap-2 bg-[#B8902E] px-4 py-2 text-xs font-medium uppercase tracking-widest text-[#14171C] transition-colors hover:bg-[#CBA544] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Wallet size={14} /> New Pay Run
            </button>
            <button
              onClick={exportCSV}
              disabled={filteredRuns.length === 0}
              className="flex items-center gap-2 border border-[#3A3F49] px-4 py-2 text-xs uppercase tracking-widest text-[#C7C2B4] transition-colors hover:border-[#B8902E] hover:text-[#B8902E] disabled:opacity-30"
            >
              <Download size={14} /> Export CSV
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-6 py-8 md:px-10 lg:grid-cols-[1fr_320px]">
        <div>
          <div className="mb-8 grid grid-cols-2 gap-px border ledger-rule bg-[#2A2E36] md:grid-cols-4">
            {[
              ["Gross Pay", money(totals.grossPay), Calculator],
              ["Net Pay", money(totals.netPay), Wallet],
              ["Tax Liability", money(totals.employeeTaxTotal + totals.employerTaxes), AlertTriangle],
              ["Employer Cost", money(totals.employerCost), Users],
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
                placeholder="Search employee, role, venture, notes…"
                className={`${inputCls} pl-8`}
              />
            </div>
            <select value={filterEmployee} onChange={(e) => setFilterEmployee(e.target.value)} className={`${inputCls} w-auto`}>
              <option>All</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name}{employee.active === false ? " (inactive)" : ""}
                </option>
              ))}
            </select>
            <select value={filterVenture} onChange={(e) => setFilterVenture(e.target.value)} className={`${inputCls} w-auto`}>
              <option>All</option>
              {ventures.map((venture) => (
                <option key={venture}>{venture}</option>
              ))}
            </select>
            <select value={filterPeriod} onChange={(e) => setFilterPeriod(e.target.value)} className={`${inputCls} w-auto`}>
              {["All", "This Month", "This Quarter", "This Year", "Last Year"].map((period) => (
                <option key={period}>{period}</option>
              ))}
            </select>
          </div>

          {error && <p className="mb-3 text-xs text-[#C97066]">{error}</p>}

          {showEmployeeForm && (
            <div className="relative mb-6 border ledger-rule bg-[#1A1D24] p-5">
              <button onClick={resetEmployeeForm} className="absolute right-3 top-3 text-[#8A8F98] hover:text-[#EDE7D8]">
                <X size={16} />
              </button>
              <p className="font-display mb-4 text-lg">{editingEmployeeId ? "Edit employee" : "Add employee"}</p>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="col-span-2 md:col-span-1">
                  <label className={labelCls}>Name</label>
                  <input value={employeeForm.name} onChange={(e) => setEmployeeForm((form) => ({ ...form, name: e.target.value }))} className={inputCls} placeholder="Employee name" />
                </div>
                <div>
                  <label className={labelCls}>Role</label>
                  <input value={employeeForm.role} onChange={(e) => setEmployeeForm((form) => ({ ...form, role: e.target.value }))} className={inputCls} placeholder="Operator" />
                </div>
                <div>
                  <label className={labelCls}>Venture</label>
                  <select value={employeeForm.venture} onChange={(e) => setEmployeeForm((form) => ({ ...form, venture: e.target.value }))} className={inputCls}>
                    {ventures.map((venture) => (
                      <option key={venture}>{venture}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Pay Type</label>
                  <select value={employeeForm.payType} onChange={(e) => setEmployeeForm((form) => ({ ...form, payType: e.target.value }))} className={inputCls}>
                    {PAY_TYPES.map((type) => (
                      <option key={type}>{type}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>{employeeForm.payType === "Salary" ? "Annual Salary" : "Hourly Rate"}</label>
                  <input type="number" step="0.01" min="0" value={employeeForm.rate} onChange={(e) => setEmployeeForm((form) => ({ ...form, rate: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Pay Periods / Year</label>
                  <input type="number" min="1" value={employeeForm.payPeriods} onChange={(e) => setEmployeeForm((form) => ({ ...form, payPeriods: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Default Hours</label>
                  <input type="number" step="0.01" min="0" value={employeeForm.defaultHours} onChange={(e) => setEmployeeForm((form) => ({ ...form, defaultHours: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Federal %</label>
                  <input type="number" step="0.01" min="0" max="100" value={employeeForm.federalPct} onChange={(e) => setEmployeeForm((form) => ({ ...form, federalPct: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>State %</label>
                  <input type="number" step="0.01" min="0" max="100" value={employeeForm.statePct} onChange={(e) => setEmployeeForm((form) => ({ ...form, statePct: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Local %</label>
                  <input type="number" step="0.01" min="0" max="100" value={employeeForm.localPct} onChange={(e) => setEmployeeForm((form) => ({ ...form, localPct: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Pre-Tax Deduct.</label>
                  <input type="number" step="0.01" min="0" value={employeeForm.preTaxDeductions} onChange={(e) => setEmployeeForm((form) => ({ ...form, preTaxDeductions: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Post-Tax Deduct.</label>
                  <input type="number" step="0.01" min="0" value={employeeForm.postTaxDeductions} onChange={(e) => setEmployeeForm((form) => ({ ...form, postTaxDeductions: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Employer Tax %</label>
                  <input type="number" step="0.01" min="0" max="100" value={employeeForm.employerTaxPct} onChange={(e) => setEmployeeForm((form) => ({ ...form, employerTaxPct: e.target.value }))} className={inputCls} />
                </div>
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 text-sm text-[#C7C2B4]">
                    <input type="checkbox" checked={employeeForm.active !== false} onChange={(e) => setEmployeeForm((form) => ({ ...form, active: e.target.checked }))} className="accent-[#B8902E]" />
                    Active employee
                  </label>
                </div>
              </div>
              <div className="mt-4 flex justify-end gap-3">
                <button onClick={resetEmployeeForm} className="px-4 py-2 text-xs uppercase tracking-widest text-[#8A8F98]">
                  Cancel
                </button>
                <button onClick={handleEmployeeSubmit} className="rounded-sm bg-[#B8902E] px-5 py-2 text-xs uppercase tracking-widest text-[#14171C] hover:bg-[#CBA544]">
                  {editingEmployeeId ? "Save employee" : "Add employee"}
                </button>
              </div>
            </div>
          )}

          {showRunForm && (
            <div className="relative mb-6 border ledger-rule bg-[#1A1D24] p-5">
              <button onClick={resetRunForm} className="absolute right-3 top-3 text-[#8A8F98] hover:text-[#EDE7D8]">
                <X size={16} />
              </button>
              <p className="font-display mb-4 text-lg">{editingRunId ? "Edit pay run" : "New pay run"}</p>
              {runEmployeeOptions.length === 0 ? (
                <p className="text-sm text-[#8A8F98]">Add an employee before recording a pay run.</p>
              ) : (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_240px]">
                  <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                    <div>
                      <label className={labelCls}>Employee</label>
                      <select value={runForm.employeeId} onChange={(e) => handleRunEmployeeChange(e.target.value)} className={inputCls}>
                        {runEmployeeOptions.map((employee) => (
                          <option key={employee.id} value={employee.id}>
                            {employee.name}{employee.active === false ? " (inactive)" : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Period Start</label>
                      <input type="date" value={runForm.periodStart} onChange={(e) => setRunForm((form) => ({ ...form, periodStart: e.target.value }))} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Period End</label>
                      <input type="date" value={runForm.periodEnd} onChange={(e) => setRunForm((form) => ({ ...form, periodEnd: e.target.value }))} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Pay Date</label>
                      <input type="date" value={runForm.payDate} onChange={(e) => setRunForm((form) => ({ ...form, payDate: e.target.value }))} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Hours</label>
                      <input type="number" step="0.01" min="0" value={runForm.hours} onChange={(e) => setRunForm((form) => ({ ...form, hours: e.target.value }))} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Bonus / Commission</label>
                      <input type="number" step="0.01" min="0" value={runForm.bonus} onChange={(e) => setRunForm((form) => ({ ...form, bonus: e.target.value }))} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Reimbursements</label>
                      <input type="number" step="0.01" min="0" value={runForm.reimbursements} onChange={(e) => setRunForm((form) => ({ ...form, reimbursements: e.target.value }))} className={inputCls} />
                    </div>
                    <div className="md:col-span-2">
                      <label className={labelCls}>Notes</label>
                      <input value={runForm.notes} onChange={(e) => setRunForm((form) => ({ ...form, notes: e.target.value }))} className={inputCls} placeholder="Optional payroll memo" />
                    </div>
                  </div>
                  <div className="border ledger-rule bg-[#14171C] p-4 text-sm">
                    <p className="mb-3 text-[10px] uppercase tracking-widest text-[#8A8F98]">Paycheck Preview</p>
                    {runPreview ? (
                      <div className="space-y-2 font-mono-fig">
                        <div className="flex justify-between"><span className="text-[#8A8F98]">Gross</span><span>{money(runPreview.grossPay)}</span></div>
                        <div className="flex justify-between"><span className="text-[#8A8F98]">Employee taxes</span><span>{money(runPreview.employeeTaxTotal)}</span></div>
                        <div className="flex justify-between"><span className="text-[#8A8F98]">Net pay</span><span className="text-[#8FAF97]">{money(runPreview.netPay)}</span></div>
                        <div className="flex justify-between border-t ledger-rule pt-2"><span className="text-[#8A8F98]">Employer cost</span><span className="text-[#B8902E]">{money(runPreview.employerCost)}</span></div>
                      </div>
                    ) : (
                      <p className="text-xs text-[#8A8F98]">Select an employee to preview.</p>
                    )}
                  </div>
                  <div className="flex justify-end gap-3 lg:col-span-2">
                    <button onClick={resetRunForm} className="px-4 py-2 text-xs uppercase tracking-widest text-[#8A8F98]">
                      Cancel
                    </button>
                    <button onClick={handleRunSubmit} className="rounded-sm bg-[#B8902E] px-5 py-2 text-xs uppercase tracking-widest text-[#14171C] hover:bg-[#CBA544]">
                      {editingRunId ? "Save pay run" : "Record payroll"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="border ledger-rule">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b ledger-rule text-[10px] uppercase tracking-widest text-[#8A8F98]">
                  <th className="px-3 py-2 text-left font-normal">Pay Date</th>
                  <th className="px-3 py-2 text-left font-normal">Employee / Period</th>
                  <th className="hidden px-3 py-2 text-left font-normal md:table-cell">Venture</th>
                  <th className="px-3 py-2 text-right font-normal">Gross</th>
                  <th className="hidden px-3 py-2 text-right font-normal md:table-cell">Taxes</th>
                  <th className="px-3 py-2 text-right font-normal">Net</th>
                  <th className="hidden px-3 py-2 text-right font-normal lg:table-cell">Employer Cost</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {filteredRuns.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-sm text-[#8A8F98]">
                      No pay runs yet. Add an employee, then record your first payroll.
                    </td>
                  </tr>
                )}
                {filteredRuns.map((run) => (
                  <tr key={run.id} className="group border-b ledger-rule hover:bg-[#1A1D24]">
                    <td className="font-mono-fig whitespace-nowrap px-3 py-3 text-[#C7C2B4]">{run.payDate}</td>
                    <td className="px-3 py-3">
                      <p className="text-[#EDE7D8]">{run.employeeName}</p>
                      <p className="text-xs text-[#8A8F98]">{run.periodStart} → {run.periodEnd} · {run.hours} hrs</p>
                    </td>
                    <td className="hidden px-3 py-3 md:table-cell">
                      <span className="inline-flex items-center gap-1.5 text-xs text-[#C7C2B4]">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full border ledger-rule bg-[#2A2E36] text-[9px] text-[#B8902E]">
                          {initials(run.venture)}
                        </span>
                        {run.venture}
                      </span>
                      {run.role && <p className="ml-7 text-[10px] text-[#8A8F98]">{run.role}</p>}
                    </td>
                    <td className="font-mono-fig px-3 py-3 text-right">{money(run.grossPay)}</td>
                    <td className="font-mono-fig hidden px-3 py-3 text-right text-[#C97066] md:table-cell">{money(run.employeeTaxTotal + run.employerTaxes)}</td>
                    <td className="font-mono-fig px-3 py-3 text-right text-[#8FAF97]">{money(run.netPay)}</td>
                    <td className="font-mono-fig hidden px-3 py-3 text-right text-[#B8902E] lg:table-cell">{money(run.employerCost)}</td>
                    <td className="px-3 py-3">
                      <div className="flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                        <button onClick={() => handleEditRun(run)} className="text-[#8A8F98] hover:text-[#B8902E]" aria-label={`Edit payroll for ${run.employeeName}`}>
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => persistRuns(payRuns.filter((item) => item.id !== run.id))} className="text-[#8A8F98] hover:text-[#C97066]" aria-label={`Delete payroll for ${run.employeeName}`}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              {filteredRuns.length > 0 && (
                <tfoot>
                  <tr>
                    <td colSpan={3} className="px-3 py-3 text-right text-[10px] uppercase tracking-widest text-[#8A8F98]">
                      Filtered total
                    </td>
                    <td className="font-mono-fig border-t-2 border-double border-[#B8902E] px-3 py-3 text-right">{money(totals.grossPay)}</td>
                    <td className="font-mono-fig hidden border-t-2 border-double border-[#B8902E] px-3 py-3 text-right text-[#C97066] md:table-cell">{money(totals.employeeTaxTotal + totals.employerTaxes)}</td>
                    <td className="font-mono-fig border-t-2 border-double border-[#B8902E] px-3 py-3 text-right text-[#8FAF97]">{money(totals.netPay)}</td>
                    <td className="font-mono-fig hidden border-t-2 border-double border-[#B8902E] px-3 py-3 text-right text-[#B8902E] lg:table-cell">{money(totals.employerCost)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        <aside className="space-y-8">
          <div className="border ledger-rule bg-[#1A1D24] p-4">
            <p className="mb-3 text-[10px] uppercase tracking-widest text-[#8A8F98]">Payroll Roster</p>
            <div className="space-y-3">
              {employees.length === 0 && <p className="text-xs text-[#8A8F98]">No employees yet. Start by adding a worker profile.</p>}
              {employees.map((employee) => (
                <div key={employee.id} className="flex items-start justify-between gap-3 border-b ledger-rule pb-3 last:border-b-0 last:pb-0">
                  <div>
                    <p className="text-sm text-[#EDE7D8]">
                      {employee.name} {employee.active === false && <span className="text-[10px] text-[#C97066]">inactive</span>}
                    </p>
                    <p className="text-xs text-[#8A8F98]">{employee.role || "No role"} · {employee.venture}</p>
                    <p className="font-mono-fig text-xs text-[#B8902E]">
                      {employee.payType === "Salary" ? `${money(numberValue(employee.rate))}/yr` : `${money(numberValue(employee.rate))}/hr`}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleEditEmployee(employee)} className="text-[#8A8F98] hover:text-[#B8902E]" aria-label={`Edit ${employee.name}`}>
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => handleDeleteEmployee(employee.id)} className="text-[#8A8F98] hover:text-[#C97066]" aria-label={`Delete ${employee.name}`}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-px bg-[#2A2E36] text-xs">
              <div className="bg-[#14171C] p-3">
                <p className="text-[10px] uppercase tracking-widest text-[#8A8F98]">Active</p>
                <p className="font-mono-fig text-lg">{activeEmployees.length}</p>
              </div>
              <div className="bg-[#14171C] p-3">
                <p className="text-[10px] uppercase tracking-widest text-[#8A8F98]">Next Gross</p>
                <p className="font-mono-fig text-lg">{money(estimatedNextGross)}</p>
              </div>
            </div>
          </div>

          <div>
            <p className="mb-3 text-[10px] uppercase tracking-widest text-[#8A8F98]">Employer cost by employee</p>
            <div className="space-y-2">
              {byEmployee.length === 0 && <p className="text-xs text-[#8A8F98]">Nothing to summarize yet.</p>}
              {byEmployee.map(([employee, amount]) => (
                <div key={employee}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-[#C7C2B4]">{employee}</span>
                    <span className="font-mono-fig">{money(amount)}</span>
                  </div>
                  <div className="h-1 bg-[#2A2E36]">
                    <div className="h-1 bg-[#B8902E]" style={{ width: `${(amount / maxEmployee) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-3 text-[10px] uppercase tracking-widest text-[#8A8F98]">Employer cost by venture</p>
            <div className="space-y-2">
              {byVenture.length === 0 && <p className="text-xs text-[#8A8F98]">Nothing to summarize yet.</p>}
              {byVenture.map(([venture, amount]) => (
                <div key={venture}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-[#C7C2B4]">{venture}</span>
                    <span className="font-mono-fig">{money(amount)}</span>
                  </div>
                  <div className="h-1 bg-[#2A2E36]">
                    <div className="h-1 bg-[#8FAF97]" style={{ width: `${(amount / maxVenture) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border ledger-rule p-4 text-xs leading-relaxed text-[#8A8F98]">
            <p className="mb-1 font-medium text-[#C7C2B4]">Payroll estimate disclaimer</p>
            <p>
              This app estimates payroll from configurable withholding percentages plus Social Security and Medicare. It is for planning and recordkeeping only — verify filings, wage bases, unemployment insurance, and local tax rules with a payroll provider or CPA.
            </p>
          </div>
        </aside>
      </main>
    </div>
  );
}
