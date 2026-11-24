import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Copy, Fuel, LogOut, Moon, Sun, Wallet } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useAccount, useBalance, useConnect, useSwitchChain } from "wagmi";
import { useGasEstimate } from "@/hooks/useData";
import { useSession } from "@/hooks/useSession";
import { DEV_ACCOUNTS } from "@/lib/chain";
import { cn, errorMessage, formatToken, shortAddr } from "@/lib/utils";
import { useApp } from "@/providers/AppProviders";
import { Button, Dialog } from "./ui";

const FAUCET = "https://faucet.polygon.technology/";

export function ConnectDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { connectors, connectAsync, isPending, variables } = useConnect();
  const { cfg } = useApp();

  const connect = async (c: (typeof connectors)[number]) => {
    try {
      await connectAsync({ connector: c, chainId: cfg.chainId });
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const wallets = connectors.filter((c) => c.type !== "mock");
  const dev = connectors.filter((c) => c.type === "mock");

  return (
    <Dialog open={open} onClose={onClose} title="Connect a wallet" description="Your wallet is your Asgard account. There's no email or password.">
      <div className="space-y-2">
        {wallets.map((c) => (
          <button
            key={c.uid}
            onClick={() => connect(c)}
            className="flex w-full items-center gap-3 rounded-xl border border-border px-4 py-3.5 text-left font-medium transition-colors hover:border-accent/60"
          >
            {c.icon ? <img src={c.icon} alt="" className="h-7 w-7 rounded-md" /> : <Wallet className="h-7 w-7 text-accent" />}
            <span className="flex-1">{c.name === "Injected" ? "Browser wallet" : c.name}</span>
            {isPending && variables?.connector === c && <span className="text-sm text-muted">Check your wallet</span>}
          </button>
        ))}
      </div>
      {dev.length > 0 && (
        <div className="mt-7">
          <p className="mb-1 text-sm font-semibold">Test wallets</p>
          <p className="mb-3 text-sm text-muted">Pre-funded accounts on the local chain. No extension needed.</p>
          <div className="grid grid-cols-3 gap-2">
            {dev.map((c, i) => (
              <button
                key={c.uid}
                onClick={() => connect(c)}
                className="rounded-xl border border-border px-3 py-3 text-left transition-colors hover:border-accent/60"
              >
                <span className="flex items-center gap-2 font-semibold">
                  <Avatar address={DEV_ACCOUNTS[i]} />
                  Dev #{i + 1}
                </span>
                <span className="mt-1 block font-mono text-xs text-muted">{shortAddr(DEV_ACCOUNTS[i])}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </Dialog>
  );
}

/** "How many more uploads can I afford?" from the wallet balance and the live gas price. */
export function GasIndicator({ files = 1, className }: { files?: number; className?: string }) {
  const { address } = useAccount();
  const { chain } = useApp();
  const balance = useBalance({ address, query: { refetchInterval: 15_000 } });
  const est = useGasEstimate(1);
  const [open, setOpen] = useState(false);

  if (!balance.data || !est.data) return <div className={cn("skeleton h-10 w-44 rounded-lg", className)} />;

  const perUpload = BigInt(est.data.totalCostWei);
  const left = perUpload > 0n ? balance.data.value / perUpload : 0n;
  const low = left < 5n;
  const symbol = chain.nativeCurrency.symbol;
  const batchCost = BigInt(est.data.gasPriceWei) * BigInt(23_100 + est.data.gasPerFile * files);
  const leftLabel = left > 9999n ? "9,999+" : left.toLocaleString();

  return (
    <div className={cn("relative", className)} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        onBlur={() => setOpen(false)}
        aria-expanded={open}
        className={cn(
          "flex h-10 items-center gap-2 rounded-lg border px-3 text-sm",
          low ? "border-danger/40 text-danger" : "border-border text-fg hover:border-fg/30",
        )}
      >
        <Fuel className={cn("h-4 w-4", low ? "text-danger" : "text-accent")} />
        <span className="font-medium">{leftLabel} uploads left</span>
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-30 w-72 animate-rise rounded-xl border border-border bg-surface p-4 text-sm shadow-[0_16px_40px_-16px_rgb(15_23_27/0.35)]">
          <dl className="grid grid-cols-[1fr_auto] gap-y-2">
            <dt className="text-muted">Balance</dt>
            <dd className="text-right font-medium">
              {formatToken(balance.data.value, 18, 4)} {symbol}
            </dd>
            <dt className="text-muted">Cost per photo</dt>
            <dd className="text-right font-medium">
              {formatToken(perUpload, 18, 6)} {symbol}
            </dd>
            {files > 1 && (
              <>
                <dt className="text-muted">This batch of {files}</dt>
                <dd className="text-right font-medium">
                  {formatToken(batchCost, 18, 6)} {symbol}
                </dd>
              </>
            )}
            <dt className="text-muted">Gas price</dt>
            <dd className="text-right font-medium">{formatToken(BigInt(est.data.gasPriceWei), 9, 2)} gwei</dd>
          </dl>
          <p className="mt-3 border-t border-border pt-3 text-xs leading-relaxed text-muted">
            Uploading in batches is cheaper: one transaction covers up to 50 photos.
          </p>
          {low && (
            <a href={FAUCET} target="_blank" rel="noreferrer" className="mt-2 block font-medium text-accent hover:underline">
              Get free test tokens from the faucet
            </a>
          )}
        </div>
      )}
    </div>
  );
}

export function ThemeToggle() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    try {
      localStorage.setItem("asgard-theme", dark ? "dark" : "light");
    } catch {
      /* storage unavailable */
    }
  }, [dark]);
  return (
    <Button variant="ghost" size="icon" onClick={() => setDark((d) => !d)} aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}>
      {dark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
    </Button>
  );
}

export function AccountMenu() {
  const { address, signOut } = useSession();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  if (!address) return null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex h-10 items-center gap-2 rounded-lg border border-border px-2.5 text-sm hover:border-fg/30"
      >
        <Avatar address={address} />
        <span className="hidden font-mono text-[13px] sm:inline">{shortAddr(address)}</span>
        <ChevronDown className="h-4 w-4 text-muted" />
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-30 w-60 animate-rise rounded-xl border border-border bg-surface p-1.5 shadow-[0_16px_40px_-16px_rgb(15_23_27/0.35)]">
          <button
            onClick={() => {
              navigator.clipboard.writeText(address);
              toast.success("Address copied");
              setOpen(false);
            }}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-surface-2"
          >
            <Copy className="h-4 w-4 text-muted" /> Copy wallet address
          </button>
          <button onClick={signOut} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm text-danger hover:bg-danger/10">
            <LogOut className="h-4 w-4" /> Disconnect
          </button>
        </div>
      )}
    </div>
  );
}

/** Deterministic avatar from an address. */
export function Avatar({ address, className }: { address: string; className?: string }) {
  const h = parseInt(address.slice(2, 8), 16) % 360;
  return (
    <span
      className={cn("inline-block h-5 w-5 shrink-0 rounded-full", className)}
      style={{ background: `conic-gradient(from ${h}deg, hsl(${h} 45% 55%), hsl(${(h + 90) % 360} 45% 70%), hsl(${h} 45% 55%))` }}
    />
  );
}

export function NetworkBanner() {
  const { chainId, isConnected } = useAccount();
  const { cfg, chain } = useApp();
  const { switchChain, isPending } = useSwitchChain();
  const qc = useQueryClient();
  if (!isConnected || chainId === cfg.chainId) return null;
  return (
    <div className="flex flex-wrap items-center justify-center gap-3 bg-danger/10 px-4 py-2.5 text-sm text-danger">
      Your wallet is on a different network. Asgard runs on {chain.name}.
      <Button
        size="sm"
        variant="danger"
        loading={isPending}
        onClick={() => switchChain({ chainId: cfg.chainId }, { onSuccess: () => qc.invalidateQueries() })}
      >
        Switch to {chain.name}
      </Button>
    </div>
  );
}
