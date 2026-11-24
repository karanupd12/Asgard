// A small pool of crypto workers plus an LRU cache of decrypted object URLs.

type Pending = { resolve: (v: unknown) => void; reject: (e: Error) => void };

const size = Math.min(Math.max(navigator.hardwareConcurrency ?? 2, 2), 4);
const workers: Worker[] = [];
const pending = new Map<number, Pending>();
let nextId = 1;
let rr = 0;

function worker(): Worker {
  if (workers.length < size) {
    const w = new Worker(new URL("../workers/crypto.worker.ts", import.meta.url), { type: "module" });
    w.onmessage = (e) => {
      const { id, ok, result, error } = e.data;
      const p = pending.get(id);
      if (!p) return;
      pending.delete(id);
      ok ? p.resolve(result) : p.reject(new Error(error));
    };
    workers.push(w);
    return w;
  }
  return workers[rr++ % workers.length];
}

function call<T>(msg: Record<string, unknown>, transfer: Transferable[] = []): Promise<T> {
  const id = nextId++;
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
    worker().postMessage({ ...msg, id }, transfer);
  });
}

export const encryptInWorker = (data: ArrayBuffer, key: Uint8Array) =>
  call<Uint8Array>({ op: "encrypt", data, key }, [data]);

// ---- decrypted image cache (CIDs are immutable, so a CID is a perfect cache key)
const MAX_URLS = 300;
const urlCache = new Map<string, string>();
const inflight = new Map<string, Promise<string>>();

export function decryptedUrl(cid: string, url: string, key: Uint8Array, mime: string): Promise<string> {
  const hit = urlCache.get(cid);
  if (hit) {
    urlCache.delete(cid); // refresh LRU position
    urlCache.set(cid, hit);
    return Promise.resolve(hit);
  }
  const running = inflight.get(cid);
  if (running) return running;

  const p = call<Blob>({ op: "decrypt", url, key, mime })
    .then((blob) => {
      const objectUrl = URL.createObjectURL(blob);
      urlCache.set(cid, objectUrl);
      if (urlCache.size > MAX_URLS) {
        const [oldCid, oldUrl] = urlCache.entries().next().value as [string, string];
        urlCache.delete(oldCid);
        URL.revokeObjectURL(oldUrl);
      }
      return objectUrl;
    })
    .finally(() => inflight.delete(cid));
  inflight.set(cid, p);
  return p;
}
