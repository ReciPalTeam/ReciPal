import { useQuery } from "@tanstack/react-query";

export interface ChefAnalyticsTotals {
  reelCount: number;
  totalViews: number;
  totalLikes: number;
  totalSaves: number;
  totalShares: number;
  totalComments: number;
}

export interface ChefAnalyticsTopReel {
  id: number;
  title: string | null;
  thumbnailUrl: string | null;
  createdAt: string;
  viewCount: number;
  likeCount: number;
  saveCount: number;
  shareCount: number;
  commentCount: number;
}

export interface ChefAnalyticsResponse {
  chef: { id: number; handle: string; displayName: string };
  totals: ChefAnalyticsTotals;
  topReels: ChefAnalyticsTopReel[];
}

export function useChefAnalytics() {
  return useQuery<ChefAnalyticsResponse>({
    queryKey: ["/api/chef/analytics"] as const,
    queryFn: async () => {
      const res = await fetch("/api/chef/analytics", { credentials: "include" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to load analytics");
      }
      return res.json();
    },
    staleTime: 60 * 1000,
    retry: false,
  });
}
