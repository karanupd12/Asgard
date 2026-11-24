import type { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox-viem";
import dotenv from "dotenv";
import path from "node:path";

// Single source of secrets: the repo-root .env (gitignored).
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const PRIVATE_KEY = process.env.PRIVATE_KEY;
const AMOY_RPC_URL = process.env.AMOY_RPC_URL ?? "https://rpc-amoy.polygon.technology/";
const LOCAL_RPC_URL = process.env.LOCAL_RPC_URL ?? "http://127.0.0.1:8545";

const config: HardhatUserConfig = {
  solidity: {
    // v1 contract (Upload.sol) is kept only as a gas-comparison baseline.
    compilers: [{ version: "0.8.24", settings: { evmVersion: "cancun", optimizer: { enabled: true, runs: 200 } } }],
  },
  networks: {
    hardhat: { chainId: 31337 },
    localhost: { url: LOCAL_RPC_URL, chainId: 31337 },
    amoy: {
      url: AMOY_RPC_URL,
      chainId: 80002,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    },
  },
  etherscan: {
    apiKey: process.env.POLYGONSCAN_API_KEY ?? "",
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
    outputFile: "gas-report.txt",
    noColors: true,
  },
};

export default config;
