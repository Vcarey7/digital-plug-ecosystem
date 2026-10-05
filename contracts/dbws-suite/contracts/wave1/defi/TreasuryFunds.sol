// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title ForgeVault
 * @author Digital Plug Co. — Digital Black Wall Street
 * @notice Escrow + treasury for forge fees. Holds PLUG/USDC accumulated
 *         from ForgeCore and other products; funds are only movable by
 *         SPENDER_ROLE (multisig/timelock) to approved destinations.
 */
contract ForgeVault is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant SPENDER_ROLE = keccak256("SPENDER_ROLE");

    event Spent(address indexed token, address indexed to, uint256 amount);

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(SPENDER_ROLE, admin);
    }

    function spend(address token, address to, uint256 amount)
        external
        onlyRole(SPENDER_ROLE)
        nonReentrant
    {
        IERC20(token).safeTransfer(to, amount);
        emit Spent(token, to, amount);
    }

    function balanceOf(address token) external view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }
}

/**
 * @title InsuranceFund
 * @notice Smart-contract exploit coverage. Claims require 2-of-3 multisig
 *         approval and cannot drop the fund below its minimum balance.
 */
contract InsuranceFund is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant APPROVER_ROLE = keccak256("APPROVER_ROLE");

    IERC20 public immutable settlementToken; // USDC
    uint256 public minimumBalance;
    uint256 public constant APPROVALS_REQUIRED = 2;

    struct Claim {
        address to;
        uint256 amount;
        string reason;
        uint8 approvals;
        bool paid;
        mapping(address => bool) approved;
    }

    uint256 public nextClaimId = 1;
    mapping(uint256 => Claim) private claims;

    event ClaimFiled(uint256 indexed claimId, address to, uint256 amount, string reason);
    event ClaimApproved(uint256 indexed claimId, address approver, uint8 approvals);
    event ClaimPaid(uint256 indexed claimId, address to, uint256 amount);
    event MinimumBalanceSet(uint256 minimum);

    error AlreadyApproved();
    error AlreadyPaid();
    error NotEnoughApprovals();
    error BelowMinimum();

    constructor(address settlement, uint256 _minimumBalance, address admin) {
        settlementToken = IERC20(settlement);
        minimumBalance = _minimumBalance;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(APPROVER_ROLE, admin);
    }

    function fileClaim(address to, uint256 amount, string calldata reason)
        external
        onlyRole(APPROVER_ROLE)
        returns (uint256 claimId)
    {
        claimId = nextClaimId++;
        Claim storage c = claims[claimId];
        c.to = to;
        c.amount = amount;
        c.reason = reason;
        emit ClaimFiled(claimId, to, amount, reason);
    }

    function approveClaim(uint256 claimId) external onlyRole(APPROVER_ROLE) {
        Claim storage c = claims[claimId];
        if (c.paid) revert AlreadyPaid();
        if (c.approved[msg.sender]) revert AlreadyApproved();
        c.approved[msg.sender] = true;
        c.approvals += 1;
        emit ClaimApproved(claimId, msg.sender, c.approvals);
    }

    function payClaim(uint256 claimId) external nonReentrant onlyRole(APPROVER_ROLE) {
        Claim storage c = claims[claimId];
        if (c.paid) revert AlreadyPaid();
        if (c.approvals < APPROVALS_REQUIRED) revert NotEnoughApprovals();
        uint256 bal = settlementToken.balanceOf(address(this));
        if (bal < c.amount || bal - c.amount < minimumBalance) revert BelowMinimum();
        c.paid = true;
        settlementToken.safeTransfer(c.to, c.amount);
        emit ClaimPaid(claimId, c.to, c.amount);
    }

    function setMinimumBalance(uint256 minimum) external onlyRole(DEFAULT_ADMIN_ROLE) {
        minimumBalance = minimum;
        emit MinimumBalanceSet(minimum);
    }

    function claimInfo(uint256 claimId)
        external
        view
        returns (address to, uint256 amount, string memory reason, uint8 approvals, bool paid)
    {
        Claim storage c = claims[claimId];
        return (c.to, c.amount, c.reason, c.approvals, c.paid);
    }
}
