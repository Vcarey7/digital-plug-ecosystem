// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title LicenseRegistry — Registry 5 of the DBWS Registry Suite
 * @author Digital Plug Co. — Digital Black Wall Street
 * @notice Cannabis license tracking + verification as ERC-721. Records
 *         state-issued license data, logs compliance events, flags upcoming
 *         renewals (called weekly by n8n), and is $DPNOTE-lendable.
 *         Registration fee paid in USDC (switchable to $PLUG later).
 */
contract LicenseRegistry is ERC721, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum LicenseType {
        ADULT_USE_RETAIL, MEDICAL_DISPENSARY, DELIVERY, CULTIVATION_INDOOR,
        CULTIVATION_OUTDOOR, MANUFACTURING, DISTRIBUTION, LABORATORY, LOUNGE, OTHER
    }
    enum LicenseStatus { ACTIVE, PENDING_RENEWAL, SUSPENDED, REVOKED, TRANSFERRED, EXPIRED }

    struct CannabisLicense {
        string licenseNumber;
        string stateCode;
        LicenseType licenseType;
        string businessName;
        string businessAddress;
        address registeredOwner;
        uint256 issueDate;
        uint256 expirationDate;
        uint256 registrationDate;
        LicenseStatus status;
        bool lendable;
        uint256 linkedNoteId;
        uint256 estimatedValue;   // USD cents
        string[] complianceEvents;
        string metadataURI;
    }

    mapping(uint256 => CannabisLicense) public licenses;
    mapping(string => uint256) public licenseNumberToTokenId;
    mapping(address => uint256[]) public operatorLicenses;

    uint256 public nextTokenId = 1;
    uint256 public registrationFee = 197e6; // USDC, 6 decimals
    address public revenueRouter;
    IERC20 public paymentToken;              // USDC now, $PLUG later

    event LicenseRegistered(uint256 indexed tokenId, string licenseNumber, string stateCode, address indexed operator, uint256 expirationDate);
    event ComplianceEventLogged(uint256 indexed tokenId, string eventHash, uint256 timestamp);
    event RenewalAlert(uint256 indexed tokenId, string licenseNumber, uint256 expirationDate, uint256 daysRemaining);
    event LicenseStatusChanged(uint256 indexed tokenId, LicenseStatus oldStatus, LicenseStatus newStatus);
    event PaymentTokenSet(address indexed token);

    error AlreadyRegistered();
    error NotLicenseOwner();

    constructor(address _revenueRouter, address _usdc, address admin)
        ERC721("DBWS License Registry", "DBWS-LICENSE")
        Ownable(admin)
    {
        revenueRouter = _revenueRouter;
        paymentToken = IERC20(_usdc);
    }

    function registerLicense(
        string calldata _licenseNumber,
        string calldata _stateCode,
        LicenseType _licenseType,
        string calldata _businessName,
        string calldata _businessAddress,
        uint256 _issueDate,
        uint256 _expirationDate,
        string calldata _metadataURI
    ) external nonReentrant returns (uint256 tokenId) {
        if (licenseNumberToTokenId[_licenseNumber] != 0) revert AlreadyRegistered();

        tokenId = nextTokenId++;
        CannabisLicense storage l = licenses[tokenId];
        l.licenseNumber = _licenseNumber;
        l.stateCode = _stateCode;
        l.licenseType = _licenseType;
        l.businessName = _businessName;
        l.businessAddress = _businessAddress;
        l.registeredOwner = msg.sender;
        l.issueDate = _issueDate;
        l.expirationDate = _expirationDate;
        l.registrationDate = block.timestamp;
        l.status = LicenseStatus.ACTIVE;
        l.lendable = true;
        l.metadataURI = _metadataURI;

        licenseNumberToTokenId[_licenseNumber] = tokenId;
        operatorLicenses[msg.sender].push(tokenId);
        _safeMint(msg.sender, tokenId);
        _collect(registrationFee);

        emit LicenseRegistered(tokenId, _licenseNumber, _stateCode, msg.sender, _expirationDate);
    }

    function logComplianceEvent(uint256 tokenId, string calldata eventHash) external {
        if (licenses[tokenId].registeredOwner != msg.sender) revert NotLicenseOwner();
        licenses[tokenId].complianceEvents.push(eventHash);
        emit ComplianceEventLogged(tokenId, eventHash, block.timestamp);
    }

    function setStatus(uint256 tokenId, LicenseStatus newStatus) external onlyOwner {
        LicenseStatus old = licenses[tokenId].status;
        licenses[tokenId].status = newStatus;
        emit LicenseStatusChanged(tokenId, old, newStatus);
    }

    function updateValuation(uint256 tokenId, uint256 usdCents) external onlyOwner {
        licenses[tokenId].estimatedValue = usdCents;
    }

    /// @notice Paginated renewal scan — n8n passes [fromId, toId) each week to
    ///         keep gas bounded. Emits RenewalAlert for anything ≤90 days out.
    function checkRenewalAlerts(uint256 fromId, uint256 toId) external onlyOwner {
        if (toId > nextTokenId) toId = nextTokenId;
        for (uint256 i = fromId; i < toId; i++) {
            CannabisLicense storage l = licenses[i];
            if (l.status == LicenseStatus.ACTIVE && l.expirationDate > block.timestamp) {
                uint256 daysRemaining = (l.expirationDate - block.timestamp) / 1 days;
                if (daysRemaining <= 90) {
                    emit RenewalAlert(i, l.licenseNumber, l.expirationDate, daysRemaining);
                }
            }
        }
    }

    function getComplianceEvents(uint256 tokenId) external view returns (string[] memory) {
        return licenses[tokenId].complianceEvents;
    }

    function getOperatorLicenses(address op) external view returns (uint256[] memory) {
        return operatorLicenses[op];
    }

    function setRegistrationFee(uint256 fee) external onlyOwner {
        registrationFee = fee;
    }

    function setRevenueRouter(address r) external onlyOwner {
        revenueRouter = r;
    }

    function setPaymentToken(address t) external onlyOwner {
        paymentToken = IERC20(t);
        emit PaymentTokenSet(t);
    }

    function _collect(uint256 amount) internal {
        if (amount > 0) paymentToken.safeTransferFrom(msg.sender, revenueRouter, amount);
    }

    function _update(address to, uint256 tokenId, address auth)
        internal
        override
        returns (address)
    {
        if (to != address(0) && _ownerOf(tokenId) != address(0)) {
            licenses[tokenId].registeredOwner = to;
        }
        return super._update(to, tokenId, auth);
    }
}
