// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title DomainRegistry
 * @dev A comprehensive Web3 domain registry supporting TLDs and subdomains
 * Each domain is represented as an ERC-721 NFT with unique ownership
 */
contract DomainRegistry is ERC721, ERC721URIStorage, Ownable, ReentrancyGuard {
    uint256 private _tokenIdCounter;

    // Domain structure
    struct Domain {
        string name;           // Full domain name (e.g., "example.freename")
        bytes32 namehash;      // Keccak256 hash of the domain name
        address owner;         // Current owner of the domain
        address resolver;      // Resolver contract address
        uint256 expiry;        // Expiration timestamp
        bool isTLD;           // True if this is a TLD, false for subdomains
        bytes32 parentHash;    // Hash of parent domain (0x0 for TLDs)
        uint256 tokenId;       // ERC-721 token ID
    }

    // Mappings
    mapping(bytes32 => Domain) public domains;
    mapping(bytes32 => bool) public domainExists;
    mapping(string => bytes32) public nameToHash;
    mapping(address => bytes32[]) public ownerDomains;
    mapping(bytes32 => bytes32[]) public subdomains; // parent hash => subdomain hashes

    // TLD management
    mapping(bytes32 => bool) public registeredTLDs;
    address public tldRegistrar;

    // Pricing
    uint256 public baseDomainPrice = 0.01 ether;
    uint256 public baseSubdomainPrice = 0.005 ether;
    uint256 public baseTLDPrice = 1 ether;

    // Commit-reveal registration (mirrors ENS's front-running protection).
    // registerDomain is open to any caller, so without this an attacker
    // watching the mempool could copy a pending registerDomain tx's
    // (tld, domain) and register it first. registerTLD is restricted to
    // tldRegistrar and registerSubdomain is restricted to the parent
    // domain's owner, so neither is exposed to the same griefing and both
    // are left as direct calls.
    mapping(bytes32 => uint256) public commitments;
    uint256 public minCommitmentAge = 1 minutes;
    uint256 public maxCommitmentAge = 1 days;

    // Contracts the owner has approved to call registerDomainFor /
    // renewDomainFor on behalf of buyers (e.g. an off-chain-priced USDC/
    // $PLUG payment layer). See registerDomainFor for the trust rationale.
    mapping(address => bool) public authorizedRegistrars;

    // Events
    event TLDRegistered(string indexed tld, bytes32 indexed tldHash, address indexed owner, uint256 tokenId);
    event DomainRegistered(string indexed domain, bytes32 indexed domainHash, address indexed owner, uint256 expiry, uint256 tokenId);
    event SubdomainRegistered(string indexed subdomain, string parentDomain, bytes32 indexed subdomainHash, address indexed owner, uint256 expiry, uint256 tokenId);
    event ResolverUpdated(bytes32 indexed domainHash, address indexed newResolver);
    event DomainRenewed(bytes32 indexed domainHash, uint256 newExpiry);
    event PriceUpdated(string priceType, uint256 newPrice);
    event DomainCommitted(bytes32 indexed commitment, address indexed sender);
    event AuthorizedRegistrarUpdated(address indexed registrar, bool authorized);

    constructor(
        string memory _name,
        string memory _symbol,
        address _tldRegistrar
    ) ERC721(_name, _symbol) Ownable(msg.sender) {
        tldRegistrar = _tldRegistrar;
    }

    modifier onlyTLDRegistrar() {
        require(msg.sender == tldRegistrar, "Only TLD registrar can perform this action");
        _;
    }

    modifier onlyDomainOwner(bytes32 _domainHash) {
        require(domains[_domainHash].owner == msg.sender, "Only domain owner can perform this action");
        _;
    }

    modifier domainNotExpired(bytes32 _domainHash) {
        require(block.timestamp < domains[_domainHash].expiry, "Domain has expired");
        _;
    }

    modifier onlyAuthorizedRegistrar() {
        require(authorizedRegistrars[msg.sender], "Not an authorized registrar");
        _;
    }

    /**
     * @dev Compute namehash for a domain name (ENS-style)
     * @param _name The domain name to hash
     * @return The namehash of the domain
     */
    function namehash(string memory _name) public pure returns (bytes32) {
        bytes32 node = 0x0000000000000000000000000000000000000000000000000000000000000000;
        if (bytes(_name).length == 0) {
            return node;
        }

        // Split by dots and hash from right to left
        bytes memory nameBytes = bytes(_name);
        bytes memory label;
        uint256 labelStart = nameBytes.length;

        for (uint256 i = nameBytes.length; i > 0; i--) {
            if (nameBytes[i-1] == 0x2e) { // '.' character
                label = new bytes(labelStart - i);
                for (uint256 j = 0; j < labelStart - i; j++) {
                    label[j] = nameBytes[i + j];
                }
                node = keccak256(abi.encodePacked(node, keccak256(label)));
                labelStart = i - 1;
            }
        }

        // Handle the last (leftmost) label
        label = new bytes(labelStart);
        for (uint256 j = 0; j < labelStart; j++) {
            label[j] = nameBytes[j];
        }
        node = keccak256(abi.encodePacked(node, keccak256(label)));

        return node;
    }

    /**
     * @dev Compute the commitment hash for a pending domain registration.
     */
    function makeDomainCommitment(
        string memory _tld,
        string memory _domain,
        address _owner,
        bytes32 _secret
    ) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(_tld, _domain, _owner, _secret));
    }

    /**
     * @dev Step 1 of registerDomain: submit a commitment hash. Must wait at
     * least minCommitmentAge before revealing via registerDomain, and reveal
     * before maxCommitmentAge elapses.
     */
    function commit(bytes32 _commitment) external {
        require(
            commitments[_commitment] + maxCommitmentAge < block.timestamp,
            "Commitment already pending"
        );
        commitments[_commitment] = block.timestamp;
        emit DomainCommitted(_commitment, msg.sender);
    }

    /**
     * @dev Register a new TLD
     * @param _tld The TLD name (e.g., "freename")
     * @param _owner The owner of the TLD
     * @param _resolver The resolver contract address
     * @param _metadataURI The metadata URI for the TLD NFT
     */
    function registerTLD(
        string memory _tld,
        address _owner,
        address _resolver,
        string memory _metadataURI
    ) external onlyTLDRegistrar nonReentrant {
        bytes32 tldHash = namehash(_tld);
        require(!domainExists[tldHash], "TLD already exists");

        uint256 tokenId = _tokenIdCounter;
        _tokenIdCounter++;

        // Create domain struct
        domains[tldHash] = Domain({
            name: _tld,
            namehash: tldHash,
            owner: _owner,
            resolver: _resolver,
            expiry: type(uint256).max, // TLDs don't expire
            isTLD: true,
            parentHash: bytes32(0),
            tokenId: tokenId
        });

        domainExists[tldHash] = true;
        registeredTLDs[tldHash] = true;
        nameToHash[_tld] = tldHash;
        ownerDomains[_owner].push(tldHash);

        // Mint NFT
        _safeMint(_owner, tokenId);
        _setTokenURI(tokenId, _metadataURI);

        emit TLDRegistered(_tld, tldHash, _owner, tokenId);
    }

    /**
     * @dev Register a domain under an existing TLD. Requires a prior call to
     * commit() with makeDomainCommitment(_tld, _domain, msg.sender, _secret)
     * at least minCommitmentAge (and at most maxCommitmentAge) ago.
     * @param _tld The TLD name
     * @param _domain The domain name (without TLD)
     * @param _duration Registration duration in seconds
     * @param _resolver The resolver contract address
     * @param _metadataURI The metadata URI for the domain NFT
     * @param _secret The secret used in the matching commitment
     */
    function registerDomain(
        string memory _tld,
        string memory _domain,
        uint256 _duration,
        address _resolver,
        string memory _metadataURI,
        bytes32 _secret
    ) external payable nonReentrant {
        bytes32 commitment = makeDomainCommitment(_tld, _domain, msg.sender, _secret);
        uint256 committedAt = commitments[commitment];
        require(committedAt != 0, "No matching commitment found");
        require(block.timestamp >= committedAt + minCommitmentAge, "Commitment too new");
        require(block.timestamp <= committedAt + maxCommitmentAge, "Commitment expired");

        bytes32 tldHash = namehash(_tld);
        require(registeredTLDs[tldHash], "TLD does not exist");
        require(msg.value >= baseDomainPrice, "Insufficient payment");

        string memory fullDomain = string(abi.encodePacked(_domain, ".", _tld));
        bytes32 domainHash = namehash(fullDomain);
        require(!domainExists[domainHash], "Domain already exists");

        delete commitments[commitment];

        _createDomain(fullDomain, tldHash, domainHash, msg.sender, _resolver, _duration, _metadataURI);
    }

    /**
     * @dev Register a domain on behalf of a buyer without requiring a native
     * -currency payment or a commit-reveal step. Restricted to contracts the
     * owner has explicitly authorized (e.g. a payment layer that collects
     * fees in USDC/$PLUG and forwards a single atomic registration call) --
     * an arbitrary untrusted caller cannot reach this function, so it isn't
     * exposed to the front-running risk registerDomain's commit-reveal
     * guards against.
     * @param _tld The TLD name
     * @param _domain The domain name (without TLD)
     * @param _owner The end recipient of the domain NFT
     * @param _duration Registration duration in seconds
     * @param _resolver The resolver contract address
     * @param _metadataURI The metadata URI for the domain NFT
     */
    function registerDomainFor(
        string memory _tld,
        string memory _domain,
        address _owner,
        uint256 _duration,
        address _resolver,
        string memory _metadataURI
    ) external onlyAuthorizedRegistrar nonReentrant returns (bytes32 domainHash) {
        bytes32 tldHash = namehash(_tld);
        require(registeredTLDs[tldHash], "TLD does not exist");

        string memory fullDomain = string(abi.encodePacked(_domain, ".", _tld));
        domainHash = namehash(fullDomain);
        require(!domainExists[domainHash], "Domain already exists");

        _createDomain(fullDomain, tldHash, domainHash, _owner, _resolver, _duration, _metadataURI);
    }

    function _createDomain(
        string memory _fullDomain,
        bytes32 _tldHash,
        bytes32 _domainHash,
        address _owner,
        address _resolver,
        uint256 _duration,
        string memory _metadataURI
    ) internal {
        uint256 tokenId = _tokenIdCounter;
        _tokenIdCounter++;

        uint256 expiry = block.timestamp + _duration;

        domains[_domainHash] = Domain({
            name: _fullDomain,
            namehash: _domainHash,
            owner: _owner,
            resolver: _resolver,
            expiry: expiry,
            isTLD: false,
            parentHash: _tldHash,
            tokenId: tokenId
        });

        domainExists[_domainHash] = true;
        nameToHash[_fullDomain] = _domainHash;
        ownerDomains[_owner].push(_domainHash);
        subdomains[_tldHash].push(_domainHash);

        // Mint NFT
        _safeMint(_owner, tokenId);
        _setTokenURI(tokenId, _metadataURI);

        emit DomainRegistered(_fullDomain, _domainHash, _owner, expiry, tokenId);
    }

    /**
     * @dev Register a subdomain under an existing domain. Only the parent
     * domain's owner may call this, so (unlike registerDomain) it isn't
     * exposed to third-party front-running and doesn't need commit-reveal.
     * @param _parentDomain The parent domain name
     * @param _subdomain The subdomain name
     * @param _owner The owner of the subdomain
     * @param _duration Registration duration in seconds
     * @param _resolver The resolver contract address
     * @param _metadataURI The metadata URI for the subdomain NFT
     */
    function registerSubdomain(
        string memory _parentDomain,
        string memory _subdomain,
        address _owner,
        uint256 _duration,
        address _resolver,
        string memory _metadataURI
    ) external payable nonReentrant {
        bytes32 parentHash = namehash(_parentDomain);
        require(domains[parentHash].owner == msg.sender, "Only parent domain owner can register subdomains");
        require(msg.value >= baseSubdomainPrice, "Insufficient payment");

        _createSubdomain(_parentDomain, _subdomain, parentHash, _owner, _resolver, _duration, _metadataURI);
    }

    /**
     * @dev Register a subdomain on behalf of its parent domain's owner
     * without a native-currency payment. Restricted to authorized
     * registrars (see registerDomainFor). Since registerSubdomain's access
     * control checks msg.sender against the parent domain's recorded owner,
     * a registrar contract calling it directly would be checked against
     * itself, not the real end user -- so this variant takes the acting
     * owner explicitly and verifies it instead.
     * @param _actingParentOwner The address claiming to own the parent
     * domain; verified against the registry's own record.
     */
    function registerSubdomainFor(
        string memory _parentDomain,
        string memory _subdomain,
        address _owner,
        uint256 _duration,
        address _resolver,
        string memory _metadataURI,
        address _actingParentOwner
    ) external onlyAuthorizedRegistrar nonReentrant returns (bytes32 subdomainHash) {
        bytes32 parentHash = namehash(_parentDomain);
        require(domains[parentHash].owner == _actingParentOwner, "Only parent domain owner can register subdomains");

        return _createSubdomain(_parentDomain, _subdomain, parentHash, _owner, _resolver, _duration, _metadataURI);
    }

    function _createSubdomain(
        string memory _parentDomain,
        string memory _subdomain,
        bytes32 _parentHash,
        address _owner,
        address _resolver,
        uint256 _duration,
        string memory _metadataURI
    ) internal returns (bytes32 subdomainHash) {
        require(domainExists[_parentHash], "Parent domain does not exist");

        string memory fullSubdomain = string(abi.encodePacked(_subdomain, ".", _parentDomain));
        subdomainHash = namehash(fullSubdomain);
        require(!domainExists[subdomainHash], "Subdomain already exists");

        uint256 tokenId = _tokenIdCounter;
        _tokenIdCounter++;

        uint256 expiry = block.timestamp + _duration;

        domains[subdomainHash] = Domain({
            name: fullSubdomain,
            namehash: subdomainHash,
            owner: _owner,
            resolver: _resolver,
            expiry: expiry,
            isTLD: false,
            parentHash: _parentHash,
            tokenId: tokenId
        });

        domainExists[subdomainHash] = true;
        nameToHash[fullSubdomain] = subdomainHash;
        ownerDomains[_owner].push(subdomainHash);
        subdomains[_parentHash].push(subdomainHash);

        // Mint NFT
        _safeMint(_owner, tokenId);
        _setTokenURI(tokenId, _metadataURI);

        emit SubdomainRegistered(fullSubdomain, _parentDomain, subdomainHash, _owner, expiry, tokenId);
    }

    /**
     * @dev Set resolver for a domain
     * @param _domainHash The domain hash
     * @param _resolver The new resolver address
     */
    function setResolver(bytes32 _domainHash, address _resolver)
        external
        onlyDomainOwner(_domainHash)
        domainNotExpired(_domainHash)
    {
        domains[_domainHash].resolver = _resolver;
        emit ResolverUpdated(_domainHash, _resolver);
    }

    /**
     * @dev Renew a domain registration
     * @param _domainHash The domain hash
     * @param _duration Additional duration in seconds
     */
    function renewDomain(bytes32 _domainHash, uint256 _duration)
        external
        payable
        onlyDomainOwner(_domainHash)
        nonReentrant
    {
        require(!domains[_domainHash].isTLD, "TLDs cannot be renewed");
        require(msg.value >= baseDomainPrice, "Insufficient payment");

        domains[_domainHash].expiry += _duration;
        emit DomainRenewed(_domainHash, domains[_domainHash].expiry);
    }

    /**
     * @dev Renew a domain on behalf of its owner, without a native-currency
     * payment. Restricted to authorized registrars for the same reason as
     * registerDomainFor.
     * @param _domainHash The domain hash
     * @param _duration Additional duration in seconds
     */
    function renewDomainFor(bytes32 _domainHash, uint256 _duration) external onlyAuthorizedRegistrar {
        require(domainExists[_domainHash], "Domain does not exist");
        require(!domains[_domainHash].isTLD, "TLDs cannot be renewed");

        domains[_domainHash].expiry += _duration;
        emit DomainRenewed(_domainHash, domains[_domainHash].expiry);
    }

    /**
     * @dev Approve or revoke a contract's ability to call registerDomainFor
     * / renewDomainFor (only owner)
     */
    function setAuthorizedRegistrar(address _registrar, bool _authorized) external onlyOwner {
        authorizedRegistrars[_registrar] = _authorized;
        emit AuthorizedRegistrarUpdated(_registrar, _authorized);
    }

    /**
     * @dev Get domain information
     * @param _domainHash The domain hash
     * @return Domain struct
     */
    function getDomain(bytes32 _domainHash) external view returns (Domain memory) {
        require(domainExists[_domainHash], "Domain does not exist");
        return domains[_domainHash];
    }

    /**
     * @dev Get domains owned by an address
     * @param _owner The owner address
     * @return Array of domain hashes
     */
    function getOwnerDomains(address _owner) external view returns (bytes32[] memory) {
        return ownerDomains[_owner];
    }

    /**
     * @dev Get subdomains of a parent domain
     * @param _parentHash The parent domain hash
     * @return Array of subdomain hashes
     */
    function getSubdomains(bytes32 _parentHash) external view returns (bytes32[] memory) {
        return subdomains[_parentHash];
    }

    /**
     * @dev Update pricing (only owner)
     */
    function updatePricing(uint256 _baseDomainPrice, uint256 _baseSubdomainPrice, uint256 _baseTLDPrice)
        external
        onlyOwner
    {
        baseDomainPrice = _baseDomainPrice;
        baseSubdomainPrice = _baseSubdomainPrice;
        baseTLDPrice = _baseTLDPrice;

        emit PriceUpdated("domain", _baseDomainPrice);
        emit PriceUpdated("subdomain", _baseSubdomainPrice);
        emit PriceUpdated("tld", _baseTLDPrice);
    }

    /**
     * @dev Update commit-reveal timing windows (only owner)
     */
    function setCommitmentAges(uint256 _minAge, uint256 _maxAge) external onlyOwner {
        require(_minAge < _maxAge, "Invalid commitment age range");
        minCommitmentAge = _minAge;
        maxCommitmentAge = _maxAge;
    }

    /**
     * @dev Update TLD registrar (only owner)
     */
    function updateTLDRegistrar(address _newRegistrar) external onlyOwner {
        tldRegistrar = _newRegistrar;
    }

    /**
     * @dev Withdraw contract balance (only owner)
     */
    function withdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No funds to withdraw");

        (bool success, ) = payable(owner()).call{value: balance}("");
        require(success, "Withdrawal failed");
    }

    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC721URIStorage) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
