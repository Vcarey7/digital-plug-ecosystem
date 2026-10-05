# BUILD PROMPT — PHASE 6: Agents + AI Access Layer

## Your role
Solidity + integration engineer. Deploy the on-chain access/billing layer for
the DBWS AI agent workforce, and connect it to the existing n8n agents. The
agents themselves are NOT smart contracts — they run in n8n. This phase is the
metering, subscription, and settlement layer only.

## Canonical source of truth
From `dbws-contracts/`:
- **AIAccessNFT** (`contracts/revenue/AIAccessNFT.sol`) — subscription passes,
  3 tiers (Basic/Pro/Sovereign), USDC or $PLUG payment, affiliate reporting.
- **AIAgentGateway** (`contracts/misc/CoreServices.sol`) — credit balance
  metering; users top up with $PLUG, agent backends consume credits per call.

Existing off-chain: the n8n agent workforce (ATLAS, HAVEN, COMPASS, SCOUT, VERA,
LEDGER, APEX, FLUX, PULSE) + AXIOM sales suite. These stay in n8n.

## HARD RULES
- Do NOT try to put agents on-chain. Contracts handle access + billing; n8n
  handles the actual agent work.
- AIAgentGateway.consume is called by AUTHORIZED agent backends only
  (AGENT_ROLE) — never open to users. Guard the role tightly.
- Access gating (does this wallet have an active pass?) is checked off-chain by
  the n8n gateway reading AIAccessNFT.isActive — keep the on-chain contract the
  source of truth.
- Testnet → mainnet after approval.

## Tasks
1. Compile + test AIAccessNFT + AIAgentGateway.
2. Deploy both, wire treasury + $PLUG + (optional) AffiliateTracker.
3. Grant AGENT_ROLE to the n8n gateway service wallet(s).
4. n8n integration: before serving an agent request, the gateway flow (a) checks
   AIAccessNFT.isActive OR sufficient gateway credits, (b) calls
   AIAgentGateway.consume to meter usage, (c) proceeds or rejects.
5. Frontend: add "AI Access" to the dashboard — subscribe (USDC/$PLUG approve →
   mint pass), top up gateway credits, view usage.
6. Report addresses; save artifacts.

## Definition of done
- Both contracts deployed + verified.
- Subscribe to a tier end-to-end; isActive returns true.
- Top up credits; a metered consume() call debits correctly and rejects at zero.
- n8n gateway enforces access before serving an agent.
- AGENT_ROLE restricted to gateway wallets only.

## Out of scope
- Building/altering the n8n agents themselves (existing workstream).
- Governance (Phase 7).
