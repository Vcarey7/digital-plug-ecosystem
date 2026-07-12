// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title PlugRegistry
 * @author Digital Plug Co. — Digital Black Wall Street
 * @notice ERC-721 registry of Digital Plug domains. Identity backbone of
 *         the DBWS ecosystem — every domain token carries a reputation
 *         score consumed by credit, lending, and marketplace contracts.
 *
 * Registration itself is performed by PlugRegistrar (REGISTRAR_ROLE);
 * this contract is the source of truth for ownership, expiry, and
 * reputation.
 */
contract PlugRegistry is ERC721Enumerable, AccessControl {
    bytes32 public constant REGISTRAR_ROLE = keccak256("REGISTRAR_ROLE");
    bytes32 public constant REPUTATION_ROLE = keccak256("REPUTATION_ROLE");

    struct DomainRecord {
        string name;        // "vance"
        string tld;         // "plug"
        uint64 expiresAt;
        uint64 registeredAt;
        uint16 reputation;  // 0–1000
        address resolver;
    }

    uint256 public nextTokenId = 1;
    uint256 public constant GRACE_PERIOD = 30 days;
    uint16 public constant MAX_REPUTATION = 1000;

    mapping(uint256 => DomainRecord) public domains;
    // keccak256(abi.encodePacked(name, ".", tld)) => tokenId
    mapping(bytes32 => uint256) public nameToTokenId;

    string private _baseTokenURI;

    event DomainRegistered(uint256 indexed tokenId, string name, string tld, address indexed owner, uint64 expiresAt);
    event DomainRenewed(uint256 indexed tokenId, uint64 newExpiry);
    event DomainReleased(uint256 indexed tokenId, bytes32 nameHash);
    event ResolverSet(uint256 indexed tokenId, address resolver);
    event ReputationUpdated(uint256 indexed tokenId, uint16 newScore);

    error NameTaken();
    error NotTokenOwner();
    error DomainExpiredError();
    error NotExpired();
    error InvalidScore();

    constructor(address admin) ERC721("Digital Plug Domains", "PLUGD") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    // ─── Registration lifecycle (registrar only) ─────────────────────────────

    function register(
        address to,
        string calldata name_,
        string calldata tld,
        uint64 duration
    ) external onlyRole(REGISTRAR_ROLE) returns (uint256 tokenId) {
        bytes32 nameHash = domainHash(name_, tld);
        uint256 existing = nameToTokenId[nameHash];
        if (existing != 0 && !isExpired(existing)) revert NameTaken();
        if (existing != 0) _release(existing, nameHash);

        tokenId = nextTokenId++;
        uint64 expiry = uint64(block.timestamp) + duration;
        domains[tokenId] = DomainRecord({
            name: name_,
            tld: tld,
            expiresAt: expiry,
            registeredAt: uint64(block.timestamp),
            reputation: 500,
            resolver: address(0)
        });
        nameToTokenId[nameHash] = tokenId;
        _safeMint(to, tokenId);
        emit DomainRegistered(tokenId, name_, tld, to, expiry);
    }

    function renew(uint256 tokenId, uint64 additionalDuration)
        external
        onlyRole(REGISTRAR_ROLE)
    {
        DomainRecord storage rec = domains[tokenId];
        uint64 base = rec.expiresAt > block.timestamp
            ? rec.expiresAt
            : uint64(block.timestamp);
        rec.expiresAt = base + additionalDuration;
        emit DomainRenewed(tokenId, rec.expiresAt);
    }

    /// @notice Anyone may reclaim-burn a domain past its grace period.
    function releaseExpired(uint256 tokenId) external {
        DomainRecord storage rec = domains[tokenId];
        if (block.timestamp <= rec.expiresAt + GRACE_PERIOD) revert NotExpired();
        _release(tokenId, domainHash(rec.name, rec.tld));
    }

    function _release(uint256 tokenId, bytes32 nameHash) internal {
        delete nameToTokenId[nameHash];
        delete domains[tokenId];
        _burn(tokenId);
        emit DomainReleased(tokenId, nameHash);
    }

    // ─── Owner functions ──────────────────────────────────────────────────────

    function setResolver(uint256 tokenId, address resolver) external {
        if (ownerOf(tokenId) != msg.sender) revert NotTokenOwner();
        if (isExpired(tokenId)) revert DomainExpiredError();
        domains[tokenId].resolver = resolver;
        emit ResolverSet(tokenId, resolver);
    }

    // ─── Reputation (credit / activity contracts) ────────────────────────────

    function setReputation(uint256 tokenId, uint16 score)
        external
        onlyRole(REPUTATION_ROLE)
    {
        if (score > MAX_REPUTATION) revert InvalidScore();
        domains[tokenId].reputation = score;
        emit ReputationUpdated(tokenId, score);
    }

    // ─── Views ────────────────────────────────────────────────────────────────

    function domainHash(string memory name_, string memory tld)
        public
        pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(name_, ".", tld));
    }

    function isExpired(uint256 tokenId) public view returns (bool) {
        return block.timestamp > domains[tokenId].expiresAt;
    }

    function isAvailable(string calldata name_, string calldata tld)
        external
        view
        returns (bool)
    {
        uint256 tokenId = nameToTokenId[domainHash(name_, tld)];
        return tokenId == 0 || isExpired(tokenId);
    }

    function getReputation(uint256 tokenId) external view returns (uint256) {
        return domains[tokenId].reputation;
    }

    function fullName(uint256 tokenId) external view returns (string memory) {
        DomainRecord storage rec = domains[tokenId];
        return string(abi.encodePacked(rec.name, ".", rec.tld));
    }

    // ─── Admin / overrides ────────────────────────────────────────────────────

    function setBaseURI(string calldata uri) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _baseTokenURI = uri;
    }

    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721Enumerable, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
