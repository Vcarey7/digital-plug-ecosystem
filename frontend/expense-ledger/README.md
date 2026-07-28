# DPC Finance Suite

A runnable Vite + React finance suite for Digital Plug Co. It includes:

- **Business Expense Ledger** — track expenses across ventures, default per-category tax deduction percentages (for example, meals at 50%), receipt flags, category/venture summaries, and CSV export.
- **Payroll App** — manage a roster, estimate pay runs from hourly or salary workers, configure federal/state/local withholding percentages, calculate net pay and employer cost, summarize payroll by employee/venture, and export CSV files.
- **Income Documentation Ledger** — log billable hours by client/source, auto-calculate hourly income, filter 30/60/90-day proof windows, print a clean self-employment income ledger for housing applications, export CSV, and track a rent-readiness Shelter Score.

Data is stored locally in the browser via `localStorage`; no backend or login is required.

## Run locally

From this directory:

```bash
npm install
npm run dev
```

Vite defaults to `http://localhost:5173`.

You can also run from the repository root:

```bash
npm run install:apps
npm run dev
```

## Build

```bash
npm run build
```

The static bundle is written to `dist/`.

## Preview the production build

```bash
npm run preview
```

## Deployment (GitHub Pages)

The workflow at `.github/workflows/deploy-expense-ledger.yml` builds and publishes the static app on every push to `main` touching `frontend/expense-ledger/`. One-time setup: Settings → Pages → Source → GitHub Actions.

## Notes

- The income ledger is for honest self-employment documentation. Log actual work only and attach matching invoices, bank deposits, contracts, or client communications when available.
- The payroll app uses configurable estimate percentages and built-in Social Security/Medicare calculations for planning. Verify official payroll filings, wage bases, unemployment insurance, and local tax rules with a payroll provider or CPA.
- The expense ledger organizes records and exports accountant-friendly CSVs; it is not tax advice.
