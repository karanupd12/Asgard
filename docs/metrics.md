# Asgard — measured metrics

Every number here is produced by a script in `bench/` or `packages/contracts/test/gas.bench.ts`
(raw JSON in `bench/out/`). Regenerate with the commands in the README's *Benchmarks* section.

## 1. Gas per upload — v1 vs v2 contract (2026-11-24)

Real receipt `gasUsed` on the Hardhat EVM. v1 = original `Upload.sol` storing a gateway URL string;
v2 = `AsgardVault.sol` storing a CID as a packed `bytes32` digest + codec, with batching.

| Operation | v1 gas | v2 gas | Reduction |
|---|---:|---:|---:|
| Single upload | 118,065 | 74,506 | **36.89%** |
| Per file, batch of 10 | 118,065 | 51,477 | **56.39%** |
| Grant access | 111,131 | 90,238 | 18.8% |

## 2. Cost per upload on Polygon PoS mainnet (2026-11-24)

Measured gas × live mainnet gas price (276.93 gwei) × POL/USD (0.076306).

| | USD per upload |
|---|---:|
| v1 (single) | $0.0025 |
| v2 (single) | $0.0016 |
| v2 (batched) | **$0.0011** (~919 uploads per $1) |

## 3. End-to-end upload latency

File selected → encrypted → pinned → on-chain → visible in the gallery.

### Local stack (Anvil, instant blocks) (2026-11-24, 20 uploads of a 0.67 MB photo, encrypted)

| Phase (median) | ms |
|---|---:|
| Encrypt (AES-256-GCM, client) | 7.2 |
| Pin (API → IPFS, streamed) | 73.2 |
| Transaction (sign → mined) | 24 |
| Index (event → queryable) | 221 |
| **End-to-end p50 / p95** | **342.2 / 570.2** |

## 4. API latency under load (2026-11-24)

100,000 indexed files, 32 concurrent clients, 15s per endpoint, through nginx (single API container).

| Endpoint | p50 ms | p95 ms | p99 ms | req/s |
|---|---:|---:|---:|---:|
| List, first page | 23.3 | 50.9 | 71.7 | 625 |
| List, deep cursor | 37.3 | 65 | 92.3 | 781 |
| Full-text search | 49.7 | 100.7 | 158 | 576 |
| Tag filter | 41.6 | 72.6 | 105.3 | 701 |

Errors: 15 total. Measured on a single Windows laptop running the
load generator, nginx, API and Postgres together; any errors were TCP resets in Docker Desktop's
port forwarder (nginx logged no 5xx), not application failures.

## 5. Search index effectiveness (100,000 rows, EXPLAIN ANALYZE, median of 5)

Common terms match ~10% of rows (index helps little — most of the table is read anyway);
rare terms match a handful, which is where GIN indexes pay off.

| Query | Matches | GIN index | Seq scan | Speed-up |
|---|---|---:|---:|---:|
| Fuzzy title `ILIKE` (pg_trgm) | common | 29.2 ms | 65.4 ms | **2.2×** |
| Fuzzy title `ILIKE` (pg_trgm) | rare | 0.7 ms | 66.8 ms | **95.4×** |
| Full-text (`tsvector`) | common | 14 ms | 31.5 ms | **2.3×** |
| Full-text (`tsvector`) | rare | 0.2 ms | 34.5 ms | **172.5×** |
| Tag containment (`text[] @>`) | common | 24.4 ms | 34.4 ms | **1.4×** |
| Tag containment (`text[] @>`) | rare | 0.2 ms | 35.7 ms | **178.5×** |

## 6. Frontend performance (2026-11-24, Lighthouse, desktop)

| Page | Performance | LCP | TBT | JS transferred |
|---|---:|---:|---:|---:|
| Landing (/) | **99** | 0.83 s | 0 ms | 269 KB |
| Vault shell (/app) | **99** | 0.76 s | 10 ms | 269 KB |
