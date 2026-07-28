# DPC Finance Suite

A runnable Vite + React finance suite for Digital Plug Co. It includes:

- **Business Expense Ledger** — track expenses across ventures, default per-category tax deduction percentages (for example, meals at 50%), receipt flags, category/venture summaries, and CSV export.
- **Payroll App** — manage a roster, estimate pay runs from hourly or salary workers, configure federal/state/local withholding percentages, calculate net pay and employer cost, summarize payroll by employee/venture, and export CSV files.
- **Income Documentation Ledger** — log billable hours by client/source, auto-calculate hourly income, filter 30/60/90-day proof windows, print a clean self-employment income ledger for housing applications, export CSV, and track a rent-readiness Shelter Score.

It's a subscription product: sign-up/sign-in is backed by Supabase Auth, each
user's data lives in Postgres (scoped to their account, not the browser), and
access is gated behind an active Stripe subscription. See
[`SETUP.md`](./SETUP.md) for the one-time account setup (Supabase, Stripe,
Vercel) required before any of this works.

## Run locally

Copy `.env.example` to `.env.local` and fill in the Supabase values (see
`SETUP.md`) — the app won't boot without them. From this directory:

```bash
npm install
npm run dev
```

Vite defaults to `http://localhost:5173`. The `/api` serverless functions
(Stripe checkout, billing portal, webhook) only run when deployed to Vercel —
`vercel dev` can emulate them locally if needed.

## Build

```bash
npm run build
```

The static bundle is written to `dist/`.

## Preview the production build

```bash
npm run preview
```

## Deployment

Hosted on Vercel (not GitHub Pages — Pages can't run the `/api` serverless
functions Stripe needs). See [`SETUP.md`](./SETUP.md) for the full walkthrough.

## Notes

- The income ledger is for honest self-employment documentation. Log actual work only and attach matching invoices, bank deposits, contracts, or client communications when available.
- The payroll app uses configurable estimate percentages and built-in Social Security/Medicare calculations for planning. Verify official payroll filings, wage bases, unemployment insurance, and local tax rules with a payroll provider or CPA.
- The expense ledger organizes records and exports accountant-friendly CSVs; it is not tax advice.
