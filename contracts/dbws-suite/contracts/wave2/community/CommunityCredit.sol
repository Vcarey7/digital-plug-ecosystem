// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title CommunityCredit
 * @author Digital Plug Co. — Digital Black Wall Street
 * @notice On-chain credit scoring driven by ecosystem activity, plus a
 *         microloan facility whose limits and rates key off the score.
 *         Scores range 300–850 (FICO-like). Reporters (bonds, savings,
 *         business registry) push activity events that raise scores;
 *         missed loan payments lower them.
 *
 * WAVE 2 — HOLD FOR LEGAL REVIEW. The microloan facility here is real
 * consumer lending at an interest rate — a state lending-license/usury
 * question, a different legal lane from securities. Confirm licensing per
 * state before opening loans to the public. (The scoring half is not the
 * issue; the borrow()/repay() lending mechanism is.)
 */
contract CommunityCredit is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant REPORTER_ROLE = keccak256("REPORTER_ROLE");
    bytes32 public constant UNDERWRITER_ROLE = keccak256("UNDERWRITER_ROLE");

    uint16 public constant MIN_SCORE = 300;
    uint16 public constant MAX_SCORE = 850;
    uint16 public constant START_SCORE = 500;

    struct Profile {
        uint16 score;
        uint32 activityCount;
        bool initialized;
    }

    struct Loan {
        uint256 principal;
        uint256 outstanding;
        uint256 rateBps;      // APR
        uint64 dueDate;
        uint64 lastAccrual;
        bool active;
    }

    IERC20 public immutable usdc;
    address public treasury;

    mapping(address => Profile) public profiles;
    mapping(address => Loan) public loans;
    uint256 public lendingReserve;

    event ActivityRecorded(address indexed wallet, uint8 activityType, uint256 amount, uint16 newScore);
    event LoanOriginated(address indexed borrower, uint256 principal, uint256 rateBps, uint64 dueDate);
    event Repaid(address indexed borrower, uint256 amount, uint256 outstanding);
    event Defaulted(address indexed borrower, uint256 outstanding, uint16 newScore);
    event ReserveFunded(uint256 amount);

    error HasActiveLoan();
    error NoActiveLoan();
    error ScoreTooLow();
    error ExceedsLimit();
    error InsufficientReserve();

    constructor(address usdcAddress, address treasuryAddress, address admin) {
        usdc = IERC20(usdcAddress);
        treasury = treasuryAddress;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(REPORTER_ROLE, admin);
        _grantRole(UNDERWRITER_ROLE, admin);
    }

    // ─── Scoring ──────────────────────────────────────────────────────────────

    function _ensureProfile(address wallet) internal returns (Profile storage p) {
        p = profiles[wallet];
        if (!p.initialized) {
            p.score = START_SCORE;
            p.initialized = true;
        }
    }

    /// @notice activityType: 1 bond, 2 on-time yield, 3 savings, 4 business
    ///         spend, 5 loan repayment. Amount scales the score delta.
    function recordActivity(address wallet, uint8 activityType, uint256 amount)
        external
        onlyRole(REPORTER_ROLE)
    {
        Profile storage p = _ensureProfile(wallet);
        uint16 delta = _scoreDelta(activityType, amount);
        uint16 newScore = p.score + delta;
        if (newScore > MAX_SCORE) newScore = MAX_SCORE;
        p.score = newScore;
        p.activityCount += 1;
        emit ActivityRecorded(wallet, activityType, amount, newScore);
    }

    function _scoreDelta(uint8 activityType, uint256 amount) internal pure returns (uint16) {
        // Diminishing, capped per-event delta.
        uint16 base = activityType == 2 || activityType == 5 ? 8 : 4;
        uint16 sizeBonus = amount >= 1_000e6 ? 4 : amount >= 100e6 ? 2 : 0;
        return base + sizeBonus;
    }

    function scoreOf(address wallet) public view returns (uint16) {
        Profile storage p = profiles[wallet];
        return p.initialized ? p.score : START_SCORE;
    }

    // ─── Lending ──────────────────────────────────────────────────────────────

    function creditLimit(address wallet) public view returns (uint256) {
        uint16 s = scoreOf(wallet);
        if (s < 500) return 0;
        // $50 per point above 500, capped.
        uint256 limit = uint256(s - 500) * 50e6;
        return limit > 25_000e6 ? 25_000e6 : limit;
    }

    function rateFor(address wallet) public view returns (uint256 bps) {
        uint16 s = scoreOf(wallet);
        if (s >= 750) return 800;   // 8%
        if (s >= 650) return 1_400; // 14%
        if (s >= 550) return 2_200; // 22%
        return 3_000;               // 30%
    }

    function fundReserve(uint256 amount) external nonReentrant {
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        lendingReserve += amount;
        emit ReserveFunded(amount);
    }

    function borrow(uint256 amount, uint64 termDays) external nonReentrant {
        if (loans[msg.sender].active) revert HasActiveLoan();
        uint16 s = scoreOf(msg.sender);
        if (s < 550) revert ScoreTooLow();
        if (amount > creditLimit(msg.sender)) revert ExceedsLimit();
        if (amount > lendingReserve) revert InsufficientReserve();

        uint256 rate = rateFor(msg.sender);
        lendingReserve -= amount;
        loans[msg.sender] = Loan({
            principal: amount,
            outstanding: amount,
            rateBps: rate,
            dueDate: uint64(block.timestamp) + uint64(termDays) * 1 days,
            lastAccrual: uint64(block.timestamp),
            active: true
        });
        usdc.safeTransfer(msg.sender, amount);
        emit LoanOriginated(msg.sender, amount, rate, loans[msg.sender].dueDate);
    }

    function _accrue(Loan storage l) internal {
        uint256 elapsed = block.timestamp - l.lastAccrual;
        if (elapsed == 0) return;
        uint256 interest = (l.outstanding * l.rateBps * elapsed) / (10_000 * 365 days);
        l.outstanding += interest;
        l.lastAccrual = uint64(block.timestamp);
    }

    function repay(uint256 amount) external nonReentrant {
        Loan storage l = loans[msg.sender];
        if (!l.active) revert NoActiveLoan();
        _accrue(l);
        uint256 pay = amount > l.outstanding ? l.outstanding : amount;
        usdc.safeTransferFrom(msg.sender, address(this), pay);
        l.outstanding -= pay;
        lendingReserve += pay;

        if (l.outstanding == 0) {
            l.active = false;
            // Reward on-time/full repayment.
            _ensureProfile(msg.sender);
            recordActivityInternal(msg.sender, 5, l.principal);
        }
        emit Repaid(msg.sender, pay, l.outstanding);
    }

    function recordActivityInternal(address wallet, uint8 activityType, uint256 amount) internal {
        Profile storage p = _ensureProfile(wallet);
        uint16 delta = _scoreDelta(activityType, amount);
        uint16 newScore = p.score + delta;
        if (newScore > MAX_SCORE) newScore = MAX_SCORE;
        p.score = newScore;
        emit ActivityRecorded(wallet, activityType, amount, newScore);
    }

    /// @notice Underwriter marks a past-due loan as defaulted; score is slashed.
    function markDefault(address borrower) external onlyRole(UNDERWRITER_ROLE) {
        Loan storage l = loans[borrower];
        if (!l.active) revert NoActiveLoan();
        require(block.timestamp > l.dueDate, "NOT_PAST_DUE");
        l.active = false;
        Profile storage p = _ensureProfile(borrower);
        uint16 slash = 120;
        p.score = p.score > MIN_SCORE + slash ? p.score - slash : MIN_SCORE;
        emit Defaulted(borrower, l.outstanding, p.score);
    }

    function loanBalance(address borrower) external view returns (uint256) {
        Loan storage l = loans[borrower];
        if (!l.active) return 0;
        uint256 elapsed = block.timestamp - l.lastAccrual;
        uint256 interest = (l.outstanding * l.rateBps * elapsed) / (10_000 * 365 days);
        return l.outstanding + interest;
    }
}
