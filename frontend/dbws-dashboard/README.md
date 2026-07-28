# DBWS Registry Dashboard

Unified frontend for the [DBWS Registry Suite](../../contracts/dbws-registry-suite) — the
canonical six-registry on-chain architecture (PlugRegistry, EntityRegistry, IPRegistry,
NoteRegistry, LicenseRegistry, CommunityRegistry + RevenueRouter). This is Phase 2c of
`MASTER_RUNBOOK.md`.

Plain **React + ethers v6** (not wagmi/RainbowKit) — matching the working, already-proven
pattern in `frontend/domain-registry` rather than the wagmi stack an earlier build-prompt
draft suggested. Vite + Tailwind CSS v4 + react-router-dom v7 + lucide-react.

## Stack

- React 18 + Vite 6
- ethers v6 (`Web3Context` wraps `window.ethereum` directly — no wallet-connector library)
- react-router-dom v7
- Tailwind CSS v4 (`@tailwindcss/vite`, no separate config file)

## Getting started

```bash
npm install

# 1. Deploy (or already have deployed) the registry suite to a network:
cd ../../contracts/dbws-registry-suite
npx hardhat node                                    # separate terminal
npx hardhat run scripts/deploy.js --network localhost
npx hardhat run scripts/seedTLDs.js --network localhost   # optional, full 246-TLD catalog

# 2. Sync deployment addresses (and TLD manifest, if seeded) into this app:
cd ../../frontend/dbws-dashboard
npm run sync-addresses localhost

# 3. Run the dashboard
npm run dev
```

Switch networks with `VITE_NETWORK=amoy` (or `polygon`) — see `src/config/network.js`.
Never edit contract addresses in components; they're always loaded at runtime from
`public/addresses/<network>.json`, which `scripts/sync-addresses.js` writes and which is
git-ignored (regenerate it per network/per machine, don't commit it).

## Structure

- `src/config/network.js` — network definitions, `loadAddresses()` / `loadTldManifest()`
- `src/config/abis.js` — hand-written ABIs matching `contracts/dbws-registry-suite` exactly,
  plus enum label arrays (`TIER_LABELS`, `IP_TYPE_LABELS`, etc.)
- `src/contexts/Web3Context.jsx` — wallet connect/disconnect, network switch, `getContract()`,
  `ensureAllowance()` (USDC approve-if-short helper)
- `src/contexts/NotificationContext.jsx` — toast notifications
- `src/hooks/useCommitReveal.js` — PlugRegistry's commit-reveal state machine. **The secret
  lives in React state only for the life of the hook instance — never localStorage or
  sessionStorage.** Refreshing the page mid-flow loses it; the pending commitment then just
  expires (`maxCommitmentAge`, 1 day by default) and the user starts over.
- `src/pages/` — one view per registry, plus `PortfolioHome` (aggregated per-wallet counts
  across all six)
- `src/components/domains/` — `DomainSearchPanel` (search + 3-step commit→wait→reveal
  registration UX) and `MyDomainsList` (renew/transfer, collateral-lock status)

## Registry-specific notes

- **PlugRegistry** has no on-chain enumerable TLD list — the dashboard falls back to a manual
  TLD text input and checks `tldEnabled`/`registrationFee` directly on-chain if
  `scripts/seedTLDs.js` hasn't been run for the active network (no `tld-manifest.json` to sync).
- **PlugRegistry** also has no `ERC721Enumerable`, so "My Domains" walks `1..nextTokenId-1` and
  filters by `ownerOf`. Fine for a testnet/demo-scale catalog; would need an indexer
  (subgraph, or an owner-indexed mapping added to the contract) at real scale — flagged here
  rather than silently working around it, since dashboard work must not modify contracts.
- **NoteRegistry ($DPNOTE)** is under an active legal hold (securities review) and is **not
  deployed to mainnet** by `contracts/dbws-registry-suite/scripts/deploy.js` unless
  `NOTE_REGISTRY_LEGAL_CLEARANCE` is set after attorney sign-off. Its dashboard view is
  **read-only** by design — there is no origination UI — matching that hold. It also has no
  `getLenderNotes`-style array getter on-chain, so the view only shows notes where the
  connected wallet is the *borrower*.
- Every paid write path (`registerDomain`, `registerEntity`, `registerIP`, `registerLicense`,
  `joinCommunity`, `renewDomain`, `transferDomain`, `upgradeTier`) uses `ensureAllowance()` to
  approve USDC to the relevant registry contract (which pulls payment via `safeTransferFrom`
  straight to `RevenueRouter`) before submitting the write.

## Gotcha fixed during Phase 2c: chain-clock drift

The commit-reveal countdown compares the commitment's on-chain block timestamp against
`minCommitmentAge`/`maxCommitmentAge`. Comparing that directly to the browser's `Date.now()`
breaks if the chain's clock drifts from wall-clock time — confirmed on a local Hardhat node,
which drifted ~2 minutes ahead of the host during verification and stranded the UI in
"waiting" forever. `useCommitReveal` now computes a `chainOffset` (chain time minus local time,
captured right after the commit tx mines) and applies it to every tick instead of using raw
`Date.now()`.

## Verification

Verified end-to-end against a live local Hardhat deployment (6 registries + RevenueRouter,
246-TLD catalog seeded) via Playwright with an injected EIP-1193 shim that proxies straight to
the node's JSON-RPC (Hardhat auto-signs `eth_sendTransaction` for its own default accounts, so
no private key handling was needed in the shim): wallet connect, portfolio aggregation, full
domain commit→wait→reveal registration with USDC approval, entity/IP/license registration,
community free-tier join, and (in a follow-up pass) the IP license and license
compliance-event history panels. All six registry views render without error.

## Not yet done

- Amoy/mainnet deployment (needs a funded wallet — user-executed, not this dashboard)
- Re-pointing at Amoy addresses once deployed (`npm run sync-addresses amoy`)
