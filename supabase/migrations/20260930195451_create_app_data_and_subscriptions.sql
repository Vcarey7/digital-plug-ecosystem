/*
# Create app_data and subscriptions tables for DPC Finance Suite

1. Purpose
   The Finance Suite is a multi-user subscription app (sign-in required).
   Each user needs private storage for their expenses, payroll, and income
   data, plus a subscription status row that only the Stripe webhook can write.

2. New Tables
   - `app_data`: one JSON blob per (user, key). Mirrors the app's localStorage
     keys (expenses, ventures, dpcPayrollEmployees, dpcPayrollRuns,
     dpcIncomeLedgerEntries, dpcIncomeLedgerProfile) so each user gets their
     own private copy synced across devices.
     Columns: user_id (uuid, PK part, defaults to auth.uid()), key (text, PK part),
     value (jsonb), updated_at (timestamptz).
   - `subscriptions`: one row per user tracking Stripe subscription status.
     Written by the Stripe webhook (service role key, bypasses RLS).
     Columns: user_id (uuid, PK), stripe_customer_id (text),
     stripe_subscription_id (text), status (text), current_period_end (timestamptz),
     updated_at (timestamptz).

3. Security
   - RLS enabled on both tables.
   - `app_data`: users can CRUD only their own rows (auth.uid() = user_id).
     user_id defaults to auth.uid() so inserts that omit it still pass the
     WITH CHECK policy.
   - `subscriptions`: users can SELECT their own row only. No INSERT/UPDATE/DELETE
     policy for authenticated role — only the webhook (service role key) can write.

4. Important Notes
   - This migration is idempotent (uses IF NOT EXISTS and DROP POLICY IF EXISTS).
   - The subscriptions table intentionally has no write policies for the
     authenticated role; the Stripe webhook uses the service role key which
     bypasses RLS entirely.
*/

-- app_data: per-user JSON storage keyed by feature name
CREATE TABLE IF NOT EXISTS public.app_data (
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
  key text NOT NULL,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, key)
);

ALTER TABLE public.app_data ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_data: users manage their own rows" ON public.app_data;
CREATE POLICY "app_data: users manage their own rows"
  ON public.app_data
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- subscriptions: one row per user, written by Stripe webhook only
CREATE TABLE IF NOT EXISTS public.subscriptions (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  stripe_customer_id text,
  stripe_subscription_id text,
  status text NOT NULL DEFAULT 'none',
  current_period_end timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "subscriptions: users read their own row" ON public.subscriptions;
CREATE POLICY "subscriptions: users read their own row"
  ON public.subscriptions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- No INSERT/UPDATE/DELETE policy for authenticated role on subscriptions.
-- Only the Stripe webhook (using the service role key, which bypasses RLS)
-- is allowed to write subscription status.