require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const NEXT_PUBLIC_POLYGON_EMOY_RPC = "https://rpc-amoy.polygon.technology/";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.19", // ✅ Updated to match your Upload.sol version
  networks: {
    hardhat: {
      chainId: 31337, // ✅ Fixed: Use standard Hardhat chainId
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
      accounts: {
        mnemonic: "test test test test test test test test test test test junk"
      }
    },
    polygon_amoy: {
      url: NEXT_PUBLIC_POLYGON_EMOY_RPC,
      accounts: [process.env.PRIVATE_KEY],
    },
  },
  paths: {
    artifacts: "./client/src/artifacts",
  },
};
