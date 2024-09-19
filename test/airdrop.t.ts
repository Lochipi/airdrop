import { ethers } from "hardhat";
import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { MerkleTree } from "merkletreejs";
import keccak256 from "keccak256";

describe("BAYAirdrop", () => {
  async function deployAirdropFixture() {
    const [owner, otherAccount, recipient] = await ethers.getSigners();

    // Deploy ERC20 token
    const Token = await ethers.getContractFactory("MyToken");
    const token = await Token.deploy(owner.address);
    await token.waitForDeployment();

    // Create Merkle Tree for airdrop
    const elements = [
      { address: recipient.address, amount: ethers.parseUnits("100", 18) },
    ];

    const leaves = elements.map((x) =>
      keccak256(
        ethers.solidityPacked(["address", "uint256"], [x.address, x.amount])
      )
    );
    const tree = new MerkleTree(leaves, keccak256, { sort: true });
    const merkleRoot = tree.getHexRoot();

    // Deploy Airdrop contract
    const BAYAirdrop = await ethers.getContractFactory("BAYAirdrop");
    const airdrop = await BAYAirdrop.deploy(
      token.target,
      merkleRoot,
      otherAccount.address
    );
    await airdrop.waitForDeployment();

    // Transfer tokens to the Airdrop contract
    const airdropAmount = ethers.parseUnits("1000", 18);
    await token.transfer(airdrop.target, airdropAmount);

    return { token, airdrop, owner, otherAccount, recipient, tree, elements };
  }

  describe("Deployment", () => {
    it("Should set the right owner, token, and merkle root", async () => {
      const { airdrop, token, owner, tree } = await loadFixture(
        deployAirdropFixture
      );

      //   expect(await airdrop.owner()).to.equal(owner.address);
      expect(await airdrop.token()).to.equal(token.target);
      expect(await airdrop.merkleRoot()).to.equal(tree.getHexRoot());
    });

    it("should set the correct BAYC address", async () => {
      const { airdrop, otherAccount } = await loadFixture(deployAirdropFixture);

      expect(await airdrop.BAYC_NFT_ADDRESS()).to.equal(otherAccount.address);
    });
  });

  describe("Airdrop Functionality", () => {
    it("should allow valid claim", async () => {
      const { airdrop, recipient, tree, token, elements } = await loadFixture(
        deployAirdropFixture
      );

      const element = elements[0];
      const proof = tree.getHexProof(
        keccak256(
          ethers.solidityPacked(
            ["address", "uint256"],
            [recipient.address, element.amount]
          )
        )
      );

      const initialBalance = await token.balanceOf(recipient.address);

      await airdrop.connect(recipient).claim(proof, element.amount);

      const finalBalance = await token.balanceOf(recipient.address);
      expect(finalBalance).to.equal(initialBalance + element.amount);
    });

    it("should revert if already claimed", async () => {
      const { airdrop, recipient, tree, elements } = await loadFixture(
        deployAirdropFixture
      );

      const element = elements[0];
      const proof = tree.getHexProof(
        keccak256(
          ethers.solidityPacked(
            ["address", "uint256"],
            [recipient.address, element.amount]
          )
        )
      );

      // First claim
      await airdrop.connect(recipient).claim(proof, element.amount);

      // Second claim should revert
      await expect(
        airdrop.connect(recipient).claim(proof, element.amount)
      ).to.be.revertedWith("You have already claimed");
    });

    it("should revert if proof is invalid", async () => {
      const { airdrop, otherAccount, recipient } = await loadFixture(
        deployAirdropFixture
      );

      const invalidProof: string[] = [];

      const amount = ethers.parseUnits("100", 18);

      await expect(
        airdrop.connect(otherAccount).claim(invalidProof, amount)
      ).to.be.revertedWith(
        "TokenAirdrop: Address or amount are invalid for claim"
      );
    });

    it("should allow the owner to withdraw the remaining tokens", async () => {
      const { airdrop, owner, token } = await loadFixture(deployAirdropFixture);

      const initialBalance = await token.balanceOf(owner.address);

      // Withdraw remaining tokens from the contract
      await airdrop.withdraw();

      const finalBalance = await token.balanceOf(owner.address);
      expect(finalBalance).to.be.above(initialBalance);
    });

    it("should prevent non-owner from withdrawing tokens", async () => {
      const { airdrop, otherAccount } = await loadFixture(deployAirdropFixture);

      await expect(airdrop.connect(otherAccount).withdraw()).to.be.revertedWith(
        "Only owner can perform this action"
      );
    });

    it("should show the correct balance of the contract", async () => {
      const { airdrop, token } = await loadFixture(deployAirdropFixture);

      const contractBalance = await token.balanceOf(airdrop.target);
      const balance = await airdrop.checkBalance();
      expect(balance).to.equal(contractBalance);
    });
  });
});
