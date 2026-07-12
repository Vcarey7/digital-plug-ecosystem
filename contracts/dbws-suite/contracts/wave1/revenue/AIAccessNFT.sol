// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title AIAccessNFT
 * @author Digital Plug Co. — Digital Black Wall Street
 * @notice Subscription access pass to the DBWS AI agent workforce and GPT
 *         knowledge bases. Each NFT carries a tier + expiry; renewal extends
 *         it. Payment in USDC or $PLUG (discounted). Affiliate sales reported
 *         to AffiliateTracker.
 *
 * Tiers        Monthly USDC
 *  BASIC        $29
 *  PRO          $99
 *  SOVEREIGN    $499
 */
interface IAffiliateReporter {
    function recordSale(address affiliate, address buyer, uint256 usdValue) external;
}

contract AIAccessNFT is ERC721, AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum Tier { BASIC, PRO, SOVEREIGN }

    struct Pass {
        Tier tier;
        uint64 expiresAt;
    }

    IERC20 public immutable usdc;
    IERC20 public immutable plug;
    address public treasury;
    IAffiliateReporter public affiliateTracker;

    mapping(Tier => uint256) public monthlyUSDC;   // 6d
    mapping(Tier => uint256) public monthlyPLUG;   // 18d (discounted)
    mapping(uint256 => Pass) public passes;

    uint256 public nextTokenId = 1;
    uint64 public constant MONTH = 30 days;

    event PassMinted(uint256 indexed tokenId, address indexed owner, Tier tier, uint64 expiresAt);
    event PassRenewed(uint256 indexed tokenId, uint64 newExpiry);
    event PriceSet(Tier tier, uint256 usdc, uint256 plug);

    error BadMonths();
    error NotPassOwner();

    constructor(
        address usdcAddress,
        address plugAddress,
        address treasuryAddress,
        address affiliateAddress,
        address admin
    ) ERC721("DBWS AI Access", "DBWSAI") {
        usdc = IERC20(usdcAddress);
        plug = IERC20(plugAddress);
        treasury = treasuryAddress;
        affiliateTracker = IAffiliateReporter(affiliateAddress);
        _grantRole(DEFAULT_ADMIN_ROLE, admin);

        monthlyUSDC[Tier.BASIC] = 29e6;
        monthlyUSDC[Tier.PRO] = 99e6;
        monthlyUSDC[Tier.SOVEREIGN] = 499e6;

        monthlyPLUG[Tier.BASIC] = 25e18;
        monthlyPLUG[Tier.PRO] = 85e18;
        monthlyPLUG[Tier.SOVEREIGN] = 425e18;
    }

    function subscribe(Tier tier, uint8 months, bool payInPlug, address affiliate)
        external
        nonReentrant
        returns (uint256 tokenId)
    {
        if (months == 0 || months > 24) revert BadMonths();
        _collect(tier, months, payInPlug);

        tokenId = nextTokenId++;
        uint64 expiry = uint64(block.timestamp) + uint64(months) * MONTH;
        passes[tokenId] = Pass(tier, expiry);
        _safeMint(msg.sender, tokenId);
        emit PassMinted(tokenId, msg.sender, tier, expiry);

        _reportAffiliate(tier, months, affiliate);
    }

    function renew(uint256 tokenId, uint8 months, bool payInPlug)
        external
        nonReentrant
    {
        if (ownerOf(tokenId) != msg.sender) revert NotPassOwner();
        if (months == 0 || months > 24) revert BadMonths();
        Pass storage p = passes[tokenId];
        _collect(p.tier, months, payInPlug);
        uint64 base = p.expiresAt > block.timestamp ? p.expiresAt : uint64(block.timestamp);
        p.expiresAt = base + uint64(months) * MONTH;
        emit PassRenewed(tokenId, p.expiresAt);
    }

    function isActive(uint256 tokenId) external view returns (bool) {
        return block.timestamp <= passes[tokenId].expiresAt;
    }

    function _collect(Tier tier, uint8 months, bool payInPlug) internal {
        if (payInPlug) {
            plug.safeTransferFrom(msg.sender, treasury, monthlyPLUG[tier] * months);
        } else {
            usdc.safeTransferFrom(msg.sender, treasury, monthlyUSDC[tier] * months);
        }
    }

    function _reportAffiliate(Tier tier, uint8 months, address affiliate) internal {
        if (affiliate != address(0) && address(affiliateTracker) != address(0)) {
            affiliateTracker.recordSale(affiliate, msg.sender, monthlyUSDC[tier] * months);
        }
    }

    function setPrice(Tier tier, uint256 usdcPrice, uint256 plugPrice)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        monthlyUSDC[tier] = usdcPrice;
        monthlyPLUG[tier] = plugPrice;
        emit PriceSet(tier, usdcPrice, plugPrice);
    }

    function setTreasury(address t) external onlyRole(DEFAULT_ADMIN_ROLE) {
        treasury = t;
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
