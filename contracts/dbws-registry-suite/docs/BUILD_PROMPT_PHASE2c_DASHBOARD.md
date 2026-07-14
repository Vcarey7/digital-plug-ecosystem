# BUILD PROMPT — PHASE 2c: Unified Registry Dashboard (Frontend)

## Your role
Frontend engineer. Build ONE dashboard that surfaces all six DBWS registries,
wired to the deployed contract addresses. Do not touch the contracts.

## Stack (match the existing app — do not substitute)
Vite + React + Tailwind + wagmi + ethers v6. Same conventions as the existing
`frontend/expense-ledger` app in this repo. Wallet: RainbowKit or wagmi
connectors. Target chain: Polygon (Amoy for testing, mainnet for prod).

## Source of truth
- Contract addresses: `deployments/<network>/addresses.json` (written by
  Phase 1 deploy). Read from there — never hardcode addresses in components.
- ABIs: import from `artifacts/` after compile, or a generated `abis/` folder.
- The six registries: PlugRegistry, EntityRegistry, IPRegistry, NoteRegistry,
  LicenseRegistry, CommunityRegistry. Plus RevenueRouter (read-only stats).

## Dashboard structure — one interface, six views (per the spec)

1. **Plug Registry** — search a name → check `isAvailable(tld,name)` → register
   (USDC approve + `registerDomain`). Show my domains, expirations, renew,
   transfer, lock-for-lending status.
2. **Entity Registry** — register entity, view my entities, link domains.
3. **IP Registry** — register IP (content hash), view my IP, create licenses.
4. **Note Registry** — portfolio view (`getPortfolioHealth`), my notes as
   borrower/holder, payment history (read-only for most users; originate is
   owner-gated).
5. **License Registry** — register cannabis license, compliance log, renewal
   alerts view.
6. **Community Registry** — join a tier (USDC approve for paid tiers), my
   membership card, The Orders status, achievements, voting power.

Plus a **Portfolio home** that aggregates: total assets across all six
registries for the connected wallet, total valuation, $DPNOTE lending status.

## USDC handling (critical)
Every paid action needs a two-step UX: (1) `USDC.approve(registry, amount)`
then (2) the register/join call. Show approve state clearly. Read the price
from the contract (`registrationFee(tld)` etc.), display in dollars (USDC 6dp).

## HARD RULES
- Read addresses from `deployments/<network>/addresses.json`. No hardcoding.
- Do NOT modify any contract. If an ABI mismatch appears, STOP and report —
  it means contracts and frontend are out of sync, not something to patch over.
- Match the existing frontend stack and folder conventions exactly.
- Handle the not-connected, wrong-network, and pending-tx states on every view.
- No localStorage/sessionStorage for critical state — use wagmi/React state.

## Definition of done
- All six views functional against Amoy deployment.
- Register a `.plug` domain end-to-end (approve → register → shows in My Domains).
- Join CommunityRegistry free + one paid tier.
- Portfolio home aggregates across registries for the connected wallet.
- Builds clean (`npm run build`), no console errors on the happy path.
- README documents how to point it at a different network's addresses.json.
