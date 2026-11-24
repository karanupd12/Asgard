import { getAddress } from "viem";

/** Builds an EIP-4361 (Sign-In With Ethereum) message; verified by apps/api/internal/auth. */
export function buildSiweMessage(p: { address: string; chainId: number; nonce: string }): string {
  const { host, origin } = window.location;
  return [
    `${host} wants you to sign in with your Ethereum account:`,
    getAddress(p.address),
    "",
    "Sign in to Asgard. This request will not trigger a transaction or cost gas.",
    "",
    `URI: ${origin}`,
    "Version: 1",
    `Chain ID: ${p.chainId}`,
    `Nonce: ${p.nonce}`,
    `Issued At: ${new Date().toISOString()}`,
  ].join("\n");
}
