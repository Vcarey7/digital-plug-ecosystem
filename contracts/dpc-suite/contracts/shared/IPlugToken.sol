// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IPlugToken
/// @notice Interface for the $PLUG ERC-20 token used across the Digital Plug ecosystem
interface IPlugToken {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);
    function burn(uint256 amount) external;
    function mint(address to, uint256 amount) external;
}
