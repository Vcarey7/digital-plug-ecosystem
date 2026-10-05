// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title PlugToken ($PLUG)
 * @author Digital Plug Co. — Digital Black Wall Street
 * @notice Primary utility + payment token of the DBWS ecosystem.
 *         Sine Macula.
 *
 * Supply model
 * ────────────
 *  • Hard cap: 1,000,000,000 PLUG
 *  • Initial mint: 250,000,000 to treasury
 *  • Remainder mintable only by MINTER_ROLE (staking rewards,
 *    Watch-to-Earn emissions, community programs) up to the cap.
 */
contract PlugToken is ERC20, ERC20Burnable, ERC20Permit, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    uint256 public constant MAX_SUPPLY = 1_000_000_000e18;
    uint256 public constant INITIAL_MINT = 250_000_000e18;

    bool public paused;

    event PausedSet(bool paused);

    error SupplyCapExceeded();
    error TransfersPaused();

    constructor(address treasury, address admin)
        ERC20("Plug Token", "PLUG")
        ERC20Permit("Plug Token")
    {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
        _mint(treasury, INITIAL_MINT);
    }

    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        if (totalSupply() + amount > MAX_SUPPLY) revert SupplyCapExceeded();
        _mint(to, amount);
    }

    function setPaused(bool _paused) external onlyRole(PAUSER_ROLE) {
        paused = _paused;
        emit PausedSet(_paused);
    }

    function _update(address from, address to, uint256 value) internal override {
        // Minting and burning remain possible while paused; transfers do not.
        if (paused && from != address(0) && to != address(0)) revert TransfersPaused();
        super._update(from, to, value);
    }
}
