# Red Room Models

A luxury-positioned marketplace for licensing bespoke AI "models" (personas)
and curated content packs to creators running AI-influencer accounts on
platforms like Fanvue.

The curated showcase (the original personas — Aurelia Vane, Séraphine Cole,
etc.) is still mock data baked into the app, always visible. Real submissions
— accounts, model listings, reference-image uploads, and orders — are backed
by [Supabase](https://supabase.com) (Postgres + Auth + Storage). The app runs
fine with no Supabase project connected: the showcase still works, but
sign-in, Creator Studio, and My Models will say so and won't let you submit.

## Stack

Vite + React + Tailwind CSS, matching the pattern used by `frontend/expense-ledger`
elsewhere in this repo, plus `@supabase/supabase-js` for auth/database/storage.

## Set up your own backend (~5 minutes)

You need your own free Supabase project — nothing here is shared or hosted for
you, and there's no way for me to create one on your behalf.

1. **Create a project** at [supabase.com](https://supabase.com) (free tier is enough).
2. **Run the schema** — open your project's SQL Editor, paste the contents of
   [`supabase/schema.sql`](./supabase/schema.sql), and run it. It creates the
   `profiles`, `models`, `model_images`, `content_packs`, and `orders` tables
   with Row Level Security policies already wired up. Safe to re-run.
3. **Create a storage bucket** — go to Storage → New bucket, name it exactly
   `model-references`, and leave "Public bucket" **unchecked** (reference
   images are private; only the uploading creator can read them back). The
   storage policies in `schema.sql` (bottom of the file) apply automatically
   once the bucket exists.
4. **Get your API keys** — Project Settings → API. Copy the Project URL and
   the `anon` public key.
5. **Configure the app** — copy `.env.example` to `.env.local` and fill in
   those two values:
   ```bash
   cp .env.example .env.local
   ```
6. **Email confirmations** — by default Supabase requires confirming a new
   account by email before it can sign in. For local testing you can turn
   this off under Authentication → Providers → Email → "Confirm email".

## Run it

```bash
npm install
npm run dev
```

## Product model

- **Model (persona)** — a named AI character with a bio, style/category tags, and
  two license tiers:
  - *Exclusive* — sold once, buyer gets sole rights, persona is retired from the
    marketplace.
  - *Shared* — non-exclusive, can be licensed to multiple buyers at a lower price.
- **Content pack** — a pre-generated media collection from a given model, sold as
  a standalone download/usage license without transferring rights to the model
  itself. (Schema is ready; Creator Studio doesn't collect packs yet — only
  the curated showcase personas have them.)

## How review works right now

Creator Studio inserts new submissions with `status = 'pending'` — they're
invisible on the public marketplace until approved. There's no admin UI yet;
as the operator, you approve or reject a submission by opening the `models`
table in the Supabase Table Editor and changing its `status` to `approved` or
`rejected` (optionally filling in `review_note`, which the creator sees on
their My Models page). This is literally "review by hand," which is what the
Trust & Compliance page promises — it's just not built out as an in-app queue
yet.

## Trust & Compliance (see `src/components/TrustPolicy.jsx`)

Every listing path requires creators to attest to: fully-synthetic origin or
documented model-release consent for any real-person likeness, zero tolerance
for depicting minors, and compliance with the destination platform's AI-content
disclosure rules. The compliance checklist and the "pending until reviewed"
gate are real and enforced by the schema now — but full production trust and
safety (identity/age verification, dedicated human moderation staffing, a
takedown/appeals process) is still out of scope for this build.

## What's still not real

- **Payments** — Checkout is a styled mock; no Stripe/payment processor is
  connected. Orders are recorded in the `orders` table on confirmation, but
  no money moves.
- **Content packs from Creator Studio** — creators can submit a model, not
  yet a pack of generated media for it.
- **Admin/moderation UI** — approval is done directly in the Supabase
  dashboard (see above), not in the app.
