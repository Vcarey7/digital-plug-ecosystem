// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title GPlugConverter
 * @author Digital Plug Co. — Digital Black Wall Street
 * @notice Locks $PLUG to mint non-transferable $GPLUG governance power.
 *         Longer locks earn a higher conversion multiplier. Unlocking burns
 *         the GPLUG and returns the PLUG.
 *
 * Lock terms      Multiplier
 *  30 days         1.0×
 *  90 days         1.25×
 *  180 days        1.6×
 *  365 days        2.5×
 */
interface IGPlugMintable {
    function mint(address to, uint256 amount) external;
    function burnFrom(address from, uint256 amount) external;
}

contract GPlugConverter is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum Lock { D30, D90, D180, D365 }

    struct Position {
        uint256 plugLocked;
        uint256 gplugMinted;
        uint64 unlockAt;
        bool withdrawn;
    }

    IERC20 public immutable plug;
    IGPlugMintable public immutable gplug;

    mapping(Lock => uint64) public lockDuration;
    mapping(Lock => uint256) public multiplierBps;
    mapping(address => Position[]) public positions;

    event Locked(address indexed user, uint256 indexed index, uint256 plugAmount, uint256 gplugMinted, uint64 unlockAt);
    event Unlocked(address indexed user, uint256 indexed index, uint256 plugReturned);

    error StillLocked();
    error AlreadyWithdrawn();

    constructor(address plugAddress, address gplugAddress, address admin) {
        plug = IERC20(plugAddress);
        gplug = IGPlugMintable(gplugAddress);
        _grantRole(DEFAULT_ADMIN_ROLE, admin);

        lockDuration[Lock.D30] = 30 days;
        lockDuration[Lock.D90] = 90 days;
        lockDuration[Lock.D180] = 180 days;
        lockDuration[Lock.D365] = 365 days;

        multiplierBps[Lock.D30] = 10_000;
        multiplierBps[Lock.D90] = 12_500;
        multiplierBps[Lock.D180] = 16_000;
        multiplierBps[Lock.D365] = 25_000;
    }

    function lock(uint256 amount, Lock term) external nonReentrant returns (uint256 index) {
        plug.safeTransferFrom(msg.sender, address(this), amount);
        uint256 gAmount = (amount * multiplierBps[term]) / 10_000;
        uint64 unlockAt = uint64(block.timestamp) + lockDuration[term];
        positions[msg.sender].push(Position(amount, gAmount, unlockAt, false));
        gplug.mint(msg.sender, gAmount);
        index = positions[msg.sender].length - 1;
        emit Locked(msg.sender, index, amount, gAmount, unlockAt);
    }

    function unlock(uint256 index) external nonReentrant {
        Position storage p = positions[msg.sender][index];
        if (p.withdrawn) revert AlreadyWithdrawn();
        if (block.timestamp < p.unlockAt) revert StillLocked();
        p.withdrawn = true;
        gplug.burnFrom(msg.sender, p.gplugMinted);
        plug.safeTransfer(msg.sender, p.plugLocked);
        emit Unlocked(msg.sender, index, p.plugLocked);
    }

    function positionCount(address user) external view returns (uint256) {
        return positions[user].length;
    }

    function setMultiplier(Lock term, uint256 bps) external onlyRole(DEFAULT_ADMIN_ROLE) {
        multiplierBps[term] = bps;
    }
}
