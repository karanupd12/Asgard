// A headless Asgard client: same protocol as the web app (SIWE, client-side encryption,
// multipart upload, batched addFiles), driven by a private key. Used by e2e, seed and benchmarks.
import { asgardVaultAbi, type FilePage, type MissingKey, type RuntimeConfig, type UploadResult, type VaultFile } from "@asgard/shared";
import {
  deriveKeyPair,
  encryptBytes,
  generateFileKey,
  KEY_DERIVATION_MESSAGE,
  toHex,
  unwrapKey,
  wrapKey,
  type KeyPair,
} from "@asgard/shared/crypto";
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  getAddress,
  http,
  type Address,
  type Chain,
  type Hex,
  type TransactionReceipt,
} from "viem";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import { polygonAmoy } from "viem/chains";

export const BASE = process.env.BASE_URL ?? "http://localhost:3000";

// Anvil/Hardhat well-known dev keys (public; local chain only).
export const DEV_KEYS: Hex[] = [
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
];

export async function loadConfig(): Promise<RuntimeConfig> {
  const r = await fetch(`${BASE}/api/config`);
  if (!r.ok) throw new Error(`GET /api/config -> ${r.status}. Is the stack up? (docker compose up)`);
  return r.json() as Promise<RuntimeConfig>;
}

export function chainFor(cfg: RuntimeConfig): Chain {
  if (cfg.chainId === polygonAmoy.id) {
    return process.env.RPC_URL
      ? { ...polygonAmoy, rpcUrls: { default: { http: [process.env.RPC_URL] } } }
      : polygonAmoy;
  }
  return defineChain({
    id: cfg.chainId,
    name: "Asgard Local",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [process.env.RPC_URL ?? `${BASE}/rpc`] } },
  });
}

export class HttpError extends Error {
  constructor(
    public status: number,
    msg: string,
  ) {
    super(`${status}: ${msg}`);
  }
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class Client {
  readonly account: PrivateKeyAccount;
  readonly address: Address;
  readonly chain: Chain;
  readonly pub;
  readonly wallet;
  cookie = "";
  keys: KeyPair | null = null;

  constructor(
    pk: Hex,
    readonly cfg: RuntimeConfig,
  ) {
    this.account = privateKeyToAccount(pk);
    this.address = this.account.address;
    this.chain = chainFor(cfg);
    this.pub = createPublicClient({ chain: this.chain, transport: http() });
    this.wallet = createWalletClient({ account: this.account, chain: this.chain, transport: http() });
  }

  get lower() {
    return this.address.toLowerCase();
  }

  async req<T>(method: string, path: string, body?: unknown): Promise<T> {
    const isForm = body instanceof FormData;
    const res = await fetch(`${BASE}/api${path}`, {
      method,
      headers: {
        ...(this.cookie ? { Cookie: this.cookie } : {}),
        ...(body !== undefined && !isForm ? { "Content-Type": "application/json" } : {}),
      },
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
    });
    const set = res.headers.getSetCookie?.() ?? [];
    for (const c of set) if (c.startsWith("asgard_session=")) this.cookie = c.split(";")[0];
    if (res.status === 204) return undefined as T;
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) throw new HttpError(res.status, data.error ?? res.statusText);
    return data as T;
  }

  /** Sign-In With Ethereum. */
  async login() {
    const { nonce } = await this.req<{ nonce: string }>("POST", "/auth/nonce", {});
    const host = new URL(BASE).host;
    const message = [
      `${host} wants you to sign in with your Ethereum account:`,
      getAddress(this.address),
      "",
      "Sign in to Asgard. This request will not trigger a transaction or cost gas.",
      "",
      `URI: ${BASE}`,
      "Version: 1",
      `Chain ID: ${this.cfg.chainId}`,
      `Nonce: ${nonce}`,
      `Issued At: ${new Date().toISOString()}`,
    ].join("\n");
    const signature = await this.account.signMessage({ message });
    await this.req("POST", "/auth/verify", { message, signature });
  }

  /** Derive the vault keypair (same deterministic signature as the browser) and publish the pubkey. */
  async unlock(): Promise<KeyPair> {
    if (this.keys) return this.keys;
    const sig = await this.account.signMessage({ message: KEY_DERIVATION_MESSAGE });
    this.keys = deriveKeyPair(sig);
    await this.req("PUT", "/me/key", { publicKey: toHex(this.keys.publicKey) });
    return this.keys;
  }

  async upload(opts: {
    bytes: Uint8Array;
    thumb?: Uint8Array;
    mime: string;
    width?: number;
    height?: number;
    title: string;
    tags?: string[];
    encrypt: boolean;
  }): Promise<UploadResult & { timings: { encryptMs: number; pinMs: number } }> {
    const t0 = performance.now();
    let body = opts.bytes;
    let thumb = opts.thumb;
    let wrappedKey: string | undefined;
    if (opts.encrypt) {
      const kp = await this.unlock();
      const key = generateFileKey();
      body = await encryptBytes(key, opts.bytes);
      if (thumb) thumb = await encryptBytes(key, thumb);
      wrappedKey = await wrapKey(key, kp.privateKey, toHex(kp.publicKey));
    }
    const t1 = performance.now();

    const form = new FormData();
    form.append(
      "meta",
      JSON.stringify({
        title: opts.title,
        mime: opts.mime,
        sizeBytes: opts.bytes.byteLength,
        width: opts.width,
        height: opts.height,
        encrypted: opts.encrypt,
        tags: opts.tags ?? [],
        wrappedKey,
      }),
    );
    form.append("file", new Blob([body as BlobPart]), "file");
    if (thumb) form.append("thumb", new Blob([thumb as BlobPart]), "thumb");
    const res = await this.req<UploadResult>("POST", "/uploads", form);
    return { ...res, timings: { encryptMs: t1 - t0, pinMs: performance.now() - t1 } };
  }

  async addFiles(items: UploadResult[]): Promise<TransactionReceipt> {
    const hash = await this.wallet.writeContract({
      address: this.cfg.contractAddress,
      abi: asgardVaultAbi,
      functionName: "addFiles",
      args: [items.map((i) => i.digest), items.map((i) => BigInt(i.codec)), items.map((i) => i.file.encrypted)],
    });
    return this.waitReceipt(hash);
  }

  async grant(viewer: Address) {
    return this.waitReceipt(
      await this.wallet.writeContract({ address: this.cfg.contractAddress, abi: asgardVaultAbi, functionName: "grantAccess", args: [viewer] }),
    );
  }

  async revoke(viewer: Address) {
    return this.waitReceipt(
      await this.wallet.writeContract({ address: this.cfg.contractAddress, abi: asgardVaultAbi, functionName: "revokeAccess", args: [viewer] }),
    );
  }

  hasAccess(owner: Address, viewer: Address) {
    return this.pub.readContract({ address: this.cfg.contractAddress, abi: asgardVaultAbi, functionName: "hasAccess", args: [owner, viewer] });
  }

  async waitReceipt(hash: Hex) {
    const r = await this.pub.waitForTransactionReceipt({ hash, pollingInterval: 250 });
    if (r.status !== "success") throw new Error(`tx ${hash} reverted`);
    return r;
  }

  /** Wait until the indexer has mirrored these files as confirmed. */
  async waitConfirmed(fileIds: number[], timeoutMs = 120_000) {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const files = await Promise.all(fileIds.map((id) => this.req<VaultFile>("GET", `/files/${id}`)));
      if (files.every((f) => f.status === "confirmed")) return files;
      if (Date.now() > deadline) throw new Error("timed out waiting for indexer");
      await sleep(200);
    }
  }

  /** Poll until a predicate on an API call holds (indexer is eventually consistent). */
  async until<T>(fn: () => Promise<T>, ok: (v: T) => boolean, timeoutMs = 60_000): Promise<T> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      try {
        const v = await fn();
        if (ok(v)) return v;
      } catch {
        /* retry */
      }
      if (Date.now() > deadline) throw new Error("timed out waiting for condition");
      await sleep(250);
    }
  }

  list(params: Record<string, string | number> = {}) {
    const q = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString();
    return this.req<FilePage>("GET", `/files${q ? `?${q}` : ""}`);
  }

  /** Same algorithm as the web app's useKeySync. */
  async syncKeys(): Promise<number> {
    const { missing } = await this.req<{ missing: MissingKey[] }>("GET", "/keys/missing");
    if (!missing.length) return 0;
    const kp = await this.unlock();
    const myPub = toHex(kp.publicKey);
    const keys = [];
    for (const m of missing) {
      const [{ publicKey }, file] = await Promise.all([
        this.req<{ publicKey: string }>("GET", `/keys/${m.recipient}`),
        this.req<VaultFile>("GET", `/files/${m.fileId}`),
      ]);
      const fk = await unwrapKey(file.wrappedKey!, kp.privateKey, myPub);
      keys.push({ fileId: m.fileId, recipient: m.recipient, wrappedKey: await wrapKey(fk, kp.privateKey, publicKey) });
    }
    await this.req("POST", "/keys/wrapped", { keys });
    return keys.length;
  }

  /** Download a file from the gateway and decrypt it as this user. */
  async download(file: VaultFile, ownerPublicKey: string | null): Promise<Uint8Array> {
    const res = await fetch(new URL(this.cfg.gatewayUrl + file.cid, BASE));
    if (!res.ok) throw new Error(`gateway ${res.status}`);
    const data = new Uint8Array(await res.arrayBuffer());
    if (!file.encrypted) return data;
    const kp = await this.unlock();
    const fk = await unwrapKey(file.wrappedKey!, kp.privateKey, ownerPublicKey ?? toHex(kp.publicKey));
    const { decryptBytes } = await import("@asgard/shared/crypto");
    return new Uint8Array(await decryptBytes(fk, data));
  }
}

export function stats(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b);
  const q = (p: number) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  const mean = s.reduce((a, b) => a + b, 0) / s.length;
  return { n: s.length, mean: round(mean), p50: round(q(0.5)), p95: round(q(0.95)), p99: round(q(0.99)), min: round(s[0]), max: round(s[s.length - 1]) };
}

export const round = (x: number, d = 1) => Math.round(x * 10 ** d) / 10 ** d;
