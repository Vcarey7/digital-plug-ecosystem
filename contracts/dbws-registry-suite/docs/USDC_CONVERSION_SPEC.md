# BUILD PROMPT — PHASE 2a: USDC Fee Conversion

## Your role
Solidity engineer. Convert the six DBWS registries from native-POL fees to
**USDC**, in a way that keeps a future switch to **$PLUG** trivial. Do not
change any registry's business logic — only the payment mechanism.

## Why
The registry pricing is meant to be in dollars ($97/yr, etc.). Native POL
floats against the dollar, so a "97 POL" fee is not "$97". USDC fixes the peg
now. The long-term goal is to charge in **$PLUG**; design so that swap is a
config change, not a redeploy.

## The pattern to apply (all six registries + RevenueRouter)

1. Add an immutable-at-first, owner-settable **payment token**:
   ```solidity
   IERC20 public paymentToken;              // USDC now, $PLUG later
   function setPaymentToken(address t) external onlyOwner { paymentToken = t; }
   ```
2. Change every fee from native to ERC-20 pull:
   - Remove `payable` from registration/renew/transfer functions.
   - Remove `msg.value` checks.
   - Replace with:
     ```solidity
     paymentToken.safeTransferFrom(msg.sender, address(revenueRouter), fee);
     ```
     (Registrations route straight to the RevenueRouter; no native forwarding.)
3. Fees are now in **USDC's 6 decimals**. Update all fee constants:
   - `97 ether` → `97e6`, `47 ether` → `47e6`, `197 ether` → `197e6`,
     `497 ether` → `497e6`, `1997 ether` → `1997e6`.
   - PlugRegistry TLD fees: `configureTLD` fee args are now 6-decimal USDC.
4. RevenueRouter: replace the native `route()/receive()` + `.call` withdraw
   with USDC accounting:
   ```solidity
   function withdraw(uint256 amount) external onlyOwner {
       paymentToken.safeTransfer(treasury, amount);
   }
   ```
   (It no longer needs to be payable; registries transfer USDC directly to it.)
5. Use OpenZeppelin `SafeERC20` everywhere. Import
   `@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol` and
   `.../IERC20.sol`.

## Constructor changes
Each registry constructor now also takes the USDC address:
`constructor(address _revenueRouter, address _usdc, address admin)`.
Update `scripts/deploy.js` to pass the USDC address (from `.env` per network).

## HARD RULES
- Only the payment mechanism changes. Do NOT alter registration logic, structs,
  events (except removing `payable`), collateral locking, soulbound rules, or
  the paginated renewal scan.
- Keep the `$PLUG-later` switch: `setPaymentToken` must exist and work.
- Users must `approve` the registry to spend USDC before registering — the
  frontend handles this in Phase 2c; note it in the README.
- All existing tests must be updated to deploy a MockERC20 (USDC) and approve
  it, then pass. Add a test that `setPaymentToken` swaps the token correctly.

## Definition of done
- Six registries + RevenueRouter charge USDC, route to treasury.
- `setPaymentToken` proven by test (swap USDC→mock $PLUG, fee still works).
- All fee constants in 6-decimal USDC.
- deploy.js passes USDC address per network; `.env.example` documents it.
- Full test suite green with the MockERC20 USDC.
