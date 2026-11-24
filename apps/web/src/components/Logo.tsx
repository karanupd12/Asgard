import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

/** A six-armed mark: reads as a rune and as a snowflake (cold storage). */
export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("h-7 w-7", className)} aria-hidden>
      <rect width="32" height="32" rx="7" className="fill-accent" />
      <path d="M16 6v20M7.3 11l17.4 10M7.3 21l17.4-10" className="stroke-accent-fg" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ compact }: { compact?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2.5" aria-label="Asgard home">
      <Mark />
      {!compact && <span className="text-[19px] font-bold tracking-tight">Asgard</span>}
    </Link>
  );
}
