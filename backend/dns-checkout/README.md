# DBWS DNS Checkout — Phase 3 backend

Traditional-DNS rail alongside the on-chain registry, per
`contracts/dbws-registry-suite/docs/BUILD_PROMPT_PHASE3_DNS.md`. Lets
customers buy real, browser-resolving domains (Namecheap, Stripe) in the
same checkout as on-chain `.plug`/`.dbws` names — without touching the
Phase 1/2 registry contracts.

## Architecture

- **Database:** Supabase Postgres, project `dbws-dns-checkout`
  (`gcninnkvpdspqdwztjvs`, org "Digital plug co"). Schema: `dns_tlds`,
  `customers`, `orders` — see the `phase3_dns_dual_layer_schema` and
  `orders_add_years` migrations for the exact DDL. RLS is enabled on all
  three tables with no policies: only this backend's service-role key
  (which bypasses RLS) ever touches them. **The frontend never talks to
  Supabase directly** — it only calls this API.
- **Registrar:** Namecheap reseller XML API, sandbox by default
  (`src/services/namecheap.js`).
- **Payments:** Stripe (`src/services/stripe.js`) for DNS purchases; the
  existing on-chain USDC path (unchanged) for on-chain names. This backend
  only *records* on-chain purchases after the fact (`POST
  /api/orders/onchain`) — it never initiates or touches that payment.
- **Money:** always an integer — USD cents for DNS/Stripe, USDC 6dp for
  on-chain (matches the contracts' own units). Never a float, in the API
  or the database.

## Setup

```bash
npm install
cp .env.example .env   # fill in values below
npm run dev             # http://localhost:4100
```

### Required env vars

| Var | Where to get it |
|---|---|
| `SUPABASE_URL` | Already filled in `.env.example` — `https://gcninnkvpdspqdwztjvs.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase dashboard → this project → Project Settings → API → `service_role` secret key. **Never commit, never paste into chat** — it bypasses RLS on every table. |
| `NAMECHEAP_API_USER` / `NAMECHEAP_API_KEY` / `NAMECHEAP_USERNAME` / `NAMECHEAP_CLIENT_IP` | See **Namecheap sandbox signup** below. |
| `STRIPE_SECRET_KEY` | Stripe dashboard → Developers → API keys → test mode secret key (`sk_test_...`). |
| `STRIPE_WEBHOOK_SECRET` | Stripe dashboard → Developers → Webhooks → add an endpoint for `/api/checkout/stripe-webhook` → its signing secret (`whsec_...`). For local dev, use the Stripe CLI instead: `stripe listen --forward-to localhost:4100/api/checkout/stripe-webhook` prints a `whsec_` secret directly. |
| `DNS_MARKUP_RATE` | Defaults to `0.4` (40% over Namecheap wholesale) — change as a business decision, not a technical one. |

Until Namecheap/Stripe vars are set, their routes return a clean `503`
rather than crashing or faking success — confirmed by booting the server
with only Supabase configured (`GET /health` → `200`, `GET
/api/domains/search` → `503` with a clear "not configured" message).

### Namecheap sandbox signup (10-15 min, one-time)

1. Create an account at **https://www.sandbox.namecheap.com** (a separate
   signup from your real Namecheap account — sandbox has its own fake
   "balance" to register test domains against, no real money).
2. Log in → **Profile → Tools → API Access** → enable API access.
3. Note your sandbox username, generate an **API Key**, and find your
   current public IP (e.g. `curl ifconfig.me`) to **whitelist** it in the
   same screen — Namecheap rejects every call from a non-whitelisted IP
   regardless of key correctness. Re-whitelist if your IP changes.
4. Set `NAMECHEAP_API_USER` and `NAMECHEAP_USERNAME` to your sandbox
   username (the two are usually the same), `NAMECHEAP_API_KEY` to the
   generated key, `NAMECHEAP_CLIENT_IP` to the whitelisted IP.
5. Leave `NAMECHEAP_API_BASE` as the sandbox URL
   (`https://api.sandbox.namecheap.com/xml.response`) until a human
   approves going live, per the project's testnet/sandbox-first rule.

## Running the pricing sync job

```bash
npm run sync-pricing
```

Pulls Namecheap's current wholesale pricing for every TLD they sell and
upserts `dns_tlds` with `DNS_MARKUP_RATE` applied. Run it on a schedule
(n8n or cron) — it's idempotent (an upsert keyed on `tld`).

## Known gaps (flagging rather than hiding)

- **Registrant contact info** is held in an in-memory `Map` between
  PaymentIntent creation and webhook confirmation
  (`checkout.js`'s `pendingContacts`). Fine for a single-process
  sandbox/dev deployment; a real production deploy needs this persisted
  (its own table, or encrypted alongside the order) so a process restart
  between checkout and webhook doesn't lose it. Flagged rather than
  silently shipped as if it were durable.
- No admin/retry endpoint yet for an order stuck in `failed` (e.g.
  Namecheap registration failed after Stripe already charged the card) —
  today that needs a manual look at the `orders` table and a direct
  Namecheap/Stripe dashboard action.

## Hard rules this backend follows (from the Phase 3 build prompt)

- Namecheap and Stripe secret keys live server-side only — env vars,
  never in frontend code or committed (`.gitignore` excludes `.env`).
- Sandbox/test mode for both until a human explicitly approves live.
- Registry contracts are never touched by this backend.
- Money is integer cents / 6dp USDC, never floats.
- Every write that can be retried (checkout, webhook, on-chain order
  recording) is idempotent via `orders.idempotency_key` (unique
  constraint) — a retried payment or redelivered webhook cannot
  double-register a domain.
