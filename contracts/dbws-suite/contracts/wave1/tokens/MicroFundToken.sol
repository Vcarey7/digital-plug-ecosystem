// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title MicroFundToken ($MFT)
 * @author Digital Plug Co. — Digital Black Wall Street
 * @notice Community micro-funding token. Minted 1:1 against USDC deposits
 *         into approved community funds; burned on redemption. Backing is
 *         enforced by restricting mint/burn to vault contracts holding
 *         FUND_ROLE.
 */
contract MicroFundToken is ERC20, ERC20Burnable, AccessControl {
    bytes32 public constant FUND_ROLE = keccak256("FUND_ROLE");

    // Total USDC (6 decimals) reported as backing by fund vaults.
    uint256 public reportedBacking;

    event BackingReported(address indexed fund, uint256 newTotal);

    constructor(address admin) ERC20("MicroFund Token", "MFT") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    /// @notice Mint MFT against a verified deposit. Fund vaults only.
    function fundMint(address to, uint256 amount) external onlyRole(FUND_ROLE) {
        _mint(to, amount);
    }

    /// @notice Burn MFT on redemption. Fund vaults only.
    function fundBurn(address from, uint256 amount) external onlyRole(FUND_ROLE) {
        _burn(from, amount);
    }

    /// @notice Fund vaults report their USDC backing after deposits/withdrawals.
    function reportBacking(uint256 totalUSDC) external onlyRole(FUND_ROLE) {
        reportedBacking = totalUSDC;
        emit BackingReported(msg.sender, totalUSDC);
    }
}
