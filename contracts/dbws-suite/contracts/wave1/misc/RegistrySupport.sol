// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

/**
 * @title PlugMarketplace
 * @author Digital Plug Co. — Digital Black Wall Street
 * @notice Fixed-price secondary marketplace for any ecosystem NFT (domains,
 *         TLDs, bonds). Sellers list; buyers pay in $PLUG; protocol takes a
 *         fee and reports subdomain/royalty sales upstream where applicable.
 */
contract PlugMarketplace is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Listing {
        address seller;
        address nft;
        uint256 tokenId;
        uint256 price;
        bool active;
    }

    IERC20 public immutable plug;
    address public treasury;
    uint256 public feeBps = 250; // 2.5%

    uint256 public nextListingId = 1;
    mapping(uint256 => Listing) public listings;

    event Listed(uint256 indexed id, address indexed seller, address nft, uint256 tokenId, uint256 price);
    event Sale(uint256 indexed id, address indexed buyer, uint256 price);
    event Delisted(uint256 indexed id);

    error NotSeller();
    error Inactive();

    constructor(address plugAddress, address treasuryAddress, address admin) {
        plug = IERC20(plugAddress);
        treasury = treasuryAddress;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    function list(address nft, uint256 tokenId, uint256 price)
        external
        nonReentrant
        returns (uint256 id)
    {
        IERC721(nft).transferFrom(msg.sender, address(this), tokenId);
        id = nextListingId++;
        listings[id] = Listing(msg.sender, nft, tokenId, price, true);
        emit Listed(id, msg.sender, nft, tokenId, price);
    }

    function buy(uint256 id) external nonReentrant {
        Listing storage l = listings[id];
        if (!l.active) revert Inactive();
        l.active = false;
        uint256 fee = (l.price * feeBps) / 10_000;
        plug.safeTransferFrom(msg.sender, treasury, fee);
        plug.safeTransferFrom(msg.sender, l.seller, l.price - fee);
        IERC721(l.nft).transferFrom(address(this), msg.sender, l.tokenId);
        emit Sale(id, msg.sender, l.price);
    }

    function delist(uint256 id) external nonReentrant {
        Listing storage l = listings[id];
        if (l.seller != msg.sender) revert NotSeller();
        if (!l.active) revert Inactive();
        l.active = false;
        IERC721(l.nft).transferFrom(address(this), l.seller, l.tokenId);
        emit Delisted(id);
    }

    function setFee(uint256 bps) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(bps <= 1_000, "MAX 10%");
        feeBps = bps;
    }

    function setTreasury(address t) external onlyRole(DEFAULT_ADMIN_ROLE) {
        treasury = t;
    }
}

/**
 * @title MintingFactory
 * @notice Deploys/records generic mint campaigns (AI art, agent NFTs, bulk
 *         drops) with per-campaign price and supply. Mints are ERC-1155-style
 *         tallies here; actual media is off-chain (IPFS) referenced by hash.
 */
contract MintingFactory is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant CREATOR_ROLE = keccak256("CREATOR_ROLE");

    struct Campaign {
        address creator;
        IERC20 payToken;
        uint256 price;
        uint256 maxSupply;
        uint256 minted;
        bytes32 baseContentHash;
        bool active;
    }

    address public treasury;
    uint256 public platformBps = 500; // 5%
    uint256 public nextCampaignId = 1;
    mapping(uint256 => Campaign) public campaigns;
    // campaignId => minter => count
    mapping(uint256 => mapping(address => uint256)) public mintedBy;

    event CampaignCreated(uint256 indexed id, address creator, uint256 price, uint256 maxSupply);
    event Minted(uint256 indexed id, address indexed minter, uint256 quantity);
    event CampaignClosed(uint256 indexed id);

    error Inactive();
    error SoldOut();

    constructor(address treasuryAddress, address admin) {
        treasury = treasuryAddress;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(CREATOR_ROLE, admin);
    }

    function createCampaign(
        address payToken,
        uint256 price,
        uint256 maxSupply,
        bytes32 baseContentHash
    ) external onlyRole(CREATOR_ROLE) returns (uint256 id) {
        id = nextCampaignId++;
        campaigns[id] = Campaign(msg.sender, IERC20(payToken), price, maxSupply, 0, baseContentHash, true);
        emit CampaignCreated(id, msg.sender, price, maxSupply);
    }

    function mint(uint256 id, uint256 quantity) external nonReentrant {
        Campaign storage c = campaigns[id];
        if (!c.active) revert Inactive();
        if (c.minted + quantity > c.maxSupply) revert SoldOut();
        uint256 cost = c.price * quantity;
        uint256 fee = (cost * platformBps) / 10_000;
        c.payToken.safeTransferFrom(msg.sender, treasury, fee);
        c.payToken.safeTransferFrom(msg.sender, c.creator, cost - fee);
        c.minted += quantity;
        mintedBy[id][msg.sender] += quantity;
        emit Minted(id, msg.sender, quantity);
    }

    function closeCampaign(uint256 id) external {
        Campaign storage c = campaigns[id];
        require(c.creator == msg.sender || hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "AUTH");
        c.active = false;
        emit CampaignClosed(id);
    }
}

/**
 * @title PlugPayments
 * @notice Payment router: resolve a domain to a wallet and pay it in one call,
 *         with an optional protocol fee. Powers "pay to vance.plug" UX.
 */
interface IResolverPay {
    function resolve(string calldata name_, string calldata tld) external view returns (address);
}

contract PlugPayments is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IResolverPay public resolver;
    address public treasury;
    uint256 public feeBps = 50; // 0.5%

    event PaymentSent(address indexed from, address indexed to, address token, uint256 amount, string domain);
    event ResolverSet(address resolver);

    error Unresolved();

    constructor(address resolverAddress, address treasuryAddress, address admin) {
        resolver = IResolverPay(resolverAddress);
        treasury = treasuryAddress;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    function payDomain(
        string calldata name_,
        string calldata tld,
        address token,
        uint256 amount
    ) external nonReentrant {
        address to = resolver.resolve(name_, tld);
        if (to == address(0)) revert Unresolved();
        uint256 fee = (amount * feeBps) / 10_000;
        IERC20(token).safeTransferFrom(msg.sender, treasury, fee);
        IERC20(token).safeTransferFrom(msg.sender, to, amount - fee);
        emit PaymentSent(msg.sender, to, token, amount, string(abi.encodePacked(name_, ".", tld)));
    }

    function setResolver(address r) external onlyRole(DEFAULT_ADMIN_ROLE) {
        resolver = IResolverPay(r);
        emit ResolverSet(r);
    }

    function setFee(uint256 bps) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(bps <= 500, "MAX 5%");
        feeBps = bps;
    }

    function setTreasury(address t) external onlyRole(DEFAULT_ADMIN_ROLE) {
        treasury = t;
    }
}

/**
 * @title PlugFactory
 * @notice Deploys per-TLD subdomain registrars (lightweight records) and
 *         wires subdomain sales to route royalties to the TLD owner via
 *         UserTLDRegistry.
 */
interface ITLDRoyaltyReporter {
    function accrueRoyalty(uint256 tokenId, uint256 saleAmount) external;
    function tldToTokenId(bytes32 tldKey) external view returns (uint256);
}

contract PlugFactory is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable plug;
    ITLDRoyaltyReporter public tldRegistry;
    address public treasury;

    // keccak(name.tld) => owner
    mapping(bytes32 => address) public subdomainOwner;

    event SubdomainRegistered(string name, string tld, address indexed owner, uint256 price);
    event TLDRegistrySet(address registry);

    error SubdomainTaken();

    constructor(address plugAddress, address tldRegistryAddress, address treasuryAddress, address admin) {
        plug = IERC20(plugAddress);
        tldRegistry = ITLDRoyaltyReporter(tldRegistryAddress);
        treasury = treasuryAddress;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    function registerSubdomain(string calldata name_, string calldata tld, uint256 price)
        external
        nonReentrant
    {
        bytes32 key = keccak256(abi.encodePacked(name_, ".", tld));
        if (subdomainOwner[key] != address(0)) revert SubdomainTaken();

        // Pull payment to this contract, route royalty to TLD owner, rest to treasury.
        plug.safeTransferFrom(msg.sender, address(this), price);
        uint256 tldTokenId = tldRegistry.tldToTokenId(keccak256(abi.encodePacked(tld)));
        if (tldTokenId != 0) {
            plug.forceApprove(address(tldRegistry), price);
            tldRegistry.accrueRoyalty(tldTokenId, price);
        }
        uint256 remaining = plug.balanceOf(address(this));
        if (remaining > 0) plug.safeTransfer(treasury, remaining);

        subdomainOwner[key] = msg.sender;
        emit SubdomainRegistered(name_, tld, msg.sender, price);
    }

    function setTLDRegistry(address r) external onlyRole(DEFAULT_ADMIN_ROLE) {
        tldRegistry = ITLDRoyaltyReporter(r);
        emit TLDRegistrySet(r);
    }
}

/**
 * @title TLDRoyalty
 * @notice Standalone royalty accumulator (EIP-2981-style helper) usable by
 *         external marketplaces to look up and remit TLD royalties.
 */
contract TLDRoyalty is AccessControl {
    struct RoyaltyInfo {
        address receiver;
        uint96 royaltyBps;
    }

    mapping(uint256 => RoyaltyInfo) public royalties; // tldTokenId => info
    uint96 public defaultBps = 500;

    event RoyaltySet(uint256 indexed tldTokenId, address receiver, uint96 bps);

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    function setRoyalty(uint256 tldTokenId, address receiver, uint96 bps)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(bps <= 2_000, "MAX 20%");
        royalties[tldTokenId] = RoyaltyInfo(receiver, bps);
        emit RoyaltySet(tldTokenId, receiver, bps);
    }

    function royaltyInfo(uint256 tldTokenId, uint256 salePrice)
        external
        view
        returns (address receiver, uint256 amount)
    {
        RoyaltyInfo memory info = royalties[tldTokenId];
        uint96 bps = info.royaltyBps == 0 ? defaultBps : info.royaltyBps;
        return (info.receiver, (salePrice * bps) / 10_000);
    }
}

/**
 * @title FamilyCredit
 * @notice Family-scoped credit line backed by a FamilyBankingVault balance.
 *         The head opens a line; members draw up to a limit; repayments plus
 *         on-time behavior are reported to CommunityCredit.
 */
interface ICreditReporter {
    function recordActivity(address wallet, uint8 activityType, uint256 amount) external;
}

contract FamilyCredit is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    struct Line {
        address head;
        uint256 limit;
        uint256 drawn;
        bool active;
    }

    IERC20 public immutable usdc;
    ICreditReporter public creditReporter;
    uint256 public reserve;

    mapping(uint256 => Line) public lines;              // lineId => line
    mapping(uint256 => mapping(address => bool)) public members;
    uint256 public nextLineId = 1;

    event LineOpened(uint256 indexed id, address head, uint256 limit);
    event MemberAdded(uint256 indexed id, address member);
    event Drawn(uint256 indexed id, address member, uint256 amount);
    event Repaid(uint256 indexed id, address payer, uint256 amount);

    error NotHead();
    error NotMember();
    error OverLimit();
    error Inactive();

    constructor(address usdcAddress, address creditReporterAddress, address admin) {
        usdc = IERC20(usdcAddress);
        creditReporter = ICreditReporter(creditReporterAddress);
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MANAGER_ROLE, admin);
    }

    function fundReserve(uint256 amount) external {
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        reserve += amount;
    }

    function openLine(uint256 limit) external onlyRole(MANAGER_ROLE) returns (uint256 id) {
        id = nextLineId++;
        lines[id] = Line(msg.sender, limit, 0, true);
        members[id][msg.sender] = true;
        emit LineOpened(id, msg.sender, limit);
    }

    function addMember(uint256 id, address member) external {
        if (lines[id].head != msg.sender) revert NotHead();
        members[id][member] = true;
        emit MemberAdded(id, member);
    }

    function draw(uint256 id, uint256 amount) external nonReentrant {
        Line storage l = lines[id];
        if (!l.active) revert Inactive();
        if (!members[id][msg.sender]) revert NotMember();
        if (l.drawn + amount > l.limit) revert OverLimit();
        require(amount <= reserve, "RESERVE");
        l.drawn += amount;
        reserve -= amount;
        usdc.safeTransfer(msg.sender, amount);
        emit Drawn(id, msg.sender, amount);
    }

    function repay(uint256 id, uint256 amount) external nonReentrant {
        Line storage l = lines[id];
        uint256 pay = amount > l.drawn ? l.drawn : amount;
        usdc.safeTransferFrom(msg.sender, address(this), pay);
        l.drawn -= pay;
        reserve += pay;
        if (address(creditReporter) != address(0)) {
            creditReporter.recordActivity(msg.sender, 5, pay); // 5 = repayment
        }
        emit Repaid(id, msg.sender, pay);
    }
}

/**
 * @title TokenBoundAccount
 * @notice Minimal ERC-6551-style account owned by an NFT (e.g. a domain).
 *         The current NFT owner controls the account and can execute calls.
 *         One deployed instance per bound token in production; this reference
 *         binds at construction.
 */
contract TokenBoundAccount is ReentrancyGuard {
    address public immutable tokenContract;
    uint256 public immutable tokenId;

    event Executed(address indexed to, uint256 value, bytes data);
    event Received(address indexed from, uint256 amount);

    error NotTokenOwner();
    error CallFailed();

    constructor(address _tokenContract, uint256 _tokenId) {
        tokenContract = _tokenContract;
        tokenId = _tokenId;
    }

    receive() external payable {
        emit Received(msg.sender, msg.value);
    }

    function owner() public view returns (address) {
        return IERC721(tokenContract).ownerOf(tokenId);
    }

    function execute(address to, uint256 value, bytes calldata data)
        external
        nonReentrant
        returns (bytes memory result)
    {
        if (msg.sender != owner()) revert NotTokenOwner();
        bool ok;
        (ok, result) = to.call{value: value}(data);
        if (!ok) revert CallFailed();
        emit Executed(to, value, data);
    }
}
