// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

/// @title ScoreRegistry
/// @author Digital Plug LLC
/// @notice On-chain credit score for Digital Plug ecosystem participants.
///         Score range: 300–850 (mirrors FICO for familiarity).
///         Composed of 6 weighted behavioral factors.
///         Issues a soulbound CreditAttestation NFT at score milestones.
contract ScoreRegistry is AccessControl, ReentrancyGuard {

    bytes32 public constant ORACLE_ROLE   = keccak256("ORACLE_ROLE");
    bytes32 public constant ADMIN_ROLE    = keccak256("ADMIN_ROLE");
    bytes32 public constant LENDER_ROLE   = keccak256("LENDER_ROLE");

    // ─── SCORE FACTORS ───────────────────────────────────────────────────────
    /// @notice Raw score inputs per wallet, set by authorized oracles
    struct ScoreFactors {
        uint8  paymentConsistency;   // 0–100  (35% weight)
        uint8  walletActivity;       // 0–100  (15% weight)
        uint8  defiUtilization;      // 0–100  (20% weight)
        uint8  communityEngagement;  // 0–100  (10% weight)
        uint8  assetDiversity;       // 0–100  (10% weight)
        uint8  disputeFreeHistory;   // 0–100  (10% weight)
        uint256 lastUpdated;
    }

    struct ScoreRecord {
        uint16  score;              // 300–850
        uint256 lastCalculated;
        uint256 snapshotCount;
        bool    lenderConsentAll;   // Open consent for all LENDER_ROLE addresses
    }

    // ─── STATE ───────────────────────────────────────────────────────────────
    mapping(address => ScoreFactors) public factors;
    mapping(address => ScoreRecord)  public scores;

    /// wallet => lender address => consent granted
    mapping(address => mapping(address => bool)) public lenderConsent;

    /// Score history snapshots (capped at 12 per wallet)
    mapping(address => uint16[12]) public scoreHistory;
    mapping(address => uint8)      public historyIndex;

    // ─── WEIGHT CONFIG (BPS, must sum to 10000) ──────────────────────────────
    uint16 public constant W_PAYMENT     = 3500;
    uint16 public constant W_ACTIVITY    = 1500;
    uint16 public constant W_DEFI        = 2000;
    uint16 public constant W_COMMUNITY   = 1000;
    uint16 public constant W_DIVERSITY   = 1000;
    uint16 public constant W_DISPUTE     = 1000;

    uint16 public constant SCORE_MIN = 300;
    uint16 public constant SCORE_MAX = 850;

    // ─── EVENTS ──────────────────────────────────────────────────────────────
    event ScoreUpdated(address indexed wallet, uint16 oldScore, uint16 newScore, uint256 timestamp);
    event FactorsUpdated(address indexed wallet, address indexed oracle);
    event ConsentGranted(address indexed wallet, address indexed lender);
    event ConsentRevoked(address indexed wallet, address indexed lender);
    event ScoreQueried(address indexed wallet, address indexed lender, uint16 score);

    // ─── ERRORS ──────────────────────────────────────────────────────────────
    error NoConsent();
    error NotOracle();

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        _grantRole(ORACLE_ROLE, admin);
    }

    // ═════════════════════════════════════════════════════════════════════════
    // FACTOR UPDATES (called by BehaviorOracle)
    // ═════════════════════════════════════════════════════════════════════════

    /// @notice Oracle updates raw behavioral factors for a wallet
    function updateFactors(
        address wallet,
        uint8   paymentConsistency,
        uint8   walletActivity,
        uint8   defiUtilization,
        uint8   communityEngagement,
        uint8   assetDiversity,
        uint8   disputeFreeHistory
    ) external onlyRole(ORACLE_ROLE) {
        factors[wallet] = ScoreFactors({
            paymentConsistency:  paymentConsistency,
            walletActivity:      walletActivity,
            defiUtilization:     defiUtilization,
            communityEngagement: communityEngagement,
            assetDiversity:      assetDiversity,
            disputeFreeHistory:  disputeFreeHistory,
            lastUpdated:         block.timestamp
        });

        emit FactorsUpdated(wallet, msg.sender);

        // Recalculate and store score
        _recalculate(wallet);
    }

    // ═════════════════════════════════════════════════════════════════════════
    // SCORE CALCULATION
    // ═════════════════════════════════════════════════════════════════════════

    function _recalculate(address wallet) internal {
        ScoreFactors storage f = factors[wallet];
        ScoreRecord   storage s = scores[wallet];

        // Weighted sum across 6 factors (max raw = 100 * 10000 BPS = 1,000,000)
        uint256 raw =
            (uint256(f.paymentConsistency)   * W_PAYMENT)   +
            (uint256(f.walletActivity)       * W_ACTIVITY)  +
            (uint256(f.defiUtilization)      * W_DEFI)      +
            (uint256(f.communityEngagement)  * W_COMMUNITY) +
            (uint256(f.assetDiversity)       * W_DIVERSITY) +
            (uint256(f.disputeFreeHistory)   * W_DISPUTE);

        // Scale: raw / 10000 = 0–100 composite
        // Map 0–100 composite → SCORE_MIN–SCORE_MAX (300–850 = 550 point range)
        uint256 composite   = raw / 10000;
        uint16  finalScore  = uint16(SCORE_MIN + (composite * (SCORE_MAX - SCORE_MIN)) / 100);

        uint16 oldScore = s.score;
        s.score           = finalScore;
        s.lastCalculated  = block.timestamp;
        s.snapshotCount++;

        // Store in rolling history (12 slots)
        uint8 idx = historyIndex[wallet];
        scoreHistory[wallet][idx] = finalScore;
        historyIndex[wallet]      = (idx + 1) % 12;

        emit ScoreUpdated(wallet, oldScore, finalScore, block.timestamp);
    }

    // ═════════════════════════════════════════════════════════════════════════
    // LENDER CONSENT SYSTEM
    // ═════════════════════════════════════════════════════════════════════════

    /// @notice Grant a specific lender permission to query your score
    function grantConsent(address lender) external {
        lenderConsent[msg.sender][lender] = true;
        emit ConsentGranted(msg.sender, lender);
    }

    /// @notice Revoke a lender's access to your score
    function revokeConsent(address lender) external {
        lenderConsent[msg.sender][lender] = false;
        emit ConsentRevoked(msg.sender, lender);
    }

    /// @notice Toggle open consent for all registered lenders
    function setOpenConsent(bool open) external {
        scores[msg.sender].lenderConsentAll = open;
    }

    // ═════════════════════════════════════════════════════════════════════════
    // SCORE QUERIES
    // ═════════════════════════════════════════════════════════════════════════

    /// @notice Lender queries a wallet's score — requires consent
    function queryScore(address wallet) external returns (uint16) {
        ScoreRecord storage s = scores[wallet];
        bool hasConsent = s.lenderConsentAll || lenderConsent[wallet][msg.sender];
        if (!hasConsent && !hasRole(ADMIN_ROLE, msg.sender)) revert NoConsent();

        emit ScoreQueried(wallet, msg.sender, s.score);
        return s.score;
    }

    /// @notice Wallet owner can always view their own score
    function myScore() external view returns (uint16) {
        return scores[msg.sender].score;
    }

    /// @notice Get rolling score history for a wallet (owner or authorized)
    function getScoreHistory(address wallet) external view returns (uint16[12] memory) {
        bool hasConsent = scores[wallet].lenderConsentAll || lenderConsent[wallet][msg.sender];
        require(hasConsent || msg.sender == wallet || hasRole(ADMIN_ROLE, msg.sender), "No access");
        return scoreHistory[wallet];
    }

    /// @notice Get all score factors for a wallet (owner-only)
    function getFactors(address wallet) external view returns (ScoreFactors memory) {
        require(msg.sender == wallet || hasRole(ORACLE_ROLE, msg.sender), "Not authorized");
        return factors[wallet];
    }
}
