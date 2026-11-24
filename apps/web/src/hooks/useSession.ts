import type { Me } from "@asgard/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount, useDisconnect, useSignMessage } from "wagmi";
import { api, ApiError } from "@/lib/api";
import { buildSiweMessage } from "@/lib/siwe";

/** Wallet connection + SIWE session. `signedIn` requires the session to match the wallet. */
export function useSession() {
  const { address, chainId, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { disconnect } = useDisconnect();
  const qc = useQueryClient();

  const meQuery = useQuery({
    queryKey: ["me", address],
    enabled: !!address,
    staleTime: 30_000,
    queryFn: async () => {
      try {
        return await api.get<Me>("/me");
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null;
        throw e;
      }
    },
  });

  const me = meQuery.data ?? null;
  const signedIn = !!(me && address && me.address === address.toLowerCase());

  const signIn = useMutation({
    mutationFn: async () => {
      if (!address || !chainId) throw new Error("Connect a wallet first");
      const { nonce } = await api.post<{ nonce: string }>("/auth/nonce");
      const message = buildSiweMessage({ address, chainId, nonce });
      const signature = await signMessageAsync({ message });
      await api.post("/auth/verify", { message, signature });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["me"] }),
  });

  const signOut = async () => {
    await api.post("/auth/logout").catch(() => {});
    qc.clear();
    disconnect();
  };

  return { address, isConnected, me, signedIn, loading: meQuery.isLoading, signIn, signOut };
}
