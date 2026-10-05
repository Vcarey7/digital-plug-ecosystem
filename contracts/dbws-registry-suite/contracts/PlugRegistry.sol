// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title PlugRegistry — Registry 1 of the DBWS Registry Suite
 * @author Digital Plug Co. — Digital Black Wall Street
 * @notice TLD + domain name registry. Domains are ERC-721 tokens keyed by
 *         (tld, name). Registration is priced per-TLD by tier and paid in
 *         USDC (switchable to $PLUG later via setPaymentToken, no redeploy);
 *         fees transfer straight to the RevenueRouter. Domains are
 *         transferable, renewable, and lockable as $DPNOTE collateral.
 *
 *         "Own Your Digital Address — Forever." · Sine Macula.
 */
contract PlugRegistry is ERC721, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Domain {
        string tld;
        string name;
        address owner;
        uint256 registered;
        uint256 expires;
        bool transferable;
        bool lendable;
        address lockedBy;   // lender holding it as collateral
        uint256 noteId;     // linked $DPNOTE
        string metadataURI;
    }

    // tld => registration fee per year (USDC, 6 decimals)
    mapping(string => uint256) public registrationFee;
    mapping(string => uint256) public transferFee;
    mapping(string => bool) public tldEnabled;

    // keccak(tld,name) => tokenId
    mapping(bytes32 => uint256) public nameToId;
    mapping(uint256 => Domain) public domainOf;

    // authorized payment layers (e.g. PlugRegistrar for USDC/$PLUG)
    mapping(address => bool) public authorizedRegistrars;

    address public revenueRouter;
    IERC20 public paymentToken;              // USDC now, $PLUG later
    uint256 public nextTokenId = 1;
    uint256 public constant GRACE_PERIOD = 30 days;
    uint64 public constant MAX_YEARS = 10;

    // Commit-reveal registration (mirrors ENS's front-running protection).
    // Without this, an attacker watching the mempool for a registerDomain
    // tx can see the plaintext name, front-run it with their own
    // registration, and grief or extort the original buyer.
    mapping(bytes32 => uint256) public commitments;
    uint256 public minCommitmentAge = 1 minutes;
    uint256 public maxCommitmentAge = 1 days;

    event TLDConfigured(string tld, uint256 fee, uint256 transferFee, bool enabled);
    event DomainCommitted(bytes32 indexed commitment, address indexed sender);
    event DomainRegistered(uint256 indexed tokenId, string tld, string name, address indexed owner, uint256 expires);
    event DomainRenewed(uint256 indexed tokenId, uint256 newExpiry);
    event DomainTransferred(uint256 indexed tokenId, address indexed from, address indexed to);
    event DomainLocked(uint256 indexed tokenId, address indexed lender, uint256 noteId);
    event DomainUnlocked(uint256 indexed tokenId);
    event RegistrarSet(address indexed registrar, bool authorized);
    event PaymentTokenSet(address indexed token);

    error TLDDisabled();
    error NameTaken();
    error BadYears();
    error NotDomainOwner();
    error NotTransferable();
    error DomainLockedErr();
    error NotAuthorized();
    error CommitmentPending();
    error CommitmentNotFound();
    error CommitmentTooNew();
    error CommitmentExpired();

    constructor(address _revenueRouter, address _usdc, address admin)
        ERC721("Digital Plug Domains", "PLUGD")
        Ownable(admin)
    {
        revenueRouter = _revenueRouter;
        paymentToken = IERC20(_usdc);
    }

    modifier onlyOwnerOrRegistrar() {
        if (msg.sender != owner() && !authorizedRegistrars[msg.sender]) revert NotAuthorized();
        _;
    }

    // ─── TLD admin ─────────────────────────────────────────────────────────────

    function configureTLD(
        string calldata tld,
        uint256 feePerYear,
        uint256 tldTransferFee,
        bool enabled
    ) external onlyOwner {
        registrationFee[tld] = feePerYear;
        transferFee[tld] = tldTransferFee;
        tldEnabled[tld] = enabled;
        emit TLDConfigured(tld, feePerYear, tldTransferFee, enabled);
    }

    function setAuthorizedRegistrar(address registrar, bool authorized) external onlyOwner {
        authorizedRegistrars[registrar] = authorized;
        emit RegistrarSet(registrar, authorized);
    }

    function setPaymentToken(address t) external onlyOwner {
        paymentToken = IERC20(t);
        emit PaymentTokenSet(t);
    }

    // ─── Commit-reveal ────────────────────────────────────────────────────────

    /// @dev Compute the commitment hash for a pending domain registration.
    function makeCommitment(
        string calldata tld,
        string calldata name,
        address buyer,
        bytes32 secret
    ) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(tld, name, buyer, secret));
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

    function setCommitmentAges(uint256 minAge, uint256 maxAge) external onlyOwner {
        require(minAge < maxAge, "Invalid commitment age range");
        minCommitmentAge = minAge;
        maxCommitmentAge = maxAge;
    }

    // ─── Registration ──────────────────────────────────────────────────────────

    function key(string memory tld, string memory name) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(name, ".", tld));
    }

    /// @notice Step 2: reveal. Caller must have called commit() with
    /// makeCommitment(tld, name, msg.sender, secret) at least
    /// minCommitmentAge (and at most maxCommitmentAge) ago. Paid in USDC
    /// (or the current paymentToken).
    function registerDomain(
        string calldata tld,
        string calldata name,
        address to,
        uint64 yearsCount,
        string calldata metadataURI,
        bytes32 secret
    ) external nonReentrant returns (uint256 tokenId) {
        bytes32 commitment = makeCommitment(tld, name, msg.sender, secret);
        uint256 committedAt = commitments[commitment];
        if (committedAt == 0) revert CommitmentNotFound();
        if (block.timestamp < committedAt + minCommitmentAge) revert CommitmentTooNew();
        if (block.timestamp > committedAt + maxCommitmentAge) revert CommitmentExpired();
        delete commitments[commitment];

        if (!tldEnabled[tld]) revert TLDDisabled();
        if (yearsCount == 0 || yearsCount > MAX_YEARS) revert BadYears();
        uint256 cost = registrationFee[tld] * yearsCount;

        tokenId = _register(tld, name, to, yearsCount, metadataURI);
        _collect(cost);
    }

    /// @notice Registration by an authorized payment layer (USDC/$PLUG) — no
    ///         direct payment; the registrar collected payment off this path.
    function registerDomainFor(
        string calldata tld,
        string calldata name,
        address to,
        uint64 yearsCount,
        string calldata metadataURI
    ) external onlyOwnerOrRegistrar returns (uint256 tokenId) {
        if (!tldEnabled[tld]) revert TLDDisabled();
        if (yearsCount == 0 || yearsCount > MAX_YEARS) revert BadYears();
        tokenId = _register(tld, name, to, yearsCount, metadataURI);
    }

    function _register(
        string memory tld,
        string memory name,
        address to,
        uint64 yearsCount,
        string memory metadataURI
    ) internal returns (uint256 tokenId) {
        bytes32 k = key(tld, name);
        uint256 existing = nameToId[k];
        if (existing != 0 && !_isExpired(existing)) revert NameTaken();
        if (existing != 0) _release(existing, k); // expired: reclaim

        tokenId = nextTokenId++;
        uint256 expiry = block.timestamp + (uint256(yearsCount) * 365 days);
        domainOf[tokenId] = Domain({
            tld: tld,
            name: name,
            owner: to,
            registered: block.timestamp,
            expires: expiry,
            transferable: true,
            lendable: true,
            lockedBy: address(0),
            noteId: 0,
            metadataURI: metadataURI
        });
        nameToId[k] = tokenId;
        _safeMint(to, tokenId);
        emit DomainRegistered(tokenId, tld, name, to, expiry);
    }

    function renewDomain(uint256 tokenId, uint64 yearsCount) external nonReentrant {
        Domain storage d = domainOf[tokenId];
        if (yearsCount == 0 || yearsCount > MAX_YEARS) revert BadYears();
        uint256 cost = registrationFee[d.tld] * yearsCount;
        _renew(tokenId, yearsCount);
        _collect(cost);
    }

    function renewDomainFor(uint256 tokenId, uint64 yearsCount) external onlyOwnerOrRegistrar {
        _renew(tokenId, yearsCount);
    }

    function _renew(uint256 tokenId, uint64 yearsCount) internal {
        Domain storage d = domainOf[tokenId];
        uint256 base = d.expires > block.timestamp ? d.expires : block.timestamp;
        d.expires = base + (uint256(yearsCount) * 365 days);
        emit DomainRenewed(tokenId, d.expires);
    }

    // ─── Secondary transfer (fee-gated) ────────────────────────────────────────

    function transferDomain(uint256 tokenId, address newOwner) external nonReentrant {
        Domain storage d = domainOf[tokenId];
        if (ownerOf(tokenId) != msg.sender) revert NotDomainOwner();
        if (!d.transferable) revert NotTransferable();

        _transfer(msg.sender, newOwner, tokenId);
        d.owner = newOwner;
        emit DomainTransferred(tokenId, msg.sender, newOwner);
        _collect(transferFee[d.tld]);
    }

    // ─── $DPNOTE collateral lock ───────────────────────────────────────────────

    function lockForLending(uint256 tokenId, address lender, uint256 noteId) external {
        Domain storage d = domainOf[tokenId];
        if (ownerOf(tokenId) != msg.sender) revert NotDomainOwner();
        if (!d.lendable) revert NotTransferable();
        d.lockedBy = lender;
        d.noteId = noteId;
        d.transferable = false;
        emit DomainLocked(tokenId, lender, noteId);
    }

    /// @notice Lender (or owner of registry) releases the collateral lock.
    function unlock(uint256 tokenId) external {
        Domain storage d = domainOf[tokenId];
        if (msg.sender != d.lockedBy && msg.sender != owner()) revert NotAuthorized();
        d.lockedBy = address(0);
        d.noteId = 0;
        d.transferable = true;
        emit DomainUnlocked(tokenId);
    }

    // ─── Views ─────────────────────────────────────────────────────────────────

    function _isExpired(uint256 tokenId) internal view returns (bool) {
        return block.timestamp > domainOf[tokenId].expires + GRACE_PERIOD;
    }

    function isAvailable(string calldata tld, string calldata name) external view returns (bool) {
        uint256 id = nameToId[key(tld, name)];
        return id == 0 || _isExpired(id);
    }

    function resolve(string calldata tld, string calldata name) external view returns (address) {
        uint256 id = nameToId[key(tld, name)];
        if (id == 0 || _isExpired(id)) return address(0);
        return ownerOf(id);
    }

    function fullName(uint256 tokenId) external view returns (string memory) {
        Domain storage d = domainOf[tokenId];
        return string(abi.encodePacked(d.name, ".", d.tld));
    }

    // ─── Internal ──────────────────────────────────────────────────────────────

    function _release(uint256 tokenId, bytes32 k) internal {
        delete nameToId[k];
        delete domainOf[tokenId];
        _burn(tokenId);
    }

    /// @dev Fees transfer straight to the RevenueRouter's USDC balance — no
    /// callback needed, matching the "no native forwarding" USDC pattern.
    function _collect(uint256 amount) internal {
        if (amount == 0) return;
        paymentToken.safeTransferFrom(msg.sender, revenueRouter, amount);
    }

    function setRevenueRouter(address r) external onlyOwner {
        revenueRouter = r;
    }

    // Block transfers of locked domains via the standard ERC-721 path too.
    function _update(address to, uint256 tokenId, address auth)
        internal
        override
        returns (address)
    {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) {
            if (!domainOf[tokenId].transferable) revert DomainLockedErr();
            domainOf[tokenId].owner = to;
        }
        return super._update(to, tokenId, auth);
    }
}
