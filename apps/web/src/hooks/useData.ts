import type { Album, FilePage, GasEstimate, Grant, SharedOwner, TagCount } from "@asgard/shared";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { api, qs } from "@/lib/api";

export interface FileFilter {
  owner?: string;
  album?: number;
  tag?: string;
  q?: string;
}

export function useFiles(filter: FileFilter, enabled = true) {
  return useInfiniteQuery({
    queryKey: ["files", filter],
    enabled,
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      api.get<FilePage>(`/files${qs({ ...filter, cursor: pageParam || undefined, limit: 40 })}`),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    // Optimistic uploads show as "pending" until the indexer confirms them: poll until then.
    refetchInterval: (q) =>
      q.state.data?.pages.some((p) => p.files.some((f) => f.status === "pending")) ? 2000 : false,
  });
}

export const useAlbums = () =>
  useQuery({ queryKey: ["albums"], queryFn: () => api.get<{ albums: Album[] }>("/albums") });

export const useTags = () =>
  useQuery({ queryKey: ["tags"], queryFn: () => api.get<{ tags: TagCount[] }>("/tags") });

export const useViewers = () =>
  useQuery({ queryKey: ["viewers"], queryFn: () => api.get<{ viewers: Grant[] }>("/shares") });

export const useSharedWithMe = () =>
  useQuery({ queryKey: ["shared"], queryFn: () => api.get<{ owners: SharedOwner[] }>("/shared-with-me") });

export const useGasEstimate = (files: number) =>
  useQuery({
    queryKey: ["gas", files],
    queryFn: () => api.get<GasEstimate>(`/gas/estimate${qs({ files })}`),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
