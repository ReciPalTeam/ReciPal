import { useMutation, useQueryClient, useInfiniteQuery, type InfiniteData } from "@tanstack/react-query";
import type { ReelFeedItem } from "./use-reels";

// =============================================================================
// Optimistic-update helpers
// =============================================================================

type EngagementKind = "like" | "save";

interface EngagementFields {
  flag: keyof Pick<ReelFeedItem, "liked" | "saved">;
  counter: keyof Pick<ReelFeedItem, "likeCount" | "saveCount">;
}

const ENGAGEMENT_MAP: Record<EngagementKind, EngagementFields> = {
  like: { flag: "liked", counter: "likeCount" },
  save: { flag: "saved", counter: "saveCount" },
};

// React Query stores infinite-query data as { pages: [{ reels: [...] }], pageParams: ... }.
// This walks every cached infinite feed and patches the reel by id with `patch`.
function patchReelInInfiniteCache(
  cache: any,
  reelId: number,
  patch: (reel: ReelFeedItem) => ReelFeedItem,
): InfiniteData<any> | undefined {
  if (!cache?.pages) return cache;
  return {
    ...cache,
    pages: cache.pages.map((page: any) => ({
      ...page,
      reels: page.reels?.map((r: any) => (r.id === reelId ? patch(r) : r)) ?? page.reels,
    })),
  };
}

// =============================================================================
// Toggle hooks (like / save)
// =============================================================================

function useEngagementToggle(kind: EngagementKind) {
  const qc = useQueryClient();
  const { flag, counter } = ENGAGEMENT_MAP[kind];

  return useMutation<
    { active: boolean; count: number },
    Error,
    number,
    { previous: [readonly unknown[], unknown][] }
  >({
    mutationFn: async (reelId) => {
      const res = await fetch(`/api/reels/${reelId}/${kind}`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Failed to ${kind}`);
      }
      return res.json();
    },
    onMutate: async (reelId) => {
      // Touch every cached feed (main feed + per-chef feed) since they all carry engagement state.
      await qc.cancelQueries({ queryKey: ["/api/reels/feed"] });
      await qc.cancelQueries({ queryKey: ["/api/chef"] });

      const previous: [readonly unknown[], unknown][] = [];
      const update = (key: readonly unknown[], data: any) => {
        previous.push([key, data]);
        return patchReelInInfiniteCache(data, reelId, (reel) => {
          const wasActive = Boolean((reel as any)[flag]);
          return {
            ...reel,
            [flag]: !wasActive,
            [counter]: Math.max(0, ((reel as any)[counter] ?? 0) + (wasActive ? -1 : 1)),
          };
        });
      };

      qc.setQueriesData<any>({ queryKey: ["/api/reels/feed"] }, (old: any) => update(["/api/reels/feed"], old));
      qc.setQueriesData<any>({ queryKey: ["/api/chef"] }, (old: any) => {
        // Only patch chef-reels caches (not chef-profile caches).
        if (!old?.pages) return old;
        return update(["/api/chef"], old);
      });

      return { previous };
    },
    onError: (_err, _reelId, context) => {
      // Roll back every cache we touched.
      context?.previous.forEach(([key, data]) => qc.setQueryData(key as any, data as any));
    },
    // No onSettled invalidate — we trust the server response is reflected by the optimistic update.
    // The next natural refetch (when feed becomes stale) will reconcile any drift.
  });
}

export const useToggleLike = () => useEngagementToggle("like");
export const useToggleSave = () => useEngagementToggle("save");

// =============================================================================
// Share tracking (event, not a toggle)
// =============================================================================

export function useShareReel() {
  const qc = useQueryClient();
  return useMutation<
    { count: number },
    Error,
    { reelId: number; method: string },
    { previous: [readonly unknown[], unknown][] }
  >({
    mutationFn: async ({ reelId, method }) => {
      const res = await fetch(`/api/reels/${reelId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ method }),
      });
      if (!res.ok) throw new Error("Failed to record share");
      return res.json();
    },
    onMutate: async ({ reelId }) => {
      await qc.cancelQueries({ queryKey: ["/api/reels/feed"] });
      const previous: [readonly unknown[], unknown][] = [];
      const bump = (key: readonly unknown[], data: any) => {
        previous.push([key, data]);
        return patchReelInInfiniteCache(data, reelId, (reel) => ({
          ...reel,
          shareCount: (reel.shareCount ?? 0) + 1,
        }));
      };
      qc.setQueriesData<any>({ queryKey: ["/api/reels/feed"] }, (old: any) => bump(["/api/reels/feed"], old));
      qc.setQueriesData<any>({ queryKey: ["/api/chef"] }, (old: any) => {
        if (!old?.pages) return old;
        return bump(["/api/chef"], old);
      });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      context?.previous.forEach(([key, data]) => qc.setQueryData(key as any, data as any));
    },
  });
}

// =============================================================================
// Comments
// =============================================================================

export interface ReelComment {
  id: number;
  reelId: number;
  userId: number;
  body: string;
  createdAt: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

interface CommentsPage {
  comments: ReelComment[];
  nextCursor: number | null;
}

export function useReelComments(reelId: number | null, limit = 20) {
  return useInfiniteQuery<CommentsPage>({
    queryKey: ["/api/reels", reelId, "comments", { limit }] as const,
    initialPageParam: null,
    enabled: reelId != null,
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams();
      params.set("limit", String(limit));
      if (pageParam != null) params.set("cursor", String(pageParam));
      const res = await fetch(`/api/reels/${reelId}/comments?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load comments");
      return res.json();
    },
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

export function useCreateComment(reelId: number | null) {
  const qc = useQueryClient();
  return useMutation<
    { comment: ReelComment },
    Error,
    string,
    { previous: any; tempId: number }
  >({
    mutationFn: async (body) => {
      const res = await fetch(`/api/reels/${reelId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ body }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Failed to post comment");
      return json;
    },
    onMutate: async (body) => {
      const key = ["/api/reels", reelId, "comments", { limit: 20 }] as const;
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData(key);
      const tempId = -Date.now(); // negative so it never collides with a server id

      qc.setQueryData(key, (old: any) => {
        if (!old?.pages) {
          return {
            pages: [
              {
                comments: [
                  {
                    id: tempId,
                    reelId,
                    userId: -1,
                    body,
                    createdAt: new Date().toISOString(),
                    username: "you",
                    displayName: "You",
                    avatarUrl: null,
                  },
                ],
                nextCursor: null,
              },
            ],
            pageParams: [null],
          };
        }
        return {
          ...old,
          pages: old.pages.map((page: any, idx: number) =>
            idx === 0
              ? {
                  ...page,
                  comments: [
                    {
                      id: tempId,
                      reelId,
                      userId: -1,
                      body,
                      createdAt: new Date().toISOString(),
                      username: "you",
                      displayName: "You",
                      avatarUrl: null,
                    },
                    ...page.comments,
                  ],
                }
              : page
          ),
        };
      });

      // Bump comment_count on the feed cache too.
      qc.setQueriesData({ queryKey: ["/api/reels/feed"] }, (old: any) =>
        patchReelInInfiniteCache(old, reelId!, (r) => ({
          ...r,
          commentCount: (r.commentCount ?? 0) + 1,
        })),
      );

      return { previous, tempId };
    },
    onSuccess: (data, _body, context) => {
      const key = ["/api/reels", reelId, "comments", { limit: 20 }] as const;
      // Replace the temp with the real server row.
      qc.setQueryData(key, (old: any) => {
        if (!old?.pages) return old;
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            comments: page.comments.map((c: any) =>
              c.id === context?.tempId ? data.comment : c
            ),
          })),
        };
      });
    },
    onError: (_err, _body, context) => {
      const key = ["/api/reels", reelId, "comments", { limit: 20 }] as const;
      if (context?.previous !== undefined) qc.setQueryData(key, context.previous);
      // Roll back the feed counter bump.
      qc.setQueriesData({ queryKey: ["/api/reels/feed"] }, (old: any) =>
        patchReelInInfiniteCache(old, reelId!, (r) => ({
          ...r,
          commentCount: Math.max(0, (r.commentCount ?? 0) - 1),
        })),
      );
    },
  });
}

export function useDeleteComment(reelId: number | null) {
  const qc = useQueryClient();
  return useMutation<{ deleted: true }, Error, number, { previous: any }>({
    mutationFn: async (commentId) => {
      const res = await fetch(`/api/comments/${commentId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Failed to delete");
      return json;
    },
    onMutate: async (commentId) => {
      const key = ["/api/reels", reelId, "comments", { limit: 20 }] as const;
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData(key);
      qc.setQueryData(key, (old: any) => {
        if (!old?.pages) return old;
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            comments: page.comments.filter((c: any) => c.id !== commentId),
          })),
        };
      });
      qc.setQueriesData({ queryKey: ["/api/reels/feed"] }, (old: any) =>
        patchReelInInfiniteCache(old, reelId!, (r) => ({
          ...r,
          commentCount: Math.max(0, (r.commentCount ?? 0) - 1),
        })),
      );
      return { previous };
    },
    onError: (_err, _id, context) => {
      const key = ["/api/reels", reelId, "comments", { limit: 20 }] as const;
      if (context?.previous !== undefined) qc.setQueryData(key, context.previous);
      qc.setQueriesData({ queryKey: ["/api/reels/feed"] }, (old: any) =>
        patchReelInInfiniteCache(old, reelId!, (r) => ({
          ...r,
          commentCount: (r.commentCount ?? 0) + 1,
        })),
      );
    },
  });
}
