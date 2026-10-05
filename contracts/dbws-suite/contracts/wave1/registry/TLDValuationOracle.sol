// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title TLDValuationOracle
 * @author Digital Plug Co. — Digital Black Wall Street
 * @notice On-chain Standard Floor Value (SFV) engine for TLDs. SFV is a
 *         composite of registration velocity, secondary sales volume,
 *         subdomain count, and a curated brand score — used by the price
 *         controller, auction engine, and collateral systems.
 *
 * SFV formula (all inputs updated by FEEDER_ROLE keepers)
 * ───────────────────────────────────────────────────────
 *  SFV = baseValue
 *      + regCount        × 25 PLUG
 *      + salesVolume30d  × 10%
 *      + subdomainCount  × 5 PLUG
 *      + brandScore(0–100) × brandWeight
 */
contract TLDValuationOracle is AccessControl {
    bytes32 public constant FEEDER_ROLE = keccak256("FEEDER_ROLE");

    struct TLDMetrics {
        uint256 baseValue;        // curated floor, in PLUG (18d)
        uint256 regCount;         // active registrations under this TLD
        uint256 salesVolume30d;   // trailing 30d secondary volume, in PLUG
        uint256 subdomainCount;
        uint8 brandScore;         // 0–100
        uint64 lastUpdated;
    }

    uint256 public regWeight = 25e18;
    uint256 public subWeight = 5e18;
    uint256 public volumeBps = 1_000;      // 10%
    uint256 public brandWeight = 100e18;   // PLUG per brand point

    mapping(bytes32 => TLDMetrics) public metrics;

    event MetricsUpdated(bytes32 indexed tldHash, uint256 sfv);
    event WeightsUpdated(uint256 regWeight, uint256 subWeight, uint256 volumeBps, uint256 brandWeight);

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(FEEDER_ROLE, admin);
    }

    function tldHash(string calldata tld) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(tld));
    }

    function updateMetrics(
        bytes32 hash,
        uint256 baseValue,
        uint256 regCount,
        uint256 salesVolume30d,
        uint256 subdomainCount,
        uint8 brandScore
    ) external onlyRole(FEEDER_ROLE) {
        metrics[hash] = TLDMetrics({
            baseValue: baseValue,
            regCount: regCount,
            salesVolume30d: salesVolume30d,
            subdomainCount: subdomainCount,
            brandScore: brandScore > 100 ? 100 : brandScore,
            lastUpdated: uint64(block.timestamp)
        });
        emit MetricsUpdated(hash, getSFV(hash));
    }

    function setWeights(
        uint256 _regWeight,
        uint256 _subWeight,
        uint256 _volumeBps,
        uint256 _brandWeight
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        regWeight = _regWeight;
        subWeight = _subWeight;
        volumeBps = _volumeBps;
        brandWeight = _brandWeight;
        emit WeightsUpdated(_regWeight, _subWeight, _volumeBps, _brandWeight);
    }

    /// @notice Standard Floor Value in PLUG (18 decimals).
    function getSFV(bytes32 hash) public view returns (uint256) {
        TLDMetrics storage m = metrics[hash];
        return m.baseValue
            + m.regCount * regWeight
            + (m.salesVolume30d * volumeBps) / 10_000
            + m.subdomainCount * subWeight
            + uint256(m.brandScore) * brandWeight;
    }

    function getSFVByName(string calldata tld) external view returns (uint256) {
        return getSFV(tldHash(tld));
    }

    function isStale(bytes32 hash, uint256 maxAge) external view returns (bool) {
        return block.timestamp - metrics[hash].lastUpdated > maxAge;
    }
}
