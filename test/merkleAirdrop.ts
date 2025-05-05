import { expect } from "chai";
import { ethers } from "hardhat";
import { MerkleTree } from "merkletreejs";
import keccak256 from "keccak256";

describe("Merkle Airdrop Comparison", function () {
  let addresses: string[];
  let tree: MerkleTree;
  let leaves: Buffer[];
  let mappingAirdrop: any;
  let bitmapAirdrop: any;

  before(async function () {
    const signers = await ethers.getSigners();
    addresses = signers.slice(0, 5).map((s) => s.address);

    // Leaves for both contracts (address and index, convert hex string to Buffer)
    leaves = addresses.map((addr, i) =>
      Buffer.from(ethers.getBytes(ethers.solidityPackedKeccak256(["address", "uint256"], [addr, i])))
    );

    // Create a single Merkle tree (same leaves for both contracts)
    tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
    const root = tree.getHexRoot();

    const MappingFactory = await ethers.getContractFactory("MerkleAirdropMapping");
    mappingAirdrop = await MappingFactory.deploy(root);

    const BitmapFactory = await ethers.getContractFactory("MerkleAirdropBitmap");
    bitmapAirdrop = await BitmapFactory.deploy(root);
  });

  it("Mapping Airdrop: should claim once and fail on second attempt", async function () {
    const [claimer] = await ethers.getSigners();
    const index = addresses.findIndex((a) => a === claimer.address);
    if (index === -1) throw new Error("Claimer not in address list");

    // Leaf and proof for MerkleAirdropMapping (address and index)
    const leaf = Buffer.from(ethers.getBytes(ethers.solidityPackedKeccak256(["address", "uint256"], [claimer.address, index])));
    const proof = tree.getHexProof(leaf);

    // Call claim with proof and index
    const tx = await mappingAirdrop.claim(proof, index);
    const receipt = await tx.wait();
    console.log("✅ Mapping Airdrop Gas Used:", receipt?.gasUsed.toString());

    await expect(mappingAirdrop.claim(proof, index)).to.be.revertedWith("Already claimed");
  });

  it("Bitmap Airdrop: should claim once and fail on second attempt", async function () {
    const [claimer] = await ethers.getSigners();
    const index = addresses.findIndex((a) => a === claimer.address);
    if (index === -1) throw new Error("Claimer not in address list");

    // Leaf and proof for MerkleAirdropBitmap (address and index)
    const leaf = Buffer.from(ethers.getBytes(ethers.solidityPackedKeccak256(["address", "uint256"], [claimer.address, index])));
    const proof = tree.getHexProof(leaf);

    // Call claim with proof and index
    const tx = await bitmapAirdrop.claim(proof, index);
    const receipt = await tx.wait();
    console.log("✅ Bitmap Airdrop Gas Used:", receipt?.gasUsed.toString());

    await expect(bitmapAirdrop.claim(proof, index)).to.be.revertedWith("Already claimed");
  });
});