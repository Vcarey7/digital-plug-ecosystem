# BUILD PROMPT — PHASE 7: Governance (The Orders DAO)

## Your role
Solidity engineer. Deploy the DBWS governance layer and hand protocol control to
it. This is the final structural phase — it turns admin keys into a DAO governed
by $GPLUG holders and The Orders. Contracts exist in `dbws-contracts/`.

## Canonical source of truth
From `dbws-contracts/contracts/governance/`:
- **PlugGovernance** — OpenZeppelin Governor over $GPLUG voting power.
- **PlugTimeLock** — TimelockController; owns protocol admin after handoff.
- **PlugVesting** — team/partner vesting (Iconic Design equity, etc.).
- **PlugMultiSig** — m-of-n treasury multisig.

Also wire: **CommunityRegistry** (Phase 1) voting weight (The Orders = 1,
Founding = 5) as a secondary signal / off-chain snapshot input.

## HARD RULES
- Do NOT transfer admin roles to the timelock until the human explicitly
  approves — this is irreversible-ish and must be deliberate.
- $GPLUG is earned via GPlugConverter (Phase 4), transfer-restricted, non-
  purchasable. Do not make it transferable.
- Governor params (delay, period, threshold, quorum) come from the deploy
  script — adjust for Polygon block time (~2s) before mainnet, and confirm with
  the human. Wrong block-time math makes votes last the wrong duration.
- Testnet → mainnet after approval. Do a full propose→vote→queue→execute dry run
  on Amoy BEFORE any mainnet handoff.

## Tasks
1. Compile + test governance contracts.
2. Deploy TimeLock, then Governor (pointing at $GPLUG + TimeLock), then Vesting
   + MultiSig.
3. Wire timelock roles: Governor = PROPOSER, open EXECUTOR, revoke deployer
   admin on the timelock after setup.
4. Allowlist Governor + Converter on $GPLUG transfers.
5. **Dry run on Amoy:** create a proposal, vote with $GPLUG, queue, execute —
   prove the full loop works.
6. **Handoff (human-gated):** transfer ownership/admin of the registries, token,
   and DeFi contracts to the TimeLock. Do this in a reversible staged way and
   only on explicit human go.
7. Set up vesting schedules the human specifies.

## Definition of done
- Governance contracts deployed + verified.
- Full propose→vote→queue→execute cycle proven on Amoy.
- Timelock role wiring correct (Governor proposes, deployer admin revoked).
- Protocol admin handed to timelock ONLY after human approval, staged.
- Vesting schedules created.

## Out of scope
- Nothing after this — Phase 7 completes the core ecosystem handoff. Further work
  is feature iteration, not structural build.
