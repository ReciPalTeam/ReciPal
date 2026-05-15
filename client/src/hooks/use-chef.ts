import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import type { ChefRecipe } from "./use-chef-recipes";

export interface ChefProfile {
  id: number;
  userId: number;
  handle: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  isApproved: boolean;
  appliedAt: string;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChefApplication {
  id: number;
  userId: number;
  bio: string;
  sampleLinks: string[];
  status: "pending" | "approved" | "rejected";
  reviewerNotes: string | null;
  reviewedAt: string | null;
  submittedAt: string;
}

export interface ChefMeResponse {
  profile: ChefProfile | null;
  pendingApplication: ChefApplication | null;
}

const CHEF_ME_KEY = ["/api/chef/me"] as const;

export function useChefMe() {
  return useQuery<ChefMeResponse>({
    queryKey: CHEF_ME_KEY,
    queryFn: async () => {
      const res = await fetch("/api/chef/me", { credentials: "include" });
      if (res.status === 401) {
        return { profile: null, pendingApplication: null };
      }
      if (!res.ok) throw new Error("Failed to fetch chef profile");
      return res.json();
    },
    retry: false,
  });
}

export function useApplyAsChef() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { bio: string; sampleLinks: string[] }) => {
      const res = await fetch("/api/chef-applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: "Request failed" }));
        throw new Error(error.error || "Failed to submit application");
      }
      return res.json() as Promise<ChefApplication>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CHEF_ME_KEY });
    },
  });
}

// Public chef profile lookup by handle (auth required — whole app is auth-gated).
export function usePublicChef(handle: string | undefined) {
  return useQuery<{ profile: ChefProfile }>({
    queryKey: ["/api/chef", handle] as const,
    queryFn: async () => {
      const res = await fetch(`/api/chef/${encodeURIComponent(handle!)}`, { credentials: "include" });
      if (!res.ok) {
        if (res.status === 404) throw new Error("Chef not found");
        throw new Error("Failed to load chef profile");
      }
      return res.json();
    },
    enabled: !!handle,
    retry: false,
  });
}

// Minimal reel shape returned by /api/chef/:handle/reels (no chef join — caller knows the chef).
export interface ChefReelSummary {
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
  fingerprintStatus: string;
  likeCount: number;
  saveCount: number;
  shareCount: number;
  commentCount: number;
  viewCount: number;
  createdAt: string;
  liked: boolean;
  saved: boolean;
}

interface ChefReelsPage {
  reels: ChefReelSummary[];
  nextCursor: number | null;
}

export function usePublicChefReels(handle: string | undefined, limit = 12) {
  return useInfiniteQuery<ChefReelsPage>({
    queryKey: ["/api/chef", handle, "reels", { limit }] as const,
    initialPageParam: null,
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams();
      params.set("limit", String(limit));
      if (pageParam != null) params.set("cursor", String(pageParam));
      const res = await fetch(`/api/chef/${encodeURIComponent(handle!)}/reels?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load reels");
      return res.json();
    },
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: !!handle,
  });
}

// Public list of a chef's authored recipes, used by the Recipes tab on /chef/:handle.
export function usePublicChefRecipes(handle: string | undefined, limit = 24) {
  return useQuery({
    queryKey: ["/api/chef", handle, "recipes", { limit }] as const,
    queryFn: async () => {
      const res = await fetch(
        `/api/chef/${encodeURIComponent(handle!)}/recipes?limit=${limit}`,
        { credentials: "include" },
      );
      if (!res.ok) throw new Error("Failed to load recipes");
      return (await res.json()) as { recipes: ChefRecipe[] };
    },
    enabled: !!handle,
    staleTime: 30_000,
  });
}

// Update own chef profile (any subset of fields).
export function useUpdateChef() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { displayName?: string; bio?: string; handle?: string }) => {
      const res = await fetch("/api/chef/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(input),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Failed to update profile");
      return body as { profile: ChefProfile };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CHEF_ME_KEY });
      queryClient.invalidateQueries({ queryKey: ["/api/chef"] });
    },
  });
}

// Upload chef avatar (multipart).
export function useUploadChefAvatar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("avatar", file);
      const res = await fetch("/api/chef/me/avatar", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Failed to upload avatar");
      return body as { profile: ChefProfile; avatarUrl: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CHEF_ME_KEY });
      queryClient.invalidateQueries({ queryKey: ["/api/chef"] });
    },
  });
}
