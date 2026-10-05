// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title RevenueRouter
 * @author Digital Plug Co. — Digital Black Wall Street
 * @notice Central fee sink for the DBWS Registry Suite. Every registry
 *         transfers its USDC registration fees here directly (ERC-20
 *         transferFrom, no native forwarding). The owner (treasury
 *         multisig / timelock) withdraws to configured destinations.
 *         Keeping this separate means fee policy can change without
 *         redeploying the registries.
 *
 * Sine Macula.
 */
contract RevenueRouter is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public paymentToken;              // USDC now, $PLUG later
    address public treasury;

    event Withdrawn(address indexed to, uint256 amount);
    event TreasurySet(address indexed treasury);
    event PaymentTokenSet(address indexed token);

    constructor(address _treasury, address _usdc, address admin) Ownable(admin) {
        treasury = _treasury;
        paymentToken = IERC20(_usdc);
    }

    function balance() external view returns (uint256) {
        return paymentToken.balanceOf(address(this));
    }

    function withdraw(uint256 amount) external onlyOwner nonReentrant {
        paymentToken.safeTransfer(treasury, amount);
        emit Withdrawn(treasury, amount);
    }

    function withdrawAll() external onlyOwner nonReentrant {
        uint256 amount = paymentToken.balanceOf(address(this));
        paymentToken.safeTransfer(treasury, amount);
        emit Withdrawn(treasury, amount);
    }

    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "ZERO");
        treasury = _treasury;
        emit TreasurySet(_treasury);
    }

    function setPaymentToken(address t) external onlyOwner {
        paymentToken = IERC20(t);
        emit PaymentTokenSet(t);
    }
}
