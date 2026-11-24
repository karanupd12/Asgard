import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, FolderOpen, ImagePlus, Plus } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useOutletContext, useParams } from "react-router-dom";
import { toast } from "sonner";
import type { LayoutContext } from "@/components/AppLayout";
import { Gallery } from "@/components/Gallery";
import { SecureImage } from "@/components/SecureImage";
import { Button, Dialog, EmptyState, Input, Skeleton } from "@/components/ui";
import { useAlbums } from "@/hooks/useData";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/utils";

export function AlbumsPage() {
  const albums = useAlbums();
  const [creating, setCreating] = useState(false);

  return (
    <div className="animate-fade-in">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Albums</h1>
          <p className="mt-2 max-w-lg text-muted">Albums are private to you. They're stored with Asgard, not on the blockchain.</p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" /> New album
        </Button>
      </div>

      {albums.isLoading ? (
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="aspect-[4/3] rounded-[var(--radius-photo)]" />
          ))}
        </div>
      ) : albums.data?.albums.length ? (
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 xl:grid-cols-4">
          {albums.data.albums.map((a) => (
            <Link key={a.id} to={`/app/albums/${a.id}`} className="group block rounded-lg focus-visible:outline-offset-4">
              {/* A small stack of prints: two offset sheets behind the cover. */}
              <div className="relative aspect-[4/3] pt-2">
                {a.fileCount > 2 && <div className="absolute inset-x-4 top-0 bottom-3 rounded-[var(--radius-photo)] bg-border/70" />}
                {a.fileCount > 1 && <div className="absolute inset-x-2 top-1 bottom-1.5 rounded-[var(--radius-photo)] bg-border" />}
                <div className="relative h-full overflow-hidden rounded-[var(--radius-photo)] bg-surface-2 transition-transform duration-200 group-hover:-translate-y-1">
                  {a.cover ? (
                    <SecureImage file={a.cover} ownerPublicKey={null} />
                  ) : (
                    <div className="flex h-full items-center justify-center text-muted">
                      <FolderOpen className="h-8 w-8" />
                    </div>
                  )}
                </div>
              </div>
              <p className="mt-3 truncate font-semibold">{a.name}</p>
              <p className="text-sm text-muted">
                {a.fileCount} {a.fileCount === 1 ? "photo" : "photos"}
              </p>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<FolderOpen className="h-8 w-8" />}
          title="No albums yet"
          body="Group photos into albums like “Iceland 2026” or “Receipts”. You can add photos from the Photos page or while uploading."
          action={<Button onClick={() => setCreating(true)}>Create an album</Button>}
        />
      )}
      <CreateAlbumDialog open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}

function CreateAlbumDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState("");
  const qc = useQueryClient();
  const create = useMutation({
    mutationFn: () => api.post("/albums", { name: name.trim() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["albums"] });
      toast.success(`Created ${name.trim()}`);
      setName("");
      onClose();
    },
    onError: (e) => toast.error((e as { status?: number }).status === 409 ? "You already have an album with that name." : errorMessage(e)),
  });
  return (
    <Dialog open={open} onClose={onClose} title="New album">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
        className="space-y-4"
      >
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Name</span>
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Iceland 2026" maxLength={80} />
        </label>
        <Button type="submit" className="w-full" disabled={!name.trim()} loading={create.isPending}>
          Create album
        </Button>
      </form>
    </Dialog>
  );
}

export function AlbumPage() {
  const { id } = useParams();
  const albumId = Number(id);
  const albums = useAlbums();
  const album = albums.data?.albums.find((a) => a.id === albumId);
  const { openUpload } = useOutletContext<LayoutContext>();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);

  const del = useMutation({
    mutationFn: () => api.del(`/albums/${albumId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["albums"] });
      toast.success("Album deleted. Its photos are still in your vault.");
      navigate("/app/albums");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <div className="animate-fade-in">
      <Link to="/app/albums" className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
        <ArrowLeft className="h-4 w-4" /> Albums
      </Link>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{album?.name ?? "Album"}</h1>
          {album && (
            <p className="mt-2 text-muted">
              {album.fileCount} {album.fileCount === 1 ? "photo" : "photos"}
            </p>
          )}
        </div>
        {confirming ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted">Delete the album? Photos stay in your vault.</span>
            <Button variant="danger" size="sm" loading={del.isPending} onClick={() => del.mutate()}>
              Delete album
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => setConfirming(true)}>
            Delete album
          </Button>
        )}
      </div>
      <Gallery
        filter={{ album: albumId }}
        empty={
          <EmptyState
            icon={<ImagePlus className="h-8 w-8" />}
            title="This album is empty"
            body="Select photos on the Photos page and choose Add to album, or pick this album when you upload."
            action={
              <Button variant="secondary" onClick={() => openUpload()}>
                Upload photos
              </Button>
            }
          />
        }
      />
    </div>
  );
}
