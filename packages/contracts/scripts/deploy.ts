// Deploys AsgardVault and writes deployments/<chainId>.json (address + start block).
// DEPLOYMENT_OUT overrides the output path (the Docker `deployer` job writes to a shared volume).
// Idempotent: if the recorded address already has code on this chain, it does nothing.
import fs from "node:fs";
import path from "node:path";
import hre from "hardhat";
import type { Address } from "viem";

async function main() {
  const publicClient = await hre.viem.getPublicClient();
  const chainId = await publicClient.getChainId();
  const out = process.env.DEPLOYMENT_OUT ?? path.resolve(__dirname, `../deployments/${chainId}.json`);

  if (fs.existsSync(out)) {
    const existing = JSON.parse(fs.readFileSync(out, "utf8")) as { address: Address; chainId: number };
    const code = existing.chainId === chainId ? await publicClient.getCode({ address: existing.address }) : undefined;
    if (code && code !== "0x") {
      console.log(`AsgardVault already deployed at ${existing.address} on chain ${chainId}; skipping.`);
      return;
    }
  }

  const vault = await hre.viem.deployContract("AsgardVault");
  const blockNumber = await publicClient.getBlockNumber();
  const deployment = {
    chainId,
    address: vault.address,
    startBlock: Number(blockNumber),
    deployedAt: new Date().toISOString(),
  };
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(deployment, null, 2) + "\n");
  console.log(`AsgardVault deployed to ${vault.address} on chain ${chainId} (block ${blockNumber}) -> ${out}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
