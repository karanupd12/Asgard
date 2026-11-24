import { asgardVaultAbi, type Address } from "@asgard/shared";
import { usePublicClient, useWriteContract } from "wagmi";
import type { Hex, TransactionReceipt } from "viem";
import { useApp } from "@/providers/AppProviders";

/** Typed AsgardVault writes that resolve only once the tx is mined successfully. */
export function useVaultContract() {
  const { cfg } = useApp();
  const client = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const address = cfg.contractAddress;

  const wait = async (hash: Hex): Promise<TransactionReceipt> => {
    const receipt = await client!.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") throw new Error("Transaction reverted");
    return receipt;
  };

  return {
    addFiles: async (items: { digest: Hex; codec: number; encrypted: boolean }[]) =>
      wait(
        await writeContractAsync({
          address,
          abi: asgardVaultAbi,
          functionName: "addFiles",
          args: [items.map((i) => i.digest), items.map((i) => BigInt(i.codec)), items.map((i) => i.encrypted)],
        }),
      ),
    removeFile: async (fileId: number) =>
      wait(await writeContractAsync({ address, abi: asgardVaultAbi, functionName: "removeFile", args: [BigInt(fileId)] })),
    grantAccess: async (viewer: Address) =>
      wait(await writeContractAsync({ address, abi: asgardVaultAbi, functionName: "grantAccess", args: [viewer] })),
    revokeAccess: async (viewer: Address) =>
      wait(await writeContractAsync({ address, abi: asgardVaultAbi, functionName: "revokeAccess", args: [viewer] })),
  };
}
