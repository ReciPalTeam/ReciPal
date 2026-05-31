import { useMutation, useQuery, useInfiniteQuery, useQueryClient } from "@tanstack/react-query";

/**
 * Phase H.17 — follow system client hooks.
 * - useToggleFollow: optimistic follow/unfollow of a chef (mirrors use-engagements pattern).
 * - useFollowing: chefs the current user follows (profile "Following" list + count).
 * - useFollowers: creator-only list of who follows me.
 */

export interface FollowingChef {
  chefId: number;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  followerCount: number;
}

export interface FollowerUser {
  userId: number;
  followedAt: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  chefHandle: string | null;
}

/** Toggle follow on a chef. `handle` is used to optimistically patch that chef's profile query. */
export function useToggleFollow(chefId: number, handle?: string) {
  const qc = useQueryClient();
  const chefKey = ["/api/chef", handle] as const;
  return useMutation({
    mutationFn: async (nextFollowing: boolean) => {
      const res = await fetch(`/api/chefs/${chefId}/follow`, {
        method: nextFollowing ? "POST" : "DELETE",
        credentials: "include",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Failed to update follow");
      return body as { following: boolean; followerCount: number };
    },
    onMutate: async (nextFollowing) => {
      if (!handle) return {};
      await qc.cancelQueries({ queryKey: chefKey });
      const prev = qc.getQueryData<{ profile: any; isFollowing: boolean }>(chefKey);
      if (prev) {
        qc.setQueryData(chefKey, {
          ...prev,
          isFollowing: nextFollowing,
          profile: {
            ...prev.profile,
            followerCount: Math.max(0, (prev.profile.followerCount ?? 0) + (nextFollowing ? 1 : -1)),
          },
        });
      }
      return { prev };
    },
    onError: (_e, _v, ctx: any) => {
      if (handle && ctx?.prev) qc.setQueryData(chefKey, ctx.prev);
    },
    onSettled: () => {
      if (handle) qc.invalidateQueries({ queryKey: chefKey });
      qc.invalidateQueries({ queryKey: ["/api/me/following"] });
      // Following feed depends on who you follow — refetch it.
      qc.invalidateQueries({ queryKey: ["/api/reels/feed", { feedType: "following" }] });
    },
  });
}

export function useFollowing(enabled = true) {
  return useInfiniteQuery<{ chefs: FollowingChef[]; nextCursor: number | null }>({
    queryKey: ["/api/me/following"] as const,
    initialPageParam: null as number | null,
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams();
      if (pageParam != null) params.set("cursor", String(pageParam));
      const res = await fetch(`/api/me/following?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load following");
      return res.json();
    },
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled,
  });
}

export function useFollowers(enabled = true) {
  return useInfiniteQuery<{ followers: FollowerUser[]; nextCursor: number | null }>({
    queryKey: ["/api/chef/me/followers"] as const,
    initialPageParam: null as number | null,
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams();
      if (pageParam != null) params.set("cursor", String(pageParam));
      const res = await fetch(`/api/chef/me/followers?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load followers");
      return res.json();
    },
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled,
  });
}
