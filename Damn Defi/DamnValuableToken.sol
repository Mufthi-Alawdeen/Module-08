// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract DamnValuableToken is ERC20 {
    constructor() ERC20("Damn Valuable Token", "DVT") {
        _mint(msg.sender, 1_000_000 ether); // 1M tokens
    }
}
