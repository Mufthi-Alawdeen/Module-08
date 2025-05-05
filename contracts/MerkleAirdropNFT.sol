// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/utils/structs/BitMaps.sol";
import "@openzeppelin/contracts/utils/Multicall.sol";

contract MerkleAirdropNFT is ERC721, Multicall {
    using BitMaps for BitMaps.BitMap;

    bytes32 public merkleRoot;
    mapping(address => bool) public hasClaimedMapping; // Mapping-based tracking
    BitMaps.BitMap private claimedBitmap; // Bitmap-based tracking
    uint256 public totalSupply;
    uint256 public maxSupply;

    // Commit-reveal storage
    mapping(address => bytes32) public commitments;
    mapping(address => uint256) public commitBlock;
    uint256 public constant REVEAL_DELAY = 10; // Reveal after 10 blocks

    event Claimed(address indexed user, uint256 index, uint256 tokenId);
    event Committed(address indexed user, bytes32 commitment);
    event Revealed(address indexed user, uint256 tokenId);

    constructor(
        bytes32 _merkleRoot,
        uint256 _maxSupply
    ) ERC721("MerkleAirdropNFT", "MANFT") {
        merkleRoot = _merkleRoot;
        maxSupply = _maxSupply;
    }

    // Commit to a random seed for NFT ID
    function commit(bytes32 commitment) external {
        require(commitments[msg.sender] == bytes32(0), "Already committed");
        commitments[msg.sender] = commitment;
        commitBlock[msg.sender] = block.number;
        emit Committed(msg.sender, commitment);
    }

    // Reveal and mint using mapping-based tracking
    function revealAndClaimMapping(
        bytes32[] calldata proof,
        uint256 index,
        uint256 seed
    ) external {
        require(commitments[msg.sender] != bytes32(0), "No commitment");
        require(
            block.number >= commitBlock[msg.sender] + REVEAL_DELAY,
            "Reveal too early"
        );
        require(
            keccak256(abi.encodePacked(seed)) == commitments[msg.sender],
            "Invalid seed"
        );
        require(!hasClaimedMapping[msg.sender], "Already claimed");
        bytes32 leaf = keccak256(abi.encodePacked(msg.sender, index));
        require(MerkleProof.verify(proof, merkleRoot, leaf), "Invalid proof");

        // Generate random token ID
        uint256 tokenId = _generateRandomTokenId(seed);
        hasClaimedMapping[msg.sender] = true;
        _mint(msg.sender, tokenId);
        totalSupply++;

        // Clear commitment
        delete commitments[msg.sender];
        delete commitBlock[msg.sender];
        emit Claimed(msg.sender, index, tokenId);
        emit Revealed(msg.sender, tokenId);
    }

    // Reveal and mint using bitmap-based tracking
    function revealAndClaimBitmap(
        bytes32[] calldata proof,
        uint256 index,
        uint256 seed
    ) external {
        require(commitments[msg.sender] != bytes32(0), "No commitment");
        require(
            block.number >= commitBlock[msg.sender] + REVEAL_DELAY,
            "Reveal too early"
        );
        require(
            keccak256(abi.encodePacked(seed)) == commitments[msg.sender],
            "Invalid seed"
        );
        require(!claimedBitmap.get(index), "Already claimed");
        bytes32 leaf = keccak256(abi.encodePacked(msg.sender, index));
        require(MerkleProof.verify(proof, merkleRoot, leaf), "Invalid proof");

        // Generate random token ID
        uint256 tokenId = _generateRandomTokenId(seed);
        claimedBitmap.set(index);
        _mint(msg.sender, tokenId);
        totalSupply++;

        // Clear commitment
        delete commitments[msg.sender];
        delete commitBlock[msg.sender];
        emit Claimed(msg.sender, index, tokenId);
        emit Revealed(msg.sender, tokenId);
    }

    // Generate random token ID based on seed
    function _generateRandomTokenId(
        uint256 seed
    ) private view returns (uint256) {
        require(totalSupply < maxSupply, "Max supply reached");
        // Use seed and block data for pseudo-randomness
        uint256 random = uint256(
            keccak256(
                abi.encodePacked(seed, blockhash(block.number - 1), msg.sender)
            )
        );
        return (random % maxSupply) + 1; // Token IDs from 1 to maxSupply
    }

    // Multicall for batch transfers (override to prevent minting abuse)
    function multicall(
        bytes[] calldata data
    ) public virtual override returns (bytes[] memory results) {
        results = new bytes[](data.length);
        for (uint256 i = 0; i < data.length; i++) {
            // Prevent calls to minting functions
            bytes4 selector = bytes4(data[i][:4]);
            require(
                selector != this.revealAndClaimMapping.selector &&
                    selector != this.revealAndClaimBitmap.selector &&
                    selector != this.commit.selector,
                "Cannot call minting functions"
            );
            (bool success, bytes memory result) = address(this).delegatecall(
                data[i]
            );
            require(success, "Multicall failed");
            results[i] = result;
        }
        return results;
    }

    // View function to check if an index is claimed (bitmap)
    function isClaimedBitmap(uint256 index) external view returns (bool) {
        return claimedBitmap.get(index);
    }
}
