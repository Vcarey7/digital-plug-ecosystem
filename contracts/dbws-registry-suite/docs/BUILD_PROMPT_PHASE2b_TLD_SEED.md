# BUILD PROMPT — PHASE 2b: Seed All TLDs

## Your role
Deployment engineer. Load every TLD from the catalog into the deployed
PlugRegistry with USDC tier pricing. This is a data-loading task, not a design
task.

## Prerequisites
- Phase 1 deployed (PlugRegistry address in `deployments/<network>/addresses.json`).
- Phase 2a USDC conversion complete (fees are USDC 6-decimal).

## Source of truth
- TLD list: `tld/catalog.js` — 246 unique TLDs, deduped, tier + category +
  reserved status. Do NOT hand-edit the list; if names are wrong, report which.
- Pricing: USDC per tier, defined in `scripts/seedTLDs.js`:
  - LEGENDARY 497/yr · GOLD 197/yr · STANDARD 97/yr · STARTER 29/yr
  - Reserved (protocol-held) TLDs are listed but **disabled** for public
    registration (admin mints under them separately).

## Tasks
1. Confirm `deployments/<network>/addresses.json` has PlugRegistry.
2. `node tld/catalog.js` — sanity-check the count prints ~246.
3. Run `npx hardhat run scripts/seedTLDs.js --network amoy`.
4. Confirm `deployments/<network>/tld-manifest.json` is written listing every
   TLD with its tier, price, and enabled/reserved flag.
5. Spot-check on-chain: read `registrationFee("plug")`, `tldEnabled("plug")`,
   and one reserved TLD (should be enabled=false). Report the values.
6. STOP. Report the manifest summary and wait before mainnet.

## HARD RULES
- Do NOT change tier pricing without the human's explicit sign-off — these are
  business numbers.
- Do NOT enable reserved TLDs for public registration.
- The 246-TLD catalog in `tld/catalog.js` is FINAL and confirmed. Seed all 246
  as-is. Do NOT prune, rename, add, or "correct" TLD names.
- Idempotent: re-running re-sets prices; that's fine. Do not duplicate.

## Definition of done
- All catalog TLDs configured on-chain with correct USDC tier pricing.
- Reserved TLDs listed but disabled.
- tld-manifest.json committed.
- Spot-check values reported.
