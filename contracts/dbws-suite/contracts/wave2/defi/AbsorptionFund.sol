// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title AbsorptionFund
 * @author Digital Plug Co. — Digital Black Wall Street
 * @notice Buyer-of-last-resort. Accumulates PLUG/USDC and deploys graduated
 *         buy-side support when a KEEPER signals a stress trigger. Purchases
 *         are recorded on-chain for auditability.
 *
 * WAVE 2 — HOLD FOR LEGAL REVIEW. Floor-price/buy-side support funded by
 * pooled deposits reads as a stability-fund mechanic; get counsel to clear
 * it (alongside ForgeCore/DPAToken, which route into this fund) before it
 * touches mainnet or is marketed to depositors.
 */
contract AbsorptionFund is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant KEEPER_ROLE = keccak256("KEEPER_ROLE");

    IERC20 public immutable plug;
    IERC20 public immutable usdc;

    uint8 public stressLevel; // 0 = calm, up to 5
    // stress level => bps of USDC balance deployable per action
    mapping(uint8 => uint256) public deployBpsAt;

    event StressLevelSet(uint8 level);
    event Absorbed(address indexed seller, uint256 plugIn, uint256 usdcOut);
    event Deployed(address indexed to, uint256 usdcOut, uint8 stressLevel);

    error InvalidLevel();

    constructor(address plugAddress, address usdcAddress, address admin) {
        plug = IERC20(plugAddress);
        usdc = IERC20(usdcAddress);
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(KEEPER_ROLE, admin);

        deployBpsAt[1] = 200;   // 2%
        deployBpsAt[2] = 500;   // 5%
        deployBpsAt[3] = 1_000; // 10%
        deployBpsAt[4] = 2_000; // 20%
        deployBpsAt[5] = 4_000; // 40%
    }

    function setStressLevel(uint8 level) external onlyRole(KEEPER_ROLE) {
        if (level > 5) revert InvalidLevel();
        stressLevel = level;
        emit StressLevelSet(level);
    }

    /// @notice Keeper deploys USDC support to a destination (e.g. a DEX
    ///         router or OTC address) capped by the current stress tier.
    function deploy(address to) external onlyRole(KEEPER_ROLE) nonReentrant returns (uint256 out) {
        uint256 bps = deployBpsAt[stressLevel];
        if (bps == 0) return 0;
        uint256 bal = usdc.balanceOf(address(this));
        out = (bal * bps) / 10_000;
        usdc.safeTransfer(to, out);
        emit Deployed(to, out, stressLevel);
    }

    function setDeployBps(uint8 level, uint256 bps) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (level == 0 || level > 5) revert InvalidLevel();
        deployBpsAt[level] = bps;
    }
}
