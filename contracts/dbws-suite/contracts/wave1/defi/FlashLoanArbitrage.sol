// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title FlashLoanArbitrage
 * @author Digital Plug Co. — Digital Black Wall Street
 * @notice Aave V3 flash-loan arbitrage executor. The off-chain brain
 *         computes a profitable route across two DEX routers and calls
 *         executeArbitrage(); this contract borrows via flash loan, runs
 *         the two swaps, repays the loan + premium, and keeps the profit.
 *         Reverts (and thus costs only gas) if the trade isn't profitable.
 *
 * NOTE: interfaces are minimal on purpose so this compiles standalone.
 *       Wire POOL to the Aave V3 Pool on Polygon at deploy time.
 */
interface IPoolV3 {
    function flashLoanSimple(
        address receiverAddress,
        address asset,
        uint256 amount,
        bytes calldata params,
        uint16 referralCode
    ) external;
}

interface ISwapRouterLike {
    // Uniswap V2-style for portability across QuickSwap/SushiSwap on Polygon.
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);
}

contract FlashLoanArbitrage is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IPoolV3 public immutable POOL;

    struct ArbParams {
        address routerA;
        address routerB;
        address[] pathA;   // borrowAsset -> mid
        address[] pathB;   // mid -> borrowAsset
        uint256 minProfit; // in borrow asset units
    }

    event ArbitrageExecuted(address indexed asset, uint256 borrowed, uint256 profit);
    event ProfitWithdrawn(address indexed token, address indexed to, uint256 amount);

    error NotPool();
    error NotProfitable();

    constructor(address aavePool, address admin) Ownable(admin) {
        POOL = IPoolV3(aavePool);
    }

    /// @notice Owner (or the brain's authorized key) kicks off the arb.
    function executeArbitrage(
        address asset,
        uint256 amount,
        ArbParams calldata params
    ) external onlyOwner nonReentrant {
        bytes memory data = abi.encode(params);
        POOL.flashLoanSimple(address(this), asset, amount, data, 0);
    }

    /// @notice Aave V3 callback. Must repay amount + premium by the end.
    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address initiator,
        bytes calldata params
    ) external returns (bool) {
        if (msg.sender != address(POOL)) revert NotPool();
        require(initiator == address(this), "BAD_INITIATOR");

        ArbParams memory p = abi.decode(params, (ArbParams));

        // Swap 1: asset -> mid on router A
        IERC20(asset).forceApprove(p.routerA, amount);
        uint256[] memory outA = ISwapRouterLike(p.routerA).swapExactTokensForTokens(
            amount, 0, p.pathA, address(this), block.timestamp
        );
        uint256 midAmount = outA[outA.length - 1];

        // Swap 2: mid -> asset on router B
        address mid = p.pathA[p.pathA.length - 1];
        IERC20(mid).forceApprove(p.routerB, midAmount);
        uint256[] memory outB = ISwapRouterLike(p.routerB).swapExactTokensForTokens(
            midAmount, 0, p.pathB, address(this), block.timestamp
        );
        uint256 finalAmount = outB[outB.length - 1];

        uint256 owed = amount + premium;
        if (finalAmount <= owed || finalAmount - owed < p.minProfit) revert NotProfitable();

        // Repay the pool.
        IERC20(asset).forceApprove(address(POOL), owed);
        emit ArbitrageExecuted(asset, amount, finalAmount - owed);
        return true;
    }

    function withdraw(address token, address to) external onlyOwner {
        uint256 bal = IERC20(token).balanceOf(address(this));
        IERC20(token).safeTransfer(to, bal);
        emit ProfitWithdrawn(token, to, bal);
    }

    function rescueETH(address payable to) external onlyOwner {
        to.transfer(address(this).balance);
    }

    receive() external payable {}
}
