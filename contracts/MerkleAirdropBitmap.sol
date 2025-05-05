// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/utils/structs/BitMaps.sol";

contract MerkleAirdropBitmap {
    using BitMaps for BitMaps.BitMap;

    bytes32 public merkleRoot;
    BitMaps.BitMap private claimedBitmap;

    constructor(bytes32 _merkleRoot) {
        merkleRoot = _merkleRoot;
    }

    function claim(bytes32[] calldata proof, uint256 index) external {
        require(!claimedBitmap.get(index), "Already claimed");
        bytes32 leaf = keccak256(abi.encodePacked(msg.sender, index));
        require(MerkleProof.verify(proof, merkleRoot, leaf), "Invalid proof");

        claimedBitmap.set(index);
        // Mint or transfer logic here (e.g., emit event or mint NFT)
    }
}
