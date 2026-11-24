import { FolderOpen, ImagePlus, Images, Plus, Search, Share2, Users } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { NavLink, Outlet, useNavigate, useSearchParams } from "react-router-dom";
import { useAccount } from "wagmi";
import { useSession } from "@/hooks/useSession";
import { cn, formatBytes } from "@/lib/utils";
import { Logo, Mark } from "./Logo";
import { UploadDialog } from "./UploadDialog";
import { AccountMenu, ConnectDialog, GasIndicator, NetworkBanner, ThemeToggle } from "./wallet";
import { Button, Spinner } from "./ui";

const nav = [
  { to: "/app", label: "Photos", icon: Images, end: true },
  { to: "/app/albums", label: "Albums", icon: FolderOpen },
  { to: "/app/shared", label: "Shared with me", icon: Users },
  { to: "/app/sharing", label: "Sharing", icon: Share2 },
];

export interface LayoutContext {
  openUpload: (files?: File[]) => void;
}

export function AppLayout() {
  const { me, signedIn } = useSession();
  const [upload, setUpload] = useState<{ open: boolean; files?: File[] }>({ open: false });
  const [dropping, setDropping] = useState(false);
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const searchRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);

  const openUpload = (files?: File[]) => setUpload({ open: true, files });

  // "/" focuses search, like most photo and code tools.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName) && !t.isContentEditable) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  // Drop photos anywhere in the app to upload them.
  const hasFiles = (e: React.DragEvent) => e.dataTransfer.types.includes("Files");
  const dropHandlers = signedIn
    ? {
        onDragEnter: (e: React.DragEvent) => {
          if (!hasFiles(e) || upload.open) return;
          dragDepth.current++;
          setDropping(true);
        },
        onDragLeave: () => {
          if (--dragDepth.current <= 0) setDropping(false);
        },
        onDragOver: (e: React.DragEvent) => hasFiles(e) && e.preventDefault(),
        onDrop: (e: React.DragEvent) => {
          if (!hasFiles(e) || upload.open) return;
          e.preventDefault();
          dragDepth.current = 0;
          setDropping(false);
          openUpload(Array.from(e.dataTransfer.files));
        },
      }
    : {};

  return (
    <div className="min-h-dvh" {...dropHandlers}>
      <NetworkBanner />
      <div className="mx-auto flex max-w-[1680px]">
        <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col px-5 py-6 md:flex">
          <Logo />
          <Button className="mt-8 w-full" onClick={() => openUpload()} disabled={!signedIn}>
            <Plus className="h-4 w-4" /> Upload
          </Button>
          <nav className="mt-6 space-y-0.5" aria-label="Vault">
            {nav.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] transition-colors",
                    isActive ? "bg-surface font-semibold text-fg shadow-[inset_0_0_0_1px_var(--color-border)]" : "text-muted hover:text-fg",
                  )
                }
              >
                <n.icon className="h-[18px] w-[18px]" /> {n.label}
              </NavLink>
            ))}
          </nav>
          {me && (
            <div className="mt-auto border-t border-border pt-5">
              <p className="text-3xl font-bold tracking-tight">{me.usage.files.toLocaleString()}</p>
              <p className="mt-1 text-sm text-muted">
                {me.usage.files === 1 ? "photo" : "photos"} in your vault, {formatBytes(me.usage.bytes)}
              </p>
              <p className="mt-0.5 text-sm text-muted">{me.usage.encrypted} encrypted</p>
            </div>
          )}
        </aside>

        <div className="min-w-0 flex-1 md:border-l md:border-border">
          <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-bg/85 px-4 backdrop-blur-md md:px-8">
            <div className="md:hidden">
              <Logo compact />
            </div>
            <form
              role="search"
              className="relative max-w-lg flex-1"
              onSubmit={(e) => {
                e.preventDefault();
                const q = (new FormData(e.currentTarget).get("q") as string).trim();
                navigate(`/app${q ? `?q=${encodeURIComponent(q)}` : ""}`);
                searchRef.current?.blur();
              }}
            >
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                ref={searchRef}
                name="q"
                key={params.get("q") ?? ""}
                defaultValue={params.get("q") ?? ""}
                placeholder="Search titles and tags"
                aria-label="Search photos"
                className="h-10 w-full rounded-lg border border-border bg-surface pl-9 pr-10 text-sm placeholder:text-muted focus:border-accent focus:outline-none"
                onChange={(e) => !e.target.value && params.has("q") && setParams({})}
              />
              <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-border px-1.5 text-xs text-muted sm:block">/</kbd>
            </form>
            <div className="ml-auto flex items-center gap-2">
              {signedIn && <GasIndicator className="hidden lg:block" />}
              <ThemeToggle />
              <AccountMenu />
            </div>
          </header>

          <nav className="flex gap-1 overflow-x-auto border-b border-border px-4 py-2 md:hidden" aria-label="Vault">
            {nav.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) => cn("flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm", isActive ? "bg-surface font-semibold" : "text-muted")}
              >
                <n.icon className="h-4 w-4" /> {n.label}
              </NavLink>
            ))}
            <Button size="sm" className="ml-auto shrink-0" onClick={() => openUpload()} disabled={!signedIn} aria-label="Upload">
              <Plus className="h-4 w-4" />
            </Button>
          </nav>

          <main className="px-4 py-7 md:px-10 md:py-9">
            <AuthGate>
              <Outlet context={{ openUpload } satisfies LayoutContext} />
            </AuthGate>
          </main>
        </div>
      </div>

      {dropping && (
        <div className="pointer-events-none fixed inset-3 z-40 flex animate-fade-in items-center justify-center rounded-2xl border-2 border-dashed border-accent bg-accent-soft/85 backdrop-blur-sm">
          <div className="text-center">
            <ImagePlus className="mx-auto h-10 w-10 text-accent" />
            <p className="mt-3 text-xl font-semibold">Drop to upload to your vault</p>
          </div>
        </div>
      )}
      <UploadDialog open={upload.open} initialFiles={upload.files} onClose={() => setUpload({ open: false })} />
    </div>
  );
}

/** Two steps before any vault page: connect a wallet, then prove you own it (SIWE). */
function AuthGate({ children }: { children: ReactNode }) {
  const { isConnected } = useAccount();
  const { signedIn, loading, signIn } = useSession();
  const [connectOpen, setConnectOpen] = useState(false);

  if (isConnected && loading) {
    return (
      <div className="flex py-32">
        <Spinner />
      </div>
    );
  }
  if (signedIn) return <>{children}</>;

  const step = isConnected ? 2 : 1;
  return (
    <div className="max-w-xl animate-rise py-10">
      <Mark className="h-11 w-11" />
      <h1 className="mt-8 text-4xl font-bold tracking-tight">Open your vault</h1>
      <p className="mt-3 text-lg leading-relaxed text-muted">Your wallet is your account and the only key to your photos.</p>

      <ol className="mt-10 space-y-3">
        <GateStep n={1} state={step > 1 ? "done" : "active"} title="Connect a wallet" body="MetaMask or any browser wallet.">
          {step === 1 && <Button onClick={() => setConnectOpen(true)}>Connect wallet</Button>}
        </GateStep>
        <GateStep n={2} state={step === 2 ? "active" : "todo"} title="Sign in" body="One free signature proves this wallet is yours. It sends no transaction.">
          {step === 2 && (
            <Button loading={signIn.isPending} onClick={() => signIn.mutate()}>
              Sign in with Ethereum
            </Button>
          )}
        </GateStep>
      </ol>
      {signIn.error && <p className="mt-4 text-sm text-danger">{(signIn.error as Error).message}</p>}
      <ConnectDialog open={connectOpen} onClose={() => setConnectOpen(false)} />
    </div>
  );
}

function GateStep({ n, state, title, body, children }: { n: number; state: "todo" | "active" | "done"; title: string; body: string; children?: ReactNode }) {
  return (
    <li className={cn("flex gap-4 rounded-xl border p-5", state === "active" ? "border-accent/50 bg-surface" : "border-border", state === "todo" && "opacity-60")}>
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold",
          state === "done" ? "bg-success text-white" : state === "active" ? "bg-accent text-accent-fg" : "bg-surface-2 text-muted",
        )}
      >
        {state === "done" ? "✓" : n}
      </span>
      <div className="flex-1">
        <p className="font-semibold">{title}</p>
        <p className="mt-0.5 text-sm text-muted">{body}</p>
        {children && <div className="mt-4">{children}</div>}
      </div>
    </li>
  );
}
