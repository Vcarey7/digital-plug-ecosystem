// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title DataVault
 * @author Digital Plug Co. — Digital Black Wall Street
 * @notice Users contribute data (referenced by content hash) and are paid
 *         in USDC when a licensee buys access. A protocol cut is split
 *         between the forge vault and a burn of $PLUG (deflationary sink).
 */
interface IDPABurnable {
    function burn(address from, uint256 assetId, uint256 amount) external;
}

contract DataVault is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant CURATOR_ROLE = keccak256("CURATOR_ROLE");

    struct Dataset {
        address contributor;
        bytes32 contentHash;
        uint256 pricePerLicense; // USDC 6d
        uint256 licensesSold;
        bool active;
    }

    IERC20 public immutable usdc;
    IERC20 public immutable plug;
    address public forgeVault;
    address public constant BURN = 0x000000000000000000000000000000000000dEaD;

    uint256 public protocolBps = 2_000;    // 20% of each sale
    uint256 public burnBpsOfProtocol = 5_000; // half of protocol cut is spent buying+burning is handled off-chain; here we route PLUG the licensee attaches

    uint256 public nextDatasetId = 1;
    mapping(uint256 => Dataset) public datasets;
    // datasetId => licensee => has license
    mapping(uint256 => mapping(address => bool)) public hasLicense;

    event DatasetListed(uint256 indexed id, address contributor, bytes32 contentHash, uint256 price);
    event LicensePurchased(uint256 indexed id, address indexed licensee, uint256 price);
    event DatasetDelisted(uint256 indexed id);

    error Inactive();
    error AlreadyLicensed();

    constructor(
        address usdcAddress,
        address plugAddress,
        address forgeVaultAddress,
        address admin
    ) {
        usdc = IERC20(usdcAddress);
        plug = IERC20(plugAddress);
        forgeVault = forgeVaultAddress;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(CURATOR_ROLE, admin);
    }

    function listDataset(bytes32 contentHash, uint256 pricePerLicense)
        external
        returns (uint256 id)
    {
        id = nextDatasetId++;
        datasets[id] = Dataset(msg.sender, contentHash, pricePerLicense, 0, true);
        emit DatasetListed(id, msg.sender, contentHash, pricePerLicense);
    }

    function purchaseLicense(uint256 id) external nonReentrant {
        Dataset storage d = datasets[id];
        if (!d.active) revert Inactive();
        if (hasLicense[id][msg.sender]) revert AlreadyLicensed();

        uint256 price = d.pricePerLicense;
        uint256 protocolCut = (price * protocolBps) / 10_000;
        uint256 contributorCut = price - protocolCut;

        usdc.safeTransferFrom(msg.sender, d.contributor, contributorCut);
        usdc.safeTransferFrom(msg.sender, forgeVault, protocolCut);

        hasLicense[id][msg.sender] = true;
        d.licensesSold += 1;
        emit LicensePurchased(id, msg.sender, price);
    }

    function delist(uint256 id) external {
        Dataset storage d = datasets[id];
        require(d.contributor == msg.sender || hasRole(CURATOR_ROLE, msg.sender), "AUTH");
        d.active = false;
        emit DatasetDelisted(id);
    }

    function setProtocolBps(uint256 bps) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(bps <= 5_000, "MAX 50%");
        protocolBps = bps;
    }
}

/**
 * @title WhiteLabelLicense
 * @notice Sells white-label deployment licenses for the DBWS stack. Four
 *         plans; each license is time-boxed and carries a seat count.
 */
contract WhiteLabelLicense is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum Plan { STARTER, GROWTH, ENTERPRISE, SOVEREIGN }

    struct License {
        Plan plan;
        uint64 expiresAt;
        uint32 seats;
        bool active;
    }

    IERC20 public immutable usdc;
    address public treasury;

    mapping(Plan => uint256) public annualPrice; // USDC 6d
    mapping(Plan => uint32) public planSeats;
    mapping(address => License) public licenses;

    event Licensed(address indexed org, Plan plan, uint64 expiresAt, uint32 seats);
    event Renewed(address indexed org, uint64 newExpiry);
    event Revoked(address indexed org);

    error PlanPriceZero();

    constructor(address usdcAddress, address treasuryAddress, address admin) {
        usdc = IERC20(usdcAddress);
        treasury = treasuryAddress;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);

        annualPrice[Plan.STARTER] = 2_500e6;
        annualPrice[Plan.GROWTH] = 10_000e6;
        annualPrice[Plan.ENTERPRISE] = 40_000e6;
        annualPrice[Plan.SOVEREIGN] = 150_000e6;

        planSeats[Plan.STARTER] = 3;
        planSeats[Plan.GROWTH] = 15;
        planSeats[Plan.ENTERPRISE] = 75;
        planSeats[Plan.SOVEREIGN] = 1_000;
    }

    function purchase(Plan plan) external nonReentrant {
        uint256 price = annualPrice[plan];
        if (price == 0) revert PlanPriceZero();
        usdc.safeTransferFrom(msg.sender, treasury, price);
        uint64 expiry = uint64(block.timestamp) + 365 days;
        licenses[msg.sender] = License(plan, expiry, planSeats[plan], true);
        emit Licensed(msg.sender, plan, expiry, planSeats[plan]);
    }

    function renew() external nonReentrant {
        License storage l = licenses[msg.sender];
        uint256 price = annualPrice[l.plan];
        usdc.safeTransferFrom(msg.sender, treasury, price);
        uint64 base = l.expiresAt > block.timestamp ? l.expiresAt : uint64(block.timestamp);
        l.expiresAt = base + 365 days;
        emit Renewed(msg.sender, l.expiresAt);
    }

    function isActive(address org) external view returns (bool) {
        License storage l = licenses[org];
        return l.active && block.timestamp <= l.expiresAt;
    }

    function setPrice(Plan plan, uint256 price, uint32 seats)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        annualPrice[plan] = price;
        planSeats[plan] = seats;
    }

    function revoke(address org) external onlyRole(DEFAULT_ADMIN_ROLE) {
        licenses[org].active = false;
        emit Revoked(org);
    }
}

/**
 * @title CompoundForge
 * @notice Lets holders combine (burn) lower DPA assets to forge a higher one,
 *         paying a $PLUG catalyst fee. Recipes are admin-defined.
 */
contract CompoundForge is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Recipe {
        uint256[] inputIds;
        uint256[] inputAmounts;
        uint256 outputId;
        uint256 outputAmount;
        uint256 plugFee;
        bool active;
    }

    IERC20 public immutable plug;
    IDPACompound public immutable dpa;
    address public constant BURN = 0x000000000000000000000000000000000000dEaD;

    uint256 public nextRecipeId = 1;
    mapping(uint256 => Recipe) public recipes;

    event RecipeCreated(uint256 indexed id, uint256 outputId, uint256 outputAmount);
    event Compounded(address indexed user, uint256 indexed recipeId);

    error RecipeInactive();
    error LengthMismatch();

    constructor(address plugAddress, address dpaAddress, address admin) {
        plug = IERC20(plugAddress);
        dpa = IDPACompound(dpaAddress);
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    function createRecipe(
        uint256[] calldata inputIds,
        uint256[] calldata inputAmounts,
        uint256 outputId,
        uint256 outputAmount,
        uint256 plugFee
    ) external onlyRole(DEFAULT_ADMIN_ROLE) returns (uint256 id) {
        if (inputIds.length != inputAmounts.length) revert LengthMismatch();
        id = nextRecipeId++;
        recipes[id] = Recipe(inputIds, inputAmounts, outputId, outputAmount, plugFee, true);
        emit RecipeCreated(id, outputId, outputAmount);
    }

    function compound(uint256 recipeId) external nonReentrant {
        Recipe storage r = recipes[recipeId];
        if (!r.active) revert RecipeInactive();
        if (r.plugFee > 0) plug.safeTransferFrom(msg.sender, BURN, r.plugFee);
        for (uint256 i = 0; i < r.inputIds.length; i++) {
            dpa.burn(msg.sender, r.inputIds[i], r.inputAmounts[i]);
        }
        dpa.mint(msg.sender, r.outputId, r.outputAmount);
        emit Compounded(msg.sender, recipeId);
    }

    function setRecipeActive(uint256 recipeId, bool active)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        recipes[recipeId].active = active;
    }
}

interface IDPACompound {
    function mint(address to, uint256 assetId, uint256 amount) external;
    function burn(address from, uint256 assetId, uint256 amount) external;
}
