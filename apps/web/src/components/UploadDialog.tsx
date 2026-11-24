import type { UploadResult } from "@asgard/shared";
import { generateFileKey, toHex, wrapKey } from "@asgard/shared/crypto";
import { useQueryClient } from "@tanstack/react-query";
import { Check, ImagePlus, Lock, Unlock, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { api, uploadMultipart } from "@/lib/api";
import { explorerTx } from "@/lib/chain";
import { encryptInWorker } from "@/lib/crypto-pool";
import { prepareImage } from "@/lib/image";
import { cn, errorMessage, formatBytes } from "@/lib/utils";
import { useAlbums } from "@/hooks/useData";
import { useKeySync } from "@/hooks/useKeySync";
import { useVaultContract } from "@/hooks/useVaultContract";
import { useApp } from "@/providers/AppProviders";
import { useVault } from "@/providers/VaultProvider";
import { TagInput } from "./TagInput";
import { GasIndicator } from "./wallet";
import { Button, Dialog } from "./ui";

const MAX_FILES = 50; // AsgardVault.MAX_BATCH
const CONCURRENCY = 3;

type Status = "queued" | "preparing" | "uploading" | "pinned" | "error";
interface Item {
  key: string;
  file: File;
  preview: string;
  status: Status;
  progress: number;
  result?: UploadResult;
  error?: string;
}

type Phase = "select" | "encrypt" | "upload" | "sign" | "done";
const STEPS: { phase: Phase; label: string }[] = [
  { phase: "encrypt", label: "Encrypt" },
  { phase: "upload", label: "Upload" },
  { phase: "sign", label: "Confirm in wallet" },
  { phase: "done", label: "Saved" },
];

export function UploadDialog({
  open,
  onClose,
  initialFiles,
}: {
  open: boolean;
  onClose: () => void;
  initialFiles?: File[];
}) {
  const { cfg, chain } = useApp();
  const { unlock } = useVault();
  const contract = useVaultContract();
  const syncKeys = useKeySync();
  const albums = useAlbums();
  const qc = useQueryClient();

  const [items, setItems] = useState<Item[]>([]);
  const [encrypt, setEncrypt] = useState(true);
  const [tags, setTags] = useState<string[]>([]);
  const [album, setAlbum] = useState<number | "">("");
  const [phase, setPhase] = useState<Phase>("select");
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback(
    (list: FileList | File[]) => {
      const max = cfg.maxUploadMb * 1024 * 1024;
      const next: Item[] = [];
      for (const f of Array.from(list)) {
        if (!f.type.startsWith("image/")) {
          toast.error(`${f.name} isn't an image. Asgard stores photos and images only.`);
          continue;
        }
        if (f.size > max) {
          toast.error(`${f.name} is larger than ${cfg.maxUploadMb} MB.`);
          continue;
        }
        next.push({ key: crypto.randomUUID(), file: f, preview: URL.createObjectURL(f), status: "queued", progress: 0 });
      }
      setItems((prev) => {
        const merged = [...prev, ...next];
        if (merged.length > MAX_FILES) toast.warning(`You can upload up to ${MAX_FILES} photos at once. The rest were left out.`);
        return merged.slice(0, MAX_FILES);
      });
    },
    [cfg.maxUploadMb],
  );

  useEffect(() => {
    if (open && initialFiles?.length) addFiles(initialFiles);
    if (!open) {
      setItems((prev) => {
        prev.forEach((i) => URL.revokeObjectURL(i.preview));
        return [];
      });
      setPhase("select");
      setTags([]);
      setAlbum("");
    }
  }, [open, initialFiles, addFiles]);

  const patch = (key: string, p: Partial<Item>) => setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...p } : i)));
  const removeItem = (key: string) =>
    setItems((prev) => {
      const it = prev.find((i) => i.key === key);
      if (it) URL.revokeObjectURL(it.preview);
      return prev.filter((i) => i.key !== key);
    });

  const uploadOne = async (item: Item, kp: Awaited<ReturnType<typeof unlock>> | null): Promise<UploadResult> => {
    patch(item.key, { status: "preparing" });
    const { width, height, thumb } = await prepareImage(item.file);

    let fileBody: Blob = item.file;
    let thumbBody: Blob = thumb;
    let wrappedKey: string | undefined;
    if (kp) {
      const key = generateFileKey();
      const [ct, tct] = await Promise.all([
        encryptInWorker(await item.file.arrayBuffer(), key),
        encryptInWorker(await thumb.arrayBuffer(), key),
      ]);
      fileBody = new Blob([ct as BlobPart]);
      thumbBody = new Blob([tct as BlobPart]);
      wrappedKey = await wrapKey(key, kp.privateKey, toHex(kp.publicKey));
    }

    const form = new FormData();
    form.append(
      "meta",
      JSON.stringify({
        title: item.file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").slice(0, 200),
        mime: item.file.type,
        sizeBytes: item.file.size,
        width,
        height,
        encrypted: !!kp,
        tags,
        wrappedKey,
      }),
    );
    form.append("file", fileBody, "file");
    form.append("thumb", thumbBody, "thumb");

    setPhase((p) => (p === "encrypt" ? "upload" : p));
    patch(item.key, { status: "uploading" });
    const result = await uploadMultipart(form, (p) => patch(item.key, { progress: p }));
    patch(item.key, { status: "pinned", progress: 1, result });
    return result;
  };

  const start = async () => {
    setPhase("encrypt");
    try {
      const kp = encrypt ? await unlock() : null;
      const queue = items.filter((i) => i.status !== "pinned");
      const results: UploadResult[] = items.filter((i) => i.result).map((i) => i.result!);
      await Promise.all(
        Array.from({ length: CONCURRENCY }, async () => {
          for (let item = queue.shift(); item; item = queue.shift()) {
            try {
              results.push(await uploadOne(item, kp));
            } catch (e) {
              patch(item.key, { status: "error", error: errorMessage(e) });
            }
          }
        }),
      );
      if (results.length === 0) throw new Error("None of the photos could be uploaded. Check your connection and try again.");

      setPhase("sign");
      qc.invalidateQueries({ queryKey: ["files"] });
      const receipt = await contract.addFiles(
        results.map((r) => ({ digest: r.digest, codec: r.codec, encrypted: r.file.encrypted })),
      );

      if (album !== "") await api.post(`/albums/${album}/files`, { fileIds: results.map((r) => r.file.id) });
      if (kp) syncKeys().catch(() => {});

      setPhase("done");
      const link = explorerTx(chain, receipt.transactionHash);
      toast.success(`Saved ${results.length} ${results.length === 1 ? "photo" : "photos"} to your vault`, {
        action: link ? { label: "View transaction", onClick: () => window.open(link, "_blank") } : undefined,
      });
      for (const k of ["files", "albums", "tags", "me"]) qc.invalidateQueries({ queryKey: [k] });
      setTimeout(onClose, 700);
    } catch (e) {
      toast.error(errorMessage(e));
      setPhase("select");
    }
  };

  const totalBytes = useMemo(() => items.reduce((s, i) => s + i.file.size, 0), [items]);
  const busy = phase !== "select" && phase !== "done";
  const stepIndex = STEPS.findIndex((s) => s.phase === phase);
  const failed = items.filter((i) => i.status === "error").length;

  return (
    <Dialog
      open={open}
      onClose={() => !busy && onClose()}
      title="Upload photos"
      description="Photos are encrypted on this device, stored on IPFS, then saved to your wallet with one transaction."
      className="max-w-2xl"
    >
      <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={(e) => (e.target.files && addFiles(e.target.files), (e.target.value = ""))} />

      {items.length === 0 ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => (e.preventDefault(), setDragging(true))}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            addFiles(e.dataTransfer.files);
          }}
          className={cn(
            "flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-16 text-center transition-colors",
            dragging ? "border-accent bg-accent-soft" : "border-border hover:border-accent/60",
          )}
        >
          <ImagePlus className="mb-3 h-8 w-8 text-accent" />
          <span className="font-semibold">Choose photos or drop them here</span>
          <span className="mt-1 text-sm text-muted">
            Up to {MAX_FILES} at a time, {cfg.maxUploadMb} MB each
          </span>
        </button>
      ) : (
        <>
          <div className="grid max-h-72 grid-cols-4 gap-2 overflow-y-auto sm:grid-cols-6">
            {items.map((i) => (
              <div key={i.key} className="group relative aspect-square overflow-hidden rounded-[var(--radius-photo)] bg-surface-2">
                <img src={i.preview} alt="" className="h-full w-full object-cover" />
                {phase === "select" && i.status !== "pinned" && (
                  <button
                    onClick={() => removeItem(i.key)}
                    aria-label={`Remove ${i.file.name}`}
                    className="absolute right-1 top-1 rounded-full bg-black/55 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
                {i.status !== "queued" && (
                  <div className={cn("absolute inset-0 flex items-center justify-center", i.status !== "pinned" && "bg-black/45")}>
                    {i.status === "pinned" && (
                      <span className="rounded-full bg-success p-1 text-white">
                        <Check className="h-3.5 w-3.5" strokeWidth={3} />
                      </span>
                    )}
                    {i.status === "error" && <span className="px-1 text-center text-[11px] font-medium text-white">Failed</span>}
                    {i.status === "uploading" && <span className="text-xs font-semibold text-white">{Math.round(i.progress * 100)}%</span>}
                  </div>
                )}
                {i.status === "uploading" && (
                  <div className="absolute inset-x-0 bottom-0 h-1 bg-black/40">
                    <div className="h-full bg-accent transition-[width]" style={{ width: `${i.progress * 100}%` }} />
                  </div>
                )}
              </div>
            ))}
            {phase === "select" && items.length < MAX_FILES && (
              <button
                onClick={() => inputRef.current?.click()}
                className="flex aspect-square items-center justify-center rounded-[var(--radius-photo)] border-2 border-dashed border-border text-muted hover:border-accent/60 hover:text-accent"
                aria-label="Add more photos"
              >
                <ImagePlus className="h-5 w-5" />
              </button>
            )}
          </div>
          <p className="mt-2 text-sm text-muted">
            {items.length} {items.length === 1 ? "photo" : "photos"}, {formatBytes(totalBytes)}
            {failed > 0 && <span className="text-danger">. {failed} failed and will be retried when you upload again.</span>}
          </p>
        </>
      )}

      {phase === "select" ? (
        <div className="mt-6 space-y-4">
          <button
            type="button"
            role="switch"
            aria-checked={encrypt}
            onClick={() => setEncrypt((v) => !v)}
            className={cn("flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-colors", encrypt ? "border-accent/40 bg-accent-soft/60" : "border-border")}
          >
            {encrypt ? <Lock className="mt-0.5 h-5 w-5 shrink-0 text-accent" /> : <Unlock className="mt-0.5 h-5 w-5 shrink-0 text-muted" />}
            <span className="flex-1">
              <span className="block text-[15px] font-semibold">{encrypt ? "Private" : "Public"}</span>
              <span className="mt-0.5 block text-sm text-muted">
                {encrypt
                  ? "Encrypted before it leaves this device. Only you and people you share with can see these photos."
                  : "Not encrypted. Anyone with the content ID can view these photos on any IPFS gateway."}
              </span>
            </span>
            <span className={cn("mt-0.5 h-6 w-10 shrink-0 rounded-full p-0.5 transition-colors", encrypt ? "bg-accent" : "bg-border")}>
              <span className={cn("block h-5 w-5 rounded-full bg-white shadow transition-transform", encrypt && "translate-x-4")} />
            </span>
          </button>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Tags</span>
              <TagInput value={tags} onChange={setTags} placeholder="travel, family…" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Album</span>
              <select
                value={album}
                onChange={(e) => setAlbum(e.target.value ? Number(e.target.value) : "")}
                className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm"
              >
                <option value="">None</option>
                {albums.data?.albums.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      ) : (
        <ol className="mt-6 grid grid-cols-4 gap-2" aria-label="Upload progress">
          {STEPS.map((s, i) => {
            const state = i < stepIndex ? "done" : i === stepIndex ? "active" : "todo";
            return (
              <li key={s.phase} className="flex flex-col gap-2">
                <span className={cn("h-1 rounded-full", state === "todo" ? "bg-border" : "bg-accent", state === "active" && phase !== "done" && "animate-pulse")} />
                <span className={cn("text-[13px]", state === "todo" ? "text-muted" : "font-semibold")}>
                  {i + 1}. {s.label}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      <div className="mt-7 flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <GasIndicator files={Math.max(items.length, 1)} />
        <Button size="lg" disabled={items.length === 0 || phase === "done"} loading={busy} onClick={start}>
          {phase === "sign" ? "Confirm in your wallet" : busy ? "Uploading" : items.length ? `Upload ${items.length} ${items.length === 1 ? "photo" : "photos"}` : "Upload"}
        </Button>
      </div>
    </Dialog>
  );
}
