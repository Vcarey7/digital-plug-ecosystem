// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title DPAToken — Digital Precious Assets
 * @author Digital Plug Co. — Digital Black Wall Street
 * @notice ERC-1155 representing the ten Digital Precious Asset classes,
 *         forged by burning $PLUG through ForgeCore. Each asset id has an
 *         annual emission cap enforced on-chain.
 *
 * Asset IDs
 * ─────────
 *  1 Onyx · 2 Obsidian · 3 Jasper · 4 Garnet · 5 Amber
 *  6 Topaz · 7 Sapphire · 8 Emerald · 9 Ruby · 10 Black Diamond
 *
 * WAVE 2 — HOLD FOR LEGAL REVIEW. Held alongside ForgeCore/AbsorptionFund,
 * whose floor-price support mechanic creates a gray-area expectation of
 * value appreciation from the issuer's efforts. Clear with counsel before
 * mainnet or public marketing.
 */
contract DPAToken is ERC1155, ERC1155Supply, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");

    uint256 public constant NUM_ASSETS = 10;

    // assetId => yearIndex => minted this year
    mapping(uint256 => mapping(uint256 => uint256)) public mintedInYear;
    // assetId => annual cap (0 = uncapped)
    mapping(uint256 => uint256) public annualCap;

    string public name = "Digital Precious Assets";
    string public symbol = "DPA";

    uint256 public immutable genesisTimestamp;

    event AnnualCapSet(uint256 indexed assetId, uint256 cap);

    error InvalidAsset();
    error AnnualCapExceeded();

    constructor(string memory baseUri, address admin) ERC1155(baseUri) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        genesisTimestamp = block.timestamp;
    }

    function currentYear() public view returns (uint256) {
        return (block.timestamp - genesisTimestamp) / 365 days;
    }

    function setAnnualCap(uint256 assetId, uint256 cap)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        if (assetId == 0 || assetId > NUM_ASSETS) revert InvalidAsset();
        annualCap[assetId] = cap;
        emit AnnualCapSet(assetId, cap);
    }

    function setURI(string memory newUri) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setURI(newUri);
    }

    function mint(address to, uint256 assetId, uint256 amount)
        external
        onlyRole(MINTER_ROLE)
    {
        if (assetId == 0 || assetId > NUM_ASSETS) revert InvalidAsset();
        uint256 yr = currentYear();
        uint256 cap = annualCap[assetId];
        if (cap != 0 && mintedInYear[assetId][yr] + amount > cap) {
            revert AnnualCapExceeded();
        }
        mintedInYear[assetId][yr] += amount;
        _mint(to, assetId, amount, "");
    }

    function burn(address from, uint256 assetId, uint256 amount)
        external
        onlyRole(BURNER_ROLE)
    {
        _burn(from, assetId, amount);
    }

    // ─── Overrides ────────────────────────────────────────────────────────────

    function _update(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory values
    ) internal override(ERC1155, ERC1155Supply) {
        super._update(from, to, ids, values);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC1155, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
