import type { VaultFile } from "@asgard/shared";
import { Check, KeyRound } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useFiles, type FileFilter } from "@/hooks/useData";
import { cn } from "@/lib/utils";
import { useVault } from "@/providers/VaultProvider";
import { Lightbox } from "./Lightbox";
import { SecureImage } from "./SecureImage";
import { Button, Skeleton } from "./ui";

const GAP = 6;

type Placed = { file: VaultFile; index: number; w: number };
type Row = { h: number; items: Placed[]; last: boolean };

const aspect = (f: VaultFile) => (f.width && f.height ? f.width / f.height : 4 / 3);

/**
 * Justified rows (like a contact sheet): every photo keeps its aspect ratio, rows fill the
 * width exactly, and reading order stays strictly newest-first — unlike CSS-column masonry.
 */
function justify(files: { file: VaultFile; index: number }[], width: number, target: number): Row[] {
  const rows: Row[] = [];
  let cur: typeof files = [];
  let sum = 0;
  for (const it of files) {
    cur.push(it);
    sum += aspect(it.file);
    if (sum * target + GAP * (cur.length - 1) >= width) {
      const h = (width - GAP * (cur.length - 1)) / sum;
      rows.push({ h, last: false, items: cur.map((c) => ({ ...c, w: aspect(c.file) * h })) });
      cur = [];
      sum = 0;
    }
  }
  if (cur.length) rows.push({ h: target, last: true, items: cur.map((c) => ({ ...c, w: aspect(c.file) * target })) });
  return rows;
}

function monthLabel(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.floor(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

export function Gallery({
  filter,
  readOnly = false,
  empty,
  selected,
  onSelectedChange,
}: {
  filter: FileFilter;
  readOnly?: boolean;
  empty: ReactNode;
  selected?: Set<number>;
  onSelectedChange?: (s: Set<number>) => void;
}) {
  const q = useFiles(filter);
  const files = useMemo(() => q.data?.pages.flatMap((p) => p.files) ?? [], [q.data]);
  const ownerPublicKey = q.data?.pages[0]?.ownerPublicKey ?? null;
  const [open, setOpen] = useState<number | null>(null);
  const [ref, width] = useWidth<HTMLDivElement>();
  const sentinel = useRef<HTMLDivElement>(null);
  const target = width < 640 ? 140 : width < 1100 ? 200 : 240;
  const selecting = (selected?.size ?? 0) > 0;

  const groups = useMemo(() => {
    const out: { label: string; items: { file: VaultFile; index: number }[] }[] = [];
    files.forEach((file, index) => {
      const label = monthLabel(file.createdAt);
      const g = out[out.length - 1];
      g && g.label === label ? g.items.push({ file, index }) : out.push({ label, items: [{ file, index }] });
    });
    return out;
  }, [files]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => e.isIntersecting && q.hasNextPage && !q.isFetchingNextPage && q.fetchNextPage(),
      { rootMargin: "1000px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [q]);

  const toggle = (id: number) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    onSelectedChange?.(next);
  };

  return (
    <div ref={ref}>
      {q.isLoading || width === 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {[260, 180, 320, 220, 280, 200, 240, 300].map((w, i) => (
            <Skeleton key={i} className="h-[200px] grow rounded-[var(--radius-photo)]" style={{ width: w }} />
          ))}
        </div>
      ) : q.isError ? (
        <p className="py-10 text-sm text-danger">Couldn't load photos: {(q.error as Error).message}. Reload the page to try again.</p>
      ) : files.length === 0 ? (
        empty
      ) : (
        <>
          <VaultLockBar count={files.filter((f) => f.encrypted).length} />
          {groups.map((g) => (
            <section key={g.label} className="mb-8">
              <h2 className="mb-3 flex items-baseline gap-3 text-[15px] font-semibold">
                {g.label}
                <span className="text-sm font-normal text-muted">{g.items.length} {g.items.length === 1 ? "photo" : "photos"}</span>
              </h2>
              <div className="flex flex-col" style={{ gap: GAP }}>
                {justify(g.items, width, target).map((row, ri) => (
                  <div key={ri} className="flex" style={{ gap: GAP, height: row.h }}>
                    {row.items.map((p, i) => (
                      <Tile
                        key={p.file.id}
                        file={p.file}
                        ownerPublicKey={ownerPublicKey}
                        style={!row.last && i === row.items.length - 1 ? { flex: 1, minWidth: 0 } : { width: Math.floor(p.w), flexShrink: 0 }}
                        selecting={selecting}
                        selected={selected?.has(p.file.id) ?? false}
                        onOpen={() => setOpen(p.index)}
                        onToggle={onSelectedChange ? () => toggle(p.file.id) : undefined}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </section>
          ))}
          <div ref={sentinel} className="h-8" />
          {q.isFetchingNextPage && <p className="pb-6 text-sm text-muted">Loading older photos…</p>}
        </>
      )}
      {open !== null && files[open] && (
        <Lightbox files={files} index={open} ownerPublicKey={ownerPublicKey} readOnly={readOnly} onIndex={setOpen} onClose={() => setOpen(null)} />
      )}
    </div>
  );
}

/** One place to unlock, instead of a button on every sealed photo. */
function VaultLockBar({ count }: { count: number }) {
  const { keys, unlock, unlocking } = useVault();
  const [err, setErr] = useState<string | null>(null);
  if (keys || count === 0) return null;
  return (
    <div className="mb-7 flex flex-col gap-3 rounded-xl border border-accent/25 bg-accent-soft/60 px-5 py-4 sm:flex-row sm:items-center">
      <KeyRound className="hidden h-5 w-5 shrink-0 text-accent sm:block" />
      <p className="flex-1 text-[15px]">
        <span className="font-semibold">{count} {count === 1 ? "photo is" : "photos are"} sealed.</span>{" "}
        <span className="text-muted">Sign once with your wallet to unlock them in this tab. It's free and sends no transaction.</span>
        {err && <span className="mt-1 block text-sm text-danger">{err}</span>}
      </p>
      <Button
        loading={unlocking}
        onClick={() => {
          setErr(null);
          unlock().catch((e) => setErr(e?.shortMessage ?? "Signature was rejected. Try again when you're ready."));
        }}
      >
        {unlocking ? "Check your wallet" : "Unlock vault"}
      </Button>
    </div>
  );
}

function Tile({
  file,
  ownerPublicKey,
  style,
  selecting,
  selected,
  onOpen,
  onToggle,
}: {
  file: VaultFile;
  ownerPublicKey: string | null;
  style: React.CSSProperties;
  selecting: boolean;
  selected: boolean;
  onOpen: () => void;
  onToggle?: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={file.title || "Untitled photo"}
      aria-pressed={selecting ? selected : undefined}
      onClick={selecting && onToggle ? onToggle : onOpen}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), selecting && onToggle ? onToggle() : onOpen())}
      style={style}
      className="group relative cursor-pointer overflow-hidden rounded-[var(--radius-photo)] bg-surface-2"
    >
      <SecureImage file={file} ownerPublicKey={ownerPublicKey} className={cn("transition-transform duration-200", selected && "scale-[0.92]")} />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-3 pb-2 pt-10 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
        <p className="truncate text-sm font-medium text-white">{file.title || "Untitled"}</p>
      </div>
      {file.status === "pending" && (
        <span className="absolute right-2 top-2 rounded-full bg-surface/90 px-2.5 py-1 text-xs font-medium text-fg backdrop-blur">Saving to chain…</span>
      )}
      {onToggle && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          aria-label={selected ? "Deselect" : "Select"}
          className={cn(
            "absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full border-2 transition",
            selected ? "border-accent bg-accent text-accent-fg" : "border-white/90 bg-black/25 text-transparent opacity-0 group-hover:opacity-100",
            selecting && "opacity-100",
          )}
        >
          <Check className="h-3.5 w-3.5" strokeWidth={3} />
        </button>
      )}
    </div>
  );
}
