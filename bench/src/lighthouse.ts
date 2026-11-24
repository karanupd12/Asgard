// Metric #5: Lighthouse performance of the production build served by nginx.
// Uses the locally installed Chrome (CHROME_PATH to override).
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { BASE } from "./client.js";

const CHROME =
  process.env.CHROME_PATH ??
  (process.platform === "win32"
    ? "C:/Program Files/Google/Chrome/Application/chrome.exe"
    : process.platform === "darwin"
      ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
      : "/usr/bin/google-chrome");

const pages = [
  { name: "Landing (/)", url: `${BASE}/` },
  { name: "Vault shell (/app)", url: `${BASE}/app` },
];

function run(url: string, formFactor: "mobile" | "desktop") {
  const out = path.join(os.tmpdir(), `lh-${Date.now()}.json`);
  const args = [
    "-y", "lighthouse@12.2.1", url,
    "--only-categories=performance", "--output=json", `--output-path=${out}`, "--quiet",
    `--chrome-path=${CHROME}`, "--chrome-flags=--headless=new --no-sandbox",
    ...(formFactor === "desktop" ? ["--preset=desktop"] : []),
  ];
  execFileSync(process.platform === "win32" ? "npx.cmd" : "npx", args, { stdio: "inherit", shell: process.platform === "win32" });
  const r = JSON.parse(fs.readFileSync(out, "utf8"));
  fs.rmSync(out, { force: true });
  const a = r.audits;
  const jsBytes = (a["resource-summary"]?.details?.items ?? []).find((i: { resourceType: string }) => i.resourceType === "script")?.transferSize ?? 0;
  return {
    score: Math.round(r.categories.performance.score * 100),
    lcpMs: Math.round(a["largest-contentful-paint"].numericValue),
    fcpMs: Math.round(a["first-contentful-paint"].numericValue),
    tbtMs: Math.round(a["total-blocking-time"].numericValue),
    cls: Number(a["cumulative-layout-shift"].numericValue.toFixed(3)),
    jsKb: Math.round(jsBytes / 1024),
  };
}

const formFactor = (process.env.FORM_FACTOR as "mobile" | "desktop") ?? "desktop";
const results = pages.map((p) => ({ name: p.name, ...run(p.url, formFactor) }));
const outFile = path.resolve(import.meta.dirname, "../out/lighthouse.json");
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify({ measuredAt: new Date().toISOString(), formFactor, pages: results }, null, 2) + "\n");
console.table(results);
