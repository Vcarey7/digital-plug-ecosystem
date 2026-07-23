# digital-plug-ecosystem

Digital Plug Co. & DBWS complete ecosystem — agents, workflows, frontend, and documentation.

## Finance Suite (Expense Ledger + Payroll App + Income Ledger)

The runnable app lives in `frontend/expense-ledger/` and now includes three tools behind one Vite/React interface:

- **Expense Ledger** — multi-venture expense tracking, category deduction percentages, receipt flags, filters, summaries, and CSV export.
- **Payroll App** — employee roster, configurable withholding percentages, pay-run calculator, net pay/employer-cost summaries, and CSV export.
- **Income Documentation Ledger** — billable-hours tracking for self-employment proof of income, 30/60/90-day filters, printable housing packet, CSV export, monthly/client summaries, and a rent-readiness snapshot.

All tools store data in browser `localStorage`, so they run without a backend.

### Quick start from the repo root

```bash
npm run install:apps
npm run dev
```

Vite will print a local URL, usually `http://localhost:5173`.

### Build and preview

```bash
npm run build
npm run preview
```

You can also run the same commands directly from `frontend/expense-ledger/` with `npm install`, `npm run dev`, `npm run build`, and `npm run preview`.
