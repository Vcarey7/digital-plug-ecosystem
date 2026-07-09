// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./DomainRegistry.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title BatchMinting
 * @dev Contract for batch minting multiple domains and subdomains in a single transaction.
 * Optimizes gas costs and improves user experience for bulk operations.
 *
 * Must be granted DomainRegistry.setAuthorizedRegistrar(address(this), true) by the
 * registry owner. Batch domain registration goes through registry.registerDomainFor
 * rather than the public registerDomain: since this contract is the immediate caller
 * of the registry, msg.sender there would be BatchMinting's own address rather than
 * the buyer's, so the public commit-reveal path (which mints to and validates against
 * msg.sender) can't be used safely here -- registerDomainFor takes an explicit buyer
 * address instead. Being restricted to authorized registrars keeps this from
 * reopening the front-running gap commit-reveal exists to close (see DomainRegistry's
 * registerDomainFor for the full rationale). Collected native-currency payment stays
 * in this contract's balance until swept via emergencyWithdraw.
 */
contract BatchMinting is ReentrancyGuard, Ownable {
    DomainRegistry public immutable registry;

    // Batch operation limits to prevent gas limit issues
    uint256 public maxBatchSize = 50;

    // Discount rates for batch operations (basis points, e.g., 500 = 5%)
    uint256 public batchDiscountRate = 500; // 5% discount for batch operations
    uint256 public constant BASIS_POINTS = 10000;

    // Events
    event BatchDomainRegistration(address indexed user, uint256 count, uint256 totalCost);
    event BatchSubdomainRegistration(address indexed user, uint256 count, uint256 totalCost);
    event BatchSizeUpdated(uint256 newMaxBatchSize);
    event DiscountRateUpdated(uint256 newDiscountRate);

    struct DomainRegistrationData {
        string tld;
        string domain;
        uint256 duration;
        address resolver;
        string metadataURI;
    }

    struct SubdomainRegistrationData {
        string parentDomain;
        string subdomain;
        address owner;
        uint256 duration;
        address resolver;
        string metadataURI;
    }

    constructor(address _registry) Ownable(msg.sender) {
        registry = DomainRegistry(_registry);
    }

    /**
     * @dev Batch register multiple domains under existing TLDs, minted
     * straight to the caller.
     * @param _domains Array of domain registration data
     */
    function batchRegisterDomains(DomainRegistrationData[] memory _domains)
        external
        payable
        nonReentrant
    {
        require(_domains.length > 0, "No domains to register");
        require(_domains.length <= maxBatchSize, "Batch size exceeds limit");

        uint256 baseDomainPrice = registry.baseDomainPrice();
        uint256 totalCost = calculateBatchDomainCost(_domains.length, baseDomainPrice);
        require(msg.value >= totalCost, "Insufficient payment for batch registration");

        address buyer = msg.sender;

        // Register each domain
        for (uint256 i = 0; i < _domains.length; i++) {
            DomainRegistrationData memory domainData = _domains[i];

            registry.registerDomainFor(
                domainData.tld,
                domainData.domain,
                buyer,
                domainData.duration,
                domainData.resolver,
                domainData.metadataURI
            );
        }

        // Refund excess payment
        uint256 excess = msg.value - totalCost;
        if (excess > 0) {
            (bool success, ) = payable(buyer).call{value: excess}("");
            require(success, "Refund failed");
        }

        emit BatchDomainRegistration(buyer, _domains.length, totalCost);
    }

    /**
     * @dev Batch register multiple subdomains under existing domains
     * @param _subdomains Array of subdomain registration data
     */
    function batchRegisterSubdomains(SubdomainRegistrationData[] memory _subdomains)
        external
        payable
        nonReentrant
    {
        require(_subdomains.length > 0, "No subdomains to register");
        require(_subdomains.length <= maxBatchSize, "Batch size exceeds limit");

        uint256 baseSubdomainPrice = registry.baseSubdomainPrice();
        uint256 totalCost = calculateBatchSubdomainCost(_subdomains.length, baseSubdomainPrice);
        require(msg.value >= totalCost, "Insufficient payment for batch registration");

        address buyer = msg.sender;

        // Register each subdomain
        for (uint256 i = 0; i < _subdomains.length; i++) {
            SubdomainRegistrationData memory subdomainData = _subdomains[i];

            registry.registerSubdomainFor(
                subdomainData.parentDomain,
                subdomainData.subdomain,
                subdomainData.owner,
                subdomainData.duration,
                subdomainData.resolver,
                subdomainData.metadataURI,
                buyer
            );
        }

        // Refund excess payment
        uint256 excess = msg.value - totalCost;
        if (excess > 0) {
            (bool success, ) = payable(buyer).call{value: excess}("");
            require(success, "Refund failed");
        }

        emit BatchSubdomainRegistration(buyer, _subdomains.length, totalCost);
    }

    /**
     * @dev Batch register mixed domains and subdomains
     * @param _domains Array of domain registration data
     * @param _subdomains Array of subdomain registration data
     */
    function batchRegisterMixed(
        DomainRegistrationData[] memory _domains,
        SubdomainRegistrationData[] memory _subdomains
    )
        external
        payable
        nonReentrant
    {
        uint256 totalItems = _domains.length + _subdomains.length;
        require(totalItems > 0, "No items to register");
        require(totalItems <= maxBatchSize, "Batch size exceeds limit");

        uint256 baseDomainPrice = registry.baseDomainPrice();
        uint256 baseSubdomainPrice = registry.baseSubdomainPrice();

        uint256 domainCost = calculateBatchDomainCost(_domains.length, baseDomainPrice);
        uint256 subdomainCost = calculateBatchSubdomainCost(_subdomains.length, baseSubdomainPrice);
        uint256 totalCost = domainCost + subdomainCost;

        require(msg.value >= totalCost, "Insufficient payment for batch registration");

        address buyer = msg.sender;

        // Register domains
        for (uint256 i = 0; i < _domains.length; i++) {
            DomainRegistrationData memory domainData = _domains[i];
            registry.registerDomainFor(
                domainData.tld,
                domainData.domain,
                buyer,
                domainData.duration,
                domainData.resolver,
                domainData.metadataURI
            );
        }

        // Register subdomains
        for (uint256 i = 0; i < _subdomains.length; i++) {
            SubdomainRegistrationData memory subdomainData = _subdomains[i];
            registry.registerSubdomainFor(
                subdomainData.parentDomain,
                subdomainData.subdomain,
                subdomainData.owner,
                subdomainData.duration,
                subdomainData.resolver,
                subdomainData.metadataURI,
                buyer
            );
        }

        // Refund excess payment
        uint256 excess = msg.value - totalCost;
        if (excess > 0) {
            (bool success, ) = payable(buyer).call{value: excess}("");
            require(success, "Refund failed");
        }

        emit BatchDomainRegistration(buyer, _domains.length, domainCost);
        emit BatchSubdomainRegistration(buyer, _subdomains.length, subdomainCost);
    }

    /**
     * @dev Calculate total cost for batch domain registration with discount
     * @param _count Number of domains
     * @param _basePrice Base price per domain
     * @return Total cost with discount applied
     */
    function calculateBatchDomainCost(uint256 _count, uint256 _basePrice)
        public
        view
        returns (uint256)
    {
        if (_count == 0) return 0;
        if (_count == 1) return _basePrice;

        uint256 totalCost = _count * _basePrice;
        uint256 discount = (totalCost * batchDiscountRate) / BASIS_POINTS;
        return totalCost - discount;
    }

    /**
     * @dev Calculate total cost for batch subdomain registration with discount
     * @param _count Number of subdomains
     * @param _basePrice Base price per subdomain
     * @return Total cost with discount applied
     */
    function calculateBatchSubdomainCost(uint256 _count, uint256 _basePrice)
        public
        view
        returns (uint256)
    {
        if (_count == 0) return 0;
        if (_count == 1) return _basePrice;

        uint256 totalCost = _count * _basePrice;
        uint256 discount = (totalCost * batchDiscountRate) / BASIS_POINTS;
        return totalCost - discount;
    }

    /**
     * @dev Get pricing information for batch operations
     * @param _domainCount Number of domains
     * @param _subdomainCount Number of subdomains
     * @return domainCost Total cost for domains
     * @return subdomainCost Total cost for subdomains
     * @return totalCost Combined total cost
     * @return savings Total savings from batch discount
     */
    function getBatchPricing(uint256 _domainCount, uint256 _subdomainCount)
        external
        view
        returns (
            uint256 domainCost,
            uint256 subdomainCost,
            uint256 totalCost,
            uint256 savings
        )
    {
        uint256 baseDomainPrice = registry.baseDomainPrice();
        uint256 baseSubdomainPrice = registry.baseSubdomainPrice();

        domainCost = calculateBatchDomainCost(_domainCount, baseDomainPrice);
        subdomainCost = calculateBatchSubdomainCost(_subdomainCount, baseSubdomainPrice);
        totalCost = domainCost + subdomainCost;

        uint256 regularCost = (_domainCount * baseDomainPrice) + (_subdomainCount * baseSubdomainPrice);
        savings = regularCost > totalCost ? regularCost - totalCost : 0;
    }

    /**
     * @dev Update maximum batch size (only owner)
     * @param _newMaxBatchSize New maximum batch size
     */
    function updateMaxBatchSize(uint256 _newMaxBatchSize) external onlyOwner {
        require(_newMaxBatchSize > 0, "Batch size must be greater than 0");
        require(_newMaxBatchSize <= 100, "Batch size too large");

        maxBatchSize = _newMaxBatchSize;
        emit BatchSizeUpdated(_newMaxBatchSize);
    }

    /**
     * @dev Update batch discount rate (only owner)
     * @param _newDiscountRate New discount rate in basis points
     */
    function updateDiscountRate(uint256 _newDiscountRate) external onlyOwner {
        require(_newDiscountRate <= 2000, "Discount rate too high"); // Max 20%

        batchDiscountRate = _newDiscountRate;
        emit DiscountRateUpdated(_newDiscountRate);
    }

    /**
     * @dev Emergency function to withdraw any stuck ETH (only owner)
     */
    function emergencyWithdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No funds to withdraw");

        (bool success, ) = payable(owner()).call{value: balance}("");
        require(success, "Withdrawal failed");
    }

    /**
     * @dev Check if batch operation is within limits
     * @param _count Number of items in batch
     * @return True if within limits
     */
    function isValidBatchSize(uint256 _count) external view returns (bool) {
        return _count > 0 && _count <= maxBatchSize;
    }
}
