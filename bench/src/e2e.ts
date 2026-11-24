// End-to-end smoke test against the running stack: auth, encrypted upload, on-chain register,
// indexing, search, grant -> decrypt as viewer, revoke -> denied, input validation.
//   pnpm e2e        (requires `docker compose up`)
import { Client, DEV_KEYS, HttpError, loadConfig } from "./client.js";

// 1x1 PNG
const PNG = Uint8Array.from(
  Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"),
);

let passed = 0;
const step = async (name: string, fn: () => Promise<void>) => {
  const t = performance.now();
  await fn();
  passed++;
  console.log(`  ✓ ${name} (${Math.round(performance.now() - t)} ms)`);
};
const assert = (cond: unknown, msg: string) => {
  if (!cond) throw new Error(`assertion failed: ${msg}`);
};
const expectStatus = async (p: Promise<unknown>, status: number) => {
  try {
    await p;
  } catch (e) {
    if (e instanceof HttpError && e.status === status) return;
    throw e;
  }
  throw new Error(`expected HTTP ${status}`);
};

async function main() {
  const cfg = await loadConfig();
  console.log(`E2E against chain ${cfg.chainId}, contract ${cfg.contractAddress}, storage ${cfg.storageProvider}\n`);
  const owner = new Client(DEV_KEYS[2], cfg);
  const viewer = new Client(DEV_KEYS[1], cfg);
  const tag = `e2e${Date.now().toString(36)}`;

  // Clean slate if a previous run aborted mid-way.
  if (await owner.hasAccess(owner.address, viewer.address)) await owner.revoke(viewer.address);

  await step("unauthenticated requests are rejected", async () => {
    await expectStatus(owner.req("GET", "/me"), 401);
    await expectStatus(owner.req("POST", "/uploads", new FormData()), 401);
  });

  await step("SIWE login (owner + viewer)", async () => {
    await owner.login();
    await viewer.login();
    const me = await owner.req<{ address: string }>("GET", "/me");
    assert(me.address === owner.lower, "session address matches wallet");
  });

  await step("non-image plaintext upload is rejected", async () => {
    await expectStatus(owner.upload({ bytes: new TextEncoder().encode("not an image"), mime: "image/png", title: "x", encrypt: false }), 415);
  });

  let ids: number[] = [];
  await step("encrypted + public upload -> one addFiles tx -> indexed", async () => {
    const enc = await owner.upload({ bytes: PNG, thumb: PNG, mime: "image/png", width: 1, height: 1, title: "E2E secret sunset", tags: [tag], encrypt: true });
    const pub = await owner.upload({ bytes: PNG, mime: "image/png", width: 1, height: 1, title: "E2E public", tags: [tag], encrypt: false });
    assert(enc.file.status === "pending" && enc.digest.length === 66, "pending row + bytes32 digest");
    const receipt = await owner.addFiles([enc, pub]);
    console.log(`      addFiles gasUsed=${receipt.gasUsed}`);
    ids = [enc.file.id, pub.file.id];
    const files = await owner.waitConfirmed(ids);
    assert(files.every((f) => f.chainFileId !== null && f.txHash), "confirmed with chain ids");
  });

  await step("owner decrypts own file; ciphertext on IPFS differs from plaintext", async () => {
    const page = await owner.list({ tag });
    const enc = page.files.find((f) => f.encrypted)!;
    const plain = await owner.download(enc, page.ownerPublicKey);
    assert(Buffer.from(plain).equals(Buffer.from(PNG)), "round-trip equals original");
    const raw = new Uint8Array(await (await fetch(new URL(cfg.gatewayUrl + enc.cid, process.env.BASE_URL ?? "http://localhost:3000"))).arrayBuffer());
    assert(!Buffer.from(raw).equals(Buffer.from(PNG)), "gateway serves ciphertext only");
  });

  await step("search by title and tag", async () => {
    assert((await owner.list({ q: "sunset", tag })).files.length === 1, "full-text 'sunset'");
    assert((await owner.list({ q: "sunse" })).files.some((f) => f.title === "E2E secret sunset"), "fuzzy/prefix");
    assert((await owner.list({ tag })).files.length === 2, "tag filter");
  });

  await step("viewer without grant is denied", async () => {
    await expectStatus(viewer.list({ owner: owner.address }), 403);
  });

  await step("grant on-chain -> indexer -> keys wrapped -> viewer decrypts", async () => {
    await viewer.unlock(); // viewer publishes their public key
    await owner.grant(viewer.address);
    await owner.until(() => owner.req<{ viewers: { address: string }[] }>("GET", "/shares"), (r) => r.viewers.some((v) => v.address === viewer.lower));
    const n = await owner.syncKeys();
    assert(n >= 1, `wrapped ${n} keys`);
    const page = await viewer.list({ owner: owner.address, tag });
    const enc = page.files.find((f) => f.encrypted)!;
    assert(enc.wrappedKey, "viewer received a wrapped key");
    const plain = await viewer.download(enc, page.ownerPublicKey);
    assert(Buffer.from(plain).equals(Buffer.from(PNG)), "viewer decrypts original");
  });

  await step("revoke on-chain -> viewer denied and keys deleted", async () => {
    await owner.revoke(viewer.address);
    await viewer.until(
      () => viewer.list({ owner: owner.address }).then(() => "ok", (e) => (e instanceof HttpError ? e.status : 0)),
      (s) => s === 403,
    );
    await expectStatus(viewer.req("GET", `/files/${ids[0]}`), 404);
  });

  console.log(`\nE2E PASSED (${passed} steps)`);
}

main().catch((e) => {
  console.error(`\nE2E FAILED: ${e.message}`);
  process.exit(1);
});
