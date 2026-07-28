-- Run this once in the Supabase project's SQL editor (Dashboard -> SQL Editor -> New query).
-- Safe to re-run: every statement is idempotent.

-- ---------------------------------------------------------------------------
-- app_data: one JSON blob per (user, key). Mirrors the app's old localStorage
-- keys 1:1 (expenses, ventures, dpcPayrollEmployees, dpcPayrollRuns,
-- dpcIncomeLedgerEntries, dpcIncomeLedgerProfile) so each user gets their own
-- private copy of everything, synced across devices.
-- ---------------------------------------------------------------------------
create table if not exists public.app_data (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  key text not null,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table public.app_data enable row level security;

drop policy if exists "app_data: users manage their own rows" on public.app_data;
create policy "app_data: users manage their own rows"
  on public.app_data
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- subscriptions: one row per user, kept in sync by the Stripe webhook
-- (server-side, using the service role key which bypasses RLS). Users can
-- read their own row but never write it directly from the browser.
-- ---------------------------------------------------------------------------
create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  status text not null default 'none',
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

drop policy if exists "subscriptions: users read their own row" on public.subscriptions;
create policy "subscriptions: users read their own row"
  on public.subscriptions
  for select
  using (auth.uid() = user_id);

-- No insert/update/delete policy is defined for the `authenticated` role on
-- purpose: only the webhook (using the service role key, which bypasses RLS
-- entirely) is allowed to write subscription status.
