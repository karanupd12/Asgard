// Renders docs/architecture.drawio to docs/architecture.svg using draw.io's official viewer
// (viewer.diagrams.net) in the local headless Chrome. No draw.io desktop install needed.
//   pnpm export-diagram
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const CHROME =
  process.env.CHROME_PATH ??
  (process.platform === "win32" ? "C:/Program Files/Google/Chrome/Application/chrome.exe" : "/usr/bin/google-chrome");
const docs = path.resolve(import.meta.dirname, "../../docs");

async function main() {
  const xml = fs.readFileSync(path.join(docs, "architecture.drawio"), "utf8");
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const page = await browser.newPage();
  await page.setContent(`<!doctype html><html><body><div id="c"></div></body></html>`);
  await page.addScriptTag({ url: "https://viewer.diagrams.net/js/viewer-static.min.js" });
  await page.waitForFunction(() => typeof (window as any).Graph === "function", null, { timeout: 60_000 });

  const svg = await page.evaluate((source) => {
    const w = window as any;
    const doc = w.mxUtils.parseXml(source);
    const model = doc.getElementsByTagName("mxGraphModel")[0];
    const graph = new w.Graph(document.getElementById("c"));
    new w.mxCodec(model.ownerDocument).decode(model, graph.getModel());
    const root = graph.getSvg("#ffffff", 1, 16, false, null, true);
    return '<?xml version="1.0" encoding="UTF-8"?>\n' + w.mxUtils.getXml(root);
  }, xml);

  await browser.close();
  const out = path.join(docs, "architecture.svg");
  fs.writeFileSync(out, svg);
  console.log(`wrote ${out} (${(svg.length / 1024).toFixed(1)} KB)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
