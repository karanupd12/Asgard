import type { MissingKey, VaultFile } from "@asgard/shared";
import { toHex, unwrapKey, wrapKey } from "@asgard/shared/crypto";
import { useCallback } from "react";
import { api } from "@/lib/api";
import { useVault } from "@/providers/VaultProvider";

/**
 * Shares encrypted file keys with current viewers: for every (file, viewer) pair the API says is
 * missing, unwrap our own copy of the file key and re-wrap it for the viewer's public key.
 * Runs after uploads and grants; viewers who haven't registered a key yet are picked up later.
 */
export function useKeySync() {
  const { unlock } = useVault();

  return useCallback(async (): Promise<number> => {
    const { missing } = await api.get<{ missing: MissingKey[] }>("/keys/missing");
    if (missing.length === 0) return 0;
    const kp = await unlock();
    const myPub = toHex(kp.publicKey);

    const pubs = new Map<string, string>();
    for (const r of new Set(missing.map((m) => m.recipient))) {
      const { publicKey } = await api.get<{ publicKey: string }>(`/keys/${r}`);
      pubs.set(r, publicKey);
    }

    const byFile = new Map<number, MissingKey[]>();
    for (const m of missing) byFile.set(m.fileId, [...(byFile.get(m.fileId) ?? []), m]);

    const keys: { fileId: number; recipient: string; wrappedKey: string }[] = [];
    for (const [fileId, entries] of byFile) {
      const file = await api.get<VaultFile>(`/files/${fileId}`);
      if (!file.wrappedKey) continue;
      const fileKey = await unwrapKey(file.wrappedKey, kp.privateKey, myPub);
      for (const e of entries) {
        keys.push({ fileId, recipient: e.recipient, wrappedKey: await wrapKey(fileKey, kp.privateKey, pubs.get(e.recipient)!) });
      }
    }
    if (keys.length) await api.post("/keys/wrapped", { keys });
    return keys.length;
  }, [unlock]);
}
