// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/utils/Nonces.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title GPlugToken ($GPLUG)
 * @author Digital Plug Co. — Digital Black Wall Street
 * @notice Governance token with on-chain vote checkpoints (ERC20Votes).
 *         Earned by staking $PLUG (via GPlugConverter) — non-purchasable.
 *         Soul-weighted: transfers restricted to approved contracts so
 *         governance power can't be bought on secondary markets.
 */
contract GPlugToken is ERC20, ERC20Permit, ERC20Votes, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    // Contracts allowed to move GPLUG (converter, governance staking).
    mapping(address => bool) public transferAllowlist;

    event TransferAllowlistSet(address indexed account, bool allowed);

    error TransferRestricted();

    constructor(address admin)
        ERC20("Governance Plug", "GPLUG")
        ERC20Permit("Governance Plug")
    {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }

    function burnFrom(address from, uint256 amount) external onlyRole(MINTER_ROLE) {
        _burn(from, amount);
    }

    function setTransferAllowlist(address account, bool allowed)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        transferAllowlist[account] = allowed;
        emit TransferAllowlistSet(account, allowed);
    }

    // ─── Overrides ────────────────────────────────────────────────────────────

    function _update(address from, address to, uint256 value)
        internal
        override(ERC20, ERC20Votes)
    {
        // Mint/burn always allowed; wallet-to-wallet requires allowlisted party.
        if (from != address(0) && to != address(0)) {
            if (!transferAllowlist[from] && !transferAllowlist[to]) {
                revert TransferRestricted();
            }
        }
        super._update(from, to, value);
    }

    function nonces(address owner)
        public
        view
        override(ERC20Permit, Nonces)
        returns (uint256)
    {
        return super.nonces(owner);
    }
}
