// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title IPRegistry — Registry 3 of the DBWS Registry Suite
 * @author Digital Plug Co. — Digital Black Wall Street
 * @notice Intellectual-property ownership + licensing as ERC-721. Registers
 *         software, creative works, brand assets, KBs, music, film, and
 *         character IP with a content-hash uniqueness guard, supports on-chain
 *         licenses with royalty terms, and is $DPNOTE-lendable. Registration
 *         fee paid in USDC (switchable to $PLUG later via setPaymentToken).
 */
contract IPRegistry is ERC721, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum IPType {
        SOFTWARE, CREATIVE_WORK, BRAND_ASSET, BUSINESS_METHOD,
        TECHNICAL_INNOVATION, DOMAIN_PORTFOLIO, KNOWLEDGE_BASE,
        MUSIC, FILM_VIDEO, CHARACTER_IP
    }

    struct IPAsset {
        string title;
        IPType ipType;
        string descriptionHash;   // IPFS hash of the full description
        bytes32 contentHash;      // SHA-256 of the content itself
        uint256 creationDate;
        uint256 registrationDate;
        address creator;
        address currentOwner;
        bool licensed;
        bool lendable;
        uint256 valuation;        // USD cents (from IP Valuation Pro)
        uint256 linkedNoteId;
        string metadataURI;
    }

    struct License {
        uint256 ipTokenId;
        address licensor;
        address licensee;
        string licenseType;       // Exclusive, Non-Exclusive, Sole
        uint256 startDate;
        uint256 endDate;          // 0 = perpetual
        uint256 royaltyRate;      // basis points
        bool active;
    }

    mapping(uint256 => IPAsset) public ipAssets;
    mapping(uint256 => License[]) public licenses;
    mapping(address => uint256[]) public ownerIP;
    mapping(bytes32 => bool) public contentHashExists;

    uint256 public nextTokenId = 1;
    uint256 public registrationFee = 47e6; // USDC, 6 decimals
    address public revenueRouter;
    IERC20 public paymentToken;              // USDC now, $PLUG later

    event IPRegistered(uint256 indexed tokenId, string title, IPType ipType, address indexed creator, bytes32 contentHash, uint256 timestamp);
    event LicenseCreated(uint256 indexed ipTokenId, address indexed licensor, address indexed licensee, string licenseType);
    event ValuationUpdated(uint256 indexed tokenId, uint256 oldValuation, uint256 newValuation);
    event PaymentTokenSet(address indexed token);

    error ContentRegistered();
    error NotOwner();

    constructor(address _revenueRouter, address _usdc, address admin)
        ERC721("DBWS IP Registry", "DBWS-IP")
        Ownable(admin)
    {
        revenueRouter = _revenueRouter;
        paymentToken = IERC20(_usdc);
    }

    function registerIP(
        string calldata _title,
        IPType _ipType,
        string calldata _descriptionHash,
        bytes32 _contentHash,
        uint256 _creationDate,
        string calldata _metadataURI
    ) external nonReentrant returns (uint256 tokenId) {
        if (contentHashExists[_contentHash]) revert ContentRegistered();

        tokenId = nextTokenId++;
        contentHashExists[_contentHash] = true;

        ipAssets[tokenId] = IPAsset({
            title: _title,
            ipType: _ipType,
            descriptionHash: _descriptionHash,
            contentHash: _contentHash,
            creationDate: _creationDate,
            registrationDate: block.timestamp,
            creator: msg.sender,
            currentOwner: msg.sender,
            licensed: false,
            lendable: true,
            valuation: 0,
            linkedNoteId: 0,
            metadataURI: _metadataURI
        });

        ownerIP[msg.sender].push(tokenId);
        _safeMint(msg.sender, tokenId);
        _collect(registrationFee);

        emit IPRegistered(tokenId, _title, _ipType, msg.sender, _contentHash, block.timestamp);
    }

    function createLicense(
        uint256 _ipTokenId,
        address _licensee,
        string calldata _licenseType,
        uint256 _duration,
        uint256 _royaltyRate
    ) external {
        if (ipAssets[_ipTokenId].currentOwner != msg.sender) revert NotOwner();
        licenses[_ipTokenId].push(License({
            ipTokenId: _ipTokenId,
            licensor: msg.sender,
            licensee: _licensee,
            licenseType: _licenseType,
            startDate: block.timestamp,
            endDate: _duration > 0 ? block.timestamp + _duration : 0,
            royaltyRate: _royaltyRate,
            active: true
        }));
        ipAssets[_ipTokenId].licensed = true;
        emit LicenseCreated(_ipTokenId, msg.sender, _licensee, _licenseType);
    }

    function updateValuation(uint256 tokenId, uint256 newValuation) external onlyOwner {
        uint256 old = ipAssets[tokenId].valuation;
        ipAssets[tokenId].valuation = newValuation;
        emit ValuationUpdated(tokenId, old, newValuation);
    }

    function licenseCount(uint256 tokenId) external view returns (uint256) {
        return licenses[tokenId].length;
    }

    function getOwnerIP(address account) external view returns (uint256[] memory) {
        return ownerIP[account];
    }

    function setRegistrationFee(uint256 fee) external onlyOwner {
        registrationFee = fee;
    }

    function setRevenueRouter(address r) external onlyOwner {
        revenueRouter = r;
    }

    function setPaymentToken(address t) external onlyOwner {
        paymentToken = IERC20(t);
        emit PaymentTokenSet(t);
    }

    function _collect(uint256 amount) internal {
        if (amount > 0) paymentToken.safeTransferFrom(msg.sender, revenueRouter, amount);
    }

    function _update(address to, uint256 tokenId, address auth)
        internal
        override
        returns (address)
    {
        if (to != address(0) && _ownerOf(tokenId) != address(0)) {
            ipAssets[tokenId].currentOwner = to;
        }
        return super._update(to, tokenId, auth);
    }
}
