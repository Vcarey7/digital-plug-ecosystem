// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title RWAVault
 * @author Digital Plug Co. — Digital Black Wall Street
 * @notice Tokenizes real-world assets (real estate, equipment, IP) into
 *         fractional ERC-1155 shares and distributes USDC revenue pro-rata
 *         to shareholders via a claimable accumulator. Transfers gated by a
 *         KYC allowlist per compliance requirements.
 *
 * WAVE 2 — HOLD FOR LEGAL REVIEW. Fractional revenue-share tokens over a
 * real-world asset pool are a securities offering; the built-in KYC gate
 * is a good sign but doesn't substitute for actual registration/exemption
 * review. Do not deploy or market until a securities attorney has cleared
 * it.
 */
contract RWAVault is ERC1155, ERC1155Supply, AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");
    bytes32 public constant COMPLIANCE_ROLE = keccak256("COMPLIANCE_ROLE");

    struct Asset {
        string metadataURI;   // legal docs, appraisal, deed hash
        uint256 totalShares;
        uint256 revPerShareAcc; // accumulated USDC revenue per share (scaled 1e12)
        bool active;
    }

    IERC20 public immutable usdc;
    uint256 public constant ACC_SCALE = 1e12;

    uint256 public nextAssetId = 1;
    mapping(uint256 => Asset) public assets;
    mapping(address => bool) public kycApproved;
    // assetId => holder => revPerShare already accounted
    mapping(uint256 => mapping(address => uint256)) public rewardDebt;
    // assetId => holder => claimable USDC
    mapping(uint256 => mapping(address => uint256)) public claimable;

    event AssetTokenized(uint256 indexed assetId, string uri, uint256 totalShares, address indexed issuer);
    event RevenueDistributed(uint256 indexed assetId, uint256 amount);
    event RevenueClaimed(uint256 indexed assetId, address indexed holder, uint256 amount);
    event KYCSet(address indexed account, bool approved);

    error NotKYC();
    error AssetInactive();

    constructor(address usdcAddress, string memory baseUri, address admin) ERC1155(baseUri) {
        usdc = IERC20(usdcAddress);
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ISSUER_ROLE, admin);
        _grantRole(COMPLIANCE_ROLE, admin);
    }

    // ─── Issuance ─────────────────────────────────────────────────────────────

    function tokenize(
        address to,
        string calldata metadataURI,
        uint256 totalShares
    ) external onlyRole(ISSUER_ROLE) returns (uint256 assetId) {
        if (!kycApproved[to]) revert NotKYC();
        assetId = nextAssetId++;
        assets[assetId] = Asset(metadataURI, totalShares, 0, true);
        _mint(to, assetId, totalShares, "");
        emit AssetTokenized(assetId, metadataURI, totalShares, to);
    }

    // ─── Revenue distribution ─────────────────────────────────────────────────

    function distributeRevenue(uint256 assetId, uint256 amount)
        external
        nonReentrant
    {
        Asset storage a = assets[assetId];
        if (!a.active) revert AssetInactive();
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        a.revPerShareAcc += (amount * ACC_SCALE) / a.totalShares;
        emit RevenueDistributed(assetId, amount);
    }

    function _harvest(uint256 assetId, address holder) internal {
        uint256 shares = balanceOf(holder, assetId);
        uint256 acc = assets[assetId].revPerShareAcc;
        uint256 owed = (shares * acc) / ACC_SCALE - rewardDebt[assetId][holder];
        if (owed > 0) claimable[assetId][holder] += owed;
        rewardDebt[assetId][holder] = (shares * acc) / ACC_SCALE;
    }

    function claim(uint256 assetId) external nonReentrant {
        _harvest(assetId, msg.sender);
        uint256 amount = claimable[assetId][msg.sender];
        claimable[assetId][msg.sender] = 0;
        usdc.safeTransfer(msg.sender, amount);
        emit RevenueClaimed(assetId, msg.sender, amount);
    }

    function pendingRevenue(uint256 assetId, address holder) external view returns (uint256) {
        uint256 shares = balanceOf(holder, assetId);
        uint256 acc = assets[assetId].revPerShareAcc;
        uint256 owed = (shares * acc) / ACC_SCALE - rewardDebt[assetId][holder];
        return claimable[assetId][holder] + owed;
    }

    // ─── Compliance ───────────────────────────────────────────────────────────

    function setKYC(address account, bool approved) external onlyRole(COMPLIANCE_ROLE) {
        kycApproved[account] = approved;
        emit KYCSet(account, approved);
    }

    function setAssetActive(uint256 assetId, bool active) external onlyRole(ISSUER_ROLE) {
        assets[assetId].active = active;
    }

    // ─── Overrides: enforce KYC + harvest on transfer ─────────────────────────

    function _update(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory values
    ) internal override(ERC1155, ERC1155Supply) {
        if (from != address(0) && to != address(0)) {
            if (!kycApproved[to]) revert NotKYC();
            for (uint256 i = 0; i < ids.length; i++) {
                _harvest(ids[i], from);
                _harvest(ids[i], to);
            }
        }
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
