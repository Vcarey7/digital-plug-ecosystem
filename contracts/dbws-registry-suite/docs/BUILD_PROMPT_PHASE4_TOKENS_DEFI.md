# BUILD PROMPT — PHASE 4: Tokens + Core DeFi

## Your role
Solidity deployment engineer. Deploy the DBWS token layer and core DeFi
contracts, then flip the registry's payment token from USDC to $PLUG. The
contracts already exist in the `dbws-contracts/` suite — compile, test, deploy.
Do not redesign them.

## Canonical source of truth
The `dbws-contracts/` project (separate zip). Relevant contracts for this phase:
- **Tokens:** `PlugToken` ($PLUG), `GPlugToken` ($GPLUG), `MicroFundToken` ($MFT),
  `DPAToken` (ERC-1155 precious assets).
- **DeFi:** `PlugStaking`, `SavingsVault`, `ForgeCore` + `DPAToken`,
  `GPlugConverter`, treasury funds (`ForgeVault`, `InsuranceFund`,
  `AbsorptionFund`).
Stack: Solidity 0.8.20, OZ ^5.0.2, Polygon. Amoy → mainnet.

## HARD RULES
- Do NOT redesign tokenomics, supply caps, or fee splits — they are set in the
  contracts. If a number looks wrong, STOP and report.
- Deploy in the dependency order in `dbws-contracts/scripts/deployAll.js` (or a
  registry-token subset script). Grant all roles as that script does.
- $PLUG has a 1B hard cap and role-gated minting — do not alter.
- **Legal flag (carry forward):** BlockBondNFT and CommunityRevenuePool have
  Howey exposure and are NOT part of this phase. Do not deploy them here.
- Testnet → mainnet only after human approval.

## Tasks
1. Compile + test the token and DeFi subset.
2. Deploy tokens first ($PLUG, $GPLUG, $MFT, DPA), then staking/savings/forge,
   wiring MINTER/BURNER roles per the deploy script.
3. Fund reward reserves the human specifies (staking, savings).
4. Configure ForgeCore recipes + DPA annual caps (values from the human).
5. **Registry cutover:** once $PLUG is live and liquid, call
   `setPaymentToken($PLUG)` on the six registries + RevenueRouter (from Phase
   2a). Re-price TLDs in $PLUG if desired (re-run a $PLUG-denominated seed).
   This is a deliberate, human-approved switch — do not do it automatically.
6. Report all addresses; save to `deployments/<network>/`.

## Definition of done
- Tokens + core DeFi deployed, verified, roles granted.
- Reserves funded; forge recipes set.
- Registry payment token switched to $PLUG on human approval (or left on USDC if
  the human wants to wait for deeper liquidity — their call).
- Deployment artifacts committed.

## Out of scope
- BlockBond / CommunityRevenuePool (legal review pending).
- NerdTV, agents, governance (later phases).
