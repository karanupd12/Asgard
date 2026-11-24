// Metric #3: end-to-end upload latency, broken down by phase:
//   encrypt (client) -> pin (API -> IPFS) -> tx (sign, send, mined) -> index (indexer mirrors event)
// Runs N sequential single-file uploads of a real ~1-2 MB photo, as one user would.
//   N=10 pnpm latency                       (local Docker stack)
//   BASE_URL=... PRIVATE_KEY=0x... pnpm latency   (any deployment, e.g. Amoy)
import fs from "node:fs";
import path from "node:path";
import type { Hex } from "viem";
import { Client, DEV_KEYS, loadConfig, round, stats } from "./client.js";

const N = Number(process.env.N ?? 10);
const PHOTO = "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=2400&q=85&fm=jpg";

async function main() {
  const cfg = await loadConfig();
  const c = new Client((process.env.PRIVATE_KEY as Hex) ?? DEV_KEYS[2], cfg);
  await c.login();
  await c.unlock();

  const photo = new Uint8Array(await (await fetch(PHOTO)).arrayBuffer());
  console.log(`chain ${cfg.chainId} · ${N} uploads · photo ${(photo.byteLength / 1e6).toFixed(2)} MB · encrypted`);

  const rows: { encrypt: number; pin: number; tx: number; index: number; total: number; gas: number }[] = [];
  for (let i = 0; i < N; i++) {
    // Unique bytes per run (fresh IV -> fresh CID), exactly like real encrypted uploads.
    const t0 = performance.now();
    const up = await c.upload({ bytes: photo, mime: "image/jpeg", width: 2400, height: 1600, title: `latency ${i}`, tags: ["bench"], encrypt: true });
    const t1 = performance.now();
    const receipt = await c.addFiles([up]);
    const t2 = performance.now();
    await c.waitConfirmed([up.file.id]);
    const t3 = performance.now();
    rows.push({
      encrypt: up.timings.encryptMs,
      pin: up.timings.pinMs,
      tx: t2 - t1,
      index: t3 - t2,
      total: t3 - t0,
      gas: Number(receipt.gasUsed),
    });
    console.log(`  #${i + 1}: total ${Math.round(t3 - t0)} ms (encrypt ${Math.round(up.timings.encryptMs)}, pin ${Math.round(up.timings.pinMs)}, tx ${Math.round(t2 - t1)}, index ${Math.round(t3 - t2)})`);
  }

  const result = {
    measuredAt: new Date().toISOString(),
    chainId: cfg.chainId,
    storage: cfg.storageProvider,
    uploads: N,
    photoBytes: photo.byteLength,
    totalMs: stats(rows.map((r) => r.total)),
    phasesMedianMs: {
      encrypt: stats(rows.map((r) => r.encrypt)).p50,
      pin: stats(rows.map((r) => r.pin)).p50,
      tx: stats(rows.map((r) => r.tx)).p50,
      index: stats(rows.map((r) => r.index)).p50,
    },
    gasUsedMedian: stats(rows.map((r) => r.gas)).p50,
  };
  const out = path.resolve(import.meta.dirname, `../out/latency-${cfg.chainId}.json`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(result, null, 2) + "\n");
  console.log(`\nmedian ${round(result.totalMs.p50)} ms · p95 ${round(result.totalMs.p95)} ms -> ${out}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
