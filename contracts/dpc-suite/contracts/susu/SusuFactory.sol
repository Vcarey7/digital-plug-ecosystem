// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./SusuCircle.sol";

/// @title SusuFactory
/// @author Digital Plug LLC
/// @notice Deploys and tracks SusuCircle instances.
///         Charges a small $PLUG creation fee to prevent spam.
contract SusuFactory is Ownable, Pausable {

    // ─── STATE ───────────────────────────────────────────────────────────────
    address   public plugToken;
    address   public feeRecipient;
    uint256   public creationFee = 10 ether; // 10 $PLUG to create a circle

    address[] public allCircles;
    mapping(address => address[]) public organizerCircles;
    mapping(address => bool) public isValidCircle;

    // ─── EVENTS ──────────────────────────────────────────────────────────────
    event CircleDeployed(
        address indexed circle,
        address indexed organizer,
        string  name,
        SusuCircle.PayoutMode mode,
        uint256 maxMembers,
        uint256 contributionAmount
    );
    event CreationFeeUpdated(uint256 newFee);

    constructor(address _plugToken, address _feeRecipient) Ownable(msg.sender) {
        plugToken    = _plugToken;
        feeRecipient = _feeRecipient;
    }

    /// @notice Deploy a new SusuCircle
    function createCircle(
        address                  token,
        uint256                  contributionAmount,
        uint256                  periodDuration,
        uint256                  maxMembers,
        SusuCircle.PayoutMode    payoutMode,
        string calldata          name
    ) external whenNotPaused returns (address) {
        require(maxMembers >= 3 && maxMembers <= 20, "Members: 3-20");
        require(contributionAmount > 0, "Amount required");
        require(periodDuration >= 1 days, "Min 1 day period");

        // Collect creation fee in $PLUG
        if (creationFee > 0) {
            IERC20(plugToken).transferFrom(msg.sender, feeRecipient, creationFee);
        }

        SusuCircle circle = new SusuCircle(
            msg.sender,
            token,
            contributionAmount,
            periodDuration,
            maxMembers,
            payoutMode,
            name,
            feeRecipient
        );

        address circleAddr = address(circle);
        allCircles.push(circleAddr);
        organizerCircles[msg.sender].push(circleAddr);
        isValidCircle[circleAddr] = true;

        emit CircleDeployed(circleAddr, msg.sender, name, payoutMode, maxMembers, contributionAmount);
        return circleAddr;
    }

    function getAllCircles() external view returns (address[] memory) { return allCircles; }
    function getOrganizerCircles(address org) external view returns (address[] memory) { return organizerCircles[org]; }
    function totalCircles() external view returns (uint256) { return allCircles.length; }

    function setCreationFee(uint256 fee) external onlyOwner { creationFee = fee; emit CreationFeeUpdated(fee); }
    function pause()   external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
}
