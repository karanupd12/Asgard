// Captures README screenshots from the running, seeded stack using the local Chrome.
// Logs in through the real UI with the "Dev #1" wallet (no extension needed on the local chain).
//   pnpm seed && pnpm screenshots
import fs from "node:fs";
import path from "node:path";
import { chromium, type Page } from "playwright-core";
import { BASE } from "./client.js";

const CHROME =
  process.env.CHROME_PATH ??
  (process.platform === "win32" ? "C:/Program Files/Google/Chrome/Application/chrome.exe" : "/usr/bin/google-chrome");
const OUT = path.resolve(import.meta.dirname, "../../docs/screenshots");

const shot = async (page: Page, name: string) => {
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  console.log(`  📸 ${name}.png`);
};

async function waitImages(page: Page) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(800);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5, colorScheme: "light" });
  const page = await ctx.newPage();

  await page.goto(BASE);
  await page.getByRole("heading", { name: /Private photo storage/ }).waitFor();
  await shot(page, "01-landing");

  await page.goto(`${BASE}/app`);
  await page.getByRole("button", { name: "Connect wallet" }).click();
  await page.getByRole("button", { name: /Dev #1/ }).click();
  await page.getByRole("button", { name: "Sign in with Ethereum" }).click();
  await page.getByRole("heading", { name: "Photos", level: 1 }).waitFor({ timeout: 30_000 });

  // Unlock the vault (signature via the dev wallet), then let thumbnails decrypt.
  await page.getByRole("button", { name: "Unlock vault" }).click();
  await page.waitForFunction(() => !document.body.innerText.includes("sealed."), null, { timeout: 30_000 });
  await waitImages(page);
  await shot(page, "02-gallery");

  await page.locator("img[alt='Moraine Lake']").click();
  await waitImages(page);
  await shot(page, "03-lightbox");
  await page.keyboard.press("Escape");

  await page.getByRole("link", { name: "Albums" }).first().click();
  await waitImages(page);
  await shot(page, "04-albums");

  await page.getByRole("link", { name: "Sharing" }).first().click();
  await page.getByText("People with access").waitFor();
  await page.waitForTimeout(1500);
  await shot(page, "05-sharing");

  await page.getByRole("link", { name: "Shared with me" }).first().click();
  await page.locator("a[href^='/app/shared/0x']").first().click();
  await waitImages(page);
  await shot(page, "06-shared-with-me");

  // In-app navigation (a full reload would drop the in-memory vault keys by design).
  await page.getByRole("link", { name: "Photos" }).first().click();
  await page.getByRole("button", { name: /#travel/ }).click();
  await waitImages(page);
  await shot(page, "07-search-tag");

  // Upload dialog with files queued (not submitted) to show batching + gas estimate.
  await page.getByRole("button", { name: "Upload", exact: true }).first().click();
  const samples = [];
  for (const id of ["1464822759023-fed622ff2c3b", "1519681393784-d120267933ba", "1543466835-00a7907e9de1", "1502602898657-3e91760cbb34"]) {
    const buf = Buffer.from(await (await fetch(`https://images.unsplash.com/photo-${id}?w=800&q=70&fm=jpg`)).arrayBuffer());
    samples.push({ name: `${id}.jpg`, mimeType: "image/jpeg", buffer: buf });
  }
  await page.locator("dialog input[type=file]").first().setInputFiles(samples);
  await page.waitForTimeout(1200);
  await shot(page, "08-upload");

  // Mobile
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: "light", storageState: await ctx.storageState() });
  const m = await mobile.newPage();
  await m.goto(BASE);
  await m.waitForTimeout(800);
  await m.screenshot({ path: path.join(OUT, "09-mobile-landing.png") });
  console.log("  📸 09-mobile-landing.png");

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
