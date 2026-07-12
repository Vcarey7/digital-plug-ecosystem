// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "../shared/IPlugToken.sol";

/// @title BlackBusinessRegistry
/// @author Digital Plug LLC
/// @notice On-chain verified directory of Black-owned businesses.
///         Registration requires staking $PLUG + DAO validator approval.
///         Verified businesses receive a soulbound ERC-721 badge.
///         Spend tracking records $PLUG purchases at registered businesses.
contract BlackBusinessRegistry is ERC721, AccessControl, ReentrancyGuard, Pausable {

    bytes32 public constant ADMIN_ROLE     = keccak256("ADMIN_ROLE");
    bytes32 public constant VALIDATOR_ROLE = keccak256("VALIDATOR_ROLE");

    // ─── ENUMS ───────────────────────────────────────────────────────────────
    enum VerificationStatus { UNREGISTERED, PENDING, VERIFIED, SUSPENDED, REJECTED }

    // ─── STRUCTS ─────────────────────────────────────────────────────────────
    struct Business {
        uint256 id;
        address owner;
        string  name;
        string  category;           // e.g. "Food", "Tech", "Health"
        string  ipfsDocsHash;       // IPFS CID of ownership documents
        string  location;           // City, State
        VerificationStatus status;
        uint256 registeredAt;
        uint256 verifiedAt;
        uint256 stakeAmount;        // $PLUG staked (returned after 6mo)
        uint256 stakeUnlocksAt;     // Timestamp when stake can be withdrawn
        uint256 totalSalesVolume;   // Cumulative $PLUG spend through this business
        uint256 reviewCount;
        uint256 reputationScore;    // 0–1000
    }

    struct ValidationVote {
        uint256 businessId;
        uint8   approvals;
        uint8   rejections;
        uint8   required;           // Quorum needed (default: 2)
        mapping(address => bool) hasVoted;
        bool    resolved;
    }

    struct SpendReceipt {
        uint256 receiptId;
        address buyer;
        uint256 businessId;
        uint256 amount;
        uint256 timestamp;
    }

    // ─── STATE ───────────────────────────────────────────────────────────────
    IPlugToken public plugToken;

    uint256 private _nextBusinessId;
    uint256 private _nextReceiptId;

    mapping(uint256 => Business)        public businesses;
    mapping(address  => uint256)        public ownerBusiness; // one per address
    mapping(uint256  => ValidationVote) public votes;
    mapping(uint256  => SpendReceipt)   public receipts;

    /// buyer => list of receipt IDs at a business
    mapping(address  => uint256[])      public buyerReceipts;
    /// buyer => businessId => receipt count (used to gate reviews)
    mapping(address  => mapping(uint256=>uint256)) public purchaseCount;

    uint256 public constant STAKE_AMOUNT      = 100 ether;   // 100 $PLUG
    uint256 public constant STAKE_LOCK_PERIOD = 180 days;
    uint256 public constant PLATFORM_FEE_BPS  = 50;          // 0.5% on spend
    address public feeRecipient;

    // ─── EVENTS ──────────────────────────────────────────────────────────────
    event BusinessRegistered(uint256 indexed id, address indexed owner, string name, string category);
    event BusinessVerified(uint256 indexed id, uint256 timestamp);
    event BusinessSuspended(uint256 indexed id, string reason);
    event ValidatorVoted(uint256 indexed businessId, address indexed validator, bool approved);
    event SpendRecorded(uint256 indexed receiptId, address indexed buyer, uint256 indexed businessId, uint256 amount);
    event StakeWithdrawn(uint256 indexed businessId, address owner, uint256 amount);
    event ReputationUpdated(uint256 indexed businessId, uint256 newScore);

    // ─── ERRORS ──────────────────────────────────────────────────────────────
    error AlreadyRegistered();
    error BusinessNotPending();
    error AlreadyVoted();
    error BusinessNotVerified();
    error StakeLocked();
    error NoPurchaseRequired();
    error TransferFailed();

    // ─── CONSTRUCTOR ─────────────────────────────────────────────────────────
    constructor(address _plugToken, address _feeRecipient, address admin)
        ERC721("Digital Plug Verified Business", "DPBIZ")
    {
        plugToken    = IPlugToken(_plugToken);
        feeRecipient = _feeRecipient;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        _grantRole(VALIDATOR_ROLE, admin);
    }

    // ═════════════════════════════════════════════════════════════════════════
    // REGISTRATION
    // ═════════════════════════════════════════════════════════════════════════

    /// @notice Register a business and stake $PLUG for verification
    function registerBusiness(
        string calldata name,
        string calldata category,
        string calldata ipfsDocsHash,
        string calldata location
    ) external nonReentrant whenNotPaused {
        if (ownerBusiness[msg.sender] != 0) revert AlreadyRegistered();

        // Pull stake
        bool ok = plugToken.transferFrom(msg.sender, address(this), STAKE_AMOUNT);
        if (!ok) revert TransferFailed();

        uint256 id = ++_nextBusinessId;
        businesses[id] = Business({
            id:               id,
            owner:            msg.sender,
            name:             name,
            category:         category,
            ipfsDocsHash:     ipfsDocsHash,
            location:         location,
            status:           VerificationStatus.PENDING,
            registeredAt:     block.timestamp,
            verifiedAt:       0,
            stakeAmount:      STAKE_AMOUNT,
            stakeUnlocksAt:   0,
            totalSalesVolume: 0,
            reviewCount:      0,
            reputationScore:  500  // Start at neutral
        });

        ownerBusiness[msg.sender] = id;

        // Initialize vote
        ValidationVote storage v = votes[id];
        v.businessId = id;
        v.required   = 2;          // 2-of-3 validators must approve

        emit BusinessRegistered(id, msg.sender, name, category);
    }

    // ═════════════════════════════════════════════════════════════════════════
    // VALIDATOR DAO
    // ═════════════════════════════════════════════════════════════════════════

    /// @notice Validator votes on a pending business
    function vote(uint256 businessId, bool approve) external onlyRole(VALIDATOR_ROLE) {
        Business storage b = businesses[businessId];
        if (b.status != VerificationStatus.PENDING) revert BusinessNotPending();

        ValidationVote storage v = votes[businessId];
        if (v.hasVoted[msg.sender]) revert AlreadyVoted();
        if (v.resolved) revert BusinessNotPending();

        v.hasVoted[msg.sender] = true;
        if (approve) { v.approvals++; } else { v.rejections++; }

        emit ValidatorVoted(businessId, msg.sender, approve);

        // Check quorum
        if (v.approvals >= v.required) {
            _verifyBusiness(businessId);
        } else if (v.rejections >= v.required) {
            b.status   = VerificationStatus.REJECTED;
            v.resolved = true;
            // Return half the stake on rejection (anti-spam)
            plugToken.transfer(b.owner, STAKE_AMOUNT / 2);
        }
    }

    function _verifyBusiness(uint256 businessId) internal {
        Business storage b = businesses[businessId];
        b.status         = VerificationStatus.VERIFIED;
        b.verifiedAt     = block.timestamp;
        b.stakeUnlocksAt = block.timestamp + STAKE_LOCK_PERIOD;
        votes[businessId].resolved = true;

        // Mint soulbound verification NFT
        _safeMint(b.owner, businessId);

        emit BusinessVerified(businessId, block.timestamp);
    }

    // ═════════════════════════════════════════════════════════════════════════
    // SPEND TRACKING
    // ═════════════════════════════════════════════════════════════════════════

    /// @notice Record a $PLUG purchase at a verified business
    /// @dev    Buyer approves this contract to spend their $PLUG before calling
    function recordSpend(uint256 businessId, uint256 amount) external nonReentrant whenNotPaused {
        Business storage b = businesses[businessId];
        if (b.status != VerificationStatus.VERIFIED) revert BusinessNotVerified();

        uint256 fee    = (amount * PLATFORM_FEE_BPS) / 10000;
        uint256 payout = amount - fee;

        // Transfer from buyer to business (minus platform fee)
        plugToken.transferFrom(msg.sender, b.owner, payout);
        if (fee > 0) plugToken.transferFrom(msg.sender, feeRecipient, fee);

        uint256 receiptId = ++_nextReceiptId;
        receipts[receiptId] = SpendReceipt({
            receiptId:  receiptId,
            buyer:      msg.sender,
            businessId: businessId,
            amount:     amount,
            timestamp:  block.timestamp
        });

        buyerReceipts[msg.sender].push(receiptId);
        purchaseCount[msg.sender][businessId]++;

        b.totalSalesVolume += amount;
        _updateReputation(businessId);

        emit SpendRecorded(receiptId, msg.sender, businessId, amount);
    }

    // ═════════════════════════════════════════════════════════════════════════
    // REPUTATION SCORING
    // ═════════════════════════════════════════════════════════════════════════

    function _updateReputation(uint256 businessId) internal {
        Business storage b = businesses[businessId];
        // Simple model: capped composite of volume + reviews + tenure
        uint256 tenureMonths = (block.timestamp - b.verifiedAt) / 30 days;
        uint256 score = 300
            + (b.totalSalesVolume   / 1e18 > 100  ? 200 : b.totalSalesVolume  / 1e18 * 2)
            + (b.reviewCount                > 50   ? 200 : b.reviewCount * 4)
            + (tenureMonths                 > 24   ? 200 : tenureMonths * 8)
            + 100; // base
        b.reputationScore = score > 1000 ? 1000 : score;
        emit ReputationUpdated(businessId, b.reputationScore);
    }

    // ═════════════════════════════════════════════════════════════════════════
    // STAKE WITHDRAWAL
    // ═════════════════════════════════════════════════════════════════════════

    function withdrawStake(uint256 businessId) external nonReentrant {
        Business storage b = businesses[businessId];
        require(b.owner == msg.sender, "Not owner");
        require(b.status == VerificationStatus.VERIFIED, "Not verified");
        if (block.timestamp < b.stakeUnlocksAt) revert StakeLocked();
        uint256 amount = b.stakeAmount;
        b.stakeAmount  = 0;
        plugToken.transfer(msg.sender, amount);
        emit StakeWithdrawn(businessId, msg.sender, amount);
    }

    // ─── SOULBOUND ───────────────────────────────────────────────────────────
    function transferFrom(address, address, uint256) public pure override(ERC721) {
        revert("Soulbound: non-transferable");
    }

    function safeTransferFrom(address, address, uint256, bytes memory) public pure override(ERC721) {
        revert("Soulbound: non-transferable");
    }

    // ─── VIEWS ───────────────────────────────────────────────────────────────
    function getBusiness(uint256 id) external view returns (Business memory) { return businesses[id]; }
    function getBuyerReceipts(address buyer) external view returns (uint256[] memory) { return buyerReceipts[buyer]; }
    function hasVerifiedPurchase(address buyer, uint256 businessId) external view returns (bool) {
        return purchaseCount[buyer][businessId] > 0;
    }

    function supportsInterface(bytes4 interfaceId)
        public view override(ERC721, AccessControl) returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function pause()   external onlyRole(ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(ADMIN_ROLE) { _unpause(); }
}
