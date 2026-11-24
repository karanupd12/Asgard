import type { Address } from "@asgard/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, KeyRound, UserPlus, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { isAddress } from "viem";
import { useAccount } from "wagmi";
import { Gallery } from "@/components/Gallery";
import { Avatar } from "@/components/wallet";
import { Badge, Button, EmptyState, Input, Panel, Skeleton } from "@/components/ui";
import { useSharedWithMe, useViewers } from "@/hooks/useData";
import { useKeySync } from "@/hooks/useKeySync";
import { useVaultContract } from "@/hooks/useVaultContract";
import { errorMessage, shortAddr, timeAgo } from "@/lib/utils";

export function SharingPage() {
  const viewers = useViewers();
  const contract = useVaultContract();
  const syncKeys = useKeySync();
  const qc = useQueryClient();
  const { address } = useAccount();
  const [input, setInput] = useState("");

  // The indexer mirrors grants a moment after the tx is mined: refresh a few times.
  const refreshSoon = () => {
    for (const ms of [500, 2000, 5000]) setTimeout(() => qc.invalidateQueries({ queryKey: ["viewers"] }), ms);
  };

  const grant = useMutation({
    mutationFn: async (viewer: Address) => {
      await contract.grantAccess(viewer);
      await new Promise((r) => setTimeout(r, 2500));
      return syncKeys().catch(() => 0);
    },
    onSuccess: (n, viewer) => {
      toast.success(n ? `Shared with ${shortAddr(viewer)}, including ${n} encrypted ${n === 1 ? "photo" : "photos"}` : `Shared with ${shortAddr(viewer)}`);
      setInput("");
      refreshSoon();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const revoke = useMutation({
    mutationFn: (viewer: Address) => contract.revokeAccess(viewer),
    onSuccess: (_, viewer) => {
      toast.success(`Stopped sharing with ${shortAddr(viewer)}`);
      refreshSoon();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const sync = useMutation({
    mutationFn: syncKeys,
    onSuccess: (n) => toast.success(n ? `Shared keys for ${n} ${n === 1 ? "photo" : "photos"}` : "Everyone already has the keys they need"),
    onError: (e) => toast.error(errorMessage(e)),
  });

  const needsSync = viewers.data?.viewers.some((v) => v.hasPublicKey);
  useEffect(() => {
    if (needsSync) syncKeys().catch(() => {});
  }, [needsSync, syncKeys]);

  const self = input.toLowerCase() === address?.toLowerCase();
  const valid = isAddress(input) && !self;

  return (
    <div className="max-w-3xl animate-fade-in">
      <h1 className="text-3xl font-bold tracking-tight">Sharing</h1>
      <p className="mt-2 max-w-xl leading-relaxed text-muted">
        People you add can see every photo in your vault. Access is recorded on the blockchain, and you can stop sharing at any time.
      </p>

      <Panel className="mt-8 p-5">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            valid && grant.mutate(input as Address);
          }}
        >
          <label htmlFor="viewer" className="mb-1.5 block text-sm font-medium">
            Wallet address
          </label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input id="viewer" value={input} onChange={(e) => setInput(e.target.value.trim())} placeholder="0x…" className="font-mono" />
            <Button type="submit" disabled={!valid} loading={grant.isPending} className="shrink-0">
              <UserPlus className="h-4 w-4" /> Share vault
            </Button>
          </div>
          {input && !valid && (
            <p className="mt-2 text-sm text-danger">{self ? "That's your own address." : "Enter a full wallet address starting with 0x."}</p>
          )}
          {grant.isPending && <p className="mt-2 text-sm text-muted">Confirm the transaction in your wallet.</p>}
        </form>
      </Panel>

      <div className="mb-3 mt-10 flex items-center justify-between">
        <h2 className="text-lg font-semibold">People with access</h2>
        <Button variant="ghost" size="sm" loading={sync.isPending} onClick={() => sync.mutate()}>
          <KeyRound className="h-4 w-4" /> Share pending keys
        </Button>
      </div>
      {viewers.isLoading ? (
        <Skeleton className="h-20 rounded-xl" />
      ) : viewers.data?.viewers.length ? (
        <Panel className="divide-y divide-border">
          {viewers.data.viewers.map((v) => (
            <div key={v.address} className="flex flex-wrap items-center gap-4 p-4">
              <Avatar address={v.address} className="h-9 w-9" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-sm">{v.address}</p>
                <p className="mt-0.5 text-sm text-muted">Added {timeAgo(v.grantedAt)}</p>
              </div>
              {v.hasPublicKey ? (
                <Badge tone="success">Can view encrypted photos</Badge>
              ) : (
                <Badge tone="warn">Needs to sign in to Asgard once</Badge>
              )}
              <Button
                variant="danger"
                size="sm"
                loading={revoke.isPending && revoke.variables === v.address}
                onClick={() => revoke.mutate(v.address)}
              >
                Stop sharing
              </Button>
            </div>
          ))}
        </Panel>
      ) : (
        <EmptyState icon={<Users className="h-8 w-8" />} title="You haven't shared your vault" body="Add a wallet address above to let someone view your photos." />
      )}
    </div>
  );
}

export function SharedWithMePage() {
  const shared = useSharedWithMe();
  return (
    <div className="animate-fade-in">
      <h1 className="text-3xl font-bold tracking-tight">Shared with me</h1>
      <p className="mt-2 text-muted">Vaults that other people have shared with your wallet.</p>
      <div className="mt-8">
        {shared.isLoading ? (
          <Skeleton className="h-20 rounded-xl" />
        ) : shared.data?.owners.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {shared.data.owners.map((o) => (
              <Link key={o.owner} to={`/app/shared/${o.owner}`} className="rounded-xl">
                <Panel className="flex items-center gap-4 p-4 transition-colors hover:border-accent/50">
                  <Avatar address={o.owner} className="h-11 w-11" />
                  <div className="min-w-0">
                    <p className="truncate font-mono text-sm font-medium">{shortAddr(o.owner)}</p>
                    <p className="mt-0.5 text-sm text-muted">
                      {o.fileCount} {o.fileCount === 1 ? "photo" : "photos"}, shared {timeAgo(o.grantedAt)}
                    </p>
                  </div>
                </Panel>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState icon={<Users className="h-8 w-8" />} title="Nothing shared with you yet" body="When someone shares their vault with your wallet address, it shows up here." />
        )}
      </div>
    </div>
  );
}

export function SharedOwnerPage() {
  const { owner } = useParams();
  return (
    <div className="animate-fade-in">
      <Link to="/app/shared" className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
        <ArrowLeft className="h-4 w-4" /> Shared with me
      </Link>
      <div className="mb-8 flex flex-wrap items-center gap-3">
        <Avatar address={owner!} className="h-10 w-10" />
        <h1 className="font-mono text-2xl font-semibold">{shortAddr(owner)}</h1>
        <Badge>View only</Badge>
      </div>
      <Gallery filter={{ owner }} readOnly empty={<EmptyState icon={<Users className="h-8 w-8" />} title="No photos yet" body="This vault is empty or still syncing." />} />
    </div>
  );
}
