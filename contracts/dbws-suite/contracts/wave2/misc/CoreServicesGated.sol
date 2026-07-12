// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title PlugStaking
 * @author Digital Plug Co. — Digital Black Wall Street
 * @notice Stake $PLUG, earn $PLUG from a funded reward reserve using the
 *         classic accRewardPerShare accounting. No lockups; rewards accrue
 *         per second while staked.
 *
 * WAVE 2 — HOLD FOR LEGAL REVIEW. Staking-as-a-service where the protocol
 * sets the reward rate mirrors the fact pattern in SEC v. Kraken (2023).
 * Clear with counsel before mainnet.
 */
contract PlugStaking is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant FUNDER_ROLE = keccak256("FUNDER_ROLE");

    IERC20 public immutable plug;
    uint256 public rewardPerSecond;
    uint256 public accRewardPerShare; // scaled 1e12
    uint256 public lastUpdate;
    uint256 public totalStaked;
    uint256 public rewardReserve;

    uint256 constant ACC = 1e12;

    struct UserInfo {
        uint256 amount;
        uint256 rewardDebt;
    }
    mapping(address => UserInfo) public users;

    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount);
    event Harvested(address indexed user, uint256 reward);
    event RewardRateSet(uint256 rewardPerSecond);
    event ReserveFunded(uint256 amount);

    error InsufficientStake();

    constructor(address plugAddress, address admin) {
        plug = IERC20(plugAddress);
        lastUpdate = block.timestamp;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(FUNDER_ROLE, admin);
    }

    function _update() internal {
        if (block.timestamp <= lastUpdate) return;
        if (totalStaked > 0) {
            uint256 elapsed = block.timestamp - lastUpdate;
            uint256 reward = elapsed * rewardPerSecond;
            if (reward > rewardReserve) reward = rewardReserve;
            rewardReserve -= reward;
            accRewardPerShare += (reward * ACC) / totalStaked;
        }
        lastUpdate = block.timestamp;
    }

    function pending(address user) external view returns (uint256) {
        UserInfo storage u = users[user];
        uint256 acc = accRewardPerShare;
        if (block.timestamp > lastUpdate && totalStaked > 0) {
            uint256 reward = (block.timestamp - lastUpdate) * rewardPerSecond;
            if (reward > rewardReserve) reward = rewardReserve;
            acc += (reward * ACC) / totalStaked;
        }
        return (u.amount * acc) / ACC - u.rewardDebt;
    }

    function stake(uint256 amount) external nonReentrant {
        _update();
        UserInfo storage u = users[msg.sender];
        _harvest(u);
        plug.safeTransferFrom(msg.sender, address(this), amount);
        u.amount += amount;
        totalStaked += amount;
        u.rewardDebt = (u.amount * accRewardPerShare) / ACC;
        emit Staked(msg.sender, amount);
    }

    function unstake(uint256 amount) external nonReentrant {
        UserInfo storage u = users[msg.sender];
        if (amount > u.amount) revert InsufficientStake();
        _update();
        _harvest(u);
        u.amount -= amount;
        totalStaked -= amount;
        u.rewardDebt = (u.amount * accRewardPerShare) / ACC;
        plug.safeTransfer(msg.sender, amount);
        emit Unstaked(msg.sender, amount);
    }

    function harvest() external nonReentrant {
        _update();
        _harvest(users[msg.sender]);
        users[msg.sender].rewardDebt = (users[msg.sender].amount * accRewardPerShare) / ACC;
    }

    function _harvest(UserInfo storage u) internal {
        if (u.amount == 0) return;
        uint256 rewardOwed = (u.amount * accRewardPerShare) / ACC - u.rewardDebt;
        if (rewardOwed > 0) {
            plug.safeTransfer(msg.sender, rewardOwed);
            emit Harvested(msg.sender, rewardOwed);
        }
    }

    function fundReserve(uint256 amount) external onlyRole(FUNDER_ROLE) {
        plug.safeTransferFrom(msg.sender, address(this), amount);
        rewardReserve += amount;
        emit ReserveFunded(amount);
    }

    function setRewardRate(uint256 _rewardPerSecond) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _update();
        rewardPerSecond = _rewardPerSecond;
        emit RewardRateSet(_rewardPerSecond);
    }
}

/**
 * @title InvoiceToken
 * @notice Tokenized invoices for factoring. A business mints an invoice NFT-
 *         like record (ERC-20 shares of a single invoice) that investors buy;
 *         on payment, holders redeem principal + yield.
 *
 * WAVE 2 — HOLD FOR LEGAL REVIEW. Investors fund a pool expecting a return
 * (face value minus discount) derived from the business's efforts to pay —
 * a textbook Howey investment contract.
 */
contract InvoiceToken is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");

    struct Invoice {
        address business;
        uint256 faceValue;   // USDC owed
        uint256 salePrice;   // discounted price investors pay total
        uint256 funded;      // USDC raised
        uint64 dueDate;
        bool settled;
        mapping(address => uint256) contribution;
    }

    IERC20 public immutable usdc;
    uint256 public nextInvoiceId = 1;
    mapping(uint256 => Invoice) private invoices;

    event InvoiceListed(uint256 indexed id, address business, uint256 faceValue, uint256 salePrice, uint64 dueDate);
    event Invested(uint256 indexed id, address investor, uint256 amount);
    event InvoiceSettled(uint256 indexed id, uint256 faceValue);
    event Redeemed(uint256 indexed id, address investor, uint256 payout);

    error Overfunded();
    error NotFullyFunded();
    error AlreadySettled();
    error NotSettled();
    error NothingToRedeem();

    constructor(address usdcAddress, address admin) {
        usdc = IERC20(usdcAddress);
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ISSUER_ROLE, admin);
    }

    function listInvoice(uint256 faceValue, uint256 salePrice, uint64 dueDate)
        external
        onlyRole(ISSUER_ROLE)
        returns (uint256 id)
    {
        id = nextInvoiceId++;
        Invoice storage inv = invoices[id];
        inv.business = msg.sender;
        inv.faceValue = faceValue;
        inv.salePrice = salePrice;
        inv.dueDate = dueDate;
        emit InvoiceListed(id, msg.sender, faceValue, salePrice, dueDate);
    }

    function invest(uint256 id, uint256 amount) external nonReentrant {
        Invoice storage inv = invoices[id];
        if (inv.funded + amount > inv.salePrice) revert Overfunded();
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        inv.funded += amount;
        inv.contribution[msg.sender] += amount;
        emit Invested(id, msg.sender, amount);
        // Once fully funded, advance the discounted proceeds to the business.
        if (inv.funded == inv.salePrice) {
            usdc.safeTransfer(inv.business, inv.salePrice);
        }
    }

    /// @notice Business (or its payer) settles the invoice at face value.
    function settle(uint256 id) external nonReentrant {
        Invoice storage inv = invoices[id];
        if (inv.funded < inv.salePrice) revert NotFullyFunded();
        if (inv.settled) revert AlreadySettled();
        usdc.safeTransferFrom(msg.sender, address(this), inv.faceValue);
        inv.settled = true;
        emit InvoiceSettled(id, inv.faceValue);
    }

    /// @notice Investors redeem pro-rata share of face value (principal+yield).
    function redeem(uint256 id) external nonReentrant {
        Invoice storage inv = invoices[id];
        if (!inv.settled) revert NotSettled();
        uint256 contrib = inv.contribution[msg.sender];
        if (contrib == 0) revert NothingToRedeem();
        inv.contribution[msg.sender] = 0;
        uint256 payout = (inv.faceValue * contrib) / inv.salePrice;
        usdc.safeTransfer(msg.sender, payout);
        emit Redeemed(id, msg.sender, payout);
    }

    function contributionOf(uint256 id, address investor) external view returns (uint256) {
        return invoices[id].contribution[investor];
    }
}

/**
 * @title TournamentPrizePool
 * @notice Escrows entry fees for NerdTV arcade tournaments and pays out a
 *         configurable prize split to winners named by an operator.
 *
 * WAVE 2 — HOLD FOR LEGAL REVIEW. Pooled entry fees paid out as prizes is a
 * skill-gaming pattern; legality turns on state-by-state skill-vs-chance
 * gambling law, a different lane from securities review. Confirm per state
 * before opening entries for value.
 */
contract TournamentPrizePool is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    struct Tournament {
        IERC20 token;
        uint256 entryFee;
        uint256 pot;
        uint64 closeTime;
        bool settled;
        uint16[] prizeBps;   // e.g. [5000,3000,2000]
        uint16 rakeBps;
        mapping(address => bool) entered;
    }

    address public treasury;
    uint256 public nextTournamentId = 1;
    mapping(uint256 => Tournament) private tournaments;

    event TournamentCreated(uint256 indexed id, address token, uint256 entryFee, uint64 closeTime);
    event Entered(uint256 indexed id, address player);
    event Settled(uint256 indexed id, address[] winners, uint256 pot);

    error EntriesClosed();
    error AlreadyEntered();
    error AlreadySettled();
    error BadWinners();

    constructor(address treasuryAddress, address admin) {
        treasury = treasuryAddress;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(OPERATOR_ROLE, admin);
    }

    function createTournament(
        address token,
        uint256 entryFee,
        uint64 closeTime,
        uint16[] calldata prizeBps,
        uint16 rakeBps
    ) external onlyRole(OPERATOR_ROLE) returns (uint256 id) {
        uint256 sum = rakeBps;
        for (uint256 i = 0; i < prizeBps.length; i++) sum += prizeBps[i];
        require(sum == 10_000, "SPLIT");
        id = nextTournamentId++;
        Tournament storage t = tournaments[id];
        t.token = IERC20(token);
        t.entryFee = entryFee;
        t.closeTime = closeTime;
        t.prizeBps = prizeBps;
        t.rakeBps = rakeBps;
        emit TournamentCreated(id, token, entryFee, closeTime);
    }

    function enter(uint256 id) external nonReentrant {
        Tournament storage t = tournaments[id];
        if (block.timestamp >= t.closeTime) revert EntriesClosed();
        if (t.entered[msg.sender]) revert AlreadyEntered();
        t.token.safeTransferFrom(msg.sender, address(this), t.entryFee);
        t.entered[msg.sender] = true;
        t.pot += t.entryFee;
        emit Entered(id, msg.sender);
    }

    function settle(uint256 id, address[] calldata winners)
        external
        onlyRole(OPERATOR_ROLE)
        nonReentrant
    {
        Tournament storage t = tournaments[id];
        if (t.settled) revert AlreadySettled();
        if (winners.length != t.prizeBps.length) revert BadWinners();
        t.settled = true;

        uint256 rake = (t.pot * t.rakeBps) / 10_000;
        if (rake > 0) t.token.safeTransfer(treasury, rake);
        for (uint256 i = 0; i < winners.length; i++) {
            uint256 prize = (t.pot * t.prizeBps[i]) / 10_000;
            if (prize > 0) t.token.safeTransfer(winners[i], prize);
        }
        emit Settled(id, winners, t.pot);
    }
}
