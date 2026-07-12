// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

/**
 * @title TLDAuctionEngine
 * @author Digital Plug Co. — Digital Black Wall Street
 * @notice Auction house for premium TLD NFTs (from UserTLDRegistry) and
 *         premium domains (from PlugRegistry). Supports English auctions
 *         with anti-snipe extension and Dutch (declining-price) auctions.
 *         Settlement in $PLUG with a protocol fee to treasury.
 */
contract TLDAuctionEngine is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum AuctionType { ENGLISH, DUTCH }
    enum Status { ACTIVE, SETTLED, CANCELLED }

    struct Auction {
        address seller;
        address nft;
        uint256 tokenId;
        AuctionType auctionType;
        Status status;
        uint256 startPrice;
        uint256 endPrice;       // Dutch only: floor at end
        uint256 reservePrice;   // English only
        uint64 startTime;
        uint64 endTime;
        address highBidder;
        uint256 highBid;
    }

    IERC20 public immutable plug;
    address public treasury;
    uint256 public feeBps = 250; // 2.5%
    uint64 public constant ANTI_SNIPE_WINDOW = 10 minutes;

    uint256 public nextAuctionId = 1;
    mapping(uint256 => Auction) public auctions;

    event AuctionCreated(uint256 indexed auctionId, address indexed seller, address nft, uint256 tokenId, AuctionType auctionType);
    event BidPlaced(uint256 indexed auctionId, address indexed bidder, uint256 amount, uint64 newEndTime);
    event DutchPurchase(uint256 indexed auctionId, address indexed buyer, uint256 price);
    event AuctionSettled(uint256 indexed auctionId, address winner, uint256 price);
    event AuctionCancelled(uint256 indexed auctionId);

    error NotSeller();
    error NotActive();
    error AuctionEnded();
    error AuctionNotEnded();
    error BidTooLow();
    error HasBids();
    error InvalidParams();

    constructor(address plugAddress, address treasuryAddress, address admin) {
        plug = IERC20(plugAddress);
        treasury = treasuryAddress;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    // ─── Create ───────────────────────────────────────────────────────────────

    function createAuction(
        address nft,
        uint256 tokenId,
        AuctionType auctionType,
        uint256 startPrice,
        uint256 endPriceOrReserve,
        uint64 duration
    ) external nonReentrant returns (uint256 auctionId) {
        if (duration < 1 hours || duration > 30 days || startPrice == 0) revert InvalidParams();
        if (auctionType == AuctionType.DUTCH && endPriceOrReserve >= startPrice) revert InvalidParams();

        IERC721(nft).transferFrom(msg.sender, address(this), tokenId);

        auctionId = nextAuctionId++;
        auctions[auctionId] = Auction({
            seller: msg.sender,
            nft: nft,
            tokenId: tokenId,
            auctionType: auctionType,
            status: Status.ACTIVE,
            startPrice: startPrice,
            endPrice: auctionType == AuctionType.DUTCH ? endPriceOrReserve : 0,
            reservePrice: auctionType == AuctionType.ENGLISH ? endPriceOrReserve : 0,
            startTime: uint64(block.timestamp),
            endTime: uint64(block.timestamp) + duration,
            highBidder: address(0),
            highBid: 0
        });
        emit AuctionCreated(auctionId, msg.sender, nft, tokenId, auctionType);
    }

    // ─── English bidding ──────────────────────────────────────────────────────

    function bid(uint256 auctionId, uint256 amount) external nonReentrant {
        Auction storage a = auctions[auctionId];
        if (a.status != Status.ACTIVE || a.auctionType != AuctionType.ENGLISH) revert NotActive();
        if (block.timestamp >= a.endTime) revert AuctionEnded();

        uint256 minBid = a.highBid == 0 ? a.startPrice : a.highBid + (a.highBid / 20); // +5%
        if (amount < minBid) revert BidTooLow();

        plug.safeTransferFrom(msg.sender, address(this), amount);
        if (a.highBidder != address(0)) {
            plug.safeTransfer(a.highBidder, a.highBid); // refund previous
        }
        a.highBidder = msg.sender;
        a.highBid = amount;

        // Anti-snipe: extend if bid lands in the final window.
        if (a.endTime - block.timestamp < ANTI_SNIPE_WINDOW) {
            a.endTime = uint64(block.timestamp) + ANTI_SNIPE_WINDOW;
        }
        emit BidPlaced(auctionId, msg.sender, amount, a.endTime);
    }

    function settle(uint256 auctionId) external nonReentrant {
        Auction storage a = auctions[auctionId];
        if (a.status != Status.ACTIVE || a.auctionType != AuctionType.ENGLISH) revert NotActive();
        if (block.timestamp < a.endTime) revert AuctionNotEnded();

        a.status = Status.SETTLED;
        if (a.highBidder == address(0) || a.highBid < a.reservePrice) {
            // No sale — return NFT, refund bidder if reserve missed.
            if (a.highBidder != address(0)) plug.safeTransfer(a.highBidder, a.highBid);
            IERC721(a.nft).transferFrom(address(this), a.seller, a.tokenId);
            emit AuctionSettled(auctionId, address(0), 0);
            return;
        }
        _payout(a.seller, a.highBid);
        IERC721(a.nft).transferFrom(address(this), a.highBidder, a.tokenId);
        emit AuctionSettled(auctionId, a.highBidder, a.highBid);
    }

    // ─── Dutch purchase ───────────────────────────────────────────────────────

    function currentDutchPrice(uint256 auctionId) public view returns (uint256) {
        Auction storage a = auctions[auctionId];
        if (block.timestamp >= a.endTime) return a.endPrice;
        uint256 elapsed = block.timestamp - a.startTime;
        uint256 total = a.endTime - a.startTime;
        uint256 drop = ((a.startPrice - a.endPrice) * elapsed) / total;
        return a.startPrice - drop;
    }

    function buyDutch(uint256 auctionId) external nonReentrant {
        Auction storage a = auctions[auctionId];
        if (a.status != Status.ACTIVE || a.auctionType != AuctionType.DUTCH) revert NotActive();
        if (block.timestamp >= a.endTime) revert AuctionEnded();

        uint256 price = currentDutchPrice(auctionId);
        a.status = Status.SETTLED;
        plug.safeTransferFrom(msg.sender, address(this), price);
        _payout(a.seller, price);
        IERC721(a.nft).transferFrom(address(this), msg.sender, a.tokenId);
        emit DutchPurchase(auctionId, msg.sender, price);
    }

    // ─── Cancel / admin ───────────────────────────────────────────────────────

    function cancel(uint256 auctionId) external nonReentrant {
        Auction storage a = auctions[auctionId];
        if (a.seller != msg.sender) revert NotSeller();
        if (a.status != Status.ACTIVE) revert NotActive();
        if (a.highBidder != address(0)) revert HasBids();
        a.status = Status.CANCELLED;
        IERC721(a.nft).transferFrom(address(this), a.seller, a.tokenId);
        emit AuctionCancelled(auctionId);
    }

    function setFee(uint256 bps) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(bps <= 1_000, "MAX 10%");
        feeBps = bps;
    }

    function setTreasury(address t) external onlyRole(DEFAULT_ADMIN_ROLE) {
        treasury = t;
    }

    function _payout(address seller, uint256 gross) internal {
        uint256 fee = (gross * feeBps) / 10_000;
        plug.safeTransfer(treasury, fee);
        plug.safeTransfer(seller, gross - fee);
    }
}
