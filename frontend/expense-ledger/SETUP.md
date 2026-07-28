# Going live: accounts, keys, and deployment

Supabase and Stripe are already provisioned (below). **Vercel is the only
remaining step**, and it has to be done in your dashboard — secret keys should
only ever be pasted there, never into a chat.

## 1. Supabase — done

Reusing the existing "Plug time app" project (`fdeizufozekaytwjbstg`). The
schema in [`supabase/schema.sql`](./supabase/schema.sql) has been applied:

- `app_data` — one JSON row per (user, feature) holding that user's expenses,
  ventures, payroll roster/runs, and income entries/profile. RLS means each
  user only ever sees their own rows.
- `subscriptions` — one row per user tracking Stripe status. Users can read
  their own row; only the webhook (service role key) can write to it.

Values you'll need for Vercel:
- `VITE_SUPABASE_URL` = `https://fdeizufozekaytwjbstg.supabase.co`
- `VITE_SUPABASE_ANON_KEY` = the `anon` key from **Settings → API** in the
  [Supabase dashboard](https://supabase.com/dashboard/project/fdeizufozekaytwjbstg/settings/api-keys)
- `SUPABASE_SERVICE_ROLE_KEY` = the `service_role` key from that same page
  (**secret** — this one isn't retrievable through my tools on purpose; copy
  it yourself)

⚠️ **Separate security issue found in this project, unrelated to this app:**
four existing tables — `income_entries`, `employees`, `payroll_runs`,
`verifications` — have Row-Level Security **disabled**, meaning anyone with
the public anon key can currently read or write every row in them. I didn't
touch these (turning on RLS without matching policies would break whatever
depends on them) or investigate what created them. Worth a look before this
goes live publicly:
```sql
ALTER TABLE public.income_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verifications ENABLE ROW LEVEL SECURITY;
```
(Only run this once you've added matching policies — enabling RLS with no
policies blocks all access, including your own.)

Once you know your Vercel URL (step 3 below), also add it under
**Authentication → URL Configuration** as a Redirect URL and Site URL.

## 2. Stripe — done

Product **"DPC Finance Suite"** created at **$15/month**
(`price_1Ty94KLuvBwmNQqhG1UnLRj6`) on your existing "Green Pay" Stripe account.

Values you'll need for Vercel:
- `STRIPE_PRICE_ID` = `price_1Ty94KLuvBwmNQqhG1UnLRj6`
- `STRIPE_SECRET_KEY` = from [Stripe API keys](https://dashboard.stripe.com/acct_1RJPQ2LuvBwmNQqh/apikeys)
  (**secret** — not retrievable through my tools; copy it yourself)

Still to do, *after* the first Vercel deploy (once you know the real domain):

**Developers → Webhooks → Add endpoint**:
- URL: `https://<your-vercel-domain>/api/stripe-webhook`
- Events to send: `checkout.session.completed`, `customer.subscription.created`,
  `customer.subscription.updated`, `customer.subscription.deleted`
- Copy the **Signing secret** (`whsec_...`) → `STRIPE_WEBHOOK_SECRET`, add it
  to Vercel, and redeploy.

## 3. Vercel — the only step left

1. Import this GitHub repo as a new Vercel project.
2. In the import screen (or **Settings → General** after import), set
   **Root Directory** to `frontend/expense-ledger`. Framework preset should
   auto-detect as **Vite**.
3. Under **Settings → Environment Variables**, add all of these (Production
   and Preview):

   | Name | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | `https://fdeizufozekaytwjbstg.supabase.co` |
   | `VITE_SUPABASE_ANON_KEY` | from Supabase dashboard (see above) |
   | `SUPABASE_SERVICE_ROLE_KEY` | from Supabase dashboard (secret, see above) |
   | `STRIPE_SECRET_KEY` | from Stripe dashboard (secret, see above) |
   | `STRIPE_PRICE_ID` | `price_1Ty94KLuvBwmNQqhG1UnLRj6` |
   | `STRIPE_WEBHOOK_SECRET` | added after first deploy, see above |
   | `APP_URL` | your Vercel production URL, e.g. `https://finance-suite.vercel.app` (no trailing slash) |

4. Deploy. Once it's live, go back and finish the Stripe webhook and Supabase
   redirect URL using the real domain, then redeploy so `APP_URL` is set.

## What this gets you

- Sign up / sign in (email + password, Supabase Auth).
- Every user's expenses, payroll, and income data lives in Postgres, scoped to
  their account (`app_data` table) — not the browser's localStorage anymore.
- New users land on a **Subscribe** screen (`PaywallGate`) until they complete
  Stripe Checkout; the webhook flips their `subscriptions.status` to `active`
  and they get in.
- A **Billing** button in the nav opens the Stripe customer portal so
  subscribers can update their card or cancel without emailing you.

## What this doesn't include yet (worth deciding on before launch)

- **Pricing page / marketing site.** Right now the only "storefront" is the
  in-app Subscribe screen after someone creates an account. If you want a
  public landing page before sign-up, that's a separate build.
- **Free trial.** Stripe supports trial periods on a Price or Checkout Session;
  ask if you want one wired in.
- **Failed-payment grace period.** `past_due` subscriptions are currently
  treated as locked-out immediately. If you want a grace window, that's a
  small change to `useSubscription`'s active-status check.
- **Data migration for existing users.** Anyone who used the old
  localStorage-only version will not see that data automatically — it never
  left their browser. If that matters, say so and I'll write a one-time
  "import from this browser" tool.
