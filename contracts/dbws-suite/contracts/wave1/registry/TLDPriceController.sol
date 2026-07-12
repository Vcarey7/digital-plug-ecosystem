// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title TLDPriceController
 * @author Digital Plug Co. — Digital Black Wall Street
 * @notice Governs how TLD listings relate to their oracle Standard Floor
 *         Value. Listings priced sanely get full marketplace visibility;
 *         listings far above SFV get demoted; listings below floor are
 *         flagged as fire sales (and can be auto-routed to AbsorptionFund).
 *
 * Tiers
 * ─────
 *  FIRE_SALE   < 80% of SFV     — flagged, absorption-eligible
 *  FLOOR       80–110% of SFV   — featured placement
 *  MARKET      110–200% of SFV  — standard visibility
 *  PREMIUM     200–500% of SFV  — reduced visibility
 *  SPECULATIVE > 500% of SFV    — delisted from browse, direct-link only
 */
interface ITLDValuationOracle {
    function getSFV(bytes32 tldHash) external view returns (uint256);
}

contract TLDPriceController is AccessControl {
    enum Tier { FIRE_SALE, FLOOR, MARKET, PREMIUM, SPECULATIVE }

    ITLDValuationOracle public oracle;

    // Boundaries in bps of SFV.
    uint256 public fireSaleBps = 8_000;
    uint256 public floorBps = 11_000;
    uint256 public marketBps = 20_000;
    uint256 public premiumBps = 50_000;

    event OracleSet(address oracle);
    event BoundariesSet(uint256 fireSale, uint256 floor, uint256 market, uint256 premium);

    constructor(address oracleAddress) {
        oracle = ITLDValuationOracle(oracleAddress);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function setOracle(address oracleAddress) external onlyRole(DEFAULT_ADMIN_ROLE) {
        oracle = ITLDValuationOracle(oracleAddress);
        emit OracleSet(oracleAddress);
    }

    function setBoundaries(
        uint256 _fireSale,
        uint256 _floor,
        uint256 _market,
        uint256 _premium
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_fireSale < _floor && _floor < _market && _market < _premium, "ORDER");
        fireSaleBps = _fireSale;
        floorBps = _floor;
        marketBps = _market;
        premiumBps = _premium;
        emit BoundariesSet(_fireSale, _floor, _market, _premium);
    }

    function previewListing(bytes32 tldHash, uint256 askingPrice)
        external
        view
        returns (Tier tier, string memory visibility, uint256 sfv)
    {
        sfv = oracle.getSFV(tldHash);
        if (sfv == 0) return (Tier.MARKET, "standard (no oracle data)", 0);

        uint256 ratioBps = (askingPrice * 10_000) / sfv;
        if (ratioBps < fireSaleBps) return (Tier.FIRE_SALE, "flagged - absorption eligible", sfv);
        if (ratioBps <= floorBps) return (Tier.FLOOR, "featured", sfv);
        if (ratioBps <= marketBps) return (Tier.MARKET, "standard", sfv);
        if (ratioBps <= premiumBps) return (Tier.PREMIUM, "reduced", sfv);
        return (Tier.SPECULATIVE, "direct-link only", sfv);
    }
}
