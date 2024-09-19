import { ethers } from "hardhat";
import fs from "fs";
import path from "path";
import csv from "csv-parser";
import { MerkleTree } from "merkletreejs";
import keccak256 from "keccak256";

// Define paths for CSV and output files
const csvPath = path.join(__dirname, "../airdrop/airdrop.csv");
const merkleOutputFilePath = path.resolve(__dirname, "../data/merkle.json");
const proofOutputFilePath = path.resolve(__dirname, "../data/proof.json");

// Parse the CSV file and store eligible addresses and amounts
let eligibleAddresses: { address: string; amount: string }[] = [];

const readCSV = async (): Promise<void> => {
  return new Promise((resolve, reject) => {
    fs.createReadStream(csvPath)
      .pipe(csv())
      .on("data", (row) => {
        eligibleAddresses.push({
          address: row.address,
          amount: ethers.parseUnits(row.amount, 18).toString(),
        });
      })
      .on("end", () => {
        console.log("CSV file successfully processed");
        resolve();
      })
      .on("error", reject);
  });
};

// Generate Merkle Tree from eligible addresses and amounts
const generateMerkleTree = () => {
  // Map each entry to a hashed leaf
  const leaves = eligibleAddresses.map(({ address, amount }) =>
    keccak256(ethers.solidityPacked(["address", "uint256"], [address, amount]))
  );

  // Create the Merkle Tree
  const tree = new MerkleTree(leaves, keccak256, { sort: true });
  const root = tree.getHexRoot();

  return { tree, root };
};

// Write Merkle root and proofs to files
const writeMerkleData = (
  root: string,
  proofs: { [address: string]: string[] }
) => {
  // Write Merkle root
  fs.writeFileSync(merkleOutputFilePath, JSON.stringify({ root }, null, 2));

  // Write proofs for each address
  fs.writeFileSync(proofOutputFilePath, JSON.stringify(proofs, null, 2));
};

// Main function to read CSV, generate Merkle Tree, and output the results
const main = async () => {
  // Read CSV file
  await readCSV();

  // Generate Merkle Tree
  const { tree, root } = generateMerkleTree();

  // Create proofs for each address
  const proofs: { [address: string]: string[] } = {};
  eligibleAddresses.forEach(({ address, amount }) => {
    const leaf = keccak256(
      ethers.solidityPacked(["address", "uint256"], [address, amount])
    );
    const proof = tree.getHexProof(leaf);
    proofs[address] = proof;
  });

  // Write the Merkle root and proofs to files
  writeMerkleData(root, proofs);

  console.log(`Merkle root: ${root}`);
  console.log("Proofs saved to file.");
};

// Execute the main function
main().catch((error) => {
  console.error("Error during the process:", error);
});
