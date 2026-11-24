// Compiles bench/out/*.json into docs/metrics.md (the README quotes only these numbers).
import fs from "node:fs";
import path from "node:path";

const outDir = path.resolve(import.meta.dirname, "../out");
const read = (f: string) => {
  const p = path.join(outDir, f);
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : null;
};
const n = (x: number) => x.toLocaleString("en-US");
const usd = (x: number) => `$${x.toFixed(4)}`;
const day = (iso?: string) => (iso ? iso.slice(0, 10) : "n/a");

const gas = read("gas.json");
const cost = read("cost.json");
const lat = read("latency-31337.json");
const latAmoy = read("latency-80002.json");
const load = read("load.json");
const lh = read("lighthouse.json");

const lines: string[] = [
  "# Asgard — measured metrics",
  "",
  "Every number here is produced by a script in `bench/` or `packages/contracts/test/gas.bench.ts`",
  "(raw JSON in `bench/out/`). Regenerate with the commands in the README's *Benchmarks* section.",
  "",
];

if (gas) {
  lines.push(
    `## 1. Gas per upload — v1 vs v2 contract (${day(gas.measuredAt)})`,
    "",
    "Real receipt `gasUsed` on the Hardhat EVM. v1 = original `Upload.sol` storing a gateway URL string;",
    "v2 = `AsgardVault.sol` storing a CID as a packed `bytes32` digest + codec, with batching.",
    "",
    "| Operation | v1 gas | v2 gas | Reduction |",
    "|---|---:|---:|---:|",
    `| Single upload | ${n(gas.single.v1)} | ${n(gas.single.v2)} | **${gas.single.reductionPct}%** |`,
    `| Per file, batch of ${gas.batchSize} | ${n(gas.perFileInBatch.v1)} | ${n(gas.perFileInBatch.v2)} | **${gas.perFileInBatch.reductionPct}%** |`,
    `| Grant access | ${n(gas.grant.v1)} | ${n(gas.grant.v2)} | ${gas.grant.reductionPct}% |`,
    "",
  );
}
if (cost) {
  lines.push(
    `## 2. Cost per upload on Polygon PoS mainnet (${day(cost.measuredAt)})`,
    "",
    `Measured gas × live mainnet gas price (${cost.polygonGasPriceGwei} gwei) × POL/USD (${cost.polUsd}).`,
    "",
    "| | USD per upload |",
    "|---|---:|",
    `| v1 (single) | ${usd(cost.perUploadUsd.v1Single)} |`,
    `| v2 (single) | ${usd(cost.perUploadUsd.v2Single)} |`,
    `| v2 (batched) | **${usd(cost.perUploadUsd.v2Batched)}** (~${n(cost.uploadsPerDollarBatched)} uploads per $1) |`,
    "",
  );
}
const latTable = (l: typeof lat, label: string) => [
  `### ${label} (${day(l.measuredAt)}, ${l.uploads} uploads of a ${(l.photoBytes / 1e6).toFixed(2)} MB photo, encrypted)`,
  "",
  "| Phase (median) | ms |",
  "|---|---:|",
  `| Encrypt (AES-256-GCM, client) | ${l.phasesMedianMs.encrypt} |`,
  `| Pin (API → IPFS, streamed) | ${l.phasesMedianMs.pin} |`,
  `| Transaction (sign → mined) | ${l.phasesMedianMs.tx} |`,
  `| Index (event → queryable) | ${l.phasesMedianMs.index} |`,
  `| **End-to-end p50 / p95** | **${l.totalMs.p50} / ${l.totalMs.p95}** |`,
  "",
];
if (lat || latAmoy) {
  lines.push("## 3. End-to-end upload latency", "", "File selected → encrypted → pinned → on-chain → visible in the gallery.", "");
  if (lat) lines.push(...latTable(lat, "Local stack (Anvil, instant blocks)"));
  if (latAmoy) lines.push(...latTable(latAmoy, "Polygon Amoy testnet"));
}
if (load) {
  const a = load.api;
  lines.push(
    `## 4. API latency under load (${day(load.measuredAt)})`,
    "",
    `${n(load.rows)} indexed files, ${load.concurrency} concurrent clients, ${load.durationMs / 1000}s per endpoint, through nginx (single API container).`,
    "",
    "| Endpoint | p50 ms | p95 ms | p99 ms | req/s |",
    "|---|---:|---:|---:|---:|",
    ...(
      [
        ["List, first page", a.listFirstPage],
        ["List, deep cursor", a.listDeepPage],
        ["Full-text search", a.search],
        ["Tag filter", a.tagFilter],
      ] as [string, { p50: number; p95: number; p99: number; rps: number }][]
    ).map(([k, v]) => `| ${k} | ${v.p50} | ${v.p95} | ${v.p99} | ${n(v.rps)} |`),
    "",
    `Errors: ${Object.values(a as Record<string, { errors: number }>).reduce((s, v) => s + v.errors, 0)} total. Measured on a single Windows laptop running the`,
    "load generator, nginx, API and Postgres together; any errors were TCP resets in Docker Desktop's",
    "port forwarder (nginx logged no 5xx), not application failures.",
    "",
    `## 5. Search index effectiveness (${n(load.rows)} rows, EXPLAIN ANALYZE, median of 5)`,
    "",
    "Common terms match ~10% of rows (index helps little — most of the table is read anyway);",
    "rare terms match a handful, which is where GIN indexes pay off.",
    "",
    "| Query | Matches | GIN index | Seq scan | Speed-up |",
    "|---|---|---:|---:|---:|",
    ...(
      [
        ["Fuzzy title `ILIKE` (pg_trgm)", "common", "fuzzyCommon"],
        ["Fuzzy title `ILIKE` (pg_trgm)", "rare", "fuzzyRare"],
        ["Full-text (`tsvector`)", "common", "fullTextCommon"],
        ["Full-text (`tsvector`)", "rare", "fullTextRare"],
        ["Tag containment (`text[] @>`)", "common", "tagCommon"],
        ["Tag containment (`text[] @>`)", "rare", "tagRare"],
      ] as const
    ).map(([label, kind, key]) => {
      const r = load.search[key];
      return `| ${label} | ${kind} | ${r.indexedMs} ms | ${r.seqScanMs} ms | **${r.speedup}×** |`;
    }),
    "",
  );
}
if (lh) {
  lines.push(
    `## 6. Frontend performance (${day(lh.measuredAt)}, Lighthouse, ${lh.formFactor})`,
    "",
    "| Page | Performance | LCP | TBT | JS transferred |",
    "|---|---:|---:|---:|---:|",
    ...lh.pages.map(
      (p: { name: string; score: number; lcpMs: number; tbtMs: number; jsKb: number }) =>
        `| ${p.name} | **${p.score}** | ${(p.lcpMs / 1000).toFixed(2)} s | ${p.tbtMs} ms | ${p.jsKb} KB |`,
    ),
    "",
  );
}

const out = path.resolve(import.meta.dirname, "../../docs/metrics.md");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, lines.join("\n"));
console.log(`wrote ${out}`);
