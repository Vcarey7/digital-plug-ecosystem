// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title NerdTVContentRegistry
 * @author Digital Plug Co. — Digital Black Wall Street
 * @notice On-chain catalog for NerdTV. Each content item records its creator,
 *         network (one of 13), content hash, and royalty splits. Consumed by
 *         royalty distribution and watch-to-earn.
 */
contract NerdTVContentRegistry is AccessControl {
    bytes32 public constant PUBLISHER_ROLE = keccak256("PUBLISHER_ROLE");

    struct Content {
        address creator;
        uint8 network;        // 0–12
        bytes32 contentHash;  // IPFS/Arweave
        uint16 creatorBps;    // creator share of royalties
        uint16 platformBps;   // platform share
        bool active;
        uint64 publishedAt;
    }

    uint256 public nextContentId = 1;
    mapping(uint256 => Content) public contents;

    event ContentPublished(uint256 indexed id, address indexed creator, uint8 network, bytes32 contentHash);
    event ContentDeactivated(uint256 indexed id);

    error BadSplit();

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PUBLISHER_ROLE, admin);
    }

    function publish(
        address creator,
        uint8 network,
        bytes32 contentHash,
        uint16 creatorBps,
        uint16 platformBps
    ) external onlyRole(PUBLISHER_ROLE) returns (uint256 id) {
        if (uint256(creatorBps) + platformBps > 10_000) revert BadSplit();
        id = nextContentId++;
        contents[id] = Content(creator, network, contentHash, creatorBps, platformBps, true, uint64(block.timestamp));
        emit ContentPublished(id, creator, network, contentHash);
    }

    function deactivate(uint256 id) external onlyRole(PUBLISHER_ROLE) {
        contents[id].active = false;
        emit ContentDeactivated(id);
    }

    function isActive(uint256 id) external view returns (bool) {
        return contents[id].active;
    }
}

/**
 * @title NerdTVRoyalty
 * @notice Receives revenue per content id and splits it between creator,
 *         platform treasury, and a community pool per the registry's config.
 */
interface INerdContentRegistry {
    function contents(uint256 id)
        external
        view
        returns (address creator, uint8 network, bytes32 contentHash, uint16 creatorBps, uint16 platformBps, bool active, uint64 publishedAt);
}

contract NerdTVRoyalty is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable payToken; // USDC or PLUG
    INerdContentRegistry public immutable registry;
    address public treasury;
    address public communityPool;

    mapping(address => uint256) public creatorEarnings;

    event RoyaltyReceived(uint256 indexed contentId, uint256 amount, uint256 toCreator, uint256 toPlatform, uint256 toCommunity);
    event CreatorWithdrawal(address indexed creator, uint256 amount);

    error ContentInactive();

    constructor(
        address payTokenAddress,
        address registryAddress,
        address treasuryAddress,
        address communityPoolAddress,
        address admin
    ) {
        payToken = IERC20(payTokenAddress);
        registry = INerdContentRegistry(registryAddress);
        treasury = treasuryAddress;
        communityPool = communityPoolAddress;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    function receiveRoyalty(uint256 contentId, uint256 amount) external nonReentrant {
        (address creator,,, uint16 creatorBps, uint16 platformBps, bool active,) = registry.contents(contentId);
        if (!active) revert ContentInactive();

        payToken.safeTransferFrom(msg.sender, address(this), amount);
        uint256 toCreator = (amount * creatorBps) / 10_000;
        uint256 toPlatform = (amount * platformBps) / 10_000;
        uint256 toCommunity = amount - toCreator - toPlatform;

        creatorEarnings[creator] += toCreator;
        if (toPlatform > 0) payToken.safeTransfer(treasury, toPlatform);
        if (toCommunity > 0) payToken.safeTransfer(communityPool, toCommunity);
        emit RoyaltyReceived(contentId, amount, toCreator, toPlatform, toCommunity);
    }

    function withdraw() external nonReentrant {
        uint256 amount = creatorEarnings[msg.sender];
        creatorEarnings[msg.sender] = 0;
        payToken.safeTransfer(msg.sender, amount);
        emit CreatorWithdrawal(msg.sender, amount);
    }

    function setTreasury(address t) external onlyRole(DEFAULT_ADMIN_ROLE) { treasury = t; }
    function setCommunityPool(address p) external onlyRole(DEFAULT_ADMIN_ROLE) { communityPool = p; }
}

/**
 * @title WatchToEarn
 * @notice Rewards viewers in $PLUG for verified watch time. A trusted
 *         attestor (backend keeper) signs off on watch sessions; rewards are
 *         rate-limited per user per day to deter farming.
 */
contract WatchToEarn is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant ATTESTOR_ROLE = keccak256("ATTESTOR_ROLE");

    IERC20 public immutable plug;
    address public rewardsTreasury;

    uint256 public plugPerMinute = 1e17; // 0.1 PLUG/min
    uint256 public dailyCapMinutes = 240; // 4 hours

    // user => dayIndex => minutes credited
    mapping(address => mapping(uint256 => uint256)) public dailyMinutes;

    event Rewarded(address indexed viewer, uint256 minutesWatched, uint256 plugPaid);
    event RateSet(uint256 plugPerMinute, uint256 dailyCapMinutes);

    error DailyCapReached();

    constructor(address plugAddress, address treasury, address admin) {
        plug = IERC20(plugAddress);
        rewardsTreasury = treasury;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ATTESTOR_ROLE, admin);
    }

    function _dayIndex() internal view returns (uint256) {
        return block.timestamp / 1 days;
    }

    /// @notice Attestor credits a viewer for verified watch minutes.
    function rewardWatch(address viewer, uint256 minutesWatched)
        external
        onlyRole(ATTESTOR_ROLE)
        nonReentrant
    {
        uint256 day = _dayIndex();
        uint256 used = dailyMinutes[viewer][day];
        if (used >= dailyCapMinutes) revert DailyCapReached();
        uint256 allowed = dailyCapMinutes - used;
        uint256 credit = minutesWatched > allowed ? allowed : minutesWatched;
        dailyMinutes[viewer][day] = used + credit;

        uint256 reward = credit * plugPerMinute;
        plug.safeTransferFrom(rewardsTreasury, viewer, reward);
        emit Rewarded(viewer, credit, reward);
    }

    function setRate(uint256 _plugPerMinute, uint256 _dailyCapMinutes)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        plugPerMinute = _plugPerMinute;
        dailyCapMinutes = _dailyCapMinutes;
        emit RateSet(_plugPerMinute, _dailyCapMinutes);
    }

    function setTreasury(address t) external onlyRole(DEFAULT_ADMIN_ROLE) {
        rewardsTreasury = t;
    }
}
