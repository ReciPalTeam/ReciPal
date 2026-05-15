import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import type { ReelFeedItem } from "./use-reels";

export interface ChefSearchResult {
  id: number;
  handle: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
}

export interface HashtagSearchResult {
  tag: string;
  usageCount: number;
}

export interface ReelSearchResult {
  id: number;
  chefId: number;
  playbackUrl: string;
  thumbnailUrl: string | null;
  title: string | null;
  description: string | null;
  durationS: number | null;
  likeCount: number;
  viewCount: number;
  createdAt: string;
  chefHandle: string;
  chefDisplayName: string;
  chefAvatarUrl: string | null;
}

export interface SearchResponse {
  q: string;
  chefs: ChefSearchResult[];
  hashtags: HashtagSearchResult[];
  reels: ReelSearchResult[];
}

/**
 * Combined search across chefs, hashtags, and reels. Disabled until the query is non-empty
 * (avoids a useless empty-string request on mount).
 */
export function useSearch(query: string, perSection = 5) {
  const trimmed = query.trim();
  return useQuery<SearchResponse>({
    queryKey: ["/api/search", { q: trimmed, perSection }] as const,
    enabled: trimmed.length > 0,
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("q", trimmed);
      params.set("perSection", String(perSection));
      const res = await fetch(`/api/search?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Search failed");
      return res.json();
    },
    staleTime: 30 * 1000,
  });
}

interface HashtagReelsPage {
  reels: ReelFeedItem[];
  nextCursor: number | null;
}

export interface HashtagInfo {
  tag: string;
  usageCount: number;
  createdAt: string;
}

export function useHashtag(tag: string | undefined) {
  return useQuery<{ hashtag: HashtagInfo }>({
    queryKey: ["/api/hashtags", tag] as const,
    enabled: !!tag,
    queryFn: async () => {
      const res = await fetch(`/api/hashtags/${encodeURIComponent(tag!)}`, { credentials: "include" });
      if (!res.ok) {
        if (res.status === 404) throw new Error("Hashtag not found");
        throw new Error("Failed to load hashtag");
      }
      return res.json();
    },
    retry: false,
  });
}

export function useHashtagReels(tag: string | undefined, limit = 12) {
  return useInfiniteQuery<HashtagReelsPage>({
    queryKey: ["/api/hashtags", tag, "reels", { limit }] as const,
    initialPageParam: null,
    enabled: !!tag,
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams();
      params.set("limit", String(limit));
      if (pageParam != null) params.set("cursor", String(pageParam));
      const res = await fetch(`/api/hashtags/${encodeURIComponent(tag!)}/reels?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load tagged reels");
      return res.json();
    },
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}
