# DBWS Registry Suite

**Digital Plug Co. · Digital Black Wall Street** — *Sine Macula*

Six on-chain registries that make every significant DBWS asset sovereign,
permanent, and verifiable. **This is the canonical DBWS registry
architecture** — it supersedes both the earlier ENS-style
`contracts/domain-registry` and `contracts/dbws-suite`'s flat-namespace
`PlugRegistry`; see `MASTER_RUNBOOK.md`'s locked decisions. Targets
**Polygon** (Amoy testnet + mainnet). Solidity `0.8.20` (pinned to `0.8.24`
in `hardhat.config.js` for OZ v5 compatibility), OpenZeppelin `^5.0.2`.

Status: **Phase 1 (contracts) + Phase 2a (USDC fees) + Phase 2b (246-TLD
seed) complete.** Phase 2c (unified dashboard frontend), Phase 3 (DNS
dual-layer), and Phases 4-7 (tokens/DeFi, NerdTV, agents, governance) are
separate, not-yet-started phases — see `docs/MASTER_RUNBOOK.md`.

---

## The six registries

| # | Contract | What it registers | Fee (USDC/yr or per-action) |
|---|---|---|---|
| 1 | `PlugRegistry` | TLDs + domain names (commit-reveal protected, transferable, renewable, lockable as $DPNOTE collateral) | per-TLD tier (see TLD catalog) |
| 2 | `EntityRegistry` | Business entities / LLCs, linked to domains | 97 |
| 3 | `IPRegistry` | Intellectual property + on-chain licenses | 47 |
| 4 | `NoteRegistry` | $DPNOTE private-credit portfolio (ledger, USDC-denominated) — **legal hold, see below** | — (owner-originated) |
| 5 | `LicenseRegistry` | Cannabis licenses + compliance events + renewal alerts | 197 |
| 6 | `CommunityRegistry` | The Orders membership, tiers, $WALL voting, soulbound founders | 0 / 97 / 497 / 1997 by tier |

Plus `RevenueRouter` — the shared USDC fee sink every fee-charging registry
transfers to directly, so fee policy changes without redeploying registries.

All fees are paid in **USDC** (6 decimals) via ERC-20 `approve` +
`transferFrom` — not native POL. Every registry (and RevenueRouter) has an
owner-settable `paymentToken`, so switching to $PLUG later is a config
change, not a redeploy.

---

## $DPNOTE — legal hold on mainnet

`NoteRegistry` implements $DPNOTE: fixed-term, asset-backed, and
**revenue-participation** private-credit notes, transferable to secondary
holders. That's a securities question (Reg D/Reg CF territory) independent
of whether this deployment has a general human go-ahead. `scripts/deploy.js`
deploys the other five registries + RevenueRouter normally on Polygon
mainnet, but **skips NoteRegistry** unless `NOTE_REGISTRY_LEGAL_CLEARANCE`
is set to the exact phrase documented in `.env.example` — set that only
after a securities attorney has actually cleared the product. Amoy/local
deploys are unaffected (that's verification, not a public launch).

---

## Quick start

```bash
npm install
cp .env.example .env          # fill in your keys
npx hardhat compile
npx hardhat test              # 17 tests
npx hardhat run scripts/deploy.js --network amoy      # testnet first
npx hardhat run scripts/seedTLDs.js --network amoy     # then the full 246-TLD catalog
npx hardhat run scripts/deploy.js --network polygon    # mainnet, after go-ahead
npx hardhat run scripts/seedTLDs.js --network polygon
```

`deploy.js` deploys the router + registries (USDC address from
`USDC_ADDRESS`, or an auto-deployed `MockUSDC` on amoy/local), points each
registry at the router, seeds five flagship TLDs as a starter set, and
writes `deployments/<network>/addresses.json`.

`seedTLDs.js` then lists the full 246-TLD catalog (`tld/catalog.js`) into
`PlugRegistry` with USDC tier pricing (LEGENDARY 497/yr · GOLD 197/yr ·
STANDARD 97/yr · STARTER 29/yr), leaving reserved (protocol-held) TLDs —
including the five flagship ones deploy.js pre-seeded — **disabled** for
public registration. That's intentional: reserved names are admin-minted
inventory, not self-serve.

---

## How the registries interlock

- **$DPNOTE collateral:** `NoteRegistry.originateNote` takes a
  `CollateralType` (DOMAIN / ENTITY / IP / CANNABIS_LICENSE) plus the
  `tokenId` from the matching registry. `PlugRegistry.lockForLending` /
  `EntityRegistry.lockForLending` freeze the asset while it backs a note.
- **Fees:** every public registration pulls USDC straight to
  `RevenueRouter`; the treasury withdraws from there.
- **Governance:** `CommunityRegistry` assigns $WALL voting weight per tier
  (The Orders = 1, Founding = 5). Founding tokens are soulbound.
- **Valuation:** `IPRegistry` / `LicenseRegistry` hold an `estimatedValue`
  updated by the owner (IP Valuation Pro), consumed by the credit book.

---

## Fixed during Phase 1

`PlugRegistry.registerDomain` had no front-running protection — a watcher
could see a pending registration in the mempool and grief or extort the
buyer. Added the same commit-reveal flow used in the project's other
registry suites: `commit(makeCommitment(tld, name, buyer, secret))`, wait
`minCommitmentAge` (1 minute), then reveal via `registerDomain(tld, name,
to, years, metadataURI, secret)` within `maxCommitmentAge` (1 day).
`registerDomainFor` (the authorized-registrar path) is unaffected — it
never had the front-running exposure since the registrar already
authenticates the buyer off-chain.

## Notes for production

- `checkRenewalAlerts(fromId, toId)` in `LicenseRegistry` is **paginated** —
  the spec's unbounded loop would eventually run out of gas. n8n should call
  it in windows (e.g. 0–200, 200–400).
- `NoteRegistry` is a **ledger**, not a custody vault. USDC disbursement/
  repayment happens through the treasury; this contract is the source of
  truth for portfolio reporting and secondary sales.
- Move `owner()` on every contract to a multisig/timelock after deploy.
- Get an audit before mainnet value flows.
- Smoke-tested locally (register a domain via full commit-reveal, register
  an entity, join CommunityRegistry, originate a note — all four USDC-paid
  where applicable) against a persistent local Hardhat node. Not yet
  smoke-tested on Amoy itself — no funded testnet wallet in this
  environment; that step is on you per `BUILD_PROMPT_PHASE1.md`.

## Deploying to mainnet

This is a real-money, irreversible action. Nothing in this environment has
a funded wallet or your private key, and it never will — a private key
pasted into a chat is a compromised private key. Run this yourself:

```bash
cd contracts/dbws-registry-suite
npm install
cp .env.example .env
# fill in: PRIVATE_KEY, TREASURY_ADDRESS, USDC_ADDRESS (real Polygon USDC:
#          0x3c499c542cEF5E3811e1192ce70d8cc03d5c3359), POLYGON_RPC,
#          POLYGONSCAN_API_KEY
npx hardhat run scripts/deploy.js --network polygon
npx hardhat run scripts/verify.js --network polygon
npx hardhat run scripts/seedTLDs.js --network polygon
```

---

## Phase plan

See `docs/MASTER_RUNBOOK.md` for the full phase breakdown. Summary:

- **Phase 1 (done):** six registries + RevenueRouter, compiled/tested.
- **Phase 2a (done):** USDC fee conversion.
- **Phase 2b (done):** full 246-TLD catalog seed.
- **Phase 2c (not started):** unified dashboard frontend, one view per
  registry.
- **Phase 3 (not started):** DNS dual-layer (Namecheap + Supabase).
- **Phases 4-7 (not started):** tokens/DeFi (see `contracts/dbws-suite`,
  already substantially built), NerdTV, agents, governance.

*Every asset, verifiable on-chain. Without Stain.*
