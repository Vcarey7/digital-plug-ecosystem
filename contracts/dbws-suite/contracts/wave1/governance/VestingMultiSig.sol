// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title PlugVesting
 * @author Digital Plug Co. — Digital Black Wall Street
 * @notice Linear token vesting with cliff for team, advisors, and partners
 *         (e.g. the Iconic Design equity structure). Admin funds a schedule;
 *         beneficiary claims vested tokens over time. Schedules are revocable
 *         if configured as such at creation.
 */
contract PlugVesting is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Schedule {
        address beneficiary;
        uint256 total;
        uint256 released;
        uint64 start;
        uint64 cliff;       // absolute timestamp
        uint64 end;
        bool revocable;
        bool revoked;
    }

    IERC20 public immutable token;
    uint256 public nextScheduleId = 1;
    mapping(uint256 => Schedule) public schedules;

    event ScheduleCreated(uint256 indexed id, address indexed beneficiary, uint256 total, uint64 start, uint64 cliff, uint64 end);
    event Released(uint256 indexed id, uint256 amount);
    event Revoked(uint256 indexed id, uint256 refunded);

    error NothingVested();
    error NotBeneficiary();
    error NotRevocable();
    error AlreadyRevoked();

    constructor(address tokenAddress, address admin) {
        token = IERC20(tokenAddress);
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    function createSchedule(
        address beneficiary,
        uint256 total,
        uint64 start,
        uint64 cliffDuration,
        uint64 duration,
        bool revocable
    ) external onlyRole(DEFAULT_ADMIN_ROLE) returns (uint256 id) {
        token.safeTransferFrom(msg.sender, address(this), total);
        id = nextScheduleId++;
        schedules[id] = Schedule({
            beneficiary: beneficiary,
            total: total,
            released: 0,
            start: start,
            cliff: start + cliffDuration,
            end: start + duration,
            revocable: revocable,
            revoked: false
        });
        emit ScheduleCreated(id, beneficiary, total, start, start + cliffDuration, start + duration);
    }

    function vestedAmount(uint256 id) public view returns (uint256) {
        Schedule storage s = schedules[id];
        if (block.timestamp < s.cliff) return 0;
        if (block.timestamp >= s.end) return s.total;
        return (s.total * (block.timestamp - s.start)) / (s.end - s.start);
    }

    function releasable(uint256 id) public view returns (uint256) {
        return vestedAmount(id) - schedules[id].released;
    }

    function release(uint256 id) external nonReentrant {
        Schedule storage s = schedules[id];
        if (s.beneficiary != msg.sender) revert NotBeneficiary();
        uint256 amount = releasable(id);
        if (amount == 0) revert NothingVested();
        s.released += amount;
        token.safeTransfer(s.beneficiary, amount);
        emit Released(id, amount);
    }

    function revoke(uint256 id) external onlyRole(DEFAULT_ADMIN_ROLE) nonReentrant {
        Schedule storage s = schedules[id];
        if (!s.revocable) revert NotRevocable();
        if (s.revoked) revert AlreadyRevoked();
        uint256 vested = vestedAmount(id);
        uint256 refund = s.total - vested;
        s.revoked = true;
        s.total = vested; // future vesting halted
        if (refund > 0) token.safeTransfer(msg.sender, refund);
        emit Revoked(id, refund);
    }
}

/**
 * @title PlugMultiSig
 * @author Digital Plug Co. — Digital Black Wall Street
 * @notice Minimal m-of-n multisig for treasury operations. Owners submit,
 *         confirm, and execute arbitrary calls once the confirmation
 *         threshold is met.
 */
contract PlugMultiSig is ReentrancyGuard {
    struct Transaction {
        address to;
        uint256 value;
        bytes data;
        bool executed;
        uint256 confirmations;
    }

    address[] public owners;
    mapping(address => bool) public isOwner;
    uint256 public required;

    Transaction[] public transactions;
    mapping(uint256 => mapping(address => bool)) public confirmed;

    event Submitted(uint256 indexed txId, address indexed owner, address to, uint256 value);
    event Confirmed(uint256 indexed txId, address indexed owner);
    event Revoked(uint256 indexed txId, address indexed owner);
    event Executed(uint256 indexed txId);
    event Deposit(address indexed from, uint256 amount);

    error NotOwner();
    error TxNotExist();
    error AlreadyExecuted();
    error AlreadyConfirmed();
    error NotConfirmed();
    error NotEnoughConfirmations();
    error ExecFailed();

    modifier onlyOwner() {
        if (!isOwner[msg.sender]) revert NotOwner();
        _;
    }

    constructor(address[] memory _owners, uint256 _required) {
        require(_owners.length > 0 && _required > 0 && _required <= _owners.length, "PARAMS");
        for (uint256 i = 0; i < _owners.length; i++) {
            address o = _owners[i];
            require(o != address(0) && !isOwner[o], "OWNER");
            isOwner[o] = true;
            owners.push(o);
        }
        required = _required;
    }

    receive() external payable {
        emit Deposit(msg.sender, msg.value);
    }

    function submit(address to, uint256 value, bytes calldata data)
        external
        onlyOwner
        returns (uint256 txId)
    {
        transactions.push(Transaction(to, value, data, false, 0));
        txId = transactions.length - 1;
        emit Submitted(txId, msg.sender, to, value);
        _confirm(txId);
    }

    function confirm(uint256 txId) external onlyOwner {
        _confirm(txId);
    }

    function _confirm(uint256 txId) internal {
        if (txId >= transactions.length) revert TxNotExist();
        if (transactions[txId].executed) revert AlreadyExecuted();
        if (confirmed[txId][msg.sender]) revert AlreadyConfirmed();
        confirmed[txId][msg.sender] = true;
        transactions[txId].confirmations += 1;
        emit Confirmed(txId, msg.sender);
    }

    function revoke(uint256 txId) external onlyOwner {
        if (!confirmed[txId][msg.sender]) revert NotConfirmed();
        confirmed[txId][msg.sender] = false;
        transactions[txId].confirmations -= 1;
        emit Revoked(txId, msg.sender);
    }

    function execute(uint256 txId) external onlyOwner nonReentrant {
        Transaction storage t = transactions[txId];
        if (t.executed) revert AlreadyExecuted();
        if (t.confirmations < required) revert NotEnoughConfirmations();
        t.executed = true;
        (bool ok, ) = t.to.call{value: t.value}(t.data);
        if (!ok) revert ExecFailed();
        emit Executed(txId);
    }

    function transactionCount() external view returns (uint256) {
        return transactions.length;
    }

    function getOwners() external view returns (address[] memory) {
        return owners;
    }
}
