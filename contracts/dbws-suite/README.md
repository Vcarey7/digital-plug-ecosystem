# DBWS Suite — Digital Black Wall Street

> **⚠ Registry superseded.** `contracts/wave1/registry/`'s `PlugRegistry`
> (flat `name.tld` + reputation score) is no longer the canonical domain
> registry — the project has standardized on
> [`contracts/dbws-registry-suite`](../dbws-registry-suite)'s six-registry
> architecture instead (see that suite's `docs/MASTER_RUNBOOK.md`). Don't
> deploy this suite's registry contracts as "the" registry.
>
> **Everything else here is still current.** Tokens, DeFi, community
> finance, governance, NerdTV, and the rest of `wave1`/`wave2` are exactly
> what Phase 4+ of the registry suite's runbook points to — this is that
> work, already built and tested ahead of schedule.

The full on-chain layer for the DBWS ecosystem: tokens, DeFi, community
finance, governance, NerdTV, and supporting infrastructure (plus a
now-superseded domain registry — see above). Targets **Polygon** (Amoy
testnet + mainnet). Solidity `0.8.24` (pragma `^0.8.20`), OpenZeppelin
`^5.0`.

Everything here is built, compiled, and tested. What's **not** here yet is
a mainnet deployment of everything — the contracts are split into two
waves so the legally clean half can ship to market now while the rest
waits on licensing review, without any risk of the two getting mixed up.

## Wave 1 vs. Wave 2

**Wave 1** (`contracts/wave1/**`) is cleared for first-market deployment.
No product here pools user funds and promises a return, runs betting
markets, or extends consumer credit at interest — see the per-contract
breakdown below for the reasoning.

**Wave 2** (`contracts/wave2/**`) is legally gated. Every file in this tree
carries a `WAVE 2 — HOLD FOR LEGAL REVIEW` banner at the top explaining
exactly what needs clearing. These contracts are fully built and tested —
writing and testing code isn't the legal question, deploying it to mainnet
and marketing it to the public is. `scripts/deployWave2.js` refuses to run
against Polygon mainnet unless `WAVE2_LEGAL_CLEARANCE` is set to an exact
literal phrase in `.env`, which should only happen after an actual
securities/gaming/lending attorney has cleared the specific contracts being
deployed — not before.

| Contract | Legal category | Why |
|---|---|---|
| BlockBondNFT + CommunityRevenuePool | Securities (Howey) | Investment of money into a pooled treasury with a yield derived from managers' efforts, regardless of the NFT wrapper |
| SavingsVault | Securities (Howey) | Fixed, protocol-set APY on pooled USDC deposits |
| RWAVault | Securities (Howey) | Fractional real-world-asset revenue-share tokens |
| InvoiceToken | Securities (Howey) | Investors fund a pool expecting a return derived from a third party's payment |
| PlugStaking | Securities (Howey / staking-as-a-service) | Mirrors the fact pattern in SEC v. Kraken (2023) |
| ForgeCore + DPAToken + AbsorptionFund | Securities (gray area) | Pooled fees fund a floor-price support mechanism — an expectation-of-appreciation pattern worth clearing even though it's not a clean-cut case |
| PredictionMarket + PredictionOracle | CFTC / state gambling | Pooled stakes, cash-value payouts on event outcomes (see Kalshi/Polymarket enforcement history) |
| TournamentPrizePool | State skill-gaming / gambling law | Pooled entry fees paid out as prizes; legality is state-by-state and turns on skill-vs-chance, a different question from securities |
| CommunityCredit | Lending license / usury | Real consumer lending (`borrow()`/`repay()`) at interest — a licensing question, not a securities one |
| PlugBridge | Money transmission | Custodies and moves user funds cross-chain via a trusted relayer; can implicate money-transmitter licensing depending on jurisdiction |

Everything else — registry, tokens, governance, education funds, NerdTV,
the community/developer tooling, and the rest of `misc/` — is Wave 1.

### What's intentionally not duplicated here

`CLARegistry`, `BountyVault`, `BlackBusinessRegistry`, `SusuFactory`, and
`InheritanceVault` already exist as tested, deployable contracts in
[`contracts/dpc-suite`](../dpc-suite). This zip's copies of those same
products (`developer/DeveloperKit.sol`, `community/CommunitySuite.sol`)
were deliberately **not** copied into this suite — building them twice
would create two competing on-chain instances of the same product. Use
`dpc-suite`'s versions.

`CompoundForge` (wave 1, clean) is built and tested but not included in
`deployWave1.js`'s automatic deploy list — it structurally depends on
`DPAToken`, which lives in wave 2. Deploy it manually once wave 2 clears
and `DPAToken` exists.

## Contract manifest

### Tokens — `wave1/tokens/`, `wave2/tokens/`
| Contract | Wave | Purpose |
|---|---|---|
| PlugToken | 1 | $PLUG utility/payment, 1B cap, role-minted |
| GPlugToken | 1 | $GPLUG governance, transfer-restricted |
| GPlugConverter | 1 | lock $PLUG → mint $GPLUG (lock multipliers) |
| MicroFundToken | 1 | $MFT community micro-funding receipt token |
| DPAToken | 2 | 10 Digital Precious Assets, annual caps |

### Registry — `wave1/registry/`
PlugRegistry, PlugResolver, PlugRegistrar (commit-reveal protected, see
below), TLDValuationOracle, TLDPriceController, TLDAuctionEngine,
UserTLDRegistry, TLDRoyalty, TLDCatalog.

### TLD catalog — `tld/`
`TLDCatalog.sol` is the on-chain source of truth for tier (LEGENDARY/GOLD/
STANDARD/STARTER), category, and reserved status per TLD; `UserTLDRegistry`
and the registrar read it for pricing and to block protocol-reserved names
from public minting. `tld/catalog.js` holds the master list — 246 unique
TLDs across 14 categories, deduplicated automatically — with `tld/
TLD_CATALOG.md` and `.csv` as human-readable exports. After
`deployWave1.js`, run:

```bash
node tld/catalog.js                                   # preview counts
npx hardhat run scripts/seedTLDs.js --network amoy     # list + mint all TLDs
```

This lists every TLD into `TLDCatalog` and mints the protocol inventory into
`UserTLDRegistry`, writing `deployments/<network>/tld-manifest.json`. Both
steps are idempotent — safe to re-run if interrupted.

### DeFi — `wave1/defi/`, `wave2/defi/`
| Contract | Wave | Purpose |
|---|---|---|
| ForgeVault / InsuranceFund | 1 | treasury + exploit-coverage funds |
| FamilyBankingVault | 1 | multi-member vault + inheritance scheduling |
| FlashLoanArbitrage | 1 | Aave V3 flash-loan arb executor (owner-only tool) |
| ForgeCore | 2 | burn $PLUG → mint DPAs, circuit breakers |
| AbsorptionFund | 2 | buyer-of-last-resort floor-price support |
| SavingsVault | 2 | term-locked USDC savings + APY |
| RWAVault | 2 | real-world asset fractionalization + revenue |

### Developer — see `contracts/dpc-suite`
CLARegistry, BountyVault (not duplicated here).

### Prediction — `wave1/tokens/`, `wave2/prediction/`
GPlugConverter is wave 1 (principal returned 1:1, not a yield product).
PredictionMarket + PredictionOracle are wave 2.

### Education — `wave1/education/`
HomeschoolVault, TeacherRetentionFund, EducationVault.

### Revenue — `wave1/revenue/`
AffiliateTracker, AIAccessNFT, DataVault, WhiteLabelLicense, CompoundForge.

### Community — see `contracts/dpc-suite` for BlackBusinessRegistry / SusuFactory / InheritanceVault; `wave2/community/` for the rest
BlockBondNFT, CommunityRevenuePool, CommunityCredit.

### Governance — `wave1/governance/`
PlugGovernance, PlugTimeLock, PlugVesting, PlugMultiSig.

### NerdTV — `wave1/nerdtv/`
NerdTVContentRegistry, NerdTVRoyalty, WatchToEarn.

### Misc — `wave1/misc/`, `wave2/misc/`
| Contract | Wave | Purpose |
|---|---|---|
| RefugeHousing | 1 | transitional-housing rent-credit ledger |
| ScoreRegistry | 1 | generic soulbound composite scores |
| AIAgentGateway | 1 | metered AI agent access (credits) |
| PlugMarketplace | 1 | fixed-price NFT secondary market |
| MintingFactory | 1 | generic mint campaigns |
| PlugPayments | 1 | pay-to-domain router |
| PlugFactory | 1 | subdomain registration + royalty routing |
| FamilyCredit | 1 | 0% APR family credit pool (not consumer lending) |
| TokenBoundAccount | 1 | ERC-6551-style NFT-owned account (per-token, deployed on demand) |
| PlugStaking / InvoiceToken / TournamentPrizePool | 2 | see legal table above |
| PlugBridge | 2 | lock-and-mint cross-chain bridge escrow |

## Fixed during triage

`PlugRegistrar.registerDomain()` had no front-running protection — an
attacker watching the mempool could see a pending registration and grief
or extort the buyer. Added the same commit-reveal flow already used in
[`contracts/domain-registry`](../domain-registry): call `commit()` with
`makeCommitment(name, tld, buyer, secret)`, wait `minCommitmentAge`
(1 minute), then reveal via `registerDomain(name, tld, secret, years,
payInPlug, affiliate)` within `maxCommitmentAge` (1 day).

## Two domain-registry architectures — open question

This suite's `PlugRegistry` (flat `name.tld` namespace + built-in
reputation score) is architecturally different from the already-deployed
`contracts/domain-registry/DomainRegistry.sol` (ENS-style namehash tree +
commit-reveal). Both are now built and tested. Which one becomes "the"
production registry — or whether they're merged — hasn't been decided;
flagging this for a decision before either goes to mainnet.

## Setup

```bash
npm install
cp .env.example .env
npx hardhat compile
npx hardhat test
```

## Deploying

```bash
# Wave 1 — testnet first, always
npm run deploy:wave1:amoy
npm run deploy:wave1:polygon      # mainnet, once you're ready

# Wave 2 — testnet is fine for verification any time
npm run deploy:wave2:amoy
# Wave 2 mainnet refuses to run without WAVE2_LEGAL_CLEARANCE set in .env
# to the exact phrase documented in scripts/deployWave2.js — only set that
# after an attorney has actually cleared the contracts you're deploying.
npm run deploy:wave2:polygon
```

`deployWave1.js` deploys tokens → registry → DeFi → education → governance
→ NerdTV → revenue → misc, wiring roles as it goes (registrar → registry,
converter → GPLUG minter, affiliate tracker reporters, TLD royalty
reporter, etc.), and writes addresses to
`deployments/<network>/wave1.json`.

`deployWave2.js` reads wave 1's PLUG/GPLUG/ForgeVault/InsuranceFund
addresses from that same file (or `PLUG_TOKEN` / `GPLUG_TOKEN` /
`FORGE_VAULT` / `INSURANCE_FUND` env vars) and wires the wave 2 contracts
that depend on them.

**Amoy / local**: auto-deploys a MockUSDC if `USDC_TOKEN` isn't set, so
either wave can be exercised for free.
**Polygon mainnet**: refuses to run unless `USDC_TOKEN` is a real deployed
address. Wave 2 additionally refuses without `WAVE2_LEGAL_CLEARANCE`.

Recommended: use a Gnosis Safe (multisig) as the admin/treasury address
before handling real value, not a single EOA — every contract here grants
that address broad admin/pause/revoke authority. `PlugMultiSig` and
`PlugTimeLock` are included for exactly this.

## Deploying to mainnet

This is a real-money, irreversible action. Nothing in this environment has
a funded wallet or your private key, and it never will — a private key
pasted into a chat is a compromised private key. Run this yourself:

```bash
cd contracts/dbws-suite
npm install
cp .env.example .env
# fill in: PRIVATE_KEY (a wallet funded with MATIC/POL for gas),
#          USDC_TOKEN (real deployed address), TREASURY_ADDRESS,
#          POLYGON_RPC_URL, POLYGONSCAN_API_KEY
npm run deploy:wave1:polygon

# Only after wave 1 is live and you're specifically ready for a cleared
# wave 2 contract:
#          WAVE2_LEGAL_CLEARANCE=LEGAL_CLEARED_FOR_MAINNET
npm run deploy:wave2:polygon
```

## Security checklist

- [ ] Run Slither / Mythril static analysis
- [x] Reentrancy guards on external-call functions
- [x] Access control on privileged functions
- [x] Commit-reveal front-running protection on domain registration
- [x] Wave 1 / wave 2 legal-risk separation with a mainnet deploy gate on wave 2
- [ ] Multisig wallet set as admin before mainnet
- [ ] Professional audit before handling real user funds at scale
- [ ] Securities/gaming/lending counsel review before any wave 2 mainnet deploy

This is provided as-is under MIT. Not legal or financial advice.
