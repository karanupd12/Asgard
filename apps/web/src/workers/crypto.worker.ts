/// <reference lib="webworker" />
// Off-main-thread crypto: fetch + AES-GCM decrypt (gallery) and encrypt (uploads), so large
// images never jank scrolling.
import { decryptBytes, encryptBytes } from "@asgard/shared/crypto";

type Req =
  | { id: number; op: "decrypt"; url: string; key: Uint8Array; mime: string }
  | { id: number; op: "encrypt"; data: ArrayBuffer; key: Uint8Array };

self.onmessage = async (e: MessageEvent<Req>) => {
  const req = e.data;
  try {
    if (req.op === "decrypt") {
      const res = await fetch(req.url);
      if (!res.ok) throw new Error(`gateway ${res.status}`);
      const plain = await decryptBytes(req.key, await res.arrayBuffer());
      self.postMessage({ id: req.id, ok: true, result: new Blob([plain], { type: req.mime }) });
    } else {
      const ct = await encryptBytes(req.key, req.data);
      self.postMessage({ id: req.id, ok: true, result: ct }, [ct.buffer]);
    }
  } catch (err) {
    self.postMessage({ id: req.id, ok: false, error: String((err as Error)?.message ?? err) });
  }
};
