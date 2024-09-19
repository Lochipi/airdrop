// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MyToken is ERC20, Ownable {
    constructor(address owner) ERC20("EmaseToken", "EMT") Ownable(owner) {
        _mint(msg.sender, 1000000000000000000000000);
    }
}