// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./DomainRegistry.sol";

interface IAffiliateTracker {
    function recordReferral(address referrer, address buyer, uint256 usdAmount) external;
}

/**
 * @title PlugRegistrar
 * @author Digital Plug Co. — Digital Black Wall Street
 * @notice Payment front-end for DomainRegistry: lets buyers register .plug /
 *         .dbws domains paying in USDC or discounted $PLUG instead of native
 *         currency. Must be granted DomainRegistry.setAuthorizedRegistrar so
 *         it can call registerDomainFor/renewDomainFor, which mint straight
 *         to the buyer without requiring a native-token payment from this
 *         contract. Sends collected fees to treasury and supports affiliate
 *         referrals.
 */
contract PlugRegistrar is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    bytes32 public constant ADMIN_ROLE   = keccak256("ADMIN_ROLE");
    bytes32 public constant PRICER_ROLE  = keccak256("PRICER_ROLE");

    DomainRegistry public registry;
    IERC20 public usdc;
    IERC20 public plug;
    IAffiliateTracker public affiliateTracker;

    address public treasury;
    address public defaultResolver;

    uint256 public constant YEAR = 365 days;
    uint256 public plugDiscountBps = 1000; // 10% discount for paying in $PLUG

    // $PLUG per $1 USDC (scaled 1e6 so 1e6 = 1 PLUG per dollar)
    uint256 public plugRate = 10 * 1e6; // default: 10 PLUG per $1

    // TLD (with leading dot, e.g. ".plug") => chars => annual price in USDC (6 decimals)
    mapping(string => mapping(uint256 => uint256)) public tldPricing;
    // TLD (with leading dot) => base price for 5+ char names
    mapping(string => uint256) public tldBasePrice;

    event DomainRegisteredViaPlug(address indexed owner, string domain, uint256 numYears, bool paidInPlug);
    event DomainRenewedViaPlug(bytes32 indexed domainHash, uint256 numYears);
    event PricingUpdated(string tld, uint256 chars, uint256 price);
    event TreasuryUpdated(address newTreasury);

    constructor(
        address _registry,
        address _usdc,
        address _plug,
        address _treasury,
        address _defaultResolver,
        address admin
    ) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        _grantRole(PRICER_ROLE, admin);

        registry        = DomainRegistry(_registry);
        usdc            = IERC20(_usdc);
        plug            = IERC20(_plug);
        treasury        = _treasury;
        defaultResolver = _defaultResolver;

        // Default .plug pricing (USDC 6 decimals)
        tldPricing[".plug"][2]  = 2000 * 1e6; // 2-char: $2000/yr
        tldPricing[".plug"][3]  = 500  * 1e6; // 3-char: $500/yr
        tldPricing[".plug"][4]  = 50   * 1e6; // 4-char: $50/yr
        tldBasePrice[".plug"]   = 10   * 1e6; // 5+char: $10/yr

        tldPricing[".dbws"][2]  = 1000 * 1e6;
        tldPricing[".dbws"][3]  = 200  * 1e6;
        tldPricing[".dbws"][4]  = 30   * 1e6;
        tldBasePrice[".dbws"]   = 8    * 1e6;
    }

    function getPrice(string calldata label, string calldata tld, uint256 numYears)
        public view returns (uint256 usdcAmount)
    {
        uint256 len = bytes(label).length;
        uint256 annual;
        if (tldPricing[tld][len] > 0) {
            annual = tldPricing[tld][len];
        } else {
            annual = tldBasePrice[tld];
            require(annual > 0, "Registrar: TLD not configured");
        }
        usdcAmount = annual * numYears;
    }

    /// @dev DomainRegistry TLDs are stored without the leading dot (e.g.
    ///      "plug"), while this contract's pricing tables use ".plug" to
    ///      match how they were originally configured. Strip it here so
    ///      callers keep using the ".plug" / ".dbws" convention.
    function _stripLeadingDot(string memory tld) internal pure returns (string memory) {
        bytes memory b = bytes(tld);
        if (b.length > 0 && b[0] == ".") {
            bytes memory out = new bytes(b.length - 1);
            for (uint256 i = 1; i < b.length; i++) {
                out[i - 1] = b[i];
            }
            return string(out);
        }
        return tld;
    }

    function register(
        string calldata label,
        string calldata tld,
        uint256 numYears,
        bool payInPlug,
        address referrer,
        string calldata metadataURI
    ) external nonReentrant whenNotPaused {
        require(numYears >= 1 && numYears <= 10, "Registrar: invalid years");
        uint256 usdcCost = getPrice(label, tld, numYears);

        if (payInPlug) {
            // $PLUG payment gets a discount; price oracle would be used in production
            // For MVP: admin sets PLUG/USD rate via setPlugRate
            uint256 plugCost = (usdcCost * plugRate / 1e6) * (10000 - plugDiscountBps) / 10000;
            plug.safeTransferFrom(msg.sender, treasury, plugCost);
        } else {
            usdc.safeTransferFrom(msg.sender, treasury, usdcCost);
        }

        if (address(affiliateTracker) != address(0) && referrer != address(0) && referrer != msg.sender) {
            affiliateTracker.recordReferral(referrer, msg.sender, usdcCost / 1e6);
        }

        registry.registerDomainFor(
            _stripLeadingDot(tld),
            label,
            msg.sender,
            numYears * YEAR,
            defaultResolver,
            metadataURI
        );

        emit DomainRegisteredViaPlug(msg.sender, string(abi.encodePacked(label, tld)), numYears, payInPlug);
    }

    function renew(bytes32 domainHash, string calldata originalTld, uint256 numYears, bool payInPlug) external nonReentrant whenNotPaused {
        (address domainOwner, , ) = _domainOwnerAndExpiry(domainHash);
        require(domainOwner == msg.sender, "Registrar: not domain owner");

        uint256 usdcCost = tldBasePrice[originalTld] * numYears;
        require(usdcCost > 0, "Registrar: TLD not configured");

        if (payInPlug) {
            uint256 plugCost = usdcCost * plugRate / 1e6 * (10000 - plugDiscountBps) / 10000;
            plug.safeTransferFrom(msg.sender, treasury, plugCost);
        } else {
            usdc.safeTransferFrom(msg.sender, treasury, usdcCost);
        }

        registry.renewDomainFor(domainHash, numYears * YEAR);
        emit DomainRenewedViaPlug(domainHash, numYears);
    }

    function _domainOwnerAndExpiry(bytes32 domainHash) internal view returns (address, uint256, bool) {
        (, , address domainOwner, , uint256 expiry, bool isTLD, , ) = registry.domains(domainHash);
        return (domainOwner, expiry, isTLD);
    }

    function setPlugRate(uint256 rate) external onlyRole(ADMIN_ROLE) {
        plugRate = rate;
    }

    function setTldPrice(string calldata tld, uint256 chars, uint256 price) external onlyRole(PRICER_ROLE) {
        tldPricing[tld][chars] = price;
        emit PricingUpdated(tld, chars, price);
    }

    function setTldBasePrice(string calldata tld, uint256 price) external onlyRole(PRICER_ROLE) {
        tldBasePrice[tld] = price;
    }

    function setTreasury(address _treasury) external onlyRole(ADMIN_ROLE) {
        treasury = _treasury;
        emit TreasuryUpdated(_treasury);
    }

    function setDefaultResolver(address _resolver) external onlyRole(ADMIN_ROLE) {
        defaultResolver = _resolver;
    }

    function setAffiliateTracker(address _tracker) external onlyRole(ADMIN_ROLE) {
        affiliateTracker = IAffiliateTracker(_tracker);
    }

    function setPlugDiscount(uint256 bps) external onlyRole(ADMIN_ROLE) {
        require(bps <= 5000, "Registrar: discount too high");
        plugDiscountBps = bps;
    }

    function pause() external onlyRole(ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(ADMIN_ROLE) { _unpause(); }
}
