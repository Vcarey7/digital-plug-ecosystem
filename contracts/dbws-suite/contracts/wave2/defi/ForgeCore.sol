// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title ForgeCore
 * @author Digital Plug Co. — Digital Black Wall Street
 * @notice The forge: burn $PLUG (+ optional USDC premium) to mint Digital
 *         Precious Assets. Includes graduated threat levels and circuit
 *         breakers that throttle or halt forging under stress, plus fee
 *         routing to the forge vault, insurance fund, and absorption fund.
 *
 * WAVE 2 — HOLD FOR LEGAL REVIEW. Feeds AbsorptionFund's floor-price
 * support mechanic and mints DPAToken units — the pooled-fee-funds-price-
 * support pattern is a gray area worth clearing with counsel alongside
 * those two contracts before mainnet.
 */
interface IDPAMintable {
    function mint(address to, uint256 assetId, uint256 amount) external;
}

contract ForgeCore is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    bytes32 public constant GUARDIAN_ROLE = keccak256("GUARDIAN_ROLE");

    enum ThreatLevel { NORMAL, ELEVATED, HIGH, LOCKDOWN }

    struct ForgeRecipe {
        uint256 plugCost;     // PLUG burned per unit
        uint256 usdcPremium;  // USDC per unit (6d)
        bool active;
    }

    IERC20 public immutable plug;
    IERC20 public immutable usdc;
    IDPAMintable public immutable dpa;

    address public forgeVault;    // receives USDC premiums + a PLUG cut
    address public insuranceFund;
    address public absorptionFund;
    address public constant BURN = 0x000000000000000000000000000000000000dEaD;

    ThreatLevel public threatLevel;

    // assetId => recipe
    mapping(uint256 => ForgeRecipe) public recipes;

    // Fee split of the PLUG cost that is NOT burned (bps of plugCost).
    uint256 public vaultCutBps = 500;       // 5% to forge vault
    uint256 public insuranceCutBps = 300;   // 3% to insurance
    uint256 public absorptionCutBps = 200;  // 2% to absorption
    // Remainder (90%) is burned.

    // Per-level throttle: max units per forge call.
    mapping(ThreatLevel => uint256) public maxUnitsPerForge;

    event Forged(address indexed user, uint256 indexed assetId, uint256 units, uint256 plugSpent, uint256 usdcSpent);
    event RecipeSet(uint256 indexed assetId, uint256 plugCost, uint256 usdcPremium, bool active);
    event ThreatLevelSet(ThreatLevel level);
    event FeeSplitSet(uint256 vault, uint256 insurance, uint256 absorption);

    error RecipeInactive();
    error LockedDown();
    error ThrottleExceeded();
    error ZeroUnits();

    constructor(
        address plugAddress,
        address usdcAddress,
        address dpaAddress,
        address _forgeVault,
        address _insuranceFund,
        address _absorptionFund,
        address admin
    ) {
        plug = IERC20(plugAddress);
        usdc = IERC20(usdcAddress);
        dpa = IDPAMintable(dpaAddress);
        forgeVault = _forgeVault;
        insuranceFund = _insuranceFund;
        absorptionFund = _absorptionFund;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(GUARDIAN_ROLE, admin);

        maxUnitsPerForge[ThreatLevel.NORMAL] = 100;
        maxUnitsPerForge[ThreatLevel.ELEVATED] = 25;
        maxUnitsPerForge[ThreatLevel.HIGH] = 5;
        maxUnitsPerForge[ThreatLevel.LOCKDOWN] = 0;
    }

    // ─── Forge ────────────────────────────────────────────────────────────────

    function forge(uint256 assetId, uint256 units)
        external
        nonReentrant
        whenNotPaused
    {
        if (units == 0) revert ZeroUnits();
        if (threatLevel == ThreatLevel.LOCKDOWN) revert LockedDown();
        if (units > maxUnitsPerForge[threatLevel]) revert ThrottleExceeded();

        ForgeRecipe storage r = recipes[assetId];
        if (!r.active) revert RecipeInactive();

        uint256 plugCost = r.plugCost * units;
        uint256 usdcCost = r.usdcPremium * units;

        // Pull PLUG, split fees, burn remainder.
        plug.safeTransferFrom(msg.sender, address(this), plugCost);
        uint256 vaultCut = (plugCost * vaultCutBps) / 10_000;
        uint256 insCut = (plugCost * insuranceCutBps) / 10_000;
        uint256 absCut = (plugCost * absorptionCutBps) / 10_000;
        uint256 burnAmt = plugCost - vaultCut - insCut - absCut;

        if (vaultCut > 0) plug.safeTransfer(forgeVault, vaultCut);
        if (insCut > 0) plug.safeTransfer(insuranceFund, insCut);
        if (absCut > 0) plug.safeTransfer(absorptionFund, absCut);
        if (burnAmt > 0) plug.safeTransfer(BURN, burnAmt);

        if (usdcCost > 0) usdc.safeTransferFrom(msg.sender, forgeVault, usdcCost);

        dpa.mint(msg.sender, assetId, units);
        emit Forged(msg.sender, assetId, units, plugCost, usdcCost);
    }

    // ─── Guardian / admin ─────────────────────────────────────────────────────

    function setRecipe(uint256 assetId, uint256 plugCost, uint256 usdcPremium, bool active)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        recipes[assetId] = ForgeRecipe(plugCost, usdcPremium, active);
        emit RecipeSet(assetId, plugCost, usdcPremium, active);
    }

    function setThreatLevel(ThreatLevel level) external onlyRole(GUARDIAN_ROLE) {
        threatLevel = level;
        emit ThreatLevelSet(level);
    }

    function setMaxUnits(ThreatLevel level, uint256 maxUnits)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        maxUnitsPerForge[level] = maxUnits;
    }

    function setFeeSplit(uint256 vault, uint256 insurance, uint256 absorption)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(vault + insurance + absorption <= 5_000, "MAX 50%");
        vaultCutBps = vault;
        insuranceCutBps = insurance;
        absorptionCutBps = absorption;
        emit FeeSplitSet(vault, insurance, absorption);
    }

    function pause() external onlyRole(GUARDIAN_ROLE) { _pause(); }
    function unpause() external onlyRole(GUARDIAN_ROLE) { _unpause(); }

    function setFundAddresses(address _vault, address _insurance, address _absorption)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        forgeVault = _vault;
        insuranceFund = _insurance;
        absorptionFund = _absorption;
    }
}
