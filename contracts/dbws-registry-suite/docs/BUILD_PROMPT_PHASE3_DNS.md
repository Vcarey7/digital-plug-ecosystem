# BUILD PROMPT — PHASE 3: DNS Dual-Layer (Traditional Domains)

## Your role
Full-stack engineer. Add a traditional-DNS rail alongside the on-chain registry
so customers can buy real, working domains (that resolve in browsers) in the
same checkout as Plug on-chain names. Do NOT touch the Phase 1/2 registry
contracts.

## Why
The on-chain registry gives sovereign, permanent names. The DNS layer gives
names that work in a browser today. Selling both from one storefront is the
full product. This phase is web2 integration, not smart contracts.

## Canonical architecture (locked)
- **Registrar backend:** Namecheap reseller API (sandbox first, then live).
- **Data + pricing:** Supabase (Postgres) — TLD price table, orders, customer
  records, order status.
- **Payments:** Stripe (card) + the existing on-chain USDC path for crypto.
- **Frontend:** same Vite + React + Tailwind app as the Phase 2c dashboard —
  add a "Domains" section, do not build a separate app.

## Tasks
1. Supabase schema: `dns_tlds` (tld, wholesale_cost, retail_price, active),
   `orders` (id, customer, domain, type[dns|onchain], status, amount, tx/stripe
   ref), `customers`.
2. Namecheap service (sandbox): check availability, price, register, set
   nameservers/DNS records, renewal. Wrap in a backend API (Node/Express or
   Supabase Edge Functions) — never expose Namecheap keys to the frontend.
3. Pricing sync job: pull Namecheap wholesale costs, apply markup rule, upsert
   into `dns_tlds`. Runnable on a schedule (n8n or cron).
4. Checkout: unified cart that can hold DNS names (Stripe) and on-chain names
   (USDC via the registry). One order record per purchase.
5. Frontend "Domains" view: search → shows both DNS availability (Namecheap)
   and on-chain availability (PlugRegistry.isAvailable) → add to cart → checkout.

## HARD RULES
- Namecheap and Stripe secret keys live server-side ONLY (env vars / Supabase
  secrets). Never in frontend code or committed.
- Sandbox/test mode for BOTH Namecheap and Stripe until the human approves live.
- Do NOT modify registry contracts. On-chain purchases call existing contracts.
- Store money amounts as integer cents / 6-dp USDC — never floats.
- Idempotent order handling: a retried payment must not double-register.

## Definition of done
- Search returns both DNS and on-chain availability for a query.
- Buy a DNS domain end-to-end in Namecheap sandbox + Stripe test → order row
  written, domain shows registered.
- Buy an on-chain name in the same checkout flow.
- Pricing sync populates `dns_tlds` with markup applied.
- All secrets server-side; README documents required env vars.

## Out of scope
- On-chain contract changes (done in Phase 1/2).
- Tokens/DeFi (Phase 4+).
