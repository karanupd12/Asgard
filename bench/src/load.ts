// Metrics #4 and #6: API latency under load, and search index effectiveness, at scale.
//  1. Inserts 100,000 synthetic file rows for a throwaway wallet (directly in Postgres).
//  2. Hammers list / search / tag endpoints through nginx with 32 concurrent clients.
//  3. EXPLAIN ANALYZE of search queries with indexes on vs. forced sequential scan.
//  4. Deletes the synthetic rows.
// Requires the Docker stack (uses `docker compose exec postgres psql`).
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { generatePrivateKey } from "viem/accounts";
import { BASE, Client, loadConfig, round, stats } from "./client.js";

const ROWS = Number(process.env.ROWS ?? 100_000);
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 32);
const DURATION_MS = Number(process.env.DURATION_MS ?? 15_000);

function psql(sql: string): string {
  return execFileSync("docker", ["compose", "exec", "-T", "postgres", "psql", "-U", "asgard", "-d", "asgard", "-At", "-v", "ON_ERROR_STOP=1"], {
    input: sql,
    encoding: "utf8",
    maxBuffer: 64 << 20,
  });
}

async function hammer(c: Client, label: string, mkPath: (i: number) => string) {
  const lat: number[] = [];
  let errors = 0;
  const end = Date.now() + DURATION_MS;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async (_, w) => {
      for (let i = w; Date.now() < end; i += CONCURRENCY) {
        const t = performance.now();
        try {
          const r = await fetch(`${BASE}/api${mkPath(i)}`, { headers: { Cookie: c.cookie } });
          await r.arrayBuffer();
          if (!r.ok) errors++;
        } catch {
          errors++; // transport error (counted, not fatal)
        }
        lat.push(performance.now() - t);
      }
    }),
  );
  const s = stats(lat);
  const rps = round(lat.length / (DURATION_MS / 1000), 0);
  console.log(`  ${label.padEnd(22)} p50 ${s.p50} ms · p95 ${s.p95} ms · p99 ${s.p99} ms · ${rps} req/s · ${errors} errors`);
  return { ...s, rps, errors };
}

function explainMs(sql: string, seq: boolean): number {
  const prefix = seq ? "SET enable_indexscan=off; SET enable_bitmapscan=off;" : "";
  const out = psql(`${prefix} EXPLAIN (ANALYZE, FORMAT JSON) ${sql};`);
  // psql prints "SET" lines first, then the multi-line JSON plan.
  const json = JSON.parse(out.slice(out.indexOf("[")));
  return json[0]["Execution Time"] as number;
}

async function main() {
  const cfg = await loadConfig();
  const c = new Client(generatePrivateKey(), cfg);
  await c.login();
  const owner = c.lower;

  console.log(`Inserting ${ROWS.toLocaleString()} synthetic files for ${owner}…`);
  psql(`
    INSERT INTO files (owner, cid, status, encrypted, title, mime, size_bytes, width, height, tags, chain_file_id, confirmed_at)
    SELECT '${owner}', 'bench-' || g, 'confirmed', g % 3 <> 0,
           (ARRAY['sunset','harbor','mountain','portrait','street','forest','beach','festival','snow','desert'])[1 + g % 10]
             || ' ' || (ARRAY['morning','evening','trip','study','walk','party','view','light'])[1 + (g / 10) % 8] || ' ' || g,
           'image/jpeg', 500000 + g % 1000000, 1600, 1067,
           ARRAY[(ARRAY['travel','family','work','pets','food','nature','city','art'])[1 + g % 8]] || CASE WHEN g % 10000 = 0 THEN ARRAY['archive'] ELSE '{}'::text[] END,
           g, now()
    FROM generate_series(1, ${ROWS}) g;
    ANALYZE files;`);

  try {
    // Deep-page cursor: roughly the middle of the dataset.
    const mid = Number(psql(`SELECT id FROM files WHERE owner='${owner}' ORDER BY id DESC OFFSET ${Math.floor(ROWS / 2)} LIMIT 1;`).trim());
    const words = ["sunset", "harbor", "mountain", "festival", "desert evening", "snow walk"];
    console.log(`\nLoad: ${CONCURRENCY} concurrent clients × ${DURATION_MS / 1000}s per endpoint, via nginx`);
    const api = {
      listFirstPage: await hammer(c, "list (first page)", () => `/files?limit=40`),
      listDeepPage: await hammer(c, "list (deep cursor)", () => `/files?limit=40&cursor=${mid}`),
      search: await hammer(c, "full-text search", (i) => `/files?q=${encodeURIComponent(words[i % words.length])}`),
      tagFilter: await hammer(c, "tag filter", (i) => `/files?tag=${["travel", "pets", "art"][i % 3]}`),
    };

    console.log("\nSearch query plans (EXPLAIN ANALYZE, median of 5):");
    const med = (f: () => number) => stats(Array.from({ length: 5 }, f)).p50;
    const queries = {
      // Common terms match ~10% of rows; rare terms match a handful (typical of real searches).
      fuzzyCommon: `SELECT id FROM files WHERE title ILIKE '%estiva%'`,
      fuzzyRare: `SELECT id FROM files WHERE title ILIKE '%99991%'`,
      fullTextCommon: `SELECT id FROM files WHERE search @@ websearch_to_tsquery('simple','harbor')`,
      fullTextRare: `SELECT id FROM files WHERE search @@ websearch_to_tsquery('simple','99991')`,
      tagCommon: `SELECT id FROM files WHERE tags @> ARRAY['pets']`,
      tagRare: `SELECT id FROM files WHERE tags @> ARRAY['archive']`,
    };
    const search: Record<string, { indexedMs: number; seqScanMs: number; speedup: number }> = {};
    for (const [k, sql] of Object.entries(queries)) {
      const idx = med(() => explainMs(sql, false));
      const seq = med(() => explainMs(sql, true));
      search[k] = { indexedMs: round(idx, 2), seqScanMs: round(seq, 2), speedup: round(seq / idx, 1) };
      console.log(`  ${k.padEnd(15)} indexed ${round(idx, 2)} ms · seq scan ${round(seq, 2)} ms · ${round(seq / idx, 1)}×`);
    }

    const result = { measuredAt: new Date().toISOString(), rows: ROWS, concurrency: CONCURRENCY, durationMs: DURATION_MS, api, search };
    const out = path.resolve(import.meta.dirname, "../out/load.json");
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify(result, null, 2) + "\n");
    console.log(`\n-> ${out}`);
  } finally {
    psql(`DELETE FROM files WHERE owner='${owner}'; DELETE FROM users WHERE address='${owner}';`);
    console.log("Synthetic rows removed.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
