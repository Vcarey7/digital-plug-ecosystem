// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title CommunityRegistry — Registry 6 of the DBWS Registry Suite
 * @author Digital Plug Co. — Digital Black Wall Street
 * @notice On-chain identity for every DBWS member. Four tiers, The Orders
 *         affiliation, contribution/reputation scoring, and $WALL voting
 *         weight. Founding Member tokens are soulbound (non-transferable).
 *         Tier fees paid in USDC (switchable to $PLUG later).
 *
 *         Sine Macula — Without Stain.
 */
contract CommunityRegistry is ERC721, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum MembershipTier { COMMUNITY_MEMBER, PLUG_MEMBER, THE_ORDERS, FOUNDING_MEMBER }
    enum OrderAffiliation { NONE, ORDER_OF_THE_GENTLEMEN, ORDER_OF_THE_LADIES }

    struct CommunityMember {
        address wallet;
        string displayName;
        MembershipTier tier;
        OrderAffiliation order;
        uint256 joinDate;
        uint256 tierUpgradeDate;
        uint256 contributionScore;
        uint256 reputationScore;
        uint256 votingPower;
        bool active;
        bool soulbound;
        string metadataURI;
        string[] achievements;
    }

    mapping(uint256 => CommunityMember) public members;
    mapping(address => uint256) public walletToTokenId;
    mapping(MembershipTier => uint256) public tierCount;
    mapping(MembershipTier => uint256) public tierFees; // USDC, 6 decimals

    uint256 public nextTokenId = 1;
    uint256 public constant FOUNDING_MEMBER_MAX = 100;
    address public revenueRouter;
    IERC20 public paymentToken;              // USDC now, $PLUG later

    event MemberJoined(uint256 indexed tokenId, address indexed wallet, MembershipTier tier, uint256 timestamp);
    event TierUpgraded(uint256 indexed tokenId, MembershipTier oldTier, MembershipTier newTier);
    event OrderInitiated(uint256 indexed tokenId, OrderAffiliation order, uint256 timestamp);
    event AchievementEarned(uint256 indexed tokenId, string achievement, uint256 timestamp);
    event PaymentTokenSet(address indexed token);

    error AlreadyRegistered();
    error FoundingFull();
    error NotEligibleForOrder();
    error AlreadyInOrder();
    error Soulbound();

    constructor(address _revenueRouter, address _usdc, address admin)
        ERC721("DBWS Community Registry", "DBWS-COMMUNITY")
        Ownable(admin)
    {
        revenueRouter = _revenueRouter;
        paymentToken = IERC20(_usdc);
        tierFees[MembershipTier.COMMUNITY_MEMBER] = 0;
        tierFees[MembershipTier.PLUG_MEMBER] = 97e6;
        tierFees[MembershipTier.THE_ORDERS] = 497e6;
        tierFees[MembershipTier.FOUNDING_MEMBER] = 1997e6;
    }

    function joinCommunity(
        string calldata _displayName,
        MembershipTier _tier,
        string calldata _metadataURI
    ) external nonReentrant returns (uint256 tokenId) {
        if (walletToTokenId[msg.sender] != 0) revert AlreadyRegistered();
        if (_tier == MembershipTier.FOUNDING_MEMBER
            && tierCount[MembershipTier.FOUNDING_MEMBER] >= FOUNDING_MEMBER_MAX) {
            revert FoundingFull();
        }

        tokenId = nextTokenId++;
        bool isSoulbound = (_tier == MembershipTier.FOUNDING_MEMBER);

        CommunityMember storage m = members[tokenId];
        m.wallet = msg.sender;
        m.displayName = _displayName;
        m.tier = _tier;
        m.order = OrderAffiliation.NONE;
        m.joinDate = block.timestamp;
        m.tierUpgradeDate = block.timestamp;
        m.reputationScore = 100;
        m.votingPower = _getVotingPower(_tier);
        m.active = true;
        m.soulbound = isSoulbound;
        m.metadataURI = _metadataURI;

        walletToTokenId[msg.sender] = tokenId;
        tierCount[_tier]++;
        _safeMint(msg.sender, tokenId);
        _collect(tierFees[_tier]);

        emit MemberJoined(tokenId, msg.sender, _tier, block.timestamp);
    }

    function upgradeTier(MembershipTier _newTier) external nonReentrant {
        uint256 tokenId = walletToTokenId[msg.sender];
        require(tokenId != 0, "NOT_MEMBER");
        CommunityMember storage m = members[tokenId];
        require(uint8(_newTier) > uint8(m.tier), "NOT_UPGRADE");
        uint256 diff = tierFees[_newTier] > tierFees[m.tier]
            ? tierFees[_newTier] - tierFees[m.tier] : 0;
        if (_newTier == MembershipTier.FOUNDING_MEMBER) {
            if (tierCount[MembershipTier.FOUNDING_MEMBER] >= FOUNDING_MEMBER_MAX) revert FoundingFull();
            m.soulbound = true;
        }
        MembershipTier old = m.tier;
        tierCount[old]--;
        tierCount[_newTier]++;
        m.tier = _newTier;
        m.tierUpgradeDate = block.timestamp;
        m.votingPower = _getVotingPower(_newTier);
        _collect(diff);
        emit TierUpgraded(tokenId, old, _newTier);
    }

    function initiateIntoOrder(uint256 tokenId, OrderAffiliation _order) external onlyOwner {
        CommunityMember storage m = members[tokenId];
        if (m.tier < MembershipTier.THE_ORDERS) revert NotEligibleForOrder();
        if (m.order != OrderAffiliation.NONE) revert AlreadyInOrder();
        m.order = _order;
        emit OrderInitiated(tokenId, _order, block.timestamp);
    }

    function awardAchievement(uint256 tokenId, string calldata achievement) external onlyOwner {
        members[tokenId].achievements.push(achievement);
        members[tokenId].contributionScore += 10;
        emit AchievementEarned(tokenId, achievement, block.timestamp);
    }

    function setReputation(uint256 tokenId, uint256 score) external onlyOwner {
        members[tokenId].reputationScore = score;
    }

    function getAchievements(uint256 tokenId) external view returns (string[] memory) {
        return members[tokenId].achievements;
    }

    function votingPowerOf(address wallet) external view returns (uint256) {
        uint256 id = walletToTokenId[wallet];
        return id == 0 ? 0 : members[id].votingPower;
    }

    function _getVotingPower(MembershipTier _tier) internal pure returns (uint256) {
        if (_tier == MembershipTier.THE_ORDERS) return 1;
        if (_tier == MembershipTier.FOUNDING_MEMBER) return 5;
        return 0;
    }

    function setTierFee(MembershipTier tier, uint256 fee) external onlyOwner {
        tierFees[tier] = fee;
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

    // OZ v5: enforce soulbound + keep wallet mapping in sync here.
    function _update(address to, uint256 tokenId, address auth)
        internal
        override
        returns (address)
    {
        address from = _ownerOf(tokenId);
        // Block wallet-to-wallet transfer of soulbound tokens (mint/burn allowed).
        if (from != address(0) && to != address(0) && members[tokenId].soulbound) {
            revert Soulbound();
        }
        if (from != address(0) && to != address(0)) {
            walletToTokenId[from] = 0;
            walletToTokenId[to] = tokenId;
            members[tokenId].wallet = to;
        }
        return super._update(to, tokenId, auth);
    }
}
