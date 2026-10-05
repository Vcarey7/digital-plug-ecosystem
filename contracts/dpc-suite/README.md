# Digital Plug Smart Contract Suite

Digital Black Wall Street — on-chain infrastructure: contributor licensing,
bounty payouts, rotating savings circles (susu), an on-chain reputation
score, a verified Black-owned business registry, generational wealth
inheritance vaults, and B2B white-label licensing. All contracts target
Polygon.

## Contracts

| Contract | Purpose |
|---|---|
| `cla/CLARegistry.sol` | Soulbound Contributor License Agreement NFT + tier gating |
| `cla/BountyVault.sol` | $PLUG bounty pool with CLA/tier-gated payouts |
| `susu/SusuFactory.sol` + `susu/SusuCircle.sol` | Rotating savings circles (ROSCAs) with security bonds and 3 payout modes |
| `credit/ScoreRegistry.sol` | On-chain alternative credit score (300–850), consent-gated lender queries |
| `registry/BlackBusinessRegistry.sol` | Verified Black-owned business directory with staked registration + spend tracking |
| `vault/InheritanceVault.sol` | Dead man's switch estate vault (guardians, beneficiaries, conditional release) |
| `shared/WhiteLabelLicense.sol` | B2B licensing of the DBWS stack (Starter/Growth/Enterprise/Sovereign tiers) |
| `shared/IPlugToken.sol` | Interface for the (separately deployed) $PLUG ERC-20 |
| `mocks/MockPlugToken.sol` | Test-only ERC-20 stand-in — **not for mainnet** |

44 tests, all passing (`npm test`).

## What's intentionally not here

`BlockBondNFT.sol` and `CommunityRevenuePool.sol` (from an earlier upload)
are **not included**. Both pay holders a yield/revenue share from a pooled
treasury in exchange for capital — that's a textbook Howey-test security
regardless of the wrapper (NFT, token, etc.), and the source docs themselves
flag it as unfiled/unreviewed. Don't deploy or market either until a
securities attorney has actually reviewed and, if needed, filed for them —
not "tracked," filed.

## Setup

```bash
npm install
cp .env.example .env   # fill in PRIVATE_KEY and RPC URLs
```

## Commands

```bash
npm run compile
npm test
npm run deploy:amoy      # Polygon Amoy testnet
npm run deploy:polygon   # Polygon mainnet
```

`scripts/deploy_all.js` deploys all 7 contracts and wires `BountyVault` as
an authorized recorder in `CLARegistry`.

- **Amoy / local**: if `PLUG_TOKEN` / `USDC_TOKEN` aren't set, it auto-deploys
  `MockPlugToken` stand-ins so the whole suite can be exercised for free.
- **Polygon mainnet**: refuses to run unless `PLUG_TOKEN` and `USDC_TOKEN`
  are already set to real deployed token addresses. There is no real $PLUG
  token contract in this suite yet — deploy that first if it doesn't exist,
  then set `PLUG_TOKEN` before running `deploy:polygon`.

## Deploying to mainnet

This is a real-money, irreversible action. Nothing in this environment has
a funded wallet or your private key, and it never will — a private key
pasted into a chat is a compromised private key. Run this yourself:

```bash
cd contracts/dpc-suite
npm install
cp .env.example .env
# fill in: PRIVATE_KEY (a wallet funded with MATIC/POL for gas),
#          PLUG_TOKEN, USDC_TOKEN (real deployed addresses),
#          POLYGON_RPC_URL, POLYGONSCAN_API_KEY
npm run deploy:polygon
```

Recommended: use a Gnosis Safe (multisig) as the `admin`/treasury address
passed to each constructor, not a single EOA — every contract here grants
that address broad admin/pause/revoke authority.

## Security checklist (from the original spec)

- [ ] Run Slither / Mythril static analysis
- [x] Reentrancy guards on external-call functions
- [x] Access control on privileged functions
- [x] Soulbound enforcement tested (CLARegistry, BlackBusinessRegistry)
- [x] Pause tested where applicable
- [ ] Multisig wallet set as admin before mainnet
- [ ] Professional audit before handling real user funds at scale
