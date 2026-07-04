# Business Expense Ledger

A multi-venture business expense tracker with per-category tax deduction
percentages (e.g. meals at 50%), CSV export, and category/venture summaries.
Data is stored in the browser's `localStorage`.

## Run locally

```bash
npm install
npm run dev
```

Then open the printed local URL (defaults to http://localhost:5173).

## Build

```bash
npm run build
```

Outputs a static bundle to `dist/`, which can be hosted on any static file server.

## Deployment (GitHub Pages)

A workflow at `.github/workflows/deploy-expense-ledger.yml` builds this app and
publishes it to GitHub Pages automatically on every push to `main` that touches
`frontend/expense-ledger/`.

One-time setup (repo admin): go to **Settings → Pages** and set **Source** to
**GitHub Actions**. After that, the site deploys automatically and the URL
appears in the workflow run summary (and under Settings → Pages), typically
`https://<owner>.github.io/<repo>/`.

You can also trigger a deploy manually from the **Actions** tab via
"Deploy Expense Ledger to GitHub Pages" → **Run workflow**.
