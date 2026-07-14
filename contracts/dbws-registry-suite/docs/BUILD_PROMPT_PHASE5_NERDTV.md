# BUILD PROMPT — PHASE 5: NerdTV / Media

## Your role
Solidity + backend engineer. Deploy the NerdTV media contracts and wire the
content pipeline. Contracts exist in `dbws-contracts/contracts/nerdtv/`.

## Canonical source of truth
`dbws-contracts/contracts/nerdtv/NerdTV.sol`:
- **NerdTVContentRegistry** — 13-network content catalog, creator + royalty
  splits per content id.
- **NerdTVRoyalty** — routes revenue to creator / platform / community pool.
- **WatchToEarn** — $PLUG rewards for verified watch time, daily-capped,
  attestor-gated.

Depends on: $PLUG (Phase 4), CommunityRevenuePool address (community pool
target). Stack: Solidity 0.8.20, OZ ^5.0.2, Polygon.

## HARD RULES
- Do NOT redesign royalty splits or the watch-to-earn rate model — configurable
  by admin post-deploy, not by rewriting the contract.
- WatchToEarn pays from a treasury allowance — the treasury must `approve` the
  contract; rewards are attestor-signed (backend keeper), never open-claim.
- The content pipeline (Claude → image → Suno → ElevenLabs → video → n8n) is
  OFF-CHAIN. This phase deploys the on-chain settlement layer + wires the
  attestor keeper. Do not attempt to put media generation on-chain.
- Testnet → mainnet after approval.

## Tasks
1. Compile + test the NerdTV contracts.
2. Deploy ContentRegistry, then NerdTVRoyalty (pointing at treasury + community
   pool), then WatchToEarn (pointing at $PLUG + rewards treasury).
3. Grant PUBLISHER_ROLE to the content backend, ATTESTOR_ROLE to the watch-time
   keeper, treasury approves WatchToEarn for the reward budget.
4. Backend: n8n flow that publishes content records on mint and submits
   watch-time attestations on a schedule (rate-limited per the daily cap).
5. Report addresses; save artifacts.

## Definition of done
- Three NerdTV contracts deployed + verified.
- A test content item published, a royalty payment routed and split correctly.
- A watch-time attestation pays $PLUG within the daily cap; over-cap is rejected.
- Roles granted; treasury allowance set.

## Out of scope
- Off-chain media generation pipeline internals (separate workstream).
- Agents, governance (later phases).
