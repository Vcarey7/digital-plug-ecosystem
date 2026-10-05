// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @dev Test-only stand-in for the real $PLUG ERC-20 token, which is deployed
/// separately (see contracts/dpc-suite/README.md). Implements IPlugToken's
/// surface (mint/burn included) so the suite can be fully exercised on a
/// testnet before the real token exists.
contract MockPlugToken is ERC20 {
    constructor() ERC20("Mock Plug Token", "mPLUG") {
        _mint(msg.sender, 1_000_000 ether);
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }
}
