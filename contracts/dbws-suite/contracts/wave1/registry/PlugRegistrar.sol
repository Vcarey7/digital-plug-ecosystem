// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title PlugRegistrar
 * @author Digital Plug Co. — Digital Black Wall Street
 * @notice Public-facing registration engine. Handles per-TLD pricing,
 *         payments in USDC or $PLUG (PLUG at a discount), renewals, and
 *         affiliate revenue reporting. Calls into PlugRegistry to mint.
 */
interface IRegistry {
    function register(address to, string calldata name_, string calldata tld, uint64 duration)
        external
        returns (uint256);
    function renew(uint256 tokenId, uint64 additionalDuration) external;
    function isAvailable(string calldata name_, string calldata tld) external view returns (bool);
}

interface IAffiliateTracker {
    function recordSale(address affiliate, address buyer, uint256 usdValue) external;
}

contract PlugRegistrar is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant PRICE_ROLE = keccak256("PRICE_ROLE");

    struct TLDConfig {
        bool enabled;
        uint256 priceUSDC;      // per year, 6 decimals
        uint256 pricePLUG;      // per year, 18 decimals (discounted)
        uint256 premium3Char;   // multiplier bps for 3-char names (e.g. 30000 = 3x)
        uint256 premium4Char;   // multiplier bps for 4-char names
    }

    IRegistry public immutable registry;
    IERC20 public immutable usdc;
    IERC20 public immutable plug;
    address public treasury;
    IAffiliateTracker public affiliateTracker;

    mapping(string => TLDConfig) public tldConfig;

    uint64 public constant YEAR = 365 days;
    uint64 public constant MAX_YEARS = 10;

    // Commit-reveal registration (mirrors ENS's front-running protection).
    // Without this, an attacker watching the mempool for a registerDomain
    // tx can see the plaintext name, front-run it with their own
    // registration, and grief or extort the original buyer.
    mapping(bytes32 => uint256) public commitments;
    uint256 public minCommitmentAge = 1 minutes;
    uint256 public maxCommitmentAge = 1 days;

    event TLDConfigured(string tld, uint256 priceUSDC, uint256 pricePLUG);
    event DomainCommitted(bytes32 indexed commitment, address indexed sender);
    event Registered(uint256 indexed tokenId, string name, string tld, address indexed buyer, uint8 years_, bool paidInPlug);
    event Renewed(uint256 indexed tokenId, uint8 years_);
    event TreasurySet(address treasury);
    event AffiliateTrackerSet(address tracker);

    error TLDDisabled();
    error NameUnavailable();
    error InvalidYears();
    error NameTooShort();
    error CommitmentPending();
    error CommitmentNotFound();
    error CommitmentTooNew();
    error CommitmentExpired();

    constructor(
        address registryAddress,
        address usdcAddress,
        address plugAddress,
        address treasuryAddress,
        address admin
    ) {
        registry = IRegistry(registryAddress);
        usdc = IERC20(usdcAddress);
        plug = IERC20(plugAddress);
        treasury = treasuryAddress;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PRICE_ROLE, admin);
    }

    // ─── Admin ────────────────────────────────────────────────────────────────

    function configureTLD(
        string calldata tld,
        bool enabled,
        uint256 priceUSDC,
        uint256 pricePLUG,
        uint256 premium3Char,
        uint256 premium4Char
    ) external onlyRole(PRICE_ROLE) {
        tldConfig[tld] = TLDConfig(enabled, priceUSDC, pricePLUG, premium3Char, premium4Char);
        emit TLDConfigured(tld, priceUSDC, pricePLUG);
    }

    function setTreasury(address t) external onlyRole(DEFAULT_ADMIN_ROLE) {
        treasury = t;
        emit TreasurySet(t);
    }

    function setAffiliateTracker(address tracker) external onlyRole(DEFAULT_ADMIN_ROLE) {
        affiliateTracker = IAffiliateTracker(tracker);
        emit AffiliateTrackerSet(tracker);
    }

    // ─── Pricing ──────────────────────────────────────────────────────────────

    function quote(string calldata name_, string calldata tld, uint8 years_, bool payInPlug)
        public
        view
        returns (uint256 total)
    {
        TLDConfig storage cfg = tldConfig[tld];
        uint256 base = payInPlug ? cfg.pricePLUG : cfg.priceUSDC;
        uint256 len = bytes(name_).length;
        uint256 multiplierBps = 10_000;
        if (len == 3 && cfg.premium3Char != 0) multiplierBps = cfg.premium3Char;
        else if (len == 4 && cfg.premium4Char != 0) multiplierBps = cfg.premium4Char;
        total = (base * multiplierBps * years_) / 10_000;
    }

    // ─── Commit-reveal ────────────────────────────────────────────────────────

    /// @dev Compute the commitment hash for a pending domain registration.
    function makeCommitment(
        string calldata name_,
        string calldata tld,
        address buyer,
        bytes32 secret
    ) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(name_, tld, buyer, secret));
    }

    /// @dev Step 1: submit a commitment hash. Wait at least minCommitmentAge
    /// before revealing via registerDomain, and reveal before maxCommitmentAge.
    function commit(bytes32 _commitment) external {
        if (commitments[_commitment] + maxCommitmentAge >= block.timestamp) {
            revert CommitmentPending();
        }
        commitments[_commitment] = block.timestamp;
        emit DomainCommitted(_commitment, msg.sender);
    }

    function setCommitmentAges(uint256 minAge, uint256 maxAge) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(minAge < maxAge, "Invalid commitment age range");
        minCommitmentAge = minAge;
        maxCommitmentAge = maxAge;
    }

    // ─── Registration ─────────────────────────────────────────────────────────

    /// @dev Step 2: reveal. Caller must have called commit() with
    /// makeCommitment(name_, tld, msg.sender, secret) at least
    /// minCommitmentAge (and at most maxCommitmentAge) ago.
    function registerDomain(
        string calldata name_,
        string calldata tld,
        bytes32 secret,
        uint8 years_,
        bool payInPlug,
        address affiliate
    ) external nonReentrant returns (uint256 tokenId) {
        bytes32 commitment = makeCommitment(name_, tld, msg.sender, secret);
        uint256 committedAt = commitments[commitment];
        if (committedAt == 0) revert CommitmentNotFound();
        if (block.timestamp < committedAt + minCommitmentAge) revert CommitmentTooNew();
        if (block.timestamp > committedAt + maxCommitmentAge) revert CommitmentExpired();
        delete commitments[commitment];

        TLDConfig storage cfg = tldConfig[tld];
        if (!cfg.enabled) revert TLDDisabled();
        if (years_ == 0 || years_ > MAX_YEARS) revert InvalidYears();
        if (bytes(name_).length < 3) revert NameTooShort();
        if (!registry.isAvailable(name_, tld)) revert NameUnavailable();

        uint256 cost = quote(name_, tld, years_, payInPlug);
        _collect(payInPlug, cost);

        tokenId = registry.register(msg.sender, name_, tld, uint64(years_) * YEAR);
        emit Registered(tokenId, name_, tld, msg.sender, years_, payInPlug);

        if (affiliate != address(0) && address(affiliateTracker) != address(0)) {
            // Report USD value; PLUG payments report the USDC-equivalent config price.
            uint256 usdValue = quote(name_, tld, years_, false);
            affiliateTracker.recordSale(affiliate, msg.sender, usdValue);
        }
    }

    function renewDomain(
        uint256 tokenId,
        string calldata name_,
        string calldata tld,
        uint8 years_,
        bool payInPlug
    ) external nonReentrant {
        TLDConfig storage cfg = tldConfig[tld];
        if (!cfg.enabled) revert TLDDisabled();
        if (years_ == 0 || years_ > MAX_YEARS) revert InvalidYears();

        uint256 cost = quote(name_, tld, years_, payInPlug);
        _collect(payInPlug, cost);
        registry.renew(tokenId, uint64(years_) * YEAR);
        emit Renewed(tokenId, years_);
    }

    function _collect(bool payInPlug, uint256 cost) internal {
        if (payInPlug) {
            plug.safeTransferFrom(msg.sender, treasury, cost);
        } else {
            usdc.safeTransferFrom(msg.sender, treasury, cost);
        }
    }
}
