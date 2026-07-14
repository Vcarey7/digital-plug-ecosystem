# DBWS BUILD — MASTER RUNBOOK

**Digital Plug Co. · Digital Black Wall Street** — *Sine Macula*
Single source of truth for the phased build. Hand this to your builder first.

---

## Locked decisions (do not re-litigate)

| Decision | Choice | Notes |
|---|---|---|
| Canonical registry architecture | **Six-registry DBWS Registry Suite** | Supersedes all older ENS-style and rental/equity versions. Ignore those. |
| Registries are separate contracts | **Yes — 6 distinct ERC-721s + RevenueRouter** | NOT merged into one contract. They interlock; they do not combine. |
| "Unified" means | **One dashboard frontend over all 6 registries** | Not a mega-contract. Phase 2. |
| Fee currency | **USDC now, $PLUG-ready** | Registries take a payment-token address; USDC default, switchable to $PLUG by config, no redeploy. |
| Chain | **Polygon** | Amoy testnet (80002) first, then mainnet (137). |
| Solidity / OZ | **0.8.20 / OpenZeppelin ^5.0.2** | |
| Frontend stack | **Vite + React + Tailwind + wagmi/ethers** | Match the existing expense-ledger app. (Confirm.) |
| TLD list source | **The 246-TLD catalog (`tld/catalog.js`) IS canonical** | Confirmed final by Vance. Do not substitute, prune, or "correct" names. Seed all 246 as-is. |

---

## Phase plan

### Phase 1 — Registry contracts (native-POL version) ✅ BUILT
Six registries + RevenueRouter, compiled/tested/deployed. Deploy prompt:
`BUILD_PROMPT_PHASE1.md`. This is the baseline.

### Phase 2 — USDC conversion + full TLD seed + Unified Dashboard
- **2a. USDC conversion** — change all six registries' fee paths from native
  POL (`msg.value` / `payable`) to a USDC `transferFrom` pattern with a
  configurable payment-token address (so $PLUG can be swapped in later). Spec:
  `USDC_CONVERSION_SPEC.md`.
- **2b. Full TLD seed** — load every TLD into PlugRegistry via `configureTLD`,
  batched, with USDC tier pricing. Catalog: `TLD_CATALOG.md`. Script:
  `scripts/seedTLDs.js`.
- **2c. Unified Dashboard** — one frontend, six views, wired to
  `deployments/<network>/addresses.json`. Prompt: `BUILD_PROMPT_PHASE2_UI.md`.

### Phase 3 — DNS dual-layer
Namecheap reseller + Supabase pricing + checkout, so traditional domains sell
alongside on-chain names.

### Phase 4 — Tokens + core DeFi
$PLUG, $WALL, $MFT, staking, savings, forge. (From the `dbws-contracts` suite.)
Once $PLUG is live, flip registry fees from USDC to $PLUG via config.

### Phase 5 — NerdTV / media
Content registry, royalties, watch-to-earn.

### Phase 6 — Agents + AI access
Metered agent gateway, AI subscription NFTs. (Agents live in n8n; contracts are
the access/billing layer only.)

### Phase 7 — Governance
$WALL DAO, timelock, The Orders voting wired to CommunityRegistry.

---

## Universal build rules (apply to EVERY phase prompt)

1. **Do not redesign the canonical architecture.** If something seems wrong,
   STOP and report — do not change it unilaterally.
2. **Do not adopt uploaded alternative versions** of a component even if they
   look more complete. If a file conflicts with the canonical source, STOP and
   ask which to use.
3. **Do not skip or delete tests to make them pass.** Fix the cause.
4. **Testnet before mainnet, always.** Mainnet only after explicit human
   approval, per phase.
5. **Never invent or commit real keys.** The human supplies `.env`.
6. **Report every change made to provided code**, with the reason.
7. **Stay in phase.** If asked to do a later phase's work, say so and stay on
   task.

---

## What the human provides

- `.env` values (private key, RPC URLs, Polygonscan key, treasury address,
  USDC address for the target chain).
- The master TLD list (if it exists) — otherwise we seed the reconstructed 246.
- Go/no-go approval at each testnet→mainnet gate.

## USDC addresses (fill at deploy)
- Polygon mainnet USDC (native): `0x3c499c542cEF5E3811e1192ce70d8cc03d5c3359`
- Polygon Amoy USDC (test): deployer provides a test USDC or mock.
