// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title RefugeHousing
 * @author Digital Plug Co. — Digital Black Wall Street
 * @notice Project Refuge transitional-housing ledger. Tracks residents,
 *         their Shelter tier, rent credits earned, and graduation. Rent
 *         credits accrue on-time payments toward a move-out grant.
 */
contract RefugeHousing is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant CASE_MANAGER_ROLE = keccak256("CASE_MANAGER_ROLE");

    enum Tier { EMERGENCY, TRANSITIONAL, STEP_UP }

    struct Resident {
        Tier tier;
        uint64 enrolledAt;
        uint256 rentCredits;   // USDC accrued toward grant
        bool active;
        bool graduated;
    }

    IERC20 public immutable usdc;
    address public grantTreasury;
    uint256 public creditPerOnTimePayment = 50e6; // $50 credit per on-time month

    mapping(address => Resident) public residents;

    event Enrolled(address indexed resident, Tier tier);
    event RentRecorded(address indexed resident, uint256 amount, uint256 creditsTotal);
    event TierChanged(address indexed resident, Tier newTier);
    event Graduated(address indexed resident, uint256 grantPaid);

    error NotActive();
    error AlreadyEnrolled();

    constructor(address usdcAddress, address grantTreasuryAddress, address admin) {
        usdc = IERC20(usdcAddress);
        grantTreasury = grantTreasuryAddress;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(CASE_MANAGER_ROLE, admin);
    }

    function enroll(address resident, Tier tier) external onlyRole(CASE_MANAGER_ROLE) {
        if (residents[resident].active) revert AlreadyEnrolled();
        residents[resident] = Resident(tier, uint64(block.timestamp), 0, true, false);
        emit Enrolled(resident, tier);
    }

    /// @notice Resident pays rent; on-time payments earn move-out credits.
    function payRent(uint256 amount) external nonReentrant {
        Resident storage r = residents[msg.sender];
        if (!r.active) revert NotActive();
        usdc.safeTransferFrom(msg.sender, grantTreasury, amount);
        r.rentCredits += creditPerOnTimePayment;
        emit RentRecorded(msg.sender, amount, r.rentCredits);
    }

    function setTier(address resident, Tier tier) external onlyRole(CASE_MANAGER_ROLE) {
        residents[resident].tier = tier;
        emit TierChanged(resident, tier);
    }

    /// @notice Case manager graduates a resident; accrued credits pay out as a
    ///         move-out grant from the grant treasury.
    function graduate(address resident) external onlyRole(CASE_MANAGER_ROLE) nonReentrant {
        Resident storage r = residents[resident];
        if (!r.active) revert NotActive();
        r.active = false;
        r.graduated = true;
        uint256 grant = r.rentCredits;
        if (grant > 0) {
            usdc.safeTransferFrom(grantTreasury, resident, grant);
        }
        emit Graduated(resident, grant);
    }

    function setCreditPerPayment(uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        creditPerOnTimePayment = amount;
    }
}

/**
 * @title ScoreRegistry
 * @notice Generic soulbound score registry other systems can read. Holds a
 *         composite score per wallet aggregated from multiple reporters
 *         (credit, engagement, contribution) with weights.
 */
contract ScoreRegistry is AccessControl {
    bytes32 public constant WRITER_ROLE = keccak256("WRITER_ROLE");

    // wallet => category => rawScore
    mapping(address => mapping(bytes32 => uint256)) public rawScore;
    mapping(bytes32 => uint256) public categoryWeightBps;
    bytes32[] public categories;
    mapping(bytes32 => bool) private categoryKnown;

    event ScoreSet(address indexed wallet, bytes32 indexed category, uint256 value);
    event CategoryWeightSet(bytes32 indexed category, uint256 weightBps);

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(WRITER_ROLE, admin);
    }

    function setCategoryWeight(bytes32 category, uint256 weightBps)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        if (!categoryKnown[category]) {
            categoryKnown[category] = true;
            categories.push(category);
        }
        categoryWeightBps[category] = weightBps;
        emit CategoryWeightSet(category, weightBps);
    }

    function setScore(address wallet, bytes32 category, uint256 value)
        external
        onlyRole(WRITER_ROLE)
    {
        rawScore[wallet][category] = value;
        emit ScoreSet(wallet, category, value);
    }

    function compositeScore(address wallet) external view returns (uint256 total) {
        for (uint256 i = 0; i < categories.length; i++) {
            bytes32 cat = categories[i];
            total += (rawScore[wallet][cat] * categoryWeightBps[cat]) / 10_000;
        }
    }
}

/**
 * @title AIAgentGateway
 * @notice Metered access control for the DBWS AI agent workforce. Users hold
 *         a credit balance (topped up with $PLUG); authorized agent backends
 *         consume credits per call. Gates by AIAccessNFT is done off-chain;
 *         this contract handles the metering + settlement.
 */
contract AIAgentGateway is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant AGENT_ROLE = keccak256("AGENT_ROLE");

    IERC20 public immutable plug;
    address public treasury;
    uint256 public plugPerCredit = 1e16; // 0.01 PLUG per credit

    mapping(address => uint256) public credits;

    event ToppedUp(address indexed user, uint256 plugSpent, uint256 creditsAdded);
    event Consumed(address indexed user, address indexed agent, uint256 credits, string action);
    event RateSet(uint256 plugPerCredit);

    error InsufficientCredits();

    constructor(address plugAddress, address treasuryAddress, address admin) {
        plug = IERC20(plugAddress);
        treasury = treasuryAddress;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    function topUp(uint256 plugAmount) external nonReentrant {
        plug.safeTransferFrom(msg.sender, treasury, plugAmount);
        uint256 creditsAdded = plugAmount / plugPerCredit;
        credits[msg.sender] += creditsAdded;
        emit ToppedUp(msg.sender, plugAmount, creditsAdded);
    }

    /// @notice Agent backend meters a user's usage.
    function consume(address user, uint256 amount, string calldata action)
        external
        onlyRole(AGENT_ROLE)
    {
        if (credits[user] < amount) revert InsufficientCredits();
        credits[user] -= amount;
        emit Consumed(user, msg.sender, amount, action);
    }

    function setRate(uint256 _plugPerCredit) external onlyRole(DEFAULT_ADMIN_ROLE) {
        plugPerCredit = _plugPerCredit;
        emit RateSet(_plugPerCredit);
    }

    function setTreasury(address t) external onlyRole(DEFAULT_ADMIN_ROLE) {
        treasury = t;
    }
}
