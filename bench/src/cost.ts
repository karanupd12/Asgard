// Metric #2: real-money cost per upload on Polygon PoS mainnet, from
//   measured gas (bench/out/gas.json) × live mainnet gas price × live POL/USD price.
// (Amoy testnet POL has no value, so mainnet pricing is the honest "what it would cost".)
import fs from "node:fs";
import path from "node:path";
import { createPublicClient, http } from "viem";
import { polygon } from "viem/chains";
import { round } from "./client.js";

async function main() {
  const gasFile = path.resolve(import.meta.dirname, "../out/gas.json");
  if (!fs.existsSync(gasFile)) throw new Error("run `pnpm --filter @asgard/contracts gas` first");
  const gas = JSON.parse(fs.readFileSync(gasFile, "utf8"));

  const client = createPublicClient({ chain: polygon, transport: http(process.env.POLYGON_RPC_URL ?? "https://polygon-bor-rpc.publicnode.com") });
  const gasPrice = await client.getGasPrice();
  const price = (await (await fetch("https://api.coingecko.com/api/v3/simple/price?ids=polygon-ecosystem-token&vs_currencies=usd")).json()) as {
    "polygon-ecosystem-token": { usd: number };
  };
  const polUsd = price["polygon-ecosystem-token"].usd;
  const gwei = Number(gasPrice) / 1e9;

  const usd = (g: number) => (g * Number(gasPrice) * polUsd) / 1e18;
  const result = {
    measuredAt: new Date().toISOString(),
    polygonGasPriceGwei: round(gwei, 2),
    polUsd,
    perUploadUsd: {
      v1Single: usd(gas.single.v1),
      v2Single: usd(gas.single.v2),
      v2Batched: usd(gas.perFileInBatch.v2),
    },
    uploadsPerDollarBatched: Math.floor(1 / usd(gas.perFileInBatch.v2)),
  };
  const out = path.resolve(import.meta.dirname, "../out/cost.json");
  fs.writeFileSync(out, JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
