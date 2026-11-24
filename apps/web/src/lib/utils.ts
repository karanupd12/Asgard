import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatUnits } from "viem";

export const cn = (...c: ClassValue[]) => twMerge(clsx(c));

export const shortAddr = (a?: string | null) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`;
}

export function formatToken(wei: bigint, decimals = 18, digits = 4): string {
  const v = Number(formatUnits(wei, decimals));
  if (v === 0) return "0";
  if (v < 10 ** -digits) return `<${(10 ** -digits).toFixed(digits)}`;
  return v.toLocaleString(undefined, { maximumFractionDigits: digits });
}

export function timeAgo(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function errorMessage(e: unknown): string {
  const err = e as { shortMessage?: string; message?: string };
  return err?.shortMessage ?? err?.message ?? "Something went wrong";
}
