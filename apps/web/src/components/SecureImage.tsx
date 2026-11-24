import type { VaultFile } from "@asgard/shared";
import { ImageOff, Lock } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { decryptedUrl } from "@/lib/crypto-pool";
import { cn } from "@/lib/utils";
import { useApp } from "@/providers/AppProviders";
import { useVault } from "@/providers/VaultProvider";
import { frostStyle } from "./ui";

function useInView<T extends Element>(rootMargin = "600px") {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setInView(true), { rootMargin });
    io.observe(el);
    return () => io.disconnect();
  }, [inView, rootMargin]);
  return [ref, inView] as const;
}

/**
 * A vault photo. Plaintext loads straight from the gateway (immutable, cached by CID).
 * Encrypted photos show as frosted glass until the vault is unlocked; then they are fetched,
 * decrypted in a worker once scrolled into view, and "thaw" into focus.
 * Fills its parent — callers size the container.
 */
export function SecureImage({
  file,
  ownerPublicKey,
  variant = "thumb",
  className,
  imgClassName,
}: {
  file: VaultFile;
  ownerPublicKey: string | null;
  variant?: "thumb" | "full";
  className?: string;
  imgClassName?: string;
}) {
  const { gatewayUrl } = useApp();
  const { keys, fileKey } = useVault();
  const [ref, inView] = useInView<HTMLDivElement>();
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const cid = variant === "thumb" ? (file.thumbCid ?? file.cid) : file.cid;
  const mime = variant === "thumb" && file.thumbCid ? "image/webp" : file.mime;
  const sealed = file.encrypted && !keys;

  useEffect(() => {
    setError(null);
    if (!inView) return;
    if (!file.encrypted) {
      setSrc(gatewayUrl(cid));
      return;
    }
    if (!keys) return;
    let cancelled = false;
    fileKey(file, ownerPublicKey)
      .then((k) => decryptedUrl(cid, gatewayUrl(cid), k, mime))
      .then((u) => !cancelled && setSrc(u))
      .catch((e) => !cancelled && setError(String(e.message ?? e)));
    return () => {
      cancelled = true;
    };
  }, [inView, keys, cid, file, ownerPublicKey, fileKey, gatewayUrl, mime]);

  const showFrost = file.encrypted && !loaded && !error;

  return (
    <div ref={ref} className={cn("relative overflow-hidden", variant === "thumb" && "h-full w-full", className)}>
      {showFrost && (
        <div className="frost-grain absolute inset-0" aria-hidden>
          <div className="frost-tint absolute inset-0" style={frostStyle(file.cid)} />
        </div>
      )}
      {!file.encrypted && !loaded && !error && <div className="skeleton absolute inset-0" />}
      {sealed && (
        <span className="absolute bottom-2 left-2 rounded-full bg-fg/55 p-1.5 text-white backdrop-blur-sm" title="Sealed — unlock your vault to view">
          <Lock className="h-3 w-3" />
        </span>
      )}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-surface-2 p-3 text-center text-muted">
          <ImageOff className="h-5 w-5" />
          <span className="text-xs">{error.includes("no key") ? "Owner hasn't shared the key yet" : "Couldn't load this photo"}</span>
        </div>
      )}
      {src && !error && (
        <img
          src={src}
          alt={file.title || "Untitled photo"}
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setError("load failed")}
          data-ready={loaded}
          className={cn(
            variant === "thumb" ? "h-full w-full object-cover" : "block",
            file.encrypted ? "thaw" : cn("transition-opacity duration-300", loaded ? "opacity-100" : "opacity-0"),
            imgClassName,
          )}
        />
      )}
    </div>
  );
}
