import type { VaultFile } from "@asgard/shared";
import {
  deriveKeyPair,
  KEY_DERIVATION_MESSAGE,
  toHex,
  unwrapKey,
  type KeyPair,
} from "@asgard/shared/crypto";
import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { api } from "@/lib/api";
import { useSession } from "@/hooks/useSession";

/**
 * Holds the user's X25519 keypair in memory only (never persisted). It is derived from a
 * wallet signature on demand ("unlock"), and reset whenever the account changes.
 */
interface VaultCtx {
  keys: KeyPair | null;
  publicKeyHex: string | null;
  unlocking: boolean;
  unlock: () => Promise<KeyPair>;
  fileKey: (file: VaultFile, ownerPublicKey: string | null) => Promise<Uint8Array>;
}

const Ctx = createContext<VaultCtx | null>(null);

export function useVault(): VaultCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useVault outside VaultProvider");
  return v;
}

export function VaultProvider({ children }: { children: ReactNode }) {
  const { address } = useAccount();
  const { me } = useSession();
  const { signMessageAsync } = useSignMessage();
  const qc = useQueryClient();

  const [keys, setKeys] = useState<KeyPair | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  const unlockPromise = useRef<Promise<KeyPair> | null>(null);
  const fileKeys = useRef(new Map<number, Promise<Uint8Array>>());

  useEffect(() => {
    setKeys(null);
    unlockPromise.current = null;
    fileKeys.current.clear();
  }, [address]);

  const unlock = useCallback(async () => {
    if (keys) return keys;
    if (unlockPromise.current) return unlockPromise.current;
    unlockPromise.current = (async () => {
      setUnlocking(true);
      try {
        const sig = await signMessageAsync({ message: KEY_DERIVATION_MESSAGE });
        const kp = deriveKeyPair(sig);
        const pub = toHex(kp.publicKey);
        if (me?.publicKey !== pub) {
          await api.put("/me/key", { publicKey: pub });
          qc.invalidateQueries({ queryKey: ["me"] });
        }
        setKeys(kp);
        return kp;
      } catch (e) {
        unlockPromise.current = null;
        throw e;
      } finally {
        setUnlocking(false);
      }
    })();
    return unlockPromise.current;
  }, [keys, me?.publicKey, qc, signMessageAsync]);

  const fileKey = useCallback(
    (file: VaultFile, ownerPublicKey: string | null) => {
      const cached = fileKeys.current.get(file.id);
      if (cached) return cached;
      if (!keys) return Promise.reject(new Error("vault locked"));
      if (!file.wrappedKey) return Promise.reject(new Error("no key shared for this file yet"));
      const ownerPub = ownerPublicKey ?? toHex(keys.publicKey);
      const p = unwrapKey(file.wrappedKey, keys.privateKey, ownerPub);
      p.catch(() => fileKeys.current.delete(file.id));
      fileKeys.current.set(file.id, p);
      return p;
    },
    [keys],
  );

  const value = useMemo<VaultCtx>(
    () => ({ keys, publicKeyHex: keys ? toHex(keys.publicKey) : null, unlocking, unlock, fileKey }),
    [keys, unlocking, unlock, fileKey],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
