// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title PredictionMarket
 * @author Digital Plug Co. — Digital Black Wall Street
 * @notice Binary (YES/NO) parimutuel prediction markets. Stakes accepted in
 *         both $GPLUG and $PLUG; a single pooled payout is computed per token
 *         so the two currencies never cross-subsidize. Resolution comes from
 *         PredictionOracle (ORACLE_ROLE).
 *
 * WAVE 2 — HOLD FOR LEGAL REVIEW. Event contracts with pooled stakes and
 * cash-value payouts are within CFTC/state-gambling jurisdiction (see
 * Kalshi/Polymarket enforcement history). Do not deploy or market until
 * cleared.
 */
contract PredictionMarket is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");

    enum Outcome { UNRESOLVED, YES, NO, INVALID }

    struct Market {
        string question;
        uint64 closeTime;
        Outcome outcome;
        // per token: [PLUG, GPLUG]
        uint256[2] yesPool;
        uint256[2] noPool;
        bool resolved;
    }

    IERC20 public immutable gplug;
    IERC20 public immutable plug;
    address public treasury;
    uint256 public feeBps = 200; // 2% of losing pool

    uint256 public nextMarketId = 1;
    mapping(uint256 => Market) public markets;
    // marketId => user => token(0/1) => yes/no stake
    mapping(uint256 => mapping(address => uint256[2])) public yesStake;
    mapping(uint256 => mapping(address => uint256[2])) public noStake;
    mapping(uint256 => mapping(address => bool)) public claimed;

    event MarketCreated(uint256 indexed id, string question, uint64 closeTime);
    event Staked(uint256 indexed id, address indexed user, bool yes, uint8 token, uint256 amount);
    event Resolved(uint256 indexed id, Outcome outcome);
    event Claimed(uint256 indexed id, address indexed user, uint256 plugOut, uint256 gplugOut);

    error MarketClosed();
    error MarketNotClosed();
    error AlreadyResolved();
    error NotResolved();
    error AlreadyClaimed();
    error InvalidToken();

    constructor(address gplugAddress, address plugAddress, address treasuryAddress, address admin) {
        gplug = IERC20(gplugAddress);
        plug = IERC20(plugAddress);
        treasury = treasuryAddress;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ORACLE_ROLE, admin);
    }

    function _token(uint8 t) internal view returns (IERC20) {
        if (t == 0) return plug;
        if (t == 1) return gplug;
        revert InvalidToken();
    }

    function createMarket(string calldata question, uint64 closeTime)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
        returns (uint256 id)
    {
        id = nextMarketId++;
        Market storage m = markets[id];
        m.question = question;
        m.closeTime = closeTime;
        emit MarketCreated(id, question, closeTime);
    }

    function stake(uint256 id, bool yes, uint8 token, uint256 amount) external nonReentrant {
        Market storage m = markets[id];
        if (block.timestamp >= m.closeTime) revert MarketClosed();
        _token(token).safeTransferFrom(msg.sender, address(this), amount);
        if (yes) {
            m.yesPool[token] += amount;
            yesStake[id][msg.sender][token] += amount;
        } else {
            m.noPool[token] += amount;
            noStake[id][msg.sender][token] += amount;
        }
        emit Staked(id, msg.sender, yes, token, amount);
    }

    function resolve(uint256 id, Outcome outcome) external onlyRole(ORACLE_ROLE) {
        Market storage m = markets[id];
        if (block.timestamp < m.closeTime) revert MarketNotClosed();
        if (m.resolved) revert AlreadyResolved();
        m.outcome = outcome;
        m.resolved = true;
        emit Resolved(id, outcome);
    }

    function claim(uint256 id) external nonReentrant {
        Market storage m = markets[id];
        if (!m.resolved) revert NotResolved();
        if (claimed[id][msg.sender]) revert AlreadyClaimed();
        claimed[id][msg.sender] = true;

        uint256[2] memory out;
        for (uint8 t = 0; t < 2; t++) {
            uint256 userYes = yesStake[id][msg.sender][t];
            uint256 userNo = noStake[id][msg.sender][t];

            if (m.outcome == Outcome.INVALID) {
                out[t] = userYes + userNo; // full refund
            } else {
                bool userWon = (m.outcome == Outcome.YES && userYes > 0)
                            || (m.outcome == Outcome.NO && userNo > 0);
                if (!userWon) continue;

                uint256 winPool = m.outcome == Outcome.YES ? m.yesPool[t] : m.noPool[t];
                uint256 losePool = m.outcome == Outcome.YES ? m.noPool[t] : m.yesPool[t];
                uint256 userWin = m.outcome == Outcome.YES ? userYes : userNo;

                uint256 fee = (losePool * feeBps) / 10_000;
                uint256 distributable = losePool - fee;
                // principal back + pro-rata share of the losing pool
                out[t] = userWin + (winPool == 0 ? 0 : (distributable * userWin) / winPool);
            }
        }

        if (out[0] > 0) plug.safeTransfer(msg.sender, out[0]);
        if (out[1] > 0) gplug.safeTransfer(msg.sender, out[1]);
        emit Claimed(id, msg.sender, out[0], out[1]);
    }

    /// @notice Sweep protocol fees to treasury after resolution.
    function sweepFees(uint256 id) external onlyRole(DEFAULT_ADMIN_ROLE) {
        Market storage m = markets[id];
        require(m.resolved && m.outcome != Outcome.INVALID, "N/A");
        for (uint8 t = 0; t < 2; t++) {
            uint256 losePool = m.outcome == Outcome.YES ? m.noPool[t] : m.yesPool[t];
            uint256 fee = (losePool * feeBps) / 10_000;
            if (fee > 0) _token(t).safeTransfer(treasury, fee);
        }
    }
}

/**
 * @title PredictionOracle
 * @notice Thin resolution layer holding ORACLE_ROLE on PredictionMarket.
 *         Reporters submit outcomes; a challenge window lets admin override
 *         before finalization.
 */
interface IPredictionMarket {
    function resolve(uint256 id, PredictionMarket.Outcome outcome) external;
}

contract PredictionOracle is AccessControl {
    bytes32 public constant REPORTER_ROLE = keccak256("REPORTER_ROLE");

    IPredictionMarket public immutable market;

    constructor(address marketAddress, address admin) {
        market = IPredictionMarket(marketAddress);
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(REPORTER_ROLE, admin);
    }

    function report(uint256 id, PredictionMarket.Outcome outcome)
        external
        onlyRole(REPORTER_ROLE)
    {
        market.resolve(id, outcome);
    }
}
