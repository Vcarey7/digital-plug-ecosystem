// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title PlugResolver
 * @author Digital Plug Co. — Digital Black Wall Street
 * @notice Maps Digital Plug domains to wallet addresses, content hashes
 *         (IPFS sites), and arbitrary text records (socials, ai.assistant,
 *         payment rails). Authority is derived from PlugRegistry ownership.
 */
interface IPlugRegistry {
    function ownerOf(uint256 tokenId) external view returns (address);
    function nameToTokenId(bytes32 nameHash) external view returns (uint256);
    function isExpired(uint256 tokenId) external view returns (bool);
    function domainHash(string memory name_, string memory tld) external pure returns (bytes32);
}

contract PlugResolver {
    IPlugRegistry public immutable registry;

    mapping(uint256 => address) public addr;                       // wallet
    mapping(uint256 => bytes) public contenthash;                  // IPFS/Arweave
    mapping(uint256 => mapping(string => string)) private _text;   // key => value

    event AddressSet(uint256 indexed tokenId, address addr);
    event ContenthashSet(uint256 indexed tokenId, bytes hash);
    event TextSet(uint256 indexed tokenId, string key, string value);

    error NotDomainOwner();
    error DomainExpired();

    constructor(address registryAddress) {
        registry = IPlugRegistry(registryAddress);
    }

    modifier onlyDomainOwner(uint256 tokenId) {
        if (registry.ownerOf(tokenId) != msg.sender) revert NotDomainOwner();
        if (registry.isExpired(tokenId)) revert DomainExpired();
        _;
    }

    // ─── Writes ───────────────────────────────────────────────────────────────

    function setAddress(uint256 tokenId, address a) external onlyDomainOwner(tokenId) {
        addr[tokenId] = a;
        emit AddressSet(tokenId, a);
    }

    function setContenthash(uint256 tokenId, bytes calldata hash)
        external
        onlyDomainOwner(tokenId)
    {
        contenthash[tokenId] = hash;
        emit ContenthashSet(tokenId, hash);
    }

    function setText(uint256 tokenId, string calldata key, string calldata value)
        external
        onlyDomainOwner(tokenId)
    {
        _text[tokenId][key] = value;
        emit TextSet(tokenId, key, value);
    }

    // ─── Reads ────────────────────────────────────────────────────────────────

    function text(uint256 tokenId, string calldata key)
        external
        view
        returns (string memory)
    {
        return _text[tokenId][key];
    }

    /// @notice Resolve "name.tld" straight to a wallet address.
    function resolve(string calldata name_, string calldata tld)
        external
        view
        returns (address)
    {
        uint256 tokenId = registry.nameToTokenId(registry.domainHash(name_, tld));
        if (tokenId == 0 || registry.isExpired(tokenId)) return address(0);
        address a = addr[tokenId];
        // Fall back to the NFT owner if no explicit address record.
        return a != address(0) ? a : registry.ownerOf(tokenId);
    }
}
