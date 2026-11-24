import type { RuntimeConfig } from "@asgard/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { Chain } from "viem";
import { WagmiProvider } from "wagmi";
import { makeChain, makeWagmiConfig } from "@/lib/chain";
import { ApiError } from "@/lib/api";
import { VaultProvider } from "./VaultProvider";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      refetchOnWindowFocus: false,
      retry: (n, e) => !(e instanceof ApiError && e.status >= 400 && e.status < 500) && n < 2,
    },
  },
});

interface AppCtx {
  cfg: RuntimeConfig;
  chain: Chain;
  gatewayUrl: (cid: string) => string;
}

const Ctx = createContext<AppCtx | null>(null);

export function useApp(): AppCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp outside AppProviders");
  return v;
}

export function AppProviders({ cfg, children }: { cfg: RuntimeConfig; children: ReactNode }) {
  const wagmiConfig = useMemo(() => makeWagmiConfig(cfg), [cfg]);
  const value = useMemo<AppCtx>(() => {
    const base = cfg.gatewayUrl.endsWith("/") ? cfg.gatewayUrl : cfg.gatewayUrl + "/";
    return { cfg, chain: makeChain(cfg), gatewayUrl: (cid) => base + cid };
  }, [cfg]);

  return (
    <Ctx.Provider value={value}>
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <VaultProvider>{children}</VaultProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </Ctx.Provider>
  );
}
