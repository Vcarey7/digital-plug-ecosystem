// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title HomeschoolVault
 * @author Digital Plug Co. — Digital Black Wall Street
 * @notice Per-family education savings with milestone-gated disbursements.
 *         A sponsor funds a child's plan; a VERIFIER releases funds as
 *         curriculum milestones are completed.
 */
contract HomeschoolVault is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");

    struct Plan {
        address guardian;
        address child;       // payout wallet (or guardian)
        uint256 balance;
        uint256 milestonesTotal;
        uint256 milestonesDone;
    }

    IERC20 public immutable usdc;
    uint256 public nextPlanId = 1;
    mapping(uint256 => Plan) public plans;

    event PlanCreated(uint256 indexed id, address guardian, address child, uint256 milestones);
    event PlanFunded(uint256 indexed id, uint256 amount);
    event MilestoneReleased(uint256 indexed id, uint256 amount, uint256 milestonesDone);

    error AllMilestonesDone();
    error EmptyPlan();

    constructor(address usdcAddress, address admin) {
        usdc = IERC20(usdcAddress);
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(VERIFIER_ROLE, admin);
    }

    function createPlan(address child, uint256 milestonesTotal)
        external
        returns (uint256 id)
    {
        id = nextPlanId++;
        plans[id] = Plan(msg.sender, child, 0, milestonesTotal, 0);
        emit PlanCreated(id, msg.sender, child, milestonesTotal);
    }

    function fund(uint256 id, uint256 amount) external nonReentrant {
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        plans[id].balance += amount;
        emit PlanFunded(id, amount);
    }

    /// @notice Verifier releases one milestone's equal share of the balance.
    function releaseMilestone(uint256 id) external onlyRole(VERIFIER_ROLE) nonReentrant {
        Plan storage p = plans[id];
        if (p.milestonesDone >= p.milestonesTotal) revert AllMilestonesDone();
        if (p.balance == 0) revert EmptyPlan();
        uint256 remaining = p.milestonesTotal - p.milestonesDone;
        uint256 payout = p.balance / remaining;
        p.balance -= payout;
        p.milestonesDone += 1;
        usdc.safeTransfer(p.child, payout);
        emit MilestoneReleased(id, payout, p.milestonesDone);
    }
}

/**
 * @title TeacherRetentionFund
 * @notice Pays teachers longevity bonuses. An admin enrolls a teacher with a
 *         schedule of time-based milestone bonuses (e.g. 1yr, 3yr, 5yr).
 *         Bonuses vest by timestamp and are claimable in USDC + a $PLUG kicker.
 */
contract TeacherRetentionFund is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    struct Milestone {
        uint64 vestAt;
        uint256 usdcBonus;
        uint256 plugBonus;
        bool claimed;
    }

    IERC20 public immutable usdc;
    IERC20 public immutable plug;
    mapping(address => Milestone[]) public schedule;

    event Enrolled(address indexed teacher, uint256 milestones);
    event MilestoneAdded(address indexed teacher, uint64 vestAt, uint256 usdcBonus, uint256 plugBonus);
    event BonusClaimed(address indexed teacher, uint256 index, uint256 usdcOut, uint256 plugOut);

    error NotVested();
    error AlreadyClaimed();

    constructor(address usdcAddress, address plugAddress, address admin) {
        usdc = IERC20(usdcAddress);
        plug = IERC20(plugAddress);
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
    }

    function addMilestone(
        address teacher,
        uint64 vestAt,
        uint256 usdcBonus,
        uint256 plugBonus
    ) external onlyRole(ADMIN_ROLE) {
        schedule[teacher].push(Milestone(vestAt, usdcBonus, plugBonus, false));
        emit MilestoneAdded(teacher, vestAt, usdcBonus, plugBonus);
    }

    function claim(uint256 index) external nonReentrant {
        Milestone storage m = schedule[msg.sender][index];
        if (block.timestamp < m.vestAt) revert NotVested();
        if (m.claimed) revert AlreadyClaimed();
        m.claimed = true;
        if (m.usdcBonus > 0) usdc.safeTransfer(msg.sender, m.usdcBonus);
        if (m.plugBonus > 0) plug.safeTransfer(msg.sender, m.plugBonus);
        emit BonusClaimed(msg.sender, index, m.usdcBonus, m.plugBonus);
    }

    function milestoneCount(address teacher) external view returns (uint256) {
        return schedule[teacher].length;
    }

    function fund(uint256 usdcAmount, uint256 plugAmount) external onlyRole(ADMIN_ROLE) {
        if (usdcAmount > 0) usdc.safeTransferFrom(msg.sender, address(this), usdcAmount);
        if (plugAmount > 0) plug.safeTransferFrom(msg.sender, address(this), plugAmount);
    }
}

/**
 * @title EducationVault
 * @notice General scholarship pool. Donors deposit USDC; admins award
 *         scholarships to recipients who claim within a deadline.
 */
contract EducationVault is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant AWARDER_ROLE = keccak256("AWARDER_ROLE");

    struct Award {
        address recipient;
        uint256 amount;
        uint64 claimBy;
        bool claimed;
    }

    IERC20 public immutable usdc;
    uint256 public totalDonated;
    uint256 public reserved;
    uint256 public nextAwardId = 1;
    mapping(uint256 => Award) public awards;

    event Donated(address indexed donor, uint256 amount);
    event Awarded(uint256 indexed id, address recipient, uint256 amount, uint64 claimBy);
    event Claimed(uint256 indexed id, address recipient, uint256 amount);
    event AwardExpired(uint256 indexed id);

    error InsufficientFree();
    error NotRecipient();
    error ClaimWindowPassed();
    error AlreadyClaimed();
    error StillClaimable();

    constructor(address usdcAddress, address admin) {
        usdc = IERC20(usdcAddress);
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(AWARDER_ROLE, admin);
    }

    function donate(uint256 amount) external nonReentrant {
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        totalDonated += amount;
        emit Donated(msg.sender, amount);
    }

    function award(address recipient, uint256 amount, uint64 claimBy)
        external
        onlyRole(AWARDER_ROLE)
        returns (uint256 id)
    {
        uint256 free = usdc.balanceOf(address(this)) - reserved;
        if (amount > free) revert InsufficientFree();
        reserved += amount;
        id = nextAwardId++;
        awards[id] = Award(recipient, amount, claimBy, false);
        emit Awarded(id, recipient, amount, claimBy);
    }

    function claim(uint256 id) external nonReentrant {
        Award storage a = awards[id];
        if (a.recipient != msg.sender) revert NotRecipient();
        if (a.claimed) revert AlreadyClaimed();
        if (block.timestamp > a.claimBy) revert ClaimWindowPassed();
        a.claimed = true;
        reserved -= a.amount;
        usdc.safeTransfer(msg.sender, a.amount);
        emit Claimed(id, msg.sender, a.amount);
    }

    /// @notice Reclaim an unclaimed, expired award back to the free pool.
    function expireAward(uint256 id) external onlyRole(AWARDER_ROLE) {
        Award storage a = awards[id];
        if (a.claimed) revert AlreadyClaimed();
        if (block.timestamp <= a.claimBy) revert StillClaimable();
        reserved -= a.amount;
        a.claimed = true;
        emit AwardExpired(id);
    }
}
