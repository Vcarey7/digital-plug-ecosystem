// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title UserTLDRegistry
 * @author Digital Plug Co. — Digital Black Wall Street
 * @notice The TLD layer of Plug Domains. TLDs themselves are ERC-721
 *         assets: protocol TLDs (the 160+ Digital Plug inventory) are
 *         minted by admin; custom TLDs are minted by users for a $PLUG
 *         fee. TLD owners earn royalties on every subdomain registered
 *         under their TLD, set their own subdomain pricing, and can list
 *         their TLD on the auction engine.
 *
 * Pricing (user mints, in $PLUG)
 * ──────────────────────────────
 *  3 chars   → basePrice × 10
 *  4 chars   → basePrice × 4
 *  5+ chars  → basePrice
 */
contract UserTLDRegistry is ERC721Enumerable, AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant ROYALTY_REPORTER_ROLE = keccak256("ROYALTY_REPORTER_ROLE");

    struct TLDRecord {
        string tld;
        uint64 mintedAt;
        uint16 royaltyBps;        // TLD owner's cut of subdomain sales (max 2000 = 20%)
        uint256 subdomainPrice;   // per-year price in PLUG set by TLD owner (0 = registrar default)
        uint256 lifetimeRoyalties;
        bool userMinted;          // false for protocol inventory
    }

    IERC20 public immutable plug;
    address public treasury;

    uint256 public basePrice = 5_000e18;       // 5,000 PLUG for a 5+ char TLD
    uint16 public constant MAX_ROYALTY_BPS = 2_000;
    uint256 public constant MIN_TLD_LENGTH = 2;
    uint256 public constant MAX_TLD_LENGTH = 20;

    uint256 public nextTokenId = 1;
    mapping(uint256 => TLDRecord) public tlds;
    mapping(bytes32 => uint256) public tldToTokenId;   // keccak(tld) => tokenId
    mapping(bytes32 => bool) public reserved;          // blocked names (.com, .eth, slurs list, etc.)

    // Royalties accrue here until the TLD owner claims.
    mapping(uint256 => uint256) public pendingRoyalties;

    event TLDMinted(uint256 indexed tokenId, string tld, address indexed owner, bool userMinted, uint256 pricePaid);
    event SubdomainPriceSet(uint256 indexed tokenId, uint256 price);
    event RoyaltyAccrued(uint256 indexed tokenId, uint256 amount);
    event RoyaltiesClaimed(uint256 indexed tokenId, address indexed owner, uint256 amount);
    event ReservedSet(string tld, bool isReserved);
    event BasePriceSet(uint256 price);

    error TLDTaken();
    error TLDReserved();
    error InvalidTLD();
    error RoyaltyTooHigh();
    error NotTLDOwner();
    error NothingToClaim();

    constructor(address plugAddress, address treasuryAddress, address admin)
        ERC721("Digital Plug TLDs", "PLUGTLD")
    {
        plug = IERC20(plugAddress);
        treasury = treasuryAddress;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    // ─── Minting ──────────────────────────────────────────────────────────────

    /// @notice User mints a custom TLD, paying in $PLUG.
    function mintTLD(string calldata tld, uint16 royaltyBps)
        external
        nonReentrant
        returns (uint256 tokenId)
    {
        uint256 price = mintPrice(tld);
        plug.safeTransferFrom(msg.sender, treasury, price);
        tokenId = _mintTLD(msg.sender, tld, royaltyBps, true, price);
    }

    /// @notice Admin mints protocol inventory TLDs (the 160+ list) at no cost.
    function adminMintTLD(address to, string calldata tld, uint16 royaltyBps)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
        returns (uint256 tokenId)
    {
        tokenId = _mintTLD(to, tld, royaltyBps, false, 0);
    }

    function _mintTLD(
        address to,
        string calldata tld,
        uint16 royaltyBps,
        bool userMinted,
        uint256 pricePaid
    ) internal returns (uint256 tokenId) {
        _validate(tld);
        if (royaltyBps > MAX_ROYALTY_BPS) revert RoyaltyTooHigh();
        bytes32 hash = keccak256(abi.encodePacked(tld));
        if (tldToTokenId[hash] != 0) revert TLDTaken();
        if (reserved[hash]) revert TLDReserved();

        tokenId = nextTokenId++;
        tlds[tokenId] = TLDRecord({
            tld: tld,
            mintedAt: uint64(block.timestamp),
            royaltyBps: royaltyBps,
            subdomainPrice: 0,
            lifetimeRoyalties: 0,
            userMinted: userMinted
        });
        tldToTokenId[hash] = tokenId;
        _safeMint(to, tokenId);
        emit TLDMinted(tokenId, tld, to, userMinted, pricePaid);
    }

    function mintPrice(string calldata tld) public view returns (uint256) {
        uint256 len = bytes(tld).length;
        if (len == 2 || len == 3) return basePrice * 10;
        if (len == 4) return basePrice * 4;
        return basePrice;
    }

    function _validate(string calldata tld) internal pure {
        bytes memory b = bytes(tld);
        if (b.length < MIN_TLD_LENGTH || b.length > MAX_TLD_LENGTH) revert InvalidTLD();
        for (uint256 i = 0; i < b.length; i++) {
            bytes1 c = b[i];
            bool lower = c >= 0x61 && c <= 0x7A; // a-z
            bool digit = c >= 0x30 && c <= 0x39; // 0-9
            bool dash = c == 0x2D && i != 0 && i != b.length - 1;
            if (!lower && !digit && !dash) revert InvalidTLD();
        }
    }

    // ─── TLD-owner controls ───────────────────────────────────────────────────

    function setSubdomainPrice(uint256 tokenId, uint256 pricePLUG) external {
        if (ownerOf(tokenId) != msg.sender) revert NotTLDOwner();
        tlds[tokenId].subdomainPrice = pricePLUG;
        emit SubdomainPriceSet(tokenId, pricePLUG);
    }

    // ─── Royalties ────────────────────────────────────────────────────────────

    /// @notice Registrar/marketplace reports a subdomain sale; royalty share
    ///         is pulled from the caller and held for the TLD owner.
    function accrueRoyalty(uint256 tokenId, uint256 saleAmount)
        external
        onlyRole(ROYALTY_REPORTER_ROLE)
    {
        uint256 royalty = (saleAmount * tlds[tokenId].royaltyBps) / 10_000;
        if (royalty == 0) return;
        plug.safeTransferFrom(msg.sender, address(this), royalty);
        pendingRoyalties[tokenId] += royalty;
        tlds[tokenId].lifetimeRoyalties += royalty;
        emit RoyaltyAccrued(tokenId, royalty);
    }

    function claimRoyalties(uint256 tokenId) external nonReentrant {
        if (ownerOf(tokenId) != msg.sender) revert NotTLDOwner();
        uint256 amount = pendingRoyalties[tokenId];
        if (amount == 0) revert NothingToClaim();
        pendingRoyalties[tokenId] = 0;
        plug.safeTransfer(msg.sender, amount);
        emit RoyaltiesClaimed(tokenId, msg.sender, amount);
    }

    // ─── Views ────────────────────────────────────────────────────────────────

    function tldOwner(string calldata tld) external view returns (address) {
        uint256 tokenId = tldToTokenId[keccak256(abi.encodePacked(tld))];
        return tokenId == 0 ? address(0) : ownerOf(tokenId);
    }

    function isTLDAvailable(string calldata tld) external view returns (bool) {
        bytes32 hash = keccak256(abi.encodePacked(tld));
        return tldToTokenId[hash] == 0 && !reserved[hash];
    }

    // ─── Admin ────────────────────────────────────────────────────────────────

    function setReserved(string calldata tld, bool isReserved)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        reserved[keccak256(abi.encodePacked(tld))] = isReserved;
        emit ReservedSet(tld, isReserved);
    }

    function setBasePrice(uint256 price) external onlyRole(DEFAULT_ADMIN_ROLE) {
        basePrice = price;
        emit BasePriceSet(price);
    }

    function setTreasury(address t) external onlyRole(DEFAULT_ADMIN_ROLE) {
        treasury = t;
    }

    // ─── Overrides ────────────────────────────────────────────────────────────

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721Enumerable, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
