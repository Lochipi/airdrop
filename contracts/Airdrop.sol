// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

contract BAYAirdrop {
    IERC20 public immutable token;
    bytes32 public immutable merkleRoot;
    address owner;
    address public immutable BAYC_NFT_ADDRESS;

    mapping(address => bool) public hasClaimed;

    constructor(IERC20 _token, bytes32 _merkleRoot, address _baycAddress) {
        owner = msg.sender;
        token = _token;
        merkleRoot = _merkleRoot;
        BAYC_NFT_ADDRESS = _baycAddress;
    }

    event ClaimdSucceful(address indexed claimer, uint256 amount);

    function claim(bytes32[] calldata _merkleProof, uint256 _amount) external {
        require(!hasClaimed[msg.sender], "You have already claimed");
        require(
            canClaim(msg.sender, _amount, _merkleProof),
            "TokenAirdrop: Address or amount are invalid for claim"
        );
        uint256 contractBalance = token.balanceOf(address(this));
        require(contractBalance >= _amount, "insufficient contract balance");
        hasClaimed[msg.sender] = true;
        token.transfer(msg.sender, _amount);

        emit ClaimdSucceful(msg.sender, _amount);
    }

    function canClaim( address _claimer, uint256 _amount, bytes32[] calldata merkleProof ) public view returns (bool) {
        return
            !hasClaimed[_claimer] &&
            MerkleProof.verify(
                merkleProof,
                merkleRoot,
                keccak256(abi.encodePacked(_claimer, _amount))
            );
    }

    function checkBalance() external view returns (uint256 balance)   {
        require(msg.sender != address(0), "Zero address detected");
        require(msg.sender == owner, "Only owner can perform this action");
        balance = token.balanceOf(address(this));
    }
}
