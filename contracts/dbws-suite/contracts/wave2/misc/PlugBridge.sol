// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title PlugBridge
 * @author Digital Plug Co. — Digital Black Wall Street
 * @notice Lock-and-mint style bridge escrow for moving $PLUG to other chains.
 *         Users lock PLUG with a destination chainId + recipient; a trusted
 *         relayer emits proof off-chain and releases on the destination. This
 *         side handles lock/unlock with relayer attestation + nonce replay
 *         protection.
 *
 * WAVE 2 — HOLD FOR LEGAL REVIEW. Not a Howey issue, but custodying user
 * funds and moving them across chains via a trusted relayer can implicate
 * money-transmission licensing depending on jurisdiction. Different lane
 * from securities review — confirm before mainnet.
 */
contract PlugBridge is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant RELAYER_ROLE = keccak256("RELAYER_ROLE");

    IERC20 public immutable plug;
    uint256 public nonce;
    mapping(bytes32 => bool) public processed; // inbound message ids

    event Locked(uint256 indexed nonce, address indexed from, uint256 destChainId, bytes recipient, uint256 amount);
    event Unlocked(bytes32 indexed messageId, address indexed to, uint256 amount);

    error AlreadyProcessed();

    constructor(address plugAddress, address admin) {
        plug = IERC20(plugAddress);
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(RELAYER_ROLE, admin);
    }

    function lock(uint256 destChainId, bytes calldata recipient, uint256 amount)
        external
        nonReentrant
    {
        plug.safeTransferFrom(msg.sender, address(this), amount);
        emit Locked(nonce, msg.sender, destChainId, recipient, amount);
        nonce++;
    }

    /// @notice Relayer releases locked funds for a verified inbound message.
    function unlock(bytes32 messageId, address to, uint256 amount)
        external
        onlyRole(RELAYER_ROLE)
        nonReentrant
    {
        if (processed[messageId]) revert AlreadyProcessed();
        processed[messageId] = true;
        plug.safeTransfer(to, amount);
        emit Unlocked(messageId, to, amount);
    }
}
