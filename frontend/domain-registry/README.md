# Digital Plug Domains — Frontend

React + Vite dashboard for the Digital Plug domain registry (`.plug` / `.dbws`
TLDs), talking directly to `PlugRegistry`/`PlugRegistrar` in
[`contracts/dbws-suite`](../../contracts/dbws-suite) via ethers.js — no
backend required for the core flows.

> Runs on `contracts/dbws-suite`'s `PlugRegistry` (flat `name.tld` + a
> built-in reputation score), not the ENS-style namehash-tree
> `contracts/domain-registry` this frontend originally shipped against — that
> suite is now superseded, see its README. Payment is in USDC or discounted
> $PLUG (ERC-20, ETH `approve`/`transferFrom`), not native currency.

## Setup

```bash
npm install --legacy-peer-deps   # date-fns/react-day-picker peer conflict, harmless
cp .env.example .env
# fill in the contract addresses printed by `npm run deploy:wave1:amoy` in
# contracts/dbws-suite
npm run dev
```

## What's real vs. what's a placeholder

This dashboard came from a larger scaffold with many pages. The ones wired to
live contract calls:

- **Domain Search** (`/domains/search`) — checks availability against
  `PlugRegistry.isAvailable`, quotes price via `PlugRegistrar.quote` in either
  USDC or $PLUG, and runs the full commit → wait → approve → register flow.
- **Domain Portfolio** (`/domains`) — reads your owned domains on-chain
  (ERC-721 `balanceOf` + `tokenOfOwnerByIndex` + `PlugRegistry.domains`,
  including each domain's on-chain reputation score) and supports renewing
  (USDC, via `PlugRegistrar.renewDomain`).
- **Wallet connect / network switch / on-chain role gating** (admin ==
  `PlugRegistry.hasRole(DEFAULT_ADMIN_ROLE, ...)`, registrar ==
  `hasRole(REGISTRAR_ROLE, ...)`) — all real, no backend.

Everything else under Marketplace, Minting Factory (AI Art/Agents), Bulk
Registration/Operations, Analytics, Payment Portal, TLD Management, and
Settings is still the original "Coming soon" stub or mock-data UI from the
scaffold — Dashboard's charts in particular are illustrative sample data, not
live platform stats (there's no indexer/backend in this build to aggregate
that from-chain data). None of these are wired to `dbws-suite`'s TLD
marketplace layer either (`UserTLDRegistry`, `TLDAuctionEngine`,
`TLDCatalog`'s 246-TLD catalog) — that's a separate build. Wire pages up the
same way Domain Search/Portfolio were done: get a contract instance from
`useWeb3().getContract(name, withSigner)` and call it.

## Payments

Registration and renewal both pull from an ERC-20 (USDC or $PLUG, PLUG at a
discount) via `approve`/`transferFrom` — `useWeb3().ensureAllowance(tokenName,
spender, amount)` handles checking the current allowance and sending the
`approve` tx only if it's short, before the real write call. There is no
native-currency (POL) payment path in this contract set.
