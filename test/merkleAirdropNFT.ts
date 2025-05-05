/* import { expect } from "chai";
import { ethers } from "hardhat";
import { MerkleTree } from "merkletreejs";
import keccak256 from "keccak256";

describe("Merkle Airdrop NFT", function () {
  let addresses: string[];
  let tree: MerkleTree;
  let leaves: Buffer[];
  let airdropNFT: any;
  const maxSupply = 100;

  before(async function () {
    const signers = await ethers.getSigners();
    addresses = signers.slice(0, 5).map((s) => s.address);

    // Create leaves (address and index)
    leaves = addresses.map((addr, i) =>
      Buffer.from(ethers.getBytes(ethers.solidityPackedKeccak256(["address", "uint256"], [addr, i])))
    );

    // Create Merkle tree
    tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
    const root = tree.getHexRoot();

    const NFTFactory = await ethers.getContractFactory("MerkleAirdropNFT");
    airdropNFT = await NFTFactory.deploy(root, maxSupply);
  });

  it("should commit and reveal for mapping-based claim", async function () {
    const [claimer] = await ethers.getSigners();
    const index = addresses.findIndex((a) => a === claimer.address);
    if (index === -1) throw new Error("Claimer not in address list");

    // Commit
    const seed = Math.floor(Math.random() * 1000000);
    const commitment = ethers.keccak256(ethers.toUtf8Bytes(seed.toString()));
    await airdropNFT.connect(claimer).commit(commitment);

    // Wait 10 blocks
    for (let i = 0; i < 10; i++) {
      await ethers.provider.send("evm_mine", []);
    }

    // Reveal and claim
    const leaf = Buffer.from(ethers.getBytes(ethers.solidityPackedKeccak256(["address", "uint256"], [claimer.address, index])));
    const proof = tree.getHexProof(leaf);

    const tx = await airdropNFT.connect(claimer).revealAndClaimMapping(proof, index, seed);
    const receipt = await tx.wait();
    console.log("✅ Mapping Airdrop Gas Used:", receipt?.gasUsed.toString());

    // Verify NFT minted
    const tokenId = await airdropNFT.tokenOfOwnerByIndex(claimer.address, 0);
    expect(await airdropNFT.ownerOf(tokenId)).to.equal(claimer.address);

    // Second claim should fail
    await expect(airdropNFT.connect(claimer).revealAndClaimMapping(proof, index, seed)).to.be.revertedWith("Already claimed");
  });

  it("should commit and reveal for bitmap-based claim", async function () {
    const [claimer] = await ethers.getSigners();
    const index = addresses.findIndex((a) => a === claimer.address);
    if (index === -1) throw new Error("Claimer not in address list");

    // Commit
    const seed = Math.floor(Math.random() * 1000000);
    const commitment = ethers.keccak256(ethers.toUtf8Bytes(seed.toString()));
    await airdropNFT.connect(claimer).commit(commitment);

    // Wait 10 blocks
    for (let i = 0; i < 10; i++) {
      await ethers.provider.send("evm_mine", []);
    }

    // Reveal and claim
    const leaf = Buffer.from(ethers.getBytes(ethers.solidityPackedKeccak256(["address", "uint256"], [claimer.address, index])));
    const proof = tree.getHexProof(leaf);

    const tx = await airdropNFT.connect(claimer).revealAndClaimBitmap(proof, index, seed);
    const receipt = await tx.wait();
    console.log("✅ Bitmap Airdrop Gas Used:", receipt?.gasUsed.toString());

    // Verify NFT minted
    const tokenId = await airdropNFT.tokenOfOwnerByIndex(claimer.address, 0);
    expect(await airdropNFT.ownerOf(tokenId)).to.equal(claimer.address);

    // Second claim should fail
    await expect(airdropNFT.connect(claimer).revealAndClaimBitmap(proof, index, seed)).to.be.revertedWith("Already claimed");
  });

  it("should allow multicall for batch transfers", async function () {
    const [claimer, recipient] = await ethers.getSigners();
    const index1 = addresses.findIndex((a) => a === claimer.address);
    const index2 = addresses.findIndex((a) => a === recipient.address);
    if (index1 === -1 || index2 === -1) throw new Error("Claimer or recipient not in address list");

    // Claim two NFTs
    const seed1 = Math.floor(Math.random() * 1000000);
    const seed2 = Math.floor(Math.random() * 1000000);
    const commitment1 = ethers.keccak256(ethers.toUtf8Bytes(seed1.toString()));
    const commitment2 = ethers.keccak256(ethers.toUtf8Bytes(seed2.toString()));

    await airdropNFT.connect(claimer).commit(commitment1);
    await airdropNFT.connect(recipient).commit(commitment2);

    for (let i = 0; i < 10; i++) {
      await ethers.provider.send("evm_mine", []);
    }

    const leaf1 = Buffer.from(ethers.getBytes(ethers.solidityPackedKeccak256(["address", "uint256"], [claimer.address, index1])));
    const leaf2 = Buffer.from(ethers.getBytes(ethers.solidityPackedKeccak256(["address", "uint256"], [recipient.address, index2])));
    const proof1 = tree.getHexProof(leaf1);
    const proof2 = tree.getHexProof(leaf2);

    await airdropNFT.connect(claimer).revealAndClaimBitmap(proof1, index1, seed1);
    await airdropNFT.connect(recipient).revealAndClaimBitmap(proof2, index2, seed2);

    // Get token IDs
    const tokenId1 = await airdropNFT.tokenOfOwnerByIndex(claimer.address, 0);
    const tokenId2 = await airdropNFT.tokenOfOwnerByIndex(recipient.address, 0);

    // Batch transfer to a third address
    const [_, __, thirdParty] = await ethers.getSigners();
    const transferData1 = airdropNFT.interface.encodeFunctionData("transferFrom", [claimer.address, thirdParty.address, tokenId1]);
    const transferData2 = airdropNFT.interface.encodeFunctionData("transferFrom", [recipient.address, thirdParty.address, tokenId2]);

    const tx = await airdropNFT.connect(claimer).multicall([transferData1, transferData2]);
    await tx.wait();

    // Verify transfers
    expect(await airdropNFT.ownerOf(tokenId1)).to.equal(thirdParty.address);
    expect(await airdropNFT.ownerOf(tokenId2)).to.equal(thirdParty.address);
  });

  it("should prevent multicall abuse for minting", async function () {
    const [claimer] = await ethers.getSigners();
    const index = addresses.findIndex((a) => a === claimer.address);
    if (index === -1) throw new Error("Claimer not in address list");

    // Commit
    const seed = Math.floor(Math.random() * 1000000);
    const commitment = ethers.keccak256(ethers.toUtf8Bytes(seed.toString()));
    await airdropNFT.connect(claimer).commit(commitment);

    for (let i = 0; i < 10; i++) {
      await ethers.provider.send("evm_mine", []);
    }

    // Attempt to call revealAndClaimBitmap via multicall
    const leaf = Buffer.from(ethers.getBytes(ethers.solidityPackedKeccak256(["address", "uint256"], [claimer.address, index])));
    const proof = tree.getHexProof(leaf);
    const claimData = airdropNFT.interface.encodeFunctionData("revealAndClaimBitmap", [proof, index, seed]);

    await expect(airdropNFT.connect(claimer).multicall([claimData])).to.be.revertedWith("Cannot call minting functions");
  });

  it("should prevent invalid commitments and early reveals", async function () {
    const [claimer] = await ethers.getSigners();
    const index = addresses.findIndex((a) => a === claimer.address);
    if (index === -1) throw new Error("Claimer not in address list");

    // No commitment
    const leaf = Buffer.from(ethers.getBytes(ethers.solidityPackedKeccak256(["address", "uint256"], [claimer.address, index])));
    const proof = tree.getHexProof(leaf);
    await expect(airdropNFT.connect(claimer).revealAndClaimMapping(proof, index, 12345)).to.be.revertedWith("No commitment");

    // Commit
    const seed = Math.floor(Math.random() * 1000000);
    const commitment = ethers.keccak256(ethers.toUtf8Bytes(seed.toString()));
    await airdropNFT.connect(claimer).commit(commitment);

    // Reveal too early
    await expect(airdropNFT.connect(claimer).revealAndClaimMapping(proof, index, seed)).to.be.revertedWith("Reveal too early");

    // Invalid seed
    for (let i = 0; i < 10; i++) {
      await ethers.provider.send("evm_mine", []);
    }
    await expect(airdropNFT.connect(claimer).revealAndClaimMapping(proof, index, seed + 1)).to.be.revertedWith("Invalid seed");
  });

  it("should compare gas costs", async function () {
    const [claimer1, claimer2] = await ethers.getSigners();
    const index1 = addresses.findIndex((a) => a === claimer1.address);
    const index2 = addresses.findIndex((a) => a === claimer2.address);
    if (index1 === -1 || index2 === -1) throw  new Error("Claimer not in address list");

    // Commit for both claimers
    const seed1 = Math.floor(Math.random() * 1000000);
    const seed2 = Math.floor(Math.random() * 1000000);
    const commitment1 = ethers.keccak256(ethers.toUtf8Bytes(seed1.toString()));
    const commitment2 = ethers.keccak256(ethers.toUtf8Bytes(seed2.toString()));
    await airdropNFT.connect(claimer1).commit(commitment1);
    await airdropNFT.connect(claimer2).commit(commitment2);

    for (let i = 0; i < 10; i++) {
      await ethers.provider.send("evm_mine", []);
    }

    // Claim with mapping
    const leaf1 = Buffer.from(ethers.getBytes(ethers.solidityPackedKeccak256(["address", "uint256"], [claimer1.address, index1])));
    const proof1 = tree.getHexProof(leaf1);
    const tx1 = await airdropNFT.connect(claimer1).revealAndClaimMapping(proof1, index1, seed1);
    const receipt1 = await tx1.wait();
    const mappingGas = receipt1.gasUsed;

    // Claim with bitmap
    const leaf2 = Buffer.from(ethers.getBytes(ethers.solidityPackedKeccak256(["address", "uint256"], [claimer2.address, index2])));
    const proof2 = tree.getHexProof(leaf2);
    const tx2 = await airdropNFT.connect(claimer2).revealAndClaimBitmap(proof2, index2, seed2);
    const receipt2 = await tx2.wait();
    const bitmapGas = receipt2.gasUsed;

    console.log(`Mapping Gas: ${mappingGas}, Bitmap Gas: ${bitmapGas}`);
    // Bitmap should generally be more gas-efficient for large numbers of claims
    expect(bitmapGas).to.be.lte(mappingGas);
  });
});  */