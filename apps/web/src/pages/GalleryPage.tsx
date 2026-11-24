import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FolderPlus, ImagePlus, SearchX, X } from "lucide-react";
import { useState } from "react";
import { Link, useOutletContext, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Gallery } from "@/components/Gallery";
import type { LayoutContext } from "@/components/AppLayout";
import { Button, Dialog, EmptyState } from "@/components/ui";
import { useAlbums, useTags } from "@/hooks/useData";
import { api } from "@/lib/api";
import { cn, errorMessage } from "@/lib/utils";

export default function GalleryPage() {
  const { openUpload } = useOutletContext<LayoutContext>();
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const tag = params.get("tag") ?? "";
  const tags = useTags();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [albumPicker, setAlbumPicker] = useState(false);

  const setTag = (t: string) => {
    const next = new URLSearchParams(params);
    t && t !== tag ? next.set("tag", t) : next.delete("tag");
    setParams(next);
  };

  const filtering = !!(q || tag);
  const title = q ? `Results for “${q}”` : tag ? `#${tag}` : "Photos";

  return (
    <div className="animate-fade-in">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          {filtering && (
            <button onClick={() => setParams({})} className="mt-2 text-sm font-medium text-accent hover:underline">
              Show all photos
            </button>
          )}
        </div>
      </div>

      {(tags.data?.tags.length ?? 0) > 0 && (
        <div className="-mx-1 mb-8 flex gap-1.5 overflow-x-auto px-1 pb-1" role="group" aria-label="Filter by tag">
          {tags.data!.tags.map((t) => (
            <button
              key={t.tag}
              onClick={() => setTag(t.tag)}
              aria-pressed={tag === t.tag}
              className={cn(
                "shrink-0 rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                tag === t.tag ? "border-accent bg-accent text-accent-fg" : "border-border text-fg hover:border-fg/30",
              )}
            >
              #{t.tag} <span className={tag === t.tag ? "opacity-75" : "text-muted"}>{t.count}</span>
            </button>
          ))}
        </div>
      )}

      <Gallery
        filter={{ q: q || undefined, tag: tag || undefined }}
        selected={selected}
        onSelectedChange={setSelected}
        empty={
          filtering ? (
            <EmptyState
              icon={<SearchX className="h-8 w-8" />}
              title="No photos match"
              body="Search looks at titles and tags. Try a shorter word or pick a tag."
              action={
                <Button variant="secondary" onClick={() => setParams({})}>
                  Show all photos
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={<ImagePlus className="h-8 w-8" />}
              title="Your vault is empty"
              body="Upload photos or drop them anywhere on this page. They're encrypted on this device before they leave it."
              action={<Button onClick={() => openUpload()}>Upload photos</Button>}
            />
          )
        }
      />

      {selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-6 z-30 flex justify-center px-4">
          <div className="flex animate-rise items-center gap-2 rounded-2xl border border-border bg-surface p-2 pl-5 shadow-[0_18px_48px_-18px_rgb(15_23_27/0.5)]">
            <span className="mr-2 text-sm font-semibold">
              {selected.size} selected
            </span>
            <Button size="sm" onClick={() => setAlbumPicker(true)}>
              <FolderPlus className="h-4 w-4" /> Add to album
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())} aria-label="Clear selection">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
      <AlbumPicker open={albumPicker} onClose={() => setAlbumPicker(false)} fileIds={[...selected]} onDone={() => setSelected(new Set())} />
    </div>
  );
}

function AlbumPicker({ open, onClose, fileIds, onDone }: { open: boolean; onClose: () => void; fileIds: number[]; onDone: () => void }) {
  const albums = useAlbums();
  const qc = useQueryClient();
  const add = useMutation({
    mutationFn: (albumId: number) => api.post<{ added: number }>(`/albums/${albumId}/files`, { fileIds }),
    onSuccess: (r, albumId) => {
      const name = albums.data?.albums.find((a) => a.id === albumId)?.name ?? "album";
      toast.success(`Added ${r.added} ${r.added === 1 ? "photo" : "photos"} to ${name}`);
      qc.invalidateQueries({ queryKey: ["albums"] });
      onDone();
      onClose();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Dialog open={open} onClose={onClose} title="Add to album" description={`${fileIds.length} ${fileIds.length === 1 ? "photo" : "photos"} selected`}>
      {albums.data?.albums.length ? (
        <div className="-mx-2 max-h-80 overflow-y-auto">
          {albums.data.albums.map((a) => (
            <button
              key={a.id}
              disabled={add.isPending}
              onClick={() => add.mutate(a.id)}
              className="flex w-full items-center justify-between rounded-lg px-3 py-3 text-left hover:bg-surface-2"
            >
              <span className="font-medium">{a.name}</span>
              <span className="text-sm text-muted">{a.fileCount}</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted">
          You don't have any albums yet.{" "}
          <Link to="/app/albums" className="font-medium text-accent hover:underline" onClick={onClose}>
            Create one
          </Link>{" "}
          first.
        </p>
      )}
    </Dialog>
  );
}
