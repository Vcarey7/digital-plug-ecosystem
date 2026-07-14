// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title EntityRegistry — Registry 2 of the DBWS Registry Suite
 * @author Digital Plug Co. — Digital Black Wall Street
 * @notice Business entity / LLC catalog as ERC-721. Each record captures an
 *         entity's identity (hashed EIN, formation data, IPFS metadata),
 *         links to PlugRegistry domains, and can be locked as $DPNOTE
 *         collateral. Powers FreshStart Holdings inventory + governance.
 *         Registration fee paid in USDC (switchable to $PLUG later via
 *         setPaymentToken, no redeploy).
 */
contract EntityRegistry is ERC721, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct BusinessEntity {
        string entityName;
        string entityType;        // LLC, Corp, DAO, etc.
        string stateOfFormation;
        string einHash;           // hashed EIN — never the raw number
        uint256 formationDate;
        uint256 registrationDate;
        address owner;
        bool active;
        bool lendable;
        uint256 linkedNoteId;
        string[] linkedDomains;
        string metadataURI;
    }

    mapping(uint256 => BusinessEntity) public entities;
    mapping(address => uint256[]) public ownerEntities;
    uint256 public nextTokenId = 1;

    uint256 public registrationFee = 97e6; // USDC, 6 decimals
    address public revenueRouter;
    IERC20 public paymentToken;              // USDC now, $PLUG later

    event EntityRegistered(uint256 indexed tokenId, string entityName, address indexed owner, uint256 timestamp);
    event EntityLockedForLending(uint256 indexed tokenId, uint256 noteId, address lender);
    event DomainLinked(uint256 indexed tokenId, string domain);
    event RegistrationFeeSet(uint256 fee);
    event PaymentTokenSet(address indexed token);

    error NotOwner();
    error NotLendable();

    constructor(address _revenueRouter, address _usdc, address admin)
        ERC721("DBWS Entity Registry", "DBWS-ENTITY")
        Ownable(admin)
    {
        revenueRouter = _revenueRouter;
        paymentToken = IERC20(_usdc);
    }

    function registerEntity(
        string calldata _entityName,
        string calldata _entityType,
        string calldata _stateOfFormation,
        string calldata _einHash,
        uint256 _formationDate,
        string calldata _metadataURI
    ) external nonReentrant returns (uint256 tokenId) {
        tokenId = nextTokenId++;
        BusinessEntity storage e = entities[tokenId];
        e.entityName = _entityName;
        e.entityType = _entityType;
        e.stateOfFormation = _stateOfFormation;
        e.einHash = _einHash;
        e.formationDate = _formationDate;
        e.registrationDate = block.timestamp;
        e.owner = msg.sender;
        e.active = true;
        e.lendable = true;
        e.metadataURI = _metadataURI;

        ownerEntities[msg.sender].push(tokenId);
        _safeMint(msg.sender, tokenId);
        _collect(registrationFee);

        emit EntityRegistered(tokenId, _entityName, msg.sender, block.timestamp);
    }

    function linkDomain(uint256 tokenId, string calldata domain) external {
        if (ownerOf(tokenId) != msg.sender) revert NotOwner();
        entities[tokenId].linkedDomains.push(domain);
        emit DomainLinked(tokenId, domain);
    }

    function lockForLending(uint256 tokenId, uint256 noteId, address lender) external {
        if (ownerOf(tokenId) != msg.sender) revert NotOwner();
        if (!entities[tokenId].lendable) revert NotLendable();
        entities[tokenId].lendable = false;
        entities[tokenId].linkedNoteId = noteId;
        emit EntityLockedForLending(tokenId, noteId, lender);
    }

    function unlock(uint256 tokenId) external onlyOwner {
        entities[tokenId].lendable = true;
        entities[tokenId].linkedNoteId = 0;
    }

    function getLinkedDomains(uint256 tokenId) external view returns (string[] memory) {
        return entities[tokenId].linkedDomains;
    }

    function getOwnerEntities(address account) external view returns (uint256[] memory) {
        return ownerEntities[account];
    }

    function setRegistrationFee(uint256 fee) external onlyOwner {
        registrationFee = fee;
        emit RegistrationFeeSet(fee);
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

    // Keep the struct owner mirror in sync on transfer.
    function _update(address to, uint256 tokenId, address auth)
        internal
        override
        returns (address)
    {
        if (to != address(0) && _ownerOf(tokenId) != address(0)) {
            entities[tokenId].owner = to;
        }
        return super._update(to, tokenId, auth);
    }
}
