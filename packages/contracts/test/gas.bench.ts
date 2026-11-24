// Metric #1: gas per upload, v1 (Upload.sol) vs v2 (AsgardVault.sol).
// Measures real receipt gasUsed on the in-process Hardhat network and writes bench/out/gas.json.
import fs from "node:fs";
import path from "node:path";
import hre from "hardhat";
import { keccak256, toHex, type Hash } from "viem";

// v1 stored the full Pinata gateway URL for a CIDv1; v2 stores the 32-byte digest + codec.
const CID = "bafkreigh2akiscaildcqabsyg3dfr6chu3fgpregiymsck7e7aqa4s52zy";
const V1_URL = `https://gateway.pinata.cloud/ipfs/${CID}`;
const DIGEST = keccak256(toHex(CID));
const RAW = 0x55n;
const BATCH = 10;

describe("gas benchmark (v1 vs v2)", () => {
  it("measures and writes bench/out/gas.json", async () => {
    const publicClient = await hre.viem.getPublicClient();
    const [me, other] = await hre.viem.getWalletClients();
    const gas = async (h: Hash) =>
      (await publicClient.waitForTransactionReceipt({ hash: h })).gasUsed;

    const v1 = await hre.viem.deployContract("Upload");
    const v2 = await hre.viem.deployContract("AsgardVault");

    // Warm-up: first push to a user's array pays an extra zero->non-zero length write.
    await v1.write.add([me.account.address, V1_URL]);
    await v2.write.addFile([DIGEST, RAW, false]);

    const v1Single = await gas(await v1.write.add([me.account.address, V1_URL]));
    const v2Single = await gas(await v2.write.addFile([DIGEST, RAW, false]));

    // N uploads: v1 needs N transactions; v2 batches them in one.
    let v1Batch = 0n;
    for (let i = 0; i < BATCH; i++) {
      v1Batch += await gas(await v1.write.add([me.account.address, V1_URL]));
    }
    const v2Batch = await gas(
      await v2.write.addFiles([Array(BATCH).fill(DIGEST), Array(BATCH).fill(RAW), Array(BATCH).fill(false)]),
    );

    const v1Grant = await gas(await v1.write.allow([other.account.address]));
    const v2Grant = await gas(await v2.write.grantAccess([other.account.address]));

    const pct = (a: bigint, b: bigint) => Number(((a - b) * 10000n) / a) / 100;
    const result = {
      measuredAt: new Date().toISOString(),
      batchSize: BATCH,
      single: { v1: Number(v1Single), v2: Number(v2Single), reductionPct: pct(v1Single, v2Single) },
      perFileInBatch: {
        v1: Number(v1Batch / BigInt(BATCH)),
        v2: Number(v2Batch / BigInt(BATCH)),
        reductionPct: pct(v1Batch, v2Batch),
      },
      grant: { v1: Number(v1Grant), v2: Number(v2Grant), reductionPct: pct(v1Grant, v2Grant) },
    };

    const out = path.resolve(__dirname, "../../../bench/out/gas.json");
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify(result, null, 2) + "\n");
    console.log(JSON.stringify(result, null, 2));
  });
});
