# Digital Plug Domains — Frontend

React + Vite dashboard for the Digital Plug domain registry (`.plug` / `.dbws`
TLDs), talking directly to the contracts in `contracts/domain-registry` via
ethers.js — no backend required for the core flows.

## Setup

```bash
npm install --legacy-peer-deps   # date-fns/react-day-picker peer conflict, harmless
cp .env.example .env
# fill in the contract addresses printed by `npm run deploy:amoy` in
# contracts/domain-registry
npm run dev
```

## What's real vs. what's a placeholder

This dashboard came from a larger scaffold with many pages. The ones wired to
live contract calls:

- **Domain Search** (`/domains/search`) — checks availability, shows price,
  and runs the full commit → wait → register flow against `DomainRegistry`.
- **Domain Portfolio** (`/domains`) — reads your owned domains on-chain
  (`getOwnerDomains` + `getDomain`) and supports renewing.
- **Wallet connect / network switch / on-chain role gating** (admin ==
  `DomainRegistry.owner()`, TLD owner == `DomainRegistry.tldRegistrar()`) —
  all real, no backend.

Everything else under Marketplace, Minting Factory (AI Art/Agents), Bulk
Registration/Operations, Analytics, Payment Portal, TLD Management, and
Settings is still the original "Coming soon" stub or mock-data UI from the
scaffold — Dashboard's charts in particular are illustrative sample data, not
live platform stats (there's no indexer/backend in this build to aggregate
that from-chain data). Wire these up the same way Domain Search/Portfolio
were done: get a contract instance from `useWeb3().getContract(name, withSigner)`
and call it.

## Payments

Native-currency (POL) payment always works directly against
`DomainRegistry`. If `PlugRegistrar` was deployed (USDC/$PLUG payment with a
`.plug`/`.dbws` pricing table), set `VITE_PLUG_REGISTRAR_ADDRESS`,
`VITE_USDC_ADDRESS`, and `VITE_PLUG_TOKEN_ADDRESS` — the ABI is already
wired in `src/config/contracts.js`, but no page calls it yet.
