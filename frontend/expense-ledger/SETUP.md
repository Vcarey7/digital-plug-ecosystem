# Going live: accounts, keys, and deployment

The app now requires three external accounts before anyone can sign up or pay:
**Supabase** (accounts + database), **Stripe** (billing), and **Vercel** (hosting —
GitHub Pages can't run the serverless functions Stripe needs). None of these
steps can be done on your behalf; each one needs your own account. Secret keys
should only ever be pasted into Supabase/Stripe/Vercel's own dashboards — never
into a chat.

## 1. Supabase

1. Create a project at [supabase.com](https://supabase.com) (free tier is fine to start).
2. Open **SQL Editor** → **New query**, paste the contents of
   [`supabase/schema.sql`](./supabase/schema.sql), and run it. This creates:
   - `app_data` — one JSON row per (user, feature) holding that user's expenses,
     ventures, payroll roster/runs, and income entries/profile. Row-level
     security means each user can only ever see their own rows.
   - `subscriptions` — one row per user tracking their Stripe status. Users can
     read their own row; only the Stripe webhook (via the service role key)
     can write to it.
3. Under **Authentication → Providers**, email/password is enabled by default —
   nothing else to change unless you want to add Google/etc. later.
4. Under **Authentication → URL Configuration**, once you know your Vercel URL
   (step 3 below), add it as a **Redirect URL** and **Site URL**.
5. Grab three values from **Settings → API**:
   - `Project URL` → `VITE_SUPABASE_URL`
   - `anon` `public` key → `VITE_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (**secret** — server-side only, never in the browser bundle)

## 2. Stripe

1. In the Stripe Dashboard, create a **Product** (e.g. "DPC Finance Suite") with
   a recurring **Price** (monthly or yearly). Copy its price ID (`price_...`) →
   `STRIPE_PRICE_ID`.
2. **Developers → API keys** → copy the **Secret key** → `STRIPE_SECRET_KEY`.
   (The app never uses a publishable key — checkout happens via Stripe-hosted
   Checkout Sessions, not Stripe.js in the browser.)
3. **Developers → Webhooks → Add endpoint**:
   - URL: `https://<your-vercel-domain>/api/stripe-webhook`
   - Events to send: `checkout.session.completed`, `customer.subscription.created`,
     `customer.subscription.updated`, `customer.subscription.deleted`
   - Copy the **Signing secret** (`whsec_...`) → `STRIPE_WEBHOOK_SECRET`
   - You'll need to create this *after* the first Vercel deploy, once you have
     a real domain to point it at (a placeholder deploy works fine first, then
     come back and add the webhook once you know the URL).

## 3. Vercel

1. Import this GitHub repo as a new Vercel project.
2. In the import screen (or **Settings → General** after import), set
   **Root Directory** to `frontend/expense-ledger`. Framework preset should
   auto-detect as **Vite**.
3. Under **Settings → Environment Variables**, add all of these (Production
   and Preview):

   | Name | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | from Supabase step 5 |
   | `VITE_SUPABASE_ANON_KEY` | from Supabase step 5 |
   | `SUPABASE_SERVICE_ROLE_KEY` | from Supabase step 5 (secret) |
   | `STRIPE_SECRET_KEY` | from Stripe step 2 (secret) |
   | `STRIPE_PRICE_ID` | from Stripe step 1 |
   | `STRIPE_WEBHOOK_SECRET` | from Stripe step 3 (secret, added after first deploy) |
   | `APP_URL` | your Vercel production URL, e.g. `https://finance-suite.vercel.app` (no trailing slash) |

4. Deploy. Once it's live, go back and finish Stripe step 3 (webhook) and
   Supabase step 4 (redirect URL) using the real domain, then redeploy so
   `APP_URL` is set.

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
