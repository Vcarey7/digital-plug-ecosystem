// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/// @title CLARegistry
/// @author Digital Plug LLC
/// @notice On-chain Contributor License Agreement registry.
///         Every developer who purchases a kit signs this contract.
///         Signing mints a soulbound (non-transferable) CLA NFT to their wallet.
///         The NFT gates access to repos, bounties, and revenue share.
/// @dev    Inherits ERC-721 but overrides transfer functions to enforce soulbound behavior.
///         Integrates with BountyVault for automatic payout authorization.
contract CLARegistry is ERC721, ERC721Enumerable, AccessControl, ReentrancyGuard, Pausable {

    // ─── ROLES ──────────────────────────────────────────────────────────────
    bytes32 public constant ADMIN_ROLE      = keccak256("ADMIN_ROLE");
    bytes32 public constant OPERATOR_ROLE   = keccak256("OPERATOR_ROLE");
    bytes32 public constant REVOKER_ROLE    = keccak256("REVOKER_ROLE");

    // ─── KIT TIERS ──────────────────────────────────────────────────────────
    enum KitTier { NONE, STARTER, BUILDER, ECOSYSTEM }

    // ─── STRUCTS ────────────────────────────────────────────────────────────

    /// @notice Full agreement record stored per token
    struct Agreement {
        address contributor;        // Wallet that signed
        KitTier tier;               // Kit tier purchased
        bytes32 claVersion;         // keccak256 hash of the CLA document text
        bytes32 documentIPFSHash;   // IPFS CID of the signed PDF (bytes32 of CIDv1)
        uint256 signedAt;           // Block timestamp of signing
        uint256 expiresAt;          // 0 = perpetual; otherwise unix timestamp
        bool    active;             // Can be revoked by REVOKER_ROLE
        uint256 contributionCount;  // Incremented by BountyVault on merge
        uint256 totalEarned;        // Cumulative $PLUG earned (wei)
        string  githubUsername;     // Off-chain identity link (not verified on-chain)
    }

    /// @notice CLA document version registry
    struct CLAVersion {
        bytes32 contentHash;        // keccak256 of the full CLA text
        string  ipfsCID;            // Human-readable IPFS CID
        uint256 publishedAt;
        bool    active;             // Only active versions can be signed
    }

    // ─── STATE ───────────────────────────────────────────────────────────────
    uint256 private _nextTokenId;

    /// tokenId => Agreement
    mapping(uint256 => Agreement) public agreements;

    /// contributor address => tokenId (one CLA per wallet)
    mapping(address => uint256) public contributorToken;

    /// CLA version index => CLAVersion
    mapping(uint256 => CLAVersion) public claVersions;
    uint256 public currentVersionIndex;

    /// Revoked contributors cannot re-sign
    mapping(address => bool) public permanentlyBanned;

    /// Authorized bounty contracts that can record contributions
    mapping(address => bool) public authorizedBountyContracts;

    // ─── EVENTS ──────────────────────────────────────────────────────────────
    event CLASigned(
        address indexed contributor,
        uint256 indexed tokenId,
        KitTier tier,
        bytes32 claVersion,
        uint256 timestamp
    );
    event CLARevoked(
        address indexed contributor,
        uint256 indexed tokenId,
        string  reason,
        uint256 timestamp
    );
    event CLAUpgraded(
        address indexed contributor,
        uint256 indexed tokenId,
        KitTier oldTier,
        KitTier newTier
    );
    event ContributionRecorded(
        address indexed contributor,
        uint256 indexed tokenId,
        uint256 plugAmount,
        uint256 newTotal
    );
    event CLAVersionPublished(
        uint256 indexed versionIndex,
        bytes32 contentHash,
        string  ipfsCID
    );
    event BountyContractAuthorized(address indexed bountyContract, bool authorized);

    // ─── ERRORS ──────────────────────────────────────────────────────────────
    error AlreadySigned();
    error PermanentlyBanned();
    error NoActiveCLAVersion();
    error InvalidTier();
    error Soulbound();
    error NotActive();
    error NotAuthorizedBountyContract();
    error InsufficientTierForAction(KitTier required, KitTier held);
    error CannotDowngradeTier();

    // ─── CONSTRUCTOR ─────────────────────────────────────────────────────────
    constructor(address admin) ERC721("Digital Plug CLA", "DPCLA") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        _grantRole(OPERATOR_ROLE, admin);
        _grantRole(REVOKER_ROLE, admin);
    }

    // ═════════════════════════════════════════════════════════════════════════
    // SIGNING
    // ═════════════════════════════════════════════════════════════════════════

    /// @notice Sign the current CLA and mint a soulbound NFT
    /// @param  tier           Kit tier being purchased (STARTER, BUILDER, or ECOSYSTEM)
    /// @param  documentHash   IPFS hash of the contributor's signed PDF copy
    /// @param  githubUsername Contributor's GitHub handle for off-chain linking
    /// @dev    Emits CLASigned. Reverts if contributor already has an active CLA.
    function signCLA(
        KitTier         tier,
        bytes32         documentHash,
        string calldata githubUsername
    ) external nonReentrant whenNotPaused {
        if (permanentlyBanned[msg.sender])       revert PermanentlyBanned();
        if (contributorToken[msg.sender] != 0)   revert AlreadySigned();
        if (tier == KitTier.NONE)                revert InvalidTier();
        if (currentVersionIndex == 0)            revert NoActiveCLAVersion();

        CLAVersion storage ver = claVersions[currentVersionIndex];
        if (!ver.active) revert NoActiveCLAVersion();

        uint256 tokenId = ++_nextTokenId;

        agreements[tokenId] = Agreement({
            contributor:       msg.sender,
            tier:              tier,
            claVersion:        ver.contentHash,
            documentIPFSHash:  documentHash,
            signedAt:          block.timestamp,
            expiresAt:         0,
            active:            true,
            contributionCount: 0,
            totalEarned:       0,
            githubUsername:    githubUsername
        });

        contributorToken[msg.sender] = tokenId;
        _safeMint(msg.sender, tokenId);

        emit CLASigned(msg.sender, tokenId, tier, ver.contentHash, block.timestamp);
    }

    // ═════════════════════════════════════════════════════════════════════════
    // TIER MANAGEMENT
    // ═════════════════════════════════════════════════════════════════════════

    /// @notice Upgrade a contributor's kit tier (e.g. Starter → Builder)
    /// @dev    Only OPERATOR_ROLE. Cannot downgrade.
    function upgradeTier(address contributor, KitTier newTier)
        external onlyRole(OPERATOR_ROLE)
    {
        uint256 tokenId = contributorToken[contributor];
        Agreement storage ag = agreements[tokenId];
        if (!ag.active) revert NotActive();
        if (newTier <= ag.tier) revert CannotDowngradeTier();

        KitTier old = ag.tier;
        ag.tier = newTier;
        emit CLAUpgraded(contributor, tokenId, old, newTier);
    }

    // ═════════════════════════════════════════════════════════════════════════
    // CONTRIBUTION TRACKING (called by BountyVault on merge)
    // ═════════════════════════════════════════════════════════════════════════

    /// @notice Record a merged contribution and update earnings
    /// @dev    Only callable by authorized bounty contracts
    function recordContribution(address contributor, uint256 plugAmount)
        external
    {
        if (!authorizedBountyContracts[msg.sender])
            revert NotAuthorizedBountyContract();

        uint256 tokenId = contributorToken[contributor];
        Agreement storage ag = agreements[tokenId];
        if (!ag.active) revert NotActive();

        ag.contributionCount++;
        ag.totalEarned += plugAmount;

        emit ContributionRecorded(contributor, tokenId, plugAmount, ag.totalEarned);
    }

    // ═════════════════════════════════════════════════════════════════════════
    // REVOCATION
    // ═════════════════════════════════════════════════════════════════════════

    /// @notice Revoke a contributor's CLA (e.g. breach of confidentiality)
    /// @param  permanent  If true, contributor can never re-sign
    function revokeCLA(address contributor, string calldata reason, bool permanent)
        external onlyRole(REVOKER_ROLE)
    {
        uint256 tokenId = contributorToken[contributor];
        Agreement storage ag = agreements[tokenId];
        ag.active = false;

        if (permanent) permanentlyBanned[contributor] = true;

        emit CLARevoked(contributor, tokenId, reason, block.timestamp);
    }

    // ═════════════════════════════════════════════════════════════════════════
    // ACCESS CONTROL CHECKS (used by token-gated systems)
    // ═════════════════════════════════════════════════════════════════════════

    /// @notice Check if a wallet has a valid, active CLA
    function hasActiveCLA(address contributor) public view returns (bool) {
        uint256 tokenId = contributorToken[contributor];
        if (tokenId == 0) return false;
        Agreement storage ag = agreements[tokenId];
        if (!ag.active) return false;
        if (ag.expiresAt != 0 && block.timestamp > ag.expiresAt) return false;
        return true;
    }

    /// @notice Check if contributor meets a minimum tier requirement
    function meetsMinTier(address contributor, KitTier required) public view returns (bool) {
        if (!hasActiveCLA(contributor)) return false;
        uint256 tokenId = contributorToken[contributor];
        return uint8(agreements[tokenId].tier) >= uint8(required);
    }

    /// @notice Get full agreement details for a contributor
    function getAgreement(address contributor) external view returns (Agreement memory) {
        uint256 tokenId = contributorToken[contributor];
        return agreements[tokenId];
    }

    // ═════════════════════════════════════════════════════════════════════════
    // CLA VERSION MANAGEMENT
    // ═════════════════════════════════════════════════════════════════════════

    /// @notice Publish a new CLA version
    /// @param  contentHash keccak256 of the full CLA document text
    /// @param  ipfsCID     Human-readable IPFS CID of the document
    function publishCLAVersion(bytes32 contentHash, string calldata ipfsCID)
        external onlyRole(ADMIN_ROLE)
    {
        // Deactivate previous version
        if (currentVersionIndex > 0) {
            claVersions[currentVersionIndex].active = false;
        }

        currentVersionIndex++;
        claVersions[currentVersionIndex] = CLAVersion({
            contentHash:  contentHash,
            ipfsCID:      ipfsCID,
            publishedAt:  block.timestamp,
            active:       true
        });

        emit CLAVersionPublished(currentVersionIndex, contentHash, ipfsCID);
    }

    /// @notice Authorize or deauthorize a bounty contract to record contributions
    function setAuthorizedBountyContract(address bountyContract, bool authorized)
        external onlyRole(ADMIN_ROLE)
    {
        authorizedBountyContracts[bountyContract] = authorized;
        emit BountyContractAuthorized(bountyContract, authorized);
    }

    // ═════════════════════════════════════════════════════════════════════════
    // SOULBOUND ENFORCEMENT — block all transfers
    // ═════════════════════════════════════════════════════════════════════════

    function transferFrom(address, address, uint256) public pure override(ERC721, IERC721) {
        revert Soulbound();
    }

    function safeTransferFrom(address, address, uint256, bytes memory)
        public pure override(ERC721, IERC721)
    {
        revert Soulbound();
    }

    // ─── REQUIRED OVERRIDES ──────────────────────────────────────────────────
    function _update(address to, uint256 tokenId, address auth)
        internal override(ERC721, ERC721Enumerable) returns (address)
    {
        // Allow minting (from == address(0)) but block transfers
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) revert Soulbound();
        return super._update(to, tokenId, auth);
    }

    function _increaseBalance(address account, uint128 value)
        internal override(ERC721, ERC721Enumerable)
    {
        super._increaseBalance(account, value);
    }

    function supportsInterface(bytes4 interfaceId)
        public view override(ERC721, ERC721Enumerable, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function pause()   external onlyRole(ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(ADMIN_ROLE) { _unpause(); }
}
