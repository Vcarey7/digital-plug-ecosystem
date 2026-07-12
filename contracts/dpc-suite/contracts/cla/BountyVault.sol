// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "../shared/IPlugToken.sol";
import "./CLARegistry.sol";

/// @title BountyVault
/// @author Digital Plug LLC
/// @notice Holds $PLUG bounty pool. Issues payouts to contributors upon
///         milestone approval. Enforces CLA and tier requirements.
///         Records every payout back to CLARegistry for contribution tracking.
contract BountyVault is AccessControl, ReentrancyGuard, Pausable {

    bytes32 public constant ADMIN_ROLE    = keccak256("ADMIN_ROLE");
    bytes32 public constant REVIEWER_ROLE = keccak256("REVIEWER_ROLE");

    // ─── STRUCTS ────────────────────────────────────────────────────────────

    enum BountyStatus { OPEN, CLAIMED, SUBMITTED, APPROVED, PAID, CANCELLED }

    struct Bounty {
        uint256 id;
        string  title;
        string  kitModule;          // e.g. "Kit-A-Credit-M3"
        CLARegistry.KitTier minTier;
        uint256 plugAmount;         // $PLUG reward
        uint256 cashAmountUSD;      // Informational — paid off-chain via Stripe
        address claimer;            // Contributor who claimed
        BountyStatus status;
        uint256 createdAt;
        uint256 claimedAt;
        uint256 paidAt;
        bytes32 prHash;             // keccak256 of PR URL for audit trail
    }

    // ─── STATE ───────────────────────────────────────────────────────────────
    IPlugToken   public plugToken;
    CLARegistry  public claRegistry;

    uint256 private _nextBountyId;
    mapping(uint256 => Bounty) public bounties;

    /// contributor => list of paid bounty IDs
    mapping(address => uint256[]) public contributorBounties;

    uint256 public totalPlugPaid;
    uint256 public totalBountiesCompleted;

    // ─── EVENTS ──────────────────────────────────────────────────────────────
    event BountyCreated(uint256 indexed id, string title, uint256 plugAmount, CLARegistry.KitTier minTier);
    event BountyClaimed(uint256 indexed id, address indexed contributor);
    event BountySubmitted(uint256 indexed id, address indexed contributor, bytes32 prHash);
    event BountyApproved(uint256 indexed id, address indexed reviewer);
    event BountyPaid(uint256 indexed id, address indexed contributor, uint256 plugAmount);
    event BountyCancelled(uint256 indexed id, string reason);

    // ─── ERRORS ──────────────────────────────────────────────────────────────
    error NoCLA();
    error InsufficientTier(CLARegistry.KitTier required, CLARegistry.KitTier held);
    error BountyNotOpen();
    error BountyNotClaimed();
    error BountyNotSubmitted();
    error NotTheClaimer();
    error InsufficientVaultBalance();

    // ─── CONSTRUCTOR ─────────────────────────────────────────────────────────
    constructor(address _plugToken, address _claRegistry, address admin) {
        plugToken   = IPlugToken(_plugToken);
        claRegistry = CLARegistry(_claRegistry);

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        _grantRole(REVIEWER_ROLE, admin);
    }

    // ═════════════════════════════════════════════════════════════════════════
    // BOUNTY LIFECYCLE
    // ═════════════════════════════════════════════════════════════════════════

    function createBounty(
        string calldata title,
        string calldata kitModule,
        CLARegistry.KitTier minTier,
        uint256 plugAmount,
        uint256 cashAmountUSD
    ) external onlyRole(ADMIN_ROLE) returns (uint256) {
        uint256 id = ++_nextBountyId;
        bounties[id] = Bounty({
            id:            id,
            title:         title,
            kitModule:     kitModule,
            minTier:       minTier,
            plugAmount:    plugAmount,
            cashAmountUSD: cashAmountUSD,
            claimer:       address(0),
            status:        BountyStatus.OPEN,
            createdAt:     block.timestamp,
            claimedAt:     0,
            paidAt:        0,
            prHash:        bytes32(0)
        });
        emit BountyCreated(id, title, plugAmount, minTier);
        return id;
    }

    /// @notice Contributor claims a bounty — must have valid CLA at correct tier
    function claimBounty(uint256 bountyId) external whenNotPaused {
        Bounty storage b = bounties[bountyId];
        if (b.status != BountyStatus.OPEN) revert BountyNotOpen();

        // CLA gate
        if (!claRegistry.hasActiveCLA(msg.sender)) revert NoCLA();
        CLARegistry.Agreement memory ag = claRegistry.getAgreement(msg.sender);
        if (uint8(ag.tier) < uint8(b.minTier))
            revert InsufficientTier(b.minTier, ag.tier);

        b.claimer   = msg.sender;
        b.status    = BountyStatus.CLAIMED;
        b.claimedAt = block.timestamp;

        emit BountyClaimed(bountyId, msg.sender);
    }

    /// @notice Contributor submits PR hash to mark work as complete
    function submitBounty(uint256 bountyId, bytes32 prHash) external whenNotPaused {
        Bounty storage b = bounties[bountyId];
        if (b.status != BountyStatus.CLAIMED) revert BountyNotClaimed();
        if (b.claimer != msg.sender) revert NotTheClaimer();

        b.status = BountyStatus.SUBMITTED;
        b.prHash = prHash;

        emit BountySubmitted(bountyId, msg.sender, prHash);
    }

    /// @notice Reviewer approves and triggers automatic $PLUG payout
    function approveBounty(uint256 bountyId) external onlyRole(REVIEWER_ROLE) nonReentrant {
        Bounty storage b = bounties[bountyId];
        if (b.status != BountyStatus.SUBMITTED) revert BountyNotSubmitted();

        if (plugToken.balanceOf(address(this)) < b.plugAmount)
            revert InsufficientVaultBalance();

        b.status = BountyStatus.APPROVED;
        emit BountyApproved(bountyId, msg.sender);

        // Pay out
        _executePayout(bountyId);
    }

    function _executePayout(uint256 bountyId) internal {
        Bounty storage b = bounties[bountyId];
        b.status  = BountyStatus.PAID;
        b.paidAt  = block.timestamp;

        contributorBounties[b.claimer].push(bountyId);
        totalPlugPaid         += b.plugAmount;
        totalBountiesCompleted++;

        // Record in CLARegistry for reputation tracking
        claRegistry.recordContribution(b.claimer, b.plugAmount);

        // Transfer $PLUG to contributor
        plugToken.transfer(b.claimer, b.plugAmount);

        emit BountyPaid(bountyId, b.claimer, b.plugAmount);
    }

    function cancelBounty(uint256 bountyId, string calldata reason)
        external onlyRole(ADMIN_ROLE)
    {
        bounties[bountyId].status = BountyStatus.CANCELLED;
        emit BountyCancelled(bountyId, reason);
    }

    // ─── VIEWS ───────────────────────────────────────────────────────────────
    function getContributorBounties(address contributor)
        external view returns (uint256[] memory)
    {
        return contributorBounties[contributor];
    }

    function vaultBalance() external view returns (uint256) {
        return plugToken.balanceOf(address(this));
    }

    // ─── ADMIN ───────────────────────────────────────────────────────────────
    function pause()   external onlyRole(ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(ADMIN_ROLE) { _unpause(); }
}
