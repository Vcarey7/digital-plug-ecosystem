// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title CommunityRevenuePool
 * @author Digital Plug Co. — Digital Black Wall Street
 * @notice Aggregates ecosystem revenue (rent, business fees, protocol cuts)
 *         and services BlockBond yield. Keepers trigger monthly distribution
 *         runs across a batch of bond token ids. Surplus builds a reserve.
 *
 * WAVE 2 — HOLD FOR LEGAL REVIEW. This is the yield-funding engine for
 * BlockBondNFT; it inherits the same Howey exposure. Do not deploy or
 * market until a securities attorney has cleared it.
 */
interface IBlockBond {
    function distributeYield(uint256 tokenId) external;
    function pendingYield(uint256 tokenId) external view returns (uint256);
    function totalSupply() external view returns (uint256);
    function tokenByIndex(uint256 index) external view returns (uint256);
}

contract CommunityRevenuePool is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant KEEPER_ROLE = keccak256("KEEPER_ROLE");
    bytes32 public constant DEPOSITOR_ROLE = keccak256("DEPOSITOR_ROLE");

    IERC20 public immutable usdc;
    IBlockBond public bond;

    uint256 public totalRevenueReceived;
    uint256 public totalYieldPaid;

    event RevenueDeposited(address indexed from, uint256 amount, string source);
    event DistributionRun(uint256 fromIndex, uint256 toIndex, uint256 paid);
    event BondSet(address bond);

    constructor(address usdcAddress, address bondAddress, address admin) {
        usdc = IERC20(usdcAddress);
        bond = IBlockBond(bondAddress);
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(KEEPER_ROLE, admin);
        _grantRole(DEPOSITOR_ROLE, admin);
    }

    /// @notice Any approved product deposits revenue here.
    function depositRevenue(uint256 amount, string calldata source)
        external
        nonReentrant
    {
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        totalRevenueReceived += amount;
        emit RevenueDeposited(msg.sender, amount, source);
    }

    /// @notice Fund the BlockBond contract, then distribute yield across a
    ///         window of token indices (keeps gas bounded).
    function runDistribution(uint256 fromIndex, uint256 count)
        external
        onlyRole(KEEPER_ROLE)
        nonReentrant
    {
        uint256 supply = bond.totalSupply();
        uint256 end = fromIndex + count;
        if (end > supply) end = supply;

        // Pre-compute needed yield and transfer to bond contract so it can pay.
        uint256 needed;
        for (uint256 i = fromIndex; i < end; i++) {
            needed += bond.pendingYield(bond.tokenByIndex(i));
        }
        if (needed > 0) {
            usdc.safeTransfer(address(bond), needed);
        }

        uint256 paid;
        for (uint256 i = fromIndex; i < end; i++) {
            uint256 tokenId = bond.tokenByIndex(i);
            uint256 p = bond.pendingYield(tokenId);
            if (p > 0) {
                bond.distributeYield(tokenId);
                paid += p;
            }
        }
        totalYieldPaid += paid;
        emit DistributionRun(fromIndex, end, paid);
    }

    function reserve() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }

    function setBond(address bondAddress) external onlyRole(DEFAULT_ADMIN_ROLE) {
        bond = IBlockBond(bondAddress);
        emit BondSet(bondAddress);
    }

    function sweep(address to, uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        usdc.safeTransfer(to, amount);
    }
}
