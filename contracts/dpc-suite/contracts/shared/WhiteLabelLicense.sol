// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title WhiteLabelLicense
 * @author Digital Plug Co. — Digital Black Wall Street
 * @notice B2B white-label licensing contract for DBWS technology stack.
 *         Partners pay annual license fees in USDC. License grants access
 *         to deploy DBWS-branded products under their own brand.
 *
 * LICENSE TIERS:
 *   STARTER   — $5,000/yr  — 1 product vertical
 *   GROWTH    — $15,000/yr — 3 verticals
 *   ENTERPRISE— $50,000/yr — Full stack + custom support
 *   SOVEREIGN — custom     — Revenue share model
 */
contract WhiteLabelLicense is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant SALES_ROLE = keccak256("SALES_ROLE");

    IERC20  public usdc;
    address public treasury;

    enum LicenseTier { NONE, STARTER, GROWTH, ENTERPRISE, SOVEREIGN }

    struct License {
        address  licensee;
        string   companyName;
        LicenseTier tier;
        uint256  issuedAt;
        uint256  expiresAt;
        bool     active;
        uint256  annualFee;
        uint256  revenueShareBps; // for SOVEREIGN tier
    }

    mapping(address => License) public licenses;
    mapping(address => bool)    public hasActiveLicense;
    uint256 public totalLicensees;

    mapping(LicenseTier => uint256) public tierAnnualFee;

    event LicenseIssued(address indexed licensee, string company, LicenseTier tier, uint256 expiresAt);
    event LicenseRenewed(address indexed licensee, uint256 newExpiry);
    event LicenseRevoked(address indexed licensee);

    constructor(address _usdc, address _treasury, address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        _grantRole(SALES_ROLE, admin);
        usdc     = IERC20(_usdc);
        treasury = _treasury;

        tierAnnualFee[LicenseTier.STARTER]    = 5_000  * 1e6;
        tierAnnualFee[LicenseTier.GROWTH]     = 15_000 * 1e6;
        tierAnnualFee[LicenseTier.ENTERPRISE] = 50_000 * 1e6;
        tierAnnualFee[LicenseTier.SOVEREIGN]  = 0; // custom
    }

    function issueLicense(
        address licensee,
        string calldata companyName,
        LicenseTier tier,
        uint256 numYears,
        uint256 customFee,
        uint256 revenueShareBps
    ) external onlyRole(SALES_ROLE) nonReentrant {
        require(tier != LicenseTier.NONE, "WLL: invalid tier");
        require(!hasActiveLicense[licensee], "WLL: already licensed");

        uint256 fee = tier == LicenseTier.SOVEREIGN ? customFee : tierAnnualFee[tier] * numYears;
        if (fee > 0) usdc.safeTransferFrom(licensee, treasury, fee);

        uint256 expiry = block.timestamp + numYears * 365 days;

        licenses[licensee] = License({
            licensee:         licensee,
            companyName:      companyName,
            tier:             tier,
            issuedAt:         block.timestamp,
            expiresAt:        expiry,
            active:           true,
            annualFee:        tierAnnualFee[tier],
            revenueShareBps:  revenueShareBps
        });

        hasActiveLicense[licensee] = true;
        totalLicensees++;

        emit LicenseIssued(licensee, companyName, tier, expiry);
    }

    function renewLicense(uint256 numYears) external nonReentrant {
        License storage lic = licenses[msg.sender];
        require(lic.active, "WLL: no license");
        require(lic.tier != LicenseTier.SOVEREIGN, "WLL: contact sales");

        uint256 fee = lic.annualFee * numYears;
        usdc.safeTransferFrom(msg.sender, treasury, fee);

        uint256 base = lic.expiresAt > block.timestamp ? lic.expiresAt : block.timestamp;
        lic.expiresAt = base + numYears * 365 days;

        emit LicenseRenewed(msg.sender, lic.expiresAt);
    }

    function revokeLicense(address licensee) external onlyRole(ADMIN_ROLE) {
        licenses[licensee].active = false;
        hasActiveLicense[licensee] = false;
        emit LicenseRevoked(licensee);
    }

    function isLicensed(address licensee) external view returns (bool) {
        License storage lic = licenses[licensee];
        return lic.active && block.timestamp < lic.expiresAt;
    }

    function setTierFee(LicenseTier tier, uint256 fee) external onlyRole(ADMIN_ROLE) {
        tierAnnualFee[tier] = fee;
    }
}
