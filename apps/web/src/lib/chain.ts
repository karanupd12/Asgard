import type { Address, RuntimeConfig } from "@asgard/shared";
import { defineChain, type Chain } from "viem";
import { polygonAmoy } from "viem/chains";
import { createConfig, http, type CreateConnectorFn } from "wagmi";
import { injected, mock } from "wagmi/connectors";

export const LOCAL_CHAIN_ID = 31337;

// Anvil/Hardhat's well-known dev accounts (public test keys; local chain only).
export const DEV_ACCOUNTS: Address[] = [
  "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
];

export function makeChain(cfg: RuntimeConfig): Chain {
  if (cfg.chainId === polygonAmoy.id) return polygonAmoy;
  return defineChain({
    id: cfg.chainId,
    name: "Asgard Local",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    // Proxied through the same origin (nginx / vite) so no CORS and no extra ports.
    rpcUrls: { default: { http: [new URL("/rpc", window.location.origin).toString()] } },
    testnet: true,
  });
}

export function makeWagmiConfig(cfg: RuntimeConfig) {
  const chain = makeChain(cfg);
  const connectors: CreateConnectorFn[] = [injected({ shimDisconnect: true })];
  if (cfg.chainId === LOCAL_CHAIN_ID) {
    // "Dev wallets": the local node signs for its unlocked accounts, so the whole app can be
    // demoed (and benchmarked) without installing MetaMask.
    for (const acc of DEV_ACCOUNTS) connectors.push(mock({ accounts: [acc], features: { reconnect: true } }));
  }
  return createConfig({
    chains: [chain],
    connectors,
    transports: { [chain.id]: http() },
    multiInjectedProviderDiscovery: true,
  });
}

export function explorerTx(chain: Chain | undefined, hash: string | null | undefined): string | null {
  const base = chain?.blockExplorers?.default.url;
  return base && hash ? `${base}/tx/${hash}` : null;
}
