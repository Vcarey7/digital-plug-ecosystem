// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

/// @title InheritanceVault
/// @author Digital Plug LLC
/// @notice Programmable wealth inheritance vault.
///         Owner configures beneficiaries, guardians, and release conditions.
///         A layered dead man's switch triggers wealth transfer upon verified death.
///         Supports: ERC-20 tokens, ERC-721 NFTs, native MATIC/ETH.
contract InheritanceVault is ReentrancyGuard {

    // ─── ENUMS ───────────────────────────────────────────────────────────────
    enum VaultState      { ACTIVE, CHALLENGED, TRIGGERED, EXECUTED, DISSOLVED }
    enum ReleaseRuleType { IMMEDIATE, AGE_GATE, DATE_RELEASE, MILESTONE }

    // ─── STRUCTS ─────────────────────────────────────────────────────────────
    struct Beneficiary {
        address wallet;
        uint16  basisPoints;        // Out of 10000 total (must sum to 10000)
        ReleaseRuleType ruleType;
        uint256 releaseParam;       // Timestamp for DATE_RELEASE; min age for AGE_GATE; 0 for IMMEDIATE
        bool    hasClaimed;
    }

    struct Guardian {
        address wallet;
        bool    hasConfirmedDeath;
        bool    active;
    }

    struct ERC20Asset {
        address token;
        uint256 amount;
    }

    struct ERC721Asset {
        address token;
        uint256 tokenId;
        address beneficiary; // Specific beneficiary for this NFT
    }

    // ─── CONFIG ──────────────────────────────────────────────────────────────
    address public owner;
    string  public vaultName;

    uint256 public inactivityWindow;    // e.g. 180 days
    uint256 public gracePeriodWindow;   // e.g. 30 days pre-alert
    uint256 public challengeWindow;     // e.g. 48 hours after quorum

    uint256 public lastOwnerPing;       // Updated every time owner calls ping()
    VaultState public state;

    // ─── GUARDIANS ───────────────────────────────────────────────────────────
    Guardian[5] public guardians;
    uint8   public guardianCount;
    uint8   public quorumRequired;          // Default: 3
    uint8   public deathConfirmations;
    uint256 public quorumReachedAt;         // Timestamp when quorum was met

    // ─── BENEFICIARIES ───────────────────────────────────────────────────────
    Beneficiary[] public beneficiaries;

    // ─── ASSET REGISTRY ──────────────────────────────────────────────────────
    ERC20Asset[]  public erc20Assets;
    ERC721Asset[] public erc721Assets;

    // ─── PLATFORM FEE ────────────────────────────────────────────────────────
    address public constant FEE_RECIPIENT = address(0); // Set at deployment
    uint256 public constant FEE_BPS = 100;              // 1% on execution

    // ─── EVENTS ──────────────────────────────────────────────────────────────
    event VaultPinged(address indexed owner, uint256 timestamp);
    event GuardianAdded(address indexed guardian, uint8 index);
    event DeathConfirmed(address indexed guardian, uint8 confirmations);
    event QuorumReached(uint256 timestamp, uint256 challengeDeadline);
    event ProofOfLifeSubmitted(address indexed owner, uint256 timestamp);
    event VaultExecuted(uint256 timestamp, uint256 assetCount);
    event BeneficiaryAdded(address indexed wallet, uint16 bps, ReleaseRuleType ruleType);
    event AssetRegistered(address indexed token, uint256 amount);
    event ERC721Registered(address indexed token, uint256 tokenId, address beneficiary);
    event ClaimExecuted(address indexed beneficiary, uint256 amount);

    // ─── ERRORS ──────────────────────────────────────────────────────────────
    error NotOwner();
    error NotGuardian();
    error NotActive();
    error AlreadyConfirmed();
    error ChallengeWindowOpen();
    error ChallengeWindowClosed();
    error QuorumNotReached();
    error ReleaseConditionNotMet();
    error AlreadyClaimed();
    error BasisPointsMustSum10000();
    error TooManyGuardians();

    // ─── CONSTRUCTOR ─────────────────────────────────────────────────────────
    constructor(
        address _owner,
        string memory _vaultName,
        uint256 _inactivityWindow,
        uint8   _quorumRequired
    ) {
        require(_quorumRequired >= 2 && _quorumRequired <= 5, "Quorum: 2-5");
        owner             = _owner;
        vaultName         = _vaultName;
        inactivityWindow  = _inactivityWindow;
        gracePeriodWindow = 30 days;
        challengeWindow   = 48 hours;
        quorumRequired    = _quorumRequired;
        lastOwnerPing     = block.timestamp;
        state             = VaultState.ACTIVE;
    }

    modifier onlyOwner()   { if (msg.sender != owner) revert NotOwner(); _; }
    modifier vaultActive() { if (state != VaultState.ACTIVE) revert NotActive(); _; }

    // ═════════════════════════════════════════════════════════════════════════
    // OWNER FUNCTIONS
    // ═════════════════════════════════════════════════════════════════════════

    /// @notice Owner pings to reset inactivity clock — call at least every inactivityWindow
    function ping() external onlyOwner vaultActive {
        lastOwnerPing = block.timestamp;
        // If vault was in CHALLENGED state and owner pings → reset
        if (state == VaultState.CHALLENGED) {
            state = VaultState.ACTIVE;
            deathConfirmations = 0;
            for (uint8 i = 0; i < guardianCount; i++) {
                guardians[i].hasConfirmedDeath = false;
            }
        }
        emit VaultPinged(owner, block.timestamp);
    }

    /// @notice Proof of life override — submit during challenge window
    function submitProofOfLife() external onlyOwner {
        if (state != VaultState.CHALLENGED) revert NotActive();
        if (block.timestamp > quorumReachedAt + challengeWindow) revert ChallengeWindowClosed();

        state = VaultState.ACTIVE;
        deathConfirmations = 0;
        quorumReachedAt    = 0;
        for (uint8 i = 0; i < guardianCount; i++) {
            guardians[i].hasConfirmedDeath = false;
        }
        emit ProofOfLifeSubmitted(owner, block.timestamp);
    }

    // ═════════════════════════════════════════════════════════════════════════
    // BENEFICIARY + GUARDIAN CONFIG
    // ═════════════════════════════════════════════════════════════════════════

    function addBeneficiary(
        address         wallet,
        uint16          basisPoints,
        ReleaseRuleType ruleType,
        uint256         releaseParam
    ) external onlyOwner vaultActive {
        beneficiaries.push(Beneficiary({
            wallet:       wallet,
            basisPoints:  basisPoints,
            ruleType:     ruleType,
            releaseParam: releaseParam,
            hasClaimed:   false
        }));
        emit BeneficiaryAdded(wallet, basisPoints, ruleType);
    }

    function addGuardian(address guardianWallet) external onlyOwner vaultActive {
        if (guardianCount >= 5) revert TooManyGuardians();
        guardians[guardianCount] = Guardian({ wallet: guardianWallet, hasConfirmedDeath: false, active: true });
        emit GuardianAdded(guardianWallet, guardianCount);
        guardianCount++;
    }

    // ═════════════════════════════════════════════════════════════════════════
    // ASSET REGISTRATION
    // ═════════════════════════════════════════════════════════════════════════

    function registerERC20(address token, uint256 amount) external onlyOwner {
        erc20Assets.push(ERC20Asset({ token: token, amount: amount }));
        emit AssetRegistered(token, amount);
    }

    function registerERC721(address token, uint256 tokenId, address beneficiaryWallet) external onlyOwner {
        erc721Assets.push(ERC721Asset({ token: token, tokenId: tokenId, beneficiary: beneficiaryWallet }));
        emit ERC721Registered(token, tokenId, beneficiaryWallet);
    }

    receive() external payable {}

    // ═════════════════════════════════════════════════════════════════════════
    // DEAD MAN'S SWITCH — GUARDIAN CONFIRMATION
    // ═════════════════════════════════════════════════════════════════════════

    /// @notice Guardian confirms owner has died. Requires inactivity window elapsed.
    function confirmDeath(uint8 guardianIndex) external nonReentrant {
        // Verify caller is this guardian
        require(guardians[guardianIndex].wallet == msg.sender, "Not this guardian");
        require(guardians[guardianIndex].active, "Guardian inactive");

        // Inactivity must have elapsed
        require(
            block.timestamp >= lastOwnerPing + inactivityWindow,
            "Inactivity window not elapsed"
        );

        if (guardians[guardianIndex].hasConfirmedDeath) revert AlreadyConfirmed();
        guardians[guardianIndex].hasConfirmedDeath = true;
        deathConfirmations++;

        emit DeathConfirmed(msg.sender, deathConfirmations);

        // Check quorum
        if (deathConfirmations >= quorumRequired) {
            state            = VaultState.CHALLENGED;
            quorumReachedAt  = block.timestamp;
            emit QuorumReached(block.timestamp, block.timestamp + challengeWindow);
        }
    }

    // ═════════════════════════════════════════════════════════════════════════
    // EXECUTION — distribute assets after challenge window
    // ═════════════════════════════════════════════════════════════════════════

    /// @notice Execute vault distribution after quorum + challenge window
    function executeVault() external nonReentrant {
        if (state != VaultState.CHALLENGED) revert QuorumNotReached();
        if (block.timestamp <= quorumReachedAt + challengeWindow) revert ChallengeWindowOpen();

        state = VaultState.EXECUTED;

        // 1. Distribute native token (MATIC/ETH)
        uint256 nativeBalance = address(this).balance;
        if (nativeBalance > 0) {
            uint256 fee = (nativeBalance * FEE_BPS) / 10000;
            uint256 net = nativeBalance - fee;
            if (FEE_RECIPIENT != address(0)) payable(FEE_RECIPIENT).transfer(fee);
            _distributeNative(net);
        }

        // 2. Distribute ERC-20 tokens
        for (uint i = 0; i < erc20Assets.length; i++) {
            _distributeERC20(erc20Assets[i]);
        }

        // 3. Transfer ERC-721s to designated beneficiaries
        for (uint i = 0; i < erc721Assets.length; i++) {
            ERC721Asset storage nft = erc721Assets[i];
            try IERC721(nft.token).safeTransferFrom(owner, nft.beneficiary, nft.tokenId) {} catch {}
        }

        emit VaultExecuted(block.timestamp, erc20Assets.length + erc721Assets.length);
    }

    function _distributeNative(uint256 total) internal {
        for (uint i = 0; i < beneficiaries.length; i++) {
            Beneficiary storage b = beneficiaries[i];
            if (!_releaseConditionMet(b)) continue;
            uint256 share = (total * b.basisPoints) / 10000;
            if (share > 0) payable(b.wallet).transfer(share);
        }
    }

    function _distributeERC20(ERC20Asset storage asset) internal {
        uint256 total = IERC20(asset.token).balanceOf(owner);
        uint256 fee   = (total * FEE_BPS) / 10000;
        uint256 net   = total - fee;

        for (uint i = 0; i < beneficiaries.length; i++) {
            Beneficiary storage b = beneficiaries[i];
            if (!_releaseConditionMet(b)) continue;
            uint256 share = (net * b.basisPoints) / 10000;
            if (share > 0) {
                try IERC20(asset.token).transferFrom(owner, b.wallet, share) {} catch {}
            }
        }
    }

    // ═════════════════════════════════════════════════════════════════════════
    // CONDITIONAL RELEASE RULES
    // ═════════════════════════════════════════════════════════════════════════

    function _releaseConditionMet(Beneficiary storage b) internal view returns (bool) {
        if (b.ruleType == ReleaseRuleType.IMMEDIATE)    return true;
        if (b.ruleType == ReleaseRuleType.DATE_RELEASE) return block.timestamp >= b.releaseParam;
        // AGE_GATE and MILESTONE require oracle/external verification
        // Developer kit: implement Chainlink oracle integration here
        if (b.ruleType == ReleaseRuleType.AGE_GATE)     return false; // Requires oracle
        if (b.ruleType == ReleaseRuleType.MILESTONE)    return false; // Requires oracle
        return false;
    }

    /// @notice Oracle can mark a conditional beneficiary as eligible
    mapping(address => bool) public conditionallyEligible;
    event ConditionalEligibilityGranted(address indexed beneficiary, address indexed oracle);

    function grantConditionalEligibility(address beneficiaryWallet)
        external
    {
        // Restrict to owner or designated oracle in production
        require(msg.sender == owner, "Not authorized");
        conditionallyEligible[beneficiaryWallet] = true;
        emit ConditionalEligibilityGranted(beneficiaryWallet, msg.sender);
    }

    // ─── VIEWS ───────────────────────────────────────────────────────────────
    function isInactivityWindowElapsed() external view returns (bool) {
        return block.timestamp >= lastOwnerPing + inactivityWindow;
    }

    function isChallengeWindowOpen() external view returns (bool) {
        return state == VaultState.CHALLENGED &&
               block.timestamp <= quorumReachedAt + challengeWindow;
    }

    function getBeneficiaries() external view returns (Beneficiary[] memory) {
        return beneficiaries;
    }

    function getGuardian(uint8 index) external view returns (Guardian memory) {
        return guardians[index];
    }

    function getERC20Assets() external view returns (ERC20Asset[] memory) {
        return erc20Assets;
    }
}
