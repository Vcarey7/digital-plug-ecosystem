// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title SavingsVault
 * @author Digital Plug Co. — Digital Black Wall Street
 * @notice USDC savings with term-locked tiers and simple linear APY.
 *         Yield is funded by the treasury topping up the reward reserve.
 *         Designed for community members building on-chain savings habits.
 *
 * Terms      APY
 *  Flexible   4%   (withdraw anytime)
 *  90 days    7%
 *  180 days   10%
 *  365 days   14%
 *
 * WAVE 2 — HOLD FOR LEGAL REVIEW. Fixed, protocol-set APY on pooled USDC
 * deposits is a textbook Howey investment contract. Do not deploy or
 * market until a securities attorney has cleared it.
 */
contract SavingsVault is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant FUNDER_ROLE = keccak256("FUNDER_ROLE");

    enum Term { FLEXIBLE, D90, D180, D365 }

    struct Deposit {
        uint256 principal;
        uint64 start;
        uint64 unlock;
        Term term;
        bool withdrawn;
    }

    IERC20 public immutable usdc;
    mapping(Term => uint256) public apyBps;
    mapping(Term => uint64) public lockDuration;

    mapping(address => Deposit[]) public deposits;
    uint256 public rewardReserve;
    uint256 public totalPrincipal;

    event Deposited(address indexed user, uint256 indexed index, uint256 amount, Term term, uint64 unlock);
    event Withdrawn(address indexed user, uint256 indexed index, uint256 principal, uint256 yield_);
    event ReserveFunded(uint256 amount);

    error StillLocked();
    error AlreadyWithdrawn();
    error InsufficientReserve();
    error ZeroAmount();

    constructor(address usdcAddress, address admin) {
        usdc = IERC20(usdcAddress);
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(FUNDER_ROLE, admin);

        apyBps[Term.FLEXIBLE] = 400;
        apyBps[Term.D90] = 700;
        apyBps[Term.D180] = 1_000;
        apyBps[Term.D365] = 1_400;

        lockDuration[Term.FLEXIBLE] = 0;
        lockDuration[Term.D90] = 90 days;
        lockDuration[Term.D180] = 180 days;
        lockDuration[Term.D365] = 365 days;
    }

    function deposit(uint256 amount, Term term) external nonReentrant returns (uint256 index) {
        if (amount == 0) revert ZeroAmount();
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        uint64 unlock = uint64(block.timestamp) + lockDuration[term];
        deposits[msg.sender].push(Deposit(amount, uint64(block.timestamp), unlock, term, false));
        totalPrincipal += amount;
        index = deposits[msg.sender].length - 1;
        emit Deposited(msg.sender, index, amount, term, unlock);
    }

    function withdraw(uint256 index) external nonReentrant {
        Deposit storage d = deposits[msg.sender][index];
        if (d.withdrawn) revert AlreadyWithdrawn();
        if (block.timestamp < d.unlock) revert StillLocked();

        uint256 yield_ = _accruedYield(d);
        if (yield_ > rewardReserve) revert InsufficientReserve();

        d.withdrawn = true;
        totalPrincipal -= d.principal;
        rewardReserve -= yield_;

        usdc.safeTransfer(msg.sender, d.principal + yield_);
        emit Withdrawn(msg.sender, index, d.principal, yield_);
    }

    function _accruedYield(Deposit storage d) internal view returns (uint256) {
        uint256 elapsed = block.timestamp - d.start;
        return (d.principal * apyBps[d.term] * elapsed) / (10_000 * 365 days);
    }

    function accruedYield(address user, uint256 index) external view returns (uint256) {
        return _accruedYield(deposits[user][index]);
    }

    function depositCount(address user) external view returns (uint256) {
        return deposits[user].length;
    }

    function fundReserve(uint256 amount) external onlyRole(FUNDER_ROLE) {
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        rewardReserve += amount;
        emit ReserveFunded(amount);
    }

    function setAPY(Term term, uint256 bps) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(bps <= 5_000, "MAX 50%");
        apyBps[term] = bps;
    }
}
