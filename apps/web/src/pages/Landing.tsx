import { Lock, LockOpen } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/wallet";
import { Button, frostStyle } from "@/components/ui";
import { cn } from "@/lib/utils";
import { useApp } from "@/providers/AppProviders";

const steps = [
  { title: "Encrypt", body: "Your browser creates a new key for each photo and encrypts it before upload." },
  { title: "Store", body: "The encrypted file is pinned to IPFS and gets a content ID from its own bytes." },
  { title: "Register", body: "You sign one transaction that records the content IDs to your wallet." },
  { title: "Share", body: "Add a wallet to let it view your photos. Remove it and its keys are deleted." },
];

const PRIVATE = ["Your photos and thumbnails", "Titles, tags and albums", "The keys that unlock each photo"];
const PUBLIC = ["Which wallet registered a file, and when", "Encrypted content IDs", "Which wallets you've shared with"];

/** The hero: a sealed photo exactly as IPFS stores it, which you can unlock right here. */
function Specimen() {
  const [open, setOpen] = useState(false);
  return (
    <figure className="w-full">
      <div className="relative aspect-[7/5] overflow-hidden rounded-[var(--radius-photo)] bg-surface-2">
        <img
          src="/specimen.jpg"
          alt="Moraine Lake at sunrise, mountains reflected in turquoise water"
          className="thaw h-full w-full object-cover"
          data-ready={open}
          fetchPriority="high"
        />
        <div
          className={cn("frost-grain absolute inset-0 transition-opacity duration-700", open ? "opacity-0" : "opacity-100")}
          aria-hidden
        >
          <div className="frost-tint absolute inset-0" style={frostStyle("bafybeigl6kw7or3wuip32u4skm4swtthwxwmrdoh")} />
        </div>
        <Button
          variant="secondary"
          onClick={() => setOpen((o) => !o)}
          className="absolute bottom-4 left-4 border-0 bg-surface/90 backdrop-blur"
          aria-pressed={open}
        >
          {open ? <Lock className="h-4 w-4" /> : <LockOpen className="h-4 w-4" />}
          {open ? "Seal it again" : "Unlock this photo"}
        </Button>
      </div>
      <figcaption className="mt-4 grid gap-1 text-sm sm:grid-cols-[auto_1fr] sm:gap-x-4">
        <span className="font-semibold">{open ? "What you see" : "What everyone else sees"}</span>
        <span className="text-muted">
          {open
            ? "Decrypted in your browser with a key only your wallet can derive."
            : "IPFS nodes, gateways and Asgard's servers only ever hold the encrypted bytes."}
        </span>
      </figcaption>
    </figure>
  );
}

export default function Landing() {
  const { chain } = useApp();
  return (
    <div className="min-h-dvh overflow-x-hidden">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6 sm:px-8">
        <Logo />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link to="/app">
            <Button>Open your vault</Button>
          </Link>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-24 pt-10 sm:px-8 lg:grid-cols-[1fr_1.15fr] lg:gap-16 lg:pt-16">
        <div className="animate-rise">
          <h1 className="text-[clamp(2.6rem,6vw,4.6rem)] font-extrabold leading-[0.98] tracking-[-0.035em]">
            Private photo storage that you own.
          </h1>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-muted">
            Asgard encrypts your photos on your device, keeps them on IPFS, and records them to your wallet. Only the people you choose can unlock them.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link to="/app">
              <Button size="lg">Open your vault</Button>
            </Link>
            <a href="#how">
              <Button size="lg" variant="secondary">
                How it works
              </Button>
            </a>
          </div>
          <p className="mt-6 text-sm text-muted">Free to try on {chain.name}. You need a wallet like MetaMask.</p>
        </div>
        <Specimen />
      </section>

      <section id="how" className="border-y border-border bg-surface">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
          <h2 className="text-3xl font-bold tracking-tight">How it works</h2>
          <ol className="mt-12 grid gap-10 md:grid-cols-4 md:gap-8">
            {steps.map((s, i) => (
              <li key={s.title} className="relative">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-fg">{i + 1}</span>
                  {i < steps.length - 1 && <span className="hidden h-px flex-1 bg-border md:block" aria-hidden />}
                </div>
                <h3 className="mt-5 text-lg font-semibold">{s.title}</h3>
                <p className="mt-1.5 leading-relaxed text-muted">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
        <h2 className="max-w-xl text-3xl font-bold tracking-tight">Exactly what stays private, and what doesn't</h2>
        <p className="mt-3 max-w-xl leading-relaxed text-muted">
          Blockchains are public, so Asgard keeps everything personal off-chain and encrypted. Here is the full split.
        </p>
        <div className="mt-10 grid gap-10 md:grid-cols-2">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-semibold">
              <Lock className="h-5 w-5 text-accent" /> Private to you
            </h3>
            <ul className="mt-4 space-y-3 border-l-2 border-accent pl-5">
              {PRIVATE.map((x) => (
                <li key={x} className="leading-relaxed">{x}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="flex items-center gap-2 text-lg font-semibold">
              <LockOpen className="h-5 w-5 text-muted" /> Visible on the blockchain
            </h3>
            <ul className="mt-4 space-y-3 border-l-2 border-border pl-5 text-muted">
              {PUBLIC.map((x) => (
                <li key={x} className="leading-relaxed">{x}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-8 text-sm text-muted sm:px-8">
          <Logo />
          <span>Built on IPFS and {chain.name}.</span>
        </div>
      </footer>
    </div>
  );
}
