// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title SusuCircle
/// @author Digital Plug LLC
/// @notice A single rotating savings circle (ROSCA) instance.
///         Each circle is deployed by SusuFactory.
///         Members contribute each period; one member receives the full pot per period.
///         Supports three payout modes: FIXED_ROTATION, RANDOM (Chainlink VRF stub), BID_AUCTION.
contract SusuCircle is ReentrancyGuard, Pausable {

    // ─── ENUMS ───────────────────────────────────────────────────────────────
    enum PayoutMode   { FIXED_ROTATION, RANDOM, BID_AUCTION }
    enum CircleState  { FORMING, ACTIVE, COMPLETE, DISSOLVED }
    enum MemberStatus { NONE, ENROLLED, GOOD_STANDING, DEFAULTED, COMPLETED }

    // ─── STRUCTS ─────────────────────────────────────────────────────────────
    struct Member {
        address  wallet;
        MemberStatus status;
        uint256  bondDeposited;      // Refundable security bond
        uint256  contributionsMade;
        bool     hasReceivedPayout;
        uint256  payoutPeriod;       // Which period they received the pot
        uint256  bidAmount;          // For BID_AUCTION mode
    }

    struct Period {
        uint256  index;
        uint256  startTime;
        uint256  endTime;
        address  recipient;
        uint256  potAmount;
        bool     settled;
        uint256  contributorsCount;
    }

    // ─── CONFIG (set at construction, immutable) ─────────────────────────────
    address   public  organizer;
    IERC20    public  token;              // $PLUG or USDC
    uint256   public  contributionAmount; // Per member per period
    uint256   public  bondAmount;         // = 1x contribution (anti-default deposit)
    uint256   public  periodDuration;     // Seconds per period
    uint256   public  maxMembers;
    PayoutMode public payoutMode;
    string    public  name;

    // ─── STATE ───────────────────────────────────────────────────────────────
    CircleState public state;

    address[]               public memberList;
    mapping(address=>Member) public members;

    Period[]   public periods;
    uint256    public currentPeriod;      // 1-indexed
    uint256    public circleStartTime;

    /// For FIXED_ROTATION: organizer-set order
    address[] public payoutOrder;

    /// For BID_AUCTION: highest bidder per period
    mapping(uint256 => address) public periodBidWinner;
    mapping(uint256 => uint256) public periodHighBid;

    /// Default tracking
    uint256 public gracePeriodDuration = 1 days;
    mapping(address => uint256) public missedContributions;

    // ─── FEES ────────────────────────────────────────────────────────────────
    uint256 public constant PLATFORM_FEE_BPS = 100; // 1% to Digital Plug
    address public feeRecipient;

    // ─── EVENTS ──────────────────────────────────────────────────────────────
    event MemberJoined(address indexed member, uint256 bondAmount);
    event CircleStarted(uint256 startTime, uint256 memberCount);
    event ContributionMade(address indexed member, uint256 period, uint256 amount);
    event PotPaidOut(address indexed recipient, uint256 period, uint256 amount);
    event MemberDefaulted(address indexed member, uint256 period);
    event BidPlaced(address indexed member, uint256 period, uint256 amount);
    event CircleCompleted(uint256 totalDistributed);
    event BondRefunded(address indexed member, uint256 amount);

    // ─── ERRORS ──────────────────────────────────────────────────────────────
    error NotOrganizer();
    error CircleNotForming();
    error CircleFull();
    error AlreadyMember();
    error NotMember();
    error CircleNotActive();
    error PeriodNotOpen();
    error AlreadyContributed();
    error AlreadyReceived();
    error InsufficientBid();
    error DefaultedMember();
    error TransferFailed();

    // ─── CONSTRUCTOR ─────────────────────────────────────────────────────────
    constructor(
        address         _organizer,
        address         _token,
        uint256         _contributionAmount,
        uint256         _periodDuration,
        uint256         _maxMembers,
        PayoutMode      _payoutMode,
        string memory   _name,
        address         _feeRecipient
    ) {
        organizer           = _organizer;
        token               = IERC20(_token);
        contributionAmount  = _contributionAmount;
        bondAmount          = _contributionAmount;   // bond = 1 period contribution
        periodDuration      = _periodDuration;
        maxMembers          = _maxMembers;
        payoutMode          = _payoutMode;
        name                = _name;
        feeRecipient        = _feeRecipient;
        state               = CircleState.FORMING;
    }

    // ═════════════════════════════════════════════════════════════════════════
    // ENROLLMENT
    // ═════════════════════════════════════════════════════════════════════════

    /// @notice Join circle by depositing bond. Circle must be in FORMING state.
    function joinCircle() external nonReentrant {
        if (state != CircleState.FORMING)         revert CircleNotForming();
        if (memberList.length >= maxMembers)      revert CircleFull();
        if (members[msg.sender].status != MemberStatus.NONE) revert AlreadyMember();

        // Pull bond from sender
        bool ok = token.transferFrom(msg.sender, address(this), bondAmount);
        if (!ok) revert TransferFailed();

        memberList.push(msg.sender);
        members[msg.sender] = Member({
            wallet:             msg.sender,
            status:             MemberStatus.ENROLLED,
            bondDeposited:      bondAmount,
            contributionsMade:  0,
            hasReceivedPayout:  false,
            payoutPeriod:       0,
            bidAmount:          0
        });

        emit MemberJoined(msg.sender, bondAmount);

        // Auto-start when full
        if (memberList.length == maxMembers) {
            _startCircle();
        }
    }

    function _startCircle() internal {
        state            = CircleState.ACTIVE;
        circleStartTime  = block.timestamp;
        currentPeriod    = 1;

        // Initialize payout order for FIXED_ROTATION
        if (payoutMode == PayoutMode.FIXED_ROTATION) {
            for (uint i = 0; i < memberList.length; i++) {
                payoutOrder.push(memberList[i]);
            }
        }

        // Mark all as good standing
        for (uint i = 0; i < memberList.length; i++) {
            members[memberList[i]].status = MemberStatus.GOOD_STANDING;
        }

        emit CircleStarted(circleStartTime, memberList.length);
    }

    // ═════════════════════════════════════════════════════════════════════════
    // CONTRIBUTIONS
    // ═════════════════════════════════════════════════════════════════════════

    /// @notice Contribute for the current period
    function contribute() external nonReentrant whenNotPaused {
        if (state != CircleState.ACTIVE)                         revert CircleNotActive();
        Member storage m = members[msg.sender];
        if (m.status == MemberStatus.NONE)                       revert NotMember();
        if (m.status == MemberStatus.DEFAULTED)                  revert DefaultedMember();
        if (m.contributionsMade >= currentPeriod)                revert AlreadyContributed();
        if (!_isPeriodOpen())                                    revert PeriodNotOpen();

        bool ok = token.transferFrom(msg.sender, address(this), contributionAmount);
        if (!ok) revert TransferFailed();

        m.contributionsMade++;

        emit ContributionMade(msg.sender, currentPeriod, contributionAmount);

        // Check if all members have contributed → settle period
        if (_allContributed()) {
            _settlePeriod();
        }
    }

    function _isPeriodOpen() internal view returns (bool) {
        uint256 elapsed = block.timestamp - circleStartTime;
        uint256 periodStart = (currentPeriod - 1) * periodDuration;
        uint256 periodEnd   = periodStart + periodDuration;
        return elapsed >= periodStart && elapsed < periodEnd;
    }

    function _allContributed() internal view returns (bool) {
        for (uint i = 0; i < memberList.length; i++) {
            Member storage m = members[memberList[i]];
            if (m.status != MemberStatus.DEFAULTED && m.contributionsMade < currentPeriod) {
                return false;
            }
        }
        return true;
    }

    // ═════════════════════════════════════════════════════════════════════════
    // BID AUCTION MODE
    // ═════════════════════════════════════════════════════════════════════════

    /// @notice Place a bid to receive this period's payout early
    /// @dev    Higher bid = pay more, others share the extra as bonus
    function placeBid(uint256 bidAmount_) external whenNotPaused {
        if (state != CircleState.ACTIVE)              revert CircleNotActive();
        if (payoutMode != PayoutMode.BID_AUCTION)     revert PeriodNotOpen();
        if (members[msg.sender].status == MemberStatus.NONE) revert NotMember();
        if (members[msg.sender].hasReceivedPayout)    revert AlreadyReceived();
        if (bidAmount_ <= periodHighBid[currentPeriod]) revert InsufficientBid();

        periodHighBid[currentPeriod]   = bidAmount_;
        periodBidWinner[currentPeriod] = msg.sender;
        members[msg.sender].bidAmount  = bidAmount_;

        emit BidPlaced(msg.sender, currentPeriod, bidAmount_);
    }

    // ═════════════════════════════════════════════════════════════════════════
    // PERIOD SETTLEMENT
    // ═════════════════════════════════════════════════════════════════════════

    function _settlePeriod() internal {
        address recipient = _determineRecipient();

        // Calculate pot: sum of all contributions this period
        uint256 pot = 0;
        for (uint i = 0; i < memberList.length; i++) {
            if (members[memberList[i]].contributionsMade >= currentPeriod) {
                pot += contributionAmount;
            }
        }

        // Deduct platform fee
        uint256 fee     = (pot * PLATFORM_FEE_BPS) / 10000;
        uint256 payout  = pot - fee;

        // Transfer fee
        if (fee > 0) token.transfer(feeRecipient, fee);

        // Transfer payout to recipient
        token.transfer(recipient, payout);

        members[recipient].hasReceivedPayout = true;
        members[recipient].payoutPeriod      = currentPeriod;

        emit PotPaidOut(recipient, currentPeriod, payout);

        // Advance or complete
        if (currentPeriod >= memberList.length) {
            _completeCircle(pot * memberList.length);
        } else {
            currentPeriod++;
        }
    }

    function _determineRecipient() internal view returns (address) {
        if (payoutMode == PayoutMode.FIXED_ROTATION) {
            // Return whoever hasn't received yet in order
            for (uint i = 0; i < payoutOrder.length; i++) {
                if (!members[payoutOrder[i]].hasReceivedPayout) {
                    return payoutOrder[i];
                }
            }
        } else if (payoutMode == PayoutMode.BID_AUCTION) {
            address bidWinner = periodBidWinner[currentPeriod];
            if (bidWinner != address(0)) return bidWinner;
        }
        // RANDOM mode: return first eligible (VRF integration point for developers)
        // Developer kit: implement Chainlink VRF callback here
        for (uint i = 0; i < memberList.length; i++) {
            if (!members[memberList[i]].hasReceivedPayout) {
                return memberList[i];
            }
        }
        return memberList[0];
    }

    function _completeCircle(uint256 totalDistributed) internal {
        state = CircleState.COMPLETE;
        // Refund all bonds
        for (uint i = 0; i < memberList.length; i++) {
            address m = memberList[i];
            uint256 bond = members[m].bondDeposited;
            if (bond > 0) {
                members[m].bondDeposited = 0;
                members[m].status = MemberStatus.COMPLETED;
                token.transfer(m, bond);
                emit BondRefunded(m, bond);
            }
        }
        emit CircleCompleted(totalDistributed);
    }

    // ═════════════════════════════════════════════════════════════════════════
    // DEFAULT HANDLING
    // ═════════════════════════════════════════════════════════════════════════

    /// @notice Mark a member as defaulted if they missed the grace period
    function flagDefault(address member) external {
        if (state != CircleState.ACTIVE) revert CircleNotActive();
        Member storage m = members[member];
        if (m.contributionsMade >= currentPeriod) return; // Not actually defaulted

        uint256 elapsed   = block.timestamp - circleStartTime;
        uint256 periodEnd = (currentPeriod - 1) * periodDuration + periodDuration + gracePeriodDuration;
        require(elapsed > periodEnd, "Grace period not elapsed");

        // Slash bond
        uint256 penalty = m.bondDeposited / 2;
        m.bondDeposited -= penalty;
        m.status         = MemberStatus.DEFAULTED;
        missedContributions[member]++;

        // Distribute penalty to other members
        uint256 activeMembers = 0;
        for (uint i = 0; i < memberList.length; i++) {
            if (members[memberList[i]].status == MemberStatus.GOOD_STANDING) activeMembers++;
        }
        if (activeMembers > 0) {
            uint256 share = penalty / activeMembers;
            for (uint i = 0; i < memberList.length; i++) {
                if (members[memberList[i]].status == MemberStatus.GOOD_STANDING) {
                    token.transfer(memberList[i], share);
                }
            }
        }

        emit MemberDefaulted(member, currentPeriod);
    }

    // ─── VIEWS ───────────────────────────────────────────────────────────────
    function getMemberCount() external view returns (uint256) { return memberList.length; }
    function getMembers() external view returns (address[] memory) { return memberList; }
    function getMember(address wallet) external view returns (Member memory) { return members[wallet]; }
}
