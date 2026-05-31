import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface ReelFeedItem {
  id: number;
  chefId: number;
  cfStreamUid: string;
  playbackUrl: string;
  thumbnailUrl: string | null;
  title: string | null;
  description: string | null;
  recipeId: string | null;
  chefRecipeId: number | null;
  durationS: number | null;
  status: string;
  likeCount: number;
  saveCount: number;
  shareCount: number;
  commentCount: number;
  viewCount: number;
  createdAt: string;
  chefHandle: string;
  chefDisplayName: string;
  chefAvatarUrl: string | null;
  // Current user's engagement state (Phase E). LEFT JOIN at feed time.
  liked: boolean;
  saved: boolean;
}

interface ReelsFeedPage {
  reels: ReelFeedItem[];
  nextCursor: number | null;
}

export type ReelsFeedType = "discover" | "following";

export function useReelsFeed(limit = 10, feedType: ReelsFeedType = "discover") {
  return useInfiniteQuery<ReelsFeedPage>({
    // feedType is part of the key so Discover and Following are cached independently.
    queryKey: ["/api/reels/feed", { limit, feedType }] as const,
    initialPageParam: null,
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams();
      params.set("limit", String(limit));
      if (feedType === "following") params.set("feed", "following");
      if (pageParam != null) params.set("cursor", String(pageParam));
      const res = await fetch(`/api/reels/feed?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch reels");
      return res.json();
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: 30 * 1000,
  });
}

/** Record a unique view of a reel (Phase H.19.1). Fire-and-forget; patches the cached feed count. */
export function useRecordReelView() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (reelId: number) => {
      const res = await fetch(`/api/reels/${reelId}/view`, { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error("Failed to record view");
      return (await res.json()) as { viewCount: number };
    },
    onSuccess: (data, reelId) => {
      qc.setQueriesData<any>({ queryKey: ["/api/reels/feed"] }, (old: any) => {
        if (!old?.pages) return old;
        return {
          ...old,
          pages: old.pages.map((p: any) => ({
            ...p,
            reels: p.reels.map((r: ReelFeedItem) => (r.id === reelId ? { ...r, viewCount: data.viewCount } : r)),
          })),
        };
      });
    },
  });
}

/** Owner-only hard delete of a reel. Best-effort cleans up CF Stream on the server. */
export function useDeleteReel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (reelId: number) => {
      const res = await fetch(`/api/reels/${reelId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Failed to delete reel");
      return body as { deleted: true };
    },
    onSuccess: () => {
      // Invalidate the feed plus the public chef reels list (Reels tab on profile).
      qc.invalidateQueries({ queryKey: ["/api/reels/feed"] });
      qc.invalidateQueries({ queryKey: ["/api/chef"] });
    },
  });
}
