import type { VaultFile } from "@asgard/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Copy, ExternalLink, Lock, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { explorerTx } from "@/lib/chain";
import { errorMessage, formatBytes, timeAgo } from "@/lib/utils";
import { useApp } from "@/providers/AppProviders";
import { useVaultContract } from "@/hooks/useVaultContract";
import { SecureImage } from "./SecureImage";
import { TagInput } from "./TagInput";
import { Badge, Button, Input } from "./ui";

export function Lightbox({
  files,
  index,
  ownerPublicKey,
  readOnly,
  onIndex,
  onClose,
}: {
  files: VaultFile[];
  index: number;
  ownerPublicKey: string | null;
  readOnly: boolean;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  const file = files[index];
  const { chain } = useApp();
  const qc = useQueryClient();
  const contract = useVaultContract();
  const [title, setTitle] = useState(file.title);
  const [tags, setTags] = useState(file.tags);
  const [confirmRemove, setConfirmRemove] = useState(false);

  useEffect(() => {
    setTitle(file.title);
    setTags(file.tags);
    setConfirmRemove(false);
  }, [file]);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const h = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT") return;
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && index < files.length - 1) onIndex(index + 1);
      if (e.key === "ArrowLeft" && index > 0) onIndex(index - 1);
    };
    window.addEventListener("keydown", h);
    return () => {
      window.removeEventListener("keydown", h);
      document.body.style.overflow = prevOverflow;
    };
  }, [index, files.length, onClose, onIndex]);

  const save = useMutation({
    mutationFn: () => api.patch<VaultFile>(`/files/${file.id}`, { title, tags }),
    onSuccess: () => {
      toast.success("Changes saved");
      qc.invalidateQueries({ queryKey: ["files"] });
      qc.invalidateQueries({ queryKey: ["tags"] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: () => contract.removeFile(file.chainFileId!),
    onSuccess: () => {
      toast.success("Photo removed from your vault");
      qc.invalidateQueries({ queryKey: ["files"] });
      onClose();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const dirty = title !== file.title || tags.join() !== file.tags.join();
  const tx = explorerTx(chain, file.txHash);
  const ratio = file.width && file.height ? file.width / file.height : 4 / 3;

  return (
    <div className="fixed inset-0 z-50 flex animate-fade-in flex-col bg-[#0b1215]/95 lg:flex-row" role="dialog" aria-modal aria-label={file.title || "Photo"}>
      <div className="relative flex min-h-0 flex-1 items-center justify-center p-4 sm:p-10">
        <div
          className="relative overflow-hidden rounded-[var(--radius-photo)]"
          style={{ aspectRatio: ratio, width: `min(100%, calc(84vh * ${ratio}))` }}
        >
          <SecureImage
            key={file.id}
            file={file}
            ownerPublicKey={ownerPublicKey}
            variant="full"
            className="h-full w-full"
            imgClassName="h-full w-full object-contain"
          />
        </div>
        {index > 0 && (
          <NavBtn side="left" label="Previous photo" onClick={() => onIndex(index - 1)}>
            <ChevronLeft className="h-5 w-5" />
          </NavBtn>
        )}
        {index < files.length - 1 && (
          <NavBtn side="right" label="Next photo" onClick={() => onIndex(index + 1)}>
            <ChevronRight className="h-5 w-5" />
          </NavBtn>
        )}
        <button onClick={onClose} aria-label="Close" className="absolute left-4 top-4 rounded-full bg-white/10 p-2.5 text-white hover:bg-white/20">
          <X className="h-5 w-5" />
        </button>
        <p className="absolute bottom-4 left-1/2 hidden -translate-x-1/2 text-xs text-white/50 sm:block">
          {index + 1} of {files.length}. Use arrow keys to move, Esc to close.
        </p>
      </div>

      <aside className="w-full shrink-0 overflow-y-auto border-t border-border bg-surface p-6 lg:w-[340px] lg:border-l lg:border-t-0">
        <div className="mb-5 flex flex-wrap gap-1.5">
          {file.encrypted ? (
            <Badge tone="accent">
              <Lock className="h-3 w-3" /> Encrypted
            </Badge>
          ) : (
            <Badge>Public</Badge>
          )}
          {file.status === "pending" ? <Badge tone="warn">Saving to chain</Badge> : <Badge tone="success">Saved on-chain</Badge>}
        </div>

        {readOnly ? (
          <>
            <h2 className="text-xl font-semibold">{file.title || "Untitled"}</h2>
            {file.tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {file.tags.map((t) => (
                  <Badge key={t}>#{t}</Badge>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Title</span>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Untitled" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Tags</span>
              <TagInput value={tags} onChange={setTags} placeholder="Add a tag and press Enter" />
            </label>
            {dirty && (
              <Button className="w-full" loading={save.isPending} onClick={() => save.mutate()}>
                Save changes
              </Button>
            )}
          </div>
        )}

        <dl className="mt-8 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5 text-sm">
          <dt className="text-muted">Added</dt>
          <dd className="text-right">{timeAgo(file.createdAt)}</dd>
          <dt className="text-muted">Size</dt>
          <dd className="text-right">{formatBytes(file.sizeBytes)}</dd>
          {file.width && (
            <>
              <dt className="text-muted">Dimensions</dt>
              <dd className="text-right">
                {file.width} × {file.height}
              </dd>
            </>
          )}
        </dl>

        <div className="mt-5 rounded-lg bg-surface-2 p-3">
          <p className="mb-1 text-xs text-muted">IPFS content ID</p>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate font-mono text-xs">{file.cid}</code>
            <button
              onClick={() => {
                navigator.clipboard.writeText(file.cid);
                toast.success("Content ID copied");
              }}
              className="rounded p-1 text-muted hover:text-fg"
              aria-label="Copy content ID"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        {tx && (
          <a href={tx} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline">
            View transaction <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}

        {!readOnly && file.chainFileId !== null && (
          <div className="mt-10 border-t border-border pt-5">
            {confirmRemove ? (
              <div className="space-y-3">
                <p className="text-sm text-muted">This sends a transaction that marks the photo as removed. Copies already pinned on IPFS aren't erased.</p>
                <div className="flex gap-2">
                  <Button variant="danger" size="sm" loading={remove.isPending} onClick={() => remove.mutate()}>
                    Remove photo
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setConfirmRemove(false)}>
                    Keep it
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="ghost" size="sm" className="-ml-3 text-danger hover:text-danger" onClick={() => setConfirmRemove(true)}>
                <Trash2 className="h-4 w-4" /> Remove from vault
              </Button>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}

const NavBtn = ({ side, label, onClick, children }: { side: "left" | "right"; label: string; onClick: () => void; children: React.ReactNode }) => (
  <button
    onClick={onClick}
    aria-label={label}
    className={`absolute top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20 ${side === "left" ? "left-4" : "right-4"}`}
  >
    {children}
  </button>
);
