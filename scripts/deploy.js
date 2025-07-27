const hre = require("hardhat");

async function main() {
  const Upload = await hre.ethers.getContractFactory("Upload");
  const upload = await Upload.deploy();

  // ✅ FIXED: Use waitForDeployment() instead of deployed()
  await upload.waitForDeployment();

  // ✅ FIXED: Use getAddress() instead of .address
  const contractAddress = await upload.getAddress();

  console.log("Upload contract deployed to:", contractAddress);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

//npx hardhat run scripts/deploy.js --network polygon_amoy (no need to run local hardhat node)
//npx hardhat run scripts/deploy.js --network localhost