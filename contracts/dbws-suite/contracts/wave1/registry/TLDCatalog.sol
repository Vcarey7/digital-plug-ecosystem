// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title TLDCatalog
 * @author Digital Plug Co. — Digital Black Wall Street
 * @notice On-chain source of truth for TLD tiers, categories, and reserved
 *         status. UserTLDRegistry and the registrar read this to apply the
 *         correct mint price / subdomain cut / renewal for each TLD, and to
 *         block reserved (protocol-held) names from public minting.
 *
 * Tiers
 * ─────
 *  LEGENDARY — 500 PLUG mint · 5% subdomain cut  · 100 PLUG/yr renewal
 *  GOLD      — 250 PLUG mint · 8% subdomain cut  · 75 PLUG/yr  renewal
 *  STANDARD  — 100 PLUG mint · 10% subdomain cut · 50 PLUG/yr  renewal
 *  STARTER   — 25 PLUG mint  · 15% subdomain cut · 25 PLUG/yr  renewal
 */
contract TLDCatalog is AccessControl {
    bytes32 public constant CURATOR_ROLE = keccak256("CURATOR_ROLE");

    enum Tier { LEGENDARY, GOLD, STANDARD, STARTER }

    struct TierConfig {
        uint256 mintPrice;      // PLUG (18d)
        uint16 subdomainCutBps; // owner cut on subdomain sales
        uint256 renewalPerYear; // PLUG (18d)
    }

    struct TLDEntry {
        bool listed;
        Tier tier;
        bytes32 category;    // keccak of category label, e.g. keccak("music")
        bool reserved;       // protocol-held; not publicly mintable
        bool minted;         // has been minted into UserTLDRegistry
    }

    mapping(Tier => TierConfig) public tierConfig;
    // keccak(tld) => entry
    mapping(bytes32 => TLDEntry) public entries;
    // enumeration
    bytes32[] public allTldHashes;
    mapping(bytes32 => string) public tldString; // hash => original string

    uint256 public totalListed;

    event TierConfigured(Tier tier, uint256 mintPrice, uint16 cutBps, uint256 renewal);
    event TLDListed(string tld, Tier tier, bytes32 category, bool reserved);
    event TLDReservedSet(string tld, bool reserved);
    event TLDMintedFlag(string tld, bool minted);

    error AlreadyListed();
    error NotListed();

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(CURATOR_ROLE, admin);

        tierConfig[Tier.LEGENDARY] = TierConfig(500e18, 500, 100e18);
        tierConfig[Tier.GOLD] = TierConfig(250e18, 800, 75e18);
        tierConfig[Tier.STANDARD] = TierConfig(100e18, 1_000, 50e18);
        tierConfig[Tier.STARTER] = TierConfig(25e18, 1_500, 25e18);
    }

    // ─── Catalog management ───────────────────────────────────────────────────

    function tldHash(string memory tld) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(tld));
    }

    function listTLD(
        string calldata tld,
        Tier tier,
        string calldata category,
        bool reserved
    ) public onlyRole(CURATOR_ROLE) {
        bytes32 h = tldHash(tld);
        if (entries[h].listed) revert AlreadyListed();
        entries[h] = TLDEntry({
            listed: true,
            tier: tier,
            category: keccak256(abi.encodePacked(category)),
            reserved: reserved,
            minted: false
        });
        tldString[h] = tld;
        allTldHashes.push(h);
        totalListed++;
        emit TLDListed(tld, tier, keccak256(abi.encodePacked(category)), reserved);
    }

    /// @notice Gas-efficient batch listing for seeding the full catalog.
    function batchListTLD(
        string[] calldata tlds,
        Tier[] calldata tiers,
        string[] calldata categories,
        bool[] calldata reservedFlags
    ) external onlyRole(CURATOR_ROLE) {
        uint256 n = tlds.length;
        require(
            tiers.length == n && categories.length == n && reservedFlags.length == n,
            "LENGTH"
        );
        for (uint256 i = 0; i < n; i++) {
            bytes32 h = tldHash(tlds[i]);
            if (entries[h].listed) continue; // skip dupes silently in batch
            entries[h] = TLDEntry({
                listed: true,
                tier: tiers[i],
                category: keccak256(abi.encodePacked(categories[i])),
                reserved: reservedFlags[i],
                minted: false
            });
            tldString[h] = tlds[i];
            allTldHashes.push(h);
            totalListed++;
            emit TLDListed(tlds[i], tiers[i], keccak256(abi.encodePacked(categories[i])), reservedFlags[i]);
        }
    }

    function setReserved(string calldata tld, bool reserved) external onlyRole(CURATOR_ROLE) {
        bytes32 h = tldHash(tld);
        if (!entries[h].listed) revert NotListed();
        entries[h].reserved = reserved;
        emit TLDReservedSet(tld, reserved);
    }

    function setMintedFlag(string calldata tld, bool minted) external onlyRole(CURATOR_ROLE) {
        bytes32 h = tldHash(tld);
        if (!entries[h].listed) revert NotListed();
        entries[h].minted = minted;
        emit TLDMintedFlag(tld, minted);
    }

    function configureTier(Tier tier, uint256 mintPrice, uint16 cutBps, uint256 renewal)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        tierConfig[tier] = TierConfig(mintPrice, cutBps, renewal);
        emit TierConfigured(tier, mintPrice, cutBps, renewal);
    }

    // ─── Views used by registry / registrar / storefront ──────────────────────

    function getEntry(string calldata tld)
        external
        view
        returns (bool listed, Tier tier, bytes32 category, bool reserved, bool minted)
    {
        TLDEntry storage e = entries[tldHash(tld)];
        return (e.listed, e.tier, e.category, e.reserved, e.minted);
    }

    function mintPriceOf(string calldata tld) external view returns (uint256) {
        return tierConfig[entries[tldHash(tld)].tier].mintPrice;
    }

    function subdomainCutBpsOf(string calldata tld) external view returns (uint16) {
        return tierConfig[entries[tldHash(tld)].tier].subdomainCutBps;
    }

    function renewalOf(string calldata tld) external view returns (uint256) {
        return tierConfig[entries[tldHash(tld)].tier].renewalPerYear;
    }

    function isReserved(string calldata tld) external view returns (bool) {
        return entries[tldHash(tld)].reserved;
    }

    function isPubliclyMintable(string calldata tld) external view returns (bool) {
        TLDEntry storage e = entries[tldHash(tld)];
        return e.listed && !e.reserved && !e.minted;
    }

    function catalogSize() external view returns (uint256) {
        return allTldHashes.length;
    }

    function tldAt(uint256 index) external view returns (string memory) {
        return tldString[allTldHashes[index]];
    }
}
