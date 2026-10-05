// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title AffiliateTracker
 * @author Digital Plug Co. — Digital Black Wall Street
 * @notice Tracks affiliate-driven sales reported by ecosystem contracts
 *         (REPORTER_ROLE) and accrues $PLUG commissions the affiliate can
 *         claim. Commission rate scales with lifetime volume tiers.
 */
contract AffiliateTracker is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant REPORTER_ROLE = keccak256("REPORTER_ROLE");

    struct Affiliate {
        uint256 lifetimeVolumeUSD; // 6 decimals
        uint256 pendingPlug;
        uint256 claimedPlug;
        uint256 referrals;
    }

    IERC20 public immutable plug;
    address public treasury;

    // Volume tier thresholds (USD, 6d) => commission bps.
    // <10k = 5%, <50k = 8%, <250k = 12%, else 15%.
    uint256 public constant T1 = 10_000e6;
    uint256 public constant T2 = 50_000e6;
    uint256 public constant T3 = 250_000e6;

    // Plug paid per USD of commission (18d PLUG per 1e6 USD). Configurable.
    uint256 public plugPerUsd = 1e18; // 1 PLUG per $1 commission by default

    mapping(address => Affiliate) public affiliates;

    event SaleRecorded(address indexed affiliate, address indexed buyer, uint256 usdValue, uint256 plugCommission);
    event Claimed(address indexed affiliate, uint256 amount);
    event PlugPerUsdSet(uint256 rate);

    error NothingToClaim();

    constructor(address plugAddress, address treasuryAddress, address admin) {
        plug = IERC20(plugAddress);
        treasury = treasuryAddress;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    function commissionBps(uint256 lifetimeVolume) public pure returns (uint256) {
        if (lifetimeVolume < T1) return 500;
        if (lifetimeVolume < T2) return 800;
        if (lifetimeVolume < T3) return 1_200;
        return 1_500;
    }

    function recordSale(address affiliate, address buyer, uint256 usdValue)
        external
        onlyRole(REPORTER_ROLE)
    {
        Affiliate storage a = affiliates[affiliate];
        uint256 bps = commissionBps(a.lifetimeVolumeUSD);
        uint256 commissionUsd = (usdValue * bps) / 10_000;
        uint256 plugAmount = (commissionUsd * plugPerUsd) / 1e6;

        a.lifetimeVolumeUSD += usdValue;
        a.pendingPlug += plugAmount;
        a.referrals += 1;
        emit SaleRecorded(affiliate, buyer, usdValue, plugAmount);
    }

    function claim() external nonReentrant {
        Affiliate storage a = affiliates[msg.sender];
        uint256 amount = a.pendingPlug;
        if (amount == 0) revert NothingToClaim();
        a.pendingPlug = 0;
        a.claimedPlug += amount;
        // Commissions are paid from treasury allowance to this contract.
        plug.safeTransferFrom(treasury, msg.sender, amount);
        emit Claimed(msg.sender, amount);
    }

    function setPlugPerUsd(uint256 rate) external onlyRole(DEFAULT_ADMIN_ROLE) {
        plugPerUsd = rate;
        emit PlugPerUsdSet(rate);
    }

    function setTreasury(address t) external onlyRole(DEFAULT_ADMIN_ROLE) {
        treasury = t;
    }
}
