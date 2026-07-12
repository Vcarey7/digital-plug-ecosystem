// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title BlockBondNFT
 * @author Digital Plug Co. — Digital Black Wall Street
 * @notice Community bonds as ERC-721. Residents buy bonds (min $50 USDC) at
 *         12/24/36-month terms and receive yield distributed by the
 *         CommunityRevenuePool. Principal is DAO-backed; on-time yield events
 *         feed CommunityCredit. Early exit forfeits 90 days of yield.
 *
 * WAVE 2 — HOLD FOR LEGAL REVIEW. Investment of money into a common
 * enterprise with an expectation of profit (yield) derived from the
 * managers' efforts (CommunityRevenuePool) — a Howey investment contract
 * regardless of the ERC-721 wrapper. Do not deploy or market until a
 * securities attorney has cleared it.
 */
interface ICommunityCredit {
    function recordActivity(address wallet, uint8 activityType, uint256 amount) external;
}

contract BlockBondNFT is ERC721Enumerable, Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    uint256 public constant MIN_PRINCIPAL = 50e6;      // $50
    uint256 public constant TIER2_THRESHOLD = 500e6;   // $500
    uint256 public constant TIER3_THRESHOLD = 5_000e6; // $5,000
    uint256 public constant EARLY_EXIT_PENALTY_DAYS = 90;
    uint256 public constant BASIS_POINTS = 10_000;

    IERC20 public immutable usdc;
    ICommunityCredit public credit;
    address public revenuePool;

    uint256 public baseRateBps = 600; // 6% APY

    struct Bond {
        uint256 principal;
        uint64 mintedAt;
        uint64 maturity;
        uint16 termMonths;   // 12/24/36
        uint256 yieldClaimed;
        bool redeemed;
    }

    uint256 public nextTokenId = 1;
    mapping(uint256 => Bond) public bonds;

    event BondMinted(uint256 indexed tokenId, address indexed holder, uint256 principal, uint16 termMonths, uint64 maturity);
    event YieldDistributed(uint256 indexed tokenId, uint256 amount);
    event BondRedeemed(uint256 indexed tokenId, uint256 principal, uint256 penalty);
    event RevenuePoolSet(address pool);
    event CreditSet(address credit);

    error BelowMinimum();
    error BadTerm();
    error NotHolder();
    error AlreadyRedeemed();
    error NotAuthorizedPool();

    constructor(address usdcAddress, address admin)
        ERC721("Block Bond", "BLOCKBOND")
        Ownable(admin)
    {
        usdc = IERC20(usdcAddress);
    }

    // ─── Mint ─────────────────────────────────────────────────────────────────

    function mintBond(uint256 principal, uint16 termMonths)
        external
        nonReentrant
        whenNotPaused
        returns (uint256 tokenId)
    {
        if (principal < MIN_PRINCIPAL) revert BelowMinimum();
        if (termMonths != 12 && termMonths != 24 && termMonths != 36) revert BadTerm();
        usdc.safeTransferFrom(msg.sender, address(this), principal);

        tokenId = nextTokenId++;
        uint64 maturity = uint64(block.timestamp) + uint64(termMonths) * 30 days;
        bonds[tokenId] = Bond(principal, uint64(block.timestamp), maturity, termMonths, 0, false);
        _safeMint(msg.sender, tokenId);
        emit BondMinted(tokenId, msg.sender, principal, termMonths, maturity);

        if (address(credit) != address(0)) {
            credit.recordActivity(msg.sender, 1, principal); // 1 = bond purchase
        }
    }

    // ─── Yield APY math ───────────────────────────────────────────────────────

    function effectiveApyBps(uint256 tokenId) public view returns (uint256) {
        Bond storage b = bonds[tokenId];
        uint256 apy = baseRateBps;
        if (b.principal >= TIER3_THRESHOLD) apy += 300;
        else if (b.principal >= TIER2_THRESHOLD) apy += 150;

        // Term multiplier: 12→1.00x, 24→1.10x, 36→1.25x
        uint256 mult = b.termMonths == 12 ? 10_000 : b.termMonths == 24 ? 11_000 : 12_500;
        return (apy * mult) / 10_000;
    }

    function pendingYield(uint256 tokenId) public view returns (uint256) {
        Bond storage b = bonds[tokenId];
        if (b.redeemed) return 0;
        uint256 elapsed = block.timestamp - b.mintedAt;
        uint256 accrued = (b.principal * effectiveApyBps(tokenId) * elapsed)
            / (BASIS_POINTS * 365 days);
        return accrued > b.yieldClaimed ? accrued - b.yieldClaimed : 0;
    }

    /// @notice Called by the revenue pool to push USDC yield to a holder.
    function distributeYield(uint256 tokenId) external nonReentrant {
        if (msg.sender != revenuePool) revert NotAuthorizedPool();
        uint256 amount = pendingYield(tokenId);
        if (amount == 0) return;
        bonds[tokenId].yieldClaimed += amount;
        usdc.safeTransfer(ownerOf(tokenId), amount);
        emit YieldDistributed(tokenId, amount);

        if (address(credit) != address(0)) {
            credit.recordActivity(ownerOf(tokenId), 2, amount); // 2 = on-time yield
        }
    }

    // ─── Redemption ───────────────────────────────────────────────────────────

    function redeem(uint256 tokenId) external nonReentrant {
        if (ownerOf(tokenId) != msg.sender) revert NotHolder();
        Bond storage b = bonds[tokenId];
        if (b.redeemed) revert AlreadyRedeemed();
        b.redeemed = true;

        uint256 penalty = 0;
        if (block.timestamp < b.maturity) {
            // Early exit forfeits 90 days of yield.
            penalty = (b.principal * effectiveApyBps(tokenId) * EARLY_EXIT_PENALTY_DAYS * 1 days)
                / (BASIS_POINTS * 365 days);
            if (penalty > b.principal) penalty = 0; // safety
        }
        uint256 payout = b.principal - penalty;
        _burn(tokenId);
        usdc.safeTransfer(msg.sender, payout);
        emit BondRedeemed(tokenId, payout, penalty);
    }

    // ─── Admin ────────────────────────────────────────────────────────────────

    function setRevenuePool(address pool) external onlyOwner {
        revenuePool = pool;
        emit RevenuePoolSet(pool);
    }

    function setCredit(address creditAddress) external onlyOwner {
        credit = ICommunityCredit(creditAddress);
        emit CreditSet(creditAddress);
    }

    function setBaseRate(uint256 bps) external onlyOwner {
        require(bps <= 3_000, "MAX 30%");
        baseRateBps = bps;
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
}
