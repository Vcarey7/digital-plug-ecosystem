// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title FamilyBankingVault
 * @author Digital Plug Co. — Digital Black Wall Street
 * @notice Multi-member family treasury. A head-of-household creates a
 *         vault, adds members with spending allowances, and schedules
 *         inheritance: sub-balances that unlock to named beneficiaries
 *         after a set time (dead-man's-switch style, resettable while alive).
 *         Sine Macula — built for legacy.
 */
contract FamilyBankingVault is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Member {
        bool active;
        uint256 allowancePerPeriod; // USDC per period
        uint64 periodLength;        // seconds
        uint64 lastDraw;
    }

    struct Inheritance {
        address beneficiary;
        uint256 amount;
        uint64 unlockTime;
        bool claimed;
    }

    struct Vault {
        address head;
        uint256 balance;
        uint64 checkInDeadline;   // head must check in before this or inheritances unlock
        bool exists;
    }

    IERC20 public immutable usdc;

    uint256 public nextVaultId = 1;
    mapping(uint256 => Vault) public vaults;
    mapping(uint256 => mapping(address => Member)) public members;
    mapping(uint256 => Inheritance[]) public inheritances;

    event VaultCreated(uint256 indexed vaultId, address indexed head);
    event Deposited(uint256 indexed vaultId, address indexed from, uint256 amount);
    event MemberSet(uint256 indexed vaultId, address indexed member, uint256 allowance, uint64 period);
    event AllowanceDrawn(uint256 indexed vaultId, address indexed member, uint256 amount);
    event InheritanceScheduled(uint256 indexed vaultId, uint256 indexed index, address beneficiary, uint256 amount, uint64 unlockTime);
    event InheritanceClaimed(uint256 indexed vaultId, uint256 indexed index, address beneficiary, uint256 amount);
    event CheckedIn(uint256 indexed vaultId, uint64 newDeadline);
    event HeadWithdrawal(uint256 indexed vaultId, uint256 amount);

    error NotHead();
    error NotMember();
    error InsufficientBalance();
    error AllowanceNotReady();
    error AllowanceExceedsBalance();
    error InheritanceLocked();
    error AlreadyClaimed();
    error NotBeneficiary();
    error VaultMissing();

    constructor(address usdcAddress, address admin) {
        usdc = IERC20(usdcAddress);
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    modifier onlyHead(uint256 vaultId) {
        if (vaults[vaultId].head != msg.sender) revert NotHead();
        _;
    }

    // ─── Setup / funding ──────────────────────────────────────────────────────

    function createVault(uint64 checkInWindow) external returns (uint256 vaultId) {
        vaultId = nextVaultId++;
        vaults[vaultId] = Vault({
            head: msg.sender,
            balance: 0,
            checkInDeadline: uint64(block.timestamp) + checkInWindow,
            exists: true
        });
        emit VaultCreated(vaultId, msg.sender);
    }

    function deposit(uint256 vaultId, uint256 amount) external nonReentrant {
        if (!vaults[vaultId].exists) revert VaultMissing();
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        vaults[vaultId].balance += amount;
        emit Deposited(vaultId, msg.sender, amount);
    }

    // ─── Members / allowances ─────────────────────────────────────────────────

    function setMember(
        uint256 vaultId,
        address member,
        uint256 allowancePerPeriod,
        uint64 periodLength
    ) external onlyHead(vaultId) {
        members[vaultId][member] = Member({
            active: true,
            allowancePerPeriod: allowancePerPeriod,
            periodLength: periodLength,
            lastDraw: 0
        });
        emit MemberSet(vaultId, member, allowancePerPeriod, periodLength);
    }

    function removeMember(uint256 vaultId, address member) external onlyHead(vaultId) {
        members[vaultId][member].active = false;
    }

    function drawAllowance(uint256 vaultId) external nonReentrant {
        Member storage m = members[vaultId][msg.sender];
        if (!m.active) revert NotMember();
        if (block.timestamp < m.lastDraw + m.periodLength) revert AllowanceNotReady();
        Vault storage v = vaults[vaultId];
        if (m.allowancePerPeriod > v.balance) revert AllowanceExceedsBalance();

        m.lastDraw = uint64(block.timestamp);
        v.balance -= m.allowancePerPeriod;
        usdc.safeTransfer(msg.sender, m.allowancePerPeriod);
        emit AllowanceDrawn(vaultId, msg.sender, m.allowancePerPeriod);
    }

    // ─── Head controls ────────────────────────────────────────────────────────

    function headWithdraw(uint256 vaultId, uint256 amount)
        external
        onlyHead(vaultId)
        nonReentrant
    {
        Vault storage v = vaults[vaultId];
        if (amount > v.balance) revert InsufficientBalance();
        v.balance -= amount;
        usdc.safeTransfer(msg.sender, amount);
        emit HeadWithdrawal(vaultId, amount);
    }

    function checkIn(uint256 vaultId, uint64 window) external onlyHead(vaultId) {
        vaults[vaultId].checkInDeadline = uint64(block.timestamp) + window;
        emit CheckedIn(vaultId, vaults[vaultId].checkInDeadline);
    }

    // ─── Inheritance ──────────────────────────────────────────────────────────

    function scheduleInheritance(
        uint256 vaultId,
        address beneficiary,
        uint256 amount,
        uint64 unlockTime
    ) external onlyHead(vaultId) returns (uint256 index) {
        Vault storage v = vaults[vaultId];
        if (amount > v.balance) revert InsufficientBalance();
        // Earmark: reduce spendable balance now.
        v.balance -= amount;
        inheritances[vaultId].push(Inheritance(beneficiary, amount, unlockTime, false));
        index = inheritances[vaultId].length - 1;
        emit InheritanceScheduled(vaultId, index, beneficiary, amount, unlockTime);
    }

    /// @notice Beneficiary claims after unlockTime AND after the head's
    ///         check-in deadline has lapsed (proof-of-absence).
    function claimInheritance(uint256 vaultId, uint256 index) external nonReentrant {
        Inheritance storage inh = inheritances[vaultId][index];
        Vault storage v = vaults[vaultId];
        if (inh.beneficiary != msg.sender) revert NotBeneficiary();
        if (inh.claimed) revert AlreadyClaimed();
        if (block.timestamp < inh.unlockTime || block.timestamp < v.checkInDeadline) {
            revert InheritanceLocked();
        }
        inh.claimed = true;
        usdc.safeTransfer(msg.sender, inh.amount);
        emit InheritanceClaimed(vaultId, index, msg.sender, inh.amount);
    }

    function inheritanceCount(uint256 vaultId) external view returns (uint256) {
        return inheritances[vaultId].length;
    }
}
